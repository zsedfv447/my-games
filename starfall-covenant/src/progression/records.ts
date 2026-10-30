// 契印師手札：個人戰績（最高 Combo、單回合最高傷害、最快通關、隊長與流派的通關次數）。純邏輯，操作 SaveData。
import type { PlayerRecords, SaveData } from '../core/types';

export type { PlayerRecords };

export type RecordKind = 'maxCombo' | 'maxTurnDamage' | 'fastest';

export interface BattleRecordEntry {
  stageId: string;
  won: boolean;
  turns: number;
  maxCombo: number;
  maxTurnDamage: number;
  leaderCardId?: string;
  archetype?: string | null;
}

export function emptyRecords(): PlayerRecords {
  return { battles: 0, wins: 0, maxCombo: 0, maxTurnDamage: 0, fastestTurns: {}, leaderClears: {}, archetypeClears: {} };
}

/** 讀存檔的戰績；舊存檔沒有這個欄位或缺欄位時補預設值 */
export function recordsOf(save: Pick<SaveData, 'records'>): PlayerRecords {
  return { ...emptyRecords(), ...save.records };
}

/**
 * 把一場戰鬥寫進戰績，回傳新存檔與這場刷新的紀錄。
 * 「新紀錄」只在打破既有紀錄時成立：第一次留下數值（原本是 0／沒有）不算，避免第一場就到處跳新紀錄。
 */
export function applyBattleRecord(save: SaveData, e: BattleRecordEntry): { save: SaveData; newRecords: RecordKind[] } {
  const r = recordsOf(save);
  const newRecords: RecordKind[] = [];
  const next: PlayerRecords = {
    ...r,
    battles: r.battles + 1,
    wins: r.wins + (e.won ? 1 : 0),
    maxCombo: Math.max(r.maxCombo, e.maxCombo),
    maxTurnDamage: Math.max(r.maxTurnDamage, Math.round(e.maxTurnDamage)),
    fastestTurns: { ...r.fastestTurns },
    leaderClears: { ...r.leaderClears },
    archetypeClears: { ...r.archetypeClears },
  };
  if (r.maxCombo > 0 && e.maxCombo > r.maxCombo) newRecords.push('maxCombo');
  if (r.maxTurnDamage > 0 && e.maxTurnDamage > r.maxTurnDamage) newRecords.push('maxTurnDamage');
  if (e.won) {
    const prev = r.fastestTurns[e.stageId];
    if (e.turns > 0 && (prev === undefined || e.turns < prev)) {
      next.fastestTurns[e.stageId] = e.turns;
      if (prev !== undefined) newRecords.push('fastest');
    }
    if (e.leaderCardId) next.leaderClears[e.leaderCardId] = (next.leaderClears[e.leaderCardId] ?? 0) + 1;
    if (e.archetype) next.archetypeClears[e.archetype] = (next.archetypeClears[e.archetype] ?? 0) + 1;
  }
  return { save: { ...save, records: next }, newRecords };
}

/** 通關次數最多的隊長；沒有時回傳 undefined */
export function favoriteLeader(r: PlayerRecords): { cardId: string; clears: number } | undefined {
  return leaderRanking(r, 1)[0];
}

export function winRate(r: PlayerRecords): number {
  return r.battles ? r.wins / r.battles : 0;
}

/** 「新紀錄！」的顯示文字 */
export function recordText(kind: RecordKind, entry: Pick<BattleRecordEntry, 'maxCombo' | 'maxTurnDamage' | 'turns'>): string {
  switch (kind) {
    case 'maxCombo': return `新紀錄！最高 Combo ${entry.maxCombo}`;
    case 'maxTurnDamage': return `新紀錄！單回合傷害 ${Math.round(entry.maxTurnDamage).toLocaleString()}`;
    case 'fastest': return `新紀錄！本關最快 ${entry.turns} 回合通關`;
  }
}

/** 一次轉珠對敵人造成的總傷害（被吸收轉成回復的負數不算） */
export function turnDamage(summary: { hits: { damage: number }[] }): number {
  return summary.hits.reduce((sum, h) => sum + Math.max(0, h.damage), 0);
}

/** 隊長通關排行（次數多到少，同次數依卡號），最多 limit 位 */
export function leaderRanking(r: PlayerRecords, limit = 5): { cardId: string; clears: number }[] {
  return Object.entries(r.leaderClears)
    .map(([cardId, clears]) => ({ cardId, clears }))
    .sort((a, b) => b.clears - a.clears || a.cardId.localeCompare(b.cardId))
    .slice(0, limit);
}

/** 各流派的通關次數，依 ids 的順序列出（沒通關過的是 0） */
export function archetypeCounts(r: PlayerRecords, ids: string[]): { id: string; clears: number }[] {
  return ids.map((id) => ({ id, clears: r.archetypeClears[id] ?? 0 }));
}

/** 存檔裡已拿到的星章總數 */
export function starCount(save: Pick<SaveData, 'progress'>): number {
  return Object.values(save.progress.stars).reduce((sum, s) => sum + s.filter(Boolean).length, 0);
}
