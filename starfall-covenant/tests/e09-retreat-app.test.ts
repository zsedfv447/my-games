// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import type { Router } from '../src/ui/router';
let router: Router | undefined;
afterEach(() => { router?.stop(); vi.restoreAllMocks(); vi.unstubAllGlobals(); document.body.replaceChildren(); });
async function boot(practice = false) {
  vi.resetModules(); localStorage.clear(); sessionStorage.clear();
  history.replaceState(null, '', practice ? '#/settings' : '#/battle/st-1-1');
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(new Proxy({}, { get: (_t, key) => key === 'createLinearGradient' || key === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => {} }) as CanvasRenderingContext2D);
  const backing = localStorage, writes: string[] = [];
  vi.stubGlobal('localStorage', { getItem: (k: string) => backing.getItem(k), setItem: (k: string, v: string) => { writes.push(k); backing.setItem(k, v); }, removeItem: (k: string) => { writes.push(k); backing.removeItem(k); } });
  const state = await import('../src/ui/state');
  const { gameData } = await import('../src/data/load');
  const engine = await import('../src/battle/battle-state');
  const { createRng } = await import('../src/core/rng');
  const active = await import('../src/progression/active-battle');
  const initial = structuredClone(state.getSave()); initial.tutorial = { step: 'done', giftGiven: true }; initial.progress.tutorialDone = true; state.commit(initial);
  const stage = gameData.stages.find(s => s.id === 'st-1-1')!;
  const c = initial.inventory.cards[0], members = [{ cardId: c.cardId, level: c.level, uid: c.uid }];
  const newTicket = (seed: number) => {
    const actual = engine.startBattle(stage, members, null, createRng(seed), gameData);
    const ticket = active.beginActiveBattle(state.getSave(), { stageId: stage.id, seed, members, helper: null, drops: { stageId: stage.id, drops: [] } }, Date.now());
    state.commit(active.recordBattleSnapshot(ticket, actual.snapshot()));
  };
  if (!practice) newTicket(123);
  const resume = vi.spyOn(engine, 'resumeBattle');
  const { bus } = await import('../src/core/events'); const failures = vi.fn(); bus.on('stageFailed', failures);
  const { startApp } = await import('../src/ui/app'); const host = document.createElement('div'); document.body.append(host); router = startApp(host);
  if (practice) { router.go('battle', ['practice', 'drill-convert']); await vi.waitFor(() => expect(host.querySelector('[data-screen="battle"]')).not.toBeNull()); }
  writes.length = 0;
  return { state, host, failures, writes, newTicket, latest: () => resume.mock.results.at(-1)!.value as ReturnType<typeof engine.resumeBattle> };
}
function named(root: ParentNode, text: string) {
  const found = [...root.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent === text); expect(found, text).toBeDefined(); return found!;
}
function retreat(host: HTMLElement) {
  host.querySelector<HTMLButtonElement>('[aria-label="暫停"]')!.click();
  named(host.querySelector('[role="dialog"][aria-label="暫停"]')!, '撤退').click();
  const dialog = host.querySelector('[role="dialog"][aria-label="撤退"]'); expect(dialog).not.toBeNull();
  return { confirm: named(dialog!, '確定'), cancel: named(dialog!, '取消') };
}
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

it('route departure cancels unanswered retreat; detached old confirm cannot clear a later same-stage ticket', async () => {
  const { state, host, failures, writes, newTicket } = await boot();
  const before = JSON.stringify(state.getSave()), { confirm } = retreat(host);
  router!.go('settings'); await vi.waitFor(() => expect(host.querySelector('[data-screen="settings"]')).not.toBeNull()); await wait(200);
  expect(JSON.stringify(state.getSave())).toBe(before); expect(writes).toEqual([]); expect(failures).not.toHaveBeenCalled();
  expect(confirm.isConnected).toBe(false);
  newTicket(999); writes.length = 0; const newer = JSON.stringify(state.getSave());
  confirm.click(); await wait(30);
  expect(JSON.stringify(state.getSave())).toBe(newer); expect(writes).toEqual([]); expect(failures).not.toHaveBeenCalled(); expect(location.hash).toBe('#/settings');
}, 20000);

it('same-stage replacement while confirmation remains open cannot be forfeited by the old session', async () => {
  const { state, host, failures, writes, newTicket, latest } = await boot();
  const old = latest(), oldSnapshot = old.snapshot(), { confirm } = retreat(host);
  newTicket(999); writes.length = 0; const newer = JSON.stringify(state.getSave());
  confirm.click(); await wait(30);
  expect(JSON.stringify(state.getSave())).toBe(newer); expect(writes).toEqual([]); expect(failures).not.toHaveBeenCalled();
  expect(old.snapshot()).toEqual(oldSnapshot);
}, 20000);

it('normal cancel restores enabled board and skill access without saving or recording defeat', async () => {
  const { state, host, failures, writes, latest } = await boot();
  const before = JSON.stringify(state.getSave()), snapshot = latest().snapshot();
  expect(host.querySelector('.board-view')?.classList.contains('disabled')).toBe(false);
  retreat(host).cancel.click(); await wait(180);
  expect(host.querySelector('.board-view')?.classList.contains('disabled')).toBe(false);
  host.querySelector<HTMLButtonElement>('.team-row .card-thumb')!.click();
  expect([...host.querySelectorAll('[role="dialog"]')].some(d => d.textContent?.includes('主動') || d.textContent?.includes('學徒的火花'))).toBe(true);
  expect(latest().snapshot()).toEqual(snapshot); expect(JSON.stringify(state.getSave())).toBe(before); expect(writes).toEqual([]); expect(failures).not.toHaveBeenCalled();
}, 20000);

it('normal retreat clears its own ticket and emits one failure; repeated stale confirmation cannot settle twice', async () => {
  const { state, host, failures, writes, latest } = await boot();
  const stamina = structuredClone(state.getSave().stamina), { confirm } = retreat(host);
  confirm.click(); confirm.click(); await wait(180);
  expect(latest().getState().phase).toBe('lost'); expect(state.getSave().activeBattle).toBeNull(); expect(failures).toHaveBeenCalledTimes(1);
  expect(state.getSave().quests.counters.stageFail).toBe(1); expect(state.getSave().stamina).toEqual(stamina);
  const settled = JSON.stringify(state.getSave()), count = writes.length;
  confirm.dispatchEvent(new MouseEvent('click', { bubbles: true })); await wait(20);
  expect(JSON.stringify(state.getSave())).toBe(settled); expect(writes).toHaveLength(count); expect(failures).toHaveBeenCalledTimes(1);
  expect(host.querySelectorAll('[role="dialog"][aria-label="挑戰失敗"]')).toHaveLength(1);
}, 20000);

it('practice retreat returns through actual Router history with no stamina/save or formal failure event', async () => {
  const { state, host, failures, writes } = await boot(true);
  const before = JSON.stringify(state.getSave()); retreat(host).confirm.click();
  await vi.waitFor(() => expect(host.querySelector('[data-screen="settings"]')).not.toBeNull());
  expect(location.hash).toBe('#/settings'); expect(JSON.stringify(state.getSave())).toBe(before); expect(writes).toEqual([]); expect(failures).not.toHaveBeenCalled();
}, 20000);
