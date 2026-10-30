import { describe, expect, it } from 'vitest';
import gameConfig from '../data/config.json';
import type { MatchGroup } from '../src/battle/board';
import {
  applyHits,
  attributeMultiplier,
  comboMultiplier,
  computeAttacks,
  computeHeal,
  damageAgainst,
  incomingDamage,
  poisonOrbDamage,
  type BattleMember,
  type EnemyTarget,
} from '../src/battle/damage';
import type { OrbType } from '../src/core/types';

const config = gameConfig.battle;

function group(orb: OrbType, size: number, extra: Partial<MatchGroup> = {}): MatchGroup {
  return { orb, cells: Array.from({ length: size }, (_, i) => i), enhancedCount: 0, poisonCount: 0, cascade: 0, ...extra };
}

const member = (attribute: BattleMember['attribute'], atk = 1000, rcv = 100): BattleMember => ({
  cardId: 'test',
  attribute,
  race: 'human',
  hp: 1000,
  atk,
  rcv,
});

describe('倍率', () => {
  it('屬性剋制：焰剋森、潮剋焰、森剋潮、輝蝕互剋', () => {
    expect(attributeMultiplier('fire', 'wood', config)).toBe(1.5);
    expect(attributeMultiplier('water', 'fire', config)).toBe(1.5);
    expect(attributeMultiplier('wood', 'water', config)).toBe(1.5);
    expect(attributeMultiplier('fire', 'water', config)).toBe(0.5);
    expect(attributeMultiplier('light', 'dark', config)).toBe(1.5);
    expect(attributeMultiplier('dark', 'light', config)).toBe(1.5);
    expect(attributeMultiplier('fire', 'light', config)).toBe(1);
    expect(attributeMultiplier('light', 'light', config)).toBe(1);
  });

  it('Combo 倍率 = 1 + 0.25 × (Combo − 1)', () => {
    expect(comboMultiplier(1, config)).toBe(1);
    expect(comboMultiplier(5, config)).toBe(2);
  });
});

describe('computeAttacks', () => {
  it('GDD 公式：珠數、組數與 Combo 加成', () => {
    // 焰 3 顆 + 焰 4 顆 + 潮 3 顆 → 3 Combo
    const hits = computeAttacks({
      team: [member('fire'), member('water'), member('wood')],
      groups: [group('fire', 3), group('fire', 4), group('water', 3)],
      config,
    });
    const combo = comboMultiplier(3, config);
    expect(hits).toEqual([
      { member: 0, attribute: 'fire', target: 'single', amount: 1000 * (1 + 1.25) * combo },
      { member: 1, attribute: 'water', target: 'single', amount: 1000 * 1 * combo },
    ]);
  });

  it('單組 5 顆以上為全體攻擊，同屬其他組仍打單體', () => {
    const hits = computeAttacks({
      team: [member('fire')],
      groups: [group('fire', 5), group('fire', 3)],
      config,
    });
    expect(hits.map((h) => h.target)).toEqual(['single', 'all']);
    expect(hits[1].amount).toBeCloseTo(1000 * 1.5 * 1.25);
  });

  it('強化珠、覺醒與攻擊倍率', () => {
    const fire = { ...member('fire'), passives: [{ type: 'orbDamageUp' as const, orb: 'fire' as const, percent: 10 }] };
    const [hit] = computeAttacks({
      team: [fire],
      groups: [group('fire', 3, { enhancedCount: 2 })],
      config,
      atkMultipliers: [3],
    });
    expect(hit.amount).toBeCloseTo(1000 * 1.3 * 1.1 * 3);
  });
});

describe('computeHeal', () => {
  it('心珠回復 = 全隊回復力 × 組倍率 × Combo × 回復倍率', () => {
    const heal = computeHeal({
      team: [member('fire', 0, 100), member('water', 0, 200)],
      groups: [group('heart', 4), group('fire', 3)],
      config,
      rcvMultiplier: 2,
    });
    expect(heal).toBe(Math.floor(300 * 1.25 * 1.25 * 2));
  });

  it('沒有消除心珠時不回復', () => {
    expect(computeHeal({ team: [member('fire')], groups: [group('fire', 3)], config })).toBe(0);
  });
});

