// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import type { Router } from '../src/ui/router';
import type { SaveData } from '../src/core/types';
let router: Router | undefined;
afterEach(() => { router?.stop(); vi.restoreAllMocks(); vi.unstubAllGlobals(); document.body.replaceChildren(); });
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
function button(root: ParentNode, text: string) {
  const found = [...root.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent === text); expect(found, text).toBeDefined(); return found!;
}
const modal = (host: HTMLElement, label: string) => host.querySelector<HTMLElement>(`[role="dialog"][aria-label="${label}"]:not(.closing)`)!;
async function boot(route: string) {
  vi.resetModules(); localStorage.clear(); sessionStorage.clear(); history.replaceState(null, '', route);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(new Proxy({}, { get: (_t, k) => k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => {} }) as CanvasRenderingContext2D);
  const backing = localStorage, payloads: SaveData[] = [], writes: string[] = [];
  vi.stubGlobal('localStorage', { getItem: (k: string) => backing.getItem(k), setItem: (k: string, v: string) => { writes.push(k); if (k.endsWith('starfall.save')) payloads.push(JSON.parse(v).data); backing.setItem(k, v); }, removeItem: (k: string) => { writes.push(k); backing.removeItem(k); } });
  const state = await import('../src/ui/state');
  const save = structuredClone(state.getSave()); save.tutorial = { step: 'done', giftGiven: true }; save.progress.tutorialDone = true;
  save.player.coin = 30000; save.player.gems = 200;
  save.inventory.cards.push({ ...save.inventory.cards[0], uid: 'e10-c811', cardId: 'c811', locked: false });
  save.collection.owned.push('c811'); save.collection.seen.push('c811'); state.commit(save);
  const { bus } = await import('../src/core/events'); const obtained = vi.fn(), pulled = vi.fn(); bus.on('cardObtained', obtained); bus.on('gachaPulled', pulled);
  const { startApp } = await import('../src/ui/app'); const host = document.createElement('div'); document.body.append(host); router = startApp(host);
  writes.length = 0; payloads.length = 0;
  return { state, host, writes, payloads, obtained, pulled };
}
async function go(host: HTMLElement, name: string, args: string[] = []) {
  router!.go(name, args); await vi.waitFor(() => expect(host.querySelector(`[data-screen="${name}"]`)).not.toBeNull());
}
async function saleConfirmation(host: HTMLElement) {
  button(host, '批次販賣').click();
  host.querySelector<HTMLButtonElement>('.card-grid [aria-label="饕餮渾沌魔君"]')!.click();
  button(host.querySelector('.bag-sell-bar')!, '販賣').click();
  button(modal(host, '批次販賣'), '販賣').click();
  await vi.waitFor(() => expect(modal(host, '包含高星卡片')).not.toBeNull());
  return button(modal(host, '包含高星卡片'), '確定販賣');
}
function shopConfirmation(host: HTMLElement) {
  const row = [...host.querySelectorAll<HTMLElement>('.shop-item')].find(x => x.textContent?.includes('經典角色・巴風特'))!;
  expect(row).toBeDefined(); row.querySelector<HTMLButtonElement>('button.btn')!.click();
  return button(modal(host, '確認購買'), '購買');
}
function summonConfirmation(host: HTMLElement) {
  host.querySelector<HTMLButtonElement>('.seal-pull-actions button')!.click();
  const dialog = host.querySelector<HTMLElement>('[role="dialog"]:not(.closing)')!;
  return { dialog, confirm: button(dialog, '召喚'), cancel: button(dialog, '取消') };
}
const uids = (s: SaveData) => s.inventory.cards.map(c => c.uid).sort();
function transitions(payloads: SaveData[], initial: number, field: 'coin' | 'gems') {
  let value = initial, changes = 0;
  for (const s of payloads) { if (s.player[field] !== value) changes++; value = s.player[field]; }
  return changes;
}

