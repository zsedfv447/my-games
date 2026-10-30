// 盤面：建立、轉珠路徑、消除判定、天降補珠、強化珠與干擾珠。
// 純邏輯，不碰 DOM／Canvas；隨機一律透過 Rng。

import { ATTRIBUTES, ORB_TYPES, type GameConfig, type OrbSource, type OrbType } from '../core/types';
import type { Rng } from '../core/rng';

export interface Orb {
  type: OrbType;
  /** 強化珠：消除時傷害提升 */
  enhanced: boolean;
  /** 封鎖珠：不能被拿起或交換，但仍可被消除 */
  locked: boolean;
  /** 毒珠：消除時對隊伍造成傷害 */
  poison: boolean;
  /** 隱藏珠：介面不顯示顏色，邏輯上照常消除 */
  hidden: boolean;
}

export interface Pos {
  row: number;
  col: number;
}

export interface Board {
  cols: number;
  rows: number;
  /** 依列優先排列，索引 = row * cols + col；row 0 為最上方 */
  cells: Orb[];
}

export type BoardSize = Pick<GameConfig['board'], 'cols' | 'rows'>;

export interface SkyfallOptions {
  /** 指定珠的出現機率（0–1）；其餘機率由沒指定的珠平分 */
  rates?: Partial<Record<OrbType, number>>;
  /** 新珠為強化珠的機率（0–1） */
  enhancedChance?: number;
  /** false 時新落下的珠盡量不會自行組成消除（天降不消除） */
  skyfallCombo?: boolean;
}

export interface MatchGroup {
  orb: OrbType;
  /** 組成這一組的格子索引 */
  cells: number[];
  enhancedCount: number;
  poisonCount: number;
  /** 0 = 玩家轉珠造成，1 以後 = 第幾次落下連鎖 */
  cascade: number;
}

export interface ResolveResult {
  board: Board;
  /** 依消除順序排列的所有組；每一組 = 1 Combo */
  groups: MatchGroup[];
  combo: number;
}

export const MIN_MATCH = 3;

// ---------- 基本工具 ----------

export function makeOrb(type: OrbType, flags: Partial<Omit<Orb, 'type'>> = {}): Orb {
  return { type, enhanced: false, locked: false, poison: false, hidden: false, ...flags };
}

export const toIndex = (board: Pick<Board, 'cols'>, p: Pos): number => p.row * board.cols + p.col;
export const toPos = (board: Pick<Board, 'cols'>, i: number): Pos => ({
  row: Math.floor(i / board.cols),
  col: i % board.cols,
});

export function inBounds(board: Pick<Board, 'cols' | 'rows'>, p: Pos): boolean {
  return p.row >= 0 && p.row < board.rows && p.col >= 0 && p.col < board.cols;
}

/** 八方向相鄰（可斜向轉珠） */
export function isAdjacent(a: Pos, b: Pos): boolean {
  const dr = Math.abs(a.row - b.row);
  const dc = Math.abs(a.col - b.col);
  return dr <= 1 && dc <= 1 && dr + dc > 0;
}

export function cloneBoard(board: Board): Board {
  return { cols: board.cols, rows: board.rows, cells: board.cells.map((o) => ({ ...o })) };
}

/** 方便測試與關卡設計：每列一個字串，字元 f/w/g/l/d/h 分別代表焰潮森輝蝕心 */
const ORB_CHARS: Record<string, OrbType> = { f: 'fire', w: 'water', g: 'wood', l: 'light', d: 'dark', h: 'heart' };

export function boardFromStrings(rows: string[]): Board {
  const cols = rows[0]?.length ?? 0;
  const cells = rows.flatMap((line, r) => {
    if (line.length !== cols) throw new Error(`第 ${r} 列長度不一致`);
    return [...line].map((ch) => {
      const type = ORB_CHARS[ch.toLowerCase()];
      if (!type) throw new Error(`未知的珠子代號：${ch}`);
      // 大寫代表強化珠
      return makeOrb(type, { enhanced: ch !== ch.toLowerCase() });
    });
  });
  return { cols, rows: rows.length, cells };
}

export function boardToStrings(board: Board): string[] {
  const charOf = Object.fromEntries(Object.entries(ORB_CHARS).map(([k, v]) => [v, k])) as Record<OrbType, string>;
  const out: string[] = [];
  for (let r = 0; r < board.rows; r++) {
    let line = '';
    for (let c = 0; c < board.cols; c++) {
      const o = board.cells[r * board.cols + c];
      line += o.enhanced ? charOf[o.type].toUpperCase() : charOf[o.type];
    }
    out.push(line);
  }
  return out;
}

