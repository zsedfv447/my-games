// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { teamScreen } from '../src/ui/screens/team';
import { gameData } from '../src/data/load';
import { createNewSave } from '../src/save/save';
import { commit, getSave, growth } from '../src/ui/state';
import { analyzeTeam } from '../src/growth';
import { closeRouteScoped } from '../src/ui/route-scope';

const nav = { go: vi.fn(), replace: vi.fn(), back: vi.fn(), backTo: vi.fn() };
function setup(ids: string[]) {
  const s = createNewSave(gameData.config, Date.now());
  s.player.level = 100;
  s.inventory.cards = ids.map((cardId, i) => ({ uid: `e01-${i}`, cardId, level: 1, exp: 0, skillLevel: 1, awakened: 0, locked: false, limitBreak: 0, obtainedAt: 1 }));
  s.teams[0].members = [...s.inventory.cards.map(c => c.uid), ...Array(Math.max(0, 5 - ids.length)).fill(null)];
  commit(s);
}
function render() {
  const el = teamScreen.render({ route: { name: 'team', args: [], query: {} }, nav, onLeave() {} });
  document.body.replaceChildren(el); return el;
}
const clickText = (root: ParentNode, text: string) => [...root.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent === text)!.click();
afterEach(() => { closeRouteScoped(); document.body.replaceChildren(); });
it('c811 + c710: tag-only mismatch is neutral, score is labelled reference not multiplier, and browsing is pure', () => {
  setup(['c811', 'c710']);
  const before = JSON.stringify(getSave());
  const report = analyzeTeam(getSave(), growth, getSave().teams[0].members);
  expect(report.members[1].fits).toBe(false);
  const root = render();
  expect(root.querySelectorAll('.team-slots .misfit')).toHaveLength(0);
  expect(root.textContent).toContain(`流派參考契合 ${Math.round(report.completion * 100)}%`);
  expect(root.textContent).toContain('僅供編隊參考，不代表實際戰鬥倍率；加成以隊長技條件為準');
  expect(root.textContent).toContain('未列入此流派標籤，可自由混搭');
  expect(JSON.stringify(getSave())).toBe(before);
});
it('real non-beast mismatch remains warning, while c710 conditional leader description is untouched', () => {
  const nonbeast = gameData.cards.find(c => c.race !== 'beast' && c.race !== 'material')!;
  setup(['c811', nonbeast.id]); const root = render();
  expect(root.querySelectorAll('.team-slots .misfit')).toHaveLength(1);
  setup(['c710', 'c811']); const next = render();
  expect(next.textContent).toContain(growth.leaderSkill('l710')!.description);
});
it('c815 race report retains fitting beast despite other archetype, and refresh/route re-render uses latest leader', () => {
  setup(['c815', 'c710']); const before = analyzeTeam(getSave(), growth, getSave().teams[0].members);
  expect(before.primary).toBe('race'); expect(before.members[1].fits).toBe(true);
  let root = render(); expect(root.querySelectorAll('.team-slots .misfit')).toHaveLength(0);
  expect(root.textContent).toContain('流派參考契合 100%');
  const s = getSave(); s.teams[1].members = ['e01-1', null, null, null, null]; commit(s);
  clickText(root, '隊伍 2');
  expect(root.textContent).toContain(growth.leaderSkill('l710')!.description);
  root = render(); expect(root.textContent).toContain(growth.leaderSkill('l710')!.description);
});
it('removing member redraws reference score while the original picker and swap preview remain', () => {
  setup(['c811', 'c710']); const root = render();
  root.querySelectorAll<HTMLButtonElement>('.team-slots .card-thumb')[1].click();
  const dialog = document.querySelector('[role="dialog"]')!;
  expect(dialog.textContent).toContain('點一張卡查看換上後的變化');
  clickText(dialog, '移出隊伍');
  expect(root.textContent).toContain('流派參考契合 100%');
  expect(getSave().teams[0].members[1]).toBeNull();
});
it('replacing leader through original picker updates warning and preserves swap comparison', () => {
  setup(['c811', 'c710', 'c815']);
  const s = getSave(); s.teams[0].members[2] = null; commit(s);
  const root = render();
  expect(root.textContent).toContain('流派參考契合 50%');
  root.querySelector<HTMLButtonElement>('.team-slots .card-thumb')!.click();
  const dialog = document.querySelector('[role="dialog"]')!;
  const whiteTiger = [...dialog.querySelectorAll<HTMLButtonElement>('.card-thumb')].find(b => b.getAttribute('aria-label') === growth.card('c815')!.name)!;
  whiteTiger.click();
  expect(dialog.querySelector('.swap-preview')?.textContent).toContain('總生命');
  clickText(dialog, '換上');
  expect(root.textContent).toContain('流派參考契合 100%');
  expect(root.querySelectorAll('.team-slots .misfit')).toHaveLength(0);
  expect(getSave().teams[0].members[0]).toBe('e01-2');
});
