// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import type { OwnedCard, SaveData } from '../src/core/types';
import type { Router } from '../src/ui/router';
let router: Router | undefined;
afterEach(() => { router?.stop(); vi.restoreAllMocks(); vi.unstubAllGlobals(); document.body.replaceChildren(); });
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const make = (uid: string, cardId: string): OwnedCard => ({ uid, cardId, level: 1, exp: 0, skillLevel: 1, limitBreak: 0, awakened: 0, locked: false, obtainedAt: 1 });
function button(root: ParentNode, label: string) {
  const found = [...root.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent === label); expect(found, label).toBeDefined(); return found!;
}
const action = (host: HTMLElement) => host.querySelector<HTMLButtonElement>('.growth-action button')!;
const target = (save: SaveData) => save.inventory.cards.find(c => c.uid === 'e11-target')!;
async function boot(mode: 'skill' | 'limit' | 'enhance' | 'awaken', crystal = false) {
  vi.resetModules(); localStorage.clear(); sessionStorage.clear(); history.replaceState(null, '', `#/enhance/e11-target?mode=${mode}&mat=e11-m1`);
  const backing = localStorage, payloads: SaveData[] = [];
  vi.stubGlobal('localStorage', { getItem: (k: string) => backing.getItem(k), setItem: (k: string, v: string) => { if (k.endsWith('starfall.save')) payloads.push(JSON.parse(v).data); backing.setItem(k, v); }, removeItem: (k: string) => backing.removeItem(k) });
  const state = await import('../src/ui/state');
  const { nextAwakening } = await import('../src/growth');
  const save = structuredClone(state.getSave()); save.tutorial = { step: 'done', giftGiven: true }; save.progress.tutorialDone = true; save.player.coin = 100000;
  save.teams.forEach(t => { t.members = [null, null, null, null, null]; });
  const card = make('e11-target', 'c102');
  const req = nextAwakening(state.growth.card('c102')!, card, state.growth)!;
  let material = mode === 'enhance' ? 'c901' : crystal ? 'c921' : 'c102';
  let count = 2;
  if (mode === 'awaken') { card.limitBreak = req.limitBreak; material = req.material; count = req.materials; }
  save.inventory.cards = [card, ...Array.from({ length: count }, (_, i) => make(`e11-m${i + 1}`, material))];
  save.collection = { seen: [...new Set(save.inventory.cards.map(c => c.cardId))], owned: [...new Set(save.inventory.cards.map(c => c.cardId))], claimed: [] };
  state.commit(save);
  const { startApp } = await import('../src/ui/app'); const host = document.createElement('div'); document.body.append(host); router = startApp(host);
  if (mode === 'awaken') button(host, '自動選擇').click();
  expect(action(host).disabled).toBe(false); payloads.length = 0;
  return { state, host, payloads, req };
}
async function closeSuccess(host: HTMLElement) {
  const dialog = host.querySelector<HTMLElement>('[role="dialog"]:not(.closing)')!;
  expect(dialog?.querySelector('.growth-celebrate')).not.toBeNull(); button(dialog, '確定').click(); await wait(160);
}

it('real c102 skill duplicate costs zero, increments once, then celebration close permits another operation', async () => {
  const { state, host, payloads } = await boot('skill'); const before = structuredClone(state.getSave());
  action(host).click(); action(host).click(); await wait(0);
  expect(target(state.getSave()).skillLevel).toBe(2); expect(state.getSave().player.coin).toBe(before.player.coin);
  expect(state.getSave().inventory.cards.some(c => c.uid === 'e11-m1')).toBe(false);
  expect(host.querySelector('[aria-label="確認素材"]')).toBeNull(); expect(payloads).toHaveLength(1);
  await closeSuccess(host); host.querySelector<HTMLButtonElement>('.growth-materials .card-thumb')!.click(); action(host).click(); await wait(0);
  expect(target(state.getSave()).skillLevel).toBe(3); expect(state.getSave().inventory.cards.map(c => c.uid)).toEqual(['e11-target']);
  expect(state.getSave().player.coin).toBe(before.player.coin); expect(payloads).toHaveLength(2);
}, 20000);

