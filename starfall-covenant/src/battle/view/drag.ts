// 拖曳轉珠的座標判定（純函式，方便測試）
import type { Board, Pos } from '../board';

/**
 * 指標位置對應的格子。只在指標靠近格子中心時才算進入（deadzone 為邊緣不感應的比例）。
 * 用於拿起珠子；拖曳中的換格改用 nextStep。
 */
export function cellAt(
  x: number, y: number, cellSize: number, size: Pick<Board, 'cols' | 'rows'>, deadzone = 0.18,
): Pos | null {
  const col = Math.floor(x / cellSize);
  const row = Math.floor(y / cellSize);
  if (col < 0 || row < 0 || col >= size.cols || row >= size.rows) return null;
  const fx = x / cellSize - col;
  const fy = y / cellSize - row;
  if (fx < deadzone || fx > 1 - deadzone || fy < deadzone || fy > 1 - deadzone) return null;
  return { row, col };
}

/** 越過格線多少（格為單位）才換格；換過去後要退回同樣距離才會換回來，避免在格線上抖動 */
export const ENTER = 0.15;
/** 主軸越過格線時，另一軸也越過這麼多就算斜轉（太小容易誤觸斜向，太大斜轉很難轉） */
export const DIAGONAL = 0.1;

/**
 * 手上的珠在 cur，指標在 (x, y)（設計座標）時下一步要換到哪一格；不用換則回傳 null。
 * 只會回傳相鄰（含斜向）的格子，所以呼叫端對每個取樣點反覆呼叫就能得到連續路徑。
 */
export function nextStep(
  cur: Pos, x: number, y: number, cellSize: number, size: Pick<Board, 'cols' | 'rows'>,
): Pos | null {
  const ox = x / cellSize - (cur.col + 0.5);
  const oy = y / cellSize - (cur.row + 0.5);
  const ax = Math.abs(ox) - 0.5;
  const ay = Math.abs(oy) - 0.5;
  const crossX = ax >= ENTER;
  const crossY = ay >= ENTER;
  if (!crossX && !crossY) return null;
  let dc = crossX || ax >= DIAGONAL ? Math.sign(ox) : 0;
  let dr = crossY || ay >= DIAGONAL ? Math.sign(oy) : 0;
  if (cur.col + dc < 0 || cur.col + dc >= size.cols) dc = 0;
  if (cur.row + dr < 0 || cur.row + dr >= size.rows) dr = 0;
  if (!dc && !dr) return null;
  return { row: cur.row + dr, col: cur.col + dc };
}

/**
 * 把兩個取樣點之間的線段切成間距不超過 maxGap 的點（不含起點、含終點）。
 * 手指快速滑動時事件很稀疏，逐點判定才不會漏格或亂走斜線。
 */
export function samplePoints(
  from: { x: number; y: number }, to: { x: number; y: number }, maxGap: number,
): { x: number; y: number }[] {
  const n = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / maxGap));
  const pts: { x: number; y: number }[] = [];
  for (let i = 1; i <= n; i++) pts.push({ x: from.x + ((to.x - from.x) * i) / n, y: from.y + ((to.y - from.y) * i) / n });
  return pts;
}

/** 轉珠倒數：第一次移動後才開始計時（GDD 2.1） */
export function remainingMs(startedAt: number | null, now: number, limitMs: number): number {
  if (startedAt === null) return limitMs;
  return Math.max(0, limitMs - (now - startedAt));
}
