// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { archetypesScreen } from '../src/ui/screens/archetypes';
import { gameData } from '../src/data/load';
import { getSave } from '../src/ui/state';
import { closeRouteScoped } from '../src/ui/route-scope';
const nav = { go: vi.fn(), replace: vi.fn(), back: vi.fn(), backTo: vi.fn() };
afterEach(() => { closeRouteScoped(); document.body.replaceChildren(); });
const render = () => archetypesScreen.render({ route: { name: 'archetypes', args: ['chain'], query: {} }, nav, onLeave() {} });
it('chain has exactly one collapsed native read-only guide with no extra trial CTA', () => {
 const before=JSON.stringify(getSave()),root=render(),guides=root.querySelectorAll<HTMLDetailsElement>('[data-chain-tactics]');expect(guides).toHaveLength(1);const guide=guides[0];
 expect(guide.tagName).toBe('DETAILS');expect(guide.open).toBe(false);expect(guide.closest('[data-archetype-section]')?.getAttribute('data-archetype-section')).toBe('chain');
 expect(guide.querySelector('summary')?.textContent).toBe('長串借隊：怎麼搭、先開誰');expect(guide.querySelectorAll('h4')).toHaveLength(3);
 expect(guide.textContent).not.toContain('前往試煉');guide.open=true;expect(JSON.stringify(getSave())).toBe(before);
});
it('renders actual six borrowed members with positional leaders, levels and full descriptions', () => {
 const root=render(),trial=gameData.stages.find(s=>s.id==='trial-chain')!;const roster=[...trial.fixedTeam!.members,...[trial.fixedTeam!.helper!]];const rows=root.querySelectorAll<HTMLElement>('[data-chain-card]');expect(rows).toHaveLength(6);
 roster.forEach((m,i)=>{const c=gameData.cards.find(c=>c.id===m.card)!;expect(rows[i].dataset.chainCard).toBe(c.id);expect(rows[i].textContent).toContain(`Lv${m.level}`);expect(rows[i].textContent).toContain(gameData.skills.find(s=>s.id===c.activeSkill)!.description);expect(rows[i].querySelectorAll('[data-chain-leader]')).toHaveLength(i===0||i===5?1:0);});
});
it('displays both converter orders as counts, not damage ranking, and links real comparison cards', () => {
 const guide=render().querySelector('[data-chain-tactics]')!;expect(guide).not.toBeNull();const rows=guide.querySelectorAll('[data-chain-order]');expect(rows).toHaveLength(2);expect(rows[0].textContent).toContain('0');expect(rows[0].textContent).toContain('18');expect(rows[1].textContent).toContain('6');expect(rows[1].textContent).toContain('12');
 expect(guide.textContent).toContain('不是目前戰鬥盤面');expect(guide.textContent).toContain('不能直接說哪種傷害較高');expect(guide.textContent).toContain('不保證通關');
 expect(guide.querySelector('[data-chain-comparison="c510"]')).not.toBeNull();expect(guide.querySelector('[data-chain-comparison="c501"]')).not.toBeNull();
});
it('duplicate leader card in ordinary slot stays member and missing original leader is not promoted', () => {
 const trial=gameData.stages.find(s=>s.id==='trial-chain')!,members=trial.fixedTeam!.members,original=members.map(m=>({...m}));
 try {
  members[1]={...members[1],card:'c509'};let rows=render().querySelectorAll<HTMLElement>('[data-chain-card]');expect(rows[1].querySelector('[data-chain-leader]')).toBeNull();expect(rows[1].querySelector('span')?.textContent).toContain('隊員');
  members[0]={...members[0],card:'missing-e18'};rows=render().querySelectorAll<HTMLElement>('[data-chain-card]');expect(rows).toHaveLength(5);expect(rows[0].querySelector('[data-chain-leader]')).toBeNull();expect(rows[0].querySelector('span')?.textContent).toContain('隊員');
 } finally {members.splice(0,members.length,...original);}
});

it('missing conversion description leaves only explicit fallback, no example order list', () => {
 const skill=gameData.skills.find(s=>s.id==='s509')!,description=skill.description;
 try {skill.description='';const guide=render().querySelector('[data-chain-tactics]')!;expect(guide.querySelectorAll('[data-chain-order]')).toHaveLength(0);expect(guide.querySelector('ol')).toBeNull();expect(guide.textContent).toContain('暫不提供施放順序示例');}
 finally {skill.description=description;}
});
