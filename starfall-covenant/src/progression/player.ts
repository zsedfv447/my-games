// 玩家等級：經驗曲線、升級獎勵、隊伍空間（Cost）上限
import type { GameConfig, SaveData } from '../core/types';

export const MAX_PLAYER_LEVEL = 99;
/** 每升 1 級給的星晶（GDD 2.3：星晶來源之一是玩家升級） */
export const GEMS_PER_LEVEL_UP = 1;

/** 從 level 升到 level+1 需要的經驗 */
export function expToNext(level: number): number {
  if (level >= MAX_PLAYER_LEVEL) return Infinity;
  return Math.floor(20 + 12 * Math.pow(level - 1, 1.3));
}

export function maxStamina(level: number, config: GameConfig): number {
  return config.stamina.baseMax + config.stamina.maxPerLevel * (level - 1);
}

/** 隊伍空間上限：Lv1 為 20，之後每級 +2，Lv50 後每級 +1 */
export function teamCostLimit(level: number): number {
  const fast = Math.min(level, 50) - 1;
  const slow = Math.max(level - 50, 0);
  return 20 + fast * 2 + slow;
}

export interface LevelUpInfo {
  from: number;
  to: number;
  gems: number;
}

/** 加玩家經驗；升級時補滿體力（可超過上限的部分保留）並發星晶 */
export function addPlayerExp(save: SaveData, amount: number, config: GameConfig, now: number): { save: SaveData; levelUp?: LevelUpInfo } {
  let { level, exp } = save.player;
  const from = level;
  exp += Math.max(0, Math.floor(amount));
  while (level < MAX_PLAYER_LEVEL && exp >= expToNext(level)) {
    exp -= expToNext(level);
    level += 1;
  }
  if (level >= MAX_PLAYER_LEVEL) exp = 0;
  if (level === from) return { save: { ...save, player: { ...save.player, exp } } };

  const gems = (level - from) * GEMS_PER_LEVEL_UP;
  const cap = maxStamina(level, config);
  return {
    save: {
      ...save,
      player: { ...save.player, level, exp, gems: save.player.gems + gems },
      stamina: { current: Math.max(save.stamina.current, cap), lastUpdate: now },
    },
    levelUp: { from, to: level, gems },
  };
}
