// 戰鬥可讀性用的純邏輯：屬性剋制提示、敵人下一招預告、Combo 演出分級、技能就緒、每位隊員的傷害拆分。
// 不改戰鬥狀態，只從狀態快照推算給介面顯示。

import type { Attribute, EnemyAbility, EnemyDef, StatusId } from '../core/types';
import { attributeMultiplier, incomingDamage, type BattleConfig, type HitResult } from './damage';
import type { BattleState, EnemyState, MemberState } from './runtime';
import { buffDamageReductions } from './skills/buffs';
import { enemyAtkMultiplier, enemyHitCount } from './skills/status';

// ---------- 屬性剋制 ----------

const ATTRIBUTES: Attribute[] = ['fire', 'water', 'wood', 'light', 'dark'];

export type Matchup = 'advantage' | 'disadvantage' | 'neutral';

export function matchup(attacker: Attribute | undefined, defender: Attribute, config: BattleConfig): Matchup {
  if (!attacker) return 'neutral';
  const mul = attributeMultiplier(attacker, defender, config);
  return mul > 1 ? 'advantage' : mul < 1 ? 'disadvantage' : 'neutral';
}

/** 打這個屬性的敵人時，會剋制它的屬性（敵人名牌的「弱：潮」） */
export function weakTo(defender: Attribute, config: BattleConfig): Attribute[] {
  return ATTRIBUTES.filter((a) => matchup(a, defender, config) === 'advantage');
}

// ---------- 有效倍率（剋制 × 屬性減傷，提案 72） ----------

/** 敵人身上會降低某些屬性傷害的效果；percent 為減傷 %（100 = 完全免疫） */
export interface AttributeReduction {
  attributes: Attribute[] | 'all';
  percent: number;
  kind: 'shield' | 'attributeShield' | 'rotate';
}

/** 有效倍率 = 剋制倍率 × Π(1 − 減傷)；只算涵蓋這個屬性的減傷 */
export function effectiveMultiplier(attacker: Attribute, defender: Attribute, reductions: readonly AttributeReduction[], config: BattleConfig): number {
  let mul = attributeMultiplier(attacker, defender, config);
  for (const r of reductions) {
    if (r.attributes === 'all' || r.attributes.includes(attacker)) mul *= 1 - Math.min(100, Math.max(0, r.percent)) / 100;
  }
  return mul;
}

export function effectiveMultipliers(defender: Attribute, reductions: readonly AttributeReduction[], config: BattleConfig): Record<Attribute, number> {
  return Object.fromEntries(ATTRIBUTES.map((a) => [a, effectiveMultiplier(a, defender, reductions, config)])) as Record<Attribute, number>;
}

/** 剋制而且減傷後仍大於 1 倍的屬性（名牌的「弱：X」） */
export function effectiveWeakTo(defender: Attribute, reductions: readonly AttributeReduction[], config: BattleConfig): Attribute[] {
  return weakTo(defender, config).filter((a) => effectiveMultiplier(a, defender, reductions, config) > 1);
}

/**
 * 隊員頭像對目標的標記：剋制且扣掉目前減傷後仍大於 1 倍才算 advantage（▲）；被剋照舊是 disadvantage（▼）；
 * 剋制但被減傷壓到 1 倍以下就不標。
 */
export function effectiveMatchup(attacker: Attribute, enemy: Pick<EnemyState, 'def' | 'statuses' | 'turnsOnField'>, config: BattleConfig): Matchup {
  const base = matchup(attacker, enemy.def.attribute, config);
  if (base !== 'advantage') return base;
  return effectiveMultiplier(attacker, enemy.def.attribute, liveReductions(enemy), config) > 1 ? 'advantage' : 'neutral';
}

/** 本來剋制、但被減傷壓到 1 倍以下的屬性 */
export function reducedWeaknesses(defender: Attribute, reductions: readonly AttributeReduction[], config: BattleConfig): Attribute[] {
  return weakTo(defender, config).filter((a) => effectiveMultiplier(a, defender, reductions, config) <= 1);
}

