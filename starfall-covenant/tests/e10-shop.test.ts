// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import type { Router } from '../src/ui/router';
let router: Router | undefined;
afterEach(() => { router?.stop(); vi.restoreAllMocks(); document.body.replaceChildren(); });
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const click = (b: HTMLButtonElement) => b.dispatchEvent(new MouseEvent('click', { bubbles: true }));
const named = (root: ParentNode, text: string) => [...root.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent === text)!;
async function boot(coin = 30000) {
  vi.resetModules(); localStorage.clear(); sessionStorage.clear(); history.replaceState(null, '', '#/shop/coin');
  const state = await import('../src/ui/state'); const s = structuredClone(state.getSave());
  s.tutorial = { step: 'done', giftGiven: true }; s.progress.tutorialDone = true; s.player.coin = coin; state.commit(s);
  const { gameData } = await import('../src/data/load');
  const { startApp } = await import('../src/ui/app'); const host = document.createElement('div'); document.body.append(host); router = startApp(host);
  const commits = vi.spyOn(state, 'commit');
  const row = () => [...host.querySelectorAll<HTMLElement>('.shop-item')].find(el => el.textContent?.includes('經典角色・巴風特'))!;
  const buy = () => row().querySelector<HTMLButtonElement>('button.btn')!;
  const open = () => { buy().click(); return host.querySelector<HTMLElement>('[role="dialog"]:not(.closing)')!; };
  return { host, state, gameData, commits, buy, open };
}
it('route departure revokes pending confirmation and detached purchase entry', async () => {
  const f = await boot(); const before = JSON.stringify(f.state.getSave()); const oldEntry = f.buy(); const old = named(f.open(), '購買');
  router!.replace('settings'); await wait(200); expect(old.isConnected).toBe(false); click(old); click(oldEntry); await wait(10);
  expect(JSON.stringify(f.state.getSave())).toBe(before); expect(f.commits).not.toHaveBeenCalled();
  expect(f.host.querySelector('[role="dialog"]:not(.closing)')).toBeNull();
});
it('approval followed by synchronous departure before await continuation never purchases', async () => {
  const f = await boot(); const before = JSON.stringify(f.state.getSave()); named(f.open(), '購買').click(); router!.replace('settings'); await wait(10);
  expect(JSON.stringify(f.state.getSave())).toBe(before); expect(f.commits).not.toHaveBeenCalled();
});
it('single pending dialog, cancellation then fresh retry purchases once and respects sold out', async () => {
  const f = await boot(); const before = JSON.stringify(f.state.getSave()); const entry = f.buy(); const dlg = f.open(); click(entry);
  expect(f.host.querySelectorAll('[role="dialog"]:not(.closing)')).toHaveLength(1);
  const old = named(dlg, '購買'); named(dlg, '取消').click(); await wait(50); click(old); await wait(1);
  expect(JSON.stringify(f.state.getSave())).toBe(before); expect(f.commits).not.toHaveBeenCalled();
  const valid = named(f.open(), '購買'); valid.click(); click(valid); await wait(10);
  expect(f.state.getSave().player.coin).toBe(15000); expect(f.state.getSave().inventory.cards.filter(c => c.cardId === 'c812')).toHaveLength(1);
  expect(f.state.getSave().quests.counters.shopPurchase).toBe(1); expect(f.buy().disabled).toBe(true);
  // Forced old entry can at most reach the unchanged pure sold-out guard.
  click(entry); await wait(1); const stale = f.host.querySelector<HTMLElement>('[role="dialog"]:not(.closing)'); if (stale) named(stale, '購買').click(); await wait(1);
  expect(f.state.getSave().player.coin).toBe(15000); expect(f.state.getSave().quests.counters.shopPurchase).toBe(1);
});
it('insufficient resources remain unchanged and cancellation does not poison retry', async () => {
  const f = await boot(14999); const before = JSON.stringify(f.state.getSave()); named(f.open(), '購買').click(); await wait(1);
  expect(JSON.stringify(f.state.getSave())).toBe(before); expect(f.commits).not.toHaveBeenCalled();
  const next = f.open(); expect(next).not.toBeNull(); named(next, '取消').click(); await wait(1); expect(JSON.stringify(f.state.getSave())).toBe(before);
});
it('test-only unlimited item permits a second legitimate purchase after pending settles', async () => {
  const f = await boot(); const item = f.gameData.shop.find(i => i.id === 'classic-c812')!;
  // In-memory fixture only, exercising the no-limit branch without changing shipped shop data.
  const originalLimit = item.limit;
  try {
    delete item.limit;
    named(f.open(), '購買').click(); await wait(1); named(f.open(), '購買').click(); await wait(1);
    expect(f.state.getSave().player.coin).toBe(0); expect(f.state.getSave().inventory.cards.filter(c => c.cardId === 'c812')).toHaveLength(2);
    expect(new Set(f.state.getSave().inventory.cards.filter(c => c.cardId === 'c812').map(c => c.uid)).size).toBe(2);
    expect(f.state.getSave().quests.counters.shopPurchase).toBe(2);
  } finally {
    item.limit = originalLimit;
  }
});
