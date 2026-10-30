// 隊長技：解析 LeaderSkillDef（條件＋效果），算出開場數值與每回合倍率。
// 隊長與助戰的隊長技各自計算後相乘。
//
// 規則：
// - 一個隊長技有多條 rule；條件全部成立的 rule 才套用效果，多條 rule 的攻擊倍率相乘。
//   分段倍率（例：4 色 ×4、5 色 ×6）請用 perStep 表達，不要拆成兩條 rule，否則會相乘。
// - perStep 的「超過幾級」取 rule 裡第一個可分級的條件：
//   comboAtLeast（超過幾 Combo）、attributesMatched（多幾種）、orbsInOneMatch（最大一組多幾顆）、
//   heartsMatched（多幾組）、enhancedOrbsMatched（多幾顆）。
// - heartsMatched 的 count 是心珠「組數」，方便做「每消除 1 組心珠追打」這類設計。
// - 開場就決定的效果（生命、回復、轉珠時間、盤面大小、敵人 CD、技能初始冷卻）
//   與每回合技能冷卻加速）只看 always／teamAll 條件；帶其他條件的 rule 不會套用這些效果（lintLeaderSkill 會提醒）。

import { ATTRIBUTES, type LeaderCondition, type OrbType, type LeaderEffect, type LeaderSkillDef, type UnitFilter } from '../core/types';
import type { MatchGroup } from './board';
import type { BattleMember, Hit } from './damage';

const STATIC_CONDITIONS = new Set<LeaderCondition['type']>(['always', 'teamAll']);
const STATIC_EFFECTS = new Set<LeaderEffect['type']>([
  'hpMultiplier', 'extendMoveTime', 'boardSize', 'enemyCooldownPlus', 'skillCooldownStart', 'allyCooldownPerTurn',
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
          case 'followUpDamage':
            result.followUps.push(
              e.mode === 'fixed'
                ? { member: -1, target: 'single', amount: e.value, fixed: true }
                : { member: -1, target: 'single', amount: e.value * totalAtk },
            );
            break;
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
      if (e.type === 'atkMultiplier' && e.perStep && !rule.conditions.some((c) => STEPPED.has(c.type))) {
        issues.push(`rule ${i}：atkMultiplier 有 perStep，但沒有可分級的條件`);
      }
    }
  });
  return issues;
}