it('same-name limit break remains immediate/no-confirm/zero-coin and exactly one duplicate consumed', async () => {
  const { state, host, payloads } = await boot('limit'); const coin = state.getSave().player.coin;
  action(host).click(); action(host).click(); await wait(0);
  expect(target(state.getSave()).limitBreak).toBe(1); expect(state.getSave().player.coin).toBe(coin);
  expect(state.getSave().inventory.cards.map(c => c.uid)).toEqual(['e11-target', 'e11-m2']);
  expect(host.querySelector('[aria-label="使用星輝結晶"]')).toBeNull(); expect(payloads).toHaveLength(1);
}, 20000);

it('c921 limit break requires crystal confirmation; cancel consumes nothing, retry succeeds exactly once', async () => {
  const { state, host, payloads } = await boot('limit', true); const before = structuredClone(state.getSave());
  action(host).click(); const first = host.querySelector<HTMLElement>('[aria-label="使用星輝結晶"]:not(.closing)')!;
  expect(first).not.toBeNull(); button(first, '取消').click(); await wait(160);
  expect(state.getSave()).toEqual(before); expect(payloads).toEqual([]); expect(action(host).disabled).toBe(false);
  action(host).click(); const dialog = host.querySelector<HTMLElement>('[aria-label="使用星輝結晶"]:not(.closing)')!;
  const approve = button(dialog, '確定突破'); approve.click(); approve.click(); await wait(0);
  expect(target(state.getSave()).limitBreak).toBe(1); expect(state.getSave().inventory.cards.map(c => c.uid)).toEqual(['e11-target', 'e11-m2']);
  expect(state.getSave().player.coin).toBe(before.player.coin); expect(payloads).toHaveLength(1);
}, 20000);

it('real nextAwakening requirement consumes exact coin/materials and c102 first HP+500 slot', async () => {
  const { state, host, payloads, req } = await boot('awaken');
  const { computeStats } = await import('../src/growth'); const before = structuredClone(state.getSave());
  const def = state.growth.card('c102')!; expect(req.passive).toEqual({ type: 'statUp', stat: 'hp', value: 500 });
  const stats = computeStats(def, target(before), state.growth.rules);
  action(host).click(); action(host).click(); await wait(0);
  const after = state.getSave(); expect(target(after).awakened).toBe(1); expect(target(after).limitBreak).toBe(req.limitBreak);
  expect(after.player.coin).toBe(before.player.coin - req.coin); expect(after.inventory.cards.map(c => c.uid)).toEqual(['e11-target']);
  expect(computeStats(def, target(after), state.growth.rules).hp - stats.hp).toBe(500); expect(payloads).toHaveLength(1);
  expect(payloads[0].inventory.cards).toEqual(after.inventory.cards); expect(payloads[0].player.coin).toBe(after.player.coin);
}, 20000);

it('ordinary enhancement follows real exp/coin preview, and closing success permits a second enhancement', async () => {
  const { state, host, payloads } = await boot('enhance'); const { previewEnhance } = await import('../src/growth');
  for (const uid of ['e11-m1', 'e11-m2']) {
    if (uid === 'e11-m2') { await closeSuccess(host); host.querySelector<HTMLButtonElement>('.growth-materials .card-thumb')!.click(); }
    const before = structuredClone(state.getSave()); const preview = previewEnhance(before, state.growth, 'e11-target', [uid]); expect(preview.ok).toBe(true); if (!preview.ok) throw new Error(preview.error.message);
    action(host).click(); action(host).click(); await wait(0);
    expect(target(state.getSave()).exp).toBe(target(before).exp + preview.expGained); expect(target(state.getSave()).level).toBe(preview.levelAfter);
    expect(state.getSave().player.coin).toBe(before.player.coin - preview.coin); expect(state.getSave().inventory.cards.some(c => c.uid === uid)).toBe(false);
  }
  expect(payloads).toHaveLength(2); expect(state.getSave().inventory.cards.map(c => c.uid)).toEqual(['e11-target']);
}, 20000);

it.each(['skill', 'limit', 'enhance', 'awaken'] as const)('detached no-confirm %s action after real route leave cannot consume anything', async mode => {
  const { state, host, payloads } = await boot(mode); const old = action(host), before = structuredClone(state.getSave());
  router!.go('settings'); await vi.waitFor(() => expect(host.querySelector('[data-screen="settings"]')).not.toBeNull());
  expect(old.isConnected).toBe(false); old.dispatchEvent(new MouseEvent('click', { bubbles: true })); await wait(25);
  expect(state.getSave()).toEqual(before); expect(payloads).toEqual([]); expect(location.hash).toBe('#/settings');
}, 20000);
