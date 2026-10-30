import type { ArchetypeId, CardDef, SaveData } from '../core/types';
import type { GrowthContext } from './context';
import { fail, type GrowthResult } from './result';
import { addGems } from './save-ops';

const addUnique = (list: string[], ids: Iterable<string>): string[] => {
  const set = new Set(list);
  const out = [...list];
  for (const id of ids) if (!set.has(id)) { set.add(id); out.push(id); }
  return out;
};

/** 記錄「見過」：在卡池、掉落預覽、敵方等地方看到的卡 */
export function markSeen(save: SaveData, cardIds: Iterable<string>): SaveData {
  const seen = addUnique(save.collection.seen, cardIds);
  if (seen.length === save.collection.seen.length) return save;
  return { ...save, collection: { ...save.collection, seen } };
}

/** 記錄「擁有過」：同時也算見過。賣掉或吃掉卡片後圖鑑仍保留。 */
export function markOwned(save: SaveData, cardIds: Iterable<string>): SaveData {
  const ids = [...cardIds];
  const owned = addUnique(save.collection.owned, ids);
  const seen = addUnique(save.collection.seen, ids);
  if (owned.length === save.collection.owned.length && seen.length === save.collection.seen.length) return save;
  return { ...save, collection: { ...save.collection, owned, seen } };
}

export function collectionReward(ctx: GrowthContext, cardId: string): number {
  const def = ctx.card(cardId);
  return def ? ctx.rules.collectionGems[def.rarity] ?? 0 : 0;
}

/** 已擁有但還沒領獎、且有獎勵的卡號 */
export function claimableCollection(save: SaveData, ctx: GrowthContext): string[] {
  const claimed = new Set(save.collection.claimed);
  return save.collection.owned.filter((id) => !claimed.has(id) && collectionReward(ctx, id) > 0);
}

export function claimCollectionReward(
  save: SaveData, ctx: GrowthContext, cardId: string,
): GrowthResult<{ gems: number }> {
  if (!save.collection.owned.includes(cardId)) return fail('notOwned', '還沒擁有這張卡片', cardId);
  if (save.collection.claimed.includes(cardId)) return fail('alreadyClaimed', '這張卡的圖鑑獎勵已經領過', cardId);
  const gems = collectionReward(ctx, cardId);
  const next = addGems(save, gems);
  return { ok: true, save: { ...next, collection: { ...next.collection, claimed: [...next.collection.claimed, cardId] } }, gems };
}

/** 一次領取所有圖鑑獎勵 */
export function claimAllCollectionRewards(save: SaveData, ctx: GrowthContext): GrowthResult<{ gems: number; cards: string[] }> {
  const cards = claimableCollection(save, ctx);
  const gems = cards.reduce((sum, id) => sum + collectionReward(ctx, id), 0);
  const next = addGems(save, gems);
  return {
    ok: true,
    save: { ...next, collection: { ...next.collection, claimed: [...next.collection.claimed, ...cards] } },
    gems,
    cards,
  };
}

export interface CollectionSummary {
  total: number;
  seen: number;
  owned: number;
  /** 依稀有度統計已擁有／總數，素材卡另計 */
  byRarity: Record<number, { owned: number; total: number }>;
  materials: { owned: number; total: number };
}

export function collectionSummary(save: SaveData, ctx: GrowthContext): CollectionSummary {
  const owned = new Set(save.collection.owned);
  const seen = new Set(save.collection.seen);
  const byRarity: CollectionSummary['byRarity'] = {};
  const materials = { owned: 0, total: 0 };
  for (const c of ctx.data.cards) {
    const bucket = c.race === 'material' ? materials : (byRarity[c.rarity] ??= { owned: 0, total: 0 });
    bucket.total++;
    if (owned.has(c.id)) bucket.owned++;
  }
  return {
    total: ctx.data.cards.length,
    seen: ctx.data.cards.filter((c) => seen.has(c.id) || owned.has(c.id)).length,
    owned: ctx.data.cards.filter((c) => owned.has(c.id)).length,
    byRarity,
    materials,
  };
}

export type CollectionStatus = 'owned' | 'seen' | 'unseen';

export function collectionStatus(save: SaveData, cardId: string): CollectionStatus {
  if (save.collection.owned.includes(cardId)) return 'owned';
  return save.collection.seen.includes(cardId) ? 'seen' : 'unseen';
}

/** 圖鑑篩選：不填的欄位代表不限；素材卡沒有流派，選流派時會被排除 */
export interface CollectionFilter {
  attribute?: CardDef['attribute'];
  race?: CardDef['race'];
  archetype?: ArchetypeId;
  status?: CollectionStatus;
}

export interface CollectionEntry {
  card: CardDef;
  status: CollectionStatus;
  /** 擁有過但還沒領的圖鑑獎勵鑽石數（0 代表沒有可領的） */
  claimable: number;
}

/** 依圖鑑順序（卡號）列出卡片與收集狀態 */
export function collectionEntries(save: SaveData, ctx: GrowthContext, filter: CollectionFilter = {}): CollectionEntry[] {
  const claimed = new Set(save.collection.claimed);
  return [...ctx.data.cards]
    .sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }))
    .map((card) => {
      const status = collectionStatus(save, card.id);
      const claimable = status === 'owned' && !claimed.has(card.id) ? collectionReward(ctx, card.id) : 0;
      return { card, status, claimable };
    })
    .filter(({ card, status }) =>
      (!filter.attribute || card.attribute === filter.attribute)
      && (!filter.race || card.race === filter.race)
      && (!filter.archetype || card.archetypes.some((a) => a.id === filter.archetype))
      && (!filter.status || status === filter.status));
}
