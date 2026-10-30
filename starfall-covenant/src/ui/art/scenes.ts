// 場景背景（風格指南第 6 節）：主城、5 章戰鬥場景、活動、挑戰之塔，全部程式產生的原創 SVG
//
// 版面規則：直式 390×844。上方 40% 放主題物與細節，地平線落在 260–330 之間讓敵人站在地上，
// 下方 60% 漸暗成 --bg-deep，因為會被盤面與介面蓋住。每張圖由「天空 → 星空 → 主題物 → 遠中近三層剪影 →
// 霧與粒子 → 下方暗場」疊成；Boss 版再加屬性色調、光柱與天空中的裂環。
import { rngFor } from './seed';
import type { Rng } from '../../core/rng';

export const SCENE_IDS = ['home', 'chapter-1', 'chapter-2', 'chapter-3', 'chapter-4', 'chapter-5', 'event', 'tower'] as const;
export type SceneId = (typeof SCENE_IDS)[number];

export const SCENE_NAMES: Record<SceneId, string> = {
  home: '灰燈港',
  'chapter-1': '焦骨荒原',
  'chapter-2': '鏽齒工坊',
  'chapter-3': '雲林',
  'chapter-4': '龍脊火山',
  'chapter-5': '冥河下游',
  event: '獸王的召集場',
  tower: '英雄座・穹頂',
};

export interface SceneOptions {
  /** Boss 波：加深色調、光柱、裂環 */
  boss?: boolean;
  /** 粒子與霧的 SMIL 動畫；減少動態時關掉 */
  animate?: boolean;
}

const W = 390;
const H = 844;
const DEEP = '#060a1f';

const f = (n: number) => (Math.round(n * 10) / 10).toString();

/** 一張圖的組裝器：defs 與圖層分開累積，id 一律加前綴，同一頁放多張也不會撞 */
class Canvas {
  private defs: string[] = [];
  private layers: string[] = [];
  private n = 0;
  constructor(readonly prefix: string, readonly rng: Rng, readonly animate: boolean) {}

  id(name: string): string {
    return `${this.prefix}-${name}-${this.n++}`;
  }
  def(s: string): void {
    this.defs.push(s);
  }
  add(s: string): void {
    this.layers.push(s);
  }
  /** 垂直漸層，stops 為 [位置, 顏色, 透明度?] */
  vgrad(stops: [number, string, number?][]): string {
    const id = this.id('vg');
    this.def(`<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">${stops.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a === undefined ? '' : ` stop-opacity="${a}"`}/>`).join('')}</linearGradient>`);
    return `url(#${id})`;
  }
  rgrad(color: string, opacity: number, mid = 0.35): string {
    const id = this.id('rg');
    this.def(`<radialGradient id="${id}"><stop offset="0" stop-color="${color}" stop-opacity="${opacity}"/><stop offset="${mid}" stop-color="${color}" stop-opacity="${f(opacity * 0.45)}"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient>`);
    return `url(#${id})`;
  }
  toString(): string {
    return `<svg class="scene-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMin slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs>${this.defs.join('')}</defs>${this.layers.join('')}</svg>`;
  }
}

// ---------- 共用筆刷 ----------

function sky(c: Canvas, stops: [number, string][]): void {
  c.add(`<rect width="${W}" height="${H}" fill="${c.vgrad(stops)}"/>`);
}

function stars(c: Canvas, count: number, yMax: number, tint = '#fff'): void {
  let s = '';
  for (let i = 0; i < count; i++) {
    const x = c.rng.next() * W;
    const y = c.rng.next() * c.rng.next() * yMax;
    const r = 0.3 + c.rng.next() * c.rng.next() * 1.5;
    const o = 0.3 + c.rng.next() * 0.6;
    const tw = c.animate && c.rng.next() < 0.15
      ? `<animate attributeName="opacity" values="${f(o)};.08;${f(o)}" dur="${f(2 + c.rng.next() * 4)}s" repeatCount="indefinite"/>`
      : '';
    s += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${tint}" opacity="${f(o)}">${tw}</circle>`;
    // 亮星加十字光芒
    if (r > 1.3) s += `<path d="M${f(x - 5)} ${f(y)}h10M${f(x)} ${f(y - 5)}v10" stroke="${tint}" stroke-width=".5" opacity="${f(o * 0.7)}"/>`;
  }
  c.add(`<g>${s}</g>`);
}

