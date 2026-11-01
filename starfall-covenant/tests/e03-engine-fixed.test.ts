import { describe, expect, it } from 'vitest';
import { gameData } from '../src/data/load';
import { damageAgainst, applyHits, type DefenseProfile, type Hit } from '../src/battle/damage';
import { evaluateLeaderTurn } from '../src/battle/leader';
import { startBattle, resumeBattle } from '../src/battle/battle-state';
import { createRng } from '../src/core/rng';
import { applyActiveSkill } from '../src/battle/skills/active';
import type { EnemyAbility } from '../src/core/types';

const config = gameData.config.battle;
const fixed: Hit = { member: 0, target: 'single', amount: 15000, fixed: true };
const target: DefenseProfile = { attribute: 'fire', def: 99999 };
const context = { combo: 1, config };

// Regression evidence for existing behavior: no engine changes or manufactured RED.
describe('E03 fixed does not imply universal shield bypass', () => {
  it.each([
    ['defense 99999', {}, {}, 15000],
    ['Combo shield 5 with Combo 1', { comboShield: 5 }, {}, 15000],
    ['50% reduction shield', { shieldPercent: 50 }, {}, 7500],
    ['100% reduction shield', { shieldPercent: 100 }, {}, 0],
    ['explicit ignoreShield vs 100%', { shieldPercent: 100 }, { ignoreShield: true }, 15000],
    ['50% seven-star ring', { ringReduction: 50 }, {}, 7500],
    ['100% seven-star ring', { ringReduction: 100 }, {}, 0],
    ['explicit ignoreShield vs ring', { ringReduction: 100 }, { ignoreShield: true }, 15000],
    ['general and ring reductions stack', { shieldPercent: 50, ringReduction: 50 }, {}, 3750],
  ] as const)('%s', (_label, defense, flags, expected) => {
    expect(damageAgainst({ ...fixed, ...flags }, { ...target, ...defense }, context)).toBe(expected);
  });

  it('ignoreDefense alone does not bypass Combo or generic shields', () => {
    const hit: Hit = { member: 0, target: 'single', amount: 15000, ignoreDefense: true };
    expect(damageAgainst(hit, { ...target, comboShield: 5 }, context)).toBe(0);
    expect(damageAgainst(hit, { ...target, shieldPercent: 50 }, context)).toBe(7500);
    expect(damageAgainst(hit, { ...target, shieldPercent: 100 }, context)).toBe(0);
  });
});

function fixture(abilities: EnemyAbility[] = []) {
  const stage = { ...gameData.stages[0], id: 'e03-engine', waves: [{ enemies: ['e03-target'] }] };
  const data = { ...gameData, enemies: [{ ...gameData.enemies[0], id: 'e03-target', hp: 1000000, def: 99999, abilities }] };
  const initial = startBattle(stage, [{ cardId: 'c307', level: 1 }], null, createRng(37), data);
  const snapshot = initial.snapshot(); snapshot.state.team[0].skillCooldown = 0;
  return resumeBattle(stage, snapshot, data);
}

describe('E03 actual c307 data and real casting', () => {
  it('s307 fixed hit bypasses defense semantically, but never invents ignoreShield', () => {
    const battle = fixture(); const state = battle.getState();
    const skill = gameData.skills.find(s => s.id === state.team[0].card.activeSkill)!;
    expect(skill.id).toBe('s307');
    const result = applyActiveSkill(state, 0, skill, createRng(38));
    expect(result.hits).toHaveLength(1);
    expect(skill.effects[0]).toMatchObject({ type: 'damage', mode: 'fixed', ignoreDefense: true });
    expect(result.hits[0]).toMatchObject({ amount: 15000, fixed: true });
    expect(result.hits[0].ignoreDefense).toBeUndefined(); // fixed already supplies this behavior
    expect(damageAgainst(result.hits[0], target, context)).toBe(15000);
    expect(result.hits[0].ignoreShield).not.toBe(true);
    expect(damageAgainst(result.hits[0], { ...target, ringReduction: 50 }, context)).toBe(7500);
  });
  it.each([
    ['defense', [], 15000],
    ['Combo shield', [{ status: 'comboShield', trigger: 'onStart', value: 5 }], 15000],
    ['50% shield', [{ status: 'shield', trigger: 'onStart', value: 50 }], 7500],
    ['100% shield', [{ status: 'shield', trigger: 'onStart', value: 100 }], 0],
  ] satisfies [string, EnemyAbility[], number][])('actual useSkill: %s', (_label, abilities, expected) => {
    const battle = fixture(abilities); const hp = battle.getState().enemies[0].hp;
    expect(battle.useSkill(0).ok).toBe(true);
    expect(hp - battle.getState().enemies[0].hp).toBe(expected);
  });
});

describe('E03 real l307 heart-triggered fixed and capped-percent follow-ups', () => {
  function hits(heartGroups: number) {
    const team = fixture().getState().team;
    const leader = gameData.leaderSkills.find(l => l.id === team[0].card.leaderSkill)!;
    return evaluateLeaderTurn([leader], {
      team, hpPercent: 100, skillUsedThisTurn: false, combo: heartGroups,
      groups: Array.from({ length: heartGroups }, (_, i) => ({ orb: 'heart' as const, cells: [i * 3, i * 3 + 1, i * 3 + 2], enhancedCount: 0, poisonCount: 0, cascade: 0 })),
    }).followUps;
  }
  it('zero hearts produces no follow-up; heart-group scaling caps at 4000 and 2%', () => {
    expect(hits(0)).toEqual([]);
    expect(hits(1)).toMatchObject([{ amount: 2000, fixed: true }, { percentMaxHp: 1, cap: 20000, fixed: true }]);
    expect(hits(4)).toMatchObject([{ amount: 4000, fixed: true }, { percentMaxHp: 2, cap: 20000, fixed: true }]);
    for (const hit of hits(4)) expect(hit.ignoreShield).not.toBe(true);
  });
  it('percent maxHP is capped before reductions, not added as uncapped attack', () => {
    const followUps = hits(4);
    const enemy = { ...target, hp: 10000000, maxHp: 10000000, comboShield: 99 };
    const plain = applyHits(followUps, [enemy], 0, context);
    expect(enemy.hp - plain.hp[0]).toBe(24000); // 4000 fixed + capped 20000
    const half = applyHits(followUps, [{ ...enemy, shieldPercent: 50 }], 0, context);
    expect(enemy.hp - half.hp[0]).toBe(12000);
    const ring = applyHits(followUps, [{ ...enemy, ringReduction: 50 }], 0, context);
    expect(enemy.hp - ring.hp[0]).toBe(12000);
    const immune = applyHits(followUps, [{ ...enemy, shieldPercent: 100 }], 0, context);
    expect(enemy.hp - immune.hp[0]).toBe(0);
  });
});
