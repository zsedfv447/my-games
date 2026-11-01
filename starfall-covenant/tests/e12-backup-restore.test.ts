// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import type { Router } from '../src/ui/router';
let router: Router | undefined;
const inactiveKeys = ['starfall.save', 'starfall.ui-prefs', 'starfall-covenant.orb-assistant.request.v1', '__starfall_probe__', 'debug.abyssWeak'].map(key => 'starfall.experiment.e00-e01.' + key);
afterEach(() => { router?.stop(); vi.restoreAllMocks(); vi.unstubAllGlobals(); document.body.replaceChildren(); });
const canvas = () => vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(new Proxy({}, { get: (_t, k) => k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => {} }) as CanvasRenderingContext2D);
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
function button(root: ParentNode, label: string) {
  const found = [...root.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent === label); expect(found, label).toBeDefined(); return found!;
}
const dialog = (host: HTMLElement, label: string) => host.querySelector<HTMLElement>(`[role="dialog"][aria-label="${label}"]:not(.closing)`)!;
async function setup() {
  vi.resetModules(); localStorage.clear(); sessionStorage.clear(); canvas();
  const backing = localStorage, trace: { op: string; key: string; value?: string }[] = [];
  inactiveKeys.forEach(k => backing.setItem(k, `inactive-experiment:${k}`));
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => { trace.push({ op: 'get', key }); return backing.getItem(key); },
    setItem: (key: string, value: string) => { trace.push({ op: 'set', key, value }); backing.setItem(key, value); },
    removeItem: (key: string) => { trace.push({ op: 'remove', key }); backing.removeItem(key); },
  });
  const state = await import('../src/ui/state'), { gameData } = await import('../src/data/load');
  const engine = await import('../src/battle/battle-state'), { createRng } = await import('../src/core/rng');
  const { beginActiveBattle, recordBattleSnapshot, dropSeed } = await import('../src/progression/active-battle');
  const { planDrops } = await import('../src/progression/drops'); const { oathModifiers } = await import('../src/progression/oaths');
  const s = structuredClone(state.getSave()); s.tutorial = { step: 'done', giftGiven: true }; s.progress.tutorialDone = true;
  s.progress.clearedStages = ['st-1-1']; s.progress.storySeen = Object.keys(gameData.story); s.player.coin = 18765; s.player.gems = 123;
  const stage = gameData.stages.find(x => x.id === 'st-1-1')!, seed = 2468, oaths = ['shortMove', 'noHelper'] as const;
  const members = s.inventory.cards.map(c => ({ cardId: c.cardId, level: 70, uid: c.uid }));
  const actual = engine.startBattle(stage, members, null, createRng(seed), gameData, undefined, oathModifiers(oaths));
  for (let i = 0; i < 3; i++) expect(actual.submitMove([]).ok).toBe(true);
  expect(actual.getState().phase).toBe('player');
  const drops = planDrops(stage, createRng(dropSeed({ seed })));
  state.commit(recordBattleSnapshot(beginActiveBattle(s, { stageId: stage.id, seed, members, helper: null, drops, oaths: [...oaths] }, Date.now()), actual.snapshot()));
  const sentinelCheck = () => inactiveKeys.forEach(k => expect(backing.getItem(k)).toBe(`inactive-experiment:${k}`));
  const writes = () => trace.filter(t => t.op !== 'get');
  return { state, trace, writes, sentinelCheck, dropSeed };
}
async function app(hash: string, reload = false) {
  router?.stop(); document.body.replaceChildren();
  if (reload) { vi.restoreAllMocks(); vi.resetModules(); canvas(); }
  history.replaceState(null, '', hash);
  const state = await import('../src/ui/state'), engine = await import('../src/battle/battle-state');
  const resumed = vi.spyOn(engine, 'resumeBattle');
  const { bus } = await import('../src/core/events'); const failed = vi.fn(), won = vi.fn(); bus.on('stageFailed', failed); bus.on('stageCleared', won);
  const { startApp } = await import('../src/ui/app'); const host = document.createElement('div'); document.body.append(host); router = startApp(host);
  return { state, host, resumed, failed, won };
}
async function settings(host: HTMLElement) { router!.go('settings'); await vi.waitFor(() => expect(host.querySelector('[data-screen="settings"]')).not.toBeNull()); }

