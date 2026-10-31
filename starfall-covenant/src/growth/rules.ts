import type { Attribute, Rarity } from '../core/types';

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
  /** 通用突破素材：可以代替 1 張同名卡（星輝結晶） */
  limitBreakMaterialIds: string[];
  /** 每階突破提升的基礎數值比例 */
  limitBreakStatBonus: number;
  /** 第 i 個星紋覺醒需要的突破階數 */
  awakenLimitBreakGate: number[];
  /** 第 i 個星紋覺醒的金幣花費 */
  awakenCoin: number[];
  /** 第 i 個星紋覺醒需要的星核張數 */
  awakenMaterialCount: number[];
  /** 各屬性卡覺醒時使用的星核卡號 */
  awakenMaterialByAttribute: Record<Attribute, string>;
  maxInventoryCapacity: number;
  /** 販賣價 = sellValue × (1 + 此值 × (Lv − 1)) */
  sellLevelBonus: number;
  /** 強化時吃掉這個稀有度以上的角色卡（非素材卡）要先確認 */
  enhanceConfirmRarity: Rarity;
  /** 販賣這個稀有度以上的卡要二次確認 */
  sellConfirmRarity: Rarity;
  /** 背包剩餘格數小於等於此值時提醒玩家 */
  inventoryWarnFree: number;
  /** 第一次擁有某卡片時可領的星晶 */
  collectionGems: Record<Rarity, number>;
}

export const GROWTH_RULES: GrowthRules = {
  // 依 sim --progress 校正（tools/sim/reports/2026-10-31-card-exp-curve.md）：
  // 照主線推進，3★ 約第 3 章末滿級可進化，5★ 約第 5 章前段滿級；稀有度越高每級需要的經驗越多
  expScale: { 1: 100, 2: 104, 3: 108, 4: 110, 5: 112, 6: 116 },
  expExponent: 1.3,
  sameAttributeExpBonus: 1.5,
  materialLevelExpBonus: 0.1,
  enhanceCoinPerMaterialLevel: 100,
  maxMaterialsPerEnhance: 10,
  skillMaterialIds: [],
  maxLimitBreak: 5,
  limitBreakMaterialIds: ['c921'],
  limitBreakStatBonus: 0.04,
  // 分段解鎖：第 1 個覺醒不需突破，只有一張也能先體驗流派特色
  awakenLimitBreakGate: [0, 3, 5],
  // 依 sim --progress 校正：第 5 章 5★→6★ 進化（5 萬金幣）後，第 6 章前段仍付得起 1～2 個覺醒
  awakenCoin: [8000, 15000, 30000],
  awakenMaterialCount: [1, 2, 3],
  // 星核卡號依創意顧問提案 001
  awakenMaterialByAttribute: { fire: 'c916', water: 'c917', wood: 'c918', light: 'c919', dark: 'c920' },
  maxInventoryCapacity: 300,
  sellLevelBonus: 0.05,
  enhanceConfirmRarity: 4,
  sellConfirmRarity: 5,
  inventoryWarnFree: 5,
  collectionGems: { 1: 0, 2: 0, 3: 1, 4: 1, 5: 3, 6: 5 },
};

/** 經驗表調整（2026-10-31）之前的曲線；讀舊存檔時用來換算卡片經驗（見 level.ts 的 normalizeCardExp） */
export const LEGACY_EXP_CURVE: Pick<GrowthRules, 'expScale' | 'expExponent'> = {
  expScale: { 1: 2, 2: 3, 3: 4, 4: 6, 5: 8, 6: 10 },
  expExponent: 2.5,
};
