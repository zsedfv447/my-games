// 龍形卡夾：依素材來源 SKSealCard.sks 的圖層與座標組裝，使用原始 PNG 與卡背。
// 抽卡在進入此頁前已結算；下拉、取消、跳過與揭曉只播放同一份結果。
import { h } from '../dom';
import type { Rarity } from '../../core/types';
import { pullCost, type PullResult } from '../../progression/gacha';
import { badge, button, stars } from '../components/basic';
import { cardPortrait } from '../components/card-thumb';
import { userAsset } from '../assets';
import { audio } from '../audio';
import { openDialog, type DialogHandle } from '../components/overlay';
import { getSave, growth } from '../state';
import type { ScreenDef } from '../router';
import { setPending, startPull, takePending, type PendingSummon } from './summon';
import '../summon.css';

/** 原320座標最大360／放手容許310；此處採640像素素材基準。 */
export const PULL_DISTANCE = 720;
export const RELEASE_DISTANCE = 620;
export function releasePull(distance: number, cancelled: boolean): boolean {
  return !cancelled && distance >= RELEASE_DISTANCE;
}

/** 每30設計像素嘎一聲；最多約每70ms一次，避免單幀補播大量重疊音效。 */
export function createPullSoundSteps() {
  let lastDistance = 0;
  let lastTime = -Infinity;
  return {
    advance(distance: number, now: number): boolean {
      if (distance - lastDistance < 30 || now - lastTime < 70) return false;
      lastDistance = distance;
      lastTime = now;
      return true;
    },
    reset() { lastDistance = 0; lastTime = -Infinity; },
  };
}

// 保留原公開純函式介面；機關不再繪製原創魔法圈／SVG龍。
const HINT_RGB: Record<number, [number, number, number]> = { 3: [150, 200, 255], 4: [242, 196, 90], 5: [199, 146, 255] };
export function sealColor(top: Rarity, p: number, t: number): string {
  const k = Math.min(1, Math.max(0, p)) ** 1.6;
  if (top >= 6) return `hsl(${Math.round((t * 0.15) % 360)} 100% ${Math.round(100 - 38 * k)}%)`;
  const [r, g, b] = HINT_RGB[Math.max(3, top)];
  const mix = (c: number) => Math.round(255 + (c - 255) * k);
  return `rgb(${mix(r)} ${mix(g)} ${mix(b)})`;
}

function image(name: string, className: string, alt = ''): HTMLImageElement {
  return h('img', { class: className, src: userAsset('ui', `summon-${name}`), alt, draggable: 'false' });
}
function cardBack(rarity: Rarity): string {
  return rarity >= 7 ? 'black' : rarity >= 6 ? 'platinum' : rarity === 5 ? 'gold' : rarity === 4 ? 'silver' : 'bronze';
}
type Phase = 'seal' | 'burst' | 'reveal' | 'done';

class Ritual {
  readonly el: HTMLElement;
  private phase: Phase = 'seal';
  private distance = 0;
  private scale = 390 / 640;
  private dragging = false;
  private startY = 0;
  private pointerId?: number;
  private timers: number[] = [];
  private animations: Animation[] = [];
  private resizeRaf = 0;
  private destroyed = false;
  private soundSteps = createPullSoundSteps();
  private machine: HTMLElement;
  private card: HTMLElement;
  private cardTarget: HTMLImageElement;
  private results = h('div', { class: 'ritual-results' });
  private actions = h('div', { class: 'ritual-actions' });
  private showcaseEl?: HTMLElement;

