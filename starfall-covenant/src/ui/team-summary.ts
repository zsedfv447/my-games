// 隊伍總數值與隊長技重點：算法與戰鬥開場一致（statsAtLevel＋隊長技的常駐生命／回復倍率）。純邏輯。
import type { CardDef, LeaderSkillDef } from '../core/types';
import { statsAtLevel } from '../battle/battle-state';
import type { BattleMember } from '../battle/damage';
import { evaluateLeaderStatic, leaderSkillProfile } from '../battle/leader';

export interface TeamMemberLike {
  card: CardDef;
  level: number;
  awakened?: number;
}

export interface TeamTotals {
  hp: number;
  atk: number;
  rcv: number;
  /** 隊長技把生命或回復算進去之前的數值，用來顯示加成 */
  baseHp: number;
  baseRcv: number;
}

/** members[0] 是隊長；helper 是助戰（隊長技會和隊長的相乘） */
export function teamTotals(members: TeamMemberLike[], leaderOf: (card: CardDef) => LeaderSkillDef | undefined, helper?: TeamMemberLike): TeamTotals {
  const all = helper ? [...members, helper] : members;
  const base: BattleMember[] = all.map((m) => ({
    cardId: m.card.id,
    attribute: m.card.attribute,
    race: m.card.race,
    ...statsAtLevel(m.card, m.level),
    passives: m.card.awakenings?.slice(0, m.awakened ?? 0),
  }));
  const leaders = [members[0] && leaderOf(members[0].card), helper && leaderOf(helper.card)];
  const fx = evaluateLeaderStatic(leaders, base);
  const sum = (f: (m: BattleMember, i: number) => number) => base.reduce((s, m, i) => s + f(m, i), 0);
  return {
    hp: sum((m, i) => Math.round(m.hp * fx.hpMultipliers[i])),
    atk: sum((m) => m.atk),
    rcv: sum((m, i) => Math.round(m.rcv * fx.rcvMultipliers[i])),
    baseHp: sum((m) => m.hp),
    baseRcv: sum((m) => m.rcv),
  };
}

const times = (n: number) => `×${Number(n.toFixed(2))}`;

/** 隊長技的重點標籤（最高攻擊倍率、生命、回復、減傷…），來自 leaderSkillProfile */
export function leaderHighlights(def: LeaderSkillDef): string[] {
  const p = leaderSkillProfile(def);
  const out: string[] = [];
  if (p.peakAtk > 1) out.push(`攻擊最高 ${times(p.peakAtk)}`);
  if (p.hp > 1) out.push(`生命 ${times(p.hp)}`);
  if (p.rcv > 1) out.push(`回復 ${times(p.rcv)}`);
  if (p.reduction > 0) out.push(`減傷 ${p.reduction}%`);
  if (p.moveTime > 0) out.push(`轉珠 +${p.moveTime} 秒`);
  if (p.fixedFollowUp > 0) out.push(`追打 ${p.fixedFollowUp.toLocaleString()}`);
  if (p.percentFollowUp > 0) out.push(`追打最大生命 ${p.percentFollowUp}%${Number.isFinite(p.percentFollowUpCap) ? `（上限 ${p.percentFollowUpCap.toLocaleString()}）` : ''}`);
  if (p.enemyCooldown > 0) out.push(`敵人行動 +${p.enemyCooldown} 回合`);
  if (p.allyCooldown > 0) out.push(`技能加速 ${p.allyCooldown}`);
  if (p.ignoreDefense) out.push('無視防禦');
  return out;
}

export const TEAM_NAME_MAX = 10;

/** 隊伍改名：去頭尾空白、最多 10 個字；空字串回傳 null（不改名） */
export function cleanTeamName(raw: string): string | null {
  const name = [...raw.trim().replace(/\s+/g, ' ')].slice(0, TEAM_NAME_MAX).join('');
  return name || null;
}
