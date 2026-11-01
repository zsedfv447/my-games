// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import type { Router } from '../src/ui/router';
let router: Router | undefined;
afterEach(() => { router?.stop(); router = undefined; vi.restoreAllMocks(); document.body.replaceChildren(); });
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
function action(host: HTMLElement, text: string): HTMLButtonElement {
  const buttons = [...host.querySelectorAll<HTMLButtonElement>('[role="dialog"]:not(.closing) button')];
  const found = buttons.find(button => button.textContent === text);
  if (!found) throw new Error(`Missing action ${text}`);
  return found;
}
async function bootReady() {
  vi.resetModules();
  localStorage.clear();
  history.replaceState(null, '', '#/battle/st-1-1');
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(new Proxy({}, {
    get: (_target, key) => key === 'createLinearGradient' || key === 'createRadialGradient'
      ? () => ({ addColorStop() {} }) : () => {},
  }) as CanvasRenderingContext2D);
  const state = await import('../src/ui/state');
  const { gameData } = await import('../src/data/load');
  const { startBattle } = await import('../src/battle/battle-state');
  const { createRng } = await import('../src/core/rng');
  const active = await import('../src/progression/active-battle');
  // Explicit legal saved-player fixture: real loss/continue makes the starter skill ready.
  const save = structuredClone(state.getSave());
  save.tutorial = { step: 'done', giftGiven: true };
  save.progress.tutorialDone = true;
  state.commit(save);
  state.updateSettings({ lowFx: true, battleFx: false, battleSpeed: 2 });
  const card = save.inventory.cards[0];
  const stage = gameData.stages.find(stage => stage.id === 'st-1-1')!;
  const members = [{ cardId: card.cardId, level: card.level, uid: card.uid }];
  const engine = startBattle(stage, members, null, createRng(123), gameData);
  for (let i = 0; i < 100 && engine.getState().phase === 'player'; i++) engine.submitMove([]);
  expect(engine.getState().phase).toBe('lost');
  expect(engine.continueBattle().ok).toBe(true);
  expect(engine.getState().team[0].skillCooldown).toBe(0);
  const armed = active.beginActiveBattle(state.getSave(), {
    stageId: stage.id, seed: 123, members, helper: null, drops: { stageId: stage.id, drops: [] },
  }, Date.now());
  state.commit(active.recordBattleSnapshot(armed, engine.snapshot()));
  const { startApp } = await import('../src/ui/app');
  const host = document.createElement('div');
  document.body.append(host);
  router = startApp(host);
  await vi.waitFor(() => expect(host.querySelector('.team-row .card-thumb')).not.toBeNull());
  return { state, host };
}

it('cancel revokes a still-connected fading skill button', async () => {
 const { state, host } = await bootReady();
 host.querySelector<HTMLButtonElement>('.team-row .card-thumb')!.click();
 const cast = action(host, '施放'); const before = JSON.stringify(state.getSave());
 action(host, '取消').click(); expect(cast.isConnected).toBe(true);
 cast.dispatchEvent(new MouseEvent('click', { bubbles: true }));
 await wait(30);
 expect(JSON.stringify(state.getSave())).toBe(before);
});

it('reopening the skill dialog revokes its previous button without revoking the new one', async () => {
 const { state, host } = await bootReady();
 const card = host.querySelector<HTMLButtonElement>('.team-row .card-thumb')!;
 card.click(); const oldCast = action(host, '施放');
 card.click(); const newCast = action(host, '施放');
 expect(newCast).not.toBe(oldCast);
 const before = JSON.stringify(state.getSave());
 oldCast.dispatchEvent(new MouseEvent('click', { bubbles: true }));
 expect(JSON.stringify(state.getSave())).toBe(before);
 newCast.click(); newCast.click();
 expect(state.getSave().activeBattle?.snapshot?.state.team[0].skillCooldown).toBe(8);
});
