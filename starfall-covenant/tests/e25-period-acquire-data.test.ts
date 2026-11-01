import { expect, it } from 'vitest';
import { gameData } from '../src/data/load';
import { createNewSave } from '../src/save/save';
import { eventPeriodKey, eventWindow } from '../src/progression/events';
import { periodFirstClearClaimed } from '../src/progression/stages';
import { acquireRoutes, type GuideData } from '../src/ui/acquire-guide';
import { isPlayable, lockText, stageContext, stageListPath, stageRow } from '../src/ui/stage-nav';
import type { SaveData, StageDef } from '../src/core/types';

const edges = gameData.stages.flatMap(stage => (stage.rewards.periodFirstClear?.cards ?? []).map(reward => ({ stage, card: reward.card })));
const periodic = (save: SaveData, card: string, data: GuideData, now: number) =>
  acquireRoutes(save, card, data, now).filter(r => String(r.kind) === 'periodFirstClear');
function check(save: SaveData, stage: StageDef, card: string, data: GuideData, now: number) {
  const before = structuredClone(save), records = JSON.stringify(data);
  const row = stageRow(save, stage, stageContext(data.stages, data.events, now), now);
  const claimed = periodFirstClearClaimed(save, stage, data.events, now);
  const routes = periodic(save, card, data, now).filter(r => 'stage' in r && r.stage.id === stage.id);
  expect(routes, `${stage.id}/${card}`).toHaveLength(1);
  const route = routes[0];
  expect(route.available).toBe(isPlayable(row.status) && !claimed);
  const list = stageListPath(stage, data.events).split('/');
  expect(route.go).toEqual(isPlayable(row.status) ? ['prepare', [stage.id]] : [list[0], list.slice(1)]);
  if (!isPlayable(row.status)) expect(route.note).toContain(lockText(row, data.stages));
  if (claimed) expect(route.note).toContain('本期已領取');
  else if (isPlayable(row.status)) expect(route.note).toContain('通關');
  expect(save).toEqual(before);
  expect(JSON.stringify(data)).toBe(records);
  return { row, claimed, route };
}

it('actual 12 card-awarding stages yield exactly 18 source edges: six crystals and twelve cores; no unrelated card gets one', () => {
  expect(new Set(edges.map(e => e.stage.id)).size).toBe(12);
  expect(edges).toHaveLength(18);
  expect(edges.filter(e => e.card === 'c921')).toHaveLength(6);
  expect(edges.filter(e => /^c91[6-9]$|^c920$/.test(e.card))).toHaveLength(12);
  const now = Date.parse('2026-11-01T12:00:00+08:00');
  const save = createNewSave(gameData.config, now), before = structuredClone(save);
  const actual = gameData.cards.flatMap(c => periodic(save, c.id, gameData, now).map(r => {
    if (!('stage' in r)) throw new Error('period source must reference actual stage');
    return `${r.stage.id}/${c.id}`;
  })).sort();
  expect(actual).toEqual(edges.map(e => `${e.stage.id}/${e.card}`).sort());
  expect(save).toEqual(before);
});

it.each(['open', 'lifetime-clear', 'current-claimed', 'gap-claimed', 'next-open', 'locked-claimed'] as const)('all actual edges agree with authoritative stage/period helpers: %s', scenario => {
  for (const { stage, card } of edges) {
    const event = gameData.events.find(e => e.id === stage.event)!;
    expect(event.period?.repeatDays).toBeGreaterThan(0);
    const period = event.period!;
    const open = Date.parse(period.start) + 3_600_000;
    const gap = Date.parse(period.end) + 3_600_000;
    const next = open + period.repeatDays! * 86_400_000;
    const now = scenario === 'gap-claimed' ? gap : scenario === 'next-open' ? next : open;
    const save = createNewSave(gameData.config, open);
    if (scenario !== 'locked-claimed') save.progress.clearedStages = [stage.unlockAfter!];
    if (scenario === 'lifetime-clear') save.progress.clearedStages.push(stage.id);
    if (['current-claimed', 'gap-claimed', 'next-open', 'locked-claimed'].includes(scenario)) {
      // Existing exported period helper supplies fixture suffix, not eventWindow.start.
      save.quests.counters[`periodClear:${stage.id}${eventPeriodKey(event, open)}`] = 1;
    }
    const result = check(save, stage, card, gameData, now);
    if (scenario === 'open' || scenario === 'lifetime-clear' || scenario === 'next-open') {
      expect(result.claimed).toBe(false); expect(result.route.available).toBe(true);
    } else {
      expect(result.claimed).toBe(true); expect(result.route.available).toBe(false);
    }
    if (scenario === 'gap-claimed') {
      const window = eventWindow(event, now);
      expect(window.state).toBe('upcoming');
      if (window.state !== 'upcoming') throw new Error('actual event lacks expected gap');
      expect(window.start).toBeGreaterThan(now);
      expect(eventPeriodKey(event, now)).toBe(eventPeriodKey(event, open));
      expect(result.row.status).toBe('eventClosed');
    }
    if (scenario === 'locked-claimed') expect(result.row.status).toBe('locked');
  }
});

it('missing event definitions preserve existing lifetime-clear fallback and stage lock oracle, without query mutation', () => {
  const data: GuideData = { ...gameData, events: [] };
  const now = Date.parse('2026-11-01T12:00:00+08:00');
  for (const { stage, card } of edges) {
    const save = createNewSave(gameData.config, now);
    save.progress.clearedStages = [stage.unlockAfter!];
    expect(check(save, stage, card, data, now).claimed).toBe(false);
    save.progress.clearedStages.push(stage.id);
    expect(check(save, stage, card, data, now).claimed).toBe(true);
  }
});