it('high-star sale second confirmation revoked by real route departure; later legitimate sale removes exactly that UID once', async () => {
  const { state, host, writes, payloads } = await boot('#/cards');
  const before = structuredClone(state.getSave()); const old = await saleConfirmation(host);
  await go(host, 'settings'); await wait(200); old.click(); await wait(25);
  expect(state.getSave()).toEqual(before); expect(writes).toEqual([]); expect(payloads).toEqual([]);
  await go(host, 'cards');
  const { previewSell } = await import('../src/growth'); const coin = previewSell(state.getSave(), state.growth, ['e10-c811']).coin;
  const valid = await saleConfirmation(host); valid.click(); valid.click();
  await vi.waitFor(() => expect(state.getSave().inventory.cards.some(c => c.uid === 'e10-c811')).toBe(false));
  expect(state.getSave().player.coin).toBe(before.player.coin + coin);
  const expected = uids(before).filter(uid => uid !== 'e10-c811'); expect(uids(state.getSave())).toEqual(expected);
  expect(payloads.length).toBeGreaterThan(0);
  for (const s of payloads) { expect(s.player.coin).toBe(before.player.coin + coin); expect(s.player.gems).toBe(before.player.gems); expect(uids(s)).toEqual(expected); expect(s.gacha).toEqual(before.gacha); }
  expect(transitions(payloads, before.player.coin, 'coin')).toBe(1);
}, 20000);

it('shop pending purchase revoked after route departure; fresh valid purchase creates one UID and one purchase count', async () => {
  const { state, host, writes, payloads } = await boot('#/shop/coin');
  const before = structuredClone(state.getSave()); const old = shopConfirmation(host);
  await go(host, 'settings'); await wait(200); old.click(); await wait(25);
  expect(state.getSave()).toEqual(before); expect(writes).toEqual([]); expect(payloads).toEqual([]);
  await go(host, 'shop', ['coin']); const valid = shopConfirmation(host); valid.click(); valid.click();
  await vi.waitFor(() => expect(state.getSave().inventory.cards.filter(c => c.cardId === 'c812')).toHaveLength(1));
  expect(state.getSave().player.coin).toBe(before.player.coin - 15000); expect(state.getSave().quests.counters.shopPurchase).toBe(1);
  const newIds = uids(state.getSave()).filter(id => !uids(before).includes(id)); expect(newIds).toHaveLength(1);
  expect(payloads.length).toBeGreaterThan(0);
  for (const s of payloads) { expect(s.player.coin).toBe(before.player.coin - 15000); expect(s.player.gems).toBe(before.player.gems); expect(uids(s)).toEqual(uids(state.getSave())); expect(s.inventory.cards.filter(c => c.cardId === 'c812')).toHaveLength(1); expect(s.quests.counters.shopPurchase).toBe(1); expect(s.gacha).toEqual(before.gacha); }
  expect(transitions(payloads, before.player.coin, 'coin')).toBe(1);
}, 20000);

it('summon cancelled fade ordinary click cannot spend; old cancel cannot close newer dialog; new approval commits one pull before actual ritual', async () => {
  const { state, host, writes, payloads, obtained, pulled } = await boot('#/summon');
  const before = structuredClone(state.getSave());
  const old = summonConfirmation(host); old.cancel.click(); await wait(50); old.confirm.click(); await wait(10);
  expect(state.getSave()).toEqual(before); expect(writes).toEqual([]); expect(payloads).toEqual([]); expect(location.hash).toBe('#/summon');
  const fresh = summonConfirmation(host); old.cancel.click(); await wait(160);
  expect(fresh.dialog.isConnected).toBe(true); expect(fresh.dialog.classList.contains('closing')).toBe(false);
  expect(state.getSave()).toEqual(before); expect(writes).toEqual([]);
  const { gameData } = await import('../src/data/load'); const { pullCost } = await import('../src/progression/gacha');
  const cost = pullCost(gameData.gachaPools[0], 1);
  fresh.confirm.click(); fresh.confirm.click();
  await vi.waitFor(() => expect(host.querySelector('[data-screen="summon-ritual"]')).not.toBeNull());
  const after = state.getSave(); expect(after.player.gems).toBe(before.player.gems - cost); expect(after.gacha.history).toHaveLength(before.gacha.history.length + 1);
  expect(uids(after).filter(uid => !uids(before).includes(uid))).toHaveLength(1); expect(obtained).toHaveBeenCalledTimes(1); expect(pulled).toHaveBeenCalledTimes(1);
  expect(payloads.length).toBeGreaterThan(0);
  // App quest subscribers may legitimately persist again; every payload must contain the SAME single debit/card/history entry.
  for (const s of payloads) { expect(s.player.gems).toBe(before.player.gems - cost); expect(s.player.coin).toBe(before.player.coin); expect(uids(s)).toEqual(uids(after)); expect(s.gacha.history).toEqual(after.gacha.history); }
  expect(transitions(payloads, before.player.gems, 'gems')).toBe(1);
}, 20000);
