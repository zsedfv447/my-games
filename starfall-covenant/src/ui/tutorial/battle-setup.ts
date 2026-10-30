// 教學戰鬥的資料：新手起始隊伍（Lv.1）對上一隻被焰屬性剋制的森屬性敵人，開場盤面固定。
// 不扣體力、不給獎勵；隊長的主動技冷卻縮短成 1 回合，第一次轉珠後就能施放。
import { ORB_TYPES, type StageDef } from '../../core/types';
import { createRng, type Rng } from '../../core/rng';
import { startBattle, type Battle, type BattleData, type TeamMemberInput } from '../../battle/battle-state';
import type { GameData } from '../../data/validate';
import { scriptedBoardRng, tutorialBoard } from './flow';

/** 借用正式資料裡的敵人外觀（苔牙野豬），數值改成教學用 */
const ENEMY_BASE = 'e0002';
export const TUTORIAL_ENEMY_HP = 4000;
/** 天降用的固定種子：引導那一步剛好 2 Combo、不會連鎖把敵人直接打死，每次教學都一樣 */
export const TUTORIAL_SEED = 7;

export interface TutorialBattleSetup {
  stage: StageDef;
  data: BattleData;
  team: TeamMemberInput[];
  battle: Battle;
}

export function tutorialStage(): StageDef {
  return {
    id: 'tutorial', kind: 'main', name: '契約之門・試煉', stamina: 0, unlockAfter: null,
    waves: [{ enemies: [ENEMY_BASE] }],
    rewards: { coin: 0, playerExp: 0 },
    drops: [],
  };
}

export function tutorialBattleData(data: GameData): { data: BattleData; team: TeamMemberInput[] } {
  const starters = data.config.newPlayer.starterCards;
  const leader = data.cards.find((c) => c.id === starters[0]);
  const base = data.enemies.find((e) => e.id === ENEMY_BASE);
  if (!leader || !base) throw new Error('教學戰鬥缺少起始卡或敵人資料');
  return {
    data: {
      config: data.config,
      cards: data.cards,
      leaderSkills: data.leaderSkills,
      // 只縮短隊長主動技的冷卻，其他技能照正式資料
      skills: data.skills.map((s) => (s.id === leader.activeSkill ? { ...s, cooldown: { max: 1, min: 1 } } : s)),
      enemies: data.enemies.map((e) => (e.id === ENEMY_BASE ? { ...e, hp: TUTORIAL_ENEMY_HP, atk: 120, def: 0, cd: 3, abilities: [] } : e)),
    },
    team: starters.slice(0, 5).map((cardId) => ({ cardId, level: 1 })),
  };
}

export function createTutorialBattle(data: GameData, fallback: Rng = createRng(TUTORIAL_SEED)): TutorialBattleSetup {
  const stage = tutorialStage();
  const { data: battleData, team } = tutorialBattleData(data);
  const rng = scriptedBoardRng(tutorialBoard(), ORB_TYPES, fallback);
  return { stage, data: battleData, team, battle: startBattle(stage, team, null, rng, battleData) };
}
