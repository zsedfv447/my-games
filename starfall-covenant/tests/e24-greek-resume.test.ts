import { afterEach, expect, it, vi } from 'vitest';
import { boardFromStrings, findMatches, type Board, type Pos } from '../src/battle/board';
import { resumeBattle, startBattle, type Battle } from '../src/battle/battle-state';
import { createRng } from '../src/core/rng';
import { gameData } from '../src/data/load';

// Do not JSON-normalize observed results/events: reject nonfinite numbers and
// capture mutable payloads at emission, preserving undefined fields as well.
function finite(value: unknown): void {
  if (typeof value === 'number') expect(Number.isFinite(value)).toBe(true);
  else if (value && typeof value === 'object') Object.values(value).forEach(finite);
}
function observe(battle: Battle) {
  const events: unknown[] = [];
  const emit = battle.events.emit.bind(battle.events);
  const spy = vi.spyOn(battle.events, 'emit').mockImplementation((type, payload) => {
    finite(payload);
    events.push(structuredClone({ type, payload }));
    emit(type, payload);
  });
  return { events, stop: () => spy.mockRestore() };
}
// Fixed row-major adjacent move, not a seed search or damage optimizer.
function matchingMove(board: Board): Pos[] {
  for (let i = 0; i < board.cells.length; i++) {
    const from = { row: Math.floor(i / board.cols), col: i % board.cols };
    for (const [dr, dc] of [[0, 1], [1, 0]]) {
      const to = { row: from.row + dr, col: from.col + dc };
      if (to.row >= board.rows || to.col >= board.cols) continue;
      const cells = board.cells.slice(), j = to.row * board.cols + to.col;
      [cells[i], cells[j]] = [cells[j], cells[i]];
      if (findMatches({ ...board, cells }).length) return [from, to];
    }
  }
  throw new Error('fixed-seed board has no one-swap match; bounded fixture cannot reach stochastic suffix');
}
afterEach(() => vi.restoreAllMocks());

it('actual Poseidon mark + Greek skyfall: live and JSON-resumed three-action suffix preserve results, RNG and all emitted events', async () => {
  const stage = gameData.stages.find(s => s.id === 'trial-greek')!;
  const fixed = stage.fixedTeam!;
  const members = fixed.members.map(m => ({ cardId: m.card, level: m.level, skillLevel: m.skillLevel }));
  const helper = fixed.helper!;
  const initial = startBattle(stage, members, { cardId: helper.card, level: helper.level, skillLevel: helper.skillLevel }, createRng(2406), gameData);
  await Promise.resolve();
  const fixture = initial.snapshot();
  // Explicit isolation fixture, NOT naturally charged/played trial: ready skills,
  // known ordinary board, durable first-wave enemies and delayed enemy attacks.
  fixture.state.team.forEach(m => { m.skillCooldown = 0; });
  fixture.state.enemies.forEach(e => { e.hp = e.maxHp = 1_000_000; e.cooldown = 100; });
  fixture.state.board = boardFromStrings(['wwwfff', 'hldhld', 'ldhldh', 'dhldhl', 'hldhld']);
  const live = resumeBattle(stage, fixture, gameData);
  await Promise.resolve();
  expect(live.useSkill(0)).toMatchObject({ ok: true }); // actual s806
  const activation = live.submitMove([{ row: 0, col: 0 }]);
  expect(activation.ok).toBe(true);
  if (!activation.ok) throw new Error('fixture failed to resolve');
  expect(activation.summary.hits.some(h => h.damage > 0)).toBe(true);
  expect(activation.summary.steps[0].after.cells.some(o => o.type === 'water' && o.enhanced)).toBe(true);
  const mark = live.getState().buffs.find(b => b.kind === 'markAttack');
  expect(mark?.kind).toBe('markAttack');
  if (mark?.kind !== 'markAttack') throw new Error('actual mark missing');
  expect(mark.attribute).toBe('water');
  expect(mark.multiplier).toBeCloseTo(1.6);

  const checkpoint = live.snapshot();
  finite(checkpoint);
  const serialized = JSON.parse(JSON.stringify(checkpoint));
  expect(serialized).toEqual(checkpoint);
  const resumed = resumeBattle(stage, serialized, gameData);
  const startup = observe(resumed);
  await Promise.resolve();
  expect(startup.events).toEqual([{ type: 'battleStart', payload: { state: resumed.getState() } }]);
  startup.stop(); // exactly battleStart, explicitly no waveStart/reapplied opening
  expect(resumed.snapshot()).toEqual(checkpoint);
  const a = observe(live), b = observe(resumed);
  try {
    let suffixMove: Pos[] = [];
    const actions = [
      (battle: Battle) => battle.useSkill(2), // actual s204: fire→water, dark→light
      (battle: Battle) => battle.submitMove(suffixMove),
      (battle: Battle) => battle.submitMove([]),
    ];
    for (const [index, action] of actions.entries()) {
      if (index === 1) suffixMove = matchingMove(live.getState().board);
      expect(live.getState().phase).toBe('player');
      expect(resumed.getState().phase).toBe('player');
      const resultA = action(live), resultB = action(resumed);
      finite(resultA); finite(resultB);
      expect(resultA.ok).toBe(true);
      expect(resultB).toEqual(resultA);
      if (index === 1 && resultA.ok && 'summary' in resultA) {
        expect(resultA.summary.combo).toBeGreaterThan(0);
        expect(resultA.summary.steps.length).toBeGreaterThan(0);
      }
      finite(live.snapshot()); finite(resumed.snapshot());
      expect(resumed.snapshot()).toEqual(live.snapshot()); // includes RNG state
      expect(resumed.getResult()).toEqual(live.getResult());
      expect(b.events).toEqual(a.events);
    }
    expect(a.events).toContainEqual(expect.objectContaining({ type: 'skillUsed', payload: expect.objectContaining({ skillId: 's204' }) }));
    expect(a.events.filter(e => (e as { type: string }).type === 'turnResolved')).toHaveLength(2);
    expect(a.events.some(e => (e as { type: string }).type === 'boardChanged')).toBe(true);
    expect(live.getState().buffs.some(buff => buff.kind === 'markAttack')).toBe(false);
    expect(live.snapshot().rng).not.toBe(checkpoint.rng);
    expect(live.snapshot()).not.toEqual(checkpoint);
  } finally { a.stop(); b.stop(); }
});
