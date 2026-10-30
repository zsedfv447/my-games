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

/** 隊伍空間公式：TEAM_COST_BASE + 2 ×（Lv − 1），Lv50 之後每級 +1 */
export const TEAM_COST_BASE = 33;
export const TEAM_COST_PER_LEVEL = 2;
export const TEAM_COST_SLOW_FROM = 50;

/**
 * 隊伍空間上限。Lv1 為 33：入門隊（5 張 4★，Cost 6）換掉 1 張改放 1 張 5★（Cost 9）剛好放得下；
 * Lv3 起可放 2 張 5★，Lv10 為 51。比舊公式（Lv1 為 30）每一級都多 3，已存的隊伍不會超過上限。
 */
export function teamCostLimit(level: number): number {
  const lv = Math.max(1, Math.floor(level));
  const fast = Math.min(lv, TEAM_COST_SLOW_FROM) - 1;
  const slow = Math.max(lv - TEAM_COST_SLOW_FROM, 0);
  return TEAM_COST_BASE + fast * TEAM_COST_PER_LEVEL + slow;
}

/** 隊伍 Cost 到幾級才放得下；超過滿級也放不下時回傳 null */
export function levelForTeamCost(cost: number): number | null {
  for (let lv = 1; lv <= MAX_PLAYER_LEVEL; lv++) if (teamCostLimit(lv) >= cost) return lv;
  return null;
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
