// 隊伍編成「換上這張會怎樣」：總生命／回復／Cost 的增減、主動技 CD、吃不吃得到隊長技。純邏輯，
// 數值沿用 team-summary 的 teamTotals，隊長技判斷沿用 battle/leader.ts 的 matchesFilter。
import type { CardDef, LeaderSkillDef } from '../core/types';
import { matchesFilter } from '../battle/leader';
import { teamTotals, type TeamMemberLike } from './team-summary';

export interface SwapMember extends TeamMemberLike {
  skillLevel?: number;
}

export interface LeaderFit {
  /** 這張卡吃得到的隊長技加成，例如「攻擊 ×3」；條件型的標上「條件達成時」 */
  boosts: string[];
  /** 換上後會讓「全隊…」條件失效的隊長技規則數 */
  breaksTeamAll: number;
}

export interface SwapPreview {
  hp: number;
  rcv: number;
  cost: number;
  dHp: number;
  dRcv: number;
  dCost: number;
  /** 主動技目前的冷卻；沒有主動技為 null */
  cooldown: number | null;
  leader: LeaderFit;
}

const STAT_NAME = { atkMultiplier: '攻擊', hpMultiplier: '生命', rcvMultiplier: '回復' } as const;
const asMember = (c: CardDef) => ({ cardId: c.id, attribute: c.attribute, race: c.race, hp: 0, atk: 0, rcv: 0 });
const times = (n: number) => `×${Number(n.toFixed(2))}`;

/** 隊長技對這張卡的影響：吃得到哪些加成、會不會破壞「全隊」條件 */
export function leaderFit(card: CardDef, leader: LeaderSkillDef | undefined): LeaderFit {
  const fit: LeaderFit = { boosts: [], breaksTeamAll: 0 };
  if (!leader) return fit;
  const m = asMember(card);
  for (const rule of leader.rules) {
    const teamAll = rule.conditions.filter((c) => c.type === 'teamAll');
    if (teamAll.some((c) => c.type === 'teamAll' && !matchesFilter(m, c.filter))) { fit.breaksTeamAll++; continue; }
    const conditional = rule.conditions.some((c) => c.type !== 'always' && c.type !== 'teamAll');
    for (const e of rule.effects) {
      if (e.type !== 'atkMultiplier' && e.type !== 'hpMultiplier' && e.type !== 'rcvMultiplier') continue;
      if (e.value <= 1 || !matchesFilter(m, e.target)) continue;
      fit.boosts.push(`${STAT_NAME[e.type]} ${times(e.value)}${conditional ? '（條件達成時）' : ''}`);
    }
  }
  return fit;
}

/**
 * 把 slot 換成 candidate 之後的隊伍數值與差異。members 依隊伍位置（null＝空位），slot 0 是隊長：
 * 換隊長時用新隊長的隊長技判斷。
 */
export function previewSwap(
  members: (SwapMember | null)[], slot: number, candidate: SwapMember,
  leaderOf: (card: CardDef) => LeaderSkillDef | undefined, cooldownOf: (card: CardDef, skillLevel: number) => number | null,
): SwapPreview {
  const after = members.map((m, i) => (i === slot ? candidate : m));
  const totals = (list: (SwapMember | null)[]) => {
    const present = list.filter((m): m is SwapMember => !!m);
    const leader = list[0] ?? undefined;
    return {
      ...(leader ? teamTotals([leader, ...list.slice(1).filter((m): m is SwapMember => !!m)], leaderOf) : { hp: 0, rcv: 0 }),
      cost: present.reduce((n, m) => n + m.card.cost, 0),
    };
  };
  const before = totals(members);
  const now = totals(after);
  const leaderCard = after[0]?.card;
  return {
    hp: now.hp, rcv: now.rcv, cost: now.cost,
    dHp: now.hp - before.hp, dRcv: now.rcv - before.rcv, dCost: now.cost - before.cost,
    cooldown: cooldownOf(candidate.card, candidate.skillLevel ?? 1),
    leader: leaderFit(candidate.card, leaderCard ? leaderOf(leaderCard) : undefined),
  };
}
