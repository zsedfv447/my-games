// 關卡導覽：把關卡資料與存檔整理成冒險地圖、關卡列表要顯示的狀態（純函式，方便測試）
import type { SaveData, StageDef } from '../core/types';
import { stageLockReason, type StageContext, type StageLockReason } from '../progression/stages';

/** v0.1 內建活動沒有開放期間資料，視為一直開放 */
export function stageContext(stages: StageDef[]): StageContext {
  return { stages, openEvents: new Set(stages.flatMap((s) => (s.event ? [s.event] : []))) };
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

export interface ChapterProgress {
  chapter: number;
  cleared: number;
  total: number;
  stars: number;
  maxStars: number;
  unlocked: boolean;
}

export function chapterProgress(save: SaveData, chapter: number, ctx: StageContext, now: number): ChapterProgress {
  const list = ctx.stages.filter((s) => s.kind === 'main' && s.chapter === chapter);
  const rows = list.map((s) => stageRow(save, s, ctx, now));
  return {
    chapter,
    cleared: rows.filter((r) => r.status === 'cleared').length,
    total: rows.length,
    stars: rows.reduce((n, r) => n + r.stars.filter(Boolean).length, 0),
    maxStars: rows.reduce((n, r) => n + r.stars.length, 0),
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
export function stageListPath(stage: StageDef): string {
  if (stage.kind === 'main') return `stages/${stage.chapter ?? 1}`;
  if (stage.kind === 'trial') return 'archetypes';
  return `stages/${stage.kind}`;
}
