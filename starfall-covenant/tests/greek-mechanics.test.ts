import { describe, expect, it } from 'vitest';
import { boardFromStrings, resolveBoard } from '../src/battle/board';
import { createRng } from '../src/core/rng';
import { checkLeaderTier, evaluateLeaderStatic } from '../src/battle/leader';
import { resumeBattle, startBattle } from '../src/battle/battle-state';
import { gameData } from '../src/data/load';
import type { LeaderSkillDef, MatchedOrbSkyfall } from '../src/core/types';

const generated = (board: ReturnType<typeof boardFromStrings>, effects: MatchedOrbSkyfall[]) =>
  resolveBoard(board, createRng(77), { matchedOrbSkyfall: effects, enhancedChance: 0 }).steps[0].after.cells.filter(o=>o.enhanced);
const fire:MatchedOrbSkyfall={orb:'fire',count:3,spawn:1};
describe('希臘同色強化連鎖機制',()=>{
  it('每段按消除同色顆數產生強化珠，不把其他顏色計入',()=>{
    expect(generated(boardFromStrings(['fff','whd']),[fire])).toEqual([expect.objectContaining({type:'fire',enhanced:true})]);
    expect(generated(boardFromStrings(['fff','fff','whd']),[fire])).toHaveLength(2);
    expect(generated(boardFromStrings(['www','fhd']),[fire])).toHaveLength(0);
  });
  it('同色雙隊長取當段較高產量，不疊加；不同屬可分別觸發',()=>{
    const b=boardFromStrings(['fff','www','hld']);
    expect(generated(b,[fire,fire])).toHaveLength(1);
    expect(generated(b,[fire,{...fire,spawn:2}])).toHaveLength(2);
    const mixed=generated(b,[fire,{orb:'water',count:3,spawn:1}]);
    expect(mixed.map(o=>o.type).sort()).toEqual(['fire','water']);
  });
  it('條件為always/teamAll才啟用，神族filter可正常運作',()=>{
    const leader:LeaderSkillDef={id:'greek-test',name:'希臘',description:'test',rules:[{conditions:[{type:'teamAll',filter:{race:'god'}}],effects:[{type:'matchedOrbSkyfall',...fire}]}]};
    const member={cardId:'test',attribute:'fire' as const,race:'god' as const,hp:100,atk:100,rcv:10};
    expect(evaluateLeaderStatic([leader,leader],[member]).matchedOrbSkyfall).toEqual([fire,fire]);
    expect(evaluateLeaderStatic([leader],[{...member,race:'human'}]).matchedOrbSkyfall).toEqual([]);
  });
  it('不變更輸入；固定種子重現；未啟用時不改舊天降序列',()=>{
    const b=boardFromStrings(['fff','whd']),before=structuredClone(b);
    expect(resolveBoard(b,createRng(7),{matchedOrbSkyfall:[fire]})).toEqual(resolveBoard(b,createRng(7),{matchedOrbSkyfall:[fire]}));
    expect(b).toEqual(before);
    expect(resolveBoard(b,createRng(7))).toEqual(resolveBoard(b,createRng(7),{matchedOrbSkyfall:[]}));
  });
  it('異常大量生成受空格與50段安全上限保護；禁止天降不被強制注入覆蓋',()=>{
    const b=boardFromStrings(['fff']);
    const loop=resolveBoard(b,createRng(9),{matchedOrbSkyfall:[{orb:'fire',count:1,spawn:999999}]});
    expect(loop.steps).toHaveLength(50);expect(loop.steps.every(s=>s.after.cells.length===3)).toBe(true);
    const stopped=resolveBoard(b,createRng(9),{matchedOrbSkyfall:[{orb:'fire',count:1,spawn:999999}],skyfallCombo:false});
    expect(stopped.steps).toHaveLength(1);
    expect(resolveBoard(b,createRng(9),{matchedOrbSkyfall:[{orb:'fire',count:0,spawn:Infinity}]}).steps.length).toBeLessThan(50);
  });
  it('正式submitMove接上隊長技設定，並顯示真實補出的強化珠',()=>{
    const leader:LeaderSkillDef={id:'greek-test',name:'希臘',description:'test',rules:[{conditions:[{type:'always'}],effects:[{type:'matchedOrbSkyfall',...fire}]}]};
    const card={...gameData.cards[0],leaderSkill:leader.id};
    const data={...gameData,cards:[card],leaderSkills:[leader]};
    const stage=gameData.stages.find(s=>s.waves.length>0)!;
    const snap=startBattle(stage,[{cardId:card.id,level:1}],null,createRng(44),data).snapshot();
    snap.state.board=boardFromStrings(['fff','whd']);
    const battle=resumeBattle(stage,snap,data);
    const turn=battle.submitMove([{row:0,col:0}]);
    expect(turn.ok).toBe(true);
    if(turn.ok)expect(turn.summary.steps[0].after.cells.filter(o=>o.enhanced)).toEqual([expect.objectContaining({type:'fire'})]);
  });
});

