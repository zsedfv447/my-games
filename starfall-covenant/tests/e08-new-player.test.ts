// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { Router } from '../src/ui/router';

let router: Router | undefined;
let host: HTMLElement;
let state: typeof import('../src/ui/state');
beforeEach(() => {
  vi.resetModules(); localStorage.clear(); sessionStorage.clear(); document.body.replaceChildren();
  // Only the unavailable drawing surface is replaced; game/controller/storage/navigation remain real.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(new Proxy({}, {
    get: (_target, key) => key === 'createLinearGradient' || key === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => {},
  }) as CanvasRenderingContext2D);
});
afterEach(() => { router?.stop(); router = undefined; host?.remove(); vi.restoreAllMocks(); });
async function boot(hash: string, checkpoint = false) {
  history.replaceState(null, '', hash);
  state = await import('../src/ui/state');
  if (checkpoint) {
    // Explicit legal checkpoint, NOT a claim that this test dragged/completed the tutorial battle:
    // player finished tutorial battle + team introduction, has not opened summon or received its gift.
    const { setTutorialStep } = await import('../src/ui/tutorial/flow');
    const fresh = state.getSave();
    state.commit(setTutorialStep({ ...fresh, progress: { ...fresh.progress, storySeen: ['prologue'] } }, 'summon'));
  }
  const { startApp } = await import('../src/ui/app');
  host = document.createElement('div'); document.body.append(host); router = startApp(host);
}
const screen = () => host.querySelector<HTMLElement>('main > [data-screen]')?.dataset.screen;
const waitScreen = async (name: string) => vi.waitFor(() => expect(screen()).toBe(name));
function button(label: string, root: ParentNode = host): HTMLButtonElement {
  const el = [...root.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent === label);
  expect(el, `button ${label}`).toBeDefined(); return el!;
}
async function guideAction(label: string) {
  await vi.waitFor(() => expect(host.querySelector('.tut-app .tut-bubble')).not.toBeNull());
  // Real guide advances its text one line per click; never invoke its callback directly.
  for (let i = 0; i < 12; i++) {
    const bubble = host.querySelector<HTMLElement>('.tut-app .tut-bubble')!;
    const action = [...bubble.querySelectorAll<HTMLButtonElement>('.tut-actions button')].find(b => b.textContent === label);
    if (action) { action.click(); return; }
    expect(bubble.classList.contains('has-more')).toBe(true); bubble.click();
  }
  throw new Error(`Guide action did not appear: ${label}`);
}
async function acceptGift() {
  await vi.waitFor(() => expect(host.querySelector('[aria-label="見面禮"]')).not.toBeNull());
  const gift = host.querySelector<HTMLElement>('[aria-label="見面禮"]')!;
  gift.click(); // Existing reward UI fast-forward, not a skipped promise or mocked award.
  await vi.waitFor(() => expect([...gift.querySelectorAll('button')].some(b => b.textContent === '收下')).toBe(true));
  button('收下', gift).click();
}
async function reloadSameUrl() {
  router!.stop(); host.remove(); vi.resetModules();
  state = await import('../src/ui/state');
  const { startApp } = await import('../src/ui/app');
  host = document.createElement('div'); document.body.append(host); router = startApp(host);
}

