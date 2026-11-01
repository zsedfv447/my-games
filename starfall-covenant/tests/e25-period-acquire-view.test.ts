// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { gameData } from '../src/data/load';
import { eventPeriodKey } from '../src/progression/events';
import type { Navigator } from '../src/ui/router';
const stage = gameData.stages.find(s => s.id === 'nm-ironwall-3')!;
const event = gameData.events.find(e => e.id === stage.event)!;
const OPEN = Date.parse(event.period!.start) + 3600000;
const CLOSED = Date.parse(event.period!.end) + 3600000;
afterEach(() => { vi.restoreAllMocks(); document.body.replaceChildren(); });
async function fixture(now = OPEN, locked = false, claimed = false) {
  vi.resetModules(); localStorage.clear();
  vi.spyOn(Date, 'now').mockReturnValue(now);
  const state = await import('../src/ui/state');
  const save = structuredClone(state.getSave());
  save.progress.clearedStages = locked ? [] : [stage.unlockAfter!, stage.id];
  if (claimed) save.quests.counters[`periodClear:${stage.id}${eventPeriodKey(event, now)}`] = 1;
  state.commit(save);
  const view = await import('../src/ui/acquire-view');
  const nav: Navigator = { go: vi.fn(), replace: vi.fn(), back: vi.fn(), backTo: vi.fn() };
  const before = JSON.stringify(state.getSave());
  const bytes = JSON.stringify(Object.entries(localStorage));
  const writes = vi.spyOn(Storage.prototype, 'setItem');
  const unchanged = () => {
    expect(JSON.stringify(state.getSave())).toBe(before);
    expect(JSON.stringify(Object.entries(localStorage))).toBe(bytes);
    expect(writes).not.toHaveBeenCalled();
  };
  return { state, view, nav, unchanged };
}
function periodicRow(root: HTMLElement, title = stage.name) {
  const row = [...root.querySelectorAll<HTMLButtonElement>('.acquire-row')].find(r =>
    r.querySelector('.acquire-title')?.textContent === title && r.textContent?.includes('本期首通必得（須通關）'));
  expect(row, `periodic source row for ${title}`).toBeDefined();
  return row!;
}
it('actual periodic card source states completion required and retains the original explicit navigation only', async () => {
  const f = await fixture(); const root = f.view.acquirePanel('c921', f.nav)!;
  const row = periodicRow(root);
  expect(row.querySelector('.acquire-state')?.textContent).toBe('可挑戰取得');
  expect(row.textContent).toContain('通關後領取本期首通獎勵');
  expect(row.classList.contains('unavailable')).toBe(false);
  expect(f.nav.go).not.toHaveBeenCalled(); f.unchanged();
  row.click(); expect(f.nav.go).toHaveBeenCalledTimes(1); expect(f.nav.go).toHaveBeenCalledWith('prepare', [stage.id]); f.unchanged();
});
for (const mode of ['claimed', 'locked-claimed', 'closed-claimed'] as const) it(`${mode} retains claim and restriction notes without disabling source browsing`, async () => {
  const f = await fixture(mode === 'closed-claimed' ? CLOSED : OPEN, mode === 'locked-claimed', true);
  const row = periodicRow(f.view.acquirePanel('c921', f.nav)!);
  expect(row.classList.contains('unavailable')).toBe(true);
  expect(row.querySelector('.acquire-state')?.textContent).toBe('暫時無法');
  expect(row.textContent).toContain('本期已領取');
  if (mode === 'locked-claimed') expect(row.textContent).toContain('通過前一關後開放');
  if (mode === 'closed-claimed') expect(row.textContent).toContain('活動未開放');
  row.click(); expect(f.nav.go).toHaveBeenCalledTimes(1); expect(f.nav.go).toHaveBeenCalledWith(mode === 'claimed' ? 'prepare' : 'stages', mode === 'claimed' ? [stage.id] : ['nemesis']);
  f.unchanged();
});
it('shared missing material block includes guaranteed periodic source; sufficient material suppresses sources', async () => {
  const f = await fixture();
  const missing = f.view.evolutionMaterialPanel([{ id: 'c920', need: 2, have: 0 }], f.nav)!;
  expect(periodicRow(missing).querySelector('.acquire-state')?.textContent).toBe('可挑戰取得');
  expect(missing.textContent).toContain('需要 2・持有 0');
  const enough = f.view.evolutionMaterialPanel([{ id: 'c920', need: 2, have: 2 }], f.nav)!;
  expect(enough.querySelector('.acquire-row')).toBeNull(); expect(enough.textContent).toContain('需要 2・持有 2');
  f.unchanged();
});
it('ordinary first-clear labels and available wording remain unchanged', async () => {
  const f = await fixture(); const save = structuredClone(f.state.getSave());
  save.progress.clearedStages = ['st-1-1', 'st-1-2', 'st-1-3']; f.state.commit(save);
  const root = f.view.acquirePanel('c206', f.nav)!;
  const row = [...root.querySelectorAll('.acquire-row')].find(r => r.querySelector('.acquire-title')?.textContent === gameData.stages.find(s => s.id === 'st-1-4')!.name)!;
  expect(row.textContent).toContain('首通必得');
  expect(row.textContent).not.toContain('本期');
  expect(row.querySelector('.acquire-state')?.textContent).toBe('現在可取得');
});
