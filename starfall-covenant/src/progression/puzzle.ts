// 星紋謎題每日一題（提案 51）：依日期用種子產生當天的盤面與題目，不存題目資料。純邏輯，操作 SaveData。
//
// 出題方式：用當天的種子建一個開場不會自行消除的盤面，再隨機試走很多條轉珠路徑，
// 挑出最好的一條當「參考解」，題目門檻就訂在參考解做得到的程度，所以每題一定有解。
// 判定只看「這一次轉珠放手後」盤面上的消除（不算天降連鎖），結果完全由路徑決定。

import type { GameConfig, OrbType, Reward, SaveData } from '../core/types';
import { applyPath, countOrbs, createBoard, findMatches, inBounds, type Board, type BoardSize, type MatchGroup, type Pos } from '../battle/board';
import { createRng, type Rng } from '../core/rng';
import { grantReward } from './rewards';
import { fail, ok, type SaveResult } from './result';
import { dateKey } from './time';

export type PuzzleGoal =
  /** 一次轉珠做出 N Combo */
  | { kind: 'combo'; combo: number }
  /** 一次轉珠消除 N 顆以上的某色珠 */
  | { kind: 'colorCount'; orb: OrbType; count: number }
  /** 一次轉珠把盤面上的某色珠全部消掉 */
  | { kind: 'clearColor'; orb: OrbType }
  /** 一次轉珠消除 N 種不同顏色 */
  | { kind: 'rainbow'; colors: number };

export type PuzzleKind = PuzzleGoal['kind'];

export interface Puzzle {
  day: string;
  board: Board;
  goal: PuzzleGoal;
  /** 轉珠最多可以走幾步（交換幾次） */
  maxSteps: number;
  /** 出題時找到的參考解（不給玩家看，測試用來驗證有解） */
  solution: Pos[];
}

export interface PuzzleJudgement {
  solved: boolean;
  /** 目前做到的數值（Combo 數、消除顆數、顏色數；clearColor 是剩下的顆數） */
  value: number;
  groups: MatchGroup[];
  board: Board;
  /** 路徑不合法（超過步數、經過封鎖珠） */
  invalid?: 'tooManySteps' | 'blocked';
}

const KINDS: PuzzleKind[] = ['combo', 'colorCount', 'clearColor', 'rainbow'];
const COLORS: OrbType[] = ['fire', 'water', 'wood', 'light', 'dark', 'heart'];
const DEFAULT_SIZE: BoardSize = { cols: 6, rows: 5 };
/** 每個盤面試走幾條路徑 */
const CANDIDATES = 500;
const MAX_ATTEMPTS = 60;
/** 參考解最長幾步；玩家可以多走 STEP_SLACK 步 */
const MAX_WALK = 10;
const STEP_SLACK = 3;
/** 各題型最低要求（找不到就換盤面重試） */
const MIN_TARGET: Record<PuzzleKind, number> = { combo: 3, colorCount: 5, clearColor: 3, rainbow: 3 };

