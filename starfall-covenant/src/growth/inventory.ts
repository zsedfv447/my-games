import type {
  ArchetypeId, ArchetypeRole, Attribute, CardDef, OwnedCard, Race, Rarity, SaveData,
} from '../core/types';
import type { GrowthContext } from './context';
import { markOwned, markSeen } from './collection';
import { fail, type GrowthResult } from './result';
import { expForLevel } from './level';
import { addCoin, addGems, findCard, isFailure, resolveMaterials, teamUids, withCards } from './save-ops';

// ---------- 加入卡片 ----------

/** 依現有 uid 產生下一個不重複的 uid（u1、u2…），不依賴亂數或時間 */
function uidAllocator(save: SaveData): () => string {
  let n = 0;
  for (const c of save.inventory.cards) {
    const m = /^u(\d+)$/.exec(c.uid);
    if (m) n = Math.max(n, Number(m[1]));
  }
  return () => `u${++n}`;
}

export function newOwnedCard(uid: string, cardId: string, now: number, level = 1): OwnedCard {
  return { uid, cardId, level, exp: 0, skillLevel: 1, limitBreak: 0, awakened: 0, locked: false, obtainedAt: now };
}

/**
 * 把抽卡、掉落、獎勵得到的卡放進背包。背包滿了放不下的卡回傳在 overflow，
 * 由呼叫端決定要提示玩家或另外保存；放不下的卡仍會記為「見過」。
 * 指定 level 的卡（例如掉落 Lv5）會帶上對應經驗。
 */
export function addCards(
  save: SaveData, ctx: GrowthContext, cards: (string | { card: string; level?: number })[], now: number,
): GrowthResult<{ added: OwnedCard[]; overflow: string[] }> {
  const nextUid = uidAllocator(save);
  const added: OwnedCard[] = [];
  const overflow: string[] = [];
  let room = save.inventory.capacity - save.inventory.cards.length;
  for (const entry of cards) {
    const { card: cardId, level } = typeof entry === 'string' ? { card: entry, level: undefined } : entry;
    const def = ctx.card(cardId);
    if (!def) return fail('unknownCard', `卡片資料 ${cardId} 不存在`, cardId);
    if (room <= 0) { overflow.push(cardId); continue; }
    room--;
    const lv = Math.min(Math.max(1, level ?? 1), def.maxLevel);
    const owned = newOwnedCard(nextUid(), cardId, now, lv);
    owned.exp = expForLevel(def, lv, ctx.rules);
    added.push(owned);
  }
  let next = withCards(save, [...save.inventory.cards, ...added]);
  next = markOwned(next, added.map((c) => c.cardId));
  next = markSeen(next, overflow);
  return { ok: true, save: next, added, overflow };
}

export function inventoryUsage(save: SaveData): { used: number; capacity: number; free: number } {
  const used = save.inventory.cards.length;
  return { used, capacity: save.inventory.capacity, free: Math.max(0, save.inventory.capacity - used) };
}

// ---------- 上鎖 ----------

export function setLocked(save: SaveData, uids: string | string[], locked: boolean): GrowthResult<{ changed: string[] }> {
  const list = Array.isArray(uids) ? uids : [uids];
  for (const uid of list) if (!findCard(save, uid)) return fail('cardNotFound', '找不到這張卡片', uid);
  const set = new Set(list);
  const changed: string[] = [];
  const cards = save.inventory.cards.map((c) => {
    if (!set.has(c.uid) || c.locked === locked) return c;
    changed.push(c.uid);
    return { ...c, locked };
  });
  return { ok: true, save: withCards(save, cards), changed };
}

// ---------- 擴充 ----------

/** 用星晶擴充背包，一次 +expandStep 格 */
export function expandInventory(save: SaveData, ctx: GrowthContext, times = 1): GrowthResult<{ capacity: number; gems: number }> {
  const { expandStep, expandCostGems } = ctx.config.inventory;
  const n = Math.max(1, Math.floor(times));
  const capacity = save.inventory.capacity + expandStep * n;
  if (capacity > ctx.rules.maxInventoryCapacity) {
    return fail('capacityMax', `背包最多 ${ctx.rules.maxInventoryCapacity} 格`);
  }
  const gems = expandCostGems * n;
  if (save.player.gems < gems) return fail('notEnoughGems', `星晶不足，需要 ${gems}`);
  const next = addGems(save, -gems);
  return { ok: true, save: { ...next, inventory: { ...next.inventory, capacity } }, capacity, gems };
}

