// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import type { Router } from '../src/ui/router';
let router: Router | undefined;
const writes: { key: string; value: string }[] = [];
afterEach(() => { router?.stop(); vi.restoreAllMocks(); vi.unstubAllGlobals(); document.body.replaceChildren(); });
const canvas = () => vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(new Proxy({}, { get: (_t, key) => key === 'createLinearGradient' || key === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => {} }) as CanvasRenderingContext2D);
const button = (root: ParentNode, text: string) => {
  const found = [...root.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent === text);
  expect(found, text).toBeDefined(); return found!;
};
async function fixture() {
  vi.resetModules(); localStorage.clear(); sessionStorage.clear(); canvas();
  const backing = localStorage;
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => backing.getItem(key),
    setItem: (key: string, value: string) => { writes.push({ key, value }); backing.setItem(key, value); },
    removeItem: (key: string) => backing.removeItem(key),
  });
  const state = await import('../src/ui/state');
  const { gameData } = await import('../src/data/load');
  const engine = await import('../src/battle/battle-state');
  const { createRng } = await import('../src/core/rng');
  const { beginActiveBattle, recordBattleSnapshot, dropSeed } = await import('../src/progression/active-battle');
  const { planDrops } = await import('../src/progression/drops');
  const { oathModifiers } = await import('../src/progression/oaths');
  const fresh = structuredClone(state.getSave());
  fresh.progress.tutorialDone = true; fresh.tutorial = { step: 'done', giftGiven: true };
  fresh.progress.clearedStages = ['st-1-1']; fresh.progress.storySeen = Object.keys(gameData.story);
  const members = fresh.inventory.cards.map(c => ({ cardId: c.cardId, level: 70, uid: c.uid, skillLevel: 1 }));
  const stage = gameData.stages.find(s => s.id === 'st-1-1')!;
  const seed = 9182, oaths = ['shortMove', 'noHelper'] as const;
  const actual = engine.startBattle(stage, members, null, createRng(seed), gameData, undefined, oathModifiers(oaths));
  // Legal isolated mid-battle fixture: real turns, no fabricated snapshot edits.
  for (let i = 0; i < 20 && actual.getState().phase === 'player' && (actual.getState().team[0].skillCooldown ?? 0) > 0; i++) expect(actual.submitMove([]).ok).toBe(true);
  expect(actual.getState().phase).toBe('player'); expect(actual.getState().team[0].skillCooldown).toBe(0);
  expect(actual.getState().board.cells.some(c => c?.type === 'wood')).toBe(true);
  const drops = planDrops(stage, createRng(dropSeed({ seed })));
  const ticket = beginActiveBattle(fresh, { stageId: stage.id, seed, members, helper: null, drops, oaths: [...oaths] }, Date.now());
  state.commit(recordBattleSnapshot(ticket, actual.snapshot()));
  state.updateSettings({ battleFx: false, lowFx: true });
  writes.length = 0;
  return { state, dropSeed };
}
async function app(reload = false) {
  router?.stop(); document.body.replaceChildren();
  if (reload) { vi.restoreAllMocks(); vi.resetModules(); canvas(); }
  history.replaceState(null, '', '#/home');
  const state = await import('../src/ui/state');
  const engine = await import('../src/battle/battle-state');
  const resume = vi.spyOn(engine, 'resumeBattle');
  const { bus } = await import('../src/core/events');
  const failed = vi.fn(), cleared = vi.fn(); bus.on('stageFailed', failed); bus.on('stageCleared', cleared);
  const { startApp } = await import('../src/ui/app');
  const host = document.createElement('div'); document.body.append(host); router = startApp(host);
  const latest = () => resume.mock.results.at(-1)!.value as ReturnType<typeof engine.resumeBattle>;
  return { state, host, latest, failed, cleared };
}
const dialog = (host: HTMLElement) => host.querySelector<HTMLElement>('[role="dialog"][aria-label="有未完成的戰鬥"]')!;
const saveBytes = async () => localStorage.getItem((await import('../src/save/save')).SAVE_KEY);
const rewards = (save: ReturnType<typeof import('../src/ui/state').getSave>) => JSON.stringify({ player: save.player, inventory: save.inventory, collection: save.collection, records: save.records, progress: save.progress, quests: save.quests, oaths: save.oaths });

