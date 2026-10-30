// 出戰：把關卡＋存檔整理成戰鬥要的隊伍，並把關卡限制翻成玩家看得懂的文字
import type { CardDef, SaveData, StageDef, TeamRule, UnitFilter } from '../core/types';
import type { TeamMemberInput } from '../battle/battle-state';
import { checkTeamRule, type TeamRuleViolation } from '../progression/stages';
import type { HelperOffer } from '../progression/helpers';
import { ATTRIBUTE_NAMES, RACE_NAMES } from './art/palette';

export interface SortieTeam {
  /** 流派試煉借用的隊伍 */
  borrowed: boolean;
  members: TeamMemberInput[];
  helper: TeamMemberInput | null;
  /** members 對應的卡片定義（找不到的卡會被略過） */
  cards: CardDef[];
  helperCard?: CardDef;
}

/** 玩家為某一關挑的助戰；null 代表選了「不帶助戰」 */
export interface ChosenHelper {
  npcId: string;
  card: CardDef;
  input: TeamMemberInput;
}

// 只記在記憶體：出戰確認 → 選助戰 → 戰鬥這段流程用，不寫進存檔
const chosenHelpers = new Map<string, ChosenHelper | null>();

export function chooseHelper(stageId: string, helper: ChosenHelper | null): void {
  chosenHelpers.set(stageId, helper);
}

export function offerToHelper(offer: HelperOffer): ChosenHelper {
  return { npcId: offer.npc.id, card: offer.card, input: { cardId: offer.card.id, level: offer.level, skillLevel: offer.skillLevel } };
}

/**
 * 出戰確認時整理助戰：已選的 NPC 換成最新等級與卡片；
 * 還沒選過（或已選的不在名單上）就自動帶第一位符合限制的 NPC。
 */
export function ensureHelper(stageId: string, roster: HelperOffer[]): void {
  const current = chosenHelpers.get(stageId);
  if (current === null) return;
  const same = current && roster.find((o) => o.npc.id === current.npcId);
  const pick = same || roster.find((o) => !o.problem);
  if (pick) chosenHelpers.set(stageId, offerToHelper(pick));
  else chosenHelpers.delete(stageId);
}

/** undefined：還沒選過；null：選了不帶 */
export function chosenHelper(stageId: string): ChosenHelper | null | undefined {
  return chosenHelpers.get(stageId);
}

export function buildSortieTeam(
  stage: StageDef,
  save: SaveData,
  cardById: (id: string) => CardDef | undefined,
  helper: ChosenHelper | null = chosenHelper(stage.id) ?? null,
): SortieTeam {
  if (stage.fixedTeam) {
    const members = stage.fixedTeam.members.filter((m) => cardById(m.card));
    const helperDef = stage.fixedTeam.helper && cardById(stage.fixedTeam.helper.card);
    return {
      borrowed: true,
      members: members.map((m) => ({ cardId: m.card, level: m.level, skillLevel: m.skillLevel })),
      helper: helperDef ? { cardId: helperDef.id, level: stage.fixedTeam.helper!.level, skillLevel: stage.fixedTeam.helper!.skillLevel } : null,
      cards: members.map((m) => cardById(m.card)!),
      helperCard: helperDef || undefined,
    };
  }
  const team = save.teams[save.activeTeam] ?? save.teams[0];
  const owned = (team?.members ?? [])
    .map((uid) => (uid ? save.inventory.cards.find((c) => c.uid === uid) : undefined))
    .filter((c): c is NonNullable<typeof c> => !!c && !!cardById(c.cardId));
  return {
    borrowed: false,
    members: owned.map((c) => ({ uid: c.uid, cardId: c.cardId, level: c.level, skillLevel: c.skillLevel, limitBreak: c.limitBreak, awakened: c.awakened })),
    helper: helper?.input ?? null,
    cards: owned.map((c) => cardById(c.cardId)!),
    helperCard: helper?.card,
  };
}

function describeFilter(f: UnitFilter): string {
  const list = <T>(v: T | T[] | undefined) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
  const parts: string[] = [];
  const attrs = list(f.attribute);
  const races = list(f.race);
  if (attrs.length) parts.push(`${attrs.map((a) => ATTRIBUTE_NAMES[a]).join('／')}屬性`);
  if (races.length) parts.push(races.map((r) => RACE_NAMES[r]).join('／'));
  return parts.join('的');
}

/** 關卡隊伍限制的條列說明 */
export function describeTeamRule(rule: TeamRule | undefined, archetypeName: (id: string) => string, cardName: (id: string) => string): string[] {
  if (!rule) return [];
  const out: string[] = [];
  if (rule.filter) out.push(`全隊必須是${describeFilter(rule.filter)}`);
  if (rule.archetype) out.push(`全隊必須屬於「${archetypeName(rule.archetype)}」流派`);
  if (rule.requiredCards?.length) out.push(`隊伍必須包含：${rule.requiredCards.map(cardName).join('、')}`);
  if (rule.maxMembers !== undefined) out.push(`最多 ${rule.maxMembers} 名隊員`);
  if (rule.noHelper) out.push('不能帶助戰');
  return out;
}

export const VIOLATION_TEXT: Record<TeamRuleViolation | 'emptyTeam', string> = {
  teamFilter: '隊伍裡有不符合屬性／種族限制的成員',
  teamArchetype: '隊伍裡有不屬於指定流派的成員',
  teamMissingCard: '隊伍缺少指定的卡片',
  teamTooLarge: '隊員人數超過上限',
  helperNotAllowed: '這一關不能帶助戰',
  emptyTeam: '隊伍裡還沒有成員，先到「隊伍」編成吧',
};

export function sortieProblem(stage: StageDef, team: SortieTeam): TeamRuleViolation | 'emptyTeam' | null {
  if (team.members.length === 0) return 'emptyTeam';
  if (team.borrowed) return null;
  return checkTeamRule(stage.teamRule, team.cards, team.helperCard);
}
