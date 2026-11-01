// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import fixture from './fixtures/promotion/legacy-v4.json';
import { gameData } from '../src/data/load';
import { CURRENT_SAVE_VERSION, SAVE_KEY, exportSaveCode, importSaveCode, parseSave, serializeSave } from '../src/save/save';
const expected = JSON.parse(fixture.raw).data;
const prefix = 'starfall.experiment.e00-e01.';
const sentinelKeys = ['starfall.save', 'starfall.ui-prefs', 'starfall-covenant.orb-assistant.request.v1', '__starfall_probe__', 'debug.abyssWeak'].map(k => prefix + k);
beforeEach(() => {
  vi.resetModules(); vi.useFakeTimers(); vi.setSystemTime(fixture.now);
  localStorage.clear(); sessionStorage.clear();
  for (const key of sentinelKeys) { localStorage.setItem(key, `local:${key}`); sessionStorage.setItem(key, `session:${key}`); }
});
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });
function untouched() {
  for (const key of sentinelKeys) {
    expect(localStorage.getItem(key)).toBe(`local:${key}`);
    expect(sessionStorage.getItem(key)).toBe(`session:${key}`);
  }
}
it('baseline-generated raw/base64 backup preserves complete v4 progress and exact export format', () => {
  expect(SAVE_KEY).toBe('starfall.save'); expect(CURRENT_SAVE_VERSION).toBe(4);
  const raw = parseSave(fixture.raw, gameData.config, fixture.now);
  const code = importSaveCode(` \n${fixture.code}\n `, gameData.config, fixture.now);
  expect(raw).toEqual({ ok: true, save: expected }); expect(code).toEqual(raw);
  if (!raw.ok) throw new Error('old production fixture rejected');
  expect(serializeSave(raw.save)).toBe(fixture.raw);
  expect(exportSaveCode(raw.save)).toBe(fixture.code); // baseline output, not candidate-generated oracle
  expect(importSaveCode('STARFALL-EXPERIMENT:E00-E01:' + fixture.code, gameData.config, fixture.now).ok).toBe(false);
  untouched();
});
it('real production state reopens already-paid old ticket with full snapshot/RNG and no second stamina payment', async () => {
  localStorage.setItem(SAVE_KEY, fixture.raw);
  localStorage.setItem('starfall.ui-prefs', JSON.stringify({ showMoveTimer: false, lowFx: true }));
  localStorage.setItem('starfall-covenant.orb-assistant.request.v1', JSON.stringify({ goal: 'greek' }));
  const state = await import('../src/ui/state');
  expect(state.getSave()).toEqual(expected);
  expect(state.getSettings()).toMatchObject({ showMoveTimer: false, lowFx: true });
  const prefs = await import('../src/battle/assistant/preferences');
  expect(prefs.loadAssistantRequest()).toEqual({ goal: 'greek' });
  const before = structuredClone(state.getSave()), stored = localStorage.getItem(SAVE_KEY);
  const writes = vi.spyOn(localStorage, 'setItem');
  const { openStageBattle } = await import('../src/ui/battle-session');
  const stage = gameData.stages.find(s => s.id === expected.activeBattle.stageId)!;
  for (let i = 0; i < 2; i++) {
    const opened = openStageBattle(stage);
    expect(typeof opened).not.toBe('string');
    if (typeof opened === 'string') throw new Error(opened);
    expect(opened.resumed).toBe(true);
    expect(opened.battle.snapshot()).toEqual(expected.activeBattle.snapshot);
    expect(opened.drops).toEqual(expected.activeBattle.drops);
  }
  expect(state.getSave()).toEqual(before);
  expect(state.getSave().stamina.current).toBe(fixture.initialStamina - fixture.stageStamina);
  expect(localStorage.getItem(SAVE_KEY)).toBe(stored); expect(writes).not.toHaveBeenCalled();
  untouched();
});
it('corrupt formal raw is not overwritten until a valid old backup recovers it; reload retains recovery and isolated sentinels', async () => {
  const corrupted = JSON.parse(fixture.raw); corrupted.checksum = 'not-a-checksum';
  const raw = JSON.stringify(corrupted); localStorage.setItem(SAVE_KEY, raw);
  let state = await import('../src/ui/state');
  expect(state.getLoadProblem()).toBe('checksum');
  state.updateSettings({ bgm: .6 });
  expect(localStorage.getItem(SAVE_KEY)).toBe(raw);
  for (const invalid of ['not-base64', 'STARFALL-EXPERIMENT:E00-E01:' + fixture.code]) {
    expect(state.importCode(invalid)).not.toBeNull();
    expect(state.getLoadProblem()).toBe('checksum'); expect(localStorage.getItem(SAVE_KEY)).toBe(raw);
  }
  expect(state.importCode(fixture.code)).toBeNull();
  expect(state.getLoadProblem()).toBeNull(); expect(state.getSave()).toEqual(expected);
  expect(state.exportCode()).toBe(fixture.code); untouched();
  const restored = localStorage.getItem(SAVE_KEY);
  vi.resetModules(); state = await import('../src/ui/state');
  expect(state.getLoadProblem()).toBeNull(); expect(state.getSave()).toEqual(expected);
  expect(localStorage.getItem(SAVE_KEY)).toBe(restored); untouched();
});