it('unanswered home prompt → route departure → module reload → resume → real skill persisted → reload preserves full battle and rewards', async () => {
  const { dropSeed } = await fixture();
  let a = await app();
  const { SAVE_KEY } = await import('../src/save/save');
  const saveWrites = () => writes.filter(w => w.key === SAVE_KEY);
  const original = structuredClone(a.state.getSave()), originalBytes = await saveBytes();
  expect(dialog(a.host)).not.toBeNull();
  // Home has Continue / Abandon, not a Cancel action. Leaving without answering is cancellation.
  const oldAbandon = button(dialog(a.host), '放棄');
  router!.go('settings'); await vi.waitFor(() => expect(a.host.querySelector('[data-screen="settings"]')).not.toBeNull());
  await new Promise(r => setTimeout(r, 160)); expect(oldAbandon.isConnected).toBe(false);
  oldAbandon.click(); await Promise.resolve();
  expect(a.state.getSave()).toEqual(original); expect(await saveBytes()).toBe(originalBytes); expect(a.failed).not.toHaveBeenCalled(); expect(saveWrites()).toHaveLength(0);
  a = await app(true);
  expect(a.state.getSave().activeBattle).toEqual(original.activeBattle); expect(dialog(a.host)).not.toBeNull();
  button(dialog(a.host), '繼續').click();
  await vi.waitFor(() => expect(a.host.querySelector('[data-screen="battle"]')).not.toBeNull());
  expect(a.latest().snapshot()).toEqual(original.activeBattle!.snapshot);
  expect(a.state.getSave().stamina).toEqual(original.stamina);
  expect(a.state.getSave().activeBattle!.drops).toEqual(original.activeBattle!.drops);
  expect(dropSeed(a.state.getSave().activeBattle!)).toBe(dropSeed(original.activeBattle!));
  expect(a.state.getSave().activeBattle!.oaths).toEqual(['shortMove', 'noHelper']);
  expect(await saveBytes()).toBe(originalBytes);
  const thumb = a.host.querySelector<HTMLButtonElement>('.team-row .card-thumb')!;
  thumb.click();
  const skillDialog = [...a.host.querySelectorAll<HTMLElement>('[role="dialog"]')].find(d => d.textContent?.includes('可以施放'))!;
  expect(skillDialog).toBeDefined(); button(skillDialog, '取消').click();
  expect(a.latest().snapshot()).toEqual(original.activeBattle!.snapshot); expect(await saveBytes()).toBe(originalBytes);
  await new Promise(r => setTimeout(r, 160)); thumb.click();
  const nextDialog = [...a.host.querySelectorAll<HTMLElement>('[role="dialog"]')].find(d => d.textContent?.includes('可以施放'))!;
  button(nextDialog, '施放').click();
  const acted = structuredClone(a.state.getSave());
  expect(acted.activeBattle!.snapshot).toEqual(a.latest().snapshot());
  expect(acted.activeBattle!.snapshot!.state.board).not.toEqual(original.activeBattle!.snapshot!.state.board);
  expect(acted.activeBattle!.snapshot!.state.team[0].skillCooldown).toBeGreaterThan(0);
  expect(acted.activeBattle!.snapshot!.state.hp).toBe(original.activeBattle!.snapshot!.state.hp);
  expect(acted.activeBattle!.snapshot!.rng).toBe(original.activeBattle!.snapshot!.rng); // deterministic conversion consumes no RNG
  expect(acted.stamina).toEqual(original.stamina); expect(rewards(acted)).toBe(rewards(original));
  expect(acted.activeBattle!.drops).toEqual(original.activeBattle!.drops); expect(acted.activeBattle!.oaths).toEqual(original.activeBattle!.oaths);
  expect(a.failed).not.toHaveBeenCalled(); expect(a.cleared).not.toHaveBeenCalled();
  const actedBytes = await saveBytes(); expect(actedBytes).not.toBe(originalBytes);
  expect(saveWrites()).toHaveLength(1); expect(saveWrites()[0].value).toBe(actedBytes);
  a = await app(true);
  expect(a.state.getSave().activeBattle).toEqual(acted.activeBattle);
  button(dialog(a.host), '繼續').click(); await vi.waitFor(() => expect(a.host.querySelector('[data-screen="battle"]')).not.toBeNull());
  expect(a.latest().snapshot()).toEqual(acted.activeBattle!.snapshot);
  expect(a.state.getSave().stamina).toEqual(original.stamina); expect(rewards(a.state.getSave())).toBe(rewards(original));
  expect(dropSeed(a.state.getSave().activeBattle!)).toBe(dropSeed(original.activeBattle!));
  expect(await saveBytes()).toBe(actedBytes); expect(saveWrites()).toHaveLength(1); expect(a.failed).not.toHaveBeenCalled(); expect(a.cleared).not.toHaveBeenCalled();
}, 30000);
