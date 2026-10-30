// 召喚演出：按住星印裡的卡片往下拉，把卡從星龍守護的封印裡抽出來。拉得越遠裂痕越深、光的顏色越接近這次的
// 最高稀有度（白→金→紫→虹），沒拉到底就放手會彈回去；拉到底時星龍雙眼一閃、封印碎裂、光柱落下、翻開卡片，
// 5★ 以上會再單獨展示一次。結果在進入畫面前就已存檔，跳過或關掉都不會少卡。
import { h, svg } from '../dom';
import type { Rarity } from '../../core/types';
import { pullCost, type PullResult } from '../../progression/gacha';
import { cardBackSvg, sealSvg, starDragonSvg } from '../art/sigil';
import { badge, button, stars } from '../components/basic';
import { cardPortrait } from '../components/card-thumb';
import { audio } from '../audio';
import { getSave, growth } from '../state';
import type { ScreenDef } from '../router';
import { setPending, startPull, takePending, type PendingSummon } from './summon';

/** 要往下拉多遠才會把卡抽出來（設計座標 px） */
export const PULL_DISTANCE = 240;

/** 星印最後會變成的顏色（6★ 是彩虹，另外處理） */
const HINT_RGB: Record<number, [number, number, number]> = {
  3: [150, 200, 255],
  4: [242, 196, 90],
  5: [199, 146, 255],
};

/** 解封進度 p（0–1）時的顏色：一開始是白光，越後面越透露稀有度 */
export function sealColor(top: Rarity, p: number, t: number): string {
  const k = Math.min(1, Math.max(0, p)) ** 1.6;
  if (top >= 6) return `hsl(${Math.round((t * 0.15) % 360)} 100% ${Math.round(100 - 38 * k)}%)`;
  const [r, g, b] = HINT_RGB[Math.max(3, top)];
  const mix = (c: number) => Math.round(255 + (c - 255) * k);
  return `rgb(${mix(r)} ${mix(g)} ${mix(b)})`;
}

interface Particle { x: number; y: number; vx: number; vy: number; age: number; life: number; size: number; color: string }
interface Ring { x: number; y: number; age: number; color: string }

/** 畫在整個畫面上的光軌、火花與衝擊波 */
class Fx {
  color = '#fff';
  private trail: { x: number; y: number; t: number }[] = [];
  private parts: Particle[] = [];
  private rings: Ring[] = [];
  private ctx: CanvasRenderingContext2D;
  private raf = 0;
  private lastT = 0;

  constructor(private canvas: HTMLCanvasElement, private onFrame: (t: number) => void) {
    this.ctx = canvas.getContext('2d')!;
  }

  start(): void {
    const frame = (t: number) => {
      this.draw(t);
      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
  }

  addTrail(x: number, y: number): void {
    this.trail.push({ x, y, t: performance.now() });
    for (let i = 0; i < 2; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 0.02 + Math.random() * 0.08;
      this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, age: 0, life: 300 + Math.random() * 400, size: 1 + Math.random() * 2, color: this.color });
    }
  }

  burst(x: number, y: number, count: number, speed = 0.5, ring = true): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.2 + Math.random());
      this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, age: 0, life: 600 + Math.random() * 900, size: 1.5 + Math.random() * 3.5, color: Math.random() < 0.3 ? '#fff' : this.color });
    }
    if (ring) this.rings.push({ x, y, age: 0, color: this.color });
  }

  private draw(t: number): void {
    const dt = Math.min(50, this.lastT ? t - this.lastT : 16);
    this.lastT = t;
    this.onFrame(t);
    const { canvas, ctx } = this;
    const rect = canvas.getBoundingClientRect();
    const cssW = canvas.offsetWidth;
    const cssH = canvas.offsetHeight;
    if (!cssW || !cssH) return;
    const k = (rect.width / cssW) * (window.devicePixelRatio || 1);
    const w = Math.round(cssW * k);
    const hh = Math.round(cssH * k);
    if (canvas.width !== w || canvas.height !== hh) {
      canvas.width = w;
      canvas.height = hh;
    }
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    ctx.globalCompositeOperation = 'lighter';

    // 光軌：最近 320ms 的點，越舊越細越淡
    const now = performance.now();
    this.trail = this.trail.filter((p) => now - p.t < 320);
    ctx.lineCap = 'round';
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 18;
    for (let i = 1; i < this.trail.length; i++) {
      const a = this.trail[i - 1];
      const b = this.trail[i];
      const life = 1 - (now - b.t) / 320;
      ctx.globalAlpha = life;
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 2 + 12 * life;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1 + 4 * life;
      ctx.stroke();
    }

    ctx.shadowBlur = 10;
    this.parts = this.parts.filter((p) => (p.age += dt) < p.life);
    for (const p of this.parts) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.985;
      p.vy = p.vy * 0.985 + 0.00012 * dt;
      ctx.globalAlpha = 1 - p.age / p.life;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (1 - (p.age / p.life) * 0.5), 0, Math.PI * 2);
      ctx.fill();
    }

    this.rings = this.rings.filter((r) => (r.age += dt) < 800);
    for (const r of this.rings) {
      ctx.globalAlpha = 1 - r.age / 800;
      ctx.strokeStyle = r.color;
      ctx.shadowColor = r.color;
      ctx.lineWidth = 6 * (1 - r.age / 800) + 1;
      ctx.beginPath();
      ctx.arc(r.x, r.y, 30 + r.age * 0.7, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }
}

