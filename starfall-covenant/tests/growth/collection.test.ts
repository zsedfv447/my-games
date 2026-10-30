import { describe, expect, it } from 'vitest';
import {
  claimAllCollectionRewards, claimCollectionReward, collectionEntries, collectionStatus, markOwned, markSeen,
} from '../../src/growth';
import { ctx, makeSave } from './fixtures';

const base = () => markSeen(markOwned(makeSave(), ['c102', 'c206', 'c905']), ['c106']);

describe('圖鑑狀態', () => {
  it('擁有過／見過／未見過', () => {
    const s = base();
    expect(collectionStatus(s, 'c102')).toBe('owned');
    expect(collectionStatus(s, 'c106')).toBe('seen');
    expect(collectionStatus(s, 'c107')).toBe('unseen');
  });

  it('依卡號列出全部卡片，並標出可領的獎勵', () => {
    const list = collectionEntries(base(), ctx);
    expect(list.map((e) => e.card.id)).toEqual([...ctx.data.cards].map((c) => c.id).sort());
    expect(list.find((e) => e.card.id === 'c102')).toMatchObject({ status: 'owned', claimable: 3 });
    expect(list.find((e) => e.card.id === 'c106')).toMatchObject({ status: 'seen', claimable: 0 });
    // 3★ 素材有 1 顆鑽石
    expect(list.find((e) => e.card.id === 'c905')?.claimable).toBe(1);
  });

  it('依屬性、種族、流派、狀態篩選', () => {
    const s = base();
    const ids = (f: Parameters<typeof collectionEntries>[2]) => collectionEntries(s, ctx, f).map((e) => e.card.id);
    expect(ids({ attribute: 'water' })).toEqual(['c206', 'c211', 'c906']);
    expect(ids({ race: 'dragon' })).toEqual(['c102', 'c103']);
    expect(ids({ archetype: 'chain' })).toEqual(['c102', 'c103', 'c107']);
    expect(ids({ status: 'seen' })).toEqual(['c106']);
    expect(ids({ attribute: 'fire', status: 'owned' })).toEqual(['c102', 'c905']);
  });

  it('領完獎勵後不再顯示可領', () => {
    const one = claimCollectionReward(base(), ctx, 'c102');
    expect(one.ok).toBe(true);
    if (!one.ok) return;
    expect(collectionEntries(one.save, ctx).find((e) => e.card.id === 'c102')?.claimable).toBe(0);
    const all = claimAllCollectionRewards(one.save, ctx);
    expect(all.ok && all.gems).toBe(2);
    if (all.ok) expect(collectionEntries(all.save, ctx).every((e) => e.claimable === 0)).toBe(true);
  });
});
