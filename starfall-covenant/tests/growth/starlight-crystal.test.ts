import { describe, expect, it } from 'vitest';
import { gameData } from '../../src/data/load';
import { createGrowthContext, limitBreak, materialCandidates } from '../../src/growth';
import { buyItem, remainingPurchases } from '../../src/progression/shop';
import { createNewSave } from '../../src/save/save';
import { makeSave, owned } from './fixtures';

// 用正式資料（星輝結晶 c921 在 cards.json）
const ctx = createGrowthContext(gameData);

describe('星輝結晶（通用突破素材）', () => {
  it('可以和同名卡混用突破，上限 +5 不變', () => {
    const save = makeSave([owned('t', 'c102', { limitBreak: 2 }), owned('dup', 'c102'), owned('x1', 'c921'), owned('x2', 'c921'), owned('x3', 'c921')]);
    const r = limitBreak(save, ctx, 't', ['dup', 'x1', 'x2']);
    expect(r.ok && r.limitBreak).toBe(5);
    expect(limitBreak(save, ctx, 't', ['dup', 'x1', 'x2', 'x3'])).toMatchObject({ ok: false, error: { code: 'tooManyMaterials' } });
  });

  it('上鎖、隊伍中的結晶照舊不能用；其他素材卡仍然不行', () => {
    const save = makeSave([owned('t', 'c102'), owned('lk', 'c921', { locked: true }), owned('tm', 'c921'), owned('m', 'c905')]);
    save.teams[0].members[1] = 'tm';
    expect(limitBreak(save, ctx, 't', ['lk'])).toMatchObject({ ok: false, error: { code: 'materialLocked' } });
    expect(limitBreak(save, ctx, 't', ['tm'])).toMatchObject({ ok: false, error: { code: 'materialInTeam' } });
    expect(limitBreak(save, ctx, 't', ['m'])).toMatchObject({ ok: false, error: { code: 'wrongMaterial' } });
  });

  it('突破的候選素材有結晶，強化的候選不列結晶（避免誤吃）', () => {
    const save = makeSave([owned('t', 'c102'), owned('x', 'c921'), owned('m', 'c901')]);
    expect(materialCandidates(save, ctx, 't', 'limitBreak').map((c) => c.owned.uid)).toEqual(['x']);
    expect(materialCandidates(save, ctx, 't', 'enhance').map((c) => c.owned.uid)).toEqual(['m']);
  });

  it('商店每月限購 4 顆，下個月重置', () => {
    const item = gameData.shop.find((i) => i.id === 'coin-starlight-crystal')!;
    expect(item.limit).toEqual({ count: 4, per: 'month' });
    const oct = new Date(2026, 9, 31, 12).getTime();
    let save = createNewSave(gameData.config, oct);
    save = { ...save, player: { ...save.player, coin: 1_000_000 } };
    for (let i = 0; i < 4; i++) {
      const r = buyItem(save, item, gameData.config, oct);
      expect(r.ok).toBe(true);
      if (r.ok) save = r.save;
    }
    expect(buyItem(save, item, gameData.config, oct)).toMatchObject({ ok: false });
    expect(save.inventory.cards.filter((c) => c.cardId === 'c921')).toHaveLength(4);
    expect(remainingPurchases(save, item, new Date(2026, 10, 1, 12).getTime())).toBe(4);
  });

  it('每週克星週高級關首通給 1 顆', () => {
    const top = gameData.stages.filter((s) => /^nm-.+-3$/.test(s.id));
    expect(top).toHaveLength(6);
    for (const s of top) expect(s.rewards.periodFirstClear?.cards).toContainEqual({ card: 'c921', count: 1 });
  });
});