type Phase = 'seal' | 'burst' | 'reveal' | 'done';

class Ritual {
  readonly el: HTMLElement;
  private phase: Phase = 'seal';
  private progress = 0;
  private top: Rarity;
  private last?: { x: number; y: number };
  private startY = 0;
  private timers: number[] = [];
  private fx: Fx;
  private gate: HTMLElement;
  private card: HTMLElement;
  private dragon = h('div', { class: 'ritual-dragon' }, svg(starDragonSvg()));
  private cracks: SVGGElement;
  private results = h('div', { class: 'ritual-results' });
  private actions = h('div', { class: 'ritual-actions' });
  private cards: { el: HTMLElement; r: PullResult }[] = [];
  private showQueue: PullResult[] = [];
  private showcaseEl?: HTMLElement;

  constructor(private p: PendingSummon, private exit: { again(): void; done(): void }) {
    this.top = Math.max(...p.results.map((r) => r.rarity)) as Rarity;
    const canvas = h('canvas', { class: 'ritual-fx' });
    this.fx = new Fx(canvas, (t) => this.tint(t));
    const seal = svg(sealSvg('ritual-seal'));
    this.cracks = seal.querySelector('.seal-cracks')!;
    this.card = h('div', { class: 'ritual-gate-card' }, svg(cardBackSvg()), p.count > 1 && h('span', { class: 'ritual-count' }, `×${p.count}`));
    this.gate = h('div', { class: 'ritual-gate' }, seal, this.card);
    this.el = h(
      'div',
      { class: ['ritual', this.top >= 6 && 'rainbow'], dataset: { phase: 'seal', top: String(this.top) } },
      h('div', { class: 'ritual-pillar' }),
      this.dragon,
      this.gate,
      h('div', { class: 'ritual-guide' }),
      h('div', { class: 'ritual-hint' }, h('strong', null, '往下拉'), h('span', null, '按住星卡往下拉，把它從封印中抽出來')),
      h('div', { class: 'ritual-flash' }),
      this.results,
      this.actions,
      canvas,
      h('button', { type: 'button', class: 'btn small ghost ritual-skip', onClick: () => this.skip() }, '跳過'),
    );
    this.el.addEventListener('pointerdown', this.onDown);
    this.el.addEventListener('pointermove', this.onMove);
    this.el.addEventListener('pointerup', this.onUp);
    this.el.addEventListener('pointercancel', this.onUp);
    this.fx.start();
  }

  destroy(): void {
    this.fx.stop();
    this.timers.forEach((t) => clearTimeout(t));
  }

  private later(ms: number, fn: () => void): void {
    this.timers.push(window.setTimeout(fn, ms));
  }

  private setPhase(phase: Phase): void {
    this.phase = phase;
    this.el.dataset.phase = phase;
  }

  /** 螢幕座標換成畫面內座標（舞台有縮放） */
  private local(e: { clientX: number; clientY: number }): { x: number; y: number } {
    const r = this.el.getBoundingClientRect();
    const k = r.width / (this.el.offsetWidth || r.width);
    return { x: (e.clientX - r.left) / k, y: (e.clientY - r.top) / k };
  }

  private centerOf(el: Element): { x: number; y: number } {
    const r = el.getBoundingClientRect();
    return this.local({ clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 });
  }

  private tint(t: number): void {
    const color = this.phase === 'seal' ? sealColor(this.top, this.progress, t) : sealColor(this.top, 1, t);
    this.fx.color = color;
    this.el.style.setProperty('--seal-color', color);
  }

