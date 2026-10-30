// 限時活動：開放期間、循環檔期與倒數（data/events.json）
/** 一個活動。period 為 null 代表常駐開放 */
export interface EventDef {
  id: string;
  name: string;
  summary: string;
  /** 活動代幣 id（兌換商店用） */
  token?: string;
  /** 代幣的顯示名稱；有 token 就必須填（validate.ts 檢查） */
  tokenName?: string;
  /**
   * start／end 為 ISO 時間字串（不寫時區時以裝置當地時間計）。
   * repeatDays：每隔幾天重新開一檔（從 start 起算），讓單機版本的活動定期回歸。
   */
  period: { start: string; end: string; repeatDays?: number } | null;
}

const DAY = 86_400_000;

export type EventWindow =
  | { state: 'always' }
  | { state: 'open'; start: number; end: number }
  | { state: 'upcoming'; start: number; end: number }
  | { state: 'ended' };

/** 目前（或下一檔）的開放區間 */
export function eventWindow(event: EventDef, now: number): EventWindow {
  if (!event.period) return { state: 'always' };
  const start = Date.parse(event.period.start);
  const end = Date.parse(event.period.end);
  if (!(end > start)) return { state: 'ended' };
  if (now < start) return { state: 'upcoming', start, end };
  const repeat = (event.period.repeatDays ?? 0) * DAY;
  if (!repeat) return now < end ? { state: 'open', start, end } : { state: 'ended' };
  const n = Math.floor((now - start) / repeat);
  const s = start + n * repeat;
  const e = s + Math.min(end - start, repeat);
  return now < e ? { state: 'open', start: s, end: e } : { state: 'upcoming', start: s + repeat, end: e + repeat };
}

/**
 * 目前算第幾期（0 起算）與該期開始時間：開始前算第 0 期，休息期間與結束後仍算最近一期，
 * 所以限購要等下一期真正開始才重置。沒有檔期的活動永遠是第 0 期。
 */
export function eventPeriod(event: EventDef, now: number): { index: number; start: number | null } {
  if (!event.period) return { index: 0, start: null };
  const start = Date.parse(event.period.start);
  const repeat = (event.period.repeatDays ?? 0) * DAY;
  const index = repeat > 0 && now > start ? Math.floor((now - start) / repeat) : 0;
  return { index, start: start + index * repeat };
}

export const isEventOpen = (event: EventDef, now: number) => {
  const w = eventWindow(event, now);
  return w.state === 'open' || w.state === 'always';
};

export function openEventIds(events: EventDef[], now: number): Set<string> {
  return new Set(events.filter((e) => isEventOpen(e, now)).map((e) => e.id));
}

/** 倒數文字：超過 1 天顯示「3 天 4 小時」，否則「05:12:09」 */
export function formatCountdown(ms: number): string {
  const t = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(t / 86_400);
  const hh = Math.floor((t % 86_400) / 3600);
  if (d > 0) return `${d} 天 ${hh} 小時`;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(hh)}:${pad(Math.floor((t % 3600) / 60))}:${pad(t % 60)}`;
}

/** 列表與橫幅用的一句話狀態 */
export function eventStatusText(event: EventDef, now: number): string {
  const w = eventWindow(event, now);
  switch (w.state) {
    case 'always': return '常駐開放';
    case 'open': return `剩餘 ${formatCountdown(w.end - now)}`;
    case 'upcoming': return `${formatCountdown(w.start - now)} 後開放`;
    case 'ended': return '活動已結束';
  }
}
