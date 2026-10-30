// 拖曳轉珠的座標判定（純函式，方便測試）
import type { Board, Pos } from '../board';

/**
 * 指標位置對應的格子。只在指標靠近格子中心時才算進入（deadzone 為邊緣不感應的比例），
 * 避免沿著格線拖曳時在兩格之間來回跳、或擦過角落誤觸斜向。
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

/** 把手指一下跳過好幾格的移動拆成一步一格（八方向），讓路徑一定連續 */
export function stepsBetween(from: Pos, to: Pos): Pos[] {
  const steps: Pos[] = [];
  let { row, col } = from;
  while (row !== to.row || col !== to.col) {
    row += Math.sign(to.row - row);
    col += Math.sign(to.col - col);
    steps.push({ row, col });
  }
  return steps;
}

/** 轉珠倒數：第一次移動後才開始計時（GDD 2.1） */
export function remainingMs(startedAt: number | null, now: number, limitMs: number): number {
  if (startedAt === null) return limitMs;
  return Math.max(0, limitMs - (now - startedAt));
}
