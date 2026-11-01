// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import type { Router } from '../src/ui/router';
let router: Router | undefined;
afterEach(() => { router?.stop(); router = undefined; vi.restoreAllMocks(); document.body.replaceChildren(); });
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
function button(label: string, root: ParentNode = document): HTMLButtonElement {
  const found = [...root.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent === label);
  if (!found) throw new Error(`Missing ${label}`);
  return found;
}
async function bootBroken() {
  vi.resetModules(); localStorage.clear(); history.replaceState(null, '', '#/settings');
  let state = await import('../src/ui/state');
  const { SAVE_KEY } = await import('../src/save/save');
  const save = structuredClone(state.getSave());
  save.tutorial = { step: 'done', giftGiven: true }; save.progress.tutorialDone = true;
  save.player.coin = 12345; state.commit(save);
  const backup = state.exportCode();
  // Deliberate checksum corruption of this test's isolated experiment save; no real user data.
  const envelope = JSON.parse(localStorage.getItem(SAVE_KEY)!);
  envelope.data.player.coin = 54321;
  const broken = JSON.stringify(envelope); localStorage.setItem(SAVE_KEY, broken);
  vi.resetModules(); state = await import('../src/ui/state');
  const { startApp } = await import('../src/ui/app');
  const host = document.createElement('div'); document.body.append(host); router = startApp(host);
  expect(state.getLoadProblem()).toBe('checksum');
  const dialog = host.querySelector<HTMLElement>('[aria-label="存檔讀取失敗"]')!;
  return { state, backup, broken, SAVE_KEY, dialog, reset: button('重置存檔', dialog) };
}
it('Later revokes a still-connected warning reset without overwriting broken bytes', async () => {
  const { state, broken, SAVE_KEY, dialog, reset } = await bootBroken();
  button('稍後', dialog).click(); await wait(50); expect(reset.isConnected).toBe(true);
  reset.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  expect(localStorage.getItem(SAVE_KEY)).toBe(broken); expect(state.getLoadProblem()).toBe('checksum');
});
it('an open warning cannot reset a backup restored after it was created', async () => {
  const { state, backup, reset, SAVE_KEY } = await bootBroken();
  // Real parser/import state transition isolates the stale problem predicate from dialog closure.
  expect(state.importCode(backup)).toBeNull();
  const before = JSON.stringify(state.getSave()); const raw = localStorage.getItem(SAVE_KEY);
  reset.click();
  expect(JSON.stringify(state.getSave())).toBe(before);
  expect(localStorage.getItem(SAVE_KEY)).toBe(raw); expect(state.getLoadProblem()).toBeNull();
});
it('a live explicit reset succeeds once and its fading callback cannot reset later progress', async () => {
  const { state, broken, SAVE_KEY, reset } = await bootBroken();
  const writes = vi.spyOn(localStorage, 'setItem');
  const removes = vi.spyOn(localStorage, 'removeItem');
  reset.click();
  expect(state.getLoadProblem()).toBeNull(); expect(state.getSave().player.coin).toBe(1000);
  expect(localStorage.getItem(SAVE_KEY)).not.toBe(broken);
  expect(writes.mock.calls.filter(([key]) => key === SAVE_KEY)).toHaveLength(1);
  expect(removes.mock.calls.filter(([key]) => key === SAVE_KEY)).toHaveLength(1);
  state.commit({ ...state.getSave(), player: { ...state.getSave().player, coin: 7777 } });
  const before = JSON.stringify(state.getSave()); reset.click();
  expect(JSON.stringify(state.getSave())).toBe(before);
});
it('Later still permits recovery using the settings import dialog', async () => {
  const { state, backup, dialog, broken, SAVE_KEY } = await bootBroken();
  button('稍後', dialog).click(); expect(localStorage.getItem(SAVE_KEY)).toBe(broken);
  button('匯入存檔碼').click();
  const importer = document.querySelector<HTMLElement>('[aria-label="匯入存檔碼"]')!;
  importer.querySelector<HTMLTextAreaElement>('textarea')!.value = backup;
  button('匯入', importer).click();
  expect(state.getLoadProblem()).toBeNull(); expect(state.getSave().player.coin).toBe(12345);
});
