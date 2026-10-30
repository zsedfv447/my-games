// 角色羈絆小劇場：玩家自己的角色（進化鏈算同一位）每出戰通關一場累積 1 點，10、30 場各解鎖一段小劇場。純邏輯，操作 SaveData。
import type { SaveData, StoryLine } from '../core/types';
import sceneData from '../../data/card-bonds.json';
import { addPoint, nextTierOf, tiersReached } from './bond-tiers';

export const CARD_BOND_TIERS = [10, 30] as const;

/** data/card-bonds.json 的一筆：family 是進化鏈最初型態的卡號，每個門檻一段小劇場 */
export interface CardBondDef {
  family: string;
  scenes: { title: string; lines: StoryLine[] }[];
}

export const CARD_BONDS = sceneData as CardBondDef[];
export const cardBondDef = (family: string, bonds: CardBondDef[] = CARD_BONDS) => bonds.find((b) => b.family === family);

export function cardBondPoints(save: SaveData, family: string): number {
  return save.cardBond?.[family] ?? 0;
}

export const cardBondLevel = (points: number) => tiersReached(CARD_BOND_TIERS, points);
export const nextCardBondTier = (points: number) => nextTierOf(CARD_BOND_TIERS, points);

/** 出戰隊員（玩家自己的卡 uid）對應的家族；同一家族只算一次 */
export function teamFamilies(save: SaveData, uids: string[], family: (cardId: string) => string): string[] {
  const ids = uids.flatMap((uid) => save.inventory.cards.find((c) => c.uid === uid)?.cardId ?? []);
  return [...new Set(ids.map(family))];
}

export interface CardBondGain {
  family: string;
  after: number;
  /** 這次新達成的門檻索引（0～1） */
  unlocked: number[];
}

/** 通關時呼叫：每個出戰家族 +1。撤退、失敗、借用隊伍不要呼叫 */
export function addCardBondsOnClear(save: SaveData, families: string[]): { save: SaveData; gains: CardBondGain[] } {
  let map = save.cardBond;
  const gains: CardBondGain[] = [];
  for (const family of families) {
    const g = addPoint(map, family, CARD_BOND_TIERS);
    map = g.map;
    gains.push({ family, after: g.after, unlocked: g.unlocked });
  }
  return { save: families.length ? { ...save, cardBond: map } : save, gains };
}