// ---------- 販賣 ----------

export function sellPrice(owned: Pick<OwnedCard, 'level'>, def: CardDef, ctx: GrowthContext): number {
  return Math.floor(def.sellValue * (1 + ctx.rules.sellLevelBonus * (owned.level - 1)));
}

export type SellBlockReason = 'locked' | 'inTeam';

/** 這張卡能不能賣；能賣回傳 null */
export function sellBlockReason(save: SaveData, uid: string, inTeam = teamUids(save)): SellBlockReason | null {
  const c = findCard(save, uid);
  if (c?.locked) return 'locked';
  if (inTeam.has(uid)) return 'inTeam';
  return null;
}

export interface SellPreview {
  /** 可以賣的卡（已排除上鎖、隊伍中、找不到的） */
  sellable: string[];
  blocked: { uid: string; reason: SellBlockReason }[];
  coin: number;
  /** 達到 sellConfirmRarity 的卡，販賣前要二次確認 */
  highRarity: string[];
  needsConfirm: boolean;
}

/** 販賣預覽：把選取的卡分成可賣與不可賣，算出金幣與是否需要二次確認（不改存檔） */
export function previewSell(save: SaveData, ctx: GrowthContext, uids: string[]): SellPreview {
  const inTeam = teamUids(save);
  const sellable: string[] = [];
  const blocked: SellPreview['blocked'] = [];
  const highRarity: string[] = [];
  let coin = 0;
  for (const uid of new Set(uids)) {
    const owned = findCard(save, uid);
    const def = owned && ctx.card(owned.cardId);
    if (!owned || !def) continue;
    const reason = sellBlockReason(save, uid, inTeam);
    if (reason) { blocked.push({ uid, reason }); continue; }
    sellable.push(uid);
    coin += sellPrice(owned, def, ctx);
    if (def.rarity >= ctx.rules.sellConfirmRarity) highRarity.push(uid);
  }
  return { sellable, blocked, coin, highRarity, needsConfirm: highRarity.length > 0 };
}

/** 背包提醒：滿了、快滿了或不需要提醒 */
export function inventoryWarning(save: SaveData, ctx: GrowthContext): 'full' | 'almostFull' | null {
  const { free } = inventoryUsage(save);
  if (free <= 0) return 'full';
  return free <= ctx.rules.inventoryWarnFree ? 'almostFull' : null;
}

/**
 * 批次販賣：上鎖或在隊伍中的卡會整批拒絕，避免誤賣。
 * 包含高星卡（sellConfirmRarity 以上，預設 5★）時，必須帶 confirmHighRarity 才會執行。
 */
export function sellCards(
  save: SaveData, ctx: GrowthContext, uids: string[], opts: { confirmHighRarity?: boolean } = {},
): GrowthResult<{ coin: number; sold: string[] }> {
  const picks = resolveMaterials(save, ctx, uids);
  if (isFailure(picks)) {
    const map: Partial<Record<string, ['cardLocked' | 'cardInTeam', string]>> = {
      materialLocked: ['cardLocked', '上鎖的卡片不能販賣，請先解鎖'],
      materialInTeam: ['cardInTeam', '隊伍中的卡片不能販賣'],
    };
    const remap = map[picks.error.code];
    return remap ? fail(remap[0], remap[1], picks.error.subject) : picks;
  }
  const high = picks.filter((p) => p.def.rarity >= ctx.rules.sellConfirmRarity);
  if (high.length && !opts.confirmHighRarity) {
    return fail('confirmRequired', `包含 ${high.length} 張 ${ctx.rules.sellConfirmRarity}★ 以上的卡，請再次確認`, high[0].owned.uid);
  }
  const coin = picks.reduce((sum, p) => sum + sellPrice(p.owned, p.def, ctx), 0);
  const remove = new Set(uids);
  const next = addCoin(withCards(save, save.inventory.cards.filter((c) => !remove.has(c.uid))), coin);
  return { ok: true, save: next, coin, sold: [...uids] };
}

