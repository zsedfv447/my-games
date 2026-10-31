// 隊長技：解析 LeaderSkillDef（條件＋效果），算出開場數值與每回合倍率。
// 隊長與助戰的隊長技各自計算後相乘。
//
// 規則：
// - 一個隊長技有多條 rule；條件全部成立的 rule 才套用效果，多條 rule 的攻擊倍率相乘。
//   分段倍率（例：4 色 ×4、5 色 ×6）請用 perStep 表達，不要拆成兩條 rule，否則會相乘。
// - perStep（攻擊倍率、追打）的「超過幾級」取 rule 裡第一個可分級的條件：
//   comboAtLeast（超過幾 Combo）、attributesMatched（多幾種）、orbsInOneMatch（最大一組多幾顆）、
//   heartsMatched（多幾組）、enhancedOrbsMatched（多幾顆）。
// - heartsMatched 的 count 是心珠「組數」，方便做「每消除 1 組心珠追打」這類設計。
// - 開場就決定的效果（生命、回復、轉珠時間、盤面大小、敵人 CD、技能初始冷卻）
//   與每回合技能冷卻加速、強化珠天降）只看 always／teamAll 條件；帶其他條件的 rule 不會套用這些效果（lintLeaderSkill 會提醒）。

import { ATTRIBUTES, type MatchedOrbSkyfall, type LeaderCondition, type OrbType, type LeaderEffect, type LeaderSkillDef, type UnitFilter } from '../core/types';
import type { MatchGroup } from './board';
import type { BattleMember, Hit } from './damage';

const STATIC_CONDITIONS = new Set<LeaderCondition['type']>(['always', 'teamAll']);
const STATIC_EFFECTS = new Set<LeaderEffect['type']>([
  'hpMultiplier', 'extendMoveTime', 'boardSize', 'enemyCooldownPlus', 'skillCooldownStart', 'allyCooldownPerTurn',
  'enhancedSkyfall', 'matchedOrbSkyfall',
]);

const asArray = <T>(v: T | T[] | undefined): T[] | undefined => (v === undefined ? undefined : Array.isArray(v) ? v : [v]);

export function matchesFilter(member: BattleMember, filter?: UnitFilter): boolean {
  if (!filter) return true;
  const attrs = asArray(filter.attribute);
  const races = asArray(filter.race);
  return (!attrs || attrs.includes(member.attribute)) && (!races || races.includes(member.race));
}

const isStaticRule = (rule: LeaderSkillDef['rules'][number]) => rule.conditions.every((c) => STATIC_CONDITIONS.has(c.type));

// ---------- 開場（靜態）效果 ----------

export interface LeaderStaticResult {
  /** 每位隊員的生命倍率（長度同 team） */
  hpMultipliers: number[];
  /** 每位隊員的回復力倍率（無條件部分，會反映在面板數值） */
  rcvMultipliers: number[];
  moveTimeBonus: number;
  /** 改變盤面大小；沒有則用 config.board */
  boardSize?: { cols: number; rows: number };
  enemyCooldownPlus: number;
  /** 開場技能冷卻全滿 */
  skillsStartCharged: boolean;
  /** 每回合技能冷卻額外減少的回合數 */
  allyCooldownPerTurn: number;
  /** 天降強化珠機率（0–1），多個取最高 */
  enhancedSkyfall: number;
  /** 同色消除生成強化珠；同色雙隊長在各段補珠時取最多顆，不相加。 */
  matchedOrbSkyfall: MatchedOrbSkyfall[];
}

