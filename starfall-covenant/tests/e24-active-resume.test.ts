import { expect, it } from 'vitest';
import { gameData } from '../src/data/load';
import { createRng } from '../src/core/rng';
import { boardFromStrings } from '../src/battle/board';
import { startBattle, resumeBattle, type Battle, type BattleEvents } from '../src/battle/battle-state';
import { teamWithRcvToAtk } from '../src/battle/skills/buffs';

const stage = gameData.stages.find(s => s.id === 'st-1-1')!;
const eventNames = ['battleStart', 'waveStart', 'skillUsed', 'boardChanged', 'turnResolved',
  'enemyDefeated', 'enemyAttack', 'statusApplied', 'statusExpired', 'poisonTick',
  'waveCleared', 'ringBroken', 'battleEnd', 'continued'] as const satisfies readonly (keyof BattleEvents)[];
// Capture at emission, not after the engine has mutated referenced state. No global bus listeners.
function capture(battle: Battle) {
  const entries: { type: string; payload: unknown }[] = [];
  const off = eventNames.map(type => battle.events.on(type, payload => {
    finite(payload);
    entries.push({ type, payload: structuredClone(payload) });
  }));
  return { entries, stop: () => off.forEach(fn => fn()) };
}
function finite(value: unknown): void {
  if (typeof value === 'number') expect(Number.isFinite(value)).toBe(true);
  else if (value && typeof value === 'object') Object.values(value).forEach(finite);
}
async function initialized(battle: Battle, fresh: boolean) {
  const log = capture(battle);
  try {
    await Promise.resolve();
    expect(log.entries.map(e => e.type)).toEqual(fresh ? ['battleStart', 'waveStart'] : ['battleStart']);
    expect(log.entries[0].payload).toEqual({ state: battle.getState() });
  } finally { log.stop(); }
}
async function ready(cardId: string, seed: number) {
  const initial = startBattle(stage, [cardId, 'c106', 'c106'].map(cardId => ({ cardId, level: 1 })), null, createRng(seed), gameData);
  await initialized(initial, true);
  const fixture = initial.snapshot();
  // Explicit isolation fixture, NOT naturally charged play: ready CDs, durable enemy and
  // delayed attack permit actual three-turn expiry without victory/loss. Definitions unchanged.
  fixture.state.team.forEach(m => { m.skillCooldown = 0; });
  fixture.state.enemies.forEach(e => { e.hp = e.maxHp = 1_000_000; e.cooldown = 20; });
  fixture.state.board = boardFromStrings(['gggflh', 'flhdwf', 'hdwflh', 'dwflhd', 'wflhdw']);
  const live = resumeBattle(stage, fixture, gameData);
  await initialized(live, false);
  return live;
}
async function checkpoint(live: Battle) {
  const snapshot = live.snapshot();
  finite(snapshot);
  const json = JSON.parse(JSON.stringify(snapshot));
  expect(json).toEqual(snapshot); // JSON must not hide NaN/Infinity/undefined divergence.
  const restored = resumeBattle(stage, json, gameData);
  await initialized(restored, false);
  expect(restored.snapshot()).toEqual(snapshot);
  return restored;
}
function paired(live: Battle, restored: Battle) {
  const a = capture(live), b = capture(restored);
  let actions = 0;
  return {
    step(action: (battle: Battle) => ReturnType<Battle['useSkill']> | ReturnType<Battle['submitMove']>) {
      expect(++actions).toBeLessThanOrEqual(8);
      expect(live.getState().phase).toBe('player');
      expect(restored.getState().phase).toBe('player');
      const result = action(live), resumedResult = action(restored);
      finite(result); finite(resumedResult);
      expect(result.ok).toBe(true);
      expect(resumedResult).toEqual(result);
      finite(live.snapshot()); finite(restored.snapshot());
      expect(restored.snapshot()).toEqual(live.snapshot()); // entire state AND RNG/internal flags
      expect(restored.getResult()).toEqual(live.getResult());
      expect(b.entries).toEqual(a.entries); // all payloads/order accumulated after every action
      return result;
    },
    stop: () => { a.stop(); b.stop(); },
  };
}

it('seed 2401: actual s403 chain survives JSON, triggers on later skill and expires after three real turns', async () => {
  const live = await ready('c403', 2401);
  const activation = live.useSkill(0);
  expect(activation.ok).toBe(true);
  if (!activation.ok) throw new Error(activation.reason);
  expect(activation.skill).toMatchObject({ skillId: 's403', hits: [] });
  expect(live.getState().buffs).toContainEqual({ kind: 'chainOnSkill', member: 0, multiplier: 5, turns: 3 });
  const restored = await checkpoint(live), pair = paired(live, restored);
  try {
    const skill = pair.step(b => b.useSkill(1));
    if (!skill.ok || !('skill' in skill)) throw new Error('Expected skill success');
    expect(skill.skill.hits).toHaveLength(1);
    expect(skill.skill.hits[0].hit).toMatchObject({ member: 0, amount: live.getState().team[0].atk * 5 });
    for (const remaining of [2, 1, 0]) {
      pair.step(b => b.submitMove([]));
      expect(live.getState().buffs.filter(b => b.kind === 'chainOnSkill').map(b => b.turns)).toEqual(remaining ? [remaining] : []);
    }
    const expired = pair.step(b => b.useSkill(2));
    if (!expired.ok || !('skill' in expired)) throw new Error('Expected skill success');
    expect(expired.skill.hits).toEqual([]);
    expect(live.getState().turns).toBe(3);
    expect(live.getState().phase).toBe('player');
  } finally { pair.stop(); }
});

it('seed 2402: actual s301 recovery-to-attack survives JSON and expires after two real turns', async () => {
  const live = await ready('c301', 2402);
  expect(live.useSkill(0)).toMatchObject({ ok: true, skill: { skillId: 's301', hits: [] } });
  const active = live.getState();
  expect(active.buffs).toContainEqual({ kind: 'rcvToAtk', ratio: 2, turns: 2 });
  expect(teamWithRcvToAtk(active, active.team).map(m => m.atk)).toEqual(active.team.map(m => m.atk + m.rcv * 2));
  const restored = await checkpoint(live), pair = paired(live, restored);
  const rngBefore = live.snapshot().rng;
  try {
    pair.step(b => b.useSkill(1));
    const move = pair.step(b => b.submitMove([]));
    if (!move.ok || !('summary' in move)) throw new Error('Expected resolved turn');
    expect(move.summary.groups.length).toBeGreaterThan(0);
    expect(move.summary.hits.length).toBeGreaterThan(0);
    expect(live.getState().buffs).toContainEqual({ kind: 'rcvToAtk', ratio: 2, turns: 1 });
    pair.step(b => b.submitMove([]));
    const expired = live.getState();
    expect(expired.buffs.some(b => b.kind === 'rcvToAtk')).toBe(false);
    expect(teamWithRcvToAtk(expired, expired.team)).toBe(expired.team);
    pair.step(b => b.submitMove([]));
    expect(live.snapshot().rng).not.toEqual(rngBefore);
    expect(live.getState().turns).toBe(3);
    expect(live.getState().phase).toBe('player');
  } finally { pair.stop(); }
});
