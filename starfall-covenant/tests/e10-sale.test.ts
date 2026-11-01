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
  if (!found) throw new Error(`Missing dialog ${title}`);
  return found;
}
async function bootSale() {
  vi.resetModules(); localStorage.clear(); history.replaceState(null, '', '#/cards');
  const state = await import('../src/ui/state');
  const save = structuredClone(state.getSave());
  save.tutorial = { step: 'done', giftGiven: true }; save.progress.tutorialDone = true;
  // Explicit existing high-rarity owned-card fixture; not a claim of natural acquisition.
  save.inventory.cards.push({ ...save.inventory.cards[0], uid: 'sale-fixture', cardId: 'c811', locked: false });
  state.commit(save);
  const { startApp } = await import('../src/ui/app');
  const host = document.createElement('div'); document.body.append(host); router = startApp(host);
  button('批次販賣', host).click();
  host.querySelector<HTMLButtonElement>('.card-grid [aria-label="饕餮渾沌魔君"]')!.click();
  const sell = button('販賣', host.querySelector('.bag-sell-bar')!);
  sell.click();
  return { state, sell };
}
async function secondConfirmation() {
  button('販賣', dialog('批次販賣')).click();
  await vi.waitFor(() => expect(dialog('包含高星卡片')).toBeTruthy());
  return button('確定販賣', dialog('包含高星卡片'));
}

it.each([1, 2])('leaving at confirmation %i makes the retained approval inert', async phase => {
  const { state } = await bootSale();
  const approval = phase === 1 ? button('販賣', dialog('批次販賣')) : await secondConfirmation();
  router!.replace('settings');
  const before = JSON.stringify(state.getSave());
  await wait(200);
  approval.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await wait(20);
  expect(JSON.stringify(state.getSave())).toBe(before);
  expect(document.querySelector('[role="dialog"]')).toBeNull();
});

it.each([1, 2])('approval then same-task navigation at confirmation %i cannot sell or open another dialog', async phase => {
  const { state } = await bootSale();
  const approval = phase === 1 ? button('販賣', dialog('批次販賣')) : await secondConfirmation();
  const before = JSON.stringify(state.getSave());
  approval.click(); router!.replace('settings');
  await wait(200);
  expect(JSON.stringify(state.getSave())).toBe(before);
  expect(document.querySelector('[role="dialog"]')).toBeNull();
});

it('cancel at each step permits retry; both approvals sell the high-rarity card exactly once', async () => {
  const { state, sell } = await bootSale();
  const before = state.getSave().player.coin;
  button('取消', dialog('批次販賣')).click(); await wait(0); sell.click();
  await secondConfirmation(); button('取消', dialog('包含高星卡片')).click();
  await wait(0); sell.click(); const approval = await secondConfirmation();
  expect(state.getSave().player.coin).toBe(before);
  expect(state.getSave().inventory.cards.some(c => c.uid === 'sale-fixture')).toBe(true);
  approval.click(); approval.click(); await wait(0);
  expect(state.getSave().player.coin).toBe(before + 1200);
  expect(state.getSave().inventory.cards.some(c => c.uid === 'sale-fixture')).toBe(false);
});

it('the final commit revalidates the latest lock state rather than selling the preview snapshot', async () => {
  const { state } = await bootSale(); const approval = await secondConfirmation();
  const newer = structuredClone(state.getSave());
  newer.inventory.cards.find(c => c.uid === 'sale-fixture')!.locked = true;
  state.commit(newer); const before = JSON.stringify(state.getSave());
  approval.click(); await wait(0);
  expect(JSON.stringify(state.getSave())).toBe(before);
});
