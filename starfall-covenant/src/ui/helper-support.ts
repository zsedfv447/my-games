import type { CardDef, LeaderSkillDef, SaveData, StageDef, UnitFilter } from '../core/types';
import type { TeamRuleViolation } from '../progression/stages';
import { helperLevel, helperSkillLevel, helperProblem, stageAllowsHelper } from '../progression/helpers';

export interface LeaderSupportOffer {
  id: string; card: CardDef; level: number; skillLevel: number;
  problem: TeamRuleViolation | null; reasons: string[]; warnings: string[];
}
const conditionTypes = new Set(['hpBelow', 'heartsMatched', 'comboAtLeast', 'attributesMatched', 'orbsInOneMatch', 'enhancedOrbsMatched', 'skillUsedThisTurn']);
const effectTypes = new Set(['enhancedSkyfall', 'matchedOrbSkyfall', 'followUpDamage', 'skillCooldownStart', 'allyCooldownPerTurn', 'ignoreDefense']);
function matches(card: CardDef, filter?: UnitFilter): boolean {
  const includes = <T>(wanted: T | T[] | undefined, actual: T) => wanted === undefined || (Array.isArray(wanted) ? wanted.includes(actual) : wanted === actual);
  return !filter || (includes(filter.attribute, card.attribute) && includes(filter.race, card.race));
}
const attackEffects = (leader: LeaderSkillDef) => leader.rules.flatMap(rule => rule.effects).filter(effect => effect.type === 'atkMultiplier');
const mechanics = (leader: LeaderSkillDef) => new Set(leader.rules.flatMap(rule => [
  ...rule.conditions.filter(c => conditionTypes.has(c.type)).map(c => `condition:${c.type}`),
  ...rule.effects.filter(e => effectTypes.has(e.type)).map(e => `effect:${e.type}`),
]));

/** Permanent factual references, not a prediction of dynamic leader conditions or battle success. */
export function leaderSupportRoster(save: SaveData, stage: StageDef, cards: CardDef[], leaders: LeaderSkillDef[], stages: StageDef[]): LeaderSupportOffer[] {
  if (!stageAllowsHelper(stage)) return [];
  const cardById = new Map(cards.map(card => [card.id, card]));
  const leaderById = new Map(leaders.filter(l => l.description.trim() && l.rules.some(r => r.effects.length)).map(l => [l.id, l]));
  const slots = (save.teams[save.activeTeam] ?? save.teams[0])?.members ?? [];
  // null is a known empty position; unresolved UID/card remains unknown. Never promote slot1.
  const members = slots.map(uid => {
    if (uid === null) return null;
    const owned = save.inventory.cards.find(card => card.uid === uid);
    return owned ? cardById.get(owned.cardId) : undefined;
  });
  const current = members[0];
  const currentLeader = current?.leaderSkill ? leaderById.get(current.leaderSkill) : undefined;
  const known = members.filter((card): card is CardDef => !!card);
  const unknown = members.some(card => card === undefined);
  const count = members.filter(card => card !== null).length;
  const cleared = new Set(save.progress.clearedStages);
  const main = stages.filter(s => s.kind === 'main' && cleared.has(s.id)).length;
  const seen = new Set<string>();
  const ranked = cards.flatMap(card => {
    const leader = card.leaderSkill && leaderById.get(card.leaderSkill);
    if (card.race === 'material' || !leader || seen.has(card.id)) return [];
    seen.add(card.id);
    const reasons: string[] = [], warnings: string[] = [];
    const attacks = attackEffects(leader);
    const covered = known.filter(member => attacks.some(effect => matches(member, effect.target))).length;
    if (attacks.length) reasons.push(`攻擊加成對象涵蓋${covered}/${count}位目前隊員（條件另判）`);
    if (unknown) warnings.push('目前編成資料不完整；未知成員的加成與全隊條件無法確認。');
    if (current && !currentLeader) warnings.push('目前隊長技資料不完整；不推定配合類型。');
    let conflict = false;
    const composition = [...known, card];
    for (const [name, skill] of [['助戰', leader], ['目前隊長', currentLeader]] as const) {
      if (!skill) continue;
      const conditions = skill.rules.flatMap(rule => rule.conditions).filter(condition => condition.type === 'teamAll');
      if (conditions.some(condition => composition.some(member => !matches(member, condition.filter)))) {
        conflict = true;
        warnings.push(`${name}的部分全隊條件未滿足；其他規則仍須各自判斷。`);
      }
    }
    let sameCard = false, sameSkill = false, shared = false, reciprocal = false;
    if (current && currentLeader) {
      sameCard = card.id === current.id; sameSkill = card.leaderSkill === current.leaderSkill;
      if (sameCard) reasons.unshift('同隊長');
      if (sameSkill) reasons.push('相同隊長技');
      const currentMechanics = mechanics(currentLeader);
      const sharedTypes = [...mechanics(leader)].filter(type => currentMechanics.has(type));
      shared = sharedTypes.length > 0;
      if (sharedTypes.some(type => type.startsWith('condition:'))) reasons.push('具有相同類型的隊長條件（門檻仍以原文為準）');
      if (sharedTypes.some(type => type.startsWith('effect:'))) reasons.push('具有相同類型的隊長效果（細節仍以原文為準）');
      const currentAttacks = attackEffects(currentLeader);
      if (currentAttacks.length && !currentAttacks.some(effect => matches(card, effect.target))) {
        conflict = true; warnings.push('目前隊長的攻擊加成對象不涵蓋這位助戰（其他效果另判）。');
      }
      if (attacks.length && !attacks.some(effect => matches(current, effect.target))) {
        conflict = true; warnings.push('助戰的攻擊加成對象不涵蓋目前隊長（其他效果另判）。');
      }
      reciprocal = currentAttacks.some(effect => effect.target && matches(card, effect.target))
        && attacks.some(effect => effect.target && matches(current, effect.target));
      if (reciprocal) reasons.push('雙方指定對象的攻擊加成互相涵蓋（條件另判）');
    }
    const offer: LeaderSupportOffer = { id: `support:${card.id}`, card, level: helperLevel(card, main), skillLevel: helperSkillLevel(main), problem: helperProblem(stage, card), reasons, warnings };
    // No valid slot0 leader: retain the complete catalog in stable ID order after hard blocks.
    const rank = [Number(!!offer.problem), ...(currentLeader ? [Number(conflict), -Number(sameCard), -Number(sameSkill), -Number(shared), -Number(reciprocal), -covered] : [])];
    return [{ offer, rank }];
  });
  return ranked.sort((a, b) => {
    for (let i = 0; i < a.rank.length; i++) if (a.rank[i] !== b.rank[i]) return a.rank[i] - b.rank[i];
    return a.offer.card.id < b.offer.card.id ? -1 : a.offer.card.id > b.offer.card.id ? 1 : 0;
  }).map(row => row.offer);
}
