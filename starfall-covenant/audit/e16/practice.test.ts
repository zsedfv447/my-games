import { afterEach, expect, it, vi } from 'vitest';
import type { Router } from '../../src/ui/router';
let router: Router | undefined;
afterEach(() => { router?.stop(); router = undefined; vi.restoreAllMocks(); document.body.replaceChildren(); });
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const storageBytes = () => JSON.stringify(Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index)!).sort().map(key => [key, localStorage.getItem(key)]));
async function boot() {
  vi.resetModules(); localStorage.clear(); sessionStorage.clear(); history.replaceState(null, '', '#/adventure');
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(new Proxy({}, {
    get: (_target, key) => key === 'createLinearGradient' || key === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => {},
  }) as CanvasRenderingContext2D);
  // Drawing-only harness fix approved in E17: happy-dom synchronously re-enters image onload.
  // Engine, input, route, save and all safety assertions remain real and unchanged.
  const { BoardView } = await import('../../src/battle/view/board-view');
  vi.spyOn(BoardView.prototype as unknown as { draw(): void }, 'draw').mockImplementation(() => {});
  const state = await import('../../src/ui/state');
  const { gameData } = await import('../../src/data/load');
  const { startBattle } = await import('../../src/battle/battle-state');
  const { createRng } = await import('../../src/core/rng');
  const { beginActiveBattle, recordBattleSnapshot } = await import('../../src/progression/active-battle');
  const save = structuredClone(state.getSave());
  save.tutorial = { step: 'done', giftGiven: true }; save.progress.tutorialDone = true;
  // Returning-player fixture already read this legitimate one-time mode hint.
  save.hintsSeen = ['hiddenOrbs'];
  // Explicit legitimate returning-player checkpoint with a real official battle snapshot.
  // Practice entry must not replace or mutate this outstanding official ticket.
  const stage = gameData.stages.find(stage => stage.id === 'st-1-1')!;
  const members = [{ cardId: save.inventory.cards[0].cardId, level: 1, uid: save.inventory.cards[0].uid }];
  const battle = startBattle(stage, members, null, createRng(321), gameData);
  state.commit(recordBattleSnapshot(beginActiveBattle(save, { stageId: stage.id, seed: 321, members, helper: null, drops: { stageId: stage.id, drops: [] } }, Date.now()), battle.snapshot()));
  const { startApp } = await import('../../src/ui/app');
  const host = document.createElement('div'); document.body.append(host); router = startApp(host);
  const open = () => {
    const tile = [...host.querySelectorAll<HTMLButtonElement>('.adv-tile')].find(tile => tile.querySelector('strong')?.textContent === '練習場')!;
    expect(tile).toBeDefined(); tile.click();
    const dialog = host.querySelector<HTMLElement>('[aria-label="練習場"]:not(.closing)')!;
    expect(dialog).not.toBeNull();
    const mode = (name: string) => {
      const row = [...dialog.querySelectorAll<HTMLButtonElement>('.list-item')].find(row => row.querySelector('.name')?.textContent === name)!;
      expect(row).toBeDefined(); return row;
    };
    return { dialog, mode, cancel: [...dialog.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === '取消')! };
  };
  return { state, host, open };
}
for (const scenario of ['normal', 'cancel50', 'leave200', 'replacement'] as const) {
  it(`practice picker ${scenario}: navigation authority is separate from save/resources`, async () => {
    const { state, host, open } = await boot(); const old = open(); const oldNormal = old.mode('一般');
    const before = structuredClone(state.getSave()); const bytes = storageBytes();
    let expectedRoute = '#/adventure';
    let connected: boolean;
    if (scenario === 'normal') {
      oldNormal.click(); expectedRoute = '#/battle/practice/normal';
      await vi.waitFor(() => expect(host.querySelector('[data-screen="battle"]')).not.toBeNull());
    } else if (scenario === 'cancel50') {
      old.cancel.click(); await wait(50); expect(oldNormal.isConnected).toBe(true); oldNormal.click();
    } else if (scenario === 'leave200') {
      router!.replace('settings'); expectedRoute = '#/settings'; await wait(200);
      // Retained callback probe; connected status is reported, not assumed after future fixes.
      oldNormal.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    } else {
      old.cancel.click(); const fresh = open(); fresh.mode('隱藏珠').click(); expectedRoute = '#/battle/practice/darkOrbs';
      await vi.waitFor(() => expect(location.hash).toBe(expectedRoute));
      oldNormal.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }
    connected = oldNormal.isConnected;
    await wait(30);
    const after = state.getSave();
    console.info('E16_PRACTICE', JSON.stringify({ scenario, connectedAtProbe: connected, expectedRoute, actualRoute: location.hash, saveUnchanged: JSON.stringify(after) === JSON.stringify(before), bytesUnchanged: storageBytes() === bytes, coinDelta: after.player.coin - before.player.coin, gemsDelta: after.player.gems - before.player.gems, staminaDelta: after.stamina.current - before.stamina.current, seed: after.activeBattle?.seed }));
    expect.soft(after).toEqual(before);
    expect.soft(after.activeBattle).toEqual(before.activeBattle);
    expect.soft(storageBytes()).toBe(bytes);
    expect.soft(location.hash).toBe(expectedRoute);
    if (scenario === 'normal') expect(host.querySelector('.battle')).not.toBeNull();
  });
}
