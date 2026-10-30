// 日期鍵：每日／每週重置都以玩家裝置的當地時間午夜為界
const pad = (n: number) => String(n).padStart(2, '0');

/** 當地日期，例如 2026-10-30 */
export function dateKey(now: number): string {
  const d = new Date(now);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 本週週一的日期（每週從週一開始） */
export function weekKey(now: number): string {
  const d = new Date(now);
  const offset = (d.getDay() + 6) % 7;
  return dateKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() - offset).getTime());
}

/** 星期幾（0=週日），和 StageDef.weekdays 一致 */
export function weekday(now: number): number {
  return new Date(now).getDay();
}
