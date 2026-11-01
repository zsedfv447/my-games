// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import type { Router } from '../src/ui/router';
let router: Router | undefined;
afterEach(() => { router?.stop(); router = undefined; vi.restoreAllMocks(); vi.unstubAllGlobals(); document.body.replaceChildren(); });
async function boot(activeId?: string, prepareId = 'st-1-1', stamina?: number) {
  vi.resetModules(); localStorage.clear(); sessionStorage.clear();
  history.replaceState(null, '', `#/prepare/${prepareId}`);
  // Rendering only: actual app/Shell/Router/tutorial/session/confirmation/engine stay real.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(new Proxy({}, { get: (_t, key) => key === 'createLinearGradient' || key === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => {} }) as CanvasRenderingContext2D);
  const storage = localStorage, writes: string[] = [];
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.getItem(key),
    setItem: (key: string, value: string) => { writes.push(`set:${key}`); storage.setItem(key, value); },
    removeItem: (key: string) => { writes.push(`remove:${key}`); storage.removeItem(key); },
  });
  const state = await import('../src/ui/state');
  const { gameData } = await import('../src/data/load');
  const { createNewSave } = await import('../src/save/save');
  let save = createNewSave(gameData.config, Date.now());
  save.progress.tutorialDone = true; save.tutorial = { step: 'done', giftGiven: true };
  save.progress.clearedStages = ['st-1-1']; save.progress.storySeen = Object.keys(gameData.story);
  if (stamina !== undefined) save.stamina.current = stamina;
  const engine = await import('../src/battle/battle-state');
  const { createRng } = await import('../src/core/rng');
  if (activeId) {
    const { beginActiveBattle, recordBattleSnapshot } = await import('../src/progression/active-battle');
    const members = [{ cardId: 'c106', level: 5, uid: 'u1' }];
    const battle = engine.startBattle(gameData.stages.find(s => s.id === activeId)!, members, null, createRng(812), gameData);
    const snapshot = battle.snapshot(); snapshot.state.hp = Math.max(1, snapshot.state.hp - 37); snapshot.state.team[0].skillCooldown = 3;
    save = recordBattleSnapshot(beginActiveBattle(save, { stageId: activeId, seed: 812, members, helper: null, drops: { stageId: activeId, drops: [] } }, Date.now()), snapshot);
  }
  state.commit(save);
  const resumed = vi.spyOn(engine, 'resumeBattle'); // passthrough, actual reconstruction
  const { bus } = await import('../src/core/events'); const failed = vi.fn(); bus.on('stageFailed', failed);
  const { startApp } = await import('../src/ui/app');
  const host = document.createElement('div'); document.body.append(host); router = startApp(host); writes.length = 0;
  return { state, host, gameData, failed, resumed, writes, storage };
}
const sortie = (host: HTMLElement) => host.querySelector<HTMLButtonElement>('[data-tut="sortie"] button')!;
function modalButton(host: HTMLElement, text: string) {
  const button = [...host.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')].find(b => b.textContent === text);
  expect(button, text).toBeDefined(); return button!;
}
const settle = () => new Promise(resolve => setTimeout(resolve, 30));

it('replacement active ticket while confirming is never abandoned even with identical stageId', async () => {
  const { state, host, failed, writes } = await boot('st-1-1');
  sortie(host).click(); const oldAnswer = modalButton(host, '重新出發');
  const newer = structuredClone(state.getSave());
  newer.activeBattle!.seed += 1; newer.activeBattle!.startedAt += 1;
  state.commit(newer); writes.length = 0;
  const before = JSON.stringify(state.getSave());
  oldAnswer.click(); await settle();
  expect(JSON.stringify(state.getSave())).toBe(before); expect(writes).toEqual([]); expect(failed).not.toHaveBeenCalled();
  expect(location.hash).toBe('#/prepare/st-1-1');
}, 20000);

it('same-stage resume restores complete HP/board/CD/RNG snapshot and costs no stamina or persistence', async () => {
  const { state, host, failed, resumed, writes } = await boot('st-1-1');
  const before = structuredClone(state.getSave());
  sortie(host).click(); modalButton(host, '繼續').click();
  await vi.waitFor(() => expect(host.querySelector('[data-screen="battle"]')).not.toBeNull());
  expect(resumed).toHaveBeenCalledTimes(1);
  const actual = resumed.mock.results[0].value as ReturnType<typeof import('../src/battle/battle-state').resumeBattle>;
  expect(actual.snapshot()).toEqual(before.activeBattle!.snapshot);
  expect(state.getSave().stamina).toEqual(before.stamina); expect(state.getSave().activeBattle).toEqual(before.activeBattle);
  expect(failed).not.toHaveBeenCalled(); expect(writes).toEqual([]);
}, 20000);

it('different-stage cancel keeps original ticket and stamina, then can retry confirmation', async () => {
  const { state, host, failed, writes } = await boot('st-1-1', 'st-1-2');
  const before = JSON.stringify(state.getSave());
  sortie(host).click(); modalButton(host, '取消').click(); await settle();
  expect(JSON.stringify(state.getSave())).toBe(before); expect(writes).toEqual([]); expect(failed).not.toHaveBeenCalled();
  sortie(host).click(); expect(modalButton(host, '放棄並出發')).toBeDefined();
}, 20000);

it.each(['st-1-1', 'st-1-2'])('leaving unanswered prepare %s and triggering old modal callback never abandons or charges', async prepareId => {
  const { state, host, failed, writes } = await boot('st-1-1', prepareId);
  const before = JSON.stringify(state.getSave());
  sortie(host).click(); const staleAnswer = modalButton(host, prepareId === 'st-1-1' ? '重新出發' : '放棄並出發');
  router!.go('settings'); await vi.waitFor(() => expect(host.querySelector('[data-screen="settings"]')).not.toBeNull());
  await settle();
  expect(JSON.stringify(state.getSave())).toBe(before); expect(writes).toEqual([]); expect(failed).not.toHaveBeenCalled();
  staleAnswer.click(); await settle();
  expect(JSON.stringify(state.getSave())).toBe(before); expect(writes).toEqual([]); expect(failed).not.toHaveBeenCalled();
  expect(location.hash).toBe('#/settings');
}, 20000);

it('explicit same-stage restart abandons once and charges one entry despite repeated synchronous clicks', async () => {
  const { state, host, failed, gameData } = await boot('st-1-1');
  const stamina = state.getSave().stamina.current;
  const button = sortie(host); button.click(); button.click();
  expect(host.querySelectorAll('[role="dialog"]')).toHaveLength(1);
  const restart = modalButton(host, '重新出發'); restart.click(); restart.click();
  await vi.waitFor(() => expect(host.querySelector('[data-screen="battle"]')).not.toBeNull());
  expect(failed).toHaveBeenCalledTimes(1);
  expect(state.getSave().stamina.current).toBe(stamina - gameData.stages.find(s => s.id === 'st-1-1')!.stamina);
  expect(state.getSave().activeBattle?.stageId).toBe('st-1-1');
}, 20000);

it('failed insufficient-stamina departure releases pending guard and later valid retry starts normally', async () => {
  const { state, host, failed, writes, gameData } = await boot(undefined, 'st-1-1', 0);
  sortie(host).click(); await settle();
  expect(location.hash).toBe('#/prepare/st-1-1'); expect(state.getSave().activeBattle).toBeNull(); expect(writes).toEqual([]);
  const filled = structuredClone(state.getSave()); filled.stamina.current = 10; filled.stamina.lastUpdate = Date.now(); state.commit(filled);
  sortie(host).click(); await vi.waitFor(() => expect(host.querySelector('[data-screen="battle"]')).not.toBeNull());
  expect(state.getSave().stamina.current).toBe(10 - gameData.stages.find(s => s.id === 'st-1-1')!.stamina);
  expect(failed).not.toHaveBeenCalled();
}, 20000);
