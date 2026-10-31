// 本週契約（提案 123）：把克星週、星淵回廊、星靈遠行、誓約碑、星紋謎題的本週進度集中成一張清單。
// 只讀存檔、只呼叫各系統既有的純函式，不重寫規則（不碰 DOM，方便測試）。
import type { ChapterDef, SaveData, StageDef } from '../core/types';
import { ABYSS_FLOORS, abyssProgress, isAbyssOpen } from '../progression/abyss';
import type { EventDef } from '../progression/events';
import { EXPEDITION, expeditionsOf, hasReturned, openChapters } from '../progression/expedition';
import { oathsOf, WEEKLY_GEM_CAP } from '../progression/oaths';
import { currentStreak, solvedToday } from '../progression/puzzle';
import { periodFirstClearClaimed } from '../progression/stages';
import { nemesisLock, nemesisView } from './nemesis';
import { stageContext } from './stage-nav';

export type ChecklistId = 'nemesis' | 'abyss' | 'expedition' | 'oath' | 'puzzle';

export interface ChecklistRow {
  id: ChecklistId;
  title: string;
  /** 進度文字，例如「2/3」「連續 12 天」 */
  progress: string;
  /** 補充說明（還沒開放時是開放條件） */
  hint: string;
  /** 已經開放（沒開放的不算進摘要） */
  open: boolean;
  /** 本週（或今天）該做的已經做完 */
  done: boolean;
  /** 點了要去的畫面 */
  to: [string, string[]];
}

export interface ChecklistData {
  stages: StageDef[];
  events: EventDef[];
  chapters: ChapterDef[];
}

/** 最後一個已通關主線關卡所在的章節（誓約碑從這章的關卡列表出戰） */
function latestClearedChapter(save: SaveData, stages: StageDef[]): number | null {
  const cleared = new Set(save.progress.clearedStages);
  const main = stages.filter((s) => s.kind === 'main' && cleared.has(s.id));
  return main.length ? Math.max(...main.map((s) => s.chapter ?? 1)) : null;
}

export function weeklyChecklist(save: SaveData, now: number, data: ChecklistData): ChecklistRow[] {
  const rows: ChecklistRow[] = [];

  // 流派克星週：本週 3 關的每週首通
  const week = nemesisView(data.events, data.stages, (id) => id, now);
  if (week) {
    const lock = nemesisLock(save, week, stageContext(data.stages, data.events, now), now);
    const got = week.stages.filter((s) => periodFirstClearClaimed(save, s, data.events, now)).length;
    rows.push({
      id: 'nemesis', title: '流派克星週', progress: `${got}/${week.stages.length}`,
      hint: lock || `${week.event.name.replace(/^流派克星週・/, '')}・${week.status}`,
      open: !lock, done: got >= week.stages.length, to: ['stages', ['nemesis']],
    });
  }

  // 星淵回廊：本週最高層
  const abyssOpen = isAbyssOpen(save);
  const abyss = abyssProgress(save, now);
  rows.push({
    id: 'abyss', title: '星淵回廊', progress: `${abyss.best}/${ABYSS_FLOORS}`,
    hint: abyssOpen ? '每週一重置，從第 1 層往上爬' : '通過第 5 章後開放',
    open: abyssOpen, done: abyss.best >= ABYSS_FLOORS, to: ['abyss', []],
  });

  // 星靈遠行：歸來待領／遠行中／還能派幾隊
  const parties = expeditionsOf(save);
  const returned = parties.filter((e) => hasReturned(e, now)).length;
  const free = EXPEDITION.maxParties - parties.length;
  const expOpen = openChapters(save, data.chapters, data.stages).length > 0;
  rows.push({
    id: 'expedition', title: '星靈遠行',
    progress: returned ? `${returned} 隊已歸來` : parties.length ? `${parties.length} 隊遠行中` : '沒有隊伍出發',
    hint: !expOpen ? '通過第 1 章後開放' : free > 0 ? `還可以再派 ${free} 隊` : '隊伍都在路上',
    open: expOpen, done: returned === 0 && free === 0, to: ['expedition', []],
  });

  // 誓約碑：本週星晶上限
  const oath = oathsOf(save, now);
  const chapter = latestClearedChapter(save, data.stages);
  rows.push({
    id: 'oath', title: '誓約碑', progress: `本週星晶 ${oath.gems}/${WEEKLY_GEM_CAP}`,
    hint: chapter ? '已通關的主線關卡出戰前可以刻下誓約' : '通過第一個主線關卡後開放',
    open: chapter !== null, done: oath.gems >= WEEKLY_GEM_CAP, to: chapter ? ['stages', [String(chapter)]] : ['adventure', []],
  });

  // 星紋謎題：今天解了沒、連續天數
  const today = solvedToday(save, now);
  rows.push({
    id: 'puzzle', title: '星紋謎題', progress: `連續 ${currentStreak(save, now)} 天`,
    hint: today ? '今天的題目已解開' : '今天的題目還沒解',
    open: true, done: today, to: ['puzzle', []],
  });

  return rows;
}

/** 主城一行摘要：「本週契約 3/5」；全部沒開放時回傳 null */
export function checklistSummary(rows: ChecklistRow[]): { done: number; total: number; text: string } | null {
  const open = rows.filter((r) => r.open);
  if (!open.length) return null;
  const done = open.filter((r) => r.done).length;
  return { done, total: open.length, text: `本週契約 ${done}/${open.length}` };
}