/** 戰鬥中：敵人目前持續中的護盾與屬性減傷（輪替減傷取這一回合輪到的屬性） */
export function liveReductions(enemy: Pick<EnemyState, 'statuses' | 'turnsOnField'>): AttributeReduction[] {
  const out: AttributeReduction[] = [];
  for (const s of enemy.statuses) {
    if (s.id === 'shield') out.push({ attributes: 'all', percent: s.value ?? 100, kind: 'shield' });
    if (s.id === 'attributeShield') {
      const raw = s.params?.attribute;
      out.push(raw === 'rotate'
        ? { attributes: [ATTRIBUTES[enemy.turnsOnField % ATTRIBUTES.length]], percent: s.value ?? 0, kind: 'rotate' }
        : { attributes: parseAttributeList(raw), percent: s.value ?? 0, kind: 'attributeShield' });
    }
  }
  return out;
}

/**
 * 出戰前：敵人一出場就有、而且會一直持續的減傷（onStart、turns 不填或 0）。
 * 只維持幾回合的護盾不影響帶什麼屬性，不算；輪替減傷每回合換一個屬性，平均分給五屬（各算 1/5）。
 */
export function plannedReductions(def: Pick<EnemyDef, 'abilities'>): AttributeReduction[] {
  const out: AttributeReduction[] = [];
  for (const a of def.abilities) {
    if (a.trigger !== 'onStart' || (a.turns ?? 0) > 0) continue;
    if (a.status === 'shield') out.push({ attributes: 'all', percent: a.value ?? 100, kind: 'shield' });
    if (a.status === 'attributeShield') {
      const raw = a.params?.attribute;
      out.push(raw === 'rotate'
        ? { attributes: 'all', percent: (a.value ?? 0) / ATTRIBUTES.length, kind: 'rotate' }
        : { attributes: parseAttributeList(raw), percent: a.value ?? 0, kind: 'attributeShield' });
    }
  }
  return out;
}

function parseAttributeList(v: number | string | undefined): Attribute[] {
  if (typeof v !== 'string') return [];
  return v.split(',').map((x) => x.trim()).filter((x): x is Attribute => (ATTRIBUTES as string[]).includes(x));
}

// ---------- 敵人下一招預告 ----------

export interface IntentAbility {
  status: StatusId;
  trigger: EnemyAbility['trigger'];
  value?: number;
  turns?: number;
  params?: Record<string, number | string>;
}

export interface EnemyIntent {
  /** 下一次我方轉珠後會不會攻擊；鎖定中或冷卻未到為 null */
  attack: { damage: number; hits: number } | null;
  /** 下一次我方轉珠後會觸發的技能（onAttack 隨攻擊觸發、everyNTurns 依出場回合數） */
  abilities: IntentAbility[];
  /** 被鎖定行動，這回合不會攻擊 */
  locked: boolean;
  /** 距離攻擊還有幾回合（含鎖定）；1 = 下回合 */
  turnsUntilAttack: number;
}

const toIntent = (a: EnemyAbility): IntentAbility => ({ status: a.status, trigger: a.trigger, value: a.value, turns: a.turns, params: a.params });

/**
 * 預測敵人在玩家下一次轉珠結算後的行動（對應 battle-state 的敵人行動順序）。
 * 傷害只計入目前持續中的主動技減傷；隊長技減傷要看轉珠結果，呼叫端可以從 extraReductions 傳入已知的部分。
 * 倒下的敵人回傳 null。
 */
