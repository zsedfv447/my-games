// 星核供需估算：照主線推進到某一關時，各屬性能拿到幾顆星核（npm run sim -- --cores）
// 來源：每日「星核試煉」掉落（沿用 progress.ts 的推進假設）、關卡首通（主線／外傳）、
//       依天數計算的每週來源（流派克星週每週首通、商店金幣每週限購）。
import type { Attribute, StageDef } from '../../src/core/types';
import type { EventDef } from '../../src/progression/events';
import type { GrowthContext } from '../../src/growth';
import { estimateProgress, PROGRESS_ASSUMPTIONS } from './progress';

const ATTRS: Attribute[] = ['fire', 'water', 'wood', 'light', 'dark'];

export interface CoreAssumptions {
  /** 每天的體力：自然回復（每 5 分鐘 1 點）＋偶爾升級補滿，取整數估算 */
  staminaPerDay: number;
  /** 商店金幣星核（每週限購 1）有買的比例：金幣同時要留給進化（5★ 進化 5 萬） */
  shopBuyShare: number;
}

export const CORE_ASSUMPTIONS: CoreAssumptions = { staminaPerDay: 300, shopBuyShare: 0.5 };

export interface CoreSupply {
  stageId: string;
  days: number;
  /** 星核試煉掉落（progress.ts 的假設，不考慮星期限制） */
  daily: number;
  /** 考慮只有週三六日能打之後的星核試煉 */
  dailyByWeekday: number;
  /** 首通拿到的（主線、外傳） */
  oneTime: number;
  /** 流派克星週每週首通：依主題屬性輪替，6 週一輪 */
  nemesis: number;
  shop: number;
  /** 星核試煉（照星期）＋首通，不含每週來源（最保守） */
  base: number;
  total: number;
}

const coreAttrOf = (ctx: GrowthContext, cardId: string) => ATTRS.find((a) => ctx.rules.awakenMaterialByAttribute[a] === cardId);

/** 主線推進順序（與 progress.ts 相同）：章節、關卡編號 */
const mainBefore = (stages: StageDef[], stageId: string) => {
  const main = stages.filter((s) => s.kind === 'main');
  const idx = main.findIndex((s) => s.id === stageId);
  return main.slice(0, Math.max(0, idx));
};

export function estimateCores(
  stageId: string, attr: Attribute, stages: StageDef[], events: EventDef[], ctx: GrowthContext, a: CoreAssumptions = CORE_ASSUMPTIONS,
): CoreSupply {
  const stage = stages.find((s) => s.id === stageId)!;
  const p = estimateProgress(stage, stages, ctx, attr);
  const before = mainBefore(stages, stageId);
  const cleared = new Set(before.map((s) => s.id));

  // 體力 → 天數：主線每關打 PROGRESS_ASSUMPTIONS.mainClearsPerStage 次＋每日關卡
  const dailyStamina = stages.filter((s) => s.kind === 'daily').reduce((m, s) => Math.max(m, s.stamina), 0);
  const stamina = before.reduce((n, s) => n + s.stamina * PROGRESS_ASSUMPTIONS.mainClearsPerStage, 0) + p.dailyRuns * dailyStamina * 0.75;
  const days = stamina / a.staminaPerDay;
  const weeks = days / 7;

  // 首通：主線與（主線解鎖後的）外傳
  let oneTime = 0;
  for (const s of stages) {
    const open = s.kind === 'main' ? cleared.has(s.id) : s.kind === 'side' && (!s.unlockAfter || cleared.has(s.unlockAfter));
    if (!open) continue;
    for (const c of s.rewards.firstClear?.cards ?? []) if (coreAttrOf(ctx, c.card) === attr) oneTime += c.count;
  }

  // 流派克星週：開放後每週一個主題，中級、高級每週首通各給該主題屬性的星核
  const nemesisThemes = events.filter((e) => e.series === 'nemesis');
  const gate = stages.find((s) => s.event && nemesisThemes.some((e) => e.id === s.event) && s.unlockAfter && !s.unlockAfter.startsWith('nm-'))?.unlockAfter;
  const gateIdx = gate ? before.findIndex((s) => s.id === gate) : -1;
  let nemesis = 0;
  if (gateIdx >= 0 && nemesisThemes.length) {
    const openShare = (before.length - gateIdx) / Math.max(1, before.length);
    const perWeek = stages.filter((s) => nemesisThemes.some((e) => e.id === s.event))
      .flatMap((s) => s.rewards.periodFirstClear?.cards ?? []).filter((c) => coreAttrOf(ctx, c.card) === attr)
      .reduce((n, c) => n + c.count, 0) / nemesisThemes.length;
    nemesis = perWeek * weeks * openShare;
  }

  const shop = weeks * a.shopBuyShare;
  // progress.ts 假設每日關卡有一半打星核試煉、不管星期；實際能打的比例不會超過一週開放天數 / 7
  const coreStage = stages.find((s) => s.kind === 'daily' && s.drops.some((d) => coreAttrOf(ctx, d.card)));
  const trialOpenShare = (coreStage?.weekdays?.length ?? 7) / 7;
  const dailyByWeekday = p.cores[attr] * Math.min(1, trialOpenShare / PROGRESS_ASSUMPTIONS.coreDailyShare);
  const base = dailyByWeekday + oneTime;
  return {
    stageId, days, daily: p.cores[attr], dailyByWeekday, oneTime, nemesis, shop,
    base, total: base + nemesis + shop,
  };
}

/** 主線玩家第 5 章前段的星核需求（同一屬性）：5★ 進化 3 顆、隊長第 1 個覺醒 1 顆、同屬 3★ 進化 1 顆 */
export const CORE_DEMAND = { oneFiveStar: 3 + 1 + 1, twoFiveStars: 6 + 1 + 1 };

const f = (n: number) => n.toFixed(1);

export function coreSupplyReport(stages: StageDef[], events: EventDef[], ctx: GrowthContext, checkpoints: string[]): string[] {
  const out: string[] = [];
  out.push(`| 關卡 | 屬性 | 約第幾天 | 星核試煉（sim）| 星核試煉（照星期）| 首通 | 克星週 | 商店 | 不含每週來源 | 合計 |`, '|---|---|---|---|---|---|---|---|---|---|');
  for (const id of checkpoints) {
    for (const attr of ATTRS) {
      const c = estimateCores(id, attr, stages, events, ctx);
      out.push(`| ${id} | ${attr} | ${f(c.days)} | ${f(c.daily)} | ${f(c.dailyByWeekday)} | ${c.oneTime} | ${f(c.nemesis)} | ${f(c.shop)} | ${f(c.base)} | ${f(c.total)} |`);
    }
  }
  return out;
}
