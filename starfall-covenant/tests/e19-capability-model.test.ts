import { expect, it } from 'vitest';
import { gameData } from '../src/data/load';
import type { LeaderSkillDef } from '../src/core/types';
import { teamCapabilities } from '../src/ui/team-capabilities';
const card = (id: string) => gameData.cards.find(c => c.id === id)!;
const skill = (id: string) => gameData.skills.find(s => s.id === id);
const leader = (id: string) => gameData.leaderSkills.find(s => s.id === id);
it('known non-dragon blocks c405 leader defense without deleting its potential source', () => {
  const report = teamCapabilities([card('c405'),card('c206')],skill,leader,null);
  expect(report.sources.defense).toContain(card('c405').name);
  expect(report.details.defense.filter(d => d.source === 'leader')).toMatchObject([{status:'blocked-lineup'}]);
  expect(report.details.defense.some(d => d.status === 'unconditional')).toBe(false);
});
it('all-dragon composition waits for unknown helper but explicit dragon/no-helper resolves it', () => {
  const members = [card('c405'),card('c107')];
  const status = (helper?: ReturnType<typeof card>|null) => teamCapabilities(members,skill,leader,helper).details.defense.find(d => d.source === 'leader')!.status;
  expect(status()).toBe('conditional'); expect(status(card('c107'))).toBe('unconditional'); expect(status(null)).toBe('unconditional'); expect(status(card('c206'))).toBe('blocked-lineup');
});
it('null or unknown initial position never promotes ordinary c405; missing data is incomplete', () => {
  for (const first of [null,undefined]) {
    const report = teamCapabilities([first,card('c405')],skill,leader,null);
    expect(report.details.defense.filter(d => d.source === 'leader')).toEqual([]);
    expect(report.incomplete).toBe(first === undefined);
  }
  expect(teamCapabilities([card('c405')],()=>undefined,()=>undefined,null).incomplete).toBe(true);
});
it('each rule keeps AND tri-state and original descriptions; dynamic conditions are never simulated', () => {
  const custom: LeaderSkillDef = {id:'l405',name:'test',description:'真來源原文',rules:[
    {conditions:[{type:'always'}],effects:[{type:'rcvMultiplier',target:{race:'dragon'},value:2}]},
    {conditions:[{type:'teamAll',filter:{race:'dragon'}},{type:'hpBelow',percent:50}],effects:[{type:'damageReduction',percent:20}]},
    {conditions:[{type:'heartsMatched',count:2}],effects:[{type:'damageReduction',percent:10}]},
  ]};
  const report = teamCapabilities([card('c405'),card('c206')],skill,id=>id==='l405'?custom:leader(id),null);
  expect(report.details.defense.filter(d => d.source==='leader').map(d=>d.status)).toEqual(['blocked-lineup','conditional']);
  const heal = report.details.heal.find(d=>d.source==='leader')!;
  expect(heal.status).toBe('unconditional'); expect(heal.skillDescription).toBe(custom.description);
  expect(heal.explanation).toContain('符合目標'); expect(heal.explanation).toContain('不是直接回復');
});
it('active survival is a usable method, not promised damage reduction; known-empty slots do not block composition', () => {
  const s = skill('s110')!;
  const custom = {...card('c405'), activeSkill:s.id};
  const report = teamCapabilities([custom,null],skill,leader,null);
  expect(report.details.defense.find(d=>d.source==='active')).toMatchObject({status:'available-method',skillDescription:s.description});
  expect(report.details.defense.find(d=>d.source==='active')!.explanation).toContain('保命');
  expect(report.details.defense.find(d=>d.source==='leader')!.status).toBe('unconditional');
});
it('unknown member makes matching teamAll conditional, while a known mismatch dominates unknown', () => {
  expect(teamCapabilities([card('c405'),undefined],skill,leader,null).details.defense.find(d=>d.source==='leader')!.status).toBe('conditional');
  expect(teamCapabilities([card('c405'),undefined,card('c206')],skill,leader).details.defense.find(d=>d.source==='leader')!.status).toBe('blocked-lineup');
});
it('teamAll scalar/array filters follow attribute AND race, including helper', () => {
  const custom: LeaderSkillDef = {id:'l405',name:'filter',description:'全隊焰或輝龍',rules:[{
    conditions:[{type:'teamAll',filter:{attribute:['fire','light'],race:['dragon']}}],effects:[{type:'damageReduction',percent:20}],
  }]};
  const lead = (id:string) => id==='l405'?custom:leader(id);
  expect(teamCapabilities([card('c405'),card('c107')],skill,lead,null).details.defense.find(d=>d.source==='leader')!.status).toBe('unconditional');
  expect(teamCapabilities([card('c405'),card('c509')],skill,lead,null).details.defense.find(d=>d.source==='leader')!.status).toBe('blocked-lineup');
  expect(teamCapabilities([card('c405')],skill,lead,card('c206')).details.defense.find(d=>d.source==='leader')!.status).toBe('blocked-lineup');
});
it('future unknown rule conditions stay conditional without inventing battle state', () => {
  // Deliberately future-shaped fixture tests runtime conservatism, not a new engine condition.
  const future = {type:'futureCondition'} as unknown as LeaderSkillDef['rules'][number]['conditions'][number];
  const custom: LeaderSkillDef = {id:'l405',name:'future',description:'未來條件原文',rules:[{conditions:[future],effects:[{type:'damageReduction',percent:10}]}]};
  const report = teamCapabilities([card('c405')],skill,()=>custom,null);
  expect(report.details.defense.find(d=>d.source==='leader')).toMatchObject({status:'conditional',skillDescription:'未來條件原文'});
});
it('nonboosting recovery remains excluded; same-source distinct rules are not collapsed', () => {
  const custom: LeaderSkillDef = {id:'l405',name:'rules',description:'各條件原文',rules:[
    {conditions:[{type:'always'}],effects:[{type:'rcvMultiplier',value:1}]},
    {conditions:[{type:'hpBelow',percent:20}],effects:[{type:'damageReduction',percent:10}]},
    {conditions:[{type:'heartsMatched',count:1}],effects:[{type:'damageReduction',percent:10}]},
  ]};
  const report = teamCapabilities([{...card('c405'),activeSkill:undefined}],skill,()=>custom,null);
  expect(report.sources.heal).toEqual([]); expect(report.details.heal).toEqual([]);
  expect(report.details.defense).toHaveLength(2);
  expect(report.details.defense[0].explanation).not.toBe(report.details.defense[1].explanation);
});
