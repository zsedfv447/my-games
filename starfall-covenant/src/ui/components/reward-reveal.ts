// 獎勵逐一跳出演出（關卡結算、登入、任務、星章等領獎共用）與玩家升級卡
// 項目順序與時間表在 ../reward-plan.ts（純邏輯），這裡只負責畫面、動畫與音效
import type { Reward } from '../../core/types';
import { gameData } from '../../data/load';
import { h } from '../dom';
import { audio } from '../audio';
import {
  countDuration, countValue, firstClearPreview, revealSchedule, revealSfx, rewardItems, tickInterval, type LevelUpView, type RevealItem,
} from '../reward-plan';
import { badge, button, resourceIcon } from './basic';
import { cardThumb } from './card-thumb';
import { overlayRoot } from './overlay';
import '../reward-reveal.css';

const cardById = new Map(gameData.cards.map((c) => [c.id, c]));

export interface RevealHandle {
  /** 全部項目都出現、數字滾完時完成 */
  done: Promise<void>;
  /** 快轉：直接顯示全部 */
  skip(): void;
}

interface Built {
  el: HTMLElement;
  /** 數字滾動目標（count 類） */
  num?: HTMLElement;
}

function countIcon(icon: Extract<RevealItem, { kind: 'count' }>['icon']): Node {
  return icon === 'exp' ? h('span', { class: 'rv-exp' }, 'EXP') : resourceIcon(icon);
}

function build(item: RevealItem): Built {
  switch (item.kind) {
    case 'stat':
      return { el: h('div', { class: 'rv-item rv-stat' }, h('span', null, item.label), h('strong', null, item.value)) };
    case 'count': {
      const num = h('strong', { class: 'rv-num' }, '+0');
      const el = h('div', { class: ['rv-item rv-count', item.special && 'special'] },
        h('span', { class: 'rv-icon' }, countIcon(item.icon)),
        h('span', { class: 'rv-label' }, item.label, item.tag && h('em', { class: 'rv-tag' }, item.tag)),
        num);
      return { el, num };
    }
    case 'card': {
      const def = cardById.get(item.cardId);
      return {
        el: h('div', { class: ['rv-item rv-card', def && def.rarity >= 3 && 'rare', def && `r${def.rarity}`] },
          h('div', { class: 'rv-card-inner' },
            h('div', { class: 'rv-card-back' }),
            h('div', { class: 'rv-card-face' }, def ? cardThumb(def, { size: 56 }) : item.cardId)),
          item.count > 1 && h('span', { class: 'rv-card-count' }, `×${item.count}`)),
      };
    }
    case 'star':
      return {
        el: h('div', { class: ['rv-item rv-star', item.got && 'got'] },
          h('span', { class: 'rv-star-icon' }, '★'), h('span', null, item.text), item.isNew && badge('NEW', 'gold')),
      };
  }
}

/** 把項目排進 host：數量列在上、卡片排一列、星章在最下面 */
function layout(host: HTMLElement, items: RevealItem[]): Built[] {
  const rows = h('div', { class: 'rv-rows' });
  const cards = h('div', { class: 'rv-cards' });
  const stars = h('div', { class: 'rv-stars' });
  const built = items.map((item) => {
    const b = build(item);
    (item.kind === 'card' ? cards : item.kind === 'star' ? stars : rows).appendChild(b.el);
    return b;
  });
  host.append(rows);
  if (cards.childElementCount) host.append(cards);
  if (stars.childElementCount) host.append(stars);
  return built;
}

/** 在 host 裡逐一跳出項目；speed 為戰鬥速度倍率 */
export function playReveal(host: HTMLElement, items: RevealItem[], speed = 1): RevealHandle {
  const built = layout(host, items);
  const { starts, total } = revealSchedule(items, speed);
  const timers: number[] = [];
  const frames = new Set<number>();
  let finished = false;
  let resolve!: () => void;
  const done = new Promise<void>((r) => { resolve = r; });

  const finalize = (i: number) => {
    const item = items[i];
    built[i].el.classList.add('shown');
    if (item.kind === 'count') built[i].num!.textContent = `+${item.amount.toLocaleString()}`;
  };
  const show = (i: number) => {
    if (finished) return;
    const item = items[i];
    const b = built[i];
    b.el.classList.add('shown');
    const sfx = revealSfx(item);
    if (sfx) audio.play(sfx);
    if (item.kind !== 'count') return;
    const dur = countDuration(item.amount) / Math.max(0.25, speed);
    if (dur <= 0) return finalize(i);
    const t0 = performance.now();
    const every = tickInterval(dur);
    let lastTick = -Infinity;
    const step = (now: number) => {
      if (finished) return;
      const t = (now - t0) / dur;
      b.num!.textContent = `+${countValue(item.amount, t).toLocaleString()}`;
      if (now - lastTick >= every && t < 1) { audio.play('count'); lastTick = now; }
      if (t < 1) frames.add(requestAnimationFrame(step));
      else b.num!.classList.add('settled');
    };
    frames.add(requestAnimationFrame(step));
  };
  const finish = () => {
    if (finished) return;
    finished = true;
    timers.forEach(clearTimeout);
    frames.forEach(cancelAnimationFrame);
    items.forEach((_, i) => finalize(i));
    host.classList.add('rv-done');
    resolve();
  };

  starts.forEach((at, i) => timers.push(window.setTimeout(() => show(i), at)));
  // 最後一個數字滾完再收尾
  timers.push(window.setTimeout(finish, total + 120));
  return { done, skip: finish };
}

