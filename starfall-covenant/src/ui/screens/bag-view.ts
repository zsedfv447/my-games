// 卡片背包畫面的篩選狀態：畫面上的勾選 → growth 的 CardFilter
import { ATTRIBUTES, RACES, type Attribute, type Race, type Rarity } from '../../core/types';
import type { CardFilter } from '../../growth';

export interface BagFilterState {
  attribute: Attribute[];
  rarity: Rarity[];
  race: Race[];
}

export const emptyBagFilter = (): BagFilterState => ({ attribute: [], rarity: [], race: [] });

/** 稀有度按鈕：低星合併成一顆，方便挑出素材與低星卡 */
export const RARITY_CHIPS: { label: string; values: Rarity[] }[] = [
  { label: '1–3★', values: [1, 2, 3] },
  { label: '4★', values: [4] },
  { label: '5★', values: [5] },
  { label: '6★', values: [6] },
];

export const ATTRIBUTE_CHIPS = ATTRIBUTES;
export const RACE_CHIPS = RACES;

/** 勾選或取消一組值（全部都在就整組移除，否則整組加入） */
export function toggleValues<T>(list: T[], values: T[]): T[] {
  const all = values.every((v) => list.includes(v));
  return all ? list.filter((v) => !values.includes(v)) : [...list, ...values.filter((v) => !list.includes(v))];
}

export function activeFilterCount(f: BagFilterState): number {
  return f.attribute.length + RARITY_CHIPS.filter((c) => c.values.every((v) => f.rarity.includes(v))).length + f.race.length;
}

export function toCardFilter(f: BagFilterState): CardFilter {
  return { attribute: f.attribute, rarity: f.rarity, race: f.race };
}
