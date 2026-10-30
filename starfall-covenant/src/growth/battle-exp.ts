// 關卡結算：把關卡的卡片經驗發給出戰隊員（助戰、借來的隊伍不算）
import type { OwnedCard, SaveData } from '../core/types';
import type { GrowthContext } from './context';
import { levelForExp, maxExp, normalizeCardExp } from './level';
import { withCards } from './save-ops';

export interface CardExpGain {
  uid: string;
  cardId: string;
  /** 實際加到的經驗（滿級後不再增加） */
  expGained: number;
  levelBefore: number;
  levelAfter: number;
}

/**
 * 每位出戰隊員各得 exp 點經驗。uids 只放玩家自己的卡（不含助戰），
 * 重複或找不到的 uid 會略過；經驗不會超過滿級所需。
 */
export function grantBattleExp(
  save: SaveData, ctx: GrowthContext, uids: (string | null | undefined)[], exp: number,
): { save: SaveData; gains: CardExpGain[] } {
  const amount = Math.max(0, Math.floor(exp));
  const targets = new Set(uids.filter((u): u is string => !!u));
  if (amount === 0 || targets.size === 0) return { save, gains: [] };
  const gains: CardExpGain[] = [];
  const cards = save.inventory.cards.map((c): OwnedCard => {
    if (!targets.has(c.uid)) return c;
    const def = ctx.card(c.cardId);
    if (!def) return c;
    const newExp = Math.min(maxExp(def, ctx.rules), c.exp + amount);
    const level = Math.max(c.level, levelForExp(def, newExp, ctx.rules));
    gains.push({ uid: c.uid, cardId: c.cardId, expGained: Math.max(0, newExp - c.exp), levelBefore: c.level, levelAfter: level });
    return newExp > c.exp ? { ...c, exp: newExp, level } : c;
  });
  return { save: withCards(save, cards), gains };
}

/** 讀檔時對背包所有卡套用 normalizeCardExp（經驗表改版）；沒有任何變動時回傳原存檔 */
export function normalizeSaveCardExp(save: SaveData, ctx: GrowthContext): SaveData {
  let changed = false;
  const cards = save.inventory.cards.map((c) => {
    const def = ctx.card(c.cardId);
    const next = def ? normalizeCardExp(c, def, ctx.rules) : c;
    if (next !== c) changed = true;
    return next;
  });
  return changed ? withCards(save, cards) : save;
}
