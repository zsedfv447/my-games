// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import type { Router } from '../src/ui/router';
import type { Battle } from '../src/battle/battle-state';
let router: Router | undefined;
afterEach(() => { router?.stop(); router = undefined; vi.restoreAllMocks(); document.body.replaceChildren(); });
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
const button = (root: ParentNode, text: string) => { const b = [...root.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent === text); expect(b, text).toBeDefined(); return b!; };
const resources = (save: { settings: unknown }) => { const { settings: _settings, ...rest } = save; return JSON.stringify(rest); };
const bytes = () => JSON.stringify(Array.from({ length: localStorage.length }, (_, i) => { const k = localStorage.key(i)!; return [k, localStorage.getItem(k)]; }).sort());
async function boot() {
  vi.resetModules(); localStorage.clear(); sessionStorage.clear(); history.replaceState(null, '', '#/battle/practice/normal');
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(new Proxy({}, { get: (_t, k) => k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => {} }) as CanvasRenderingContext2D);
  const state = await import('../src/ui/state'); const s = structuredClone(state.getSave()); s.tutorial = { step: 'done', giftGiven: true }; s.progress.tutorialDone = true; s.hintsSeen = ['hiddenOrbs', 'starSeal', 'ringShield']; state.commit(s);
  state.updateSettings({ battleSpeed: 1, battleFx: false, bgm: 0.8 });
  const engine = await import('../src/battle/battle-state'); const start = vi.spyOn(engine, 'startBattle');
  // Drawing-only stub: happy-dom synchronously invokes data-image onload while BoardView draws, causing recursion.
  const { BoardView } = await import('../src/battle/view/board-view');
  vi.spyOn(BoardView.prototype as unknown as { draw(): void }, 'draw').mockImplementation(() => {});
  const { startApp } = await import('../src/ui/app'); const host = document.createElement('div'); document.body.append(host); router = startApp(host);
  const battle = () => start.mock.results.at(-1)!.value as Battle;
  const board = () => host.querySelector<HTMLElement>('.board-view')!;
  const open = () => { host.querySelector<HTMLButtonElement>('[aria-label="暫停"]')!.click(); const d = host.querySelector<HTMLElement>('[role="dialog"][aria-label="暫停"]:not(.closing)'); expect(d).not.toBeNull(); return d!; };
  expect(state.getSave().activeBattle).toBeNull();
  return { host, state, battle, board, open, start };
}
it('normal resume restores enabled board without changing real engine/save/preferences', async () => {
  const f = await boot(); expect(f.board().classList.contains('disabled')).toBe(false); const engine = JSON.stringify(f.battle().getState()), save = resources(f.state.getSave()), prefs = bytes();
  const d = f.open(); expect(f.board().classList.contains('disabled')).toBe(true); button(d, '繼續').click(); expect(f.board().classList.contains('disabled')).toBe(false);
  expect(JSON.stringify(f.battle().getState())).toBe(engine); expect(resources(f.state.getSave())).toBe(save); expect(bytes()).toBe(prefs);
});
it('normal mode switch uses real new practice engine and no ticket/resource debit', async () => {
  const f = await boot(), save = resources(f.state.getSave()), old = f.battle(); button(f.open(), '隱藏珠').click();
  await vi.waitFor(() => expect(f.start).toHaveBeenCalledTimes(2)); expect(location.hash).toBe('#/battle/practice/darkOrbs'); expect(f.battle()).not.toBe(old); expect(resources(f.state.getSave())).toBe(save);
});
it('normal speed and volume persist while engine state and game resources remain unchanged', async () => {
  const f = await boot(), engine = JSON.stringify(f.battle().getState()), save = resources(f.state.getSave()), before = bytes(); const d = f.open();
  d.querySelector<HTMLInputElement>('[aria-label="戰鬥加速 ×2"]')!.click(); const volume = d.querySelector<HTMLInputElement>('[aria-label="背景音樂"]')!; volume.value = '0.3'; volume.dispatchEvent(new Event('input', { bubbles: true }));
  expect(f.state.getSettings().battleSpeed).toBe(2); expect(f.state.getSettings().bgm).toBe(0.3); expect(bytes()).not.toBe(before); expect(JSON.stringify(f.battle().getState())).toBe(engine); expect(resources(f.state.getSave())).toBe(save);
  button(d, '繼續').click(); const fresh = f.open(); expect(fresh.querySelector<HTMLInputElement>('[aria-label="戰鬥加速 ×2"]')!.checked).toBe(true); expect(fresh.querySelector<HTMLInputElement>('[aria-label="背景音樂"]')!.value).toBe('0.3');
});
for (const ending of ['close', 'leave', 'replacement'] as const) {
  it(`stale mode after ${ending} cannot redirect current route or replace engine`, async () => {
    const f = await boot(); const old = f.open(), mode = button(old, '隱藏珠');
    if (ending === 'leave') { router!.replace('settings'); await wait(200); }
    else { button(old, '繼續').click(); await wait(50); expect(mode.isConnected).toBe(true); if (ending === 'replacement') { // The legal transition still has a queued hashchange after its first render.
      // Observe the legal transition's event before capturing the new engine baseline.
      const changed = new Promise<void>(resolve => window.addEventListener('hashchange', () => resolve(), { once: true }));
      button(f.open(), '星紋封印').click();
      await changed; await wait(0); } }
    const hash = location.hash, engine = f.battle(), save = resources(f.state.getSave()), disk = bytes(); console.info('pause stale mode', ending, { connected: mode.isConnected }); mode.click(); await wait(20);
    expect(resources(f.state.getSave())).toBe(save); expect(bytes()).toBe(disk); expect(location.hash).toBe(hash); expect(f.battle()).toBe(engine);
  });
  it(`stale setting after ${ending} cannot change prefs; engine/save independently unchanged`, async () => {
    const f = await boot(); const old = f.open(), speed = old.querySelector<HTMLInputElement>('[aria-label="戰鬥加速 ×2"]')!;
    if (ending === 'leave') { router!.replace('settings'); await wait(200); }
    else { button(old, '繼續').click(); await wait(50); expect(speed.isConnected).toBe(true); if (ending === 'replacement') { const fresh = f.open(); const setting = fresh.querySelector<HTMLInputElement>('[aria-label="戰鬥加速 ×2"]')!; setting.click(); setting.click(); } }
    const save = resources(f.state.getSave()), engine = JSON.stringify(f.battle().getState()), settings = JSON.stringify(f.state.getSettings()), disk = bytes(), hash = location.hash;
    console.info('pause stale setting', ending, { connected: speed.isConnected }); speed.click(); expect(resources(f.state.getSave())).toBe(save); expect(JSON.stringify(f.battle().getState())).toBe(engine); expect(location.hash).toBe(hash); expect(JSON.stringify(f.state.getSettings())).toBe(settings); expect(bytes()).toBe(disk);
  });
}
it('old resume cannot enable board beneath newer pause', async () => {
  const f = await boot(); const old = f.open(), resume = button(old, '繼續'); resume.click(); await wait(50); const fresh = f.open(); const before = JSON.stringify(f.battle().getState()), save = resources(f.state.getSave());
  expect(f.board().classList.contains('disabled')).toBe(true); resume.click(); expect(fresh.classList.contains('closing')).toBe(false); expect(JSON.stringify(f.battle().getState())).toBe(before); expect(resources(f.state.getSave())).toBe(save); expect(f.board().classList.contains('disabled')).toBe(true);
});