/** 本作識別：細金線連成的星座 */
function constellation(c: Canvas, cx: number, cy: number, r: number, n: number, opacity = 0.55): void {
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + c.rng.next() * 0.8;
    const d = r * (0.35 + c.rng.next() * 0.65);
    pts.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.7]);
  }
  pts.sort((a, b) => a[0] - b[0]);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${f(x)} ${f(y)}`).join('');
  const dots = pts.map(([x, y], i) => {
    const s = i % 3 === 0 ? 2.4 : 1.4;
    return `<path d="M${f(x)} ${f(y - s * 2.2)}L${f(x + s * 0.5)} ${f(y - s * 0.5)}L${f(x + s * 2.2)} ${f(y)}L${f(x + s * 0.5)} ${f(y + s * 0.5)}L${f(x)} ${f(y + s * 2.2)}L${f(x - s * 0.5)} ${f(y + s * 0.5)}L${f(x - s * 2.2)} ${f(y)}L${f(x - s * 0.5)} ${f(y - s * 0.5)}Z" fill="#f7dc98"/>`;
  }).join('');
  c.add(`<g opacity="${opacity}"><path d="${line}" fill="none" stroke="#f2c45a" stroke-width=".8" stroke-dasharray="3 3"/>${dots}</g>`);
}

/** 起伏剪影：從左到右的折線山脊，往下封到畫面底 */
function ridge(c: Canvas, y: number, amp: number, step: number, fill: string, sharp = false, bottom = H): void {
  let d = `M-10 ${f(y)}`;
  for (let x = -10; x <= W + 10; x += step * (0.6 + c.rng.next() * 0.8)) {
    const yy = y - c.rng.next() * amp;
    if (sharp) d += `L${f(x)} ${f(yy)}`;
    else d += `Q${f(x - step / 2)} ${f(yy - amp * 0.3)} ${f(x)} ${f(yy)}`;
  }
  d += `L${W + 10} ${bottom}L-10 ${bottom}Z`;
  c.add(`<path d="${d}" fill="${fill}"/>`);
}

function glow(c: Canvas, cx: number, cy: number, r: number, color: string, opacity: number): void {
  c.add(`<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" fill="${c.rgrad(color, opacity)}"/>`);
}

/** 水平霧帶，會緩慢左右漂移 */
function fog(c: Canvas, y: number, h: number, color: string, opacity: number): void {
  const fill = c.vgrad([[0, color, 0], [0.5, color, opacity], [1, color, 0]]);
  const drift = c.animate
    ? `<animateTransform attributeName="transform" type="translate" values="0 0;${f(14 + c.rng.next() * 12)} 0;0 0" dur="${f(14 + c.rng.next() * 10)}s" repeatCount="indefinite"/>`
    : '';
  c.add(`<g><rect x="-40" y="${f(y)}" width="${W + 80}" height="${f(h)}" fill="${fill}"/>${drift}</g>`);
}

type ParticleKind = 'ember' | 'mote' | 'ash' | 'leaf' | 'spark';

/** 粒子：火星上升、光塵漂浮、灰燼與葉片落下 */
function particles(c: Canvas, kind: ParticleKind, count: number, y0: number, y1: number, color: string): void {
  let s = '';
  for (let i = 0; i < count; i++) {
    const x = c.rng.next() * W;
    const y = y0 + c.rng.next() * (y1 - y0);
    const o = 0.35 + c.rng.next() * 0.6;
    const dur = f(4 + c.rng.next() * 6);
    const rise = kind === 'ember' || kind === 'mote' || kind === 'spark';
    const dy = (rise ? -1 : 1) * (40 + c.rng.next() * 80);
    const dx = (c.rng.next() - 0.5) * 40;
    const move = c.animate
      ? `<animateTransform attributeName="transform" type="translate" values="0 0;${f(dx)} ${f(dy)}" dur="${dur}s" begin="-${f(c.rng.next() * 6)}s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;${f(o)};0" dur="${dur}s" begin="-${f(c.rng.next() * 6)}s" repeatCount="indefinite"/>`
      : '';
    let shape: string;
    if (kind === 'leaf') {
      const a = c.rng.next() * 180;
      shape = `<path d="M0 -4Q3 0 0 4Q-3 0 0 -4Z" fill="${color}" transform="translate(${f(x)} ${f(y)}) rotate(${f(a)})"/>`;
    } else if (kind === 'spark') {
      shape = `<path d="M${f(x)} ${f(y)}l${f(dx * 0.08)} -4" stroke="${color}" stroke-width="1.2" stroke-linecap="round"/>`;
    } else {
      const r = kind === 'ash' ? 0.8 + c.rng.next() : 0.6 + c.rng.next() * 1.4;
      shape = `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${color}"/>`;
    }
    s += `<g opacity="${f(o)}">${shape}${move}</g>`;
  }
  c.add(`<g>${s}</g>`);
}

/** 墜落的星骸：金色拖尾 */
function fallingStars(c: Canvas, count: number, yMax: number): void {
  const trail = c.id('trail');
  c.def(`<linearGradient id="${trail}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#f7dc98"/></linearGradient>`);
  let s = '';
  for (let i = 0; i < count; i++) {
    const x = 20 + c.rng.next() * 330;
    const y = 20 + c.rng.next() * yMax;
    const len = 30 + c.rng.next() * 50;
    s += `<path d="M${f(x)} ${f(y)}l${f(len * 0.55)} ${f(len * 0.8)}" stroke="url(#${trail})" stroke-width="1.6" stroke-linecap="round"/><circle cx="${f(x + len * 0.55)}" cy="${f(y + len * 0.8)}" r="1.6" fill="#fff6d8"/>`;
  }
  c.add(`<g>${s}</g>`);
}

