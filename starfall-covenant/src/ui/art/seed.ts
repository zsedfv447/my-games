import { createRng, type Rng } from '../../core/rng';

/** 字串轉種子（FNV-1a），讓同一張卡、同一隻敵人每次產生的圖都一樣 */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function rngFor(key: string): Rng {
  return createRng(hashString(key));
}

/** 嵌入 SVG 文字前跳脫 */
export function escapeXml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[ch]!);
}
