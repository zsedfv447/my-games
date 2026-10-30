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

export function sortEventsForList(events: EventDef[], now: number): EventDef[] {
  return events.map((e, i) => ({ e, i, r: rank(e, now) }))
    .sort((a, b) => a.r[0] - b.r[0] || a.r[1] - b.r[1] || a.i - b.i)
    .map((x) => x.e);
}

/** 開放中的限時活動（有檔期的），快結束的在前；主城橫幅只顯示這些 */
export function openLimitedEvents(events: EventDef[], now: number): EventDef[] {
  return sortEventsForList(events, now).filter((e) => eventWindow(e, now).state === 'open');
}
