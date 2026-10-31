// 養成模組內部用的存檔小工具：一律回傳新物件，不改動傳入的存檔
import type { CardDef, OwnedCard, SaveData } from '../core/types';
import type { GrowthContext } from './context';
import { fail, type GrowthFailure } from './result';

export function findCard(save: SaveData, uid: string): OwnedCard | undefined {
  return save.inventory.cards.find((c) => c.uid === uid);
}

export function teamUids(save: SaveData): Set<string> {
  const set = new Set<string>();
  for (const team of save.teams) for (const m of team.members) if (m) set.add(m);
  return set;
}

/** 星靈遠行中的卡（SaveData.expeditions，選填）：遠行中的卡不能養成、販賣或當素材 */
export function expeditionUids(save: SaveData): Set<string> {
  return new Set((save.expeditions ?? []).flatMap((e) => e.uids));
}

export function withCards(save: SaveData, cards: OwnedCard[]): SaveData {
  return { ...save, inventory: { ...save.inventory, cards } };
}

export function replaceCard(save: SaveData, card: OwnedCard, removeUids: Iterable<string> = []): SaveData {
  const remove = new Set(removeUids);
  return withCards(
    save,
    save.inventory.cards.filter((c) => !remove.has(c.uid)).map((c) => (c.uid === card.uid ? card : c)),
  );
}

export function addCoin(save: SaveData, delta: number): SaveData {
  return { ...save, player: { ...save.player, coin: save.player.coin + delta } };
}

export function addGems(save: SaveData, delta: number): SaveData {
  return { ...save, player: { ...save.player, gems: save.player.gems + delta } };
}

/** 找出目標卡與其卡片定義 */
export function resolveTarget(
  save: SaveData, ctx: GrowthContext, uid: string,
): { owned: OwnedCard; def: CardDef } | GrowthFailure {
  const owned = findCard(save, uid);
  if (!owned) return fail('cardNotFound', '找不到這張卡片', uid);
  if (expeditionUids(save).has(uid)) return fail('cardOnExpedition', '這張卡正在星靈遠行，回來後才能養成', uid);
  const def = ctx.card(owned.cardId);
  if (!def) return fail('unknownCard', `卡片資料 ${owned.cardId} 不存在`, owned.cardId);
  return { owned, def };
}

export interface MaterialPick { owned: OwnedCard; def: CardDef }

/**
 * 檢查要被吃掉（或賣掉）的卡：存在、不重複、不是目標本身、沒上鎖、不在任何隊伍裡。
 */
export function resolveMaterials(
  save: SaveData, ctx: GrowthContext, uids: string[], targetUid?: string,
): MaterialPick[] | GrowthFailure {
  if (uids.length === 0) return fail('noMaterials', '請先選擇素材');
  const inTeam = teamUids(save);
  const away = expeditionUids(save);
  const seen = new Set<string>();
  const picks: MaterialPick[] = [];
  for (const uid of uids) {
    if (uid === targetUid) return fail('materialIsTarget', '不能把自己當成素材', uid);
    if (seen.has(uid)) return fail('materialDuplicated', '同一張素材被選了兩次', uid);
    seen.add(uid);
    const owned = findCard(save, uid);
    if (!owned) return fail('materialNotFound', '找不到選擇的素材', uid);
    if (owned.locked) return fail('materialLocked', '上鎖的卡片不能當素材，請先解鎖', uid);
    if (inTeam.has(uid)) return fail('materialInTeam', '隊伍中的卡片不能當素材', uid);
    if (away.has(uid)) return fail('materialOnExpedition', '遠行中的卡片不能當素材', uid);
    const def = ctx.card(owned.cardId);
    if (!def) return fail('unknownCard', `卡片資料 ${owned.cardId} 不存在`, owned.cardId);
    picks.push({ owned, def });
  }
  return picks;
}

export const isFailure = (x: unknown): x is GrowthFailure =>
  typeof x === 'object' && x !== null && (x as { ok?: unknown }).ok === false;
