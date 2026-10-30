// 戰鬥中看得到的掉落（提案 13）：帶掉落的敵人頭上有星骸寶箱，倒下時寶箱飛到角落的計數器；內容到結算才翻開。
import { dropsOn, type DropPlan } from '../../progression/drops';
import { h, svg } from '../dom';
import { getSettings } from '../state';
import { flashClass, fly } from './effects';

/** 原創的星骸寶箱圖示：深色木箱＋金邊，鎖扣是一顆發光的星屑 */
const CHEST_SVG = `<svg viewBox="0 0 32 32" aria-hidden="true">
  <path d="M4 14h24v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" fill="#5b3a22" stroke="#e8c46a" stroke-width="1.6"/>
  <path d="M4 14c0-5 5-9 12-9s12 4 12 9z" fill="#7a4e2c" stroke="#e8c46a" stroke-width="1.6"/>
  <path d="M4 14h24" stroke="#e8c46a" stroke-width="2.4"/>
  <path d="M10 6.5v22M22 6.5v22" stroke="#b88a3a" stroke-width="1.2" opacity=".7"/>
  <path d="M16 11.5l1.6 3.2 3.4.4-2.5 2.3.7 3.4-3.2-1.8-3.2 1.8.7-3.4-2.5-2.3 3.4-.4z" fill="#bff2ff" stroke="#6fd6ff" stroke-width=".8"/>
</svg>`;

export const chestIcon = (): SVGSVGElement => svg(CHEST_SVG);

/** 敵人頭上的寶箱標記；沒帶掉落就回傳 null */
export function chestBadge(plan: DropPlan | undefined, wave: number, enemy: number): HTMLElement | null {
  const n = dropsOn(plan, wave, enemy).length;
  if (!n) return null;
  return h('div', { class: 'enemy-chest', 'aria-label': `帶有 ${n} 份掉落` }, chestIcon(), n > 1 && h('span', null, `×${n}`));
}

/** 角落的寶箱計數器 */
export class DropCounter {
  readonly element: HTMLElement;
  private countEl = h('span', { class: 'drop-count' }, '0');
  private got = 0;
  /** 已經收過的敵人（`${wave}-${enemy}`），續戰或重畫時不會重複算 */
  private collected = new Set<string>();

  constructor(private plan: DropPlan | undefined) {
    this.element = h('div', { class: 'drop-counter', 'aria-label': '已取得的寶箱', title: '已取得的寶箱，結算時打開' }, chestIcon(), this.countEl);
    this.element.hidden = !plan;
  }

  /** 敵人倒下：有掉落就讓寶箱從敵人身上飛到計數器 */
  async collect(root: HTMLElement, wave: number, enemy: number, from: HTMLElement | undefined, speed: number): Promise<void> {
    const key = `${wave}-${enemy}`;
    const n = dropsOn(this.plan, wave, enemy).length;
    if (!n || this.collected.has(key)) return;
    this.collected.add(key);
    const badge = from?.querySelector<HTMLElement>('.enemy-chest');
    // 星屑光點從寶箱飛向計數器
    if (badge && getSettings().battleFx && !getSettings().lowFx) await fly(root, badge, this.element, 'light', 420 / speed);
    badge?.remove();
    this.got += n;
    this.countEl.textContent = `${this.got}`;
    flashClass(this.element, 'bump', 400);
  }
}
