// 章節星座圖：星章點亮成星座（章節頁、結算、分享圖共用同一個版面）
import type { ChapterDef } from '../../core/types';
import { gameData } from '../../data/load';
import { chapterStarMask, chapterStarSlots, constellationLayout, constellationSvg, freshStars, plannedStarCount, type ConstellationLayout } from '../art/constellation';
import { audio } from '../audio';
import { h, svg } from '../dom';
import { getSave } from '../state';
import constellationsJson from '../../../data/constellations.json';
import '../constellation.css';

/** 本次遊玩中，每章上次畫出來時點亮了哪些星（只為了播放「新點亮」動畫，不存檔） */
const lastShown = new Map<number, boolean[]>();

type ConstellationData = { chapter: number; width: number; height: number; stars: number[][]; edges: number[][] };

/** 星座座標以 data/constellations.json 為準；星數對不上（例如新增關卡）時改用產生器 */
export function chapterLayout(chapter: number): { layout: ConstellationLayout; slots: ReturnType<typeof chapterStarSlots> } {
  const slots = chapterStarSlots(gameData.stages, chapter);
  // 分批上線的章節：星座依預定星數畫完整，還沒上線的關卡對應的星保持暗的
  const count = plannedStarCount(gameData.chapters.find((c) => c.chapter === chapter)?.stageCount, slots.length);
  const d = (constellationsJson as ConstellationData[]).find((c) => c.chapter === chapter);
  const layout: ConstellationLayout = d && d.stars.length === count
    ? { width: d.width, height: d.height, stars: d.stars.map(([x, y, r]) => ({ x, y, r })), edges: d.edges.map(([a, b]) => [a, b] as [number, number]) }
    : constellationLayout(String(chapter), count);
  return { layout, slots };
}

/** 章節頁的星座：跟上次看到時相比新點亮的星會依序點亮；claimable 時整個星座脈動提示領獎 */
export function chapterConstellation(info: ChapterDef, opts: { claimable?: boolean } = {}): HTMLElement {
  const { layout, slots } = chapterLayout(info.chapter);
  const lit = chapterStarMask(slots, getSave().progress.stars);
  const fresh = freshStars(lastShown.get(info.chapter), lit);
  lastShown.set(info.chapter, lit);
  const n = fresh.filter(Boolean).length;
  if (n) window.setTimeout(() => audio.play('star'), 300);
  // 章節頁標題旁已有星座名徽章，圖上不再重複標示（結算與分享圖沒有標題，仍保留圖上的名字）
  return h('div', { class: ['constellation-box', opts.claimable && 'claimable'] }, svg(constellationSvg(layout, lit, { fresh })));
}

/** 結算用的小星座：只點亮這一關這次新拿到的星章，並記為已看過（回到章節頁不重播） */
export function clearConstellation(info: ChapterDef, stageId: string, newStars: boolean[]): HTMLElement | null {
  const { layout, slots } = chapterLayout(info.chapter);
  if (!slots.length) return null;
  const lit = chapterStarMask(slots, getSave().progress.stars);
  const fresh = slots.map((s, i) => lit[i] && s.stageId === stageId && !!newStars[s.index]);
  lastShown.set(info.chapter, lit);
  return h('div', { class: 'constellation-box result-constellation' }, svg(constellationSvg(layout, lit, { fresh, name: info.constellation })));
}
