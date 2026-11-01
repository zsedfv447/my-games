import { expect, it } from 'vitest';
import { gameData } from '../src/data/load';
import { startBattle, resumeBattle } from '../src/battle/battle-state';
import { boardFromStrings, type Board } from '../src/battle/board';
import { evaluateLeaderStatic, evaluateLeaderTurn } from '../src/battle/leader';
import { createRng } from '../src/core/rng';
import { ORB_TYPES, type Attribute } from '../src/core/types';
const ids = ['c806', 'c807', 'c808', 'c809', 'c810'];
const stage = gameData.stages.find(s => s.id === 'st-4-2')!;
function authored(attribute: Attribute, count: number): Board {
  const board = boardFromStrings(['whgldf', 'hgldfw', 'gldfwh', 'ldfwhg', 'dfwhgl']);
  const others = ORB_TYPES.filter(o => o !== attribute);
  board.cells = board.cells.map((orb, i) => ({ ...orb, type: i < count ? attribute : others[(i % 6 + Math.floor(i / 6)) % others.length] }));
  return board;
}
function setup(id: string, helperId: string | null, board: Board) {
  const snapshot = startBattle(stage, [{ cardId: id, level: 50 }], helperId ? { cardId: helperId, level: 50 } : null, createRng(7727), gameData).snapshot();
  // Fixed ordinary authored board and charged CDs only. No copied/fake resolver.
  snapshot.state.board = board;
  snapshot.state.team.forEach(m => { m.skillCooldown = 0; });
  return resumeBattle(stage, snapshot, gameData);
}
for (const count of [3, 6]) it.each(ids)('actual %s leader+helper add first-cascade forced orbs for ' + count + ' same-color while ATK remains2.5/6.25', id => {
  const beforeData = JSON.stringify(gameData);
  const card = gameData.cards.find(c => c.id === id)!;
  const leader = gameData.leaderSkills.find(l => l.id === card.leaderSkill)!;
  const board = authored(card.attribute, count), untouched = structuredClone(board);
  for (const copies of [1, 2]) {
    const battle = setup(id, copies === 2 ? id : null, board);
    const before = battle.getState();
    expect(before.team.filter(m => m.isHelper)).toHaveLength(copies - 1);
    const leaders = copies === 2 ? [leader, leader] : [leader];
    const stat = evaluateLeaderStatic(leaders, before.team);
    expect(stat.matchedOrbSkyfall).toHaveLength(copies); expect(stat.enhancedSkyfall).toBe(0);
    const result = battle.submitMove([{ row: 0, col: 0 }]);
    expect(result.ok).toBe(true); if (!result.ok) throw new Error('real move rejected');
    const first = result.summary.steps[0]; expect(first).toBeDefined();
    expect(first.groups).toHaveLength(1);
    expect(first.groups[0].orb).toBe(card.attribute); expect(first.groups[0].cells).toHaveLength(count);
    expect(first.after.cells.filter(o => o.enhanced && o.type === card.attribute)).toHaveLength(count / 3 * copies);
    expect(first.after.cells.filter(o => o.enhanced)).toHaveLength(count / 3 * copies);
    expect(evaluateLeaderTurn(leaders, { team: before.team, groups: result.summary.groups, combo: result.summary.combo, hpPercent: 100, skillUsedThisTurn: false }).atkMultipliers).toEqual(before.team.map(() => copies === 2 ? 6.25 : 2.5));
  }
  expect(board).toEqual(untouched); expect(JSON.stringify(gameData)).toBe(beforeData);
});
it('actual water leader and fire helper produce their own enhanced colors rather than same-color doubling', () => {
  const board = boardFromStrings(['wwwfff', 'hldhld', 'ldhldh', 'dhldhl', 'hldhld']);
  const battle = setup('c806', 'c807', board);
  const before = battle.getState(); expect(before.team[1].isHelper).toBe(true);
  const result = battle.submitMove([{ row: 0, col: 0 }]); expect(result.ok).toBe(true); if (!result.ok) throw new Error('move rejected');
  const first = result.summary.steps[0];
  expect(first.groups.map(g => [g.orb, g.cells.length])).toEqual([['water', 3], ['fire', 3]]);
  expect(first.after.cells.filter(o => o.enhanced).map(o => o.type).sort()).toEqual(['fire', 'water']);
  const leaders = before.team.map(m => gameData.leaderSkills.find(l => l.id === m.card.leaderSkill));
  expect(evaluateLeaderTurn(leaders, { team: before.team, groups: first.groups, combo: 2, hpPercent: 100, skillUsedThisTurn: false }).atkMultipliers).toEqual([2.5, 2.5]);
});
it.each(ids)('actual %s duplicate active marks still replace/refresh, independent of summed leader skyfall', id => {
  const card = gameData.cards.find(c => c.id === id)!;
  const battle = setup(id, id, authored(card.attribute, 3));
  expect(battle.useSkill(0).ok).toBe(true);
  expect(battle.useSkill(1).ok).toBe(true);
  const marks = battle.getState().buffs.filter(b => b.kind === 'markAttack');
  expect(marks).toHaveLength(1);
  expect(marks[0]).toMatchObject({ kind: 'markAttack', attribute: card.attribute, multiplier: 1.4, dealtDamage: false });
  expect(battle.getState().team.every(m => m.skillCooldown! > 0)).toBe(true);
});
