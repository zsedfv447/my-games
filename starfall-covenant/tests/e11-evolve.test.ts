// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import type { Router } from '../src/ui/router';
let router: Router | undefined;
afterEach(() => { router?.stop(); vi.restoreAllMocks(); document.body.replaceChildren(); });
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const force = (button: HTMLButtonElement) => button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
const named = (root: ParentNode, text: string) => [...root.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent === text)!;
async function boot(coin = 100000, level = 90) {
  vi.resetModules(); localStorage.clear(); sessionStorage.clear(); history.replaceState(null, '', '#/evolve/e11-evo');
  const state = await import('../src/ui/state'); const { expForLevel } = await import('../src/growth/level');
  const save = structuredClone(state.getSave()); save.tutorial = { step: 'done', giftGiven: true }; save.progress.tutorialDone = true; save.player.coin = coin;
  const base = save.inventory.cards[0];
  save.inventory.cards.push({ ...base, uid: 'e11-evo', cardId: 'c102', level, exp: expForLevel(state.growth.card('c102')!, level, state.growth.rules), locked: false });
  for (let i = 0; i < 3; i++) save.inventory.cards.push({ ...base, uid: `e11-mat${i}`, cardId: 'c916', locked: false });
  state.commit(save);
  const { startApp } = await import('../src/ui/app'); const host = document.createElement('div'); document.body.append(host); router = startApp(host);
  const commits = vi.spyOn(state, 'commit');
  const action = host.querySelector<HTMLButtonElement>('.growth-action button')!;
  const open = () => { action.click(); return host.querySelector<HTMLElement>('[aria-label="確認進化"]:not(.closing)')!; };
  return { state, host, commits, action, open };
}
it('leaving revokes pending evolution, stale confirmation and stale entry', async () => {
  const f = await boot(); const before = JSON.stringify(f.state.getSave()); const old = named(f.open(), '進化');
  router!.replace('settings'); await wait(200); expect(old.isConnected).toBe(false); force(old); force(f.action); await wait(10);
  expect(JSON.stringify(f.state.getSave())).toBe(before); expect(f.commits).not.toHaveBeenCalled(); expect(location.hash).toBe('#/settings');
  expect(f.host.querySelector('[role="dialog"]:not(.closing)')).toBeNull();
});
it('approve then leave in same task cancels transaction before await continuation', async () => {
  const f = await boot(); const before = JSON.stringify(f.state.getSave()); named(f.open(), '進化').click(); router!.replace('settings'); await wait(10);
  expect(JSON.stringify(f.state.getSave())).toBe(before); expect(f.commits).not.toHaveBeenCalled(); expect(location.hash).toBe('#/settings');
});
it('cancel and retry retain busy guard; valid evolution commits once then celebrates on card route', async () => {
  const f = await boot(); const before = structuredClone(f.state.getSave()); const dlg = f.open(); force(f.action);
  expect(f.host.querySelectorAll('[aria-label="確認進化"]:not(.closing)')).toHaveLength(1);
  const old = named(dlg, '進化'); named(dlg, '取消').click(); await wait(50); force(old); await wait(1); expect(f.state.getSave()).toEqual(before);
  const fresh = named(f.open(), '進化'); fresh.click(); force(fresh); await wait(20);
  const after = f.state.getSave(); expect(after.player.coin).toBe(50000);
  expect(after.inventory.cards.find(c => c.uid === 'e11-evo')).toMatchObject({ cardId: 'c103', level: 1 });
  expect(after.inventory.cards.filter(c => c.uid.startsWith('e11-mat'))).toHaveLength(0);
  expect(after.inventory.cards.filter(c => !c.uid.startsWith('e11-'))).toEqual(before.inventory.cards.filter(c => !c.uid.startsWith('e11-')));
  expect(location.hash).toBe('#/card/e11-evo'); expect(f.host.textContent).toContain('進化成功！');
  const success = JSON.stringify(after); force(old); force(fresh); await wait(1); expect(JSON.stringify(f.state.getSave())).toBe(success);
});
it.each(['lock', 'coin', 'level'] as const)('latest save %s change rejects previously available evolution', async change => {
  const f = await boot(); const approve = named(f.open(), '進化'); const changed = structuredClone(f.state.getSave());
  if (change === 'lock') changed.inventory.cards.find(c => c.uid === 'e11-mat0')!.locked = true;
  if (change === 'coin') changed.player.coin = 49999;
  if (change === 'level') changed.inventory.cards.find(c => c.uid === 'e11-evo')!.level = 1;
  f.state.commit(changed); f.commits.mockClear(); const before = JSON.stringify(f.state.getSave()); approve.click(); await wait(1);
  expect(JSON.stringify(f.state.getSave())).toBe(before); expect(f.commits).not.toHaveBeenCalled(); expect(location.hash).toBe('#/evolve/e11-evo');
});
it.each([[49999,90], [100000,1]])('initial insufficient coin/level disables entry (%i/%i)', async (coin, level) => {
  const f = await boot(coin, level); expect(f.action.disabled).toBe(true); const before = JSON.stringify(f.state.getSave()); f.action.click(); await wait(1);
  expect(f.host.querySelector('[aria-label="確認進化"]')).toBeNull(); expect(JSON.stringify(f.state.getSave())).toBe(before);
});
