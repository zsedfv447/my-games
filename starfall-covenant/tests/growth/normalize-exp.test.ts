import { describe, expect, it } from 'vitest';
import {
  enhance, expForLevel, grantBattleExp, LEGACY_EXP_CURVE, levelForExp, maxExp, normalizeCardExp, normalizeSaveCardExp,
} from '../../src/growth';
import { ctx, makeSave, owned } from './fixtures';

const legacy = { ...ctx.rules, ...LEGACY_EXP_CURVE };
const def = ctx.card('c102')!; // 5★，Lv90
/** 照舊曲線存的卡：Lv level，該級內進度 t */
const oldCard = (uid: string, level: number, t = 0.5) => {
  const lo = expForLevel(def, level, legacy);
  const hi = expForLevel(def, level + 1, legacy);
  return owned(uid, 'c102', { level, exp: Math.floor(lo + t * (hi - lo)) });
};

describe('經驗表改版：舊存檔換算', () => {
  it('保留等級，經驗落在新曲線該級的區間；舊經驗不在新區間時保留級內進度', () => {
    for (let level = 1; level < def.maxLevel; level++) {
      const before = oldCard('u', level, 0.5);
      const c = normalizeCardExp(before, def, ctx.rules);
      expect(c.level).toBe(level);
      expect(levelForExp(def, c.exp, ctx.rules)).toBe(level);
      const lo = expForLevel(def, level, ctx.rules);
      const hi = expForLevel(def, level + 1, ctx.rules);
      // 新舊區間重疊時，舊經驗已經落在新區間內，視為已換算（為了冪等），進度不重新對應
      if (before.exp < lo || before.exp >= hi) expect((c.exp - lo) / (hi - lo)).toBeCloseTo(0.5, 1);
      else expect(c).toBe(before);
    }
  });

  it('舊曲線 Lv20 的卡（經驗遠超過新曲線 Lv20）不會跳級', () => {
    const before = oldCard('u', 20, 0.9);
    expect(levelForExp(def, before.exp, ctx.rules)).toBeGreaterThan(20); // 不換算就會跳級
    expect(normalizeCardExp(before, def, ctx.rules).level).toBe(20);
  });

  it('冪等：套用兩次結果相同；新曲線上的卡不動', () => {
    for (const level of [1, 5, 33, 89]) {
      const once = normalizeCardExp(oldCard('u', level, 0.3), def, ctx.rules);
      expect(normalizeCardExp(once, def, ctx.rules)).toBe(once);
    }
    const fresh = owned('n', 'c102', { level: 12, exp: expForLevel(def, 12, ctx.rules) + 3 });
    expect(normalizeCardExp(fresh, def, ctx.rules)).toBe(fresh);
  });

  it('滿級的卡經驗截到新的滿級經驗', () => {
    const c = normalizeCardExp(owned('m', 'c102', { level: 90, exp: expForLevel(def, 90, legacy) }), def, ctx.rules);
    expect(c).toMatchObject({ level: 90, exp: maxExp(def, ctx.rules) });
  });

  it('整份存檔：等級都不變；之後戰鬥或強化也只會依新曲線正常升級', () => {
    const save = makeSave([oldCard('a', 20), oldCard('b', 60, 0.99), owned('mat', 'c905')]);
    const norm = normalizeSaveCardExp(save, ctx);
    expect(norm.inventory.cards.map((c) => c.level)).toEqual([20, 60, 1]);
    expect(normalizeSaveCardExp(norm, ctx)).toBe(norm);
    const battle = grantBattleExp(norm, ctx, ['a'], 1).save.inventory.cards.find((c) => c.uid === 'a')!;
    expect(battle.level).toBe(20);
    const r = enhance(norm, ctx, 'b', ['mat']);
    expect(r.ok && r.levelAfter).toBeGreaterThanOrEqual(60);
    expect(r.ok && r.levelAfter).toBeLessThanOrEqual(levelForExp(def, expForLevel(def, 61, ctx.rules) + 2000, ctx.rules));
  });
});
