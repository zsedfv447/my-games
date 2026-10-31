// 戰鬥演出共用的小工具：震動、閃一下的 class、屬性光點、傷害數字、主動技立繪
import type { CardDef } from '../../core/types';
import type { Matchup } from '../../battle/feedback';
import { h, type Child } from '../dom';
import { cardPortraitUrl, cardThumb } from '../components/card-thumb';
import { getSettings } from '../state';

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** 震動回饋（設定可關；不支援的裝置直接略過） */
export function buzz(ms: number): void {
  if (getSettings().vibration) navigator.vibrate?.(ms);
}

/** 重播一次 CSS 動畫 class，ms 後移除 */
const flashTimers = new WeakMap<HTMLElement, Map<string, number>>();

/**
 * 重播一次 CSS 動畫 class，ms 後移除。
 * 不讀 offsetWidth 強制重排（低階手機上每次命中都會卡）：class 還在時先拿掉，下一幀再加回去重播。
 */
export function flashClass(el: HTMLElement, cls: string, ms: number): void {
  const timers = flashTimers.get(el) ?? new Map<string, number>();
  flashTimers.set(el, timers);
  clearTimeout(timers.get(cls));
  const arm = () => {
    el.classList.add(cls);
    timers.set(cls, window.setTimeout(() => el.classList.remove(cls), ms));
  };
  if (el.classList.contains(cls)) {
    el.classList.remove(cls);
    requestAnimationFrame(arm);
  } else {
    arm();
  }
}

/** 飄字（和 battle.ts 的 floatText 同一套樣式） */
export function floatLabel(host: HTMLElement, content: Child, cls: string, ms = 900): void {
  const el = h('div', { class: `float-num ${cls}` }, content);
  host.appendChild(el);
  setTimeout(() => el.remove(), ms);
}

/** 敵人身上的傷害數字：屬性色，剋制加「弱點！」，被剋灰色小字；負數是被傷害吸收轉成回復 */
export function damageText(host: HTMLElement, damage: number, attribute: string | undefined, mu: Matchup): void {
  const text = damage < 0 ? `+${(-damage).toLocaleString()}` : damage.toLocaleString();
  floatLabel(host, [
    mu === 'advantage' && h('span', { class: 'weak-tag' }, '弱點！'),
    text,
    mu === 'disadvantage' && h('span', { class: 'resist-tag' }, '效果不佳'),
  ], `dmg attr-${attribute ?? 'none'} ${mu}`);
}

export interface Point { x: number; y: number }

/**
 * 一次量好多個元素的中心點（root 的設計座標，已扣掉舞台的 CSS 縮放）。
 * 光點動畫一連發好幾顆時先整批量好，之後只寫不讀，避免每顆都強制重排（低階手機上會卡成長任務）。
 */
export function measureCenters(root: HTMLElement, els: readonly (Element | null | undefined)[]): Map<Element, Point> {
  const box = root.getBoundingClientRect();
  const scale = box.width / (root.offsetWidth || box.width || 1) || 1;
  const out = new Map<Element, Point>();
  for (const el of els) {
    if (!el || out.has(el)) continue;
    const r = el.getBoundingClientRect();
    out.set(el, { x: (r.left + r.width / 2 - box.left) / scale, y: (r.top + r.height / 2 - box.top) / scale });
  }
  return out;
}

/** 屬性光點從 from 飛到 to（畫面有 CSS 縮放，位移要換回 root 的設計座標） */
export function fly(root: HTMLElement, from: HTMLElement, to: HTMLElement, attribute: string | undefined, ms: number): Promise<void> {
  const c = measureCenters(root, [from, to]);
  return flyBetween(root, c.get(from)!, c.get(to)!, attribute, ms);
}

/** 用量好的點發射光點（不讀版面） */
export function flyBetween(root: HTMLElement, p0: Point, p1: Point, attribute: string | undefined, ms: number): Promise<void> {
  const { x: x0, y: y0 } = p0;
  const { x: x1, y: y1 } = p1;
  const orb = h('div', { class: `strike-orb attr-${attribute ?? 'none'}` });
  root.appendChild(orb);
  if (!orb.animate) {
    orb.remove();
    return Promise.resolve();
  }
  const anim = orb.animate([
    { transform: `translate(${x0}px, ${y0}px) scale(0.6)`, opacity: 0.4 },
    { transform: `translate(${(x0 + x1) / 2}px, ${Math.min(y0, y1) - 30}px) scale(1.1)`, opacity: 1, offset: 0.5 },
    { transform: `translate(${x1}px, ${y1}px) scale(0.8)`, opacity: 1 },
  ], { duration: ms, easing: 'ease-in' });
  return anim.finished.then(() => orb.remove(), () => orb.remove());
}

/** 主動技演出：角色立繪從側邊滑入＋技能名稱橫幅（約 0.6 秒） */
export async function skillCutin(root: HTMLElement, card: CardDef, skillName: string, speed: number): Promise<void> {
  const url = cardPortraitUrl(card);
  const layer = h('div', { class: `skill-cutin attr-${card.attribute}` },
    h('div', { class: 'cutin-art' }, url ? h('img', { src: url, alt: '' }) : cardThumb(card, { size: 120 })),
    h('div', { class: 'cutin-name' }, h('small', null, card.name), skillName));
  root.appendChild(layer);
  await wait(650 / speed);
  layer.classList.add('leaving');
  setTimeout(() => layer.remove(), 200);
}