/** 墜域的浮空碎石：上平下尖的岩塊＋紫色晶體裂紋 */
function floatingRock(c: Canvas, cx: number, cy: number, size: number, fill: string, crack = '#c58bff'): void {
  const j = () => (c.rng.next() - 0.5) * size * 0.3;
  const top = [[-1.2, 0], [-0.7, -0.35], [0, -0.45], [0.6, -0.3], [1.2, 0]].map(([x, y]) => `${f(cx + x * size + j())},${f(cy + y * size + j() * 0.5)}`);
  const bottom = [[0.8, 0.6], [0.2, 1.6], [-0.3, 1.1], [-0.8, 0.5]].map(([x, y]) => `${f(cx + x * size + j())},${f(cy + y * size + j())}`);
  const bob = c.animate
    ? `<animateTransform attributeName="transform" type="translate" values="0 0;0 -${f(3 + c.rng.next() * 4)};0 0" dur="${f(5 + c.rng.next() * 4)}s" repeatCount="indefinite"/>`
    : '';
  const cr = `M${f(cx - size * 0.7)} ${f(cy + size * 0.1)}l${f(size * 0.4)} ${f(size * 0.3)}l${f(size * 0.3)} -${f(size * 0.2)}l${f(size * 0.2)} ${f(size * 0.7)}`;
  c.add(`<g><polygon points="${[...top, ...bottom].join(' ')}" fill="${fill}"/><path d="M${f(cx - size * 1.2)} ${f(cy)}L${f(cx + size * 1.2)} ${f(cy)}" stroke="#5a3a8a" stroke-width="1.5" opacity=".7"/><path d="${cr}" fill="none" stroke="${crack}" stroke-width="5" opacity=".25"/><path d="${cr}" fill="none" stroke="${crack}" stroke-width="1.4"/>${bob}</g>`);
  glow(c, cx, cy + size * 0.6, size * 1.6, crack, 0.25);
}

/** 下方 60% 漸暗：介面與盤面蓋在上面時保持乾淨 */
function bottomShade(c: Canvas, from: number): void {
  c.add(`<rect y="${f(from)}" width="${W}" height="${f(H - from)}" fill="${c.vgrad([[0, DEEP, 0], [0.35, DEEP, 0.75], [1, DEEP, 1]])}"/>`);
}

/** Boss 版：屬性色調、垂直光柱、天空裂環 */
function bossOverlay(c: Canvas, tint: string, horizon: number): void {
  c.add(`<rect width="${W}" height="${f(horizon + 80)}" fill="${c.vgrad([[0, tint, 0.45], [0.7, tint, 0.12], [1, tint, 0]])}"/>`);
  const beam = c.vgrad([[0, '#fff', 0], [0.4, tint, 0.35], [1, '#fff', 0.5]]);
  c.add(`<path d="M170 0h50l22 ${f(horizon)}h-94z" fill="${beam}" opacity=".7"/>`);
  c.add(`<path d="M188 0h14l6 ${f(horizon)}h-26z" fill="${beam}"/>`);
  glow(c, 195, horizon - 10, 120, tint, 0.55);
  // 天空裂環：斷開的圓環＋放射裂紋
  const ring = c.animate ? `<animateTransform attributeName="transform" type="rotate" from="0 195 110" to="360 195 110" dur="80s" repeatCount="indefinite"/>` : '';
  c.add(`<g opacity=".8"><g><circle cx="195" cy="110" r="74" fill="none" stroke="${tint}" stroke-width="2" stroke-dasharray="60 14 22 18"/><circle cx="195" cy="110" r="84" fill="none" stroke="#f7dc98" stroke-width=".8" stroke-dasharray="2 6"/>${ring}</g><path d="M195 36v-20M262 78l18-10M128 78l-18-10M262 142l18 10M128 142l-18 10" stroke="${tint}" stroke-width="1.5"/></g>`);
}

// ---------- 各場景 ----------

