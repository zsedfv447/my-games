// 主動技的盤面積木（提案 65，補雙屬與長串）：twoColorBoard、rowToOrb。純邏輯，只回傳新盤面。
import type { OrbType } from '../../core/types';
import { cloneBoard, countOrbs, type Board } from '../board';

/**
 * 雙色盤：心珠與 keep 指定的顏色保留，其餘每顆珠轉成 colors 兩色之一。
 * 依盤面順序把每顆要轉的珠分給目前數量較少的那一色（平手給第一色），兩色數量最多差 1，結果固定、不用亂數。
 */
export function twoColorBoard(board: Board, colors: [OrbType, OrbType], keep: OrbType[] = ['heart']): Board {
  const counts = countOrbs(board);
  let a = counts[colors[0]];
  let b = counts[colors[1]];
  const kept = new Set<OrbType>([...keep, ...colors]);
  return {
    ...board,
    cells: board.cells.map((o) => {
      if (kept.has(o.type)) return { ...o };
      const to = a <= b ? colors[0] : colors[1];
      if (to === colors[0]) a++;
      else b++;
      return { ...o, type: to, poison: false, hidden: false };
    }),
  };
}

/** 整排轉色：row 從 0（最上排）起算，負數從最下排倒數（−1＝最下排）；超出範圍時盤面不變 */
export function rowToOrb(board: Board, row: number, to: OrbType): Board {
  const r = row < 0 ? board.rows + row : row;
  if (r < 0 || r >= board.rows) return cloneBoard(board);
  return {
    ...board,
    cells: board.cells.map((o, i) => (Math.floor(i / board.cols) === r ? { ...o, type: to, poison: false, hidden: false } : { ...o })),
  };
}
