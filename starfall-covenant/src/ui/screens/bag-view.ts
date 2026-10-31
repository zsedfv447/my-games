// 卡片背包畫面的篩選狀態：畫面上的勾選 → growth 的 CardFilter（只放記憶體，不進存檔）
import { ATTRIBUTES, RACES, type ArchetypeId, type Attribute, type OwnedCard, type Race, type Rarity, type SaveData } from '../../core/types';
import { canEvolveNow, filterCards, type CardFilter, type GrowthContext } from '../../growth';

export interface BagFilterState {
  attribute: Attribute[];
  rarity: Rarity[];
  race: Race[];
  archetype: ArchetypeId[];
  /** 卡名關鍵字 */
  text: string;
  /** 角色卡／素材卡 */
  kind: 'all' | 'unit' | 'material';
  /** 只看有進化路線的卡 */
  evolvable: boolean;
  /** 只看現在就能進化的卡（滿級、素材與金幣都夠） */
  evolveReady: boolean;
}

export const emptyBagFilter = (): BagFilterState => ({
  attribute: [], rarity: [], race: [], archetype: [], text: '', kind: 'all', evolvable: false, evolveReady: false,
});

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
  return f.attribute.length + RARITY_CHIPS.filter((c) => c.values.every((v) => f.rarity.includes(v))).length + f.race.length + f.archetype.length
    + (f.text.trim() ? 1 : 0) + (f.kind !== 'all' ? 1 : 0) + Number(f.evolvable) + Number(f.evolveReady);
}

export function toCardFilter(f: BagFilterState): CardFilter {
  return {
    attribute: f.attribute, rarity: f.rarity, race: f.race, archetype: f.archetype,
    text: f.text.trim() || undefined,
    material: f.kind === 'all' ? undefined : f.kind === 'material',
    evolvable: f.evolvable || f.evolveReady ? true : undefined,
  };
}

/** 背包要顯示的卡：growth 的 filterCards，再加上「現在可以進化」（用 growth 的 evolve 檢查） */
export function applyBagFilter(save: SaveData, ctx: GrowthContext, f: BagFilterState): OwnedCard[] {
  const list = filterCards(save, ctx, toCardFilter(f));
  return f.evolveReady ? list.filter((c) => canEvolveNow(save, ctx, c.uid)) : list;
}