/** 字串雜湊（FNV-1a），把日期變成種子 */
export function daySeed(day: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < day.length; i++) {
    h ^= day.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** 日期鍵 → 從 1970-01-01 起算第幾天（題型輪替用） */
export function dayNumber(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

/** 隨機走一段轉珠路徑（上下左右，不立刻走回頭） */
function randomWalk(rng: Rng, size: BoardSize, steps: number): Pos[] {
  const path: Pos[] = [{ row: rng.int(size.rows), col: rng.int(size.cols) }];
  const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
  while (path.length <= steps) {
    const cur = path[path.length - 1];
    const prev = path[path.length - 2];
    const options = dirs
      .map(([dr, dc]) => ({ row: cur.row + dr, col: cur.col + dc }))
      .filter((p) => inBounds(size, p) && !(prev && p.row === prev.row && p.col === prev.col));
    path.push(rng.pick(options));
  }
  return path;
}

/** 這次消除對題目的數值 */
function measure(kind: PuzzleKind, orb: OrbType, groups: MatchGroup[], before: Board): number {
  const cleared = () => groups.filter((g) => g.orb === orb).reduce((n, g) => n + g.cells.length, 0);
  switch (kind) {
    case 'combo': return groups.length;
    case 'colorCount': return cleared();
    case 'clearColor': return countOrbs(before)[orb] - cleared();
    case 'rainbow': return new Set(groups.map((g) => g.orb)).size;
  }
}

/** 當天的題目：同一天一定相同，不同天的盤面與題目不同 */
export function dailyPuzzle(day: string, size: BoardSize = DEFAULT_SIZE): Puzzle {
  const rng = createRng(daySeed(`puzzle:${day}`));
  // 題型依日期輪替，四天一輪
  const kind = KINDS[dayNumber(day) % KINDS.length];
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const orb = rng.pick(COLORS);
    // 清色題讓目標顏色少一點（3～4 顆），才有可能一次全清
    const board = createBoard(size, rng, kind === 'clearColor' ? { rates: { [orb]: 0.1 } } : {});
    const total = countOrbs(board)[orb];
    if (kind === 'clearColor' && (total < 3 || total > 4)) continue;
    let best: { path: Pos[]; value: number } | null = null;
    for (let i = 0; i < CANDIDATES; i++) {
      const path = randomWalk(rng, size, 3 + rng.int(MAX_WALK - 2));
      const moved = applyPath(board, path).board;
      const value = measure(kind, orb, findMatches(moved), board);
      // clearColor 越少越好（0 = 全清），其他越多越好；同分取步數少的
      const better = !best || (kind === 'clearColor' ? value < best.value : value > best.value) || (value === best.value && path.length < best.path.length);
      if (better) best = { path, value };
    }
    if (!best) continue;
    const goal: PuzzleGoal | null =
      kind === 'combo' ? (best.value >= MIN_TARGET.combo ? { kind, combo: best.value } : null)
      : kind === 'colorCount' ? (best.value >= MIN_TARGET.colorCount ? { kind, orb, count: best.value } : null)
      : kind === 'clearColor' ? (best.value === 0 ? { kind, orb } : null)
      : best.value >= MIN_TARGET.rainbow ? { kind, colors: best.value } : null;
    if (!goal) continue;
    return { day, board, goal, maxSteps: Math.max(5, best.path.length - 1 + STEP_SLACK), solution: best.path };
  }
  // 理論上用不到：所有嘗試都達不到門檻時，退回 2 Combo（隨機盤面幾乎一定做得到）
  const board = createBoard(size, rng);
  let fallback: Pos[] = [];
  for (let i = 0; i < CANDIDATES * 4 && !fallback.length; i++) {
    const path = randomWalk(rng, size, 3 + rng.int(MAX_WALK - 2));
    if (findMatches(applyPath(board, path).board).length >= 2) fallback = path;
  }
  return { day, board, goal: { kind: 'combo', combo: 2 }, maxSteps: Math.max(5, fallback.length - 1 + STEP_SLACK), solution: fallback };
}

/** 判定一次轉珠是否解開題目 */
export function judgePuzzle(puzzle: Puzzle, path: Pos[]): PuzzleJudgement {
  const moved = applyPath(puzzle.board, path);
  const groups = moved.completed ? findMatches(moved.board) : [];
  const g = puzzle.goal;
  const value = measure(g.kind, 'orb' in g ? g.orb : 'heart', groups, puzzle.board);
  const base = { value, groups, board: moved.board };
  if (!moved.completed) return { ...base, solved: false, invalid: 'blocked' };
  if (path.length - 1 > puzzle.maxSteps) return { ...base, solved: false, invalid: 'tooManySteps' };
  const solved = g.kind === 'combo' ? value >= g.combo
    : g.kind === 'colorCount' ? value >= g.count
    : g.kind === 'clearColor' ? value === 0
    : value >= g.colors;
  return { ...base, solved };
}

// ---------- 紀錄與獎勵 ----------

/** 存在 SaveData.puzzle（選填） */
export interface PuzzleRecord {
  /** 最後一次解開的日期 */
  lastDay: string | null;
  /** 連續解開天數 */
  streak: number;
  /** 最近解開的日期（最多保留 SOLVED_KEEP 天） */
  solvedDays: string[];
}

export const PUZZLE_COIN = 300;
/** 連續解開滿 STREAK_DAYS 天（7、14、21…）送 STREAK_GEMS 星晶 */
export const STREAK_DAYS = 7;
export const STREAK_GEMS = 1;
const SOLVED_KEEP = 60;

export function emptyPuzzleRecord(): PuzzleRecord {
  return { lastDay: null, streak: 0, solvedDays: [] };
}

/** 讀存檔的謎題紀錄；舊存檔沒有這個欄位時補預設值 */
export function puzzleOf(save: Pick<SaveData, 'puzzle'>): PuzzleRecord {
  return { ...emptyPuzzleRecord(), ...save.puzzle };
}

/** 前一天的日期鍵（用日曆日計算，不受夏令時間影響） */
export function previousDay(now: number): string {
  const d = new Date(now);
  return dateKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1, 12).getTime());
}

/** 目前的連續天數：昨天或今天有解才算還連著 */
export function currentStreak(save: Pick<SaveData, 'puzzle'>, now: number): number {
  const r = puzzleOf(save);
  return r.lastDay === dateKey(now) || r.lastDay === previousDay(now) ? r.streak : 0;
}

export function solvedToday(save: Pick<SaveData, 'puzzle'>, now: number): boolean {
  return puzzleOf(save).lastDay === dateKey(now);
}

/** 今天解開後會拿到的獎勵 */
export function puzzleReward(save: Pick<SaveData, 'puzzle'>, now: number): { reward: Reward; streak: number } {
  const streak = currentStreak(save, now) + 1;
  const reward: Reward = { coin: PUZZLE_COIN };
  if (streak % STREAK_DAYS === 0) reward.gems = STREAK_GEMS;
  return { reward, streak };
}

export type PuzzleClaimError = 'alreadyClaimed' | 'notSolved' | 'wrongDay';

/** 領今天的謎題獎勵：重新判定路徑，解開且今天還沒領過才發 */
export function claimPuzzle(
  save: SaveData,
  puzzle: Puzzle,
  path: Pos[],
  config: GameConfig,
  now: number,
): SaveResult<PuzzleClaimError> & { reward?: Reward; streak?: number } {
  const today = dateKey(now);
  if (puzzle.day !== today) return fail('wrongDay');
  if (solvedToday(save, now)) return fail('alreadyClaimed');
  if (!judgePuzzle(puzzle, path).solved) return fail('notSolved');
  const { reward, streak } = puzzleReward(save, now);
  const record = puzzleOf(save);
  const granted = grantReward(save, reward, config, now).save;
  const next: SaveData = {
    ...granted,
    puzzle: { lastDay: today, streak, solvedDays: [...record.solvedDays, today].slice(-SOLVED_KEEP) },
  };
  return { ...ok(next), reward, streak };
}
