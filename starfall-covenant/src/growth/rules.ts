import type { Rarity } from '../core/types';

/**
 * 養成數值規則。GDD 只定了方向（同屬經驗 ×1.5、突破 +5 階、覺醒 3 個），
 * 其餘數字是第一版的可調參數，之後用模擬器校正；要搬進 config.json 時只需改這裡。
 */
export interface GrowthRules {
  /** 升到 Lv L 所需的累積經驗 = round(expScale[稀有度] × (L − 1) ^ expExponent) */
  expScale: Record<Rarity, number>;
  expExponent: number;
  /** 素材與目標同屬性時的經驗倍率 */
  sameAttributeExpBonus: number;
  /** 素材每高 1 級，多給 expValue 的比例 */
  materialLevelExpBonus: number;
  /** 強化金幣 = 素材數 × 目標等級 × 此值 */
  enhanceCoinPerMaterialLevel: number;
  maxMaterialsPerEnhance: number;
  /** 可用來升技能的指定素材卡號（吞同名卡之外的途徑） */
  skillMaterialIds: string[];
  maxLimitBreak: number;
  /** 每階突破提升的基礎數值比例 */
  limitBreakStatBonus: number;
  /** 第 i 個星紋覺醒需要的突破階數 */
  awakenLimitBreakGate: number[];
  /** 第 i 個星紋覺醒的金幣花費 */
  awakenCoin: number[];
  /** 第 i 個星紋覺醒需要的同屬素材卡張數 */
  awakenMaterialCount: number[];
  maxInventoryCapacity: number;
  /** 販賣價 = sellValue × (1 + 此值 × (Lv − 1)) */
  sellLevelBonus: number;
  /** 第一次擁有某卡片時可領的星晶 */
  collectionGems: Record<Rarity, number>;
}

export const GROWTH_RULES: GrowthRules = {
  expScale: { 1: 2, 2: 3, 3: 4, 4: 6, 5: 8, 6: 10 },
  expExponent: 2.5,
  sameAttributeExpBonus: 1.5,
  materialLevelExpBonus: 0.1,
  enhanceCoinPerMaterialLevel: 100,
  maxMaterialsPerEnhance: 10,
  skillMaterialIds: [],
  maxLimitBreak: 5,
  limitBreakStatBonus: 0.04,
  // GDD 寫「+5 時解鎖星紋覺醒」。為了讓抽到 1 張就能先體驗流派覺醒，
  // 這裡改成 +1／+3／+5 分段解鎖；若總監要照原文，改成 [5, 5, 5] 即可。
  awakenLimitBreakGate: [1, 3, 5],
  awakenCoin: [20000, 50000, 100000],
  awakenMaterialCount: [1, 2, 3],
  maxInventoryCapacity: 300,
  sellLevelBonus: 0.05,
  collectionGems: { 1: 0, 2: 0, 3: 1, 4: 1, 5: 3, 6: 5 },
};