/** team 為全隊（含助戰）；leaders 依序為隊長、助戰的隊長技，可為 undefined */
export function evaluateLeaderStatic(leaders: (LeaderSkillDef | undefined)[], team: BattleMember[]): LeaderStaticResult {
  const result: LeaderStaticResult = {
    hpMultipliers: team.map(() => 1),
    rcvMultipliers: team.map(() => 1),
    moveTimeBonus: 0,
    enemyCooldownPlus: 0,
    skillsStartCharged: false,
    allyCooldownPerTurn: 0,
    enhancedSkyfall: 0,
    matchedOrbSkyfall: [],
  };
  const ctx = { team } as LeaderTurnContext;
  for (const leader of leaders) {
    if (!leader) continue;
    for (const rule of leader.rules) {
      if (!isStaticRule(rule) || !rule.conditions.every((c) => checkCondition(c, ctx))) continue;
      for (const e of rule.effects) {
        switch (e.type) {
          case 'hpMultiplier':
          case 'rcvMultiplier': {
            const target = e.type === 'hpMultiplier' ? result.hpMultipliers : result.rcvMultipliers;
            team.forEach((m, i) => {
              if (matchesFilter(m, e.target)) target[i] *= e.value;
            });
            break;
          }
          case 'extendMoveTime':
            result.moveTimeBonus += e.seconds;
            break;
          case 'boardSize':
            result.boardSize ??= { cols: e.cols, rows: e.rows };
            break;
          case 'enemyCooldownPlus':
            result.enemyCooldownPlus += e.turns;
            break;
          case 'skillCooldownStart':
            result.skillsStartCharged ||= e.charged;
            break;
          case 'allyCooldownPerTurn':
            result.allyCooldownPerTurn += e.turns;
            break;
          case 'matchedOrbSkyfall':
            result.matchedOrbSkyfall.push({orb:e.orb,count:e.count,spawn:e.spawn});
            break;
          case 'enhancedSkyfall':
            result.enhancedSkyfall = Math.max(result.enhancedSkyfall, e.rate);
            break;
        }
      }
    }
  }
  return result;
}

// ---------- 每回合效果 ----------

export interface LeaderTurnContext {
  team: BattleMember[];
  /** 本回合所有消除的組（含落下連鎖） */
  groups: MatchGroup[];
  combo: number;
  /** 本回合結算前的隊伍生命百分比 0–100 */
  hpPercent: number;
  skillUsedThisTurn: boolean;
}

export interface LeaderTurnResult {
  /** 每位隊員的攻擊倍率（長度同 team） */
  atkMultipliers: number[];
  /** 每位隊員本回合額外的回復倍率（有條件的回復倍率，例：心之守護） */
  rcvMultipliers: number[];
  /** 隊長技追打 */
  followUps: Hit[];
  ignoreDefense: boolean;
  /** 本回合敵人攻擊時的減傷百分比，交給 incomingDamage 相乘疊加 */
  damageReductions: number[];
}

/** 條件成立時回傳「超過幾級」（≥0），不成立回傳 null；沒有分級概念的條件成立時回傳 0 */
function conditionSteps(c: LeaderCondition, ctx: LeaderTurnContext): number | null {
  const ok = (pass: boolean, steps = 0) => (pass ? steps : null);
  switch (c.type) {
    case 'always':
      return 0;
    case 'comboAtLeast':
      return ok(ctx.combo >= c.combo, ctx.combo - c.combo);
    case 'attributesMatched': {
      const pool: readonly OrbType[] = c.attributes ?? ATTRIBUTES;
      const matched = new Set(ctx.groups.map((g) => g.orb).filter((o) => pool.includes(o))).size;
      return ok(matched >= c.count, matched - c.count);
    }
    case 'orbsInOneMatch': {
      const largest = Math.max(0, ...ctx.groups.filter((g) => !c.orb || g.orb === c.orb).map((g) => g.cells.length));
      return ok(largest >= c.count, largest - c.count);
    }
    case 'heartsMatched': {
      const hearts = ctx.groups.filter((g) => g.orb === 'heart').length;
      return ok(hearts >= c.count, hearts - c.count);
    }
    case 'enhancedOrbsMatched': {
      const enhanced = ctx.groups.reduce((sum, g) => sum + g.enhancedCount, 0);
      return ok(enhanced >= c.count, enhanced - c.count);
    }
    case 'hpBelow':
      return ok(ctx.hpPercent < c.percent);
    case 'hpAbove':
      return ok(ctx.hpPercent >= c.percent);
    case 'teamAll':
      return ok(ctx.team.length > 0 && ctx.team.every((m) => matchesFilter(m, c.filter)));
    case 'skillUsedThisTurn':
      return ok(ctx.skillUsedThisTurn);
  }
}

const STEPPED = new Set<LeaderCondition['type']>([
  'comboAtLeast', 'attributesMatched', 'orbsInOneMatch', 'heartsMatched', 'enhancedOrbsMatched',
]);

export function checkCondition(c: LeaderCondition, ctx: LeaderTurnContext): boolean {
  return conditionSteps(c, ctx) !== null;
}