import { applyActiveSkill } from '../src/battle/skills/active';
import { buffAttackMultipliers, tickBuffs } from '../src/battle/skills/buffs';
import { defenseProfile, tickStatuses } from '../src/battle/skills/status';
import { evaluateAssistantBoard } from '../src/battle/assistant/planner';
import type { ActiveSkillDef } from '../src/core/types';

function markBattle() {
  const skill:ActiveSkillDef={id:'mark-test',name:'水屬印記',description:'test',cooldown:{max:1,min:1},effects:[{type:'markAttack',attribute:'water',initialMultiplier:1.4,step:.2,maxMultiplier:2.2}]};
  const card={...gameData.cards[0],attribute:'water' as const,activeSkill:skill.id,leaderSkill:undefined};
  const enemy={...gameData.enemies[0],hp:1000000000,def:1000,atk:0,cd:100,abilities:[]};
  const stage={...gameData.stages.find(s=>s.waves.length>0)!,waves:[{enemies:[enemy.id]}]};
  const data={...gameData,cards:[card],skills:[skill],enemies:[enemy]};
  const snap=startBattle(stage,[{cardId:card.id,level:1}],null,createRng(7),data).snapshot();
  snap.state.team[0].skillCooldown=0;snap.state.team[0].atk=10000;
  snap.state.board=boardFromStrings(['www','fhd']);
  return {battle:resumeBattle(stage,snap,data),data,stage};
}
describe('經典印記與破防積木',()=>{
  it('印記只增幅對應屬性，有傷才疊加且不超過上限，無傷即消失',()=>{
    const state=markBattle().battle.getState();
    applyActiveSkill(state,0,{id:'m',name:'m',description:'',cooldown:{max:1,min:1},effects:[{type:'markAttack',attribute:'water',initialMultiplier:1.4,step:.2,maxMultiplier:2.2}]},createRng(1));
    expect(buffAttackMultipliers(state)[0]).toBeCloseTo(1.4);
    const mark=state.buffs[0];expect(mark.kind).toBe('markAttack');
    if(mark.kind!=='markAttack')throw new Error('mark missing');
    expect(tickBuffs([mark])).toEqual([]);
    let buffs=state.buffs;
    for(let i=0;i<20;i++){buffs=buffs.map(b=>b.kind==='markAttack'?{...b,dealtDamage:true}:b);buffs=tickBuffs(buffs);}
    expect(buffs[0].kind==='markAttack'&&buffs[0].multiplier).toBe(2.2);
    state.team[0].attribute='fire';expect(buffAttackMultipliers(state)[0]).toBe(1);
  });
  it('正式轉珠維持印記、空轉解除；中途snapshot不遺失本回合已傷害記錄',()=>{
    const {battle,data,stage}=markBattle();expect(battle.useSkill(0).ok).toBe(true);
    const saved=battle.snapshot();expect(saved.state.buffs[0].kind).toBe('markAttack');
    const resumed=resumeBattle(stage,JSON.parse(JSON.stringify(saved)),data);
    const result=resumed.submitMove([{row:0,col:0}]);expect(result.ok).toBe(true);
    const buff=resumed.getState().buffs[0];expect(buff.kind==='markAttack'&&buff.multiplier).toBeCloseTo(1.6);
    const next=resumed.snapshot();next.state.board=boardFromStrings(['fwh','hdf']);
    const noDamage=resumeBattle(stage,next,data);noDamage.submitMove([{row:0,col:0}]);expect(noDamage.getState().buffs.some(b=>b.kind==='markAttack')).toBe(false);
  });
  it('技能已造成同屬傷害的印記旗標可存檔，還原後仍維持該回合效果',()=>{
    const {battle,data,stage}=markBattle();
    data.skills[0].effects.push({type:'damage',mode:'multiplier',attribute:'water',target:'single',value:1});
    battle.useSkill(0);
    const snap=battle.snapshot();const buff=snap.state.buffs[0];expect(buff.kind==='markAttack'&&buff.dealtDamage).toBe(true);
    snap.state.board=boardFromStrings(['fwh','hdf']);
    const resumed=resumeBattle(stage,JSON.parse(JSON.stringify(snap)),data);resumed.submitMove([{row:0,col:0}]);
    const kept=resumed.getState().buffs[0];expect(kept.kind==='markAttack'&&kept.multiplier).toBeCloseTo(1.6);
  });
  it('破防套用全部活敵、依百分比降低實際防禦並隨回合到期',()=>{
    const state=markBattle().battle.getState();state.enemies.push({...structuredClone(state.enemies[0]),hp:0});
    const base=defenseProfile(state.enemies[0]).def;
    applyActiveSkill(state,0,{id:'d',name:'d',description:'',cooldown:{max:1,min:1},effects:[{type:'reduceEnemyDefense',percent:90,turns:3}]},createRng(1));
    expect(defenseProfile(state.enemies[0]).def).toBe(Math.floor(base*.1));expect(state.enemies[1].statuses).toEqual([]);
    let statuses=state.enemies[0].statuses;for(let i=0;i<3;i++)statuses=tickStatuses(statuses)[0];expect(statuses).toEqual([]);
  });
  it('助手沿用印記與破防真實傷害，希臘模式明示首消以外不保證',()=>{
    const state=markBattle().battle.getState();state.enemies[0].def.def=100000;
    const input={state,leaders:[],config:gameData.config.battle,request:{goal:'greek' as const}};
    const before=evaluateAssistantBoard(state.board,input);
    applyActiveSkill(state,0,{id:'d',name:'d',description:'',cooldown:{max:1,min:1},effects:[{type:'markAttack',attribute:'water',step:.2,initialMultiplier:1.4,maxMultiplier:2.2},{type:'reduceEnemyDefense',percent:99,turns:3}]},createRng(1));
    const after=evaluateAssistantBoard(state.board,input);expect(after.damage).toBeGreaterThan(before.damage);expect(after.warnings.some(w=>w.includes('後續同色強化'))).toBe(true);
  });
});

