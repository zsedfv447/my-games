// 模擬器的暫定資料：提案 001 的角色與技能＋基準關卡。正式資料寫進 data/ 後改用 gameData。
import type { ActiveSkillDef, ArchetypeId, CardDef, EnemyDef, LeaderSkillDef, StageDef } from '../../src/core/types';
import { ARCHETYPE_IDS } from '../../src/core/types';
import { gameData } from '../../src/data/load';
import type { BattleData } from '../../src/battle/battle-state';
import proposal from './fixtures/proposal-001.json';
import benchmark from './fixtures/benchmark.json';
import type { SimTeam } from './simulate';

export const proposalCards = proposal.cards as CardDef[];

export const fixtureData: BattleData = {
  config: gameData.config,
  cards: proposalCards,
  skills: proposal.skills as ActiveSkillDef[],
  leaderSkills: proposal.leaderSkills as LeaderSkillDef[],
  enemies: benchmark.enemies as EnemyDef[],
};

export const benchmarkStages = benchmark.stages as StageDef[];

/** 正式敵人與關卡（data/*.json）＋提案 001 的暫定卡片 */
export const gameStageData: BattleData = { ...fixtureData, enemies: gameData.enemies };

/** 流派試煉的借用隊伍 */
export function fixedTeamOf(stage: StageDef): SimTeam | null {
  if (!stage.fixedTeam || !stage.archetype) return null;
  const toInput = (m: { card: string; level: number; skillLevel?: number }) => ({ cardId: m.card, level: m.level, skillLevel: m.skillLevel });
  return {
    archetype: stage.archetype,
    members: stage.fixedTeam.members.map(toInput),
    helper: stage.fixedTeam.helper ? toInput(stage.fixedTeam.helper) : null,
  };
}

/** 提案 001 第 8 節的免抽入門隊；全員滿等，助戰帶同一張隊長 */
export function starterTeams(cards: CardDef[] = proposalCards): SimTeam[] {
  const byId = new Map(cards.map((c) => [c.id, c]));
  const teams = proposal.starterTeams as Record<ArchetypeId, string[]>;
  return ARCHETYPE_IDS.filter((a) => teams[a]).map((archetype) => {
    const members = teams[archetype].map((cardId) => ({ cardId, level: byId.get(cardId)?.maxLevel ?? 1 }));
    return { archetype, members, helper: { ...members[0] } };
  });
}
