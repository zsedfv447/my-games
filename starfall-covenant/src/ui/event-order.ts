// 活動的排列：開放中的限時活動（快結束的在前）→ 即將開放 → 常駐 → 已結束（純函式，方便測試）
import { eventWindow, type EventDef } from '../progression/events';

function rank(event: EventDef, now: number): [number, number] {
  const w = eventWindow(event, now);
  switch (w.state) {
    case 'open': return [0, w.end];
    case 'upcoming': return [1, w.start];
    case 'always': return [2, 0];
    case 'ended': return [3, 0];
  }
}

/**
 * 活動列表用的順序。系列活動（例如 series: "nemesis" 的流派克星週）有自己的入口，
 * 和限時活動列表一樣排除（判斷沿用 stages.ts 的 !e.series）。
 */
export function sortEventsForList(events: EventDef[], now: number): EventDef[] {
  return events.filter((e) => !e.series).map((e, i) => ({ e, i, r: rank(e, now) }))
    .sort((a, b) => a.r[0] - b.r[0] || a.r[1] - b.r[1] || a.i - b.i)
    .map((x) => x.e);
}

/** 開放中的限時活動（有檔期、不是系列活動），快結束的在前；主城橫幅與冒險頁的活動小卡只看這些 */
export function openLimitedEvents(events: EventDef[], now: number): EventDef[] {
  return sortEventsForList(events, now).filter((e) => eventWindow(e, now).state === 'open');
}