/** rule 成立時回傳分級數，不成立回傳 null */
function ruleSteps(rule: LeaderSkillDef['rules'][number], ctx: LeaderTurnContext): number | null {
  let steps: number | undefined;
  for (const c of rule.conditions) {
    const s = conditionSteps(c, ctx);
    if (s === null) return null;
    if (steps === undefined && STEPPED.has(c.type)) steps = s;
  }
  return steps ?? 0;
}

export function steppedValue(e: { value: number; perStep?: number; maxValue?: number }, steps: number): number {
  const v = e.value + (e.perStep ?? 0) * steps;
  return e.maxValue !== undefined ? Math.min(v, e.maxValue) : v;
}

export function evaluateLeaderTurn(leaders: (LeaderSkillDef | undefined)[], ctx: LeaderTurnContext): LeaderTurnResult {
  const result: LeaderTurnResult = {
    atkMultipliers: ctx.team.map(() => 1),
    rcvMultipliers: ctx.team.map(() => 1),
    followUps: [],
    ignoreDefense: false,
    damageReductions: [],
  };
  const totalAtk = ctx.team.reduce((sum, m) => sum + m.atk, 0);
  for (const leader of leaders) {
    if (!leader) continue;
    for (const rule of leader.rules) {
      const steps = ruleSteps(rule, ctx);
      if (steps === null) continue;
      for (const e of rule.effects) {
        switch (e.type) {
          case 'atkMultiplier': {
            const value = steppedValue(e, steps);
            ctx.team.forEach((m, i) => {
              if (matchesFilter(m, e.target)) result.atkMultipliers[i] *= value;
            });
            break;
          }
          case 'rcvMultiplier':
            // 無條件的回復倍率已在 evaluateLeaderStatic 計入面板
            if (isStaticRule(rule)) break;
            ctx.team.forEach((m, i) => {
              if (matchesFilter(m, e.target)) result.rcvMultipliers[i] *= e.value;
            });
            break;
          case 'followUpDamage': {
            const value = steppedValue(e, steps);
            result.followUps.push(
              e.mode === 'fixed'
                ? { member: -1, target: 'single', amount: value, fixed: true }
                : e.mode === 'percentMaxHp'
                  // 依目標最大生命換算，在 applyHits 結算；amount 先放上限給預估用
                  ? { member: -1, target: 'single', amount: e.cap ?? 0, fixed: true, percentMaxHp: value, cap: e.cap }
                  : { member: -1, target: 'single', amount: value * totalAtk },
            );
            break;
          }
          case 'ignoreDefense':
            result.ignoreDefense = true;
            break;
          case 'damageReduction':
            result.damageReductions.push(e.percent);
            break;
        }
      }
    }
  }
  return result;
}

// ---------- 資料檢查 ----------

/** 給創意顧問與資料驗證用：找出寫了但不會生效的組合 */
export function lintLeaderSkill(def: LeaderSkillDef): string[] {
  const issues: string[] = [];
  def.rules.forEach((rule, i) => {
    if (rule.conditions.length === 0) issues.push(`rule ${i}：沒有條件，請用 { type: 'always' }`);
    if (!isStaticRule(rule)) {
      for (const e of rule.effects) {
        if (STATIC_EFFECTS.has(e.type)) issues.push(`rule ${i}：${e.type} 只看開場條件（always／teamAll），帶回合條件不會生效`);
      }
    }
    for (const e of rule.effects) {
      if ((e.type === 'atkMultiplier' || e.type === 'followUpDamage') && e.perStep && !rule.conditions.some((c) => STEPPED.has(c.type))) {
        issues.push(`rule ${i}：${e.type} 有 perStep，但沒有可分級的條件`);
      }
      if (e.type === 'followUpDamage' && e.mode === 'percentMaxHp' && !(e.cap && e.cap > 0)) {
        issues.push(`rule ${i}：百分比追打一定要有上限 cap，否則會秒殺 Boss`);
      }
    }
  });
  return issues;
}

// ---------- 星數分級 ----------
// 隊長技強度依卡片星數分級（規則寫在 docs/card-matrix.md）：數值是上限，資料驗證會檢查。