  constructor(private p: PendingSummon, private exit: { again(): void; done(): void }) {
    const top = Math.max(...p.results.map((r) => r.rarity)) as Rarity;
    this.cardTarget = image(`card-${cardBack(top)}`, 'clamp-card-target');
    this.card = h('div', { class: 'dragon-clamp-card', role: 'button', tabindex: '0', 'aria-label': '按住卡片往下拉，鬆手解除封印' },
      image('card-bronze', 'clamp-card-source'), this.cardTarget,
      p.count > 1 && h('span', { class: 'ritual-count' }, `×${p.count}`));
    // .sks 同z依children順序：背景、01、02、卡背、07/09/08、05/06、03/04。
    this.machine = h('div', { class: 'dragon-clamp-stage', 'aria-label': '龍形卡夾' },
      image('gate-back', 'clamp-base'),
      image('clamp-rim-left', 'clamp-rim-left'), image('clamp-rim-right', 'clamp-rim-right'),
      this.card,
      image('clamp-inner-07', 'clamp-inner clamp-inner-07'), image('clamp-inner-09', 'clamp-inner clamp-inner-09'), image('clamp-inner-08', 'clamp-inner clamp-inner-08'),
      image('clamp-left', 'clamp-side clamp-side-left'), image('clamp-right', 'clamp-side clamp-side-right'),
      h('div', { class: 'clamp-eyes', 'aria-hidden': 'true' }, image('clamp-eye-a', 'clamp-eye-a'), image('clamp-eye-b', 'clamp-eye-b')));
    this.el = h('div', { class: 'ritual real-clamp', dataset: { phase: 'seal', top: String(top) } },
      this.machine,
      h('div', { class: 'clamp-pull-hint' }, h('strong', null, '往下拉'), h('span', null, '按住卡片往下拉，鬆手解除封印')),
      this.results, this.actions,
      button('跳過', { variant: 'ghost', small: true, onClick: () => this.skip() }));
    this.el.lastElementChild!.classList.add('ritual-skip');
    this.el.addEventListener('pointerdown', this.onDown);
    this.el.addEventListener('pointermove', this.onMove);
    this.el.addEventListener('pointerup', this.onUp);
    this.el.addEventListener('pointercancel', this.onUp);
    this.card.addEventListener('keydown', (e) => { if (this.phase === 'seal' && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); this.release(); } });
    window.addEventListener('resize', this.resize);
    this.resize();
    this.resizeRaf = requestAnimationFrame(() => this.resize());
  }

  destroy(): void {
    this.destroyed = true;
    this.clearTimers();
    this.animations.forEach((a) => a.cancel());
    cancelAnimationFrame(this.resizeRaf);
    window.removeEventListener('resize', this.resize);
    this.el.removeEventListener('pointerdown', this.onDown);
    this.el.removeEventListener('pointermove', this.onMove);
    this.el.removeEventListener('pointerup', this.onUp);
    this.el.removeEventListener('pointercancel', this.onUp);
    if (this.pointerId !== undefined && this.el.hasPointerCapture?.(this.pointerId)) this.el.releasePointerCapture(this.pointerId);
  }
  private resize = (): void => {
    this.scale = (this.el.clientWidth || 390) / 640;
    this.el.style.setProperty('--clamp-scale', String(this.scale));
  };
  private clearTimers(): void { this.timers.forEach(clearTimeout); this.timers = []; }
  private later(ms: number, fn: () => void): void {
    this.timers.push(window.setTimeout(() => { if (!this.destroyed) fn(); }, ms));
  }
  private setPhase(phase: Phase): void { this.phase = phase; this.el.dataset.phase = phase; }
  private designY(clientY: number): number {
    const rect = this.el.getBoundingClientRect();
    // 舞台本身也可能整體縮放；指標座標必須除以實際顯示寬度的比例。
    return (clientY - rect.top) / ((rect.width || 390) / 640);
  }
  private onDown = (e: PointerEvent): void => {
    if (this.phase !== 'seal' || this.dragging || !((e.target as Element).closest('.dragon-clamp-card')) || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.preventDefault();
    this.dragging = true;
    this.pointerId = e.pointerId;
    this.startY = this.designY(e.clientY);
    this.soundSteps.reset();
    this.card.classList.remove('returning');
    this.el.classList.add('clamp-touched');
    this.el.setPointerCapture?.(e.pointerId);
  };
  private onMove = (e: PointerEvent): void => {
    if (this.phase !== 'seal' || !this.dragging || e.pointerId !== this.pointerId) return;
    e.preventDefault();
    this.setPull(this.designY(e.clientY) - this.startY);
    if (this.soundSteps.advance(this.distance, performance.now())) audio.play('summon-pull');
  };
  private onUp = (e: PointerEvent): void => {
    if (!this.dragging || e.pointerId !== this.pointerId) return;
    this.dragging = false;
    if (this.el.hasPointerCapture?.(e.pointerId)) this.el.releasePointerCapture(e.pointerId);
    this.pointerId = undefined;
    if (this.phase !== 'seal') return;
    if (releasePull(this.distance, e.type === 'pointercancel')) this.release();
    else {
      this.card.classList.add('returning');
      this.setPull(0);
      this.soundSteps.reset();
    }
  };
  private setPull(distance: number): void {
    this.distance = Math.max(0, Math.min(PULL_DISTANCE, distance));
    this.card.style.setProperty('--pull', `${this.distance}px`);
    this.card.style.setProperty('--card-progress', String(this.distance / PULL_DISTANCE));
  }
  private release(): void {
    if (this.phase !== 'seal') return;
    this.dragging = false;
    this.setPhase('burst');
    audio.play('summon-release');
    this.machine.classList.add('clamp-released');
    this.card.classList.remove('returning');
    this.card.classList.add('clamp-moving-out');
    // 原控制器：0.2秒下移出畫、停0.1秒、0.5秒回中央放大1.2，再以原光圖發光2秒。
    const height = this.el.clientHeight || 844;
    this.card.style.setProperty('--pull', `${height / this.scale + 540}px`);
    this.later(300, () => {
      this.card.className = 'clamp-extracted-card';
      this.card.style.removeProperty('--pull');
      this.card.style.setProperty('--card-progress', '1');
      this.el.append(this.card);
      const animation = this.card.animate([
        { transform: `translate(-50%, calc(-50% + ${height}px)) scale(1)` },
        { transform: 'translate(-50%, -50%) scale(1.2)' },
      ], { duration: 500, easing: 'ease-in', fill: 'both' });
      this.animations.push(animation);
      this.later(500, () => {
        for (let i = 0; i < 5; i++) {
          const halo = image('halo', 'clamp-card-glow');
          halo.style.animationDelay = `${i * 400}ms`;
          this.card.append(halo);
        }
        this.later(2000, () => this.reveal(false));
      });
    });
  }
  private reveal(instant: boolean): void {
    if (this.phase === 'done' || this.phase === 'reveal') return;
    this.clearTimers();
    this.card.remove();
    this.setPhase('reveal');
    const single = this.p.results.length === 1;
    const cards = this.p.results.map((r) => ({ r, el: this.flipCard(r, single) }));
    this.results.replaceChildren();
    if (single) {
      const r = this.p.results[0];
      this.results.append(cards[0].el,
        h('div', { class: 'ritual-info' }, stars(r.rarity), h('div', { class: 'ritual-name' }, growth.card(r.cardId)?.name ?? r.cardId)));
    } else this.results.append(h('div', { class: 'ritual-grid' }, cards.map((c) => c.el)));
    cards.forEach(({ r, el }, i) => {
      if (instant) el.classList.add('flipped');
      else this.later(300 + i * 140, () => { el.classList.add('flipped'); if (r.rarity >= 5) audio.play('skill'); });
    });
    if (instant) this.finish();
    else this.later(800 + (cards.length - 1) * 140, () => this.finish());
  }
  private flipCard(r: PullResult, big: boolean): HTMLElement {
    const def = growth.card(r.cardId);
    const card = button(h('div', { class: 'flip-inner' },
      h('div', { class: 'flip-face back' }, image(`card-${cardBack(r.rarity)}`, 'clamp-result-back')),
      h('div', { class: 'flip-face front' }, def ? cardPortrait(def) : null)),
    { sound: false, onClick: () => { if (card.classList.contains('flipped') && !this.showcaseEl) this.showcase(r); } });
    card.className = `flip-card r-${r.rarity}${big ? ' big' : ''}`;
    card.setAttribute('aria-label', def?.name ?? r.cardId);
    // 角落標籤：第一次擁有標 NEW，其餘標已持有
    card.append(r.isNew ? badge('NEW', 'gold new') : badge('已持有', 'new owned'));
    return card;
  }
  private finish(): void {
    if (this.phase === 'done') return;
    this.setPhase('done');
    const cost = pullCost(this.p.pool, this.p.count);
    this.actions.replaceChildren(
      button(this.p.count === 10 ? '再十連' : '再抽一次', { cost: { kind: 'gem', amount: cost }, disabled: getSave().player.gems < cost, onClick: () => this.exit.again() }),
      button('完成', { variant: 'primary', onClick: () => this.exit.done() }));
  }
  private showcase(r: PullResult): void {
    const def = growth.card(r.cardId);
    if (!def) return;
    const close = () => { this.showcaseEl?.remove(); this.showcaseEl = undefined; };
    this.showcaseEl = h('div', { class: `ritual-showcase r-${r.rarity}`, onClick: close },
      cardPortrait(def), h('div', { class: 'ritual-info' }, stars(r.rarity), h('div', { class: 'ritual-name' }, def.name), r.isNew ? badge('NEW', 'gold') : badge('已持有', 'owned')),
      h('div', { class: 'small-text dim ritual-tap' }, '點一下繼續'));
    this.el.append(this.showcaseEl);
  }
  private skip(): void {
    if (this.destroyed || this.phase === 'done') return;
    this.clearTimers();
    this.animations.forEach((a) => a.cancel());
    if (this.phase === 'reveal') {
      this.results.querySelectorAll('.flip-card').forEach((card) => card.classList.add('flipped'));
      this.finish();
    } else this.reveal(true);
  }
}

