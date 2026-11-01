import { expect, it } from 'vitest';
import { gameData } from '../src/data/load';
import { applyHits, type Hit, type EnemyTarget } from '../src/battle/damage';
import { startBattle, resumeBattle } from '../src/battle/battle-state';
import { createRng } from '../src/core/rng';
const definition = gameData.enemies.find(e => e.id === 'e0008')!;
const enemy: EnemyTarget = { attribute: definition.attribute, hp: definition.hp, maxHp: definition.hp, def: definition.def, damageAbsorb: definition.abilities![0].value };
const context = { combo: 1, config: gameData.config.battle };
// Synthetic neutral hits isolate actual absorption arithmetic; amounts include real DEF200.
const ordinary = (raw: number, extra: Partial<Hit> = {}): Hit => ({ member: 0, target: 'single', amount: raw + 200, ...extra });
const fixed = (amount: number, extra: Partial<Hit> = {}): Hit => ({ member: 0, target: 'single', amount, fixed: true, ...extra });
function boilerBattle() {
 const original = gameData.stages.find(s => s.id === 'st-2-6')!;
 const stage = { ...structuredClone(original), waves: [structuredClone(original.waves[1])] };
 const snapshot = startBattle(stage, [{ cardId: 'c307', level: 50 }], null, createRng(13526), gameData).snapshot();
 snapshot.state.team[0].skillCooldown = 0; snapshot.state.target = 1;
 return resumeBattle(stage, snapshot, gameData);
}
it.each([[15000,15000,0],[25000,15000,0],[30000,10000,5000],[40000,0,15000]])('actual boiler raw %i causes net %i leaving %i', (raw, damage, hp) => {
 expect(definition).toMatchObject({ hp:15000,def:200,abilities:[{status:'damageAbsorb',value:20000,turns:0}] });
 const r = applyHits([ordinary(raw)], [enemy], 0, context);
 expect(r.results.map(x=>x.damage)).toEqual([damage]); expect(r.hp).toEqual([hp]); expect(r.taken).toEqual([raw]);
});
it('cumulative per-enemy hits can heal a living target, including across separate engine damage calls', () => {
 const first = applyHits([ordinary(10000)], [enemy], 0, context);
 const next = applyHits([ordinary(30000)], [{...enemy,hp:first.hp[0],takenThisTurn:first.taken[0]}], 0, context);
 expect(first.hp).toEqual([5000]);expect(next.results[0].damage).toBe(-10000);expect(next.hp).toEqual([15000]);expect(next.taken).toEqual([40000]);
 expect(applyHits([ordinary(50000)], [{...enemy,hp:5000}], 0, context).results[0].damage).toBe(-10000);
});
it('already killed boiler is never revived by later single or all hits', () => {
 for (const target of ['single','all'] as const) {
  const r=applyHits([ordinary(10000),ordinary(10000),ordinary(100000,{target})],[enemy],0,context);
  expect(r.hp).toEqual([0]);expect(r.results.map(x=>x.damage)).toEqual([10000,5000]);expect(r.taken).toEqual([20000]);
 }
});
it('fixed/percent and explicit ignoreShield bypass absorption; ignoreDefense alone does not', () => {
 for(const hit of [fixed(15000),fixed(0,{percentMaxHp:100}),ordinary(15000,{ignoreShield:true})]) {
  const r=applyHits([hit],[{...enemy,takenThisTurn:20000}],0,context);
  expect(r.hp).toEqual([0]);expect(r.taken).toEqual([20000]);
 }
 const r=applyHits([ordinary(50000,{amount:50000,ignoreDefense:true})],[{...enemy,hp:5000}],0,context);
 expect(r.hp).toEqual([15000]);expect(r.results[0].damage).toBe(-10000);
});
it('fixed damage still respects ordinary and ring shields unless explicitly bypassed', () => {
 for(const extra of [{shieldPercent:50},{ringReduction:50}])expect(applyHits([fixed(15000)],[{...enemy,...extra}],0,context).results[0].damage).toBe(7500);
 expect(applyHits([fixed(15000)],[{...enemy,shieldPercent:100}],0,context).results[0].damage).toBe(0);
 expect(applyHits([fixed(15000,{ignoreShield:true})],[{...enemy,shieldPercent:100}],0,context).hp).toEqual([0]);
});
it('actual c307 ready skill kills real second-wave boiler without harming adjacent sentinel', () => {
 const dataBefore=JSON.stringify(gameData),battle=boilerBattle();
 expect(battle.getState().enemies[1].statuses).toContainEqual({id:'damageAbsorb',value:20000,turns:null});
 const r=battle.useSkill(0);expect(r.ok).toBe(true);if(!r.ok)throw Error('skill rejected');
 expect(r.skill.hits.map(h=>[h.enemy,h.damage,h.hit.fixed])).toEqual([[1,15000,true]]);
 expect(battle.getState().enemies.map(e=>e.hp)).toEqual([10000,0]);expect(JSON.stringify(gameData)).toBe(dataBefore);
});

