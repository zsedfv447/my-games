// 隊伍換人超過隊伍空間時的提示：幾級可以放入、建議換下哪一位
import { levelForTeamCost } from '../progression/player';

export interface CostMember {
  uid: string;
  cost: number;
  /** 是否符合隊伍目前的流派（analyzeTeam 的 fits） */
  fits: boolean;
}

/**
 * 建議換下的隊員：不含隊長與正在更換的位置；Cost 高的優先，同 Cost 時不合流派的優先。
 * 只建議「換下後就放得下」的隊員，沒有就回傳 null。
 */
export function suggestSwapOut(members: (CostMember | null)[], changingSlot: number, total: number, limit: number): { uid: string; slot: number } | null {
  const over = total - limit;
  const pool = members
    .map((m, slot) => (m && slot !== 0 && slot !== changingSlot ? { ...m, slot } : null))
    .filter((m): m is CostMember & { slot: number } => !!m && m.cost >= over)
    .sort((a, b) => b.cost - a.cost || Number(a.fits) - Number(b.fits) || a.slot - b.slot);
  return pool[0] ? { uid: pool[0].uid, slot: pool[0].slot } : null;
}

/** 提示文字；name 是建議換下的隊員名字 */
export function overCostText(total: number, limit: number, swap?: { name: string; cost: number }): string {
  const lv = levelForTeamCost(total);
  const parts = [`隊伍空間不足（${total} / ${limit}）`];
  if (lv) parts.push(`玩家 Lv.${lv} 可以放入`);
  if (swap) parts.push(`或先換下「${swap.name}」（Cost ${swap.cost}）`);
  return parts.join('，');
}
