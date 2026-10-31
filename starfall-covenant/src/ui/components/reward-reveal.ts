// 獎勵逐一跳出演出（關卡結算、登入、任務、星章等領獎共用）與玩家升級卡
// 項目順序與時間表在 ../reward-plan.ts（純邏輯），這裡只負責畫面、動畫與音效
import type { Reward, StageDef, StoryLine } from '../../core/types';
import { gameData } from '../../data/load';
import { h } from '../dom';
import { audio } from '../audio';
import {
  countDuration, countValue, firstClearPreview, revealSchedule, revealSfx, rewardItems, tickInterval, type LevelUpView, type RevealItem,
} from '../reward-plan';
import { badge, button, iconButton, panel, resourceIcon } from './basic';
import { cardThumb } from './card-thumb';
import { overlayRoot } from './overlay';
import { endOnRouteChange } from '../route-scope';
import { playBondStory } from '../bond-story';
import type { LeaderLine } from '../victory-line';
import '../reward-reveal.css';
import { LABEL } from '../wording';

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
        el: h('div', { class: ['rv-item rv-card', def && def.rarity >= 3 && 'rare', def && `r${def.rarity}`, item.tag && 'tagged'] },
          h('div', { class: 'rv-card-inner' },
            h('div', { class: 'rv-card-back' }),
            h('div', { class: 'rv-card-face' }, def ? cardThumb(def, { size: 56 }) : item.cardId)),
          item.count > 1 && h('span', { class: 'rv-card-count' }, `×${item.count}`),
          // 首通給的卡標上來源，避免跟隨機掉落混在一起看不出來
          item.tag && h('span', { class: 'rv-card-tag' }, item.tag),
          item.isNew && h('span', { class: 'rv-card-new' }, 'NEW'),
          h('span', { class: 'rv-card-name' }, def?.name ?? item.cardId)),
      };
    }
    case 'star':
      return {
        el: h('div', { class: ['rv-item rv-star', item.got && 'got'] },
          h('span', { class: 'rv-star-icon' }, '★'), h('span', null, item.text), item.isNew && badge('NEW', 'gold')),
      };
    case 'team': {
      const num = h('strong', { class: 'rv-num' }, '+0');
      const el = h('div', { class: 'rv-item rv-team' },
        h('div', { class: 'rv-count' }, h('span', { class: 'rv-icon' }, countIcon('exp')), h('span', { class: 'rv-label' }, '隊員經驗', h('em', { class: 'rv-tag' }, '各')), num),
        h('div', { class: 'rv-team-row' }, item.members.map((m) => {
          const def = cardById.get(m.cardId);
          const up = m.to > m.from;
          return h('div', { class: ['rv-member', up && 'up'] },
            def ? cardThumb(def, { size: 40 }) : m.cardId,
            h('span', { class: 'rv-member-lv' }, up ? `Lv.${m.from}→${m.to}` : `Lv.${m.to}`),
            up && h('span', { class: 'rv-member-up' }, 'LEVEL UP'));
        })));
      return { el, num };
    }
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

/** 在 host 裡逐一跳出項目；speed 為戰鬥速度倍率；instantCount 時數字直接顯示最終值（低特效） */
export function playReveal(host: HTMLElement, items: RevealItem[], speed = 1, instantCount = false): RevealHandle {
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
    if (item.kind === 'count' || item.kind === 'team') built[i].num!.textContent = `+${item.amount.toLocaleString()}`;
  };
  const show = (i: number) => {
    if (finished) return;
    const item = items[i];
    const b = built[i];
    b.el.classList.add('shown');
    const sfx = revealSfx(item);
    if (sfx) audio.play(sfx);
    if (item.kind === 'team' && item.members.some((m) => m.to > m.from)) {
      window.setTimeout(() => { if (!finished) audio.play('levelup'); }, (countDuration(item.amount) + 120) / Math.max(0.25, speed));
    }
    if (item.kind !== 'count' && item.kind !== 'team') return;
    const dur = instantCount ? 0 : countDuration(item.amount) / Math.max(0.25, speed);
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
    // 換畫面（例如返回手勢）時自動收掉，不蓋住下一頁；獎勵在演出前就已寫入存檔，這裡只關畫面
    const end = endOnRouteChange(() => {
      reveal.skip();
      layer.classList.add('closing');
      setTimeout(() => layer.remove(), 140);
      resolveClose();
    });
    void reveal.done.then(() => {
      if (!layer.isConnected || layer.classList.contains('closing')) return;
      actions.appendChild(button(opts.okLabel ?? LABEL.accept, {
        variant: 'primary', block: true, onClick: (e) => {
          e.stopPropagation();
          end();
        },
      }));
    });
  });
}

