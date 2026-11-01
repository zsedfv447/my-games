import {it,expect} from 'vitest';
import {gameData} from '../src/data/load';
import {startBattle} from '../src/battle/battle-state';
import {createRng} from '../src/core/rng';
import {boardFromStrings,applyPath} from '../src/battle/board';
import {planAssistantMove,evaluateAssistantBoard,analyzeGreekSurvivors,assistantBoardPriority,compareAssistantPriority} from '../src/battle/assistant/planner';
import type {AssistantInput} from '../src/battle/assistant/types';
function fixture():AssistantInput {
 const state=startBattle(gameData.stages[0],[{cardId:'c807',level:1}],{cardId:'c807',level:1},createRng(3),gameData).getState();
 state.board=boardFromStrings(['ffwffg','whfdlg','dglwhd','glwhdg','lwhdgl']);state.enemies=[state.enemies[0]];state.enemies[0].hp=state.enemies[0].maxHp=1e9;state.enemies[0].cooldown=99;state.enemies[0].def={...state.enemies[0].def,atk:0,def:0,abilities:[]};
 return {state,config:gameData.config.battle,leaders:[gameData.leaderSkills.find(l=>l.id==='l807'),gameData.leaderSkills.find(l=>l.id==='l807')],request:{goal:'greek',greek:{reserve:true}}};
}
it('opt-in reserves two of five; default off preserves old five and no analysis',()=>{
 const a=fixture(),p=planAssistantMove(a,{maxSteps:1,beamWidth:128,timeBudgetMs:2000});
 expect(p.forecast.groups.filter(g=>g.orb==='fire').reduce((n,g)=>n+g.cells.length,0)).toBe(3);
 expect(p.forecast.greekAnalysis?.quotaByColor.fire).toBe(2);expect(p.forecast.greekAnalysis?.retainedByColor.fire).toBe(2);
 a.request.greek={};const off=planAssistantMove(a,{maxSteps:1,beamWidth:128,timeBudgetMs:2000});expect(off.forecast.groups.filter(g=>g.orb==='fire').reduce((n,g)=>n+g.cells.length,0)).toBe(5);expect(off.forecast.greekAnalysis).toBeUndefined();
});
it('known survivor gravity and unknown hooks remain distinct without mutating input',()=>{
 const a=fixture();a.request.greek={setup:true};const before=structuredClone(a);
 const f=evaluateAssistantBoard(applyPath(a.state.board,[{row:0,col:3},{row:0,col:2}]).board,a);
 expect(f.greekAnalysis).toBeDefined();expect(f.greekAnalysis!.knownCascadeGroups).toBeGreaterThanOrEqual(0);expect(f.greekAnalysis!.conditionalHooks).toBeGreaterThanOrEqual(0);expect(a).toEqual(before);
});
it('hidden or no-skyfall suppress analysis, as do irrelevant goals and ineffective leaders',()=>{
 for(const mode of ['hidden','noSkyfall','goal','leaders']){const a=fixture();if(mode==='hidden')a.state.board.cells[0].hidden=true;if(mode==='noSkyfall')a.state.buffs.push({kind:'noSkyfallCombo',turns:2});if(mode==='goal')a.request.goal='damage';if(mode==='leaders')a.leaders=[];expect(evaluateAssistantBoard(a.state.board,a).greekAnalysis).toBeUndefined();}
});

it('known matches join adjacent same-color marked runs but keep disconnected groups separate',()=>{
 expect(analyzeGreekSurvivors(['fire','fire','fire','fire','fire','fire'],3,2,[],['fire'])).toEqual({knownCascadeGroups:1,conditionalHooks:0});
 expect(analyzeGreekSurvivors(['fire','fire','fire','water','wood','water','fire','fire','fire'],3,3,[],['fire']).knownCascadeGroups).toBe(2);
 expect(analyzeGreekSurvivors([null,'fire','fire'],3,1,[],['fire'])).toEqual({knownCascadeGroups:0,conditionalHooks:1});
});
it('bounded opt-in timing comparison reports measured work without wall-clock assertions',()=>{
 const a=fixture();for(const greek of [{},{reserve:true},{setup:true},{reserve:true,setup:true}]){a.request.greek=greek;const start=performance.now(),p=planAssistantMove(a,{maxSteps:4,beamWidth:24,timeBudgetMs:2000});console.info(JSON.stringify({greek,elapsedMs:performance.now()-start,examined:p.examined,timedOut:p.timedOut}));expect(p.timedOut).toBe(false);expect(p.path.length).toBeGreaterThan(1);}
});

it('a single total tuple prioritizes survival, constraints, absorption, goal and kills before conservation',()=>{
 const a=fixture(),base=evaluateAssistantBoard(applyPath(a.state.board,[{row:0,col:3},{row:0,col:2}]).board,a);
 const rank=(f:typeof base)=>assistantBoardPriority(f,a)!;
 for(const change of [{hpAfter:0},{constraintsMet:false},{absorbedDamage:1},{goalAchieved:false}]){const worse={...base,...change,greekAnalysis:{...base.greekAnalysis!,quotaByColor:{fire:30},retainedByColor:{fire:30}}};expect(compareAssistantPriority(rank(base),rank(worse))).toBeGreaterThan(0);}
 const kill={...base,enemyHp:[0]};expect(compareAssistantPriority(rank(kill),rank(base))).toBeGreaterThan(0);
 const ranks=[rank(base),rank(kill),rank({...base,hpAfter:0})];for(const x of ranks)for(const y of ranks)for(const z of ranks){expect(Math.sign(compareAssistantPriority(x,y))).toBe(-Math.sign(compareAssistantPriority(y,x))||0);if(compareAssistantPriority(x,y)>0&&compareAssistantPriority(y,z)>0)expect(compareAssistantPriority(x,z)).toBeGreaterThan(0);}
});
