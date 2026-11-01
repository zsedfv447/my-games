// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import type { Router } from '../../src/ui/router';
import type { TutorialStep } from '../../src/core/types';
let router: Router | undefined;
afterEach(() => { router?.stop(); vi.restoreAllMocks(); vi.unstubAllGlobals(); document.body.replaceChildren(); });
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
function button(root: ParentNode, text: string) {
  const found = [...root.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent === text); expect(found, text).toBeDefined(); return found!;
}
const modal = (host: HTMLElement, title: string) => host.querySelector<HTMLElement>(`[role="dialog"][aria-label="${title}"]:not(.closing)`)!;
async function boot(hash: string, step: TutorialStep = 'done', existing?: 'main' | 'abyss') {
  vi.resetModules(); localStorage.clear(); sessionStorage.clear(); history.replaceState(null, '', hash);
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(new Proxy({}, { get: (_t, k) => k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => {} }) as CanvasRenderingContext2D);
  const backing = localStorage, writes: string[] = [];
  vi.stubGlobal('localStorage', { getItem: (k: string) => backing.getItem(k), setItem: (k: string, v: string) => { writes.push(k); backing.setItem(k, v); }, removeItem: (k: string) => { writes.push(k); backing.removeItem(k); } });
  const state = await import('../../src/ui/state'); const { gameData } = await import('../../src/data/load');
  const s = structuredClone(state.getSave()); s.tutorial = { step, giftGiven: false }; s.progress.tutorialDone = step === 'done'; s.progress.clearedStages = ['st-1-1', 'st-5-9']; s.progress.storySeen = Object.keys(gameData.story);
  // This valid returning-player fixture already read the ring hint; do not mistake its
  // intended one-time hint bookkeeping for a battle-entry or resume transaction.
  s.hintsSeen = ['ringShield']; state.commit(s);
  const { abyssProgress, abyssFloor } = await import('../../src/progression/abyss');
  const abyssId = abyssFloor(abyssProgress(s, Date.now()).week, 1, gameData.enemies).stage.id;
  const { beginActiveBattle, recordBattleSnapshot } = await import('../../src/progression/active-battle');
  const { createRng } = await import('../../src/core/rng'); const { startBattle } = await import('../../src/battle/battle-state');
  const { findStage, battleDataFor } = await import('../../src/ui/stage-lookup');
  const replaceTicket = (seed: number, stageId = 'st-1-1') => {
    const stage = findStage(stageId)!, members = [{ cardId: 'c106', level: 1, uid: 'u1' }];
    const battle = startBattle(stage, members, null, createRng(seed), battleDataFor(stage));
    state.commit(recordBattleSnapshot(beginActiveBattle(state.getSave(), { stageId, seed, members, helper: null, drops: { stageId, drops: [] } }, Date.now()), battle.snapshot()));
  };
  if (existing) replaceTicket(123, existing === 'abyss' ? abyssId : 'st-1-1');
  const { bus } = await import('../../src/core/events'); const failed = vi.fn(); bus.on('stageFailed', failed);
  const { startApp } = await import('../../src/ui/app'); const host = document.createElement('div'); document.body.append(host); router = startApp(host); writes.length = 0;
  return { state, host, writes, failed, replaceTicket, abyssId };
}
function skip(host: HTMLElement) { const control = host.querySelector<HTMLButtonElement>('.tut-skip'); expect(control).not.toBeNull(); control!.click(); return modal(host, '略過教學'); }
function challenge(host: HTMLElement) { const row = [...host.querySelectorAll<HTMLElement>('.list-item')].find(el => el.textContent?.includes('第 1 層')); expect(row).toBeDefined(); row!.click(); }

for (const [entry, hash, step] of [['controller', '#/team', 'team'], ['battle-guide', '#/battle/tutorial', 'battle']] as const) {
  it(`${entry}: normal skip grants gift once; actual restart then skip never grants again`, async () => {
    const { state, host } = await boot(hash, step); const before = state.getSave().player.gems;
    const { tutorialGiftGems } = await import('../../src/ui/tutorial/skip');
    button(skip(host), '略過').click(); await vi.waitFor(() => expect(state.getSave().tutorial?.giftGiven).toBe(true));
    expect(state.getSave().progress.tutorialDone).toBe(true); expect(state.getSave().player.gems).toBe(before + tutorialGiftGems());
    router!.replace('settings'); button(host.querySelector('[data-screen="settings"]')!, '重看教學').click();
    await vi.waitFor(() => expect(host.querySelector('[data-screen="home"]')).not.toBeNull());
    if (entry === 'battle-guide') router!.replace('battle', ['tutorial']);
    button(skip(host), '略過').click(); await wait(30);
    expect(state.getSave().progress.tutorialDone).toBe(true); expect(state.getSave().player.gems).toBe(before + tutorialGiftGems());
  });
  it(`${entry}: normal cancel preserves tutorial/gift/currency and writes nothing`, async () => {
    const { state, host, writes } = await boot(hash, step); const before = structuredClone(state.getSave());
    button(skip(host), '取消').click(); await wait(30); expect(state.getSave()).toEqual(before); expect(writes).toEqual([]);
  });
  it(`${entry}: route departure revokes old skip confirmation instead of granting gift or changing route`, async () => {
    const { state, host, writes } = await boot(hash, step); const before = structuredClone(state.getSave()), old = button(skip(host), '略過');
    router!.replace('settings'); await wait(200); old.click(); await wait(30);
    expect(state.getSave()).toEqual(before); expect(writes).toEqual([]); expect(location.hash).toBe('#/settings');
  });
}

