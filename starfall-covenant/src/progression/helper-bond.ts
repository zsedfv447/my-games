// 流浪契印師的同行情誼：借用 NPC 助戰並通關一次加 1 點，到門檻解鎖短劇情與結算感謝台詞。純邏輯，操作 SaveData。
import type { SaveData, StoryLine } from '../core/types';
import type { HelperNpcDef } from './helpers';
import bondData from '../../data/helper-bonds.json';
import { addPoint, nextTierOf, tiersReached } from './bond-tiers';

/** 情誼門檻：依序解鎖第 1～3 段劇情與感謝台詞；最後一個門檻另送頭像框 */
export const BOND_TIERS = [5, 10, 20] as const;
export const BOND_FRAME_TIER = BOND_TIERS.length - 1;

/** data/helper-bonds.json 的一筆：每位 NPC 三段劇情、三句感謝台詞（對應三個門檻） */
export interface HelperBondDef {
  npc: string;
  stories: { title: string; lines: StoryLine[] }[];
  thanks: string[];
}

export function bondPoints(save: SaveData, npcId: string): number {
  return save.helperBond?.[npcId] ?? 0;
}

/** 已達成的門檻數（0～3） */
export function bondLevel(points: number): number {
  return tiersReached(BOND_TIERS, points);
}

/** 下一個門檻；全部達成時為 null */
export function nextBondTier(points: number): number | null {
  return nextTierOf(BOND_TIERS, points);
}

export const hasBondFrame = (points: number) => bondLevel(points) > BOND_FRAME_TIER;

/** 由助戰卡找出是哪位 NPC 帶來的（每張卡只屬於一位 NPC） */
export function npcForHelperCard(cardId: string, npcs: HelperNpcDef[]): HelperNpcDef | undefined {
  return npcs.find((n) => n.tiers.some((t) => t.card === cardId));
}

export interface BondGain {
  save: SaveData;
  before: number;
  after: number;
  /** 這次新達成的門檻索引（0～2）；點數只會增加，同一個門檻不會再出現第二次 */
  unlocked: number[];
}

/** 通關時呼叫：借用的 NPC 情誼 +1。撤退、失敗不要呼叫 */
export function addBondOnClear(save: SaveData, npcId: string): BondGain {
  const { map, ...gain } = addPoint(save.helperBond, npcId, BOND_TIERS);
  return { save: { ...save, helperBond: map }, ...gain };
}

export const HELPER_BONDS = bondData as HelperBondDef[];
export const bondDef = (npcId: string, bonds: HelperBondDef[] = HELPER_BONDS) => bonds.find((b) => b.npc === npcId);
