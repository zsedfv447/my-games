// 模擬器資料：卡片與技能優先用 data/ 的正式資料（空的時候退回提案 001 暫定資料）＋基準關卡。
import type { ActiveSkillDef, ArchetypeId, CardDef, EnemyDef, LeaderSkillDef, StageDef } from '../../src/core/types';
import { ARCHETYPE_IDS } from '../../src/core/types';
import { gameData } from '../../src/data/load';
import type { BattleData } from '../../src/battle/battle-state';
import proposal from './fixtures/proposal-001.json';
import benchmark from './fixtures/benchmark.json';
import type { SimTeam } from './simulate';
import { createNewSave } from '../../src/save/save';
import { HELPER_NPCS, helperRoster } from '../../src/progression/helpers';

const useGameData = gameData.cards.length > 0;

export const proposalCards = (useGameData ? gameData.cards : proposal.cards) as CardDef[];

export const fixtureData: BattleData = {
  config: gameData.config,
  cards: proposalCards,
  skills: (useGameData ? gameData.skills : proposal.skills) as ActiveSkillDef[],
  leaderSkills: (useGameData ? gameData.leaderSkills : proposal.leaderSkills) as LeaderSkillDef[],
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

/**
 * 新存檔的入門隊（Lv1）＋該關預設帶的助戰（助戰名單第一個沒有限制問題的，和出擊準備畫面一樣）。
 * 助戰每天輪替，所以每個 NPC 各跑一隊；流派用隊長的流派決定轉珠策略。
 */
export function newbieTeams(stage: StageDef, now = Date.now()): (SimTeam & { label: string })[] {
  const save = createNewSave(gameData.config, now);
  const byId = new Map(proposalCards.map((c) => [c.id, c]));
  const members = save.teams[save.activeTeam].members.map((uid) => {
    const owned = save.inventory.cards.find((c) => c.uid === uid)!;
    return { cardId: owned.cardId, level: owned.level };
  });
  const archetype = byId.get(members[0].cardId)?.archetypes[0]?.id ?? 'mono';
  const offers = helperRoster(save, stage, HELPER_NPCS, gameData.stages, (id) => byId.get(id), now).filter((o) => !o.problem);
  const none = { label: '入門隊（無助戰）', archetype, members, helper: null };
  return [none, ...offers.map((o) => ({ label: `入門隊＋${o.npc.name}`, archetype, members, helper: { cardId: o.card.id, level: o.level, skillLevel: o.skillLevel } }))];
}

/** 提案 001 第 8 節的免抽入門隊；全員滿等，助戰帶同一張隊長 */
export function starterTeams(cards: CardDef[] = proposalCards): SimTeam[] {
  const byId = new Map(cards.map((c) => [c.id, c]));
  const teams: Partial<Record<ArchetypeId, string[]>> = { ...proposal.starterTeams };
  for (const stage of gameData.stages) {
    if (stage.kind === 'trial' && stage.archetype && stage.fixedTeam && !teams[stage.archetype]) teams[stage.archetype] = stage.fixedTeam.members.map(m => m.card);
  }
  return ARCHETYPE_IDS.filter((a) => teams[a]).map((archetype) => {
    const members = teams[archetype]!.map((cardId) => ({ cardId, level: byId.get(cardId)?.maxLevel ?? 1 }));
    return { archetype, members, helper: { ...members[0] } };
  });
}

/**
 * 「滿等、有覺醒」的老手隊：入門隊的卡能進化的都換成最終型態（免抽卡的進化素材都是關卡掉落），
 * 全員滿等、覺醒全開。用來設定後期關卡（第 5 章、挑戰之塔頂層）的數值。
 */
export function veteranTeams(cards: CardDef[] = proposalCards): SimTeam[] {
  const byId = new Map(cards.map((c) => [c.id, c]));
  const final = (id: string): CardDef => {
    let card = byId.get(id)!;
    while (card.evolution && byId.has(card.evolution.to)) card = byId.get(card.evolution.to)!;
    return card;
  };
  return starterTeams(cards).map((t) => {
    const upgrade = (m: { cardId: string }) => {
      const card = final(m.cardId);
      return { cardId: card.id, level: card.maxLevel, awakened: card.awakenings?.length ?? 0 };
    };
    const members = t.members.map(upgrade);
    return { archetype: t.archetype, members, helper: { ...members[0] } };
  });
}
