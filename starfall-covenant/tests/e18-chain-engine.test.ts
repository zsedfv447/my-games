import {describe,expect,it} from 'vitest';
import {gameData} from '../src/data/load';
import {evaluateLeaderTurn} from '../src/battle/leader';
import {computeAttacks,damageAgainst,type BattleMember} from '../src/battle/damage';
import {boardFromStrings,type MatchGroup} from '../src/battle/board';
import {startBattle} from '../src/battle/battle-state';
import {createRng} from '../src/core/rng';
import {applyActiveSkill} from '../src/battle/skills/active';
import {buffMoveTime} from '../src/battle/skills/buffs';
import type {OrbType} from '../src/core/types';
const config=gameData.config.battle;
// Synthetic independent match descriptors, not a solved natural board or trial damage prediction.
const group=(orb:OrbType,n:number,start=0):MatchGroup=>({orb,cells:Array.from({length:n},(_,i)=>start+i),enhancedCount:0,poisonCount:0,cascade:0});
const normalized:BattleMember={cardId:'normalized-test-only',attribute:'dark',race:'dragon',hp:1000,atk:1000,rcv:100};
const trial=gameData.stages.find(s=>s.id==='trial-chain')!;
function actualTrial(){
 const roster=trial.fixedTeam!;expect(roster.helper).toBeDefined();
 const map=(m:{card:string;level:number})=>({cardId:m.card,level:m.level});
 return startBattle(trial,roster.members.map(map),map(roster.helper!),createRng(123),gameData).getState();
}
function actualLeaders(){
 const roster=trial.fixedTeam!;const ids=[roster.members[0].card,roster.helper!.card];expect(ids).toEqual(['c509','c509']);
 return ids.map(id=>gameData.leaderSkills.find(l=>l.id===gameData.cards.find(c=>c.id===id)!.leaderSkill)!);
}
describe('actual leader thresholds separate attack multiplier from defense bypass',()=>{
 for(const [id,expected] of [
  ['l509',[[1,false],[2,false],[2,false]]],
  ['l510',[[1,false],[2.5,true],[2.5,true]]],
  ['l501',[[1,false],[1,false],[3.5,true]]],
 ] as const)for(const [i,n] of [4,5,6].entries())it(`${id} at ${n} orbs uses actual rules`,()=>{
  const groups=[group('dark',n)];const leader=gameData.leaderSkills.find(l=>l.id===id)!;const result=evaluateLeaderTurn([leader],{team:[normalized],groups,combo:1,hpPercent:100,skillUsedThisTurn:false});
  expect(result.atkMultipliers).toEqual([expected[i][0]]);expect(result.ignoreDefense).toBe(expected[i][1]);
  const hits=computeAttacks({team:[normalized],groups,config,atkMultipliers:result.atkMultipliers,ignoreDefense:result.ignoreDefense});expect(hits).toHaveLength(1);expect(hits[0].target).toBe(n>=5?'all':'single');
  const against=damageAgainst(hits[0],{attribute:'dark',def:99999},{combo:1,config});
  if(expected[i][1])expect(against).toBe(hits[0].amount);else expect(against).toBe(1);
 });
});
it('real trial double c509 activates 4x from fire5 but dark3 stays single and does not bypass defense',()=>{
 const state=actualTrial(),groups=[group('dark',3,0),group('fire',5,6)];expect(new Set(groups.flatMap(g=>g.cells)).size).toBe(8);expect(config.fullAttackOrbCount).toBe(5);
 const result=evaluateLeaderTurn(actualLeaders(),{team:state.team,groups,combo:2,hpPercent:100,skillUsedThisTurn:false});expect(result.atkMultipliers).toEqual(state.team.map(()=>4));expect(result.ignoreDefense).toBe(false);
 const hits=computeAttacks({team:state.team,groups,config,atkMultipliers:result.atkMultipliers,ignoreDefense:result.ignoreDefense});
 const dark=hits.filter(h=>h.attribute==='dark'),fire=hits.filter(h=>h.attribute==='fire');expect(dark.length).toBeGreaterThan(0);expect(fire.length).toBeGreaterThan(0);
 for(const h of dark)expect(h.target).toBe('single');for(const h of fire)expect(h.target).toBe('all');
 for(const h of hits){expect(h.ignoreDefense).toBeUndefined();expect(damageAgainst(h,{attribute:h.attribute!,def:999999},{combo:2,config})).toBe(1);}
});
it('dark3 plus a separate dark5 creates separate single/all hits, rather than making every dark group all-target',()=>{
 const groups=[group('dark',3,0),group('dark',5,6)];expect(new Set(groups.flatMap(g=>g.cells)).size).toBe(8);
 const result=evaluateLeaderTurn(actualLeaders(),{team:[normalized],groups,combo:2,hpPercent:100,skillUsedThisTurn:false});
 const hits=computeAttacks({team:[normalized],groups,config,atkMultipliers:result.atkMultipliers,ignoreDefense:result.ignoreDefense});
 expect(hits.map(h=>({target:h.target,amount:h.amount}))).toEqual([{target:'single',amount:5000},{target:'all',amount:7500}]);expect(hits.every(h=>!h.ignoreDefense)).toBe(true);
});
for(const [order,expected] of [ [['s509','s107'],{dark:0,fire:18}], [['s107','s509'],{dark:6,fire:12}] ] as const)it(`actual skill effects ${order.join(' then ')} on labelled example board`,()=>{
 const state=actualTrial();state.board=boardFromStrings(['dddddd','hhhhhh','ffffff','wwwwww','gggggg']);const before=structuredClone(state);const rng=createRng(99);
 for(const id of order){const caster=state.team.findIndex(m=>gameData.cards.find(c=>c.id===m.cardId)?.activeSkill===id);expect(caster).toBeGreaterThanOrEqual(0);const skill=gameData.skills.find(s=>s.id===id)!;const out=applyActiveSkill(state,caster,skill,rng);expect(out.hits).toEqual([]);expect(out.heal).toBe(0);expect(out.selfDamage).toBe(0);}
 const count=(type:OrbType)=>state.board.cells.filter(c=>c.type===type).length;
 expect(count('dark')).toBe(expected.dark);expect(count('fire')).toBe(expected.fire);expect(count('heart')).toBe(0);expect(count('water')).toBe(6);expect(count('wood')).toBe(6);expect(count('light')).toBe(0);
 expect(state.buffs).toEqual([{kind:'moveTime',seconds:1,turns:1}]);expect(buffMoveTime(state)).toBe(1);expect(state.hp).toBe(before.hp);expect(state.enemies).toEqual(before.enemies);
});
it('actual trial boss has stated stats and no hidden invented shield/immune ability',()=>{
 expect(trial.waves.at(-1)!.enemies).toEqual(['e0017']);const boss=gameData.enemies.find(e=>e.id==='e0017')!;
 expect(boss).toMatchObject({attribute:'wood',hp:80000,def:3000,atk:1400,cd:3,abilities:[]});
});
