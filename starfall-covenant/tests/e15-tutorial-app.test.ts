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
function skip(host: HTMLElement) { const control = host.querySelector<HTMLButtonElement>('.tut-skip'); expect(control).not.toBeNull(); control!.click(); return modal(host, '略過教學'); }
for(const [entry,hash,step] of [['controller','#/team','team'],['battle-guide','#/battle/tutorial','battle']] as const){
 it(`${entry}: cancel leaves exact save and storage untouched; retry skip grants gift once across real settings replay`,async()=>{
  const {state,host,writes}=await boot(hash,step);const before=structuredClone(state.getSave());const beforeRaw=localStorage.getItem((await import('../src/save/save')).SAVE_KEY);
  button(skip(host),'取消').click();await wait(30);expect(state.getSave()).toEqual(before);expect(writes).toEqual([]);expect(localStorage.getItem((await import('../src/save/save')).SAVE_KEY)).toBe(beforeRaw);
  const {tutorialGiftGems}=await import('../src/ui/tutorial/skip');button(skip(host),'略過').click();await vi.waitFor(()=>expect(state.getSave().tutorial?.giftGiven).toBe(true));
  expect(state.getSave().progress.tutorialDone).toBe(true);expect(state.getSave().player.gems).toBe(before.player.gems+tutorialGiftGems());
  router!.replace('settings');button(host.querySelector('[data-screen="settings"]')!,'重看教學').click();await vi.waitFor(()=>expect(host.querySelector('[data-screen="home"]')).not.toBeNull());
  if(entry==='battle-guide')router!.replace('battle',['tutorial']);button(skip(host),'略過').click();await wait(30);
  expect(state.getSave().progress.tutorialDone).toBe(true);expect(state.getSave().player.gems).toBe(before.player.gems+tutorialGiftGems());
 });
 for(const ending of ['leave','answerThenLeave','sameRouteReplacement'] as const)it(`${entry}: ${ending} revokes old skip without save/storage/route change`,async()=>{
  const {state,host,writes}=await boot(hash,step);const dialog=skip(host),old=button(dialog,'略過');const {SAVE_KEY}=await import('../src/save/save');
  if(ending==='answerThenLeave')old.click();
  if(ending==='sameRouteReplacement'){
   // Explicit same-route new-view generation, not a different route name.
   if(entry==='controller')router!.replace('team');else router!.replace('battle',['tutorial']);
  }else router!.replace('settings');
  const before=structuredClone(state.getSave()),raw=localStorage.getItem(SAVE_KEY),route=location.hash;writes.length=0;
  await wait(200);if(ending!=='answerThenLeave'){old.click();old.dispatchEvent(new MouseEvent('click',{bubbles:true}));}await wait(30);
  expect(state.getSave()).toEqual(before);expect(localStorage.getItem(SAVE_KEY)).toBe(raw);expect(writes).toEqual([]);expect(location.hash).toBe(route);expect(dialog.isConnected).toBe(false);
 });
 it(`${entry}: cancel fade old approval does not settle a newly opened skip`,async()=>{
  const {state,host,writes}=await boot(hash,step);const old=skip(host);button(old,'取消').click();await wait(20);const fresh=skip(host);const before=structuredClone(state.getSave());writes.length=0;
  button(old,'略過').click();await wait(20);expect(state.getSave()).toEqual(before);expect(writes).toEqual([]);expect(fresh.classList.contains('closing')).toBe(false);
  button(fresh,'取消').click();await wait(20);expect(state.getSave()).toEqual(before);
 });
}
