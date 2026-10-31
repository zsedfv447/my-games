// 契約週報（提案 110）：每週第一次打開遊戲時回顧上週。資料來自手札的每週累計（records.weeks）、謎題紀錄與背包取得時間。純邏輯。
import type { CardDef, SaveData } from '../core/types';
import { puzzleOf } from './puzzle';
import { emptyWeek, recordsOf, type WeekStats } from './records';
import { dateKey, weekKey } from './time';

export interface WeeklyReport {
  /** 週一日期 */
  week: string;
  /** 顯示用：10/26～11/01 */
  range: string;
  stats: WeekStats;
  /** 本週通關最多次的隊長 */
  topLeader?: { cardId: string; clears: number };
  /** 本週解開謎題的天數 */
  puzzleDays: number;
  /** 週日結束時的謎題連續天數（之後才中斷也算當週的成績） */
  puzzleStreak: number;
  /** 本週新收的星靈（卡號不重複，稀有度高的在前），最多 limit 張 */
  newCards: string[];
}

const DAY = 86_400_000;
const at = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 12).getTime();
};

/** 上週的週一日期 */
export function lastWeekKey(now: number): string {
  return weekKey(at(weekKey(now)) - 7 * DAY);
}

/** 某週的 7 個日期鍵（週一到週日） */
export function weekDays(week: string): string[] {
  const start = at(week);
  return Array.from({ length: 7 }, (_, i) => dateKey(start + i * DAY));
}

export function weeklyReport(save: SaveData, week: string, cardOf: (id: string) => Pick<CardDef, 'rarity' | 'race'> | undefined, limit = 5): WeeklyReport | null {
  const days = weekDays(week);
  const inWeek = new Set(days);
  const stats = { ...emptyWeek(), ...recordsOf(save).weeks?.[week] };
  const topLeader = Object.entries(stats.leaderClears)
    .map(([cardId, clears]) => ({ cardId, clears }))
    .sort((a, b) => b.clears - a.clears || a.cardId.localeCompare(b.cardId))[0];

  const solved = new Set(puzzleOf(save).solvedDays);
  const puzzleDays = days.filter((d) => solved.has(d)).length;
  // 從週日往回數連續解開的天數（只看保留的解題日期）
  let puzzleStreak = 0;
  for (let t = at(days[6]); solved.has(dateKey(t)); t -= DAY) puzzleStreak++;

  const seen = new Set<string>();
  const newCards = save.inventory.cards
    .filter((c) => inWeek.has(dateKey(c.obtainedAt)))
    .filter((c) => (seen.has(c.cardId) ? false : (seen.add(c.cardId), true)))
    .map((c) => c.cardId)
    // 素材卡不算「星靈」
    .filter((id) => { const c = cardOf(id); return !!c && c.race !== 'material'; })
    .sort((a, b) => (cardOf(b)?.rarity ?? 0) - (cardOf(a)?.rarity ?? 0))
    .slice(0, limit);

  if (stats.battles === 0 && puzzleDays === 0 && newCards.length === 0) return null;
  const md = (key: string) => key.slice(5).replace('-', '/');
  return { week, range: `${md(days[0])}～${md(days[6])}`, stats, topLeader, puzzleDays, puzzleStreak, newCards };
}

/** 這次打開遊戲要不要自動跳出上週的週報（每週只跳一次；上週沒有任何紀錄就不跳） */
export function weeklyReportToShow(save: SaveData, now: number, cardOf: (id: string) => Pick<CardDef, 'rarity' | 'race'> | undefined): WeeklyReport | null {
  const week = lastWeekKey(now);
  if (recordsOf(save).reportShownFor === week) return null;
  return weeklyReport(save, week, cardOf);
}

export function markWeeklyReportShown(save: SaveData, week: string): SaveData {
  return { ...save, records: { ...recordsOf(save), reportShownFor: week } };
}
