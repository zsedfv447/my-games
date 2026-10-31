// 傷害與回復計算（GDD 2.1）：珠數與組數加成、Combo 加成、隊長技倍率、屬性剋制、
// 全體攻擊、心珠回復、敵人防禦與護盾、我方受到的傷害。
// 純邏輯；倍率都由呼叫端（leader.ts、技能 buff）傳入。

import type { Attribute, GameConfig, OrbType, PassiveEffect, Race } from '../core/types';
import type { MatchGroup } from './board';

export type BattleConfig = GameConfig['battle'];

/** 戰鬥中的一位隊員（已套用等級、突破與隊長技 hp／rcv 倍率後的數值） */
export interface BattleMember {
  cardId: string;
  attribute: Attribute;
  race: Race;
  hp: number;
  atk: number;
  rcv: number;
  passives?: PassiveEffect[];
}

/** 剋制：焰 → 森 → 潮 → 焰；輝 ⇄ 蝕 */
const ADVANTAGE: Record<Attribute, Attribute[]> = {
  fire: ['wood'],
  water: ['fire'],
  wood: ['water'],
  light: ['dark'],
  dark: ['light'],
};

export function attributeMultiplier(attacker: Attribute, defender: Attribute, config: BattleConfig): number {
  if (ADVANTAGE[attacker].includes(defender)) return config.attributeAdvantage;
  // 輝蝕互剋已在上一行回傳剋制，所以這裡只剩三屬循環的被剋
  if (ADVANTAGE[defender].includes(attacker)) return config.attributeDisadvantage;
  return 1;
}

/** 單一組的倍率：1 + 0.25 × (珠數 − 3)，再乘上強化珠加成 */
export function groupMultiplier(group: MatchGroup, config: BattleConfig): number {
  const sizeBonus = 1 + config.extraOrbBonus * (group.cells.length - 3);
  const enhanceBonus = 1 + config.enhancedOrbBonus * group.enhancedCount;
  return sizeBonus * enhanceBonus;
}

/** Combo 倍率：1 + 0.25 × (Combo − 1) */
export function comboMultiplier(combo: number, config: BattleConfig): number {
  return combo <= 0 ? 0 : 1 + config.comboBonus * (combo - 1);
}

export function isFullAttack(group: MatchGroup, config: BattleConfig): boolean {
  return group.cells.length >= config.fullAttackOrbCount;
}

function orbDamageUp(member: BattleMember, orb: OrbType): number {
  return (member.passives ?? []).reduce(
    (mul, p) => (p.type === 'orbDamageUp' && p.orb === orb ? mul * (1 + p.percent / 100) : mul),
    1,
  );
}

// ---------- 我方攻擊 ----------

export interface Hit {
  /** 隊員索引；-1 代表隊長技追打等不屬於特定隊員的傷害 */
  member: number;
  /** 沒有屬性時不吃剋制（例如固定傷害） */
  attribute?: Attribute;
  target: 'single' | 'all';
  /** 尚未計算屬性剋制、防禦與護盾的傷害 */
  amount: number;
  ignoreDefense?: boolean;
  ignoreShield?: boolean;
  /** 固定傷害：不吃剋制與攻擊相關加成 */
  fixed?: boolean;
  /**
   * 百分比傷害：依每個目標的最大生命 × percentMaxHp % 計算 amount（取整），最多 cap 點。
   * 一律搭配 fixed: true，結算規則和固定傷害相同（GDD 2.1「百分比傷害」）。
   */
  percentMaxHp?: number;
  cap?: number;
}

/** 百分比傷害對某個目標的基礎數值（尚未套用護盾）；沒填 cap 時不設上限 */
export function percentHitAmount(hit: Pick<Hit, 'percentMaxHp' | 'cap'>, target: { hp: number; maxHp?: number }): number {
  const base = Math.floor(((target.maxHp ?? target.hp) * (hit.percentMaxHp ?? 0)) / 100);
  return Math.max(0, Math.min(hit.cap ?? Infinity, base));
}