/** 主城：灰燈港。暮色的海港、霧中路燈、右側燈塔、墜落的星骸 */
function home(c: Canvas): number {
  const horizon = 300;
  sky(c, [[0, '#0b1230'], [0.22, '#1d2a6b'], [0.34, '#4b4a8f'], [0.38, '#8a6f9e'], [0.45, '#141c45'], [1, DEEP]]);
  stars(c, 80, horizon - 40);
  constellation(c, 110, 90, 60, 6, 0.45);
  fallingStars(c, 4, 120);
  // 月與星軌
  c.add(`<g opacity=".85"><path d="M220 96c26-28 84-28 110 0" fill="none" stroke="#9aa4d6" stroke-width="1" stroke-dasharray="2 5"/><circle cx="292" cy="72" r="22" fill="#f7dc98"/><circle cx="300" cy="66" r="20" fill="#1d2a6b"/></g>`);
  glow(c, 292, 72, 70, '#f7dc98', 0.25);
  ridge(c, horizon - 30, 34, 50, '#232e66', false, horizon + 20);
  ridge(c, horizon - 8, 22, 36, '#18214f', false, horizon + 20);
  // 海與燈光倒影
  c.add(`<rect y="${horizon}" width="${W}" height="${H - horizon}" fill="${c.vgrad([[0, '#1b2864'], [0.25, '#0b1230'], [1, DEEP]])}"/>`);
  let ripples = '';
  for (let i = 0; i < 18; i++) {
    const y = horizon + 6 + i * 6 + c.rng.next() * 4;
    const x = 250 + (c.rng.next() - 0.5) * 60;
    ripples += `<path d="M${f(x)} ${f(y)}h${f(10 + c.rng.next() * 30)}" stroke="#f7dc98" stroke-width="1.2" opacity="${f(0.6 - i * 0.03)}"/>`;
  }
  c.add(`<g>${ripples}</g>`);
  // 城鎮剪影＋窗燈
  c.add(`<path d="M0 ${horizon}h30v-26l10-10 10 10v12h22v-30h18v30h16v-14h26v14h20v-22l12-12 12 12v22h34v-10h18v10h30v-18h22v18h38V${horizon + 6}H0z" fill="#0d1438"/>`);
  let win = '';
  for (let i = 0; i < 26; i++) {
    const x = 6 + c.rng.next() * 340;
    const y = horizon - 24 + c.rng.next() * 20;
    win += `<rect x="${f(x)}" y="${f(y)}" width="2.5" height="3.5" fill="#f2c45a" opacity="${f(0.45 + c.rng.next() * 0.55)}"/>`;
  }
  c.add(`<g>${win}</g>`);
  // 燈塔：白塔紅帶、旋轉光束
  const beam = c.rgrad('#f7dc98', 0.6, 0.3);
  const sweep = c.animate ? `<animateTransform attributeName="transform" type="rotate" values="-18 0 0;14 0 0;-18 0 0" dur="9s" repeatCount="indefinite"/>` : '';
  c.add(`<g transform="translate(338 ${horizon - 132})"><g><path d="M0 8-150 -30v76z" fill="${beam}" opacity=".7"/>${sweep}</g><path d="M-10 132 -6 16h12l4 116z" fill="#d8dbe6"/><path d="M-8 60h16v10h-16zM-9 98h18v10h-18z" fill="#e8553f"/><rect x="-9" y="2" width="18" height="14" rx="2" fill="#fff1c2"/><path d="M-12 2 0-12 12 2z" fill="#e8553f"/><circle cx="0" cy="9" r="22" fill="${c.rgrad('#fff1c2', 0.8)}"/></g>`);
  // 近景碼頭與霧中路燈
  c.add(`<path d="M-10 ${horizon + 50}h220l10 8H-10z" fill="#0a0f2c"/>`);
  for (const [x, hgt] of [[30, 70], [110, 60], [190, 52]]) {
    c.add(`<g><path d="M${x} ${horizon + 50}v-${hgt}h2v${hgt}z" fill="#141b44"/><path d="M${x - 4} ${horizon + 50 - hgt}h10l-2 -8h-6z" fill="#141b44"/><circle cx="${x + 1}" cy="${horizon + 46 - hgt}" r="3" fill="#ffe3a0"/></g>`);
    glow(c, x + 1, horizon + 46 - hgt, 34, '#f2c45a', 0.5);
  }
  fog(c, horizon - 30, 70, '#9aa4d6', 0.22);
  fog(c, horizon + 30, 60, '#6570a8', 0.2);
  particles(c, 'mote', 14, 60, horizon + 40, '#f7dc98');
  return horizon;
}

/** 第 1 章：焦骨荒原（獸座）。焦紅地平線、巨獸肋骨拱門、火星 */
function chapter1(c: Canvas): number {
  const horizon = 312;
  sky(c, [[0, '#1a0f2a'], [0.18, '#4a1a2a'], [0.32, '#a8442a'], [0.38, '#e8853f'], [0.42, '#3a1410'], [1, DEEP]]);
  stars(c, 40, 140, '#ffe3c4');
  constellation(c, 120, 84, 70, 7);
  // 低垂的焦日
  glow(c, 250, horizon - 34, 160, '#ff8a4a', 0.55);
  c.add(`<circle cx="250" cy="${horizon - 34}" r="40" fill="#ffb199" opacity=".85"/>`);
  ridge(c, horizon - 24, 30, 60, '#5a2018', false, horizon + 30);
  // 巨獸骨骸：成排肋骨弧＋脊椎
  let ribs = '';
  for (let i = 0; i < 6; i++) {
    const x = 36 + i * 30;
    const hgt = 120 - Math.abs(i - 2.2) * 22;
    ribs += `<path d="M${x} ${horizon}q${f(-6 + i * 3)} -${f(hgt * 0.7)} ${f(32 + i * 2)} -${f(hgt)}q4 ${f(hgt * 0.4)} -${f(14 + i)} ${f(hgt)}z" fill="#2a120e"/>`;
  }
  c.add(`<g>${ribs}<path d="M24 ${horizon - 6}C80 ${horizon - 110} 170 ${horizon - 120} 214 ${horizon - 40}" fill="none" stroke="#2a120e" stroke-width="7" stroke-linecap="round" stroke-dasharray="9 3"/></g>`);
  // 斷掉的巨牙
  c.add(`<path d="M300 ${horizon}c6-50 30-90 62-110-14 34-22 72-20 110z" fill="#2a120e"/><path d="M314 ${horizon - 30}l10-8M322 ${horizon - 56}l10-8" stroke="#ffb199" stroke-width="1" opacity=".5"/>`);
  ridge(c, horizon + 4, 14, 44, '#1f0c0a', false);
  fog(c, horizon - 50, 80, '#e8553f', 0.18);
  particles(c, 'ember', 26, horizon - 120, horizon + 60, '#ffb199');
  return horizon;
}

function gearPath(cx: number, cy: number, r: number, teeth: number): string {
  let d = '';
  const inner = r * 0.82;
  for (let i = 0; i < teeth * 2; i++) {
    const a0 = (i / (teeth * 2)) * Math.PI * 2;
    const a1 = ((i + 1) / (teeth * 2)) * Math.PI * 2;
    const rr = i % 2 === 0 ? r : inner;
    d += `${i ? 'L' : 'M'}${f(cx + Math.cos(a0) * rr)} ${f(cy + Math.sin(a0) * rr)}L${f(cx + Math.cos(a1) * rr)} ${f(cy + Math.sin(a1) * rr)}`;
  }
  const hole = r * 0.32;
  return `${d}ZM${f(cx + hole)} ${f(cy)}A${f(hole)} ${f(hole)} 0 1 0 ${f(cx - hole)} ${f(cy)}A${f(hole)} ${f(hole)} 0 1 0 ${f(cx + hole)} ${f(cy)}Z`;
}

