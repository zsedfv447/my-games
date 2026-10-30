// 中斷續戰：出戰時把隊伍與亂數種子寫進存檔，每次行動後存戰鬥快照，結算或放棄時清掉
import type { BattleSnapshot, TeamMemberInput } from '../battle/battle-state';
import type { ActiveBattle, SaveData } from '../core/types';

export function beginActiveBattle(
  save: SaveData,
  battle: { stageId: string; seed: number; members: TeamMemberInput[]; helper: TeamMemberInput | null },
  now: number,
): SaveData {
  const active: ActiveBattle = { ...battle, seed: battle.seed >>> 0, startedAt: now, snapshot: null };
  return { ...save, activeBattle: active };
}

/** 這一關有沒有進行中的戰鬥（入場券） */
export function activeBattleFor(save: SaveData, stageId: string): ActiveBattle | null {
  const a = save.activeBattle;
  return a && a.stageId === stageId ? a : null;
}

/** 存最新的戰鬥快照；存檔裡沒有這一關的戰鬥時不動（例如已經放棄） */
export function recordBattleSnapshot(save: SaveData, snapshot: BattleSnapshot): SaveData {
  const a = activeBattleFor(save, snapshot.stageId);
  return a ? { ...save, activeBattle: { ...a, snapshot } } : save;
}

export function clearActiveBattle(save: SaveData): SaveData {
  return save.activeBattle ? { ...save, activeBattle: null } : save;
}

/** 掉落用的種子：由出戰時的種子決定，重新整理後結算也不會骰出不同的掉落 */
export const dropSeed = (active: Pick<ActiveBattle, 'seed'>): number => (active.seed ^ 0x9e3779b9) >>> 0;
