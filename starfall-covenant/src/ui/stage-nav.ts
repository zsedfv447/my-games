// 關卡導覽：把關卡資料與存檔整理成冒險地圖、關卡列表要顯示的狀態（純函式，方便測試）
import type { SaveData, StageDef } from '../core/types';
import { openEventIds, type EventDef } from '../progression/events';
import { STARS_PER_STAGE, stageLockReason, type StageContext, type StageLockReason } from '../progression/stages';

/** 依 data/events.json 的檔期決定哪些活動開放；沒給活動資料時視為全部開放（測試用） */
export function stageContext(stages: StageDef[], events?: EventDef[], now = Date.now()): StageContext {
  if (!events) return { stages, openEvents: new Set(stages.flatMap((s) => (s.event ? [s.event] : []))) };
  return { stages, events, openEvents: openEventIds(events, now) };
}

export type StageStatus = 'cleared' | 'open' | StageLockReason | 'towerAhead';

export interface StageRow {
  stage: StageDef;
  status: StageStatus;
  stars: boolean[];
}

const WEEKDAY_NAMES = ['日', '一', '二', '三', '四', '五', '六'];
export const weekdayText = (days: number[] | undefined) => (days?.length ? `週${days.map((d) => WEEKDAY_NAMES[d]).join('、')}` : '');

export function stageRow(save: SaveData, stage: StageDef, ctx: StageContext, now: number): StageRow {
  const stars = (stage.stars ?? []).map((_, i) => !!save.progress.stars[stage.id]?.[i]);
  const lock = stageLockReason(save, stage, ctx, now);
  let status: StageStatus = lock ?? (save.progress.clearedStages.includes(stage.id) ? 'cleared' : 'open');
  // 挑戰之塔一層一層往上爬
  if (!lock && stage.kind === 'tower') {
    const floor = ctx.stages.filter((s) => s.kind === 'tower').findIndex((s) => s.id === stage.id) + 1;
    if (floor > save.progress.towerFloor + 1) status = 'towerAhead';
  }
  return { stage, status, stars };
}

export const isPlayable = (s: StageStatus) => s === 'open' || s === 'cleared';

export const LOCK_TEXT: Record<Exclude<StageStatus, 'open' | 'cleared'>, string> = {
  locked: '通過前一關後開放',
  wrongDay: '今天沒有開放',
  eventClosed: '活動未開放',
  unknownStage: '找不到關卡',
  towerAhead: '先通過下面的樓層',
};

/** 鎖定說明；解鎖條件是另一種關卡（例如外傳要先通過主線某關）時寫出那一關的名稱 */
export function lockText(r: StageRow, stages: StageDef[]): string {
  if (isPlayable(r.status)) return '';
  const before = r.status === 'locked' && r.stage.unlockAfter ? stages.find((s) => s.id === r.stage.unlockAfter) : undefined;
  if (before && before.kind !== r.stage.kind) return `通過${before.kind === 'main' ? `第 ${before.chapter} 章「${before.name}」` : `「${before.name}」`}後開放`;
  return LOCK_TEXT[r.status as keyof typeof LOCK_TEXT];
}

/** 外傳章的進度：開放了沒、通關幾關 */
export function sideStoryProgress(save: SaveData, ctx: StageContext, now: number): { open: boolean; cleared: number; total: number; lock: string } {
  const rows = ctx.stages.filter((s) => s.kind === 'side').map((s) => stageRow(save, s, ctx, now));
  return {
    open: rows.some((r) => isPlayable(r.status)),
    cleared: rows.filter((r) => r.status === 'cleared').length,
    total: rows.length,
    lock: rows[0] ? lockText(rows[0], ctx.stages) : '',
  };
}

export interface ChapterProgress {
  chapter: number;
  cleared: number;
  total: number;
  stars: number;
  maxStars: number;
  unlocked: boolean;
}

/**
 * 章節卡的進度。stageCount 傳 ChapterDef.stageCount：章節分批上線時，總關數與星章總數以預定關數計算
 * （例如第 6 章先上 3 關，要顯示「3 / 9」而不是「3 / 3」），和 chapterStars 的算法一致。
 */
export function chapterProgress(save: SaveData, chapter: number, ctx: StageContext, now: number, stageCount?: number): ChapterProgress {
  const list = ctx.stages.filter((s) => s.kind === 'main' && s.chapter === chapter);
  const rows = list.map((s) => stageRow(save, s, ctx, now));
  const notYet = Math.max(0, (stageCount ?? 0) - rows.length);
  return {
    chapter,
    cleared: rows.filter((r) => r.status === 'cleared').length,
    total: rows.length + notYet,
    stars: rows.reduce((n, r) => n + r.stars.filter(Boolean).length, 0),
    maxStars: rows.reduce((n, r) => n + r.stars.length, 0) + notYet * STARS_PER_STAGE,
    unlocked: rows.some((r) => isPlayable(r.status)),
  };
}

/** 主城「出發冒險」要直接帶到的關卡：第一個還沒通過但已開放的主線關 */
export function nextMainStage(save: SaveData, ctx: StageContext, now: number): StageDef | undefined {
  return ctx.stages.find((s) => s.kind === 'main' && stageRow(save, s, ctx, now).status === 'open');
}

// 勝利後剛開放的關卡：關卡列表顯示一次跳動提示後就清掉（只記在記憶體）
const justUnlocked = new Set<string>();
export function markJustUnlocked(ids: string[]): void {
  ids.forEach((id) => justUnlocked.add(id));
}
/** 取出並清掉提示；回傳這次要閃的關卡 id */
export function takeJustUnlocked(ids: string[]): Set<string> {
  const hit = new Set(ids.filter((id) => justUnlocked.has(id)));
  hit.forEach((id) => justUnlocked.delete(id));
  return hit;
}

/** 關卡所屬的關卡列表（hash 路徑）：主線回到那一章、活動／每日／塔回到各自列表、流派試煉回到流派頁 */
export function stageListPath(stage: StageDef, events: EventDef[] = []): string {
  if (stage.kind === 'main') return `stages/${stage.chapter ?? 1}`;
  // 系列活動（流派克星週）有自己的列表：#/stages/nemesis
  const series = stage.event ? events.find((e) => e.id === stage.event)?.series : undefined;
  if (series) return `stages/${series}`;
  if (stage.kind === 'trial') return 'archetypes';
  return `stages/${stage.kind}`;
}