/** 第 2 章：鏽齒工坊（工匠座）。銅綠煙霧天空、巨大齒輪、煙囪與火花 */
function chapter2(c: Canvas): number {
  const horizon = 300;
  sky(c, [[0, '#0b1a24'], [0.2, '#163a44'], [0.33, '#4c7a6a'], [0.37, '#c88a4a'], [0.42, '#1a1f22'], [1, DEEP]]);
  stars(c, 30, 120, '#dff1ff');
  constellation(c, 290, 70, 60, 6);
  glow(c, 195, horizon - 20, 200, '#e0904a', 0.35);
  // 遠景大齒輪（緩慢轉動）
  const spin = (cx: number, cy: number, dur: number, dir: number) => c.animate
    ? `<animateTransform attributeName="transform" type="rotate" from="0 ${cx} ${cy}" to="${dir * 360} ${cx} ${cy}" dur="${dur}s" repeatCount="indefinite"/>`
    : '';
  c.add(`<g fill="#24403f" fill-rule="evenodd" opacity=".9"><path d="${gearPath(90, horizon - 90, 80, 14)}">${spin(90, horizon - 90, 90, 1)}</path></g>`);
  c.add(`<g fill="#2c4a46" fill-rule="evenodd"><path d="${gearPath(196, horizon - 50, 46, 10)}">${spin(196, horizon - 50, 50, -1)}</path></g>`);
  // 煙囪＋煙
  let smoke = '';
  for (const [x, top] of [[262, 150], [300, 120], [342, 168]] as const) {
    c.add(`<path d="M${x - 9} ${horizon}V${horizon - top}h18V${horizon}z" fill="#1c2c2e"/><path d="M${x - 11} ${horizon - top}h22v6h-22z" fill="#5a3a22"/>`);
    for (let i = 0; i < 5; i++) {
      const r = 10 + i * 6;
      smoke += `<circle cx="${f(x + i * 10 + c.rng.next() * 8)}" cy="${f(horizon - top - 14 - i * 18)}" r="${r}" fill="#4c6a66" opacity="${f(0.35 - i * 0.05)}"/>`;
    }
  }
  c.add(`<g>${smoke}</g>`);
  // 管線
  c.add(`<path d="M0 ${horizon - 40}h120q14 0 14 14v30M250 ${horizon - 70}h-40q-10 0-10 10v60" fill="none" stroke="#5a3a22" stroke-width="6"/><path d="M0 ${horizon - 40}h120q14 0 14 14v30" fill="none" stroke="#c88a4a" stroke-width="1" opacity=".5"/>`);
  ridge(c, horizon + 6, 10, 30, '#111a1c', true);
  // 地面格柵
  let grate = '';
  for (let x = 0; x <= W; x += 22) grate += `M${x} ${horizon + 10}l${f((x - 195) * 0.4)} 120`;
  c.add(`<path d="${grate}" stroke="#c88a4a" stroke-width=".8" opacity=".18"/>`);
  fog(c, horizon - 70, 90, '#4c7a6a', 0.22);
  particles(c, 'spark', 22, horizon - 100, horizon + 20, '#ffcf7a');
  return horizon;
}

/** 第 3 章：雲林（羽座）。雲海中的高大林木、斜射光、飄落的葉與羽 */
function chapter3(c: Canvas): number {
  const horizon = 320;
  sky(c, [[0, '#0e2a3a'], [0.2, '#2a6a74'], [0.36, '#a8d8c4'], [0.42, '#1d4a3a'], [1, DEEP]]);
  stars(c, 24, 100, '#e4ffd9');
  constellation(c, 200, 70, 80, 7, 0.5);
  // 斜射光束
  for (let i = 0; i < 4; i++) {
    const x = 60 + i * 80;
    c.add(`<path d="M${x} 0h${f(22 + i * 6)}l60 ${horizon}h-${f(40 + i * 8)}z" fill="#e4ffd9" opacity=".08"/>`);
  }
  // 遠中近三層樹：樹幹＋雲狀樹冠
  const tree = (x: number, base: number, hgt: number, fill: string, crown: number) => {
    let s = `<path d="M${x - 4} ${base}l2 -${hgt}h4l2 ${hgt}z" fill="${fill}"/>`;
    for (let i = 0; i < 4; i++) {
      s += `<ellipse cx="${f(x + (c.rng.next() - 0.5) * crown)}" cy="${f(base - hgt + i * crown * 0.35)}" rx="${f(crown * (0.6 + c.rng.next() * 0.4))}" ry="${f(crown * 0.35)}" fill="${fill}"/>`;
    }
    return s;
  };
  let far = '';
  for (let i = 0; i < 7; i++) far += tree(20 + i * 58 + c.rng.next() * 20, horizon, 150 + c.rng.next() * 60, '#2a5a5a', 30);
  c.add(`<g opacity=".7">${far}</g>`);
  fog(c, horizon - 90, 80, '#dff1ff', 0.3);
  let mid = '';
  for (const x of [40, 150, 330]) mid += tree(x, horizon + 10, 210 + c.rng.next() * 40, '#163a34', 44);
  c.add(`<g>${mid}</g>`);
  // 雲海層
  let clouds = '';
  for (let i = 0; i < 10; i++) {
    clouds += `<ellipse cx="${f(c.rng.next() * W)}" cy="${f(horizon - 10 + c.rng.next() * 30)}" rx="${f(50 + c.rng.next() * 60)}" ry="${f(10 + c.rng.next() * 8)}" fill="#dff1ff" opacity="${f(0.15 + c.rng.next() * 0.15)}"/>`;
  }
  c.add(`<g>${clouds}</g>`);
  ridge(c, horizon + 14, 12, 40, '#0c2420', false);
  particles(c, 'leaf', 18, 40, horizon + 40, '#b5f2c4');
  particles(c, 'mote', 14, 80, horizon, '#fffbe8');
  return horizon;
}