/** 全螢幕領獎層：標題 → 逐一跳出 → 「收下」。點畫面可快轉 */
export function openRewardReveal(title: string, items: RevealItem[], opts: { sub?: string; okLabel?: string; host?: HTMLElement } = {}): Promise<void> {
  return new Promise((resolveClose) => {
    const list = h('div', { class: 'rv-list' });
    const actions = h('div', { class: 'rv-actions' });
    const panel = h('section', { class: 'panel gold rv-panel' },
      h('h2', { class: 'rv-title' }, title),
      opts.sub && h('p', { class: 'small-text dim rv-sub' }, opts.sub),
      list, actions);
    const layer = h('div', { class: 'overlay rv-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': title }, h('div', { class: 'rv-rays' }), panel);
    (opts.host ?? overlayRoot()).appendChild(layer);
    audio.play('reward');
    const reveal = playReveal(list, items);
    layer.addEventListener('click', () => reveal.skip());
    void reveal.done.then(() => {
      actions.appendChild(button(opts.okLabel ?? '收下', {
        variant: 'primary', block: true, onClick: (e) => {
          e.stopPropagation();
          layer.classList.add('closing');
          setTimeout(() => layer.remove(), 140);
          resolveClose();
        },
      }));
    });
  });
}

/** 一份 Reward 的領獎演出（登入、任務、星章、圖鑑） */
export function revealReward(title: string, reward: Reward, sub?: string): Promise<void> {
  return openRewardReveal(title, rewardItems(reward), { sub });
}

/** 前後數值一列：體力上限 50 → 54 */
function upRow(label: string, [from, to]: [number, number]): HTMLElement {
  return h('div', { class: 'lv-row' }, h('span', null, label), h('span', { class: 'lv-from' }, `${from}`), h('span', { class: 'lv-arrow' }, '→'), h('strong', null, `${to}`));
}

/** 「契印師等級提升」卡；關閉時完成 */
export function showLevelUp(view: LevelUpView, host?: HTMLElement): Promise<void> {
  return new Promise((resolveClose) => {
    const to = h('strong', { class: 'lv-to' }, `${view.from}`);
    const card = h('section', { class: 'panel gold lv-card' },
      h('div', { class: 'lv-head' }, '契印師等級提升'),
      h('div', { class: 'lv-level' }, h('span', null, 'Lv.'), to),
      h('div', { class: 'lv-rows' },
        upRow('體力上限', view.stamina),
        upRow('隊伍空間', view.cost),
        view.gems > 0 && h('div', { class: 'lv-row' }, h('span', null, '獲得星晶'), h('span', { class: 'rv-icon' }, resourceIcon('gem')), h('strong', null, `×${view.gems}`))),
      h('p', { class: 'small-text dim' }, '體力已補滿'));
    const layer = h('div', { class: 'overlay rv-overlay lv-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': '等級提升' }, h('div', { class: 'rv-rays' }), card);
    (host ?? overlayRoot()).appendChild(layer);
    audio.play('levelup');
    // 等級數字翻到新等級
    const flip = window.setTimeout(() => { to.textContent = `${view.to}`; to.classList.add('flipped'); }, 420);
    let closable = false;
    window.setTimeout(() => { closable = true; card.appendChild(h('p', { class: 'rv-hint' }, '點擊繼續')); }, 900);
    layer.addEventListener('click', () => {
      if (!closable) return;
      clearTimeout(flip);
      layer.classList.add('closing');
      setTimeout(() => layer.remove(), 140);
      resolveClose();
    });
  });
}

/** 關卡列表上的首通獎勵預告（未通關亮、已領取變灰） */
export function firstClearChip(reward: Reward | undefined, cleared: boolean): HTMLElement | null {
  const p = firstClearPreview(reward, cleared);
  if (!p) return null;
  return h('span', { class: ['first-clear-chip', p.claimed && 'claimed'], title: p.claimed ? '首通獎勵已領取' : '第一次通關可得' },
    p.icon !== 'card' && resourceIcon(p.icon), p.text);
}
