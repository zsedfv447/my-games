// 教學引導層：引路人立繪＋對話框、手指提示、目標外框。整層不擋點擊，只有對話框本身可以按。
import './tutorial.css';
import { h } from '../dom';
import { userAsset } from '../assets';
import { audio } from '../audio';
import { button } from '../components/basic';

export const GUIDE_NAME = '引星者・薇菈';

export interface BubbleAction {
  label: string;
  variant?: 'primary' | 'ghost';
  onClick: () => void;
}

export interface BubbleOptions {
  lines: string[];
  /** top：放在畫面上方（戰鬥時不擋盤面）；bottom：放在底部導覽上方 */
  placement?: 'top' | 'bottom';
  /** 最後一句顯示後才出現的按鈕；沒有按鈕時對話框只是提示 */
  actions?: BubbleAction[];
  onSkip?: () => void;
  /** 換到第 i 句時呼叫（例如換手指要指的東西） */
  onLine?: (i: number) => void;
}

export interface Bubble {
  el: HTMLElement;
  close(): void;
}

/** 舞台被 transform 縮放；把視窗座標換回舞台座標 */
function toLocal(layer: HTMLElement, rect: DOMRect): { x: number; y: number; w: number; h: number } {
  const base = layer.getBoundingClientRect();
  const scale = layer.offsetWidth ? base.width / layer.offsetWidth : 1;
  return { x: (rect.left - base.left) / scale, y: (rect.top - base.top) / scale, w: rect.width / scale, h: rect.height / scale };
}

export class GuideLayer {
  readonly el: HTMLElement;
  private bubble?: Bubble;
  private pointers: (() => void)[] = [];

  /** extraClass：tut-app 代表掛在整個舞台（有頂列），對話框放上方時要避開頂列 */
  constructor(host: HTMLElement, extraClass?: string) {
    this.el = h('div', { class: ['tut-layer', extraClass], 'aria-live': 'polite' });
    host.appendChild(this.el);
  }

  say(opts: BubbleOptions): Bubble {
    this.bubble?.close();
    const { lines, placement = 'bottom', actions = [], onSkip, onLine } = opts;
    let i = 0;
    const portrait = userAsset('cards', 'c401');
    const text = h('p', { class: 'tut-text' });
    const more = h('span', { class: 'tut-more', 'aria-hidden': 'true' }, '▼');
    const actionRow = h('div', { class: 'tut-actions' });
    const box = h('section', { class: ['tut-bubble', `tut-${placement}`], role: 'dialog', 'aria-label': GUIDE_NAME },
      portrait && h('img', { class: 'tut-portrait', src: portrait, alt: GUIDE_NAME, draggable: 'false' }),
      h('div', { class: 'tut-box' },
        h('div', { class: 'tut-name' }, h('span', null, GUIDE_NAME),
          onSkip && h('button', { type: 'button', class: 'tut-skip', onClick: (e: Event) => { e.stopPropagation(); onSkip(); } }, '略過教學')),
        text, more, actionRow));
    const show = () => {
      text.textContent = lines[i] ?? '';
      const last = i >= lines.length - 1;
      more.hidden = last;
      box.classList.toggle('has-more', !last);
      actionRow.replaceChildren(...(last ? actions.map((a) => button(a.label, { small: true, variant: a.variant ?? 'primary', onClick: a.onClick })) : []));
      onLine?.(i);
    };
    box.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('button')) return;
      if (i < lines.length - 1) {
        i += 1;
        audio.play('tap');
        show();
      }
    });
    show();
    this.el.appendChild(box);
    const bubble: Bubble = { el: box, close: () => { box.remove(); if (this.bubble === bubble) this.bubble = undefined; } };
    this.bubble = bubble;
    return bubble;
  }

  /** 手指點著目標，目標加上發光外框。target 每次重新查找，畫面重繪後也能跟上 */
  pointAt(target: () => Element | null | undefined): void {
    const finger = this.finger('tut-tap');
    let focused: Element | null = null;
    const place = () => {
      const el = target();
      if (el !== focused) {
        focused?.classList.remove('tut-focus');
        el?.classList.add('tut-focus');
        focused = el ?? null;
      }
      finger.hidden = !el;
      if (!el) return;
      const r = toLocal(this.el, el.getBoundingClientRect());
      finger.style.left = `${r.x + r.w / 2}px`;
      finger.style.top = `${r.y + r.h / 2}px`;
    };
    place();
    const timer = window.setInterval(place, 250);
    this.pointers.push(() => {
      clearInterval(timer);
      focused?.classList.remove('tut-focus');
      finger.remove();
    });
  }

  /** 手指沿著盤面上的路徑重複移動；canvas 是盤面，cols/rows 用來換算格子中心 */
  trace(canvas: () => HTMLElement | null, cols: number, rows: number, path: { row: number; col: number }[]): void {
    const finger = this.finger('tut-trace');
    const ring = h('div', { class: 'tut-ring' });
    this.el.appendChild(ring);
    const place = () => {
      const c = canvas();
      if (!c) return;
      const r = toLocal(this.el, c.getBoundingClientRect());
      const cell = (p: { row: number; col: number }) => ({ x: r.x + ((p.col + 0.5) * r.w) / cols, y: r.y + ((p.row + 0.5) * r.h) / rows });
      const from = cell(path[0]);
      const to = cell(path[path.length - 1]);
      ring.style.left = `${from.x}px`;
      ring.style.top = `${from.y}px`;
      ring.style.width = ring.style.height = `${r.w / cols}px`;
      finger.style.setProperty('--x0', `${from.x}px`);
      finger.style.setProperty('--y0', `${from.y}px`);
      finger.style.setProperty('--x1', `${to.x}px`);
      finger.style.setProperty('--y1', `${to.y}px`);
    };
    place();
    const timer = window.setInterval(place, 250);
    this.pointers.push(() => {
      clearInterval(timer);
      finger.remove();
      ring.remove();
    });
  }

  private finger(cls: string): HTMLElement {
    const url = userAsset('ui', 'tutorial-finger');
    const el = h('div', { class: ['tut-finger', cls, !url && 'no-art'] }, url && h('img', { src: url, alt: '', draggable: 'false' }));
    this.el.appendChild(el);
    return el;
  }

  clearPointers(): void {
    this.pointers.splice(0).forEach((fn) => fn());
  }

  clear(): void {
    this.clearPointers();
    this.bubble?.close();
  }

  destroy(): void {
    this.clear();
    this.el.remove();
  }
}