describe('經典純生命與純回復5★隊長上限',()=>{
  const leader=(effects:LeaderSkillDef['rules'][number]['effects']):LeaderSkillDef=>({id:'pure-classic',name:'test',description:'test',rules:[{conditions:[{type:'always'}],effects}]});
  it('純單項2.5倍可通過，2.5以上或其他星級仍受限制',()=>{
    for(const type of ['hpMultiplier','rcvMultiplier'] as const){
      expect(checkLeaderTier(leader([{type,value:2.5}]),5)).toEqual([]);
      expect(checkLeaderTier(leader([{type,value:2.6}]),5).length).toBeGreaterThan(0);
      expect(checkLeaderTier(leader([{type,value:2.5}]),4).length).toBeGreaterThan(0);
    }
  });
  it('混攻擊、雙能力或其他加成都維持原1.5倍限制',()=>{
    for(const type of ['hpMultiplier','rcvMultiplier'] as const){
      for(const extra of [{type:'atkMultiplier',value:2},{type:'extendMoveTime',seconds:1}] as const){
        expect(checkLeaderTier(leader([{type,value:2.5},extra]),5).length).toBeGreaterThan(0);
      }
    }
    expect(checkLeaderTier(leader([{type:'hpMultiplier',value:2.5},{type:'rcvMultiplier',value:2.5}]),5).length).toBeGreaterThan(0);
  });
});
