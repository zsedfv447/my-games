// 契印師稱號（提案 95）：由成就、手札戰績、羈絆、情誼、殘頁、謎題連續天數解鎖，玩家選一個顯示在主城與手札。
// 解鎖狀態每次都由存檔推算，不另外存；存檔只記「正在使用的稱號」與「看過的稱號」（SaveData.titles，選填）。純邏輯。
import type { SaveData } from '../core/types';
import titleData from '../../data/titles.json';
import { recordsOf, type PlayerRecords } from './records';
import { dayNumber, puzzleOf } from './puzzle';
import { fail, ok, type SaveResult } from './result';

export type TitleCondition =
  | { type: 'achievement'; id: string }
  | { type: 'record'; key: 'battles' | 'wins' | 'maxCombo' | 'maxTurnDamage'; atLeast: number }
  /** 用幾種流派通關過（手札的流派通關次數 ≥ 1 的種類數） */
  | { type: 'archetypes'; atLeast: number }
  /** 任一位角色的羈絆場數 */
  | { type: 'cardBond'; atLeast: number }
  /** 羈絆場數達 points 的角色有幾位 */
  | { type: 'cardBondCount'; points: number; atLeast: number }
  /** 任一位流浪契印師的情誼 */
  | { type: 'helperBond'; atLeast: number }
  /** 收集的殘頁張數；all＝全部 */
  | { type: 'lorePages'; atLeast: number | 'all' }
  /** 星紋謎題最長連續解開天數（從保留的解題日期推算，最多 60 天） */
  | { type: 'puzzleStreak'; atLeast: number };

export interface TitleDef {
  id: string;
  name: string;
  description: string;
  condition: TitleCondition;
}

/** 存在 SaveData.titles（選填） */
export interface TitleState {
  /** 正在使用的稱號 id；null＝不顯示 */
  equipped: string | null;
  /** 已經在稱號列表看過的稱號（用來標 NEW） */
  seen: string[];
}

/** 推算需要、但不在存檔裡的資料（由呼叫端提供，titles 不直接依賴任務與殘頁模組） */
export interface TitleContext {
  /** 成就是否已達成（進度到達目標即可，不必領取） */
  achievementDone(id: string): boolean;
  /** 已收集與全部的殘頁張數（progression/lore.ts 的 collectedLorePages 會替舊存檔補上） */
  lorePages: { collected: number; total: number };
}

export const TITLES = titleData as TitleDef[];

export function titleStateOf(save: Pick<SaveData, 'titles'>): TitleState {
  return { equipped: null, seen: [], ...save.titles };
}

/** 解題日期裡最長的連續天數 */
export function longestStreak(days: string[]): number {
  const nums = [...new Set(days.map(dayNumber))].sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  nums.forEach((n, i) => {
    run = i > 0 && n === nums[i - 1] + 1 ? run + 1 : 1;
    best = Math.max(best, run);
  });
  return best;
}

const RECORD_KEYS: Record<Extract<TitleCondition, { type: 'record' }>['key'], keyof PlayerRecords> = {
  battles: 'battles', wins: 'wins', maxCombo: 'maxCombo', maxTurnDamage: 'maxTurnDamage',
};

/** 稱號條件的目前進度與目標 */
export function titleProgress(save: SaveData, def: TitleDef, ctx: TitleContext): { value: number; target: number; unlocked: boolean } {
  const c = def.condition;
  const max = (m: Record<string, number> | undefined) => Math.max(0, ...Object.values(m ?? {}));
  let value: number;
  let target: number;
  switch (c.type) {
    case 'achievement':
      value = ctx.achievementDone(c.id) ? 1 : 0;
      target = 1;
      break;
    case 'record':
      value = recordsOf(save)[RECORD_KEYS[c.key]] as number;
      target = c.atLeast;
      break;
    case 'archetypes':
      value = Object.values(recordsOf(save).archetypeClears).filter((n) => n > 0).length;
      target = c.atLeast;
      break;
    case 'cardBond':
      value = max(save.cardBond);
      target = c.atLeast;
      break;
    case 'cardBondCount':
      value = Object.values(save.cardBond ?? {}).filter((n) => n >= c.points).length;
      target = c.atLeast;
      break;
    case 'helperBond':
      value = max(save.helperBond);
      target = c.atLeast;
      break;
    case 'lorePages':
      value = ctx.lorePages.collected;
      target = c.atLeast === 'all' ? ctx.lorePages.total : c.atLeast;
      break;
    case 'puzzleStreak':
      value = longestStreak(puzzleOf(save).solvedDays);
      target = c.atLeast;
      break;
  }
  return { value: Math.min(value, target), target, unlocked: target > 0 && value >= target };
}

export function unlockedTitles(save: SaveData, ctx: TitleContext, defs: TitleDef[] = TITLES): TitleDef[] {
  return defs.filter((d) => titleProgress(save, d, ctx).unlocked);
}

/** 正在使用、而且仍然符合條件的稱號 */
export function equippedTitle(save: SaveData, ctx: TitleContext, defs: TitleDef[] = TITLES): TitleDef | undefined {
  const id = titleStateOf(save).equipped;
  const def = id ? defs.find((d) => d.id === id) : undefined;
  return def && titleProgress(save, def, ctx).unlocked ? def : undefined;
}

/** 換稱號；id 為 null 時不顯示稱號 */
export function equipTitle(save: SaveData, id: string | null, ctx: TitleContext, defs: TitleDef[] = TITLES): SaveResult<'unknownTitle' | 'locked'> {
  if (id !== null) {
    const def = defs.find((d) => d.id === id);
    if (!def) return fail('unknownTitle');
    if (!titleProgress(save, def, ctx).unlocked) return fail('locked');
  }
  return ok({ ...save, titles: { ...titleStateOf(save), equipped: id } });
}

/** 已解鎖但還沒在列表看過的稱號 */
export function newTitles(save: SaveData, ctx: TitleContext, defs: TitleDef[] = TITLES): TitleDef[] {
  const seen = new Set(titleStateOf(save).seen);
  return unlockedTitles(save, ctx, defs).filter((d) => !seen.has(d.id));
}

export function markTitlesSeen(save: SaveData, ids: string[]): SaveData {
  const state = titleStateOf(save);
  const seen = [...new Set([...state.seen, ...ids])];
  return seen.length === state.seen.length ? save : { ...save, titles: { ...state, seen } };
}

/**
 * 羈絆／情誼到上限之後的下一個長期目標：同類型條件裡、門檻比目前點數高的最低一個稱號。
 * kind：cardBond（角色羈絆）或 helperBond（流浪契印師情誼）。
 */
export function nextBondTitle(kind: 'cardBond' | 'helperBond', points: number, defs: TitleDef[] = TITLES): { title: TitleDef; atLeast: number } | undefined {
  return defs
    .flatMap((d) => (d.condition.type === kind && d.condition.atLeast > points ? [{ title: d, atLeast: d.condition.atLeast }] : []))
    .sort((a, b) => a.atLeast - b.atLeast)[0];
}