export const summonRitualScreen: ScreenDef = {
  name: 'summon-ritual', title: '封印召喚', chrome: 'bare', parent: 'summon',
  render({ nav, onLeave }) {
    audio.stopBgm();
    const p = takePending();
    if (!p) {
      const redirect = setTimeout(() => nav.replace('summon'));
      onLeave(() => clearTimeout(redirect));
      return h('div');
    }
    let left = false;
    let confirming = false;
    let dialog: DialogHandle | undefined;
    const cancel = () => { confirming = false; dialog?.close(); dialog = undefined; };
    const ritual = new Ritual(p, {
      again: () => {
        if (left || confirming) return;
        confirming = true;
        const confirm = button('開啟封印', { variant: 'primary', onClick: () => {
          if (left || confirm.disabled) return;
          confirm.disabled = true;
          const next = startPull(p.pool, p.count);
          cancel();
          if (!next) return;
          left = true;
          setPending(next);
          nav.replace('summon-ritual');
        } });
        dialog = openDialog('再次召喚', h('p', null, `消耗 ${pullCost(p.pool, p.count)} 星晶，從「${p.pool.name}」召喚 ${p.count} 張卡片。`),
          [button('取消', { variant: 'ghost', sound: 'back', onClick: cancel }), confirm], { dismissible: false });
      },
      done: () => { if (!left) { left = true; nav.back(); } },
    });
    onLeave(() => { left = true; dialog?.close(); ritual.destroy(); });
    return ritual.el;
  },
};
