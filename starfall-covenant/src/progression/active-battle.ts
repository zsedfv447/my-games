// 中斷續戰：出戰時把隊伍與亂數種子寫進存檔，每次行動後存戰鬥快照，結算或放棄時清掉
import type { BattleSnapshot, TeamMemberInput } from '../battle/battle-state';
import type { ActiveBattle, SaveData } from '../core/types';
import type { DropPlan, PlannedDrop } from './drops';
import { applyBattleRecord } from './records';

export function beginActiveBattle(
  save: SaveData,
  battle: { stageId: string; seed: number; members: TeamMemberInput[]; helper: TeamMemberInput | null; drops: DropPlan; oaths?: string[] },
  now: number,
): SaveData {
  const { oaths, ...rest } = battle;
  const active: ActiveBattle = { ...rest, seed: battle.seed >>> 0, startedAt: now, snapshot: null, ...(oaths?.length ? { oaths: [...oaths] } : {}) };
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

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const isInput = (x: unknown) => isObj(x) && typeof x.cardId === 'string' && typeof x.level === 'number';

/**
 * 讀檔時檢查進行中的戰鬥：欄位壞掉或格式不對就丟掉（當作沒有），不能讓遊戲打不開。
 * 快照內容是否還對得上關卡資料，等到開打還原時再檢查（resumeBattle 會丟錯，介面再清掉）。
 */
export function sanitizeActiveBattle(x: unknown): ActiveBattle | null {
  if (!isObj(x)) return null;
  const { stageId, seed, members, helper, startedAt, drops, snapshot } = x;
  if (typeof stageId !== 'string' || typeof seed !== 'number' || typeof startedAt !== 'number') return null;
  if (!Array.isArray(members) || members.length === 0 || !members.every(isInput)) return null;
  if (helper !== null && !isInput(helper)) return null;
  if (!isObj(drops) || drops.stageId !== stageId || !Array.isArray(drops.drops)) return null;
  if (snapshot !== null && !(isObj(snapshot) && snapshot.stageId === stageId && isObj(snapshot.state))) return null;
  return x as unknown as ActiveBattle;
}

/**
 * 在戰鬥畫面以外放棄進行中的戰鬥（主城詢問、到別關出發）：清掉入場券，並在契印師手札記一場失敗。
 * 呼叫端還要發 stageFailed（任務計數）。沒有進行中的戰鬥時回傳 null。
 */
export function abandonActiveBattle(save: SaveData): { save: SaveData; stageId: string } | null {
  const a = save.activeBattle;
  if (!a) return null;
  const st = a.snapshot?.state;
  const recorded = applyBattleRecord(clearActiveBattle(save), {
    stageId: a.stageId, won: false, turns: st?.turns ?? 0, maxCombo: st?.maxCombo ?? 0, maxTurnDamage: 0, leaderCardId: a.members[0]?.cardId,
  });
  return { save: recorded.save, stageId: a.stageId };
}

/** 還原戰鬥時，哪些掉落已經在中斷前收過：之前的波次全部，加上這一波已倒下的敵人 */
export function collectedDrops(plan: DropPlan, state: { wave: number; enemies: { hp: number }[] }): PlannedDrop[] {
  return plan.drops.filter((d) => d.wave < state.wave || (d.wave === state.wave && (state.enemies[d.enemy]?.hp ?? 0) <= 0));
}
