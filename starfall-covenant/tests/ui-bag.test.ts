import { describe, expect, it } from 'vitest';
import { filterCards } from '../src/growth';
import { activeFilterCount, emptyBagFilter, RARITY_CHIPS, toCardFilter, toggleValues } from '../src/ui/screens/bag-view';
import { ctx, makeSave, owned } from './growth/fixtures';

describe('卡片背包篩選', () => {
  it('勾選與取消：整組值一起切換', () => {
    expect(toggleValues([], [1, 2, 3])).toEqual([1, 2, 3]);
    expect(toggleValues([1, 2, 3, 5], [1, 2, 3])).toEqual([5]);
    expect(toggleValues([2], [1, 2, 3])).toEqual([2, 1, 3]);
  });

  it('計算啟用中的篩選數（低星合併算一顆）', () => {
    const f = emptyBagFilter();
    expect(activeFilterCount(f)).toBe(0);
    expect(activeFilterCount({ ...f, attribute: ['fire', 'water'], rarity: RARITY_CHIPS[0].values, race: ['material'], archetype: ['combo'] })).toBe(5);
  });

  it('轉成 growth 的 CardFilter 後可以篩出對應卡片', () => {
    const save = makeSave([owned('a', 'c102'), owned('b', 'c905'), owned('c', 'c206')]);
    const f = { ...emptyBagFilter(), attribute: ['fire' as const], race: ['material' as const] };
    expect(filterCards(save, ctx, toCardFilter(f)).map((c) => c.uid)).toEqual(['b']);
    expect(filterCards(save, ctx, toCardFilter({ ...emptyBagFilter(), rarity: [5, 6] })).map((c) => c.uid)).toEqual(['a']);
    expect(filterCards(save, ctx, toCardFilter(emptyBagFilter()))).toHaveLength(3);
    expect(filterCards(save, ctx, toCardFilter({ ...emptyBagFilter(), archetype: ['combo'] })).map((c) => c.uid)).toEqual(['c']);
  });
});
