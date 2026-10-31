import { describe, expect, it } from 'vitest';
import { startBattle } from '../src/battle/battle-state';
import { makeOrb, applyPath } from '../src/battle/board';
import { createRng } from '../src/core/rng';
import { gameData } from '../src/data/load';
import { evaluateAssistantBoard, planAssistantMove } from '../src/battle/assistant/planner';
import { judgePuzzle, type PuzzleGoal } from '../src/progression/puzzle';
import { ASSISTANT_GOALS } from '../src/battle/assistant/goals';
import type { AssistantInput } from '../src/battle/assistant/types';
function input():AssistantInput {
  const stage=gameData.stages.find(s=>s.waves.length>0)!;
  const state=startBattle(stage,[{cardId:gameData.cards[0].id,level:1}],null,createRng(83)).getState();
  state.board={cols:3,rows:3,cells:['fire','fire','fire','heart','heart','heart','wood','water','dark'].map(o=>makeOrb(o as 'fire'))};
  state.enemies.forEach(e=>{e.statuses=[];e.dots=[];e.def={...e.def,abilities:[]};});
  return {state,leaders:[],config:gameData.config.battle,stage,request:{goal:'auto'}};
}
describe('轉珠助手：純規劃及首消預測',()=>{
  it('所有公開目標皆可評估，數值不會變成NaN',()=>{
    for(const goal of ASSISTANT_GOALS){const a=input();a.request={goal:goal.id,color:'fire',constraints:{exactCombo:2}};
      const f=evaluateAssistantBoard(a.state.board,a);expect(Number.isFinite(f.damage)).toBe(true);expect(typeof f.goalAchieved).toBe('boolean');}
  });
  it('exact Combo嚴格符合組數；衝突條件不宣稱達成',()=>{
    const a=input();a.request={goal:'exactcombo',constraints:{exactCombo:2}};
    expect(evaluateAssistantBoard(a.state.board,a).goalAchieved).toBe(true);
    a.request.constraints={exactCombo:1,minCombo:3,requiredColors:['fire'],avoidColors:['fire']};
    const f=evaluateAssistantBoard(a.state.board,a);expect(f.goalAchieved).toBe(false);expect(f.warnings.some(w=>w.includes('衝突'))).toBe(true);
  });
  it('輸出每步相鄰且不碰鎖珠，輸入完全不變',()=>{
    const a=input();a.state.board.cells[4].locked=true;const before=structuredClone(a);
    const p=planAssistantMove(a,{maxSteps:5,beamWidth:8,timeBudgetMs:300});
    expect(a).toEqual(before);expect(p.path.length).toBeGreaterThan(1);expect(p.path.length).toBeLessThanOrEqual(6);
    p.path.forEach((v,i)=>{expect(a.state.board.cells[v.row*3+v.col].locked).toBe(false);if(i){const u=p.path[i-1];expect(Math.max(Math.abs(v.row-u.row),Math.abs(v.col-u.col))).toBe(1);}});
    expect(evaluateAssistantBoard(applyPath(a.state.board,p.path).board,a).combo).toBe(p.forecast.combo);
  });
  it('即使0消仍回傳合法可動路線，全部鎖珠則警告',()=>{
    const a=input();a.state.board={cols:2,rows:2,cells:['fire','water','wood','dark'].map(o=>makeOrb(o as 'fire'))};
    const p=planAssistantMove(a,{maxSteps:2,timeBudgetMs:100});expect(p.path.length).toBeGreaterThan(1);expect(p.forecast.combo).toBe(0);
    a.state.board.cells.forEach(o=>o.locked=true);const locked=planAssistantMove(a);expect(locked.path).toEqual([]);expect(locked.forecast.warnings.some(w=>w.includes('沒有可用'))).toBe(true);
  });
  it('星紋封印、毒珠、中毒及敵人倒數都會反映在預測',()=>{
    const a=input();a.state.team[0].attribute='fire';const base=evaluateAssistantBoard(a.state.board,a);
    a.state.teamStatuses=[{id:'attributeSeal',turns:2,params:{attribute:'fire'}}];expect(evaluateAssistantBoard(a.state.board,a).damage).toBeLessThanOrEqual(base.damage);
    a.state.board.cells[0].poison=true;a.state.hp=a.state.maxHp;a.state.enemies[0].hp=1e9;a.state.enemies[0].cooldown=1;
    const f=evaluateAssistantBoard(a.state.board,a);expect(f.poisonDamage).toBeGreaterThan(0);expect(f.incomingDamage).toBeGreaterThan(0);
  });
  it('不能用轉珠補救已使用主動技的星章',()=>{
    const a=input();a.stage={stars:[{type:'noActiveSkill'}]};a.request={goal:'star'};a.state.usedActiveSkill=true;
    expect(evaluateAssistantBoard(a.state.board,a).goalAchieved).toBe(false);
  });
  it('四類謎題與正式判定一致，含心的多色且空隊伍可運作',()=>{
    const a=input();a.state.team=[];a.state.enemies=[];
    const goals:PuzzleGoal[]=[{kind:'combo',combo:2},{kind:'colorCount',orb:'fire',count:3},{kind:'clearColor',orb:'fire'},{kind:'rainbow',colors:2}];
    for(const goal of goals){a.puzzle={goal,maxSteps:2};a.request={goal:'puzzle'};
      const f=evaluateAssistantBoard(a.state.board,a);
      const official=judgePuzzle({day:'test',board:a.state.board,goal,maxSteps:2,solution:[]},[{row:0,col:0}]);
      expect(f.goalAchieved).toBe(official.solved);
      const plan=planAssistantMove(a,{maxSteps:20,timeBudgetMs:100});expect(plan.path.length).toBeLessThanOrEqual(3);
    }
  });
  it('暗珠盤面不把預估達成說成確定',()=>{
    const a=input();a.request={goal:'exactcombo',constraints:{exactCombo:2}};a.state.board.cells[0].hidden=true;
    const f=evaluateAssistantBoard(a.state.board,a);expect(f.goalAchieved).toBe(false);expect(f.warnings.some(w=>w.includes('隱藏珠'))).toBe(true);
  });
  it('七曜環破格不追溯同批易傷，吸收門檻延續技能傷害',()=>{
    const a=input();a.state.team[0].attribute='fire';a.state.team[0].atk=1000;
    a.state.enemies=[a.state.enemies[0]];const e=a.state.enemies[0];e.hp=e.maxHp=100000;e.def={...e.def,def:0,attribute:'fire'};
    e.statuses=[{id:'ringShield',turns:null,value:75,params:{slots:'fire',vulnerable:2}}];a.request={goal:'ring'};
    const ring=evaluateAssistantBoard(a.state.board,a);expect(ring.ringBroken[0]).toEqual(['fire']);expect(ring.goalAchieved).toBe(true);
    e.statuses[0].params={...e.statuses[0].params,broken:'fire'};const broken=evaluateAssistantBoard(a.state.board,a);expect(broken.damage).toBeGreaterThan(ring.damage);
    e.statuses=[{id:'damageAbsorb',turns:null,value:1000}];a.takenThisTurn=[1000];a.request={goal:'absorb'};
    const absorb=evaluateAssistantBoard(a.state.board,a);expect(absorb.absorbedDamage).toBeGreaterThan(0);expect(absorb.goalAchieved).toBe(false);
  });

  it('補血和星章達成不把無實際補血或尚未通關誤報成功',()=>{
    const a=input();a.state.hp=a.state.maxHp;a.request={goal:'heal'};
    expect(evaluateAssistantBoard(a.state.board,a).goalAchieved).toBe(false);
    a.stage={stars:[{type:'noContinue'}]};a.request={goal:'star'};a.state.enemies[0].hp=1e9;
    expect(evaluateAssistantBoard(a.state.board,a).goalAchieved).toBe(false);
  });
  it('每個保命buff各可擋一次致死傷害，連擊耗盡後仍會死亡',()=>{
    const a=input();a.state.board.cells.forEach(o=>o.type='wood');a.state.team=[];
    a.state.hp=a.state.maxHp=100;const e=a.state.enemies[0];a.state.enemies=[e];
    e.cooldown=1;e.def={...e.def,atk:200};e.statuses=[{id:'multiHit',turns:null,value:2}];
    a.state.buffs=[{kind:'surviveOnce',turns:1},{kind:'surviveOnce',turns:1}];a.request={goal:'survive'};
    expect(evaluateAssistantBoard(a.state.board,a).hpAfter).toBe(1);
    a.state.buffs.pop();expect(evaluateAssistantBoard(a.state.board,a).hpAfter).toBe(0);
    a.state.teamStatuses=[{id:'poison',turns:1,value:50}];
    expect(evaluateAssistantBoard(a.state.board,a).poisonDamage).toBe(0);
  });
  it('搜尋優先保留可達成的硬性Combo條件',()=>{
    const a=input();a.request={goal:'damage',constraints:{exactCombo:2}};
    const p=planAssistantMove(a,{maxSteps:4,beamWidth:24,timeBudgetMs:200});
    expect(p.forecast.constraintsMet).toBe(true);expect(p.forecast.combo).toBe(2);
  });

  it('北歐要求主屬強化，希臘優先主屬，經典獸依獸員實際屬性與生存',()=>{
    const a=input();a.state.team[0].attribute='fire';a.request={goal:'norse'};
    expect(evaluateAssistantBoard(a.state.board,a).goalAchieved).toBe(false);
    a.state.board.cells[0].enhanced=true;expect(evaluateAssistantBoard(a.state.board,a).goalAchieved).toBe(true);
    a.request={goal:'greek'};expect(evaluateAssistantBoard(a.state.board,a).goalAchieved).toBe(true);
    a.state.team[0].race='beast';a.state.enemies=[];a.request={goal:'classicbeast'};
    expect(evaluateAssistantBoard(a.state.board,a).goalAchieved).toBe(true);
    a.state.team[0].race='god';expect(evaluateAssistantBoard(a.state.board,a).goalAchieved).toBe(false);
  });

});
