import { expect, it } from 'vitest';
import { gameData } from '../src/data/load';
import { createNewSave } from '../src/save/save';
import type { CardDef, LeaderSkillDef } from '../src/core/types';
import { leaderSupportRoster } from '../src/ui/helper-support';
import { chooseHelper, chosenHelper, ensureHelper, offerToHelper, supportToHelper } from '../src/ui/sortie';
import { helperLevel, helperSkillLevel, helperRoster, HELPER_NPCS } from '../src/progression/helpers';
const stage = gameData.stages.find(s => s.id === 'st-1-1')!;
const fresh = () => createNewSave(gameData.config, 1);
const roster = (save = fresh()) => leaderSupportRoster(save, stage, gameData.cards, gameData.leaderSkills, gameData.stages);
it('all91 actual leader cards appear once without ownership/unlock and levels use existing progress curve; no writes', () => {
 const save = fresh(), before = structuredClone(save), list = roster(save);
 expect(list).toHaveLength(91); expect(new Set(list.map(o => o.id)).size).toBe(91);
 const expected = gameData.cards.filter(c => c.race !== 'material' && gameData.leaderSkills.some(l => l.id === c.leaderSkill && l.rules.length && l.description.trim())).map(c => c.id).sort();
 expect(list.map(o => o.card.id).sort()).toEqual(expected);
 for (const o of list) { expect(o.id).toBe(`support:${o.card.id}`); expect(o.level).toBe(helperLevel(o.card, 0)); expect(o.skillLevel).toBe(helperSkillLevel(0)); }
 save.progress.clearedStages = gameData.stages.filter(s => s.kind === 'main').slice(0, 12).map(s => s.id);
 for (const o of roster(save)) { expect(o.level).toBe(helperLevel(o.card, 12)); expect(o.skillLevel).toBe(helperSkillLevel(12)); }
 save.progress.clearedStages = before.progress.clearedStages; expect(save).toEqual(before);
});
it('stage restrictions alone block; fixed/noHelper return no catalog and soft conflicts retain cards', () => {
 expect(leaderSupportRoster(fresh(), {...stage, teamRule:{noHelper:true}}, gameData.cards, gameData.leaderSkills,gameData.stages)).toEqual([]);
 expect(leaderSupportRoster(fresh(), {...stage, fixedTeam:{members:[]}}, gameData.cards,gameData.leaderSkills,gameData.stages)).toEqual([]);
 const offers=leaderSupportRoster(fresh(), {...stage,teamRule:{filter:{attribute:'fire'}}},gameData.cards,gameData.leaderSkills,gameData.stages);
 expect(offers).toHaveLength(91); expect(offers.filter(o=>o.card.attribute!=='fire').every(o=>o.problem==='teamFilter')).toBe(true);
 const blocked=offers.findIndex(o=>o.problem); expect(offers.slice(blocked).every(o=>o.problem)).toBe(true);
});
function synthetic(){
 const base=gameData.cards.find(c=>c.id==='c101')!;
 const cards:CardDef[]=['z-current','a-tags','b-shared','c-same-skill','d-filter','e-rcv'].map(id=>({...structuredClone(base),id,name:id,leaderSkill:`l-${id}`,archetypes:[{id:'mono',role:'core'}]}));
 cards[3].leaderSkill='l-z-current'; cards[4].attribute='water';
 const leaders:LeaderSkillDef[]=[
 {id:'l-z-current',name:'current',description:'低血火人',rules:[{conditions:[{type:'hpBelow',percent:30}],effects:[{type:'atkMultiplier',target:{attribute:['fire'],race:['human']},value:2}]}]},
 {id:'l-a-tags',name:'tags',description:'泛用',rules:[{conditions:[{type:'always'}],effects:[{type:'atkMultiplier',value:2}]}]},
 {id:'l-b-shared',name:'shared',description:'不同門檻',rules:[{conditions:[{type:'hpBelow',percent:70}],effects:[{type:'atkMultiplier',value:2}]}]},
 {id:'l-d-filter',name:'filter',description:'水神限定',rules:[{conditions:[{type:'always'}],effects:[{type:'atkMultiplier',target:{attribute:['water'],race:['god']},value:2}]}]},
 {id:'l-e-rcv',name:'rcv',description:'回復',rules:[{conditions:[{type:'always'}],effects:[{type:'rcvMultiplier',target:{attribute:'fire'},value:2}]}]},
 ];
 const save=fresh(); save.inventory.cards=[{...save.inventory.cards[0],uid:'lead',cardId:'z-current',level:1},{...save.inventory.cards[0],uid:'member',cardId:'b-shared',level:1}]; save.teams[save.activeTeam].members=['lead','member',null,null,null];
 return {save,cards,leaders};
}
it('ranks samecard/sameskill/real shared conditions before unrelated tags, uses attack scalar-array AND not RCV',()=>{
 const {save,cards,leaders}=synthetic(); const offers=leaderSupportRoster(save,stage,cards,leaders,gameData.stages);
 expect(offers.slice(0,3).map(o=>o.card.id)).toEqual(['z-current','c-same-skill','b-shared']);
 expect(offers[0].reasons).toContain('同隊長'); expect(offers[1].reasons).toContain('相同隊長技');
 expect(offers[2].reasons).toContain('具有相同類型的隊長條件（門檻仍以原文為準）');
 expect(offers.find(o=>o.card.id==='a-tags')!.reasons.some(r=>r.includes('相同類型'))).toBe(false);
 expect(offers.find(o=>o.card.id==='d-filter')!.warnings.join('')).toContain('攻擊加成');
 expect(offers.find(o=>o.card.id==='d-filter')!.reasons).toContain('攻擊加成對象涵蓋0/2位目前隊員（條件另判）');
 expect(offers.find(o=>o.card.id==='e-rcv')!.reasons.some(r=>r.includes('攻擊加成對象'))).toBe(false);
});
it('missing slot0 never promotes later leader; missing member definitions caution but null empty slots do not',()=>{
 const {save,cards,leaders}=synthetic(); save.teams[save.activeTeam].members[0]=null;
 const list=leaderSupportRoster(save,stage,cards,leaders,gameData.stages);
 expect(list.map(o=>o.card.id)).toEqual(cards.map(c=>c.id).sort()); expect(list.flatMap(o=>o.reasons).some(r=>r.includes('同隊長')||r.includes('相同類型'))).toBe(false);
 save.teams[save.activeTeam].members[0]='missing';
 expect(leaderSupportRoster(save,stage,cards,leaders,gameData.stages).some(o=>o.warnings.some(w=>w.includes('資料不完整')))).toBe(true);
});
it('teamAll checks actual current members plus helper and warns partial rule failure, not entire skill unusable',()=>{
 const save=fresh(); save.inventory.cards=[{...save.inventory.cards[0],uid:'d',cardId:'c405',level:1}]; save.teams[save.activeTeam].members=['d',null,null,null,null];
 const dragon=roster(save).find(o=>o.card.id==='c405')!; expect(dragon.warnings.some(w=>w.includes('全隊條件'))).toBe(false);
 const beast=roster(save).find(o=>o.card.id==='c710')!; expect(beast.problem).toBeNull(); expect(beast.warnings.join('')).toContain('部分全隊條件未滿足');
 save.inventory.cards.push({...save.inventory.cards[0],uid:'h',cardId:'c101',level:1}); save.teams[save.activeTeam].members[1]='h';
 expect(roster(save).find(o=>o.card.id==='c405')!.warnings.join('')).toContain('部分全隊條件未滿足');
});
it('explicit permanent support survives ensureHelper refresh; default NPC and deliberate null remain original behavior',()=>{
 const save=fresh(), npcs=helperRoster(save,stage,HELPER_NPCS,gameData.stages,id=>gameData.cards.find(c=>c.id===id),1);
 const actualOffer=roster(save).find(o=>o.card.id==='c710')!; expect(supportToHelper(actualOffer)).toEqual({npcId:actualOffer.id,card:actualOffer.card,input:{cardId:'c710',level:actualOffer.level,skillLevel:actualOffer.skillLevel}});
 const card=gameData.cards.find(c=>c.id==='c710')!; const support={npcId:'support:c710',card,input:{cardId:card.id,level:50,skillLevel:3}};
 chooseHelper('support-keep',support);
 // New optional third argument is tested before implementation without weakening original first2 semantics.
 ensureHelper('support-keep',npcs,[{...support,input:{...support.input,level:55}}]);
 expect(chosenHelper('support-keep')?.input.level).toBe(55);
 ensureHelper('support-fresh',npcs); expect(chosenHelper('support-fresh')).toEqual(offerToHelper(npcs.find(n=>!n.problem)!));
 chooseHelper('support-null',null); ensureHelper('support-null',npcs); expect(chosenHelper('support-null')).toBeNull();
 ensureHelper('support-keep',npcs,[]); expect(chosenHelper('support-keep')).toEqual(offerToHelper(npcs.find(n=>!n.problem)!));
});
