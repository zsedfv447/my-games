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
function confirmation(): HTMLElement {
  const found = document.querySelector<HTMLElement>('[aria-label="確認素材"]:not(.closing)');
  if (!found) throw new Error('Missing material confirmation');
  return found;
}
async function boot(mode = 'enhance') {
  vi.resetModules(); localStorage.clear();
  history.replaceState(null, '', `#/enhance/u1?mode=${mode}&mat=e11-material`);
  const state = await import('../src/ui/state');
  const save = structuredClone(state.getSave());
  save.tutorial = { step: 'done', giftGiven: true }; save.progress.tutorialDone = true;
  // Explicit existing owned-card material fixture, not naturally acquired gameplay.
  save.inventory.cards.push({ ...save.inventory.cards[0], uid: 'e11-material', cardId: mode === 'skill' ? save.inventory.cards[0].cardId : 'c811', locked: false });
  state.commit(save);
  const { startApp } = await import('../src/ui/app');
  const host = document.createElement('div'); document.body.append(host); router = startApp(host);
  const action = host.querySelector<HTMLButtonElement>('.growth-action button')!;
  expect(action.disabled).toBe(false);
  return { state, host, action };
}

it('leaving the risky-material confirmation closes it and makes a retained approval inert', async () => {
  const { state, action } = await boot(); action.click();
  const approve = button('確定強化', confirmation());
  router!.replace('settings'); const before = JSON.stringify(state.getSave());
  await wait(200); approve.dispatchEvent(new MouseEvent('click', { bubbles: true })); await wait(20);
  expect(JSON.stringify(state.getSave())).toBe(before);
  expect(document.querySelector('[role="dialog"]')).toBeNull();
});

it('approval then same-task navigation cannot consume material or coin', async () => {
  const { state, action } = await boot(); action.click();
  const before = JSON.stringify(state.getSave());
  button('確定強化', confirmation()).click(); router!.replace('settings'); await wait(200);
  expect(JSON.stringify(state.getSave())).toBe(before);
  expect(document.querySelector('[role="dialog"]')).toBeNull();
});

it('cancel permits retry, while repeated confirmation commits the intended material only once', async () => {
  const { state, action } = await boot(); const before = structuredClone(state.getSave());
  action.click(); action.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  expect(document.querySelectorAll('[aria-label="確認素材"]:not(.closing)')).toHaveLength(1);
  button('取消', confirmation()).click(); await wait(0);
  expect(JSON.stringify(state.getSave())).toBe(JSON.stringify(before)); expect(action.disabled).toBe(false);
  action.click(); const approve = button('確定強化', confirmation()); approve.click(); approve.click(); await wait(0);
  expect(state.getSave().inventory.cards.some(c => c.uid === 'e11-material')).toBe(false);
  expect(state.getSave().inventory.cards[0].exp).toBeGreaterThan(before.inventory.cards[0].exp);
  expect(state.getSave().player.coin).toBe(before.player.coin - 100);
});

it.each(['locked', 'inTeam'])('latest %s material protection survives an already-open confirmation', async protection => {
  const { state, action } = await boot(); action.click();
  const next = structuredClone(state.getSave());
  if (protection === 'locked') next.inventory.cards.find(c => c.uid === 'e11-material')!.locked = true;
  else next.teams[1].members[0] = 'e11-material';
  state.commit(next); const before = JSON.stringify(state.getSave());
  button('確定強化', confirmation()).click(); await wait(0);
  expect(JSON.stringify(state.getSave())).toBe(before); expect(action.disabled).toBe(false);
});

it('successful no-confirm skill growth stays committed but closing its celebration after leave cannot redraw the old root', async () => {
  const { state, host, action } = await boot('skill');
  const beforeLevel = state.getSave().inventory.cards[0].skillLevel;
  const body = host.querySelector<HTMLElement>('.growth-body')!;
  action.click();
  expect(state.getSave().inventory.cards[0].skillLevel).toBe(beforeLevel + 1);
  expect(document.querySelector('[aria-label="確認素材"]')).toBeNull();
  const celebrate = document.querySelector<HTMLElement>('[aria-label="技能升級！"]')!;
  const close = button('確定', celebrate);
  router!.replace('settings');
  const redraw = vi.spyOn(body, 'replaceChildren'); const committed = JSON.stringify(state.getSave());
  close.click(); await wait(0);
  expect(JSON.stringify(state.getSave())).toBe(committed); expect(redraw).not.toHaveBeenCalled();
  action.dispatchEvent(new MouseEvent('click', { bubbles: true })); await wait(0);
  expect(JSON.stringify(state.getSave())).toBe(committed);
});

it('a retained no-confirm action cannot start after its screen leaves', async () => {
  const { state, action } = await boot('skill');
  router!.replace('settings'); const before = JSON.stringify(state.getSave());
  action.dispatchEvent(new MouseEvent('click', { bubbles: true })); await wait(0);
  expect(JSON.stringify(state.getSave())).toBe(before);
  expect(document.querySelector('[role="dialog"]')).toBeNull();
});