function sourceIncludes(source: OrbSource, type: OrbType): boolean {
  if (source === 'all') return true;
  return Array.isArray(source) ? source.includes(type) : source === type;
}

// ---------- 隨機產生 ----------

/** 依天降設定抽一顆珠的種類 */
export function rollOrbType(rng: Rng, rates: SkyfallOptions['rates'] = {}): OrbType {
  const fixed = ORB_TYPES.filter((t) => rates[t] !== undefined);
  const fixedTotal = fixed.reduce((sum, t) => sum + Math.max(0, rates[t]!), 0);
  const free = ORB_TYPES.filter((t) => rates[t] === undefined);
  const remaining = Math.max(0, 1 - fixedTotal);
  const weights = ORB_TYPES.map((t) =>
    rates[t] !== undefined ? Math.max(0, rates[t]!) : free.length ? remaining / free.length : 0,
  );
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return rng.pick(ORB_TYPES);
  let roll = rng.next() * total;
  for (let i = 0; i < ORB_TYPES.length; i++) {
    roll -= weights[i];
    if (roll < 0) return ORB_TYPES[i];
  }
  return ORB_TYPES[ORB_TYPES.length - 1];
}

/** 放在 index 的 type 是否會與已經存在的珠組成 3 連 */
function wouldMatch(cells: (Orb | null)[], cols: number, rows: number, index: number, type: OrbType): boolean {
  const row = Math.floor(index / cols);
  const col = index % cols;
  const same = (r: number, c: number) =>
    r >= 0 && r < rows && c >= 0 && c < cols && cells[r * cols + c]?.type === type;
  const run = (dr: number, dc: number) => {
    let n = 0;
    for (let k = 1; same(row + dr * k, col + dc * k); k++) n++;
    return n;
  };
  return run(0, -1) + run(0, 1) + 1 >= MIN_MATCH || run(-1, 0) + run(1, 0) + 1 >= MIN_MATCH;
}

const NO_MATCH_ATTEMPTS = 20;

function rollNonMatching(
  rng: Rng,
  cells: (Orb | null)[],
  cols: number,
  rows: number,
  index: number,
  rates: SkyfallOptions['rates'],
): OrbType {
  let type = rollOrbType(rng, rates);
  for (let i = 0; i < NO_MATCH_ATTEMPTS && wouldMatch(cells, cols, rows, index, type); i++) {
    type = rollOrbType(rng, rates);
  }
  return type;
}

/** 依 config.board（或隊長技改過的盤面大小）建立一個開場不會自動消除的盤面 */
export function createBoard(size: BoardSize, rng: Rng, options: SkyfallOptions = {}): Board {
  const { cols, rows } = size;
  if (cols < MIN_MATCH || rows < MIN_MATCH) throw new Error(`盤面至少要 ${MIN_MATCH}×${MIN_MATCH}`);
  const cells: (Orb | null)[] = new Array(cols * rows).fill(null);
  for (let i = 0; i < cells.length; i++) {
    const type = rollNonMatching(rng, cells, cols, rows, i, options.rates);
    cells[i] = makeOrb(type, { enhanced: rng.next() < (options.enhancedChance ?? 0) });
  }
  return { cols, rows, cells: cells as Orb[] };
}

// ---------- 轉珠 ----------

export function swapOrbs(board: Board, a: Pos, b: Pos): Board {
  const next = cloneBoard(board);
  const ia = toIndex(board, a);
  const ib = toIndex(board, b);
  [next.cells[ia], next.cells[ib]] = [next.cells[ib], next.cells[ia]];
  return next;
}

export interface PathResult {
  board: Board;
  /** 實際走完的路徑（遇到封鎖珠或不合法的步會停在前一格） */
  path: Pos[];
  /** 路徑是否完整走完 */
  completed: boolean;
}

/**
 * 依拖曳路徑移動手上的珠：path[0] 是拿起的位置，之後每一步都與手上的珠交換。
 * 每一步必須八方向相鄰、在盤面內，且不能經過封鎖珠。
 */
export function applyPath(board: Board, path: Pos[]): PathResult {
  if (path.length === 0) return { board, path: [], completed: true };
  const start = path[0];
  if (!inBounds(board, start) || board.cells[toIndex(board, start)].locked) {
    return { board, path: [], completed: false };
  }
  let current = cloneBoard(board);
  const walked: Pos[] = [start];
  for (let i = 1; i < path.length; i++) {
    const from = walked[walked.length - 1];
    const to = path[i];
    if (!inBounds(current, to) || !isAdjacent(from, to) || current.cells[toIndex(current, to)].locked) {
      return { board: current, path: walked, completed: false };
    }
    const ia = toIndex(current, from);
    const ib = toIndex(current, to);
    [current.cells[ia], current.cells[ib]] = [current.cells[ib], current.cells[ia]];
    walked.push(to);
  }
  return { board: current, path: walked, completed: true };
}

