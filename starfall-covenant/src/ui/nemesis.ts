// 流派克星週：每週一輪替的主題挑戰。主題就是 events.json 裡 series 為 nemesis 的活動（純資料整理，不碰 DOM）
import type { SaveData, StageDef } from '../core/types';
import { currentSeriesEvent, eventStatusText, type EventDef } from '../progression/events';
import type { StageContext } from '../progression/stages';
import { lockText, stageRow } from './stage-nav';

export const NEMESIS = 'nemesis';

/** 系列活動（流派克星週等）的關卡不出現在「限時活動」列表 */
export function isSeriesStage(stage: StageDef, events: EventDef[]): boolean {
  return !!stage.event && events.some((e) => e.id === stage.event && e.series);
}

export interface NemesisView {
  event: EventDef;
  open: boolean;
  /** 「剩餘 3 天 4 小時」或「12:00:00 後開放」 */
  status: string;
  archetypes: string[];
  stages: StageDef[];
}

/** 本週主題、剩餘時間、推薦流派與關卡 */
export function nemesisView(events: EventDef[], stages: StageDef[], archetypeName: (id: string) => string, now: number): NemesisView | null {
  const cur = currentSeriesEvent(events, NEMESIS, now);
  if (!cur) return null;
  return {
    event: cur.event,
    open: cur.window.state === 'open' || cur.window.state === 'always',
    status: eventStatusText(cur.event, now),
    archetypes: (cur.event.recommendedArchetypes ?? []).map(archetypeName),
    stages: stages.filter((s) => s.event === cur.event.id),
  };
}

/** 克星週還沒開放時的說明（例如「通過第 3 章「雲端林道」後開放」）；已開放回傳空字串 */
export function nemesisLock(save: SaveData, view: NemesisView, ctx: StageContext, now: number): string {
  const first = view.stages.find((s) => !s.unlockAfter || !view.stages.some((x) => x.id === s.unlockAfter));
  if (!first) return '';
  const row = stageRow(save, first, ctx, now);
  return row.status === 'locked' ? lockText(row, ctx.stages) : '';
}