// Model comparisons start only after A supplied the real API; no missing-export RED claimed.
import { enemyGuide } from '../src/ui/enemy-info';
const skills = Object.fromEntries(gameData.skills.map(skill=>[skill.id,skill]));
const guideText = (state: ReturnType<ReturnType<typeof boilerBattle>['getState']>) => enemyGuide(state,1,skills).sections.flatMap(s=>[s.title,...s.lines]).join('\n');
it('guide describes the actual persistent absorber and proven c307 method without changing battle/RNG', () => {
 const battle=boilerBattle(),before=battle.snapshot(),state=battle.getState(),copy=structuredClone(state),text=guideText(state);
 expect(text).toContain('20,000');expect(text).toContain('本回合累積');expect(text).toContain('永久');expect(text).toContain('不是復活');
 expect(text).toContain('只有無視防禦並不能避開吸收');expect(text).toContain('固定傷害仍可能受一般護盾');
 expect(text).toContain(skills.s307.description);expect(text).toContain('CD 0');expect(text).toContain('不保證');
 expect(state).toEqual(copy);expect(battle.snapshot()).toEqual(before);expect(enemyGuide(state,99,skills)).toEqual({sections:[]});
});
it('guide reports real cooldown and team/member seals while engine refuses that actual skill', () => {
 for(const variant of ['cooldown','teamSeal','memberSeal'] as const){
  const source=boilerBattle(),snap=source.snapshot();
  if(variant==='cooldown')snap.state.team[0].skillCooldown=3;
  else snap.state.teamStatuses=[variant==='teamSeal'?{id:'skillSeal',turns:2}:{id:'attributeSeal',turns:2,params:{attribute:'wood'}}];
  const original=gameData.stages.find(s=>s.id==='st-2-6')!;
  const battle=resumeBattle({...structuredClone(original),waves:[structuredClone(original.waves[1])]},snap,gameData);
  const before=battle.snapshot(),text=guideText(battle.getState());
  expect(text).toContain(variant==='cooldown'?'CD 3':variant==='teamSeal'?'技能封印中':'星紋封印中');
  expect(battle.useSkill(0).ok).toBe(false);expect(battle.snapshot()).toEqual(before);
 }
});
it('live multiple defenses remain separate; removed/expired absorption never offers an obsolete skill remedy', () => {
 const state=boilerBattle().getState();state.enemies[1].statuses.push({id:'shield',turns:2,value:50},{id:'comboShield',turns:1,value:5});
 const before=structuredClone(state),text=guideText(state);
 expect(text).toContain('50%');expect(text).toContain('5 Combo');expect(text).toContain('剩餘 2 回合');expect(text).toContain('20,000');expect(state).toEqual(before);
 for(const statuses of [[],[{id:'damageAbsorb' as const,turns:0,value:20000}]]){
  const copy=structuredClone(state);copy.enemies[1].statuses=statuses;
  expect(copy.enemies[1].triggered).toContain(0);
  expect(enemyGuide(copy,1,skills).sections.some(s=>s.title==='可參考的隊伍技能（只針對吸收）')).toBe(false);
  expect(guideText(copy)).not.toContain('門檻：20,000');
 }
 const unknown=structuredClone(state);unknown.enemies[1].statuses=[{id:'damageAbsorb',turns:null}];
 expect(guideText(unknown)).toContain('門檻：未知');
});
