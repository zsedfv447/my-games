// 戰鬥可讀性用的純邏輯：屬性剋制提示、敵人下一招預告、Combo 演出分級、技能就緒、每位隊員的傷害拆分。
// 不改戰鬥狀態，只從狀態快照推算給介面顯示。

import type { Attribute, EnemyAbility, StatusId } from '../core/types';
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
