// 程式產生的星座圖：每章一個星座，每顆星章是一顆星；以章節為種子，每次畫出來都一樣
import type { StageDef } from '../../core/types';
import { escapeXml, rngFor } from './seed';

export interface ConstellationStar {
  x: number;
  y: number;
  /** 星的大小 */
  r: number;
}

export interface ConstellationLayout {
  width: number;
  height: number;
  stars: ConstellationStar[];
  /** 連線（星的索引），構成一棵樹：每顆星都連得到 */
  edges: [number, number][];
}

const MARGIN = 12;

/** 星的位置：在畫面內隨機撒點並保持間距，再由左到右排序（前面的關卡在左邊） */
export function constellationLayout(key: string, count: number, width = 320, height = 150): ConstellationLayout {
  const rng = rngFor(`constellation:${key}`);
  const pts: ConstellationStar[] = [];
  let minDist = Math.sqrt(((width - MARGIN * 2) * (height - MARGIN * 2)) / Math.max(1, count)) * 0.75;
  let tries = 0;
  while (pts.length < count) {
    const x = MARGIN + rng.next() * (width - MARGIN * 2);
    const y = MARGIN + rng.next() * (height - MARGIN * 2);
    if (pts.every((p) => Math.hypot(p.x - x, p.y - y) >= minDist)) {
      pts.push({ x: round(x), y: round(y), r: round(1.6 + rng.next() * 1.6) });
      tries = 0;
    } else if (++tries > 200) {
      // 擠不下時放寬間距，保證一定撒得完
      minDist *= 0.85;
      tries = 0;
    }
  }
  pts.sort((a, b) => a.x - b.x);
  return { width, height, stars: pts, edges: spanningTree(pts) };
}

const round = (n: number) => Math.round(n * 10) / 10;

/** 最小生成樹（Prim）：用最短的線把所有星連起來，看起來像星座 */
function spanningTree(pts: ConstellationStar[]): [number, number][] {
  if (pts.length < 2) return [];
  const inTree = new Set([0]);
  const edges: [number, number][] = [];
  while (inTree.size < pts.length) {
    let best: [number, number] | null = null;
    let bestD = Infinity;
    for (const i of inTree) {
      for (let j = 0; j < pts.length; j++) {
        if (inTree.has(j)) continue;
        const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
        if (d < bestD) { bestD = d; best = [i, j]; }
      }
    }
    edges.push(best!);
    inTree.add(best![1]);
  }
  return edges;
}

/** 一章的星章依關卡順序攤平：第 1 關的 3 顆、第 2 關的 3 顆…；回傳每顆星對應的關卡與序號 */
export function chapterStarSlots(stages: StageDef[], chapter: number): { stageId: string; index: number }[] {
  return stages
    .filter((s) => s.kind === 'main' && s.chapter === chapter)
    .flatMap((s) => (s.stars ?? []).map((_, index) => ({ stageId: s.id, index })));
}

/** 每顆星是否已點亮 */
export function chapterStarMask(slots: { stageId: string; index: number }[], got: Record<string, boolean[]>): boolean[] {
  return slots.map((s) => !!got[s.stageId]?.[s.index]);
}

/** 這次新點亮的星：現在亮、之前沒亮（沒有之前的紀錄時都不算新的） */
export function freshStars(before: boolean[] | undefined, now: boolean[]): boolean[] {
  return now.map((lit, i) => lit && !!before && !before[i]);
}

export interface ConstellationOptions {
  /** 這次新點亮的星，播點亮動畫 */
  fresh?: boolean[];
  /** 星座名，畫在右下角 */
  name?: string;
}

/** 星座 SVG：沒點亮的是暗點與虛線，點亮的星發光、兩端都亮的連線發光；全部點亮時加 complete */
export function constellationSvg(layout: ConstellationLayout, lit: boolean[], opts: ConstellationOptions = {}): string {
  const { width, height, stars, edges } = layout;
  const fresh = opts.fresh ?? [];
  const complete = stars.length > 0 && stars.every((_, i) => lit[i]);
  // 新點亮的星依序點亮，連線等兩端都點亮後才亮
  const order = new Map<number, number>();
  fresh.forEach((f, i) => { if (f) order.set(i, order.size); });
  const delay = (i: number) => (order.has(i) ? ` style="--d:${order.get(i)! * 160}ms"` : '');
  const lines = edges.map(([a, b]) => {
    const on = lit[a] && lit[b];
    const isFresh = on && (order.has(a) || order.has(b));
    const d = isFresh ? ` style="--d:${Math.max(order.get(a) ?? 0, order.get(b) ?? 0) * 160 + 200}ms"` : '';
    return `<line class="cst-edge${on ? ' lit' : ''}${isFresh ? ' fresh' : ''}"${d} x1="${stars[a].x}" y1="${stars[a].y}" x2="${stars[b].x}" y2="${stars[b].y}"/>`;
  }).join('');
  const dots = stars.map((s, i) => lit[i]
    ? `<g class="cst-star lit${order.has(i) ? ' fresh' : ''}"${delay(i)}><circle class="cst-glow" cx="${s.x}" cy="${s.y}" r="${round(s.r * 3.2)}"/><circle class="cst-core" cx="${s.x}" cy="${s.y}" r="${s.r}"/></g>`
    : `<circle class="cst-star dim" cx="${s.x}" cy="${s.y}" r="${round(s.r * 0.6)}"/>`).join('');
  const name = opts.name ? `<text class="cst-name" x="${width - 6}" y="${height - 6}" text-anchor="end">${escapeXml(opts.name)}</text>` : '';
  return `<svg class="constellation${complete ? ' complete' : ''}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(opts.name ?? '星座')}：${lit.filter(Boolean).length}/${stars.length}">${lines}${dots}${name}</svg>`;
}