/** 把隊長技攤平成可比較的強度數字（條件全部成立時的上限） */
export interface LeaderSkillProfile {
  rules: number;
  /** 單條 rule 最多幾個條件（always 不算） */
  maxConditions: number;
  effects: number;
  /** 所有攻擊倍率（取 maxValue）相乘 */
  peakAtk: number;
  hp: number;
  rcv: number;
  /** 合併後的減傷百分比 */
  reduction: number;
  fixedFollowUp: number;
  /** 百分比追打：目標最大生命的 % 加總 */
  percentFollowUp: number;
  /** 百分比追打每次上限的加總（沒填 cap 為 Infinity），也就是對超高生命 Boss 的等效固定追打 */
  percentFollowUpCap: number;
  moveTime: number;
  enemyCooldown: number;
  allyCooldown: number;
  enhancedSkyfall: number;
  ignoreDefense: boolean;
  /** 出現過的條件／效果種類，用來比對進化前後是否同主題 */
  conditionTypes: Set<LeaderCondition['type']>;
  effectTypes: Set<LeaderEffect['type']>;
}

export function leaderSkillProfile(def: LeaderSkillDef): LeaderSkillProfile {
  const p: LeaderSkillProfile = {
    rules: def.rules.length, maxConditions: 0, effects: 0, peakAtk: 1, hp: 1, rcv: 1, reduction: 0,
    fixedFollowUp: 0, percentFollowUp: 0, percentFollowUpCap: 0, moveTime: 0, enemyCooldown: 0, allyCooldown: 0, enhancedSkyfall: 0, ignoreDefense: false,
    conditionTypes: new Set(), effectTypes: new Set(),
  };
  let taken = 1;
  for (const rule of def.rules) {
    p.maxConditions = Math.max(p.maxConditions, rule.conditions.filter((c) => c.type !== 'always').length);
    for (const c of rule.conditions) if (c.type !== 'always') p.conditionTypes.add(c.type);
    for (const e of rule.effects) {
      p.effects++;
      p.effectTypes.add(e.type);
      switch (e.type) {
        case 'atkMultiplier': p.peakAtk *= e.maxValue ?? e.value; break;
        case 'hpMultiplier': p.hp *= e.value; break;
        case 'rcvMultiplier': p.rcv *= e.value; break;
        case 'damageReduction': taken *= 1 - e.percent / 100; break;
        case 'followUpDamage':
          if (e.mode === 'fixed') p.fixedFollowUp += e.maxValue ?? e.value;
          if (e.mode === 'percentMaxHp') {
            p.percentFollowUp += e.maxValue ?? e.value;
            p.percentFollowUpCap += e.cap && e.cap > 0 ? e.cap : Infinity;
          }
          break;
        case 'extendMoveTime': p.moveTime += e.seconds; break;
        case 'enemyCooldownPlus': p.enemyCooldown += e.turns; break;
        case 'allyCooldownPerTurn': p.allyCooldown += e.turns; break;
        case 'enhancedSkyfall': p.enhancedSkyfall = Math.max(p.enhancedSkyfall, e.rate); break;
        case 'ignoreDefense': p.ignoreDefense = true; break;
      }
    }
  }
  p.reduction = Math.round((1 - taken) * 100);
  return p;
}

export interface LeaderTier {
  rules: number;
  maxConditions: number;
  effects: number;
  peakAtk: number;
  /** 生命、回復倍率各自的上限 */
  stat: number;
  reduction: number;
  fixedFollowUp: number;
  /**
   * 百分比追打（目標最大生命 %）與每次上限。和固定追打分開算：固定追打對百萬生命的 Boss 不痛不癢，
   * 百分比追打靠上限壓住，讓固定傷害流派打得動 Boss 但不會秒殺。
   */
  percentFollowUp: number;
  percentFollowUpCap: number;
  moveTime: number;
  enemyCooldown: number;
  allyCooldown: number;
  /** 天降強化珠機率 */
  enhancedSkyfall: number;
  ignoreDefense: boolean;
}

