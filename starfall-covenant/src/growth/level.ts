import type { CardDef, OwnedCard, PassiveEffect } from '../core/types';
import { LEGACY_EXP_CURVE, type GrowthRules } from './rules';

/** 升到 level 所需的累積經驗（Lv1 為 0） */
export function expForLevel(def: CardDef, level: number, rules: GrowthRules): number {
  const lv = Math.min(Math.max(1, Math.floor(level)), def.maxLevel);
  return Math.round(rules.expScale[def.rarity] * Math.pow(lv - 1, rules.expExponent));
}

export function maxExp(def: CardDef, rules: GrowthRules): number {
  return expForLevel(def, def.maxLevel, rules);
}

/** 由累積經驗推算等級 */
export function levelForExp(def: CardDef, exp: number, rules: GrowthRules): number {
  let lo = 1;
  let hi = def.maxLevel;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (expForLevel(def, mid, rules) <= exp) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/**
 * 經驗表改版後，把卡片的經驗換算到新曲線：**保留目前等級**，
 * 經驗 = 新曲線該級起點 + 舊曲線中該級內的進度比例 × 新曲線該級的寬度。
 * 已經落在新曲線該級區間內的卡不動，所以套用幾次結果都一樣。
 */
export function normalizeCardExp<C extends Pick<OwnedCard, 'level' | 'exp'>>(
  card: C, def: CardDef, rules: GrowthRules, legacy: Pick<GrowthRules, 'expScale' | 'expExponent'> = LEGACY_EXP_CURVE,
): C {
  const level = Math.min(Math.max(1, Math.floor(card.level)), def.maxLevel);
  const lo = expForLevel(def, level, rules);
  if (level >= def.maxLevel) {
    return card.level === level && card.exp === lo ? card : { ...card, level, exp: lo };
  }
  const hi = expForLevel(def, level + 1, rules);
  if (card.level === level && card.exp >= lo && card.exp < hi) return card;
  const old = { ...rules, ...legacy };
  const oldLo = expForLevel(def, level, old);
  const oldHi = expForLevel(def, level + 1, old);
  const t = oldHi > oldLo ? Math.min(Math.max((card.exp - oldLo) / (oldHi - oldLo), 0), 1) : 0;
  const exp = Math.min(hi - 1, lo + Math.floor(t * (hi - lo)));
  return { ...card, level, exp };
}

/** 距離下一級還差多少經驗；已滿級回傳 0 */
export function expToNextLevel(def: CardDef, owned: Pick<OwnedCard, 'level' | 'exp'>, rules: GrowthRules): number {
  if (owned.level >= def.maxLevel) return 0;
  return Math.max(0, expForLevel(def, owned.level + 1, rules) - owned.exp);
}

export interface CardStats { hp: number; atk: number; rcv: number }

/** 已解鎖的星紋覺醒被動，依解鎖順序 */
export function unlockedAwakenings(def: CardDef, owned: Pick<OwnedCard, 'awakened'>): PassiveEffect[] {
  return (def.awakenings ?? []).slice(0, owned.awakened);
}

/**
 * 卡片目前的能力值：
 * 等級曲線 min + (max − min) × t^growthCurve，乘上突破加成，再加上覺醒的 statUp。
 */
export function computeStats(
  def: CardDef, owned: Pick<OwnedCard, 'level' | 'limitBreak' | 'awakened'>, rules: GrowthRules,
): CardStats {
  const t = def.maxLevel <= 1 ? 1 : (Math.min(owned.level, def.maxLevel) - 1) / (def.maxLevel - 1);
  const curve = Math.pow(t, def.growthCurve);
  const lb = 1 + rules.limitBreakStatBonus * owned.limitBreak;
  const stat = (key: keyof CardStats) => {
    const [min, max] = def.stats[key];
    return (min + (max - min) * curve) * lb;
  };
  const result: CardStats = { hp: stat('hp'), atk: stat('atk'), rcv: stat('rcv') };
  for (const p of unlockedAwakenings(def, owned)) if (p.type === 'statUp') result[p.stat] += p.value;
  return { hp: Math.round(result.hp), atk: Math.round(result.atk), rcv: Math.round(result.rcv) };
}
