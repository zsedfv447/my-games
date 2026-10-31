// 長期目標的里程碑（提案 94、106）：謎題連續天數的階梯獎勵與星燈守夜。不改謎題的判題規則。純邏輯。

/** 連續解開到這些天數時，改送里程碑的星晶（取代那一天的每 7 天 1 星晶） */
export const PUZZLE_MILESTONES: readonly { days: number; gems: number }[] = [
  { days: 7, gems: 3 },
  { days: 14, gems: 5 },
  { days: 30, gems: 10 },
  { days: 60, gems: 20 },
];

/** 里程碑以外，每連續滿 7 天仍送的星晶（原本的規則） */
export const PUZZLE_WEEKLY_DAYS = 7;
export const PUZZLE_WEEKLY_GEMS = 1;

/** 連續第 streak 天解開時加送的星晶；沒有就是 0 */
export function puzzleStreakGems(streak: number): number {
  const milestone = PUZZLE_MILESTONES.find((m) => m.days === streak);
  if (milestone) return milestone.gems;
  return streak > 0 && streak % PUZZLE_WEEKLY_DAYS === 0 ? PUZZLE_WEEKLY_GEMS : 0;
}

/** 下一個會送星晶的連續天數（含今天要解的那一天）；給畫面寫「再連續 N 天」 */
export function nextPuzzleBonus(streak: number): { days: number; gems: number; milestone: boolean } {
  for (let d = streak + 1; ; d++) {
    const gems = puzzleStreakGems(d);
    if (gems) return { days: d, gems, milestone: PUZZLE_MILESTONES.some((m) => m.days === d) };
  }
}

// ---------- 星燈守夜（提案 106）：每連續 14 天得 1 盞燈（最多 2 盞），漏掉的每一天自動消耗 1 盞保住連續天數 ----------

export const LAMP_EVERY = 14;
export const LAMP_MAX = 2;

/** 日期鍵（YYYY-MM-DD）→ 天數序號 */
const dayIndex = (day: string): number => {
  const [y, m, d] = day.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
};

/** lastDay 之後到 today 之前漏掉幾天（昨天有解＝0；今天已解也是 0） */
export function missedDays(lastDay: string, today: string): number {
  return Math.max(0, dayIndex(today) - dayIndex(lastDay) - 1);
}

/**
 * 考慮星燈後今天之前的連續天數：漏掉的天數不超過持有的燈就保住（並回報要消耗幾盞），否則歸零。
 * 燈在真正解開今天的題目時才扣（claim 時寫回紀錄）。
 */
export function streakWithLamps(record: { lastDay: string | null; streak: number; lamps?: number }, today: string): { streak: number; lampsUsed: number } {
  if (!record.lastDay) return { streak: 0, lampsUsed: 0 };
  const missed = missedDays(record.lastDay, today);
  if (missed === 0) return { streak: record.streak, lampsUsed: 0 };
  return missed <= (record.lamps ?? 0) ? { streak: record.streak, lampsUsed: missed } : { streak: 0, lampsUsed: 0 };
}

/** 解開後的燈數：先扣掉這次用掉的，連續天數每到 14 的倍數加 1 盞，最多 LAMP_MAX */
export function lampsAfterSolve(lamps: number, lampsUsed: number, newStreak: number): number {
  const left = Math.max(0, lamps - lampsUsed);
  return Math.min(LAMP_MAX, left + (newStreak > 0 && newStreak % LAMP_EVERY === 0 ? 1 : 0));
}
