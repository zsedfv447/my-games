import { describe, expect, it } from 'vitest';
import { computeStats, expForLevel, expToNextLevel, levelForExp, maxExp, unlockedAwakenings } from '../../src/growth';
import { ctx } from './fixtures';

const c102 = ctx.card('c102')!;
const rules = ctx.rules;

describe('經驗曲線', () => {
  it('Lv1 需要 0 經驗，且每級所需經驗遞增', () => {
    expect(expForLevel(c102, 1, rules)).toBe(0);
    for (let lv = 2; lv <= c102.maxLevel; lv++) {
      expect(expForLevel(c102, lv, rules)).toBeGreaterThan(expForLevel(c102, lv - 1, rules));
    }
  });

  it('levelForExp 是 expForLevel 的反函式', () => {
    for (const lv of [1, 2, 10, 45, 89, 90]) {
      const need = expForLevel(c102, lv, rules);
      expect(levelForExp(c102, need, rules)).toBe(lv);
      if (lv > 1) expect(levelForExp(c102, need - 1, rules)).toBe(lv - 1);
    }
    expect(levelForExp(c102, maxExp(c102, rules) * 10, rules)).toBe(90);
  });

  it('稀有度越高越難升級', () => {
    const c106 = ctx.card('c106')!;
    expect(expForLevel(c102, 30, rules)).toBeGreaterThan(expForLevel(c106, 30, rules));
  });

  it('距下一級的經驗；滿級為 0', () => {
    expect(expToNextLevel(c102, { level: 1, exp: 0 }, rules)).toBe(expForLevel(c102, 2, rules));
    expect(expToNextLevel(c102, { level: 90, exp: maxExp(c102, rules) }, rules)).toBe(0);
  });
});

describe('能力值', () => {
  it('Lv1 與滿級對應 stats 範圍兩端', () => {
    expect(computeStats(c102, { level: 1, limitBreak: 0, awakened: 0 }, rules)).toEqual({ hp: 1000, atk: 300, rcv: 100 });
    expect(computeStats(c102, { level: 90, limitBreak: 0, awakened: 0 }, rules)).toEqual({ hp: 3000, atk: 900, rcv: 300 });
  });

  it('growthCurve 決定中段成長快慢', () => {
    const early = { ...c102, growthCurve: 0.5 };
    const late = { ...c102, growthCurve: 2 };
    const mid = { level: 45, limitBreak: 0, awakened: 0 };
    expect(computeStats(early, mid, rules).atk).toBeGreaterThan(computeStats(late, mid, rules).atk);
  });

  it('突破每階 +4%，覺醒的 statUp 直接加上去', () => {
    const lb5 = computeStats(c102, { level: 90, limitBreak: 5, awakened: 0 }, rules);
    expect(lb5).toEqual({ hp: 3600, atk: 1080, rcv: 360 });
    const awakened = computeStats(c102, { level: 90, limitBreak: 5, awakened: 2 }, rules);
    expect(awakened.atk).toBe(1180);
    expect(unlockedAwakenings(c102, { awakened: 2 })).toHaveLength(2);
  });
});