it('fresh title→prologue→real tutorial battle→skip gift→restart/skip→reload grants the lifetime gift only once', async () => {
  await boot('#/title');
  const initial = structuredClone(state.getSave());
  expect(initial.tutorial).toEqual({ step: 'battle', giftGiven: false });
  host.querySelector<HTMLElement>('.title-screen')!.click(); await waitScreen('story');
  expect(location.hash).toContain('prologue'); button('略過').click(); await waitScreen('home');
  await guideAction('開始轉珠教學'); await waitScreen('battle');
  expect(location.hash).toBe('#/battle/tutorial'); expect(state.getSave().tutorial?.step).toBe('battle');
  expect(state.getSave().activeBattle).toBeNull();
  button('略過教學', host.querySelector('.battle-screen') ?? host).click();
  const confirm = host.querySelector('[role="dialog"][aria-label="略過教學"]')!;
  button('略過', confirm).click();
  await vi.waitFor(() => expect(state.getSave().tutorial).toEqual({ step: 'done', giftGiven: true }));
  const { tutorialGiftGems } = await import('../src/ui/tutorial/skip');
  const awarded = state.getSave().player.gems;
  expect(awarded - initial.player.gems).toBe(tutorialGiftGems());
  expect(state.getSave().stamina.current).toBe(initial.stamina.current);
  expect(state.getSave().inventory.cards).toEqual(initial.inventory.cards);
  // The gift is committed before its animation; navigate with the real router, without claiming animation acknowledgement.
  router!.go('settings'); await waitScreen('settings'); button('重看教學').click(); await waitScreen('home');
  expect(state.getSave().tutorial).toEqual({ step: 'battle', giftGiven: true });
  router!.go('settings'); await waitScreen('settings'); button('略過教學').click();
  await vi.waitFor(() => expect(state.getSave().tutorial?.step).toBe('done'));
  expect(state.getSave().player.gems).toBe(awarded);
  await reloadSameUrl(); await waitScreen('settings');
  expect(state.getSave().tutorial).toEqual({ step: 'done', giftGiven: true });
  expect(state.getSave().player.gems).toBe(awarded);
  expect(state.getSave().stamina.current).toBe(initial.stamina.current);
}, 20000);

it('explicit post-team checkpoint→real summon gift/defer→first departure→before-story reload→battle reload keeps one paid ticket; stage tutorial finishes only at battle', async () => {
  await boot('#/summon', true);
  const { gameData } = await import('../src/data/load');
  const { tutorialGiftGems } = await import('../src/ui/tutorial/skip');
  const first = gameData.stages.find(s => s.id === 'st-1-1')!;
  expect(state.getSave().tutorial).toEqual({ step: 'summon', giftGiven: true });
  expect(state.getSave().player.gems).toBe(gameData.config.newPlayer.gems + tutorialGiftGems());
  await acceptGift(); await guideAction('先不召喚');
  expect(state.getSave().tutorial?.step).toBe('stage');
  expect(state.getSave().gacha.history).toEqual([]);
  await guideAction('前往第一章第一關'); await waitScreen('prepare');
  expect(state.getSave().tutorial?.step).toBe('stage');
  const stamina = state.getSave().stamina.current;
  const departure = host.querySelector<HTMLButtonElement>('[data-tut="sortie"] button')!;
  departure.click(); departure.click(); await waitScreen('story');
  expect(location.hash).toContain('ch1-open');
  const paid = state.getSave().stamina.current;
  expect(stamina - paid).toBe(first.stamina);
  const ticket = JSON.stringify(state.getSave().activeBattle);
  expect(state.getSave().activeBattle?.snapshot).toBeNull();
  expect(state.getSave().tutorial?.step).toBe('stage'); expect(state.getSave().progress.tutorialDone).toBe(false);
  expect(state.getSave().progress.storySeen).not.toContain('ch1-open');
  const gems = state.getSave().player.gems;
  await reloadSameUrl(); await waitScreen('story');
  expect(JSON.stringify(state.getSave().activeBattle)).toBe(ticket);
  expect(state.getSave().stamina.current).toBe(paid); expect(state.getSave().tutorial?.step).toBe('stage');
  button('略過').click(); await waitScreen('battle');
  await vi.waitFor(() => expect(state.getSave().activeBattle?.snapshot?.state.phase).toBe('player'));
  expect(state.getSave().tutorial).toEqual({ step: 'done', giftGiven: true });
  expect(state.getSave().progress.tutorialDone).toBe(true);
  expect(state.getSave().progress.storySeen.filter(id => id === 'ch1-open')).toHaveLength(1);
  expect(state.getSave().stamina.current).toBe(paid); expect(state.getSave().player.gems).toBe(gems);
  const snapshot = JSON.stringify(state.getSave().activeBattle);
  await reloadSameUrl(); await waitScreen('battle');
  expect(JSON.stringify(state.getSave().activeBattle)).toBe(snapshot);
  expect(state.getSave().stamina.current).toBe(paid); expect(state.getSave().player.gems).toBe(gems);
  expect(state.getSave().progress.storySeen.filter(id => id === 'ch1-open')).toHaveLength(1);
}, 20000);
