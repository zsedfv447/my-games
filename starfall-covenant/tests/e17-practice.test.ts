// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import type { Router } from '../src/ui/router';
let router: Router | undefined;
afterEach(() => { router?.stop(); router = undefined; vi.restoreAllMocks(); document.body.replaceChildren(); });
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
async function boot() {
  vi.resetModules(); localStorage.clear(); history.replaceState(null, '', '#/adventure');
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(new Proxy({}, {
    get: (_target, key) => key === 'createLinearGradient' || key === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => {},
  }) as CanvasRenderingContext2D);
  const state = await import('../src/ui/state');
  const save = structuredClone(state.getSave());
  save.tutorial = { step: 'done', giftGiven: true }; save.progress.tutorialDone = true; state.commit(save);
  const { startApp } = await import('../src/ui/app');
  const host = document.createElement('div'); document.body.append(host); router = startApp(host);
  const open = () => {
    [...host.querySelectorAll<HTMLButtonElement>('.adv-tile')].find(tile => tile.querySelector('strong')?.textContent === '練習場')!.click();
    const dialog = [...host.querySelectorAll<HTMLElement>('[aria-label="練習場"]:not(.closing)')].at(-1)!;
    const mode = (name: string) => [...dialog.querySelectorAll<HTMLButtonElement>('.list-item')].find(row => row.querySelector('.name')?.textContent === name)!;
    return { dialog, mode, cancel: [...dialog.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === '取消')! };
  };
  return { state, host, open };
}
it('opening a replacement picker revokes the unclosed old picker and old cancel cannot close the new one', async () => {
  const { state, open } = await boot(); const old = open(); const fresh = open(); const before = JSON.stringify(state.getSave());
  old.cancel.click(); old.mode('一般').dispatchEvent(new MouseEvent('click', { bubbles: true })); await wait(20);
  expect(fresh.dialog.classList.contains('closing')).toBe(false); expect(location.hash).toBe('#/adventure');
  expect(JSON.stringify(state.getSave())).toBe(before);
  fresh.mode('隱藏珠').click(); await vi.waitFor(() => expect(location.hash).toBe('#/battle/practice/darkOrbs'));
  expect(JSON.stringify(state.getSave())).toBe(before);
});
it('actual dismissible backdrop closes consent; retry can enter normal practice and Back returns to adventure', async () => {
  const { state, host, open } = await boot(); const old = open(); const before = JSON.stringify(state.getSave());
  old.dialog.click(); await wait(50); expect(old.mode('一般').isConnected).toBe(true); old.mode('一般').click(); await wait(20);
  expect(location.hash).toBe('#/adventure'); expect(JSON.stringify(state.getSave())).toBe(before);
  open().mode('一般').click(); await vi.waitFor(() => expect(host.querySelector('[data-screen="battle"]')).not.toBeNull());
  expect(location.hash).toBe('#/battle/practice/normal'); expect(JSON.stringify(state.getSave())).toBe(before);
  router!.back(); await vi.waitFor(() => expect(location.hash).toBe('#/adventure'));
  expect(JSON.stringify(state.getSave())).toBe(before);
});