export function predictEnemyIntent(state: BattleState, enemyIndex: number, extraReductions: number[] = []): EnemyIntent | null {
  const e = state.enemies[enemyIndex];
  if (!e || e.hp <= 0) return null;
  const locked = e.lockedTurns > 0;
  const attacks = !locked && e.cooldown <= 1;
  const abilities: IntentAbility[] = [];
  let attack: EnemyIntent['attack'] = null;
  if (attacks) {
    const hits = enemyHitCount(e);
    const perHit = incomingDamage((e.def.atk * enemyAtkMultiplier(e)) / hits, [...extraReductions, ...buffDamageReductions(state)]);
    attack = { damage: perHit * hits, hits };
    for (const a of e.def.abilities) if (a.trigger === 'onAttack') abilities.push(toIntent(a));
  }
  const nextTurn = e.turnsOnField + 1;
  for (const a of e.def.abilities) {
    if (a.trigger !== 'everyNTurns') continue;
    const every = Math.max(1, Number(a.params?.n ?? 3));
    if (nextTurn % every === 0) abilities.push(toIntent(a));
  }
  return { attack, abilities, locked, turnsUntilAttack: e.lockedTurns + Math.max(1, e.cooldown) };
}

/** 敵人全部技能（含尚未觸發的 hpBelow 門檻），給「查看敵人」用 */
export function enemyAbilityList(e: EnemyState): (IntentAbility & { done: boolean })[] {
  return e.def.abilities.map((a, i) => ({ ...toIntent(a), done: (a.trigger === 'onStart' || a.trigger === 'hpBelow') && e.triggered.includes(i) }));
}

// ---------- Combo ----------

export interface ComboTier {
  /** 0 = 普通、1 = 5 Combo、2 = 8 Combo、3 = 10 Combo 以上 */
  tier: 0 | 1 | 2 | 3;
  /** 高 Combo 的稱號 */
  title?: string;
}

export function comboTier(combo: number): ComboTier {
  if (combo >= 10) return { tier: 3, title: '星河連綴' };
  if (combo >= 8) return { tier: 2, title: '流星雨' };
  if (combo >= 5) return { tier: 1 };
  return { tier: 0 };
}

/** Combo 加成文字（GDD：1 + 0.25 × (C − 1)），例：×2.25 */
export function comboBonusText(combo: number, config: BattleConfig): string {
  const mul = combo <= 0 ? 0 : 1 + config.comboBonus * (combo - 1);
  return `×${Number(mul.toFixed(2))}`;
}

// ---------- 技能就緒 ----------

/** 這回合剛好冷卻完成的隊員索引（之前還在冷卻、現在變 0） */
export function newlyReadySkills(before: MemberState[], after: MemberState[]): number[] {
  return after.filter((m, i) => m.skillCooldown === 0 && (before[i]?.skillCooldown ?? 0) > 0).map((m) => m.index);
}

// ---------- 隊員傷害拆分 ----------

export interface MemberStrike {
  /** 隊員索引；-1 = 隊長技追打、持續傷害等 */
  member: number;
  attribute?: Attribute;
  total: number;
  /** 有沒有全體攻擊 */
  sweep: boolean;
  /** 依敵人分開的傷害與剋制關係 */
  targets: { enemy: number; damage: number; matchup: Matchup }[];
}

/** 把一回合的攻擊依隊員分組（照出手順序），介面用來播放「隊員 → 敵人」 */
export function strikesByMember(hits: HitResult[], enemies: Pick<EnemyState, 'def'>[], config: BattleConfig): MemberStrike[] {
  const out: MemberStrike[] = [];
  for (const r of hits) {
    let s = out.find((x) => x.member === r.hit.member && x.attribute === r.hit.attribute);
    if (!s) {
      s = { member: r.hit.member, attribute: r.hit.attribute, total: 0, sweep: false, targets: [] };
      out.push(s);
    }
    s.total += r.damage;
    if (r.hit.target === 'all') s.sweep = true;
    let t = s.targets.find((x) => x.enemy === r.enemy);
    if (!t) {
      const def = enemies[r.enemy]?.def;
      t = { enemy: r.enemy, damage: 0, matchup: def && !r.hit.fixed ? matchup(r.hit.attribute, def.attribute, config) : 'neutral' };
      s.targets.push(t);
    }
    t.damage += r.damage;
  }
  return out;
}
