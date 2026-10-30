// 養成畫面（強化、技能、突破、覺醒、進化）用的純邏輯：列出可用素材、自動選素材、數值對比、被動說明。
// 規則本身在 growth/，這裡只整理成畫面需要的樣子，方便測試。
import type { CardDef, OwnedCard, PassiveEffect, SaveData } from '../../core/types';
import {
  computeStats, expForLevel, freeCards, materialCandidates, materialExp, maxSkillLevel, nextAwakening,
  type CardStats, type GrowthContext, type MaterialUse,
} from '../../growth';
import { ORB_NAMES } from '../art/palette';
import { STATUS_NAMES } from '../status-labels';

export type GrowthMode = 'enhance' | 'skill' | 'limit' | 'awaken';

export const GROWTH_MODES: { id: GrowthMode; label: string }[] = [
  { id: 'enhance', label: '強化' },
  { id: 'skill', label: '技能' },
  { id: 'limit', label: '突破' },
  { id: 'awaken', label: '覺醒' },
];

export function parseMode(raw: string | undefined): GrowthMode {
  return GROWTH_MODES.some((m) => m.id === raw) ? (raw as GrowthMode) : 'enhance';
}

export interface MaterialOption {
  owned: OwnedCard;
  def: CardDef;
  /** 強化時這張能給的經驗 */
  exp: number;
  sameAttribute: boolean;
}

const USE: Record<GrowthMode, MaterialUse> = { enhance: 'enhance', skill: 'skill', limit: 'limitBreak', awaken: 'awaken' };

/** 排序鍵：素材卡在前、同屬性在前、低稀有度在前 */
const sortKey = (m: MaterialOption) => (m.def.race === 'material' ? 0 : 100) + (m.sameAttribute ? 0 : 10) + m.def.rarity;

/** 各模式可以選的素材，排序：素材卡優先、同屬優先、低稀有度優先、低等級優先 */
export function materialOptions(save: SaveData, ctx: GrowthContext, targetUid: string, mode: GrowthMode): MaterialOption[] {
  const target = save.inventory.cards.find((c) => c.uid === targetUid);
  const tdef = target && ctx.card(target.cardId);
  if (!target || !tdef) return [];
  const list: MaterialOption[] = materialCandidates(save, ctx, targetUid, USE[mode]).map(({ owned, def }) => ({
    owned, def, exp: materialExp(tdef, def, owned, ctx), sameAttribute: def.attribute === tdef.attribute,
  }));
  return list.sort((a, b) => sortKey(a) - sortKey(b) || a.owned.level - b.owned.level || a.owned.obtainedAt - b.owned.obtainedAt);
}

/** 這個模式最多能選幾張 */
export function materialLimit(owned: OwnedCard, def: CardDef, ctx: GrowthContext, mode: GrowthMode): number {
  switch (mode) {
    case 'enhance': return owned.level >= def.maxLevel ? 0 : ctx.rules.maxMaterialsPerEnhance;
    case 'skill': return Math.max(0, maxSkillLevel(def, ctx) - owned.skillLevel);
    case 'limit': return Math.max(0, ctx.rules.maxLimitBreak - owned.limitBreak);
    case 'awaken': return nextAwakening(def, owned, ctx)?.materials ?? 0;
  }
}

/**
 * 強化自動選素材：只挑素材卡（不吃戰鬥卡），同屬性優先，
 * 經驗足夠升滿級就停，避免浪費。
 */
export function autoPickEnhance(save: SaveData, ctx: GrowthContext, targetUid: string): string[] {
  const target = save.inventory.cards.find((c) => c.uid === targetUid);
  const def = target && ctx.card(target.cardId);
  if (!target || !def || target.level >= def.maxLevel) return [];
  const need = expForLevel(def, def.maxLevel, ctx.rules) - target.exp;
  const pool = materialOptions(save, ctx, targetUid, 'enhance')
    .filter((m) => m.def.race === 'material')
    .sort((a, b) => Number(b.sameAttribute) - Number(a.sameAttribute) || b.exp - a.exp);
  const picks: string[] = [];
  let sum = 0;
  for (const m of pool) {
    if (picks.length >= ctx.rules.maxMaterialsPerEnhance || sum >= need) break;
    picks.push(m.owned.uid);
    sum += m.exp;
  }
  return picks;
}

/** 前 n 張（技能、突破、覺醒都是張數制） */
export function autoPickCount(options: MaterialOption[], n: number): string[] {
  return options.slice(0, Math.max(0, n)).map((m) => m.owned.uid);
}

/** 目前等級內的經驗進度 0–1；滿級為 1 */
export function levelProgress(def: CardDef, owned: Pick<OwnedCard, 'level' | 'exp'>, ctx: GrowthContext): number {
  if (owned.level >= def.maxLevel) return 1;
  const lo = expForLevel(def, owned.level, ctx.rules);
  const hi = expForLevel(def, owned.level + 1, ctx.rules);
  return hi > lo ? Math.min(1, Math.max(0, (owned.exp - lo) / (hi - lo))) : 1;
}

export interface StatLine { key: keyof CardStats; label: string; before: number; after: number }

const STAT_LABELS: Record<keyof CardStats, string> = { hp: '生命', atk: '攻擊', rcv: '回復' };

export function statLines(before: CardStats, after: CardStats): StatLine[] {
  return (['hp', 'atk', 'rcv'] as const).map((key) => ({ key, label: STAT_LABELS[key], before: before[key], after: after[key] }));
}

/** 進化前後對比：進化前（目前）、進化後 Lv1、進化後滿級 */
export function evolutionCompare(owned: OwnedCard, def: CardDef, toDef: CardDef, ctx: GrowthContext) {
  const now = computeStats(def, owned, ctx.rules);
  const after = { ...owned, level: 1, awakened: Math.min(owned.awakened, toDef.awakenings?.length ?? 0) };
  return {
    now,
    lv1: computeStats(toDef, after, ctx.rules),
    max: computeStats(toDef, { ...after, level: toDef.maxLevel }, ctx.rules),
  };
}

/** 進化需要的素材，依卡號合併成「需要幾張、背包有幾張可用」 */
export function evolutionNeeds(save: SaveData, ctx: GrowthContext, targetUid: string): { id: string; need: number; have: number }[] {
  const owned = save.inventory.cards.find((c) => c.uid === targetUid);
  const evo = owned && ctx.card(owned.cardId)?.evolution;
  if (!evo) return [];
  const pool = freeCards(save, targetUid);
  const counts = new Map<string, number>();
  for (const id of evo.materials) counts.set(id, (counts.get(id) ?? 0) + 1);
  return [...counts].map(([id, need]) => ({ id, need, have: pool.filter((c) => c.cardId === id).length }));
}

export function passiveText(p: PassiveEffect): string {
  switch (p.type) {
    case 'orbDamageUp': return `${ORB_NAMES[p.orb]}珠傷害 +${p.percent}%`;
    case 'moveTimeUp': return `轉珠時間 +${p.seconds} 秒`;
    case 'statUp': return `${STAT_LABELS[p.stat]} +${p.value.toLocaleString()}`;
    case 'resistStatus': return `${STATUS_NAMES[p.status]}抵抗 ${p.percent}%`;
  }
}
