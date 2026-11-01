// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { archetypesScreen } from '../src/ui/screens/archetypes';
import { gameData } from '../src/data/load';
import { createNewSave } from '../src/save/save';
import { commit, getSave, growth } from '../src/ui/state';
import { closeRouteScoped } from '../src/ui/route-scope';
const nav = { go: vi.fn(), replace: vi.fn(), back: vi.fn(), backTo: vi.fn() };
function render() {
  const el = archetypesScreen.render({ route: { name: 'archetypes', args: [], query: {} }, nav, onLeave() {} });
  document.body.replaceChildren(el); return el;
}
beforeEach(() => {
  vi.clearAllMocks(); closeRouteScoped();
  history.replaceState(null, '', '#/archetypes');
  const s = createNewSave(gameData.config, Date.now()); s.inventory.cards = []; s.progress.clearedStages = []; commit(s);
});
afterEach(() => { closeRouteScoped(); document.body.replaceChildren(); });
it('only fixed section gets a default-folded native guide, readable unowned and locked without extra trial CTA', () => {
  const before = JSON.stringify(getSave()); const root = render();
  const guides = root.querySelectorAll<HTMLDetailsElement>('[data-fixed-tactics]');
  expect(guides).toHaveLength(1);
  const guide = guides[0]; expect(guide.tagName).toBe('DETAILS'); expect(guide.open).toBe(false);
  expect(guide.closest('[data-archetype-section]')?.getAttribute('data-archetype-section')).toBe('fixed');
  expect(guide.querySelector('summary')?.textContent).toBe('這支借用隊怎麼打');
  expect([...guide.querySelectorAll('h4')].map(h => h.textContent)).toEqual(['借用隊員與分工', '每回合檢查', '護盾與傷害邊界']);
  const trial = gameData.stages.find(s => s.id === 'trial-fixed')!;
  const trialButtons = [...root.querySelectorAll('button')].filter(b => b.textContent === trial.name);
  expect(trialButtons).toHaveLength(1); expect(guide.contains(trialButtons[0])).toBe(false);
  guide.open = true; expect(JSON.stringify(getSave())).toBe(before);
});
it('renders current trial roster/levels and actual active descriptions, leader descriptions only on actual leader/helper', () => {
  const root = render(); const trial = gameData.stages.find(s => s.id === 'trial-fixed')!;
  const roster = [...trial.fixedTeam!.members.map((m, i) => ({ ...m, leader: i === 0, helper: false })), ...(trial.fixedTeam!.helper ? [{ ...trial.fixedTeam!.helper, leader: true, helper: true }] : [])];
  const rows = [...root.querySelectorAll<HTMLElement>('[data-tactics-card]')];
  expect(rows).toHaveLength(roster.length);
  roster.forEach((m, i) => {
    const c = growth.card(m.card)!; const row = rows[i];
    expect(row.dataset.tacticsCard).toBe(m.card); expect(row.textContent).toContain(c.name);
    expect(row.textContent).toContain(`Lv${m.level}`);
    expect(row.textContent).toContain(growth.skill(c.activeSkill!)!.description);
    expect(row.querySelectorAll('[data-tactics-leader]')).toHaveLength(m.leader ? 1 : 0);
    if (m.leader) expect(row.textContent).toContain(growth.leaderSkill(c.leaderSkill!)!.description);
  });
});
it('each accessible roster name opens existing read-only quickview, Escape returns focus/position without mutation', async () => {
  const root = render(); root.scrollTop = 777;
  const guide = root.querySelector<HTMLDetailsElement>('[data-fixed-tactics]')!;
  expect(guide).not.toBeNull(); guide.open = true;
  const before = JSON.stringify(getSave());
  const links = [...guide.querySelectorAll<HTMLButtonElement>('[data-tactics-card] button')];
  expect(links.length).toBeGreaterThan(0);
  for (const link of links) {
    expect(link.disabled).toBe(false); link.focus(); link.click();
    const modal = document.querySelector('[data-card-quickview]');
    expect(modal?.textContent).toContain(link.textContent);
    expect(document.querySelectorAll('[data-card-quickview]')).toHaveLength(1);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(document.querySelector('[data-card-quickview]')).toBeNull();
    await vi.waitFor(() => expect(history.state?.starfallCardPreview).toBeUndefined());
    expect(document.activeElement).toBe(link); expect(root.scrollTop).toBe(777); expect(guide.open).toBe(true);
  }
  expect(JSON.stringify(getSave())).toBe(before); expect(nav.go).not.toHaveBeenCalled();
});
it('missing original leader is safely omitted, never promotes a remaining member in display', () => {
  const original = [...gameData.cards];
  const firstId = gameData.stages.find(s => s.id === 'trial-fixed')!.fixedTeam!.members[0].card;
  try {
    gameData.cards.splice(0, gameData.cards.length, ...original.filter(c => c.id !== firstId));
    const root = render();
    const firstRow = root.querySelector('[data-tactics-card]')!;
    expect(firstRow.querySelector('span')?.textContent).toContain('隊員');
    expect(firstRow.querySelector('[data-tactics-leader]')).toBeNull();
  } finally { gameData.cards.splice(0, gameData.cards.length, ...original); }
});
it('duplicate leader card in an ordinary member slot is not labelled leader', () => {
  const trial = gameData.stages.find(s => s.id === 'trial-fixed')!;
  const original = trial.fixedTeam!.members;
  try {
    trial.fixedTeam!.members = [original[0], { ...original[0] }];
    const root = render(); const rows = [...root.querySelectorAll('[data-tactics-card]')];
    expect(rows[0].querySelector('span')?.textContent).toContain('隊長');
    expect(rows[1].querySelector('span')?.textContent).toContain('隊員');
    expect(rows[1].querySelector('[data-tactics-leader]')).toBeNull();
  } finally { trial.fixedTeam!.members = original; }
});
