// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import type { Router } from '../src/ui/router';
import type { TutorialStep } from '../src/core/types';
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
  const state = await import('../src/ui/state'); const { gameData } = await import('../src/data/load');
  const s = structuredClone(state.getSave()); s.tutorial = { step, giftGiven: false }; s.progress.tutorialDone = step === 'done'; s.progress.clearedStages = ['st-1-1', 'st-5-9']; s.progress.storySeen = Object.keys(gameData.story);
  // This valid returning-player fixture already read the ring hint; do not mistake its
  // intended one-time hint bookkeeping for a battle-entry or resume transaction.
  s.hintsSeen = ['ringShield']; state.commit(s);
  const { abyssProgress, abyssFloor } = await import('../src/progression/abyss');
  const abyssId = abyssFloor(abyssProgress(s, Date.now()).week, 1, gameData.enemies).stage.id;
  const { beginActiveBattle, recordBattleSnapshot } = await import('../src/progression/active-battle');
  const { createRng } = await import('../src/core/rng'); const { startBattle } = await import('../src/battle/battle-state');
  const { findStage, battleDataFor } = await import('../src/ui/stage-lookup');
  const replaceTicket = (seed: number, stageId = 'st-1-1') => {
    const stage = findStage(stageId)!, members = [{ cardId: 'c106', level: 1, uid: 'u1' }];
    const battle = startBattle(stage, members, null, createRng(seed), battleDataFor(stage));
    state.commit(recordBattleSnapshot(beginActiveBattle(state.getSave(), { stageId, seed, members, helper: null, drops: { stageId, drops: [] } }, Date.now()), battle.snapshot()));
  };
  if (existing) replaceTicket(123, existing === 'abyss' ? abyssId : 'st-1-1');
  const { bus } = await import('../src/core/events'); const failed = vi.fn(); bus.on('stageFailed', failed);
  const { startApp } = await import('../src/ui/app'); const host = document.createElement('div'); document.body.append(host); router = startApp(host); writes.length = 0;
  return { state, host, writes, failed, replaceTicket, abyssId };
}
function challenge(host: HTMLElement) { const row = [...host.querySelectorAll<HTMLElement>('.list-item')].find(el => el.textContent?.includes('第 1 層')); expect(row).toBeDefined(); row!.click(); }

it.each(['main','abyss'] as const)('abyss %s: answer then same-task departure cannot abandon or navigate',async existing=>{
 const {state,host,failed}=await boot('#/abyss','done',existing);const before=structuredClone(state.getSave());challenge(host);button(modal(host,existing==='main'?'放棄進行中的戰鬥？':'有未完成的戰鬥'),existing==='main'?'放棄並出發':'重新出發').click();router!.replace('settings');await wait(30);expect(state.getSave()).toEqual(before);expect(failed).not.toHaveBeenCalled();expect(location.hash).toBe('#/settings');
});
it('abyss no-ticket await handoff never overwrites a newly installed ticket',async()=>{
 const {state,host,replaceTicket,failed}=await boot('#/abyss');challenge(host);replaceTicket(999);const before=structuredClone(state.getSave());await wait(30);expect(state.getSave()).toEqual(before);expect(failed).not.toHaveBeenCalled();expect(location.hash).toBe('#/abyss');
});
it('abyss singleflight creates only one pending consent, and cancel permits retry',async()=>{
 const {host,state}=await boot('#/abyss','done','main');challenge(host);challenge(host);expect(host.querySelectorAll('[aria-label="放棄進行中的戰鬥？"]:not(.closing)')).toHaveLength(1);button(modal(host,'放棄進行中的戰鬥？'),'取消').click();await wait(20);challenge(host);expect(modal(host,'放棄進行中的戰鬥？')).not.toBeNull();expect(state.getSave().activeBattle?.seed).toBe(123);
});
it('abyss abandonment listener installing new ticket survives handoff',async()=>{
 const {state,host,replaceTicket,failed}=await boot('#/abyss','done','main');const {bus}=await import('../src/core/events');bus.on('stageFailed',()=>replaceTicket(999));challenge(host);button(modal(host,'放棄進行中的戰鬥？'),'放棄並出發').click();await wait(30);expect(failed).toHaveBeenCalledTimes(1);expect(state.getSave().activeBattle?.seed).toBe(999);expect(location.hash).toBe('#/abyss');
});
it('home old Continue cannot redirect into a replacement same-stage battle',async()=>{
 const {host,state,replaceTicket,writes}=await boot('#/home','done','main');const old=button(modal(host,'有未完成的戰鬥'),'繼續');replaceTicket(999);writes.length=0;const before=structuredClone(state.getSave());old.click();await wait(30);expect(state.getSave()).toEqual(before);expect(writes).toEqual([]);expect(location.hash).toBe('#/home');
});
it.each(['繼續','放棄'])('home normal %s remains functional',async answer=>{
 const {state,host,failed}=await boot('#/home','done','main');button(modal(host,'有未完成的戰鬥'),answer).click();await wait(30);if(answer==='繼續'){expect(location.hash).toBe('#/battle/st-1-1');expect(state.getSave().activeBattle?.seed).toBe(123);expect(failed).not.toHaveBeenCalled();}else{expect(state.getSave().activeBattle).toBeNull();expect(failed).toHaveBeenCalledTimes(1);}
});