// ---------- 篩選 ----------

export interface CardFilter {
  attribute?: Attribute[];
  race?: Race[];
  rarity?: Rarity[];
  minLevel?: number;
  maxLevel?: number;
  /** 屬於任一指定流派（可再限定角色） */
  archetype?: ArchetypeId[];
  role?: ArchetypeRole[];
  locked?: boolean;
  inTeam?: boolean;
  /** true＝只看已滿級；false＝只看未滿級 */
  maxed?: boolean;
  /** 只看可以進化的卡（有進化型態，不論等級） */
  evolvable?: boolean;
  /** 只看素材卡或只看戰鬥卡 */
  material?: boolean;
  /** 卡名關鍵字 */
  text?: string;
}

export function filterCards(save: SaveData, ctx: GrowthContext, filter: CardFilter, cards = save.inventory.cards): OwnedCard[] {
  const inTeam = teamUids(save);
  return cards.filter((c) => {
    const def = ctx.card(c.cardId);
    if (!def) return false;
    if (filter.attribute?.length && !filter.attribute.includes(def.attribute)) return false;
    if (filter.race?.length && !filter.race.includes(def.race)) return false;
    if (filter.rarity?.length && !filter.rarity.includes(def.rarity)) return false;
    if (filter.minLevel !== undefined && c.level < filter.minLevel) return false;
    if (filter.maxLevel !== undefined && c.level > filter.maxLevel) return false;
    if (filter.archetype?.length || filter.role?.length) {
      const hit = def.archetypes.some((a) =>
        (!filter.archetype?.length || filter.archetype.includes(a.id)) && (!filter.role?.length || filter.role.includes(a.role)));
      if (!hit) return false;
    }
    if (filter.locked !== undefined && c.locked !== filter.locked) return false;
    if (filter.inTeam !== undefined && inTeam.has(c.uid) !== filter.inTeam) return false;
    if (filter.maxed !== undefined && (c.level >= def.maxLevel) !== filter.maxed) return false;
    if (filter.evolvable !== undefined && Boolean(def.evolution) !== filter.evolvable) return false;
    if (filter.material !== undefined && (def.race === 'material') !== filter.material) return false;
    if (filter.text && !def.name.includes(filter.text)) return false;
    return true;
  });
}

// ---------- 排序 ----------

export type SortKey = 'obtainedAt' | 'rarity' | 'level' | 'attribute' | 'race' | 'cardId' | 'hp' | 'atk' | 'rcv' | 'cost';

/**
 * 排序（回傳新陣列）。同值時依稀有度高→低、卡號、uid 排，結果穩定。
 * 能力值排序需要傳入 stats 函式（通常是 computeStats），避免這裡重算曲線。
 */
export function sortCards(
  cards: OwnedCard[], ctx: GrowthContext, key: SortKey, order: 'asc' | 'desc' = 'desc',
  stats?: (c: OwnedCard, def: CardDef) => { hp: number; atk: number; rcv: number },
): OwnedCard[] {
  const attrOrder = ['fire', 'water', 'wood', 'light', 'dark'];
  const raceOrder = ['beast', 'dragon', 'machina', 'sylph', 'nether', 'human', 'material'];
  const value = (c: OwnedCard): number | string => {
    const def = ctx.card(c.cardId);
    if (!def) return 0;
    switch (key) {
      case 'obtainedAt': return c.obtainedAt;
      case 'rarity': return def.rarity;
      case 'level': return c.level;
      case 'attribute': return attrOrder.indexOf(def.attribute);
      case 'race': return raceOrder.indexOf(def.race);
      case 'cardId': return def.id;
      case 'cost': return def.cost;
      case 'hp': case 'atk': case 'rcv': return stats ? stats(c, def)[key] : 0;
    }
  };
  const cmp = (a: number | string, b: number | string) => (a < b ? -1 : a > b ? 1 : 0);
  const dir = order === 'asc' ? 1 : -1;
  return [...cards].sort((a, b) =>
    dir * cmp(value(a), value(b))
    || cmp(ctx.card(b.cardId)?.rarity ?? 0, ctx.card(a.cardId)?.rarity ?? 0)
    || cmp(a.cardId, b.cardId)
    || cmp(a.uid, b.uid));
}
