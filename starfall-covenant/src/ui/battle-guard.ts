// 戰鬥操作的開關規則：結算動畫播放中（resolving）不能撤退、不能施放主動技，避免在勝負已定時呼叫 forfeit 或提前轉珠
import type { BattlePhase } from '../battle/battle-state';

export interface BattleGuard {
  phase: BattlePhase;
  /** 轉珠或主動技的結算動畫正在播放 */
  resolving: boolean;
}

/** 可以等玩家操作（撤退、施放主動技）：輪到玩家且沒有動畫在播 */
export const canAct = (g: BattleGuard): boolean => g.phase === 'player' && !g.resolving;

/** 取消撤退後要不要重新開放盤面：只有原本就開放、而且現在仍可操作時才開 */
export const reenableAfterCancel = (boardWasEnabled: boolean, g: BattleGuard): boolean => boardWasEnabled && canAct(g);