// ---------- 消除判定 ----------

/**
 * 找出盤面上所有可消除的組：
 * 橫或直連續 3 顆以上同色的格子會被標記，再把上下左右相連的同色標記格合併成同一組（L、T、十字算 1 Combo）。
 */
export function findMatches(board: Board, cascade = 0, sealedOrbs: readonly OrbType[] = []): MatchGroup[] {
  const { cols, rows, cells } = board;
  const marked = new Array<boolean>(cells.length).fill(false);

  const scan = (outer: number, inner: number, idx: (o: number, i: number) => number) => {
    for (let o = 0; o < outer; o++) {
      let start = 0;
      for (let i = 1; i <= inner; i++) {
        if (i < inner && cells[idx(o, i)].type === cells[idx(o, start)].type) continue;
        if (i - start >= MIN_MATCH && !sealedOrbs.includes(cells[idx(o, start)].type)) {
          for (let k = start; k < i; k++) marked[idx(o, k)] = true;
        }
        start = i;
      }
    }
  };
  scan(rows, cols, (r, c) => r * cols + c);
  scan(cols, rows, (c, r) => r * cols + c);

  const visited = new Array<boolean>(cells.length).fill(false);
  const groups: MatchGroup[] = [];
  for (let i = 0; i < cells.length; i++) {
    if (!marked[i] || visited[i]) continue;
    const type = cells[i].type;
    const stack = [i];
    const groupCells: number[] = [];
    visited[i] = true;
    while (stack.length) {
      const cur = stack.pop()!;
      groupCells.push(cur);
      const r = Math.floor(cur / cols);
      const c = cur % cols;
      const neighbors = [
        r > 0 ? cur - cols : -1,
        r < rows - 1 ? cur + cols : -1,
        c > 0 ? cur - 1 : -1,
        c < cols - 1 ? cur + 1 : -1,
      ];
      for (const n of neighbors) {
        if (n >= 0 && marked[n] && !visited[n] && cells[n].type === type) {
          visited[n] = true;
          stack.push(n);
        }
      }
    }
    groupCells.sort((a, b) => a - b);
    groups.push({
      orb: type,
      cells: groupCells,
      enhancedCount: groupCells.filter((k) => cells[k].enhanced).length,
      poisonCount: groupCells.filter((k) => cells[k].poison).length,
      cascade,
    });
  }
  return groups;
}

// ---------- 落下與天降 ----------

/** 移除指定格子，上方的珠往下落，空位從上方補新珠 */
export function dropAndFill(board: Board, cleared: Iterable<number>, rng: Rng, options: SkyfallOptions = {}): Board {
  const { cols, rows } = board;
  const removed = new Set(cleared);
  const cells: (Orb | null)[] = new Array(cols * rows).fill(null);
  for (let c = 0; c < cols; c++) {
    let write = rows - 1;
    for (let r = rows - 1; r >= 0; r--) {
      const i = r * cols + c;
      if (!removed.has(i)) cells[write-- * cols + c] = { ...board.cells[i] };
    }
  }
  // 由下往上補，讓「天降不消除」時能看到下方已經存在的珠
  for (let r = rows - 1; r >= 0; r--) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      if (cells[i]) continue;
      const type =
        options.skyfallCombo === false
          ? rollNonMatching(rng, cells, cols, rows, i, options.rates)
          : rollOrbType(rng, options.rates);
      cells[i] = makeOrb(type, { enhanced: rng.next() < (options.enhancedChance ?? 0) });
    }
  }
  return { cols, rows, cells: cells as Orb[] };
}

/** 安全上限，避免設定錯誤時無限連鎖 */
const MAX_CASCADES = 50;

export interface ResolveOptions extends SkyfallOptions {
  /** 被封住、不能消除的珠種（敵人技能 lockedOrbs） */
  sealedOrbs?: OrbType[];
}

/** 轉珠結束後結算：反覆消除 → 落下 → 天降，直到盤面沒有可消除的組 */
export function resolveBoard(board: Board, rng: Rng, options: ResolveOptions = {}): ResolveResult {
  let current = board;
  const groups: MatchGroup[] = [];
  for (let cascade = 0; cascade < MAX_CASCADES; cascade++) {
    const found = findMatches(current, cascade, options.sealedOrbs);
    if (found.length === 0) break;
    groups.push(...found);
    current = dropAndFill(current, found.flatMap((g) => g.cells), rng, options);
  }
  return { board: current, groups, combo: groups.length };
}