/** 第 4 章：龍脊火山（龍座）。噴發的火山口、龍脊狀尖岩、熔岩河、灰燼 */
function chapter4(c: Canvas): number {
  const horizon = 304;
  sky(c, [[0, '#120814'], [0.2, '#3a0e14'], [0.34, '#8f2414'], [0.4, '#200a0a'], [1, DEEP]]);
  stars(c, 20, 100, '#ffe3c4');
  constellation(c, 300, 64, 60, 6, 0.45);
  // 火山：錐體＋火口光
  glow(c, 170, horizon - 150, 120, '#ff6a3a', 0.6);
  c.add(`<path d="M30 ${horizon}L140 ${horizon - 146}h60L320 ${horizon}z" fill="#2a0e0e"/>`);
  c.add(`<path d="M142 ${horizon - 146}h56l-8 10h-40z" fill="#ffb199"/>`);
  // 熔岩流（發光）
  c.add(`<path d="M160 ${horizon - 138}c-6 40 10 70-20 ${f(138 - 20)}M184 ${horizon - 138}c10 50 40 80 70 ${f(138 - 10)}" fill="none" stroke="#e8553f" stroke-width="4" opacity=".9"/><path d="M160 ${horizon - 138}c-6 40 10 70-20 ${f(138 - 20)}M184 ${horizon - 138}c10 50 40 80 70 ${f(138 - 10)}" fill="none" stroke="#ffe3c4" stroke-width="1.2"/>`);
  // 噴煙
  let plume = '';
  for (let i = 0; i < 7; i++) plume += `<circle cx="${f(170 + (c.rng.next() - 0.3) * 30 + i * 6)}" cy="${f(horizon - 170 - i * 22)}" r="${f(16 + i * 7)}" fill="#3a1418" opacity="${f(0.7 - i * 0.08)}"/>`;
  c.add(`<g>${plume}</g>`);
  // 龍脊：沿弧線排列的尖刺
  let spine = '';
  for (let i = 0; i < 11; i++) {
    const t = i / 10;
    const x = -10 + t * 410;
    const base = horizon + 4 - Math.sin(t * Math.PI) * 30;
    const hgt = 26 + Math.sin(t * Math.PI) * 40 + c.rng.next() * 10;
    spine += `<path d="M${f(x - 16)} ${f(base)}L${f(x + 4)} ${f(base - hgt)}L${f(x + 18)} ${f(base)}z" fill="#170707"/>`;
  }
  c.add(`<g>${spine}</g>`);
  ridge(c, horizon + 10, 10, 30, '#120606', true);
  // 熔岩裂縫
  c.add(`<path d="M20 ${horizon + 40}l40 10 30-6 50 14M230 ${horizon + 30}l50 12 40-4 60 10" fill="none" stroke="#e8553f" stroke-width="2" opacity=".6"/>`);
  particles(c, 'ash', 20, 0, horizon, '#9a8a8a');
  particles(c, 'ember', 22, horizon - 160, horizon + 40, '#ffb199');
  return horizon;
}

