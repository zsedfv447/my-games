import { describe, expect, it } from 'vitest';
import { enhance, expForLevel, maxExp, previewEnhance } from '../../src/growth';
import { ctx, makeSave, owned } from './fixtures';

describe('強化', () => {
  const base = () => makeSave([owned('u1', 'c102'), owned('u2', 'c905'), owned('u3', 'c906'), owned('u4', 'c905')]);

  it('同屬性素材經驗 ×1.5，消耗金幣並移除素材', () => {
    const save = base();
    const r = enhance(save, ctx, 'u1', ['u2', 'u3']);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.expGained).toBe(1500 + 1000);
    expect(r.card.exp).toBe(2500);
    expect(r.levelAfter).toBeGreaterThan(1);
    expect(r.coin).toBe(2 * 1 * 100);
    expect(r.save.player.coin).toBe(save.player.coin - 200);
    expect(r.save.inventory.cards.map((c) => c.uid)).toEqual(['u1', 'u4']);
    // 原存檔不被修改
    expect(save.inventory.cards).toHaveLength(4);
    expect(save.inventory.cards[0].exp).toBe(0);
  });

  it('等級越高的素材給越多經驗', () => {
    const save = makeSave([owned('u1', 'c102'), owned('u2', 'c107', { level: 11 })]);
    const r = previewEnhance(save, ctx, 'u1', ['u2']);
    expect(r.ok && r.expGained).toBe(Math.floor(100 * 2 * 1.5));
  });

  it('經驗超過滿級會截斷並回報浪費量', () => {
    const def = ctx.card('c106')!;
    const almost = expForLevel(def, def.maxLevel, ctx.rules) - 10;
    const save = makeSave([owned('u1', 'c106', { level: def.maxLevel - 1, exp: almost }), owned('u2', 'c905')]);
    const r = enhance(save, ctx, 'u1', ['u2']);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.levelAfter).toBe(def.maxLevel);
    expect(r.card.exp).toBe(maxExp(def, ctx.rules));
    expect(r.expGained).toBe(10);
    expect(r.expWasted).toBe(1490);
  });

  it('擋下錯誤操作', () => {
    const save = makeSave([
      owned('u1', 'c102'), owned('u2', 'c905', { locked: true }), owned('u3', 'c905'), owned('u4', 'c906'),
      owned('u5', 'c106', { level: 50 }),
    ]);
    save.teams[0].members[0] = 'u3';
    const code = (r: ReturnType<typeof enhance>) => (r.ok ? 'ok' : r.error.code);
    expect(code(enhance(save, ctx, 'nope', ['u4']))).toBe('cardNotFound');
    expect(code(enhance(save, ctx, 'u1', []))).toBe('noMaterials');
    expect(code(enhance(save, ctx, 'u1', ['u1']))).toBe('materialIsTarget');
    expect(code(enhance(save, ctx, 'u1', ['u4', 'u4']))).toBe('materialDuplicated');
    expect(code(enhance(save, ctx, 'u1', ['u2']))).toBe('materialLocked');
    expect(code(enhance(save, ctx, 'u1', ['u3']))).toBe('materialInTeam');
    expect(code(enhance(save, ctx, 'u1', ['zz']))).toBe('materialNotFound');
    expect(code(enhance(save, ctx, 'u5', ['u4']))).toBe('maxLevel');
    expect(code(enhance(save, ctx, 'u1', Array.from({ length: 11 }, (_, i) => `m${i}`)))).toBe('tooManyMaterials');
    expect(code(enhance({ ...save, player: { ...save.player, coin: 0 } }, ctx, 'u1', ['u4']))).toBe('notEnoughCoin');
  });
});
