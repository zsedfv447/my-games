import { expect, it } from 'vitest';
import { gameData } from '../src/data/load';
import { createNewSave } from '../src/save/save';
import { eventPeriodKey, eventWindow } from '../src/progression/events';
import { acquireRoutes, materialGuide, KIND_LABEL, type GuideData } from '../src/ui/acquire-guide';
import type { SaveData } from '../src/core/types';

const stage = gameData.stages.find(s => s.id === 'nm-ironwall-3')!;
const event = gameData.events.find(e => e.id === stage.event)!;
const OPEN = Date.parse(event.period!.start) + 3_600_000;
const GAP = Date.parse(event.period!.end) + 3_600_000;
const NEXT = OPEN + event.period!.repeatDays! * 86_400_000;
function fresh(unlocked = true) {
  const save = createNewSave(gameData.config, OPEN);
  if (unlocked) save.progress.clearedStages = [stage.unlockAfter!];
  return save;
}
function claimed(save = fresh()) {
  save.quests.counters[`periodClear:${stage.id}${eventPeriodKey(event, OPEN)}`] = 1;
  return save;
}
function source(save: SaveData, now = OPEN, data: GuideData = gameData) {
  const route = acquireRoutes(save, 'c921', data, now).find(r => r.kind === 'periodFirstClear' && r.stage.id === stage.id);
  expect(route).toBeDefined();
  if (!route) throw new Error('Missing periodic source');
  return route;
}
it('actual twelve stages/eighteen card edges are discoverable; unrelated card absent, no mutation', () => {
  const save = fresh(), before = structuredClone(save);
  const stages = gameData.stages.filter(s => s.rewards.periodFirstClear?.cards?.length);
  const edges = stages.flatMap(s => s.rewards.periodFirstClear!.cards!.map(c => [s.id, c.card]));
  expect(stages).toHaveLength(12); expect(edges).toHaveLength(18);
  for (const [stageId, cardId] of edges) {
    expect(acquireRoutes(save, cardId, gameData, OPEN).filter(r => r.kind === 'periodFirstClear' && r.stage.id === stageId)).toHaveLength(1);
  }
  expect(acquireRoutes(save, 'c101', gameData, OPEN).some(r => r.kind === 'periodFirstClear')).toBe(false);
  expect(KIND_LABEL.periodFirstClear).toBe('本期首通必得（須通關）');
  expect(save).toEqual(before);
});
it('unclaimed requires completion; lifetime clear does not consume current period; claimed remains navigable', () => {
  const save = fresh(); save.progress.clearedStages.push(stage.id);
  expect(source(save)).toMatchObject({ available: true, note: '通關後領取本期首通獎勵', go: ['prepare', [stage.id]] });
  claimed(save);
  expect(source(save)).toMatchObject({ available: false, note: '本期已領取', go: ['prepare', [stage.id]] });
  expect(source(save, NEXT)).toMatchObject({ available: true, note: '通關後領取本期首通獎勵' });
});
it('gap retains prior accounting period and closed reason, locked claimed keeps restriction plus original list route', () => {
  expect(eventWindow(event, GAP).state).toBe('upcoming');
  expect(eventPeriodKey(event, GAP)).toBe(eventPeriodKey(event, OPEN));
  expect(source(claimed(), GAP)).toMatchObject({ available: false, go: ['stages', ['nemesis']] });
  expect(source(claimed(), GAP).note).toContain('活動未開放');
  expect(source(claimed(), GAP).note).toContain('本期已領取');
  const locked = source(claimed(fresh(false)));
  expect(locked).toMatchObject({ available: false, go: ['stages', ['nemesis']] });
  expect(locked.note).toContain('通過前一關後開放'); expect(locked.note).toContain('本期已領取');
  expect(source(fresh(false)).note).not.toContain('本期已領取');
});
it('missing event definition preserves helper lifetime fallback and closed navigation', () => {
  const data = { ...gameData, events: gameData.events.filter(e => e.id !== event.id) };
  const save = fresh();
  expect(source(save, OPEN, data).note).not.toContain('本期已領取');
  save.progress.clearedStages.push(stage.id);
  const route = source(save, OPEN, data);
  expect(route.available).toBe(false); expect(route.note).toContain('本期已領取');
  expect(route.note).toContain('活動未開放'); expect(route.go).toEqual(['stages', ['event']]);
});
it('ordinary and periodic rewards coexist without merging, available-first order stable and old kinds unchanged', () => {
  // Explicit dual-reward model fixture; no real data mutation.
  const both = { ...stage, rewards: { ...stage.rewards, firstClear: { cards: [{ card: 'c921', count: 1 }] } } };
  const data = { ...gameData, stages: [both], shop: [], quests: [], gachaPools: [] };
  const save = fresh();
  expect(acquireRoutes(save, 'c921', data, OPEN).map(r => r.kind)).toEqual(['firstClear', 'periodFirstClear']);
  save.progress.clearedStages.push(stage.id);
  const routes = acquireRoutes(save, 'c921', data, OPEN);
  expect(routes.map(r => r.kind)).toEqual(['periodFirstClear', 'firstClear']);
  expect(routes[1]).toMatchObject({ available: false, note: '已經通關領過了' });
  const withoutPeriod = { ...gameData, stages: gameData.stages.map(s => ({ ...s, rewards: { ...s.rewards, periodFirstClear: undefined } })) };
  expect(acquireRoutes(save, 'c921', gameData, OPEN).filter(r => r.kind !== 'periodFirstClear')).toEqual(acquireRoutes(save, 'c921', withoutPeriod, OPEN));
});
it('material guide includes periodic core sources without changing need/have accounting', () => {
  const needs = [{ id: 'c920', need: 2, have: 0 }, { id: 'c921', need: 1, have: 2 }];
  const guides = materialGuide(fresh(), needs, gameData, OPEN);
  expect(guides.map(g => ({ id: g.card.id, need: g.need, have: g.have }))).toEqual(needs);
  expect(guides.every(g => g.routes.some(r => r.kind === 'periodFirstClear'))).toBe(true);
  expect(guides.flatMap(g => g.routes).every(r => ['drop', 'firstClear', 'periodFirstClear', 'shop'].includes(r.kind))).toBe(true);
});
