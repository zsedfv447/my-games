// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import type { Router } from '../src/ui/router';
let router: Router | undefined;
afterEach(() => { router?.stop(); router = undefined; vi.restoreAllMocks(); document.body.replaceChildren(); });
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
function button(text: string, root: ParentNode = document): HTMLButtonElement {
  const found = [...root.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent === text);
  if (!found) throw new Error(`Missing ${text}`);
  return found;
}
function dialog(title: string): HTMLElement {
  const found = document.querySelector<HTMLElement>(`[role="dialog"][aria-label="${title}"]:not(.closing)`);
  if (!found) throw new Error(`Missing ${title}`);
  return found;
}
async function boot() {
  vi.resetModules(); localStorage.clear(); history.replaceState(null, '', '#/settings');
  const state = await import('../src/ui/state');
  const save = structuredClone(state.getSave());
  save.tutorial = { step: 'done', giftGiven: true }; save.progress.tutorialDone = true;
  save.player.coin = 4321; state.commit(save);
  const backup = state.exportCode();
  state.commit({ ...state.getSave(), player: { ...state.getSave().player, coin: 9876 } });
  const { startApp } = await import('../src/ui/app');
  const host = document.createElement('div'); document.body.append(host); router = startApp(host);
  return { state, backup, host };
}
function importDialog(backup: string) {
  button('匯入存檔碼').click(); const box = dialog('匯入存檔碼');
  box.querySelector<HTMLTextAreaElement>('textarea')!.value = backup;
  return { box, approve: button('匯入', box) };
}
it('reset approval after leaving cannot clear the experiment save', async () => {
  const { state } = await boot(); button('重置').click(); const approve = button('重置', dialog('重置存檔'));
  router!.replace('collection'); const before = JSON.stringify(state.getSave());
  await wait(200); approve.dispatchEvent(new MouseEvent('click', { bubbles: true })); await wait(0);
  expect(JSON.stringify(state.getSave())).toBe(before);
  expect(document.querySelector('[role="dialog"]')).toBeNull();
});
it('reset approval then same-task navigation is canceled before reset', async () => {
  const { state } = await boot(); button('重置').click(); const before = JSON.stringify(state.getSave());
  button('重置', dialog('重置存檔')).click(); router!.replace('collection'); await wait(0);
  expect(JSON.stringify(state.getSave())).toBe(before);
});
it.each(['cancel', 'leave'])('import %s revokes retained confirmation even during fade-out', async how => {
  const { state, backup } = await boot(); const { box, approve } = importDialog(backup);
  const before = JSON.stringify(state.getSave());
  if (how === 'cancel') button('取消', box).click(); else router!.replace('collection');
  await wait(50); approve.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  expect(JSON.stringify(state.getSave())).toBe(before);
});
it('invalid import is repairable; valid import commits once and closed callback cannot overwrite later progress', async () => {
  const { state, backup } = await boot(); const { box, approve } = importDialog('not-a-save');
  const before = JSON.stringify(state.getSave()); approve.click();
  expect(JSON.stringify(state.getSave())).toBe(before); expect(box.classList.contains('closing')).toBe(false);
  box.querySelector<HTMLTextAreaElement>('textarea')!.value = backup; approve.click();
  expect(state.getSave().player.coin).toBe(4321);
  state.commit({ ...state.getSave(), player: { ...state.getSave().player, coin: 7654 } });
  const later = JSON.stringify(state.getSave()); approve.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  expect(JSON.stringify(state.getSave())).toBe(later);
});
it('reset cancel permits retry and a live confirmation resets normally', async () => {
  const { state } = await boot(); const before = JSON.stringify(state.getSave());
  button('重置').click(); button('取消', dialog('重置存檔')).click(); await wait(0);
  expect(JSON.stringify(state.getSave())).toBe(before);
  button('重置').click(); button('重置', dialog('重置存檔')).click(); await wait(0);
  expect(state.getSave().player.coin).toBe(1000); expect(state.getSave().progress.tutorialDone).toBe(false);
});