describe('防禦與護盾', () => {
  const enemy: EnemyTarget = { attribute: 'wood', def: 100, hp: 10000 };
  const ctx = { combo: 3, config };

  it('剋制後扣防禦', () => {
    expect(damageAgainst({ member: 0, attribute: 'fire', target: 'single', amount: 1000 }, enemy, ctx)).toBe(1400);
  });

  it('防禦高於傷害時至少 1 點；無視防禦則不扣', () => {
    const tough = { ...enemy, def: 99999 };
    expect(damageAgainst({ member: 0, attribute: 'water', target: 'single', amount: 1000 }, tough, ctx)).toBe(1);
    expect(
      damageAgainst({ member: 0, attribute: 'water', target: 'single', amount: 1000, ignoreDefense: true }, tough, ctx),
    ).toBe(500);
  });

  it('Combo 盾：Combo 不足時傷害為 0，固定傷害不受影響', () => {
    const shielded = { ...enemy, comboShield: 5 };
    expect(damageAgainst({ member: 0, attribute: 'fire', target: 'single', amount: 1000 }, shielded, ctx)).toBe(0);
    expect(damageAgainst({ member: -1, target: 'single', amount: 500, fixed: true }, shielded, ctx)).toBe(500);
    expect(damageAgainst({ member: 0, attribute: 'fire', target: 'single', amount: 1000 }, shielded, { ...ctx, combo: 5 })).toBe(1400);
  });

  it('屬性減傷與一般護盾', () => {
    const shielded = { ...enemy, def: 0, shieldPercent: 50, attributeShield: { attributes: ['fire' as const], percent: 80 } };
    expect(damageAgainst({ member: 0, attribute: 'fire', target: 'single', amount: 1000 }, shielded, ctx)).toBe(150);
    expect(damageAgainst({ member: 0, attribute: 'dark', target: 'single', amount: 1000 }, shielded, ctx)).toBe(500);
    expect(
      damageAgainst({ member: 0, attribute: 'fire', target: 'single', amount: 1000, ignoreShield: true }, shielded, ctx),
    ).toBe(1500);
  });

  it('傷害吸收：單次超過門檻變 0', () => {
    const absorb = { ...enemy, def: 0, damageAbsorb: 5000 };
    expect(damageAgainst({ member: 0, attribute: 'light', target: 'single', amount: 6000 }, absorb, ctx)).toBe(0);
    expect(damageAgainst({ member: 0, attribute: 'light', target: 'single', amount: 4000 }, absorb, ctx)).toBe(4000);
  });
});

describe('applyHits', () => {
  it('單體目標倒下後轉向下一個敵人；全體攻擊打所有存活敵人', () => {
    const enemies: EnemyTarget[] = [
      { attribute: 'light', def: 0, hp: 500 },
      { attribute: 'light', def: 0, hp: 3000 },
      { attribute: 'light', def: 0, hp: 3000 },
    ];
    const { hp, results } = applyHits(
      [
        { member: 0, attribute: 'fire', target: 'single', amount: 1000 },
        { member: 1, attribute: 'water', target: 'single', amount: 1000 },
        { member: 2, attribute: 'wood', target: 'all', amount: 1000 },
      ],
      enemies,
      0,
      { combo: 1, config },
    );
    expect(hp).toEqual([0, 1000, 2000]);
    expect(results[0].damage).toBe(500);
    expect(results[1].enemy).toBe(1);
  });
});

describe('我方受傷', () => {
  it('減傷相乘疊加', () => {
    expect(incomingDamage(1000, [50, 20])).toBe(400);
    expect(incomingDamage(1000)).toBe(1000);
  });

  it('毒珠依顆數扣血', () => {
    expect(poisonOrbDamage([group('fire', 3, { poisonCount: 2 }), group('heart', 3, { poisonCount: 1 })], 10000, 5)).toBe(1500);
  });
});