/** 結算的提示（新紀錄、章節開放、殘頁、情誼…）：收成一排小標籤，點了展開內容 */
export interface ResultNote {
  text: string;
  /** 重要提示（章節開放、頭像框）：標籤用金色 */
  big?: boolean;
  /** 收起時的小標籤（圖示＋短字，例如「📜 殘頁」）；沒給就用 text */
  chip?: string;
  /** 展開後「前往」的畫面（hash 路徑，例如 stories/lore、stages/2） */
  go?: string;
  /** 展開後「播放回憶」的對白 */
  play?: StoryLine[];
}

/** 結算提示的標籤列：點標籤展開內容與動作，再點一次收起 */
function noteChips(notes: ResultNote[], onGo?: (path: string) => void): HTMLElement {
  const detail = h('div', { class: 'result-note-detail', hidden: true });
  let open = -1;
  const chips = notes.map((n, i) => h('button', {
    type: 'button',
    class: ['result-note-chip', n.big && 'big'],
    'aria-expanded': 'false',
    onClick: (e: Event) => {
      e.stopPropagation();
      audio.play('tap');
      open = open === i ? -1 : i;
      chips.forEach((c, j) => c.setAttribute('aria-expanded', String(j === open)));
      detail.hidden = open < 0;
      if (open < 0) return;
      const action = n.play
        ? button('播放回憶', { small: true, variant: 'primary', onClick: (ev) => { ev.stopPropagation(); playBondStory(n.play!); } })
        : n.go && onGo ? button('前往', { small: true, variant: 'primary', onClick: (ev) => { ev.stopPropagation(); onGo(n.go!); } }) : null;
      detail.replaceChildren(h('p', null, n.text), ...(action ? [action] : []));
    },
  }, n.chip ?? n.text));
  return h('div', { class: 'result-notes' }, h('div', { class: 'result-note-chips' }, chips), detail);
}

export interface ClearResultOptions {
  stageName: string;
  items: RevealItem[];
  /** 戰鬥速度倍率 */
  speed?: number;
  /** 低特效：數字不滾動，直接顯示最終值 */
  instantCount?: boolean;
  /** 有升級時，項目播完後跳升級卡 */
  levelUp?: LevelUpView;
  /** 演出最後出現的提示（收成小標籤） */
  notes?: ResultNote[];
  /** 提示的「前往」：離開結算到該畫面（呼叫端負責先播通關劇情等） */
  onGo?: (path: string) => void;
  /** 項目播完後接著出現的圖（章節星座） */
  constellation?: HTMLElement | null;
  /** 有給時在按鈕上方放「契約回憶」分享鈕 */
  share?: () => void;
  /** 隊長勝利台詞，顯示在標題下方（victory-line.ts 的 leaderLineOf） */
  leaderLine?: LeaderLine;
  /** 底部按鈕，由呼叫端決定（再戰、返回、下一關…）；false／null 會略過 */
  actions: (HTMLElement | false | null | undefined)[];
}

