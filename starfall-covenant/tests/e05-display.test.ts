// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { gameData } from '../src/data/load';
import { createNewSave } from '../src/save/save';
import { commit, getSave } from '../src/ui/state';
import { collectionCardScreen } from '../src/ui/screens/collection';
import { teamScreen } from '../src/ui/screens/team';
import { openCardQuickView } from '../src/ui/components/card-quickview';
import { closeRouteScoped } from '../src/ui/route-scope';
import type { ScreenDef } from '../src/ui/router';
const leaders = [
  ['l205', 'c205', '同時消除潮珠與輝珠時全隊攻擊力 4 倍；潮、輝屬性成員生命 1.3 倍。'],
  ['l403', 'c403', '開場全員主動技冷卻歸零；施放主動技的回合全隊攻擊力 3.5 倍；每回合全員主動技冷卻額外減少 1 回合。'],
] as const;
const active = [
  ['s103', 'c103', '扣除目前生命 50%（至少保留 1 點生命），把潮珠轉為焰珠，1 回合內全隊攻擊力 2 倍。'],
  ['s110', 'c110', '扣除目前生命 30%（至少保留 1 點生命），1 回合內全隊攻擊力 1.5 倍，並在 1 回合內獲得一次致命傷害保命效果（觸發時保留 1 點生命）。'],
  ['s205', 'c205', '把焰珠轉為潮珠、蝕珠轉為輝珠，並強化全部潮珠與輝珠。'],
  ['s305', 'c305', '對全體敵人造成 50000 固定傷害（無視防禦與護盾），回復生命上限 15%，並把蝕珠轉為心珠。'],
  ['s410', 'c410', '其他隊員的主動技冷卻減少 1 回合，不包含施放者。'],
] as const;
const nav = { go: vi.fn(), replace: vi.fn(), back: vi.fn(), backTo: vi.fn() };
function render(screen: ScreenDef, args: string[] = []) {
  const root = screen.render({ route: { name: screen.name, args, query: {} }, nav, onLeave() {} });
  document.body.replaceChildren(root); return root;
}
beforeEach(() => { closeRouteScoped(); history.replaceState(null, '', '#/collection'); commit(createNewSave(gameData.config, 1)); });
afterEach(() => { closeRouteScoped(); document.body.replaceChildren(); });
it.each(leaders)('%s exact self-contained description reaches full codex, quickview and team leader panel unchanged', async (id, cardId, expected) => {
  const data = gameData.leaderSkills.find(s => s.id === id)!; expect(data.description).toBe(expected);
  const save = getSave(); save.inventory.cards[0].cardId = cardId; save.teams[0].members = [save.inventory.cards[0].uid,null,null,null,null]; commit(save);
  const before = JSON.stringify(getSave());
  expect(render(collectionCardScreen, [cardId]).textContent).toContain(expected);
  openCardQuickView(cardId, nav); expect(document.querySelector('[data-card-quickview]')?.textContent).toContain(expected);
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await vi.waitFor(() => expect(history.state?.starfallCardPreview).toBeUndefined());
  expect(render(teamScreen).querySelector('.team-leader')?.textContent).toContain(expected);
  expect(JSON.stringify(getSave())).toBe(before);
});
it('leader rules preserve both-color requirement and HP target; charged cooldown is not a promise against seals', () => {
  const dual = gameData.leaderSkills.find(s => s.id === 'l205')!;
  expect(dual.rules).toEqual([
    { conditions: [{ type: 'attributesMatched', count: 2, attributes: ['water','light'] }], effects: [{ type: 'atkMultiplier', value: 4 }] },
    { conditions: [{ type: 'always' }], effects: [{ type: 'hpMultiplier', target: { attribute: ['water','light'] }, value: 1.3 }] },
  ]);
  const cycle = gameData.leaderSkills.find(s => s.id === 'l403')!;
  expect(cycle.rules).toEqual([
    { conditions: [{ type: 'always' }], effects: [{ type: 'skillCooldownStart', charged: true }, { type: 'allyCooldownPerTurn', turns: 1 }] },
    { conditions: [{ type: 'skillUsedThisTurn' }], effects: [{ type: 'atkMultiplier', value: 3.5 }] },
  ]);
  expect(cycle.description).toContain('冷卻歸零'); expect(cycle.description).not.toMatch(/立即可用|必定可用|無視封印/);
});
it.each(active)('%s complete active text renders standalone in full codex and quickview without acquiring card', async (id, cardId, expected) => {
  expect(gameData.skills.find(s => s.id === id)!.description).toBe(expected);
  const save = getSave(); save.inventory.cards = []; commit(save); const before = JSON.stringify(getSave());
  expect(render(collectionCardScreen, [cardId]).textContent).toContain(expected);
  openCardQuickView(cardId, nav); expect(document.querySelector('[data-card-quickview]')?.textContent).toContain(expected);
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await vi.waitFor(() => expect(history.state?.starfallCardPreview).toBeUndefined());
  expect(JSON.stringify(getSave())).toBe(before);
});
it('no skill description across either dataset depends on 同上', () => {
  expect([...gameData.skills, ...gameData.leaderSkills].filter(s => s.description.includes('同上')).map(s => s.id)).toEqual([]);
});