  private onDown = (e: PointerEvent): void => {
    if (this.phase !== 'seal' || (e.target as HTMLElement).closest('button')) return;
    this.el.setPointerCapture?.(e.pointerId);
    this.last = this.local(e);
    this.startY = this.last.y;
    this.fx.addTrail(this.last.x, this.last.y);
    this.el.classList.add('touched');
    this.card.classList.remove('returning');
  };

  private onMove = (e: PointerEvent): void => {
    if (this.phase !== 'seal' || !this.last) return;
    const pt = this.local(e);
    if (Math.hypot(pt.x - this.last.x, pt.y - this.last.y) < 2) return;
    this.last = pt;
    this.fx.addTrail(pt.x, pt.y);
    this.setPull(Math.max(0, pt.y - this.startY) / PULL_DISTANCE);
    if (this.progress >= 1) this.breakSeal();
  };

  /** 沒拉到底就放手：卡片彈回封印 */
  private onUp = (): void => {
    if (!this.last) return;
    this.last = undefined;
    if (this.phase !== 'seal') return;
    this.card.classList.add('returning');
    this.setPull(0);
  };

  private setPull(p: number): void {
    this.progress = Math.min(1, p);
    // 卡片跟手指之間有一點阻力，越往下越拉不動
    this.card.style.setProperty('--pull', `${(this.progress * PULL_DISTANCE * 0.8).toFixed(1)}px`);
    this.gate.style.setProperty('--p', this.progress.toFixed(3));
    this.el.style.setProperty('--p', this.progress.toFixed(3));
    this.cracks.style.strokeDashoffset = String(1 - this.progress);
    this.gate.classList.toggle('trembling', this.progress > 0.55);
  }

  private breakSeal(): void {
    this.last = undefined;
    this.progress = 1;
    this.setPhase('burst');
    audio.play('summon');
    navigator.vibrate?.(this.top >= 5 ? [40, 60, 90] : 40);
    const c = this.centerOf(this.card);
    this.fx.burst(c.x, c.y, 80 + this.top * 25, 0.35 + this.top * 0.05);
    this.later(250, () => this.fx.burst(c.x, c.y, 40, 0.25));
    this.later(this.top >= 5 ? 1100 : 800, () => this.reveal(false));
  }

  private reveal(instant: boolean): void {
    this.setPhase('reveal');
    const single = this.p.results.length === 1;
    this.cards = this.p.results.map((r, i) => ({ r, el: this.flipCard(r, single, i) }));
    if (single) {
      const { r, el } = this.cards[0];
      const def = growth.card(r.cardId);
      if (r.rarity >= 4) this.results.append(h('div', { class: `ritual-rays r-${r.rarity}` }));
      this.results.append(
        el,
        h('div', { class: 'ritual-info' }, stars(r.rarity), h('div', { class: 'ritual-name' }, def?.name ?? r.cardId)),
      );
    } else {
      this.results.append(h('div', { class: 'ritual-grid' }, this.cards.map((c) => c.el)));
    }
    if (instant) {
      this.cards.forEach((c) => this.flip(c.el, c.r, true));
      return this.finish();
    }
    // 十連：十張卡先從星龍嘴裡一張張噴出來，飛到定位後再依序翻牌；5★ 以上先蓄光、停頓一下再翻
    let at = single ? 350 : this.spew() + 250;
    for (const c of this.cards) {
      if (c.r.rarity >= 5) {
        this.later(at, () => c.el.classList.add('charging'));
        at += 550;
      }
      this.later(at, () => this.flip(c.el, c.r, false));
      at += single ? 0 : 170;
    }
    this.later(at + 600, () => this.finish());
  }

  /** 卡片從星龍嘴裡噴出、飛到格子上；回傳全部落定的時間（ms） */
  private spew(): number {
    const d = this.dragon.getBoundingClientRect();
    const mouth = this.local({ clientX: d.left + d.width / 2, clientY: d.top + d.height * 0.86 });
    const gap = 110;
    const dur = 620;
    this.cards.forEach(({ el }, i) => {
      const c = this.centerOf(el);
      const spin = (Math.random() - 0.5) * 540;
      const delay = i * gap;
      el.animate(
        [
          { transform: `translate(${mouth.x - c.x}px, ${mouth.y - c.y}px) scale(0.15) rotate(${spin}deg)`, opacity: 0 },
          { opacity: 1, offset: 0.12 },
          { transform: `translate(${(mouth.x - c.x) * 0.35}px, ${(mouth.y - c.y) * 0.6 - 40}px) scale(0.8) rotate(${spin * 0.3}deg)`, offset: 0.55 },
          { transform: 'none', opacity: 1 },
        ],
        { duration: dur, delay, easing: 'cubic-bezier(0.25, 0.8, 0.35, 1.1)', fill: 'backwards' },
      );
      this.later(delay, () => {
        this.fx.burst(mouth.x, mouth.y, 14, 0.22, false);
        audio.play('tap');
      });
    });
    this.dragon.classList.add('spewing');
    return (this.cards.length - 1) * gap + dur;
  }

