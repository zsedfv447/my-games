import {expect,it} from 'vitest';
import {gameData} from '../src/data/load';
import {evaluateLeaderStatic,evaluateLeaderTurn} from '../src/battle/leader';
import {teamCapabilities} from '../src/ui/team-capabilities';
import {startBattle} from '../src/battle/battle-state';
import {applyActiveSkill} from '../src/battle/skills/active';
import {createRng} from '../src/core/rng';
import type {CardDef} from '../src/core/types';
import type {MatchGroup} from '../src/battle/board';
const card=(id:string)=>gameData.cards.find(c=>c.id===id)!;
const skill=(id:string)=>gameData.skills.find(s=>s.id===id);
const leader=(id:string)=>gameData.leaderSkills.find(l=>l.id===id);
const normalized=(c:CardDef)=>({cardId:c.id,attribute:c.attribute,race:c.race,hp:1000,atk:1000,rcv:100});
const hearts:MatchGroup[]=[{orb:'heart',cells:[0,1,2],enhancedCount:0,poisonCount:0,cascade:0}];
function oracle(members:CardDef[],helper:CardDef|null=null,hpPercent=100,groups:MatchGroup[]=[]){
 const cards=helper?[...members,helper]:members;
 const leaders=[members[0]?.leaderSkill?leader(members[0].leaderSkill):undefined,helper?.leaderSkill?leader(helper.leaderSkill):undefined];
 return evaluateLeaderTurn(leaders,{team:cards.map(normalized),groups,combo:groups.length,hpPercent,skillUsedThisTurn:false});
}
it('actual l405 composition: mixed/no helper, all dragon, and selected helper are not interchangeable',()=>{
 expect(oracle([card('c405'),card('c206')]).damageReductions).toEqual([]);
 expect(oracle([card('c405'),card('c107')]).damageReductions).toEqual([20]);
 expect(oracle([card('c405'),card('c107')],card('c107')).damageReductions).toEqual([20]);
 expect(oracle([card('c405'),card('c107')],card('c206')).damageReductions).toEqual([]);
 expect(oracle([card('c206'),card('c405')]).damageReductions).toEqual([]);
 // l405 also works from actual helper position; ordinary member never provides its leader rule.
 expect(oracle([card('c107')],card('c405')).damageReductions).toEqual([20]);
});
it('actual l405 and l706 always recovery targets matching race, not all members or direct healing',()=>{
 for(const [id,matching,other,multiplier] of [['l405','c405','c206',1.2],['l706','c706','c405',1.3]] as const){
  const result=evaluateLeaderStatic([leader(id)],[card(matching),card(other)].map(normalized));expect(result.rcvMultipliers).toEqual([multiplier,1]);
 }
});
it('actual l507 strictly below20 and l706 strictly below50 change defense only from runtime HP',()=>{
 for(const [id,cutoff,percent] of [['c507',20,20],['c706',50,25]] as const){
  expect(oracle([card(id)],null,cutoff).damageReductions).toEqual([]);
  expect(oracle([card(id)],null,cutoff-1).damageReductions).toEqual([percent]);
  expect(oracle([card(id)],null,100).damageReductions).toEqual([]);
 }
});
it('actual l702 needs a real heart-match group; static roster alone cannot establish its reduction',()=>{
 expect(oracle([card('c702')]).damageReductions).toEqual([]);
 expect(oracle([card('c702')],null,100,hearts).damageReductions).toEqual([20]);
});
it('actual active reduction and surviveOnce are different effects, neither is a currently active leader rule',()=>{
 const stage=gameData.stages.find(s=>s.id==='st-1-1')!;
 for(const [id,expected] of [['c308',{kind:'reduceDamage',percent:50,turns:2}],['c507',{kind:'surviveOnce',turns:2}]] as const){
  const state=startBattle(stage,[{cardId:id,level:1}],null,createRng(123),gameData).getState();expect(state.buffs).toEqual([]);
  applyActiveSkill(state,0,skill(card(id).activeSkill!)!,createRng(456));expect(state.buffs).toContainEqual(expected);
  if(id==='c507')expect(state.buffs.some(b=>b.kind==='reduceDamage')).toBe(false);
 }
});
it('capability classifier agrees with composition oracle but conservatively keeps unknown future helper conditional',()=>{
 const cases=[
  {members:[card('c405'),card('c206')],helper:null,status:'blocked-lineup',reduction:[]},
  {members:[card('c405'),card('c107')],helper:null,status:'unconditional',reduction:[20]},
  {members:[card('c405'),card('c107')],helper:card('c107'),status:'unconditional',reduction:[20]},
  {members:[card('c405'),card('c107')],helper:card('c206'),status:'blocked-lineup',reduction:[]},
 ] as const;
 for(const x of cases){const r=teamCapabilities(x.members,skill,leader,x.helper);expect(r.details.defense.find(d=>d.cardId==='c405'&&d.source==='leader')?.status).toBe(x.status);expect(oracle([...x.members],x.helper).damageReductions).toEqual(x.reduction);}
 const pending=teamCapabilities([card('c405'),card('c107')],skill,leader);expect(pending.details.defense.find(d=>d.source==='leader')?.status).toBe('conditional');
 const ordinary=teamCapabilities([card('c206'),card('c405')],skill,leader,null);expect(ordinary.details.defense.some(d=>d.cardId==='c405'&&d.source==='leader')).toBe(false);
 const helper=teamCapabilities([card('c107')],skill,leader,card('c405'));expect(helper.details.defense.find(d=>d.cardId==='c405'&&d.source==='helper')?.status).toBe('unconditional');
});
it('dynamic rules stay conditional even though actual engine can turn them on; same card active/recovery sources remain distinct',()=>{
 for(const id of ['c507','c702','c706']){
  const report=teamCapabilities([card(id)],skill,leader,null);const defensive=report.details.defense.filter(d=>d.source==='leader');expect(defensive).toHaveLength(1);expect(defensive[0].status).toBe('conditional');expect(defensive[0].skillDescription).toBe(leader(card(id).leaderSkill!)!.description);
 }
 const c507=teamCapabilities([card('c507')],skill,leader,null);expect(c507.details.defense.find(d=>d.source==='active')?.status).toBe('available-method');
 const c702=teamCapabilities([card('c702')],skill,leader,null);expect(c702.details.heal.find(d=>d.source==='active')?.status).toBe('available-method');
 const c706=teamCapabilities([card('c706')],skill,leader,null);expect(c706.details.heal.find(d=>d.source==='leader')?.status).toBe('unconditional');
 const c308=teamCapabilities([card('c308')],skill,leader,null);expect(c308.details.defense.find(d=>d.source==='active')?.status).toBe('available-method');
});
