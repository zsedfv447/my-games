// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import type { Router } from '../src/ui/router';
let router: Router | undefined;
afterEach(() => { router?.stop(); router = undefined; vi.restoreAllMocks(); document.body.replaceChildren(); });
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function bootWonFixture(refreshSnapshotBeforeWin = false) {
  vi.resetModules(); localStorage.clear(); history.replaceState(null, '', '#/battle/st-1-1');
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(new Proxy({}, {
    get: (_target, key) => key === 'createLinearGradient' || key === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => {},
  }) as CanvasRenderingContext2D);
  const state = await import('../src/ui/state');
  const { gameData } = await import('../src/data/load');
  const { startBattle } = await import('../src/battle/battle-state');
  const { createRng } = await import('../src/core/rng');
  const active = await import('../src/progression/active-battle');
  const { expForLevel } = await import('../src/growth/level');
  const stage = gameData.stages.find(s => s.id === 'st-1-1')!;
  const save = structuredClone(state.getSave());
  save.tutorial = { step: 'done', giftGiven: true }; save.progress.tutorialDone = true;
  // Explicit legal existing-card fixture; not claimed as naturally acquired or manually played.
  Object.assign(save.inventory.cards[0], { cardId: 'c305', level: 70, exp: expForLevel(state.growth.card('c305')!, 70, state.growth.rules), skillLevel: 6 });
  state.commit(save); state.updateSettings({ lowFx: true, battleFx: false, battleSpeed: 2 });
  const members = [{ cardId: 'c305', level: 70, skillLevel: 6, uid: save.inventory.cards[0].uid }];
  const engine = startBattle(stage, members, null, createRng(99), gameData);
  for (let i = 0; i < 300 && engine.getState().phase === 'player'; i++) engine.submitMove([]);
  expect(engine.getState().phase).toBe('lost'); expect(engine.continueBattle().ok).toBe(true);
  expect(engine.useSkill(0).ok).toBe(true);
  for (let i = 0; i < 30 && engine.getState().phase === 'player' && engine.getState().team[0].skillCooldown !== 0; i++) engine.submitMove([]);
  expect(engine.useSkill(0).ok).toBe(true); expect(engine.getState().phase).toBe('won');
  const ticket = active.beginActiveBattle(state.getSave(), { stageId: stage.id, seed: 99, members, helper: null, drops: { stageId: stage.id, drops: [] } }, Date.now());
  state.commit(active.recordBattleSnapshot(ticket, engine.snapshot()));
  const { bus } = await import('../src/core/events'); const cleared: unknown[] = [];
  bus.on('stageCleared', event => cleared.push(event));
  const { startApp } = await import('../src/ui/app');
  const coinBefore = state.getSave().player.coin;
  const host = document.createElement('div'); document.body.append(host); router = startApp(host);
  if (refreshSnapshotBeforeWin) {
    // Constructor has captured this session; normal persistence replaces its object, not identity.
    const previous = state.getSave().activeBattle;
    state.commit(active.recordBattleSnapshot(state.getSave(), engine.snapshot()));
    expect(state.getSave().activeBattle).not.toBe(previous);
    expect(state.getSave().activeBattle).toEqual(previous);
  }
  await vi.waitFor(() => expect(host.querySelector('.finisher-text')).not.toBeNull());
  return { state, host, stage, active, cleared, coinBefore };
}

it('leaving a real recovered victory during finisher grants nothing; the won ticket remains recoverable', async () => {
  const { state, cleared } = await bootWonFixture();
  const before = JSON.stringify(state.getSave());
  router!.replace('settings'); await wait(850);
  expect(JSON.stringify(state.getSave())).toBe(before);
  expect(cleared).toEqual([]);
  expect(state.getSave().activeBattle?.snapshot?.state.phase).toBe('won');
}, 20000);

it('a same-stage newer ticket installed during finisher cannot receive old rewards or be cleared', async () => {
  const { state, active, stage, cleared } = await bootWonFixture();
  const old = state.getSave().activeBattle!;
  state.commit(active.beginActiveBattle(state.getSave(), { stageId: stage.id, seed: old.seed + 1, members: old.members, helper: old.helper, drops: old.drops }, old.startedAt + 1));
  const replacement = JSON.stringify(state.getSave());
  await wait(850);
  expect(JSON.stringify(state.getSave())).toBe(replacement);
  expect(cleared).toEqual([]);
}, 20000);

it('same-session snapshot persistence after view creation still permits exactly one settlement', async () => {
  const { state, stage, cleared, coinBefore } = await bootWonFixture(true);
  await vi.waitFor(() => expect(state.getSave().activeBattle).toBeNull(), { timeout: 5000 });
  expect(state.getSave().player.coin).toBe(coinBefore + stage.rewards.coin);
  expect(cleared).toHaveLength(1);
}, 20000);