// ---------- 主動技與敵人用的盤面操作 ----------

/** 珠子轉換（轉換後保留強化，清除干擾狀態） */
export function convertOrbs(board: Board, from: OrbSource, to: OrbType): Board {
  return {
    ...board,
    cells: board.cells.map((o) =>
      sourceIncludes(from, o.type) ? { ...o, type: to, poison: false, hidden: false } : { ...o },
    ),
  };
}

export function enhanceOrbs(board: Board, orbs: OrbSource): Board {
  return { ...board, cells: board.cells.map((o) => (sourceIncludes(orbs, o.type) ? { ...o, enhanced: true } : { ...o })) };
}

/** 盤面重整：整盤換成新的隨機珠（不會自動消除） */
export function refreshBoard(board: Board, rng: Rng, options: SkyfallOptions = {}): Board {
  return createBoard(board, rng, options);
}

/** 盤面平均：六種珠數量盡量相同，並盡量避免開場即消除 */
export function balanceBoard(board: Board, rng: Rng): Board {
  const total = board.cols * board.rows;
  const pool: OrbType[] = [];
  for (let i = 0; i < total; i++) pool.push(ORB_TYPES[i % ORB_TYPES.length]);
  const cells: (Orb | null)[] = new Array(total).fill(null);
  for (let i = 0; i < total; i++) {
    // 從剩餘的珠中找一顆不會造成 3 連的，找不到就隨便拿一顆
    const candidates = pool.map((_, k) => k).filter((k) => !wouldMatch(cells, board.cols, board.rows, i, pool[k]));
    const k = candidates.length ? rng.pick(candidates) : rng.int(pool.length);
    cells[i] = makeOrb(pool[k]);
    pool.splice(k, 1);
  }
  return { cols: board.cols, rows: board.rows, cells: cells as Orb[] };
}

export type Interference = 'locked' | 'poison' | 'hidden';

/** 敵人技能：隨機把 count 顆珠變成干擾珠（可限定顏色） */
export function applyInterference(
  board: Board,
  rng: Rng,
  kind: Interference,
  count: number,
  orbs: OrbSource = 'all',
): Board {
  const next = cloneBoard(board);
  const candidates = next.cells.map((o, i) => (sourceIncludes(orbs, o.type) && !o[kind] ? i : -1)).filter((i) => i >= 0);
  for (let n = 0; n < count && candidates.length; n++) {
    const [i] = candidates.splice(rng.int(candidates.length), 1);
    next.cells[i][kind] = true;
  }
  return next;
}

export function clearInterference(board: Board, kinds: Interference[] = ['locked', 'poison', 'hidden']): Board {
  return {
    ...board,
    cells: board.cells.map((o) => {
      const copy = { ...o };
      for (const k of kinds) copy[k] = false;
      return copy;
    }),
  };
}

export function countOrbs(board: Board): Record<OrbType, number> {
  const counts = Object.fromEntries(ORB_TYPES.map((t) => [t, 0])) as Record<OrbType, number>;
  for (const o of board.cells) counts[o.type]++;
  return counts;
}

/**
 * 補缺色：盤面上沒有出現的屬性（五屬，不含心）各補 count 顆。
 * 從目前數量最多的顏色挑珠子轉換，並且不會讓原本有的顏色被轉光；封鎖珠不會被轉換。
 */
export function fillMissingOrbs(board: Board, rng: Rng, count: number): Board {
  const next = cloneBoard(board);
  const counts = countOrbs(next);
  const missing = ATTRIBUTES.filter((a) => counts[a] === 0);
  for (const attr of missing) {
    for (let n = 0; n < count; n++) {
      // 從原本就有、數量最多且至少還剩 2 顆的顏色轉一顆過來
      const donors = ORB_TYPES.filter((t) => !(missing as readonly OrbType[]).includes(t) && counts[t] > 1).sort(
        (a, b) => counts[b] - counts[a],
      );
      const cells = donors.length
        ? next.cells.map((o, i) => (o.type === donors[0] && !o.locked ? i : -1)).filter((i) => i >= 0)
        : [];
      if (cells.length === 0) break;
      const i = rng.pick(cells);
      counts[next.cells[i].type]--;
      counts[attr]++;
      next.cells[i] = { ...next.cells[i], type: attr, poison: false, hidden: false };
    }
  }
  return next;
}