/** 第 5 章：冥河下游（冥河座）。紫霧河面、漂流燈籠、枯樹、渡船、墜域浮石 */
function chapter5(c: Canvas): number {
  const horizon = 296;
  sky(c, [[0, '#0a0620'], [0.2, '#24124a'], [0.33, '#5a3a8a'], [0.36, '#2a1a4a'], [1, DEEP]]);
  stars(c, 60, 180, '#f1e4ff');
  constellation(c, 100, 80, 70, 7);
  // 冥月
  glow(c, 280, 90, 80, '#dcc0ff', 0.35);
  c.add(`<circle cx="280" cy="90" r="26" fill="#f1e4ff" opacity=".85"/><path d="M262 84c8 4 16 2 22-4M272 102c6-2 12 0 16 4" stroke="#9b5de5" stroke-width="1.5" fill="none" opacity=".6"/>`);
  // 墜域浮石
  floatingRock(c, 70, 150, 26, '#1d1238');
  floatingRock(c, 336, 196, 16, '#1d1238');
  floatingRock(c, 200, 150, 10, '#24164a');
  ridge(c, horizon - 16, 26, 50, '#1a1036', false, horizon + 10);
  // 河面
  c.add(`<rect y="${horizon}" width="${W}" height="${H - horizon}" fill="${c.vgrad([[0, '#2a1a5a'], [0.2, '#0e0a2a'], [1, DEEP]])}"/>`);
  // 枯樹
  const deadTree = (x: number, hgt: number, dir: number) => `<path d="M${x} ${horizon + 6}c2-${hgt * 0.4} -2-${hgt * 0.7} ${dir * 6}-${hgt}M${x + dir * 1} ${horizon - hgt * 0.5}l${dir * 22} -18M${x + dir * 3} ${horizon - hgt * 0.75}l${dir * -18} -14M${x + dir * 22} ${horizon - hgt * 0.5 - 18}l${dir * 8} -12" stroke="#0e0820" stroke-width="4" fill="none" stroke-linecap="round"/>`;
  c.add(deadTree(28, 110, 1) + deadTree(364, 90, -1));
  // 渡船剪影＋船燈
  c.add(`<g transform="translate(150 ${horizon + 8})"><path d="M0 0h80l-10 10h-58z" fill="#0b0618"/><path d="M60 0v-36" stroke="#0b0618" stroke-width="2"/><path d="M60 -36l10 2" stroke="#0b0618" stroke-width="2"/><circle cx="70" cy="-30" r="3" fill="#ffd6ff"/><path d="M26 0v-18c0-6 10-6 10 0v18z" fill="#0b0618"/></g>`);
  glow(c, 220, horizon - 22, 30, '#ffd6ff', 0.6);
  // 漂流燈籠與倒影
  for (let i = 0; i < 9; i++) {
    const x = 20 + c.rng.next() * 350;
    const y = horizon + 18 + c.rng.next() * 70;
    const s = 0.6 + (y - horizon) / 120;
    const drift = c.animate ? `<animateTransform attributeName="transform" type="translate" values="0 0;${f(8 + c.rng.next() * 10)} 1;0 0" dur="${f(6 + c.rng.next() * 5)}s" repeatCount="indefinite"/>` : '';
    c.add(`<g><rect x="${f(x - 3 * s)}" y="${f(y - 5 * s)}" width="${f(6 * s)}" height="${f(6 * s)}" rx="1" fill="#ffe3a0"/><path d="M${f(x)} ${f(y + 2 * s)}v${f(14 * s)}" stroke="#ffe3a0" stroke-width="${f(2 * s)}" opacity=".3"/>${drift}</g>`);
    glow(c, x, y - 2 * s, 18 * s, '#f2c45a', 0.45);
  }
  fog(c, horizon - 30, 70, '#9b5de5', 0.3);
  fog(c, horizon + 20, 50, '#dcc0ff', 0.14);
  particles(c, 'mote', 18, 60, horizon + 40, '#dcc0ff');
  return horizon;
}

/** 活動：獸王的召集場。石柱圍成的獸王競技場、旗幟繩、火炬、天空中的鬃獅星紋 */
function eventScene(c: Canvas): number {
  const horizon = 310;
  sky(c, [[0, '#1a0e2a'], [0.2, '#4a1a3a'], [0.33, '#c8683a'], [0.38, '#f2c45a'], [0.42, '#2a1408'], [1, DEEP]]);
  stars(c, 40, 140, '#fff1c2');
  // 獸王星紋：太陽狀鬃毛環繞的星
  const spin = c.animate ? `<animateTransform attributeName="transform" type="rotate" from="0 195 112" to="360 195 112" dur="120s" repeatCount="indefinite"/>` : '';
  let mane = '';
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const r0 = 40;
    const r1 = 64 + (i % 2) * 12;
    mane += `<path d="M${f(195 + Math.cos(a - 0.12) * r0)} ${f(112 + Math.sin(a - 0.12) * r0)}L${f(195 + Math.cos(a) * r1)} ${f(112 + Math.sin(a) * r1)}L${f(195 + Math.cos(a + 0.12) * r0)} ${f(112 + Math.sin(a + 0.12) * r0)}" fill="none" stroke="#f2c45a" stroke-width="1.2"/>`;
  }
  glow(c, 195, 112, 110, '#f2c45a', 0.4);
  c.add(`<g opacity=".8"><g>${mane}${spin}</g><circle cx="195" cy="112" r="36" fill="none" stroke="#f7dc98" stroke-width="1.5"/><path d="M195 86l7 19 19 7-19 7-7 19-7-19-19-7 19-7z" fill="#fff1c2"/></g>`);
  ridge(c, horizon - 16, 20, 60, '#3a1a14', false, horizon + 20);
  // 競技場石柱環（遠小近大）
  const pillar = (x: number, hgt: number, wdt: number, fill: string) => `<path d="M${f(x - wdt / 2)} ${horizon + 6}V${f(horizon - hgt)}h${f(wdt)}V${horizon + 6}z" fill="${fill}"/><path d="M${f(x - wdt / 2 - 3)} ${f(horizon - hgt)}h${f(wdt + 6)}v5h-${f(wdt + 6)}z" fill="${fill}"/>`;
  let ps = '';
  for (let i = 0; i < 9; i++) {
    const x = 20 + i * 44;
    const d = Math.abs(i - 4);
    ps += pillar(x, 70 + d * 14, 12 + d * 2, '#22100c');
  }
  c.add(`<g>${ps}</g>`);
  // 旗幟繩：三角旗沿懸鏈線
  let flags = '';
  for (let k = 0; k < 2; k++) {
    const y0 = horizon - 120 + k * 30;
    for (let i = 0; i < 12; i++) {
      const t = i / 11;
      const x = 10 + t * 370;
      const y = y0 + Math.sin(t * Math.PI) * 26;
      const col = ['#e8553f', '#f2c45a', '#4cbf6a', '#3f8ee8'][(i + k) % 4];
      flags += `<path d="M${f(x - 6)} ${f(y)}h12l-6 12z" fill="${col}" opacity=".85"/>`;
    }
    flags += `<path d="M10 ${y0}Q195 ${y0 + 52} 380 ${y0}" fill="none" stroke="#2a1408" stroke-width="1"/>`;
  }
  c.add(`<g>${flags}</g>`);
  // 火炬
  for (const x of [52, 338]) {
    c.add(`<path d="M${x - 3} ${horizon + 20}l1-60h4l1 60z" fill="#1a0c08"/><path d="M${x} ${horizon - 52}c-8-8-2-18 0-24 4 8 10 14 0 24z" fill="#ffb199"/>`);
    glow(c, x, horizon - 50, 40, '#ff8a4a', 0.6);
  }
  ridge(c, horizon + 12, 8, 40, '#140804', false);
  particles(c, 'ember', 18, horizon - 100, horizon + 30, '#ffe3c4');
  return horizon;
}