it('abyss default branch: first challenge remains free and starts real first-floor battle', async () => {
  const { state, host, abyssId, failed } = await boot('#/abyss'); const stamina = structuredClone(state.getSave().stamina);
  challenge(host); await vi.waitFor(() => expect(host.querySelector('[data-screen="battle"]')).not.toBeNull());
  expect(state.getSave().stamina).toEqual(stamina); expect(state.getSave().activeBattle?.stageId).toBe(abyssId); expect(failed).not.toHaveBeenCalled();
});
it('abyss default different-stage cancel retains ticket and zero cost', async () => {
  const { state, host, writes, failed } = await boot('#/abyss', 'done', 'main'); const before = structuredClone(state.getSave());
  challenge(host); button(modal(host, '放棄進行中的戰鬥？'), '取消').click(); await wait(30);
  expect(state.getSave()).toEqual(before); expect(writes).toEqual([]); expect(failed).not.toHaveBeenCalled();
});
it('abyss alias same-stage resume preserves full snapshot and is free', async () => {
  const { state, host, writes, failed } = await boot('#/abyss', 'done', 'abyss'); const before = structuredClone(state.getSave());
  challenge(host); button(modal(host, '有未完成的戰鬥'), '繼續').click();
  await vi.waitFor(() => expect(host.querySelector('[data-screen="battle"]')).not.toBeNull());
  expect(state.getSave()).toEqual(before); expect(writes).toEqual([]); expect(failed).not.toHaveBeenCalled();
});
it('abyss same-stage explicit restart remains free and records one deliberate abandonment', async () => {
  const { state, host, failed, abyssId } = await boot('#/abyss', 'done', 'abyss'); const stamina = structuredClone(state.getSave().stamina);
  challenge(host); button(modal(host, '有未完成的戰鬥'), '重新出發').click();
  await vi.waitFor(() => expect(host.querySelector('[data-screen="battle"]')).not.toBeNull());
  expect(state.getSave().stamina).toEqual(stamina); expect(state.getSave().activeBattle?.stageId).toBe(abyssId); expect(failed).toHaveBeenCalledTimes(1);
});
it.each(['main', 'abyss'] as const)('abyss %s branch route departure revokes pending approval without clearing or redirecting', async existing => {
  const { state, host, writes, failed } = await boot('#/abyss', 'done', existing); const before = structuredClone(state.getSave());
  challenge(host); const old = button(modal(host, existing === 'abyss' ? '有未完成的戰鬥' : '放棄進行中的戰鬥？'), existing === 'abyss' ? '重新出發' : '放棄並出發');
  router!.replace('settings'); await wait(200); old.click(); await wait(30);
  expect(state.getSave()).toEqual(before); expect(writes).toEqual([]); expect(failed).not.toHaveBeenCalled(); expect(location.hash).toBe('#/settings');
});
it.each(['main', 'abyss'] as const)('abyss %s pending default confirmation cannot abandon a replacement same-stage ticket', async existing => {
  const { state, host, writes, failed, replaceTicket, abyssId } = await boot('#/abyss', 'done', existing);
  challenge(host); const old = button(modal(host, existing === 'abyss' ? '有未完成的戰鬥' : '放棄進行中的戰鬥？'), existing === 'abyss' ? '重新出發' : '放棄並出發');
  replaceTicket(999, existing === 'abyss' ? abyssId : 'st-1-1'); writes.length = 0; const before = structuredClone(state.getSave()); old.click(); await wait(30);
  expect(state.getSave()).toEqual(before); expect(writes).toEqual([]); expect(failed).not.toHaveBeenCalled(); expect(location.hash).toBe('#/abyss');
});

it('home same-page replacement: old Abandon must not clear a newer same-stage ticket', async () => {
  const { state, host, writes, failed, replaceTicket } = await boot('#/home', 'done', 'main');
  const old = button(modal(host, '有未完成的戰鬥'), '放棄'); replaceTicket(999); writes.length = 0;
  const before = structuredClone(state.getSave()); old.click(); await wait(30);
  expect(state.getSave()).toEqual(before); expect(writes).toEqual([]); expect(failed).not.toHaveBeenCalled();
});
it.each(['繼續', '放棄'])('home answer %s then same-task leave must not redirect or mutate the newer route', async answer => {
  const { state, host, writes, failed } = await boot('#/home', 'done', 'main'); const before = structuredClone(state.getSave());
  button(modal(host, '有未完成的戰鬥'), answer).click(); router!.replace('settings'); await wait(30);
  expect(location.hash).toBe('#/settings'); expect(state.getSave()).toEqual(before); expect(writes).toEqual([]); expect(failed).not.toHaveBeenCalled();
});