export const LEADER_TIERS: Record<3 | 4 | 5 | 6, LeaderTier> = {
  3: { rules: 2, maxConditions: 1, effects: 3, peakAtk: 2, stat: 1.2, reduction: 0, fixedFollowUp: 0, percentFollowUp: 0, percentFollowUpCap: 0, moveTime: 0, enemyCooldown: 1, allyCooldown: 0, enhancedSkyfall: 0.1, ignoreDefense: false },
  4: { rules: 2, maxConditions: 1, effects: 4, peakAtk: 3, stat: 1.5, reduction: 20, fixedFollowUp: 4000, percentFollowUp: 2, percentFollowUpCap: 20000, moveTime: 1, enemyCooldown: 1, allyCooldown: 0, enhancedSkyfall: 0.15, ignoreDefense: true },
  5: { rules: 2, maxConditions: 2, effects: 5, peakAtk: 4, stat: 1.5, reduction: 30, fixedFollowUp: 10000, percentFollowUp: 3, percentFollowUpCap: 40000, moveTime: 1, enemyCooldown: 1, allyCooldown: 0, enhancedSkyfall: 0.2, ignoreDefense: true },
  6: { rules: 3, maxConditions: 2, effects: 6, peakAtk: 6, stat: 2, reduction: 40, fixedFollowUp: 18000, percentFollowUp: 4, percentFollowUpCap: 80000, moveTime: 2, enemyCooldown: 1, allyCooldown: 1, enhancedSkyfall: 0.25, ignoreDefense: true },
};

/** 檢查隊長技有沒有超出該星數的上限；3★ 以下用 3★ 的上限 */
export function checkLeaderTier(def: LeaderSkillDef, rarity: number): string[] {
  const tier = LEADER_TIERS[Math.min(6, Math.max(3, rarity)) as 3 | 4 | 5 | 6];
  const p = leaderSkillProfile(def);
  const issues: string[] = [];
  const over = (label: string, value: number, max: number) => {
    if (value > max + 1e-9) issues.push(`${label} ${value} 超過 ${rarity}★ 上限 ${max}`);
  };
  over('rule 數', p.rules, tier.rules);
  over('單條件數', p.maxConditions, tier.maxConditions);
  over('效果數', p.effects, tier.effects);
  over('攻擊倍率', Number(p.peakAtk.toFixed(3)), tier.peakAtk);
  // 經典 5★ 的純生命／純回復隊長以單一能力換取 2.5 倍；混合型仍走原上限。
  const pureHp = rarity === 5 && p.effectTypes.size === 1 && p.effectTypes.has('hpMultiplier');
  const pureRcv = rarity === 5 && p.effectTypes.size === 1 && p.effectTypes.has('rcvMultiplier');
  over('生命倍率', p.hp, pureHp ? 2.5 : tier.stat);
  over('回復倍率', p.rcv, pureRcv ? 2.5 : tier.stat);
  over('減傷', p.reduction, tier.reduction);
  over('固定追打', p.fixedFollowUp, tier.fixedFollowUp);
  over('百分比追打 %', p.percentFollowUp, tier.percentFollowUp);
  if (p.percentFollowUp > 0 && !Number.isFinite(p.percentFollowUpCap)) issues.push('百分比追打沒有上限 cap');
  else over('百分比追打上限', p.percentFollowUpCap, tier.percentFollowUpCap);
  over('轉珠時間', p.moveTime, tier.moveTime);
  over('敵人 CD', p.enemyCooldown, tier.enemyCooldown);
  over('技能冷卻加速', p.allyCooldown, tier.allyCooldown);
  over('強化珠天降', p.enhancedSkyfall, tier.enhancedSkyfall);
  if (p.ignoreDefense && !tier.ignoreDefense) issues.push(`${rarity}★ 不能無視防禦`);
  return issues;
}

/** 進化後的隊長技要是同主題加強版：保留進化前的條件與效果種類，攻擊、生命、回復都不能變弱 */
export function checkLeaderEvolution(before: LeaderSkillDef, after: LeaderSkillDef): string[] {
  const a = leaderSkillProfile(before);
  const b = leaderSkillProfile(after);
  const issues: string[] = [];
  for (const t of a.conditionTypes) if (!b.conditionTypes.has(t)) issues.push(`進化後少了條件 ${t}`);
  for (const t of a.effectTypes) if (!b.effectTypes.has(t)) issues.push(`進化後少了效果 ${t}`);
  for (const k of ['peakAtk', 'hp', 'rcv', 'reduction', 'fixedFollowUp', 'percentFollowUp', 'moveTime', 'enhancedSkyfall'] as const) {
    if (b[k] < a[k] - 1e-9) issues.push(`進化後 ${k} 變弱（${a[k]} → ${b[k]}）`);
  }
  if (JSON.stringify(before.rules) === JSON.stringify(after.rules)) issues.push('進化前後隊長技完全相同');
  return issues;
}