  private flipCard(r: PullResult, big: boolean, i: number): HTMLElement {
    const def = growth.card(r.cardId);
    const el = h(
      'button',
      { type: 'button', class: ['flip-card', `r-${r.rarity}`, big && 'big'], style: { animationDelay: `${i * 40}ms` }, 'aria-label': def?.name ?? r.cardId },
      h('div', { class: 'flip-inner' },
        h('div', { class: 'flip-face back' }, svg(cardBackSvg())),
        h('div', { class: 'flip-face front' }, def ? cardPortrait(def) : null)),
      r.isNew && badge('NEW', 'gold new'),
    );
    el.addEventListener('click', () => {
      if (!big && el.classList.contains('flipped') && !this.showcaseEl) this.showcase(r);
    });
    return el;
  }

  private flip(el: HTMLElement, r: PullResult, quiet: boolean): void {
    if (el.classList.contains('flipped')) return;
    el.classList.remove('charging');
    el.classList.add('flipped');
    if (quiet) return;
    if (r.rarity >= 5) {
      const c = this.centerOf(el);
      this.fx.color = sealColor(r.rarity, 1, performance.now());
      this.fx.burst(c.x, c.y, 40, 0.25);
      audio.play('skill');
    } else {
      audio.play('tap');
    }
  }

  private finish(): void {
    if (this.phase === 'done') return;
    this.timers.forEach((t) => clearTimeout(t));
    this.timers = [];
    this.cards.forEach((c) => this.flip(c.el, c.r, true));
    this.setPhase('done');
    const cost = pullCost(this.p.pool, this.p.count);
    this.actions.replaceChildren(
      button(this.p.count === 10 ? '再十連' : '再抽一次', { cost: { kind: 'gem', amount: cost }, disabled: getSave().player.gems < cost, onClick: () => this.exit.again() }),
      button('完成', { variant: 'primary', onClick: () => this.exit.done() }),
    );
    // 十連裡的高稀有度卡逐一展示
    if (this.p.results.length > 1) {
      this.showQueue = this.p.results.filter((r) => r.rarity >= 5);
      this.nextShowcase();
    }
  }

  private nextShowcase(): void {
    const r = this.showQueue.shift();
    if (r) this.showcase(r);
  }

  private showcase(r: PullResult): void {
    const def = growth.card(r.cardId);
    if (!def) return;
    audio.play(r.rarity >= 5 ? 'win' : 'tap');
    const el = h(
      'div',
      { class: `ritual-showcase r-${r.rarity}` },
      r.rarity >= 4 && h('div', { class: `ritual-rays r-${r.rarity}` }),
      cardPortrait(def),
      h('div', { class: 'ritual-info' }, stars(r.rarity), h('div', { class: 'ritual-name' }, def.name), r.isNew && badge('NEW', 'gold')),
      h('div', { class: 'small-text dim ritual-tap' }, '點一下繼續'),
    );
    el.addEventListener('click', () => {
      el.remove();
      this.showcaseEl = undefined;
      audio.play('tap');
      this.nextShowcase();
    });
    this.showcaseEl = el;
    this.el.appendChild(el);
  }

  private skip(): void {
    audio.play('tap');
    if (this.phase === 'seal') return this.breakSeal();
    this.timers.forEach((t) => clearTimeout(t));
    this.timers = [];
    if (this.phase === 'burst') this.reveal(true);
    else if (this.phase === 'reveal') this.finish();
  }
}

export const summonRitualScreen: ScreenDef = {
  name: 'summon-ritual',
  title: '召喚',
  chrome: 'bare',
  parent: 'summon',
  render({ nav, onLeave }) {
    const p = takePending();
    if (!p) {
      // 重新整理或直接開網址：沒有待演出的結果（卡片早已入袋），回召喚首頁
      setTimeout(() => nav.replace('summon'));
      return h('div');
    }
    const ritual = new Ritual(p, {
      again: () => {
        const next = startPull(p.pool, p.count);
        if (!next) return;
        setPending(next);
        nav.replace('summon-ritual');
      },
      done: () => nav.back(),
    });
    onLeave(() => ritual.destroy());
    return ritual.el;
  },
};
