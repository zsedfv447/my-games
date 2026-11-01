// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import type { Router } from '../src/ui/router';
let router: Router | undefined;
afterEach(() => { router?.stop(); router = undefined; vi.restoreAllMocks(); document.body.replaceChildren(); });
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
async function boot(battle: boolean) {
  vi.resetModules(); localStorage.clear(); history.replaceState(null, '', battle ? '#/battle/tutorial' : '#/team');
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(new Proxy({}, {
    get: (_target, key) => key === 'createLinearGradient' || key === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => {},
  }) as CanvasRenderingContext2D);
  const state = await import('../src/ui/state');
  // Explicit tutorial checkpoint, not a claim of manually finishing earlier tutorial steps.
  const save = structuredClone(state.getSave()); save.tutorial = { step: battle ? 'battle' : 'team', giftGiven: false };
  state.commit(save);
  const { startApp } = await import('../src/ui/app');
  const host = document.createElement('div'); document.body.append(host); router = startApp(host);
  const open = () => {
    host.querySelector<HTMLButtonElement>('.tut-skip')!.click();
    const modal = host.querySelector<HTMLElement>('[aria-label="略過教學"]:not(.closing)')!;
    expect(modal).not.toBeNull();
    return { modal, approve: [...modal.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent === '略過')!, cancel: [...modal.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent === '取消')! };
  };
  return { state, host, open };
}
for (const battle of [false, true]) {
  it(`${battle ? 'battle guide' : 'controller'} answer-then-leave microtask cannot skip or grant the first gift`, async () => {
    const { state, open } = await boot(battle); const before = JSON.stringify(state.getSave());
    open().approve.click(); router!.replace('settings'); await wait(30);
    expect(JSON.stringify(state.getSave())).toBe(before); expect(location.hash).toBe('#/settings');
  });
  it(`${battle ? 'battle guide' : 'controller'} cancel then retry keeps old approval inert and live approval valid`, async () => {
    const { state, open } = await boot(battle); const before = JSON.stringify(state.getSave());
    const old = open(); old.cancel.click(); await wait(0); const fresh = open();
    old.approve.dispatchEvent(new MouseEvent('click', { bubbles: true })); await wait(0);
    expect(JSON.stringify(state.getSave())).toBe(before); expect(fresh.modal.classList.contains('closing')).toBe(false);
    fresh.approve.click();
    await vi.waitFor(() => expect(state.getSave().progress.tutorialDone).toBe(true));
    expect(state.getSave().tutorial?.giftGiven).toBe(true);
  });
}
it('controller invalidates a pending answer even when replacing the same route', async () => {
  const { state, open } = await boot(false); const before = JSON.stringify(state.getSave());
  open().approve.click(); router!.replace('team'); await wait(30);
  expect(JSON.stringify(state.getSave())).toBe(before);
});
