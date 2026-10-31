// 長期目標的里程碑（提案 94）：謎題連續天數的階梯獎勵。只加里程碑，不改謎題本身的判定與紀錄規則。純邏輯。

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