export interface AttackInput {
  team: BattleMember[];
  groups: MatchGroup[];
  /** 本回合 Combo；預設為組數 */
  combo?: number;
  config: BattleConfig;
  /** 每位隊員的總攻擊倍率（隊長技 × 主動技 buff × 其他），長度同 team；不填 = 1 */
  atkMultipliers?: number[];
  /** 本回合全部攻擊無視防禦（例：長串貫穿隊長技） */
  ignoreDefense?: boolean;
}

/**
 * 計算每位隊員本回合造成的攻擊：
 * 基礎 = 攻擊 × Σ(該屬性每一組的組倍率)；總傷 = 基礎 × Combo 倍率 × 攻擊倍率。
 * 該屬性只要有一組達到全體攻擊門檻，這組的傷害就打全體，其餘組打單體；一位隊員最多產生 2 次攻擊。
 */
export function computeAttacks(input: AttackInput): Hit[] {
  const { team, groups, config } = input;
  const combo = input.combo ?? groups.length;
  const comboMul = comboMultiplier(combo, config);
  const hits: Hit[] = [];
  team.forEach((member, i) => {
    let single = 0;
    let all = 0;
    for (const g of groups) {
      if (g.orb !== member.attribute) continue;
      const amount = groupMultiplier(g, config) * orbDamageUp(member, g.orb);
      if (isFullAttack(g, config)) all += amount;
      else single += amount;
    }
    const scale = member.atk * comboMul * (input.atkMultipliers?.[i] ?? 1);
    const base = { member: i, attribute: member.attribute, ignoreDefense: input.ignoreDefense || undefined };
    if (single > 0) hits.push({ ...base, target: 'single', amount: single * scale });
    if (all > 0) hits.push({ ...base, target: 'all', amount: all * scale });
  });
  return hits;
}

// ---------- 心珠回復 ----------

export interface HealInput {
  team: BattleMember[];
  groups: MatchGroup[];
  combo?: number;
  config: BattleConfig;
  /** 全隊回復倍率（主動技等），不填 = 1 */
  rcvMultiplier?: number;
  /** 每位隊員的回復倍率（有條件的隊長技），長度同 team；不填 = 1 */
  rcvMultipliers?: number[];
}

/** 心珠回復量 = 全隊回復力總和 × Σ(心珠每組的組倍率) × Combo 倍率 × 回復倍率 */
export function computeHeal(input: HealInput): number {
  const { team, groups, config } = input;
  const combo = input.combo ?? groups.length;
  const heartGroups = groups.filter((g) => g.orb === 'heart');
  if (heartGroups.length === 0) return 0;
  const rcv = team.reduce((sum, m, i) => sum + m.rcv * orbDamageUp(m, 'heart') * (input.rcvMultipliers?.[i] ?? 1), 0);
  const orbs = heartGroups.reduce((sum, g) => sum + groupMultiplier(g, config), 0);
  return Math.floor(rcv * orbs * comboMultiplier(combo, config) * (input.rcvMultiplier ?? 1));
}

// ---------- 敵人防禦與護盾 ----------

/** 敵人在受到攻擊當下的防禦狀態，由 battle-state 依敵人技能組出 */
export interface DefenseProfile {
  attribute: Attribute;
  def: number;
  /** 護盾：所有傷害減少 percent%（100 = 完全免疫） */
  shieldPercent?: number;
  /** 屬性減傷：指定屬性的傷害減少 percent% */
  attributeShield?: { attributes: Attribute[]; percent: number };
  /** Combo 盾：本回合 Combo 未達此數時，屬性攻擊無效 */
  comboShield?: number;
  /** 傷害吸收：一回合內受到的傷害超過此值的部分改為回復敵人（固定傷害不受影響），由 applyHits 結算 */
  damageAbsorb?: number;
  /** 七曜環還在：所有傷害減少 percent%（和護盾一樣，ignoreShield 可穿透） */
  ringReduction?: number;
  /** 七曜環碎裂後的易傷：屬性攻擊 ×vulnerable（固定與百分比傷害不吃） */
  vulnerable?: number;
}

export interface DamageContext {
  combo: number;
  config: BattleConfig;
}

