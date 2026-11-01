// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
afterEach(() => { vi.restoreAllMocks(); document.body.replaceChildren(); });
async function render(leaveImmediately = false, preselected = false) {
  vi.resetModules(); localStorage.clear();
  const state = await import('../src/ui/state');
  const s = structuredClone(state.getSave()); s.collection.seen = []; state.commit(s);
  if (preselected) {
    const { gameData } = await import('../src/data/load'); const card = gameData.cards.find(c => c.id === 'c710')!;
    (await import('../src/ui/sortie')).chooseHelper('st-1-1', { npcId: 'support:c710', card, input: { cardId: card.id, level: 10, skillLevel: 1 } });
  }
  const { helperScreen } = await import('../src/ui/screens/helper');
  const nav = { go: vi.fn(), replace: vi.fn(), back: vi.fn(), backTo: vi.fn() }; const leave: (() => void)[] = [];
  const before = structuredClone(state.getSave());
  const root = helperScreen.render({ route: { name: 'helper', args: ['st-1-1'], query: {} }, nav, onLeave: fn => leave.push(fn) });
  document.body.append(root);
  if (leaveImmediately) leave.forEach(fn => fn());
  return { root, state, nav, before, leave: () => leave.forEach(fn => fn()) };
}
const tick = () => Promise.resolve();
const rows = (root: HTMLElement) => [...root.querySelectorAll<HTMLButtonElement>('[data-support-id]')];
const search = (root: HTMLElement, value: string) => { const input = root.querySelector<HTMLInputElement>('[aria-label="搜尋常駐助戰名稱或卡號"]')!; expect(input).not.toBeNull(); input.value = value; input.dispatchEvent(new Event('input', { bubbles: true })); return input; };
it('first12 only plus actual NPC rows become seen, never ownership or all91; focused search remains mounted', async () => {
  const f = await render(); expect(rows(f.root)).toHaveLength(12); await tick();
  const { markSeen } = await import('../src/growth');
  const { rosterFor } = await import('../src/ui/screens/helper'); const { gameData } = await import('../src/data/load');
  const npcIds = rosterFor(gameData.stages.find(s => s.id === 'st-1-1')!).map(o => o.card.id);
  const expected = markSeen(f.before, [...rows(f.root).map(r => r.dataset.supportId!.replace('support:', '')), ...npcIds]);
  expect(f.state.getSave()).toEqual(expected);
  const input = search(f.root, 'C710'); input.focus(); await tick();
  expect(rows(f.root).map(r => r.dataset.supportId)).toEqual(['support:c710']);
  expect(f.root.querySelector('[aria-label="搜尋常駐助戰名稱或卡號"]')).toBe(input); expect(document.activeElement).toBe(input);
  expect(f.state.getSave()).toEqual(markSeen(expected, ['c710']));
  expect(f.root.textContent).toContain('借用不代表持有'); expect(f.root.textContent).toContain('本關推薦');
});
it('show all exposes exact91 without choosing or granting; selected summary survives search', async () => {
  const f = await render(); await tick();
  const beforeAll = structuredClone(f.state.getSave());
  const show = [...f.root.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent === '顯示全部')!; expect(show).toBeDefined(); show.click();
  expect(rows(f.root)).toHaveLength(91); expect(new Set(rows(f.root).map(r => r.dataset.supportId)).size).toBe(91); await tick();
  const { markSeen } = await import('../src/growth'); const { rosterFor } = await import('../src/ui/screens/helper'); const { gameData } = await import('../src/data/load');
  expect(f.state.getSave()).toEqual(markSeen(beforeAll, [...rows(f.root).map(r => r.dataset.supportId!.replace('support:', '')), ...rosterFor(gameData.stages.find(s => s.id === 'st-1-1')!).map(o => o.card.id)]));
  expect(f.nav.replace).not.toHaveBeenCalled(); expect(f.state.getSave().inventory).toEqual(f.before.inventory);
  const { chosenHelper } = await import('../src/ui/sortie'); expect(chosenHelper('st-1-1')).toBeUndefined();
  expect(f.root.querySelector('[data-current-helper]')).not.toBeNull();
});
it('replaced rows and departed screen cannot choose or navigate, including queued seen; live selection consumes once', async () => {
  const f = await render(); const old = rows(f.root)[0]; expect(old).toBeDefined();
  search(f.root, 'c710'); old.click(); expect(f.nav.replace).not.toHaveBeenCalled();
  const live = rows(f.root)[0]; live.click(); live.click(); expect(f.nav.replace).toHaveBeenCalledTimes(1);
  const { chosenHelper } = await import('../src/ui/sortie'); expect(chosenHelper('st-1-1')?.npcId).toBe('support:c710');
  f.leave(); const save = structuredClone(f.state.getSave()); await tick(); expect(f.state.getSave()).toEqual(save);
  live.click(); expect(f.nav.replace).toHaveBeenCalledTimes(1);
});
it('leaving before initial seen microtask blocks it and NPC old clicks', async () => {
  const f = await render(true); await tick(); expect(f.state.getSave()).toEqual(f.before);
  f.root.querySelector<HTMLButtonElement>('.helper-row')!.click();
  expect(f.nav.replace).not.toHaveBeenCalled(); expect(f.nav.back).not.toHaveBeenCalled();
});
it('a newly restricted stage rejects an already-rendered support without altering selection', async () => {
  const f = await render(); search(f.root, 'c710');
  const row = rows(f.root)[0]; expect(row).toBeDefined();
  const { gameData } = await import('../src/data/load'); const stage = gameData.stages.find(s => s.id === 'st-1-1')!;
  const original = stage.teamRule;
  try {
    stage.teamRule = { noHelper: true }; row.click();
    expect(f.nav.replace).not.toHaveBeenCalled();
    expect((await import('../src/ui/sortie')).chosenHelper(stage.id)).toBeUndefined();
  } finally { stage.teamRule = original; f.leave(); }
});

it('filtering away the selected support keeps its summary and choice; clear restores first12', async () => {
  const f = await render(false, true);
  search(f.root, 'zz-no-card'); await tick(); expect(rows(f.root)).toHaveLength(0);
  expect(f.root.querySelector('[data-current-helper]')!.textContent).toContain('雙角羚・歐菈');
  expect((await import('../src/ui/sortie')).chosenHelper('st-1-1')?.npcId).toBe('support:c710');
  [...f.root.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent === '清除搜尋')!.click();
  expect(rows(f.root)).toHaveLength(12); expect(f.nav.replace).not.toHaveBeenCalled();
});
