// NPC 助戰（GDD 2.3「好友助戰」）：單機版用「流浪契印師」名單模擬好友。
// 名單隨主線進度解鎖新的 NPC、換上更強的卡、等級跟著提升；每天輪替排序。
import type { ArchetypeId, CardDef, SaveData, StageDef } from '../core/types';
import { checkTeamRule, type TeamRuleViolation } from './stages';
import { dateKey } from './time';
import helperData from '../../data/helpers.json';

export interface HelperNpcDef {
  id: string;
  name: string;
  title: string;
  /** 這位 NPC 代表的流派 */
  archetype: ArchetypeId;
  /** 通過這一關後出現在名單上（null 代表一開始就有） */
  unlockAfter: string | null;
  /** 依序換卡：通過 after 那一關後改帶這張卡 */
  tiers: { card: string; after: string | null }[];
  quote: string;
}

export interface HelperOffer {
  npc: HelperNpcDef;
  card: CardDef;
  level: number;
  skillLevel: number;
  /** 帶的卡屬於本關推薦流派 */
  recommended: boolean;
  /** 這位助戰不符合本關限制的原因；null 代表可以帶 */
  problem: TeamRuleViolation | null;
}

/**
 * 助戰等級曲線（依已通關的主線關數，各章開頭為錨點、中間線性內插）：
 * 目標約比同進度玩家主力高 5～10 級（玩家等級見 tools/sim 的 --progress 報表），第 5 章通關前不超過 Lv75，
 * 主線通關（已通關數 ≥ fullAt，也就是 st-5-9）後才拉到卡片滿級。技能等級每 skillEvery 關 +1，通關前最多 skillCapBefore。
 */
export const HELPER_LEVEL = {
  anchors: [[0, 10], [9, 20], [18, 42], [27, 56], [36, 74], [44, 75]] as const,
  fullAt: 45,
  skillEvery: 15,
  skillCapBefore: 3,
  maxSkill: 5,
} as const;

const clearedMain = (save: SaveData, stages: StageDef[]) => {
  const cleared = new Set(save.progress.clearedStages);
  return stages.filter((s) => s.kind === 'main' && cleared.has(s.id)).length;
};

export function isHelperUnlocked(save: SaveData, npc: HelperNpcDef): boolean {
  return !npc.unlockAfter || save.progress.clearedStages.includes(npc.unlockAfter);
}

/** 目前帶哪張卡：已通過條件的最後一階 */
export function helperCardId(save: SaveData, npc: HelperNpcDef): string {
  const cleared = new Set(save.progress.clearedStages);
  let card = npc.tiers[0].card;
  for (const t of npc.tiers) if (!t.after || cleared.has(t.after)) card = t.card;
  return card;
}

/** 助戰等級：每通過一關主線 +2 級，不超過卡片上限 */
/** 曲線上的等級（還沒套卡片滿級上限） */
export function helperCurveLevel(mainCleared: number): number {
  const { anchors, fullAt } = HELPER_LEVEL;
  if (mainCleared >= fullAt) return Infinity;
  let level: number = anchors[anchors.length - 1][1];
  for (let i = 1; i < anchors.length; i++) {
    const [x0, y0] = anchors[i - 1];
    const [x1, y1] = anchors[i];
    if (mainCleared <= x1) {
      level = y0 + ((Math.max(mainCleared, x0) - x0) * (y1 - y0)) / (x1 - x0);
      break;
    }
  }
  return Math.round(level);
}

export function helperLevel(card: CardDef, mainCleared: number): number {
  return Math.max(1, Math.min(card.maxLevel, helperCurveLevel(mainCleared)));
}

export function helperSkillLevel(mainCleared: number): number {
  if (mainCleared >= HELPER_LEVEL.fullAt) return HELPER_LEVEL.maxSkill;
  return Math.min(HELPER_LEVEL.skillCapBefore, 1 + Math.floor(mainCleared / HELPER_LEVEL.skillEvery));
}

/** 只看助戰本身會不會違反關卡限制（隊員的問題另外判斷） */
export function helperProblem(stage: StageDef, card: CardDef): TeamRuleViolation | null {
  const rule = stage.teamRule;
  if (!rule) return null;
  if (rule.noHelper) return 'helperNotAllowed';
  return checkTeamRule({ filter: rule.filter, archetype: rule.archetype }, [], card);
}

/** 關卡能不能自己選助戰：借用隊伍（流派試煉）與禁止助戰的關卡不行 */
export function stageAllowsHelper(stage: StageDef): boolean {
  return !stage.fixedTeam && !stage.teamRule?.noHelper;
}

/** 每天輪替的起點：同一天結果固定 */
export function dailyOffset(now: number, size: number): number {
  if (size <= 0) return 0;
  let h = 0;
  for (const ch of dateKey(now)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % size;
}

/**
 * 本關的助戰名單：符合限制的排前面，再來是推薦流派，其餘依每日輪替順序。
 * 不能選助戰的關卡回傳空陣列。
 */
export function helperRoster(
  save: SaveData,
  stage: StageDef,
  npcs: HelperNpcDef[],
  stages: StageDef[],
  cardById: (id: string) => CardDef | undefined,
  now: number,
): HelperOffer[] {
  if (!stageAllowsHelper(stage)) return [];
  const main = clearedMain(save, stages);
  const recommended = new Set(stage.recommendedArchetypes ?? []);
  const unlocked = npcs.filter((n) => isHelperUnlocked(save, n));
  const offset = dailyOffset(now, unlocked.length);
  const rotated = [...unlocked.slice(offset), ...unlocked.slice(0, offset)];
  const offers = rotated.flatMap((npc): HelperOffer[] => {
    const card = cardById(helperCardId(save, npc));
    if (!card) return [];
    return [{
      npc,
      card,
      level: helperLevel(card, main),
      skillLevel: helperSkillLevel(main),
      recommended: card.archetypes.some((a) => recommended.has(a.id)),
      problem: helperProblem(stage, card),
    }];
  });
  const rank = (o: HelperOffer) => (o.problem ? 2 : 0) + (o.recommended ? 0 : 1);
  return offers.map((o, i) => ({ o, i })).sort((a, b) => rank(a.o) - rank(b.o) || a.i - b.i).map((x) => x.o);
}

/** data/helpers.json：流浪契印師名單 */
export const HELPER_NPCS = helperData as HelperNpcDef[];