/** 契約結算全螢幕層：標題落下 → 項目逐一跳出 → 升級卡 → 開放提示 → 按鈕。點畫面可快轉 */
export function openClearResult(host: HTMLElement, opts: ClearResultOptions): { close(): void } {
  const reveal = h('div', { class: 'result-reveal' });
  const notes = h('div', { class: 'result-notes-host' });
  const actions = h('div', { class: 'result-actions' });
  const hint = h('p', { class: 'rv-hint' }, '點擊畫面快轉');
  const layer = h('div', { class: 'result-layer', role: 'dialog', 'aria-label': '契約結算' },
    h('div', { class: 'rv-rays' }),
    h('div', { class: 'result-title' }, '契約結算'),
    h('div', { class: 'result-stage' }, opts.stageName),
    opts.leaderLine && h('div', { class: 'result-leader-line' },
      cardThumb(opts.leaderLine.card, { size: 44 }),
      h('div', null, h('div', { class: 'result-leader-name' }, opts.leaderLine.speaker ?? opts.leaderLine.card.name), h('p', null, `「${opts.leaderLine.text}」`))),
    notes, reveal, actions, hint);
  const close = () => {
    layer.classList.add('closing');
    setTimeout(() => layer.remove(), 140);
  };
  host.appendChild(layer);
  void (async () => {
    await new Promise((r) => setTimeout(r, 450));
    const play = playReveal(reveal, opts.items, opts.speed, opts.instantCount);
    layer.addEventListener('click', () => play.skip());
    await play.done;
    hint.remove();
    if (!layer.isConnected) return;
    if (opts.constellation) {
      reveal.appendChild(opts.constellation);
      await new Promise((r) => setTimeout(r, opts.instantCount ? 200 : 900));
    }
    if (opts.levelUp) await showLevelUp(opts.levelUp);
    if (!layer.isConnected) return;
    if (opts.notes?.length) {
      notes.appendChild(noteChips(opts.notes, opts.onGo));
      audio.play(opts.notes.some((n) => n.big) ? 'levelup' : 'star');
    }
    const share = opts.share && iconButton('constellation', '契約回憶', opts.share);
    if (share) share.classList.add('share-btn');
    // 按鈕列固定在底部（CSS sticky），不自動捲動，標題與提示留在畫面上
    actions.appendChild(h('div', { class: 'row' }, share, opts.actions.filter((b): b is HTMLElement => !!b)));
  })();
  return { close };
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
export function firstClearChip(reward: Reward | undefined, cleared: boolean, label = '首通'): HTMLElement | null {
  const p = firstClearPreview(reward, cleared, label);
  if (!p) return null;
  const title = p.claimed ? `${p.full}（已領取）` : `${label === '首通' ? '第一次通關' : label}可得　${p.full}`;
  if (p.claimed) return h('span', { class: 'first-clear-chip claimed', title }, p.text);
  // 星晶、代幣都用圖示＋數字（◆+1 ⚙+20），超過兩種才用「…」；循環活動顯示「本週首通」
  return h('span', { class: 'first-clear-chip', title, 'aria-label': p.full },
    h('span', { class: 'fc-label' }, label),
    p.parts.map((part) => h('span', { class: 'fc-part' }, part.icon === 'card' ? h('span', { class: 'fc-card' }, part.name ?? '卡') : resourceIcon(part.icon), `+${part.amount.toLocaleString()}`)),
    p.more && h('span', { class: 'fc-more' }, '…'));
}

/** 出戰確認頁的「關卡獎勵」區塊：首通獎勵（已領變灰）＋可能掉落的卡；循環活動顯示本週首通 */
export function stageRewardPanel(stage: StageDef, cleared: boolean): HTMLElement | null {
  const periodic = !stage.rewards.firstClear && !!stage.rewards.periodFirstClear;
  const label = periodic ? '本週首通獎勵' : '首通獎勵';
  const first = stage.rewards.firstClear ?? stage.rewards.periodFirstClear;
  const firstParts = first ? rewardItems(first) : [];
  if (!firstParts.length && !stage.drops.length) return null;
  return panel({ title: '關卡獎勵' },
    firstParts.length > 0 && h('div', { class: ['stage-first-clear', cleared && 'claimed'] },
      h('span', { class: 'small-text' }, cleared ? `${label}（已領取）` : label),
      h('div', { class: 'row wrap' }, firstParts.map((p) => p.kind === 'count'
        ? h('span', { class: 'reward-chip' }, p.icon !== 'exp' && resourceIcon(p.icon), `${p.label} ×${p.amount.toLocaleString()}`)
        : p.kind === 'card' && cardById.get(p.cardId) ? cardThumb(cardById.get(p.cardId)!, { size: 36 }) : null))),
    stage.drops.length > 0 && h('div', { class: 'stage-drops' },
      h('span', { class: 'small-text' }, '機率掉落'),
      h('div', { class: 'row wrap' }, stage.drops.map((d) => {
        const def = cardById.get(d.card);
        return def && h('div', { class: 'stage-drop' }, cardThumb(def, { size: 40 }), h('span', null, `${Math.round(d.rate * 100)}%`));
      }))));
}