it('real settings export textarea → cancel reset → confirmed reset → UI import → reload home resume restores whole battle without rewards/cost', async () => {
  const fixture = await setup(); let a = await app('#/battle/st-1-1');
  const before = structuredClone(a.state.getSave()); await settings(a.host); fixture.trace.length = 0;
  button(a.host.querySelector('[data-screen="settings"]')!, '匯出存檔碼').click();
  const exportDialog = dialog(a.host, '匯出存檔碼'), area = exportDialog.querySelector<HTMLTextAreaElement>('textarea')!;
  expect(area.readOnly).toBe(true); const code = area.value; expect(code).toMatch(/^[A-Za-z0-9+/=]+$/);
  button(exportDialog, '關閉').click(); await wait(160); // never rely on clipboard
  button(a.host.querySelector('[data-screen="settings"]')!, '重置').click(); button(dialog(a.host, '重置存檔'), '取消').click(); await wait(160);
  expect(a.state.getSave()).toEqual(before); expect(fixture.writes()).toEqual([]); fixture.sentinelCheck();
  button(a.host.querySelector('[data-screen="settings"]')!, '重置').click(); button(dialog(a.host, '重置存檔'), '重置').click();
  await vi.waitFor(() => expect(a.state.getSave().activeBattle).toBeNull());
  expect(a.state.getSave().tutorial?.step).toBe('battle'); fixture.sentinelCheck();
  await wait(160); button(a.host.querySelector('[data-screen="settings"]')!, '匯入存檔碼').click();
  const importDialog = dialog(a.host, '匯入存檔碼'); importDialog.querySelector<HTMLTextAreaElement>('textarea')!.value = code;
  button(importDialog, '匯入').click(); await vi.waitFor(() => expect(a.state.getSave().activeBattle).toEqual(before.activeBattle));
  expect(a.state.getSave()).toEqual(before); expect(a.failed).not.toHaveBeenCalled(); expect(a.won).not.toHaveBeenCalled(); fixture.sentinelCheck();
  const { SAVE_KEY } = await import('../src/save/save');
  expect(fixture.writes().map(t => [t.op, t.key])).toEqual([['remove', SAVE_KEY], ['set', SAVE_KEY], ['set', SAVE_KEY]]);
  const snapshots = fixture.writes().filter(t => t.op === 'set').map(t => JSON.parse(t.value!).data);
  expect(snapshots[0].activeBattle).toBeNull(); expect(snapshots[1]).toEqual(before);
  a = await app('#/home', true); fixture.trace.length = 0;
  button(dialog(a.host, '有未完成的戰鬥'), '繼續').click(); await vi.waitFor(() => expect(a.host.querySelector('[data-screen="battle"]')).not.toBeNull());
  const actual = a.resumed.mock.results.at(-1)!.value as ReturnType<typeof import('../src/battle/battle-state').resumeBattle>;
  expect(actual.snapshot()).toEqual(before.activeBattle!.snapshot); // HP/board/CD/RNG/modifiers entire snapshot
  expect(a.state.getSave()).toEqual(before); expect(a.state.getSave().activeBattle!.drops).toEqual(before.activeBattle!.drops);
  expect(a.state.getSave().activeBattle!.oaths).toEqual(['shortMove', 'noHelper']);
  expect(fixture.dropSeed(a.state.getSave().activeBattle!)).toBe(fixture.dropSeed(before.activeBattle!));
  expect(fixture.writes()).toEqual([]); expect(a.failed).not.toHaveBeenCalled(); expect(a.won).not.toHaveBeenCalled(); fixture.sentinelCheck();
  expect(fixture.trace.some(t => inactiveKeys.includes(t.key))).toBe(false);
}, 25000);

it.each([false, true])('reset route revocation preserves production and inactive experiment storage; answer-before-leave=%s', async answerFirst => {
  const fixture = await setup(); const a = await app('#/settings'); fixture.trace.length = 0;
  const before = structuredClone(a.state.getSave()); button(a.host.querySelector('[data-screen="settings"]')!, '重置').click();
  const old = button(dialog(a.host, '重置存檔'), '重置'); if (answerFirst) old.click();
  router!.replace('collection'); await wait(200);
  expect(old.isConnected).toBe(false); expect(a.state.getSave()).toEqual(before); expect(fixture.writes()).toEqual([]);
  old.dispatchEvent(new MouseEvent('click', { bubbles: true })); await wait(25);
  expect(a.state.getSave()).toEqual(before); expect(fixture.writes()).toEqual([]); fixture.sentinelCheck();
  expect(a.failed).not.toHaveBeenCalled(); expect(a.won).not.toHaveBeenCalled(); expect(location.hash).toBe('#/collection');
  expect(fixture.trace.some(t => inactiveKeys.includes(t.key))).toBe(false);
}, 20000);
