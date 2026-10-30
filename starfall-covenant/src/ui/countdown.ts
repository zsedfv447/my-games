// 倒數文字：體力回復「+1 04:32」與「全滿還要 1:12:00」。純邏輯。

/** 毫秒 → m:ss（未滿一小時）或 h:mm:ss；秒數無條件進位，避免顯示 0:00 但還沒回復 */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/** 資源列上的短倒數；體力已滿（或超過上限）時回傳 null 不顯示 */
export function staminaNextText(nextMs: number): string | null {
  return nextMs > 0 ? `+1 ${formatCountdown(nextMs)}` : null;
}

export function staminaFullText(fullMs: number): string {
  return fullMs > 0 ? `全滿還要 ${formatCountdown(fullMs)}` : '體力已滿';
}