/** 挑戰之塔：英雄座的穹頂。雲海之上的白石塔、金色星軌環、漂浮的遺跡 */
function tower(c: Canvas): number {
  const horizon = 320;
  sky(c, [[0, '#060a1f'], [0.18, '#16204a'], [0.34, '#3a4a9a'], [0.4, '#a8b4e8'], [0.44, '#1a2350'], [1, DEEP]]);
  stars(c, 110, 260);
  constellation(c, 70, 70, 50, 6);
  constellation(c, 320, 120, 50, 5);
  // 白石塔
  glow(c, 195, 60, 120, '#fff1c2', 0.4);
  c.add(`<path d="M182 ${horizon}L186 70l9-24 9 24 4 ${horizon - 70}z" fill="#d8dbe6"/><path d="M195 46l9 24 4 ${horizon - 70}h-13z" fill="#9aa4d6" opacity=".6"/>`);
  let windows = '';
  for (let y = 100; y < horizon - 20; y += 34) windows += `<rect x="192.5" y="${y}" width="5" height="9" rx="2.5" fill="#f2c45a" opacity=".8"/>`;
  c.add(windows);
  c.add(`<circle cx="195" cy="40" r="5" fill="#fff"/>`);
  // 星軌環
  for (const [ry, rx, y, dur] of [[10, 70, 120, 40], [14, 104, 190, 60], [18, 140, 260, 80]] as const) {
    const flow = c.animate ? `<animate attributeName="stroke-dashoffset" from="0" to="-60" dur="${dur / 10}s" repeatCount="indefinite"/>` : '';
    c.add(`<ellipse cx="195" cy="${y}" rx="${rx}" ry="${ry}" fill="none" stroke="#f2c45a" stroke-width="1.4" stroke-dasharray="14 6 2 6" opacity=".75">${flow}</ellipse>`);
    c.add(`<circle cx="${195 + rx}" cy="${y}" r="2.5" fill="#fff6d8"/><circle cx="${195 - rx * 0.7}" cy="${y + ry * 0.7}" r="2" fill="#fff6d8"/>`);
  }
  // 漂浮遺跡：斷柱與拱
  const ruin = (x: number, y: number, s: number) => `<g transform="translate(${x} ${y}) scale(${s})" fill="#b8bfd8"><path d="M-14 0h28v4h-28zM-10 4h6v26h-6zM4 4h6v18h-6z"/><path d="M-16 34q16-10 32 0l-4 8h-24z" fill="#6570a8"/></g>`;
  c.add(ruin(60, 200, 1) + ruin(330, 236, 0.8) + ruin(110, 270, 0.6));
  // 雲海
  let clouds = '';
  for (let i = 0; i < 14; i++) {
    clouds += `<ellipse cx="${f(c.rng.next() * W)}" cy="${f(horizon - 6 + c.rng.next() * 30)}" rx="${f(50 + c.rng.next() * 70)}" ry="${f(12 + c.rng.next() * 10)}" fill="#dfe6ff" opacity="${f(0.2 + c.rng.next() * 0.25)}"/>`;
  }
  c.add(`<g>${clouds}</g>`);
  fog(c, horizon - 10, 60, '#dfe6ff', 0.3);
  particles(c, 'mote', 20, 60, horizon, '#fff6d8');
  return horizon;
}

const DRAW: Record<SceneId, (c: Canvas) => number> = {
  home,
  'chapter-1': chapter1,
  'chapter-2': chapter2,
  'chapter-3': chapter3,
  'chapter-4': chapter4,
  'chapter-5': chapter5,
  event: eventScene,
  tower,
};

/** Boss 版的屬性色調：依章節的主題色 */
const BOSS_TINT: Record<SceneId, string> = {
  home: '#9b5de5',
  'chapter-1': '#e8553f',
  'chapter-2': '#e8553f',
  'chapter-3': '#9b5de5',
  'chapter-4': '#ff3a2a',
  'chapter-5': '#c050ff',
  event: '#e8553f',
  tower: '#9b5de5',
};

/** 場景背景 SVG（390×844 直式），同一組參數每次輸出相同 */
export function sceneSvg(id: SceneId, opts: SceneOptions = {}): string {
  const boss = !!opts.boss;
  const c = new Canvas(`sc-${id}${boss ? '-b' : ''}`, rngFor(`scene:${id}`), opts.animate ?? true);
  const horizon = DRAW[id](c);
  if (boss) bossOverlay(c, BOSS_TINT[id], horizon);
  bottomShade(c, horizon + 40);
  return c.toString();
}