/** 單次攻擊對單一敵人造成的實際傷害（整數） */
export function damageAgainst(hit: Hit, enemy: DefenseProfile, ctx: DamageContext): number {
  let amount = hit.amount;
  if (!hit.fixed && hit.attribute) amount *= attributeMultiplier(hit.attribute, enemy.attribute, ctx.config);
  if (!hit.ignoreShield) {
    if (!hit.fixed && enemy.comboShield !== undefined && ctx.combo < enemy.comboShield) return 0;
    if (enemy.shieldPercent) amount *= 1 - enemy.shieldPercent / 100;
    if (enemy.ringReduction) amount *= 1 - enemy.ringReduction / 100;
    const as = enemy.attributeShield;
    if (as && hit.attribute && as.attributes.includes(hit.attribute)) amount *= 1 - as.percent / 100;
    // 被護盾完全擋下
    if (amount <= 0) return 0;
  }
  if (enemy.vulnerable && !hit.fixed) amount *= enemy.vulnerable;
  if (!hit.ignoreDefense && !hit.fixed) amount -= enemy.def;
  // 加一點容差，避免 0.2 這類小數相乘後少 1 點
  amount = Math.floor(amount + 1e-9);
  // 有出手就至少 1 點
  return Math.max(hit.amount > 0 ? 1 : 0, amount);
}

export interface EnemyTarget extends DefenseProfile {
  hp: number;
  /** 傷害吸收回復時的上限；不填 = 不設上限 */
  maxHp?: number;
  /** 本回合已受到、會計入傷害吸收門檻的傷害 */
  takenThisTurn?: number;
}

export interface HitResult {
  hit: Hit;
  enemy: number;
  /** 實際扣除的生命；負數代表被傷害吸收轉為回復 */
  damage: number;
}

/**
 * 依序把攻擊打到敵人身上，回傳每一下的結果與敵人剩餘生命。
 * 單體攻擊打 targetIndex；目標倒下後，後續單體攻擊自動轉向下一個還活著的敵人。
 */
export function applyHits(
  hits: Hit[],
  enemies: EnemyTarget[],
  targetIndex: number,
  ctx: DamageContext,
): { results: HitResult[]; hp: number[]; taken: number[] } {
  const hp = enemies.map((e) => e.hp);
  const taken = enemies.map((e) => e.takenThisTurn ?? 0);
  const results: HitResult[] = [];
  const alive = (i: number) => hp[i] > 0;
  const pickTarget = () => {
    if (alive(targetIndex)) return targetIndex;
    const next = hp.findIndex((h) => h > 0);
    return next;
  };
  for (const hit of hits) {
    const targets = hit.target === 'all' ? enemies.map((_, i) => i).filter(alive) : [pickTarget()].filter((i) => i >= 0);
    for (const i of targets) {
      // 百分比傷害：每個目標依自己的最大生命換算
      const h = hit.percentMaxHp !== undefined ? { ...hit, fixed: true, amount: percentHitAmount(hit, enemies[i]) } : hit;
      const raw = damageAgainst(h, enemies[i], ctx);
      const absorb = enemies[i].damageAbsorb;
      let net = raw;
      if (absorb !== undefined && !h.fixed && !h.ignoreShield) {
        // 門檻以內照常扣血，超過的部分改為回復
        const allowed = Math.max(0, absorb - taken[i]);
        if (raw > allowed) net = allowed - (raw - allowed);
        taken[i] += raw;
      }
      const damage = net >= 0 ? Math.min(hp[i], net) : -Math.min(-net, (enemies[i].maxHp ?? Infinity) - hp[i]);
      hp[i] -= damage;
      results.push({ hit, enemy: i, damage });
    }
  }
  return { results, hp, taken };
}

// ---------- 我方受到的傷害 ----------

/** 敵人攻擊我方：多個減傷（百分比）以相乘方式疊加 */
export function incomingDamage(atk: number, reductionPercents: number[] = []): number {
  const kept = reductionPercents.reduce((mul, p) => mul * (1 - Math.min(100, Math.max(0, p)) / 100), 1);
  return Math.floor(atk * kept);
}

/** 毒珠：每消除一顆毒珠，損失最大生命的 percent% */
export function poisonOrbDamage(groups: MatchGroup[], maxHp: number, percent: number): number {
  const count = groups.reduce((sum, g) => sum + g.poisonCount, 0);
  return Math.floor(maxHp * (percent / 100) * count);
}
