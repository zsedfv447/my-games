import { describe, expect, it } from 'vitest';
import { expForLevel, grantBattleExp, maxExp } from '../../src/growth';
import { ctx, makeSave, owned } from './fixtures';

describe('關卡卡片經驗', () => {
  it('每位出戰隊員各得一份經驗並依經驗升級', () => {
    const save = makeSave([owned('u1', 'c106'), owned('u2', 'c102'), owned('u3', 'c106')]);
    const need = expForLevel(ctx.card('c106')!, 2, ctx.rules);
    const r = grantBattleExp(save, ctx, ['u1', 'u2'], need);
    expect(r.gains.map((g) => g.uid)).toEqual(['u1', 'u2']);
    expect(r.gains[0]).toMatchObject({ cardId: 'c106', expGained: need, levelBefore: 1, levelAfter: 2 });
    const u1 = r.save.inventory.cards.find((c) => c.uid === 'u1')!;
    expect(u1).toMatchObject({ exp: need, level: 2 });
    // 沒出戰的卡不變，原存檔不被改動
    expect(r.save.inventory.cards.find((c) => c.uid === 'u3')).toEqual(save.inventory.cards[2]);
    expect(save.inventory.cards[0].exp).toBe(0);
  });

  it('不給助戰／空位／重複 uid，經驗不超過滿級', () => {
    const def = ctx.card('c106')!;
    const cap = maxExp(def, ctx.rules);
    const save = makeSave([owned('u1', 'c106', { level: def.maxLevel, exp: cap }), owned('u2', 'c106', { exp: cap - 5 })]);
    const r = grantBattleExp(save, ctx, ['u1', null, 'u2', 'u2', undefined, 'helper-x'], 100);
    expect(r.gains).toEqual([
      { uid: 'u1', cardId: 'c106', expGained: 0, levelBefore: def.maxLevel, levelAfter: def.maxLevel },
      { uid: 'u2', cardId: 'c106', expGained: 5, levelBefore: 1, levelAfter: def.maxLevel },
    ]);
    expect(r.save.inventory.cards[1]).toMatchObject({ exp: cap, level: def.maxLevel });
  });

  it('經驗為 0 或沒有隊員時存檔原樣返回', () => {
    const save = makeSave([owned('u1', 'c106')]);
    expect(grantBattleExp(save, ctx, ['u1'], 0).save).toBe(save);
    expect(grantBattleExp(save, ctx, [], 50).save).toBe(save);
  });
});
