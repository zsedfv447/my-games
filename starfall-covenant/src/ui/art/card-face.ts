// 程式產生的卡面（風格指南第 2 節）：屬性背景＋種族剪影＋星紋線＋「星盤」卡框。
// 使用者提供的原創立繪（assets/user/cards/）會優先取代這裡的圖。
import type { Attribute, CardDef, Race, Rarity } from '../../core/types';
import { ATTRIBUTE_NAMES, RACE_NAMES, RARITY_FRAMES } from './palette';
import { ORB_SYMBOLS } from './orbs';
import { escapeXml, rngFor } from './seed';
import { buildFigure, sparkle, type Figure, type FigurePalette } from './silhouettes';

/** 卡面只需要這些欄位，方便還沒有完整資料時預覽 */
export type CardFaceInput = Pick<CardDef, 'id' | 'name' | 'attribute' | 'race' | 'rarity'>;

/** 屬性五階色（風格指南 1.2）：暗部、中間、亮部、高光、特效核心 */
const TONES: Record<Attribute, { dark: string; base: string; light: string; hi: string; core: string }> = {
  fire: { dark: '#8f2414', base: '#e8553f', light: '#ffb199', hi: '#ffe3c4', core: '#fff4d6' },
  water: { dark: '#163f8a', base: '#3f8ee8', light: '#a8d4ff', hi: '#dff1ff', core: '#f2fbff' },
  wood: { dark: '#1d6634', base: '#4cbf6a', light: '#b5f2c4', hi: '#e4ffd9', core: '#f6fff0' },
  light: { dark: '#a0700f', base: '#f2c45a', light: '#fff1c2', hi: '#fffbe8', core: '#ffffff' },
  dark: { dark: '#4a2183', base: '#9b5de5', light: '#dcc0ff', hi: '#f1e4ff', core: '#ffd6ff' },
};

const DEEP = '#060a1f';
const NAVY = '#0b1230';
const GOLD = '#f2c45a';
const GOLD_SOFT = '#f7dc98';
const GOLD_DEEP = '#b98a2a';

const RACE_GLYPHS: Record<Race, string> = {
  beast: '獸', dragon: '龍', machina: '機', sylph: '靈', nether: '冥', human: '人', material: '材',
};

const f = (n: number) => (Math.round(n * 10) / 10).toString();

function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (s: number) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
  return `#${((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1)}`;
}

function stops(list: [number, string, number?][]): string {
  return list.map(([o, c, op]) => `<stop offset="${o}" stop-color="${c}"${op !== undefined ? ` stop-opacity="${op}"` : ''}/>`).join('');
}

function frameGradient(id: string, rarity: Rarity): string {
  const s = RARITY_FRAMES[rarity].stops;
  return `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">${stops(s.map((c, i) => [+(i / (s.length - 1)).toFixed(2), c]))}</linearGradient>`;
}

/** 依卡號產生固定的星座：5–8 顆星連成一筆 */
export function constellationPoints(cardId: string, w: number, h: number, margin: number): [number, number][] {
  const rng = rngFor(`constellation:${cardId}`);
  const n = 5 + rng.int(4);
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    pts.push([margin + rng.next() * (w - margin * 2), margin + rng.next() * (h - margin * 2)]);
  }
  // 依角度排序，連線比較像星座而不是亂線
  const cx = w / 2;
  const cy = h / 2;
  return pts.sort((a, b) => Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx));
}

/** 名字的代表字：取第一個字（「・」分隔時取第二段的第一字） */
export function nameGlyph(name: string): string {
  const parts = name.split(/[・·\s]/).filter(Boolean);
  const pick = parts.length > 1 ? parts[parts.length - 1] : name;
  return [...(pick || '?')][0];
}

// ---------- 立繪（300×400 座標）：背景、剪影、星紋線 ----------

interface ArtParts {
  defs: string;
  art: string;
  focus: [number, number];
}

/** 卡號決定姿勢：同種族的卡輪流用 3 種姿勢，再由種子換配件 */
function poseFor(card: CardFaceInput): number {
  const digits = card.id.replace(/\D/g, '');
  return digits ? Number(digits) % 3 : rngFor(`pose:${card.id}`).int(3);
}

function starfield(key: string, count: number, flares: number, t: (typeof TONES)[Attribute]): string {
  const rng = rngFor(`dust:${key}`);
  let out = '';
  for (let i = 0; i < count; i++) {
    out += `<circle cx="${f(rng.next() * 300)}" cy="${f(rng.next() * 400)}" r="${(0.5 + rng.next()).toFixed(2)}" fill="#fff" opacity="${(0.25 + rng.next() * 0.5).toFixed(2)}"/>`;
  }
  for (let i = 0; i < flares; i++) {
    const x = 20 + rng.next() * 260;
    const y = 20 + rng.next() * 220;
    const r = 3 + rng.next() * 4;
    out += `<g fill="${t.hi}" opacity="${(0.55 + rng.next() * 0.35).toFixed(2)}">${sparkle(x, y, r * 2, 0.12)}<circle cx="${f(x)}" cy="${f(y)}" r="${f(r * 0.35)}" fill="#fff"/></g>`;
  }
  return out;
}

function constellation(cardId: string): string {
  const pts = constellationPoints(cardId, 260, 260, 26).map(([x, y]) => [x + 20, y + 30] as [number, number]);
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${f(x)} ${f(y)}`).join('');
  const stars = pts.map(([x, y], i) => sparkle(x, y, i % 3 ? 4 : 7, 0.18)).join('');
  return `<g opacity=".55"><path d="${d}" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="1.2" stroke-dasharray="1 3" stroke-linecap="round"/><g fill="#fff">${stars}</g></g>`;
}

/** 6★ 背景的大型星盤紋章（半透明 20%） */
function astrolabe(t: (typeof TONES)[Attribute]): string {
  let ticks = '';
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    const r0 = i % 4 ? 118 : 110;
    ticks += `M${f(150 + Math.cos(a) * r0)} ${f(170 + Math.sin(a) * r0)}L${f(150 + Math.cos(a) * 126)} ${f(170 + Math.sin(a) * 126)}`;
  }
  let stars = '';
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + 0.13;
    stars += sparkle(150 + Math.cos(a) * 96, 170 + Math.sin(a) * 96, 5, 0.2);
  }
  return `<g opacity=".22" fill="none" stroke="${t.hi}" stroke-width="1.5">
    <circle cx="150" cy="170" r="126"/><circle cx="150" cy="170" r="104"/><circle cx="150" cy="170" r="60" stroke-dasharray="2 5"/>
    <path d="${ticks}"/><path d="M150 44V296M24 170H276M61 81L239 259M239 81L61 259" stroke-opacity=".5"/>
    <g fill="${t.hi}" stroke="none">${stars}</g></g>`;
}

/** 屬性材質粒子：焰＝火星、潮＝水泡、森＝葉片、輝＝光塵、蝕＝墨霧 */
function particle(attr: Attribute, x: number, y: number, s: number, rot: number, t: (typeof TONES)[Attribute], pfx: string): string {
  switch (attr) {
    case 'fire':
      return `<path d="M${f(x)} ${f(y - s * 1.8)}Q${f(x + s)} ${f(y)} ${f(x)} ${f(y + s * 0.8)}Q${f(x - s)} ${f(y)} ${f(x)} ${f(y - s * 1.8)}Z" fill="${t.hi}" transform="rotate(${f(rot * 0.3)} ${f(x)} ${f(y)})"/>`;
    case 'water':
      return `<circle cx="${f(x)}" cy="${f(y)}" r="${f(s)}" fill="${t.light}" fill-opacity=".15" stroke="${t.hi}" stroke-width=".9"/><circle cx="${f(x - s * 0.35)}" cy="${f(y - s * 0.35)}" r="${f(s * 0.25)}" fill="#fff"/>`;
    case 'wood':
      return `<path d="M${f(x - s * 1.4)} ${f(y)}Q${f(x)} ${f(y - s)} ${f(x + s * 1.4)} ${f(y)}Q${f(x)} ${f(y + s)} ${f(x - s * 1.4)} ${f(y)}Z" fill="${t.light}" transform="rotate(${f(rot)} ${f(x)} ${f(y)})"/>`;
    case 'light':
      return `<g fill="${t.core}">${sparkle(x, y, s * 1.6, 0.15)}</g>`;
    case 'dark':
      return `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(s * 2.6)}" ry="${f(s * 1.4)}" fill="url(#${pfx}mist)" transform="rotate(${f(rot)} ${f(x)} ${f(y)})"/>`;
  }
}

/** 星紋線：細金線沿角色外輪廓繞行，節點是星，沿線撒屬性粒子 */
function starThreads(card: CardFaceInput, t: (typeof TONES)[Attribute], pfx: string): { behind: string; front: string } {
  const seg = card.rarity >= 6 ? 3 : card.rarity === 5 ? 2 : card.rarity === 4 ? 1 : 0;
  const particles = card.rarity >= 6 ? 28 : card.rarity === 5 ? 16 : 0;
  if (!seg) return { behind: '', front: '' };
  const rng = rngFor(`thread:${card.id}`);
  const tilt = -0.35 + rng.next() * 0.2;
  const at = (a: number, jitter: number): [number, number] => {
    const x = Math.cos(a) * (128 + jitter);
    const y = Math.sin(a) * (150 + jitter);
    return [150 + x * Math.cos(tilt) - y * Math.sin(tilt), 196 + x * Math.sin(tilt) + y * Math.cos(tilt)];
  };
  let behind = '';
  let front = '';
  const allPts: [number, number][] = [];
  const start = rng.next() * Math.PI * 2;
  for (let s = 0; s < seg; s++) {
    const a0 = start + (s * Math.PI * 2) / seg + rng.next() * 0.3;
    const span = 1.9 + rng.next() * 0.8;
    const pts: [number, number][] = [];
    for (let i = 0; i <= 6; i++) pts.push(at(a0 + (span * i) / 6, (rng.next() - 0.5) * 22));
    allPts.push(...pts);
    let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i][0] + pts[i + 1][0]) / 2;
      const my = (pts[i][1] + pts[i + 1][1]) / 2;
      d += `Q${f(pts[i][0])} ${f(pts[i][1])} ${f(mx)} ${f(my)}`;
    }
    const nodes = [1, 3, 5].map((i) => `<circle cx="${f(pts[i][0])}" cy="${f(pts[i][1])}" r="1.6" fill="#fff"/>${sparkle(pts[i][0], pts[i][1], i === 3 ? 8 : 5, 0.16)}`).join('');
    const g = `<path d="${d}" fill="none" stroke="${t.hi}" stroke-opacity=".28" stroke-width="5" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${GOLD_SOFT}" stroke-width="1.4" stroke-linecap="round"/><g fill="${GOLD_SOFT}">${nodes}</g>`;
    if (s % 2) behind += g;
    else front += g;
  }
  for (let i = 0; i < particles; i++) {
    const [x, y] = allPts[rng.int(allPts.length)];
    const p = particle(card.attribute, x + (rng.next() - 0.5) * 36, y + (rng.next() - 0.5) * 36, 2 + rng.next() * 2.5, rng.next() * 360, t, pfx);
    if (i % 2) behind += `<g opacity="${(0.55 + rng.next() * 0.45).toFixed(2)}">${p}</g>`;
    else front += `<g opacity="${(0.55 + rng.next() * 0.45).toFixed(2)}">${p}</g>`;
  }
  return { behind, front };
}

const LAYER_FILL = { back: 'back', body: 'body', metal: 'metal', gold: 'gold' } as const;

function renderFigure(fig: Figure, t: (typeof TONES)[Attribute], attr: Attribute, pfx: string, blur: boolean): string {
  let out = '';
  for (const layer of fig.layers) {
    if (!layer.shapes) continue;
    const soft = layer.kind === 'back' || layer.kind === 'body';
    // 背光側邊緣光：同一剪影往左上偏移，用亮部色墊在描邊下面
    if (soft) out += `<g transform="translate(-3 -2.5)" fill="${t.light}" stroke="${t.light}" stroke-width="3" stroke-linejoin="round">${layer.shapes}</g>`;
    out += `<g fill="${DEEP}" stroke="${DEEP}" stroke-width="4.5" stroke-linejoin="round">${layer.shapes}</g>`;
    out += `<g fill="url(#${pfx}${LAYER_FILL[layer.kind]})">${layer.shapes}</g>`;
    if (soft) out += `<g fill="url(#${pfx}shade)">${layer.shapes}</g>`;
  }
  out += fig.details;
  for (const g of fig.glows) {
    out += `<circle cx="${f(g.x)}" cy="${f(g.y)}" r="${f(g.r * 2)}" fill="url(#${pfx}glow)"/><circle cx="${f(g.x)}" cy="${f(g.y)}" r="${f(g.r * 0.32)}" fill="${t.core}"/>`;
  }
  const { x, y, size } = fig.emblem;
  const s = size / 60;
  out += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(size * 0.95)}" fill="url(#${pfx}glow)"/>`;
  out += `<g transform="translate(${f(x - 50 * s)} ${f(y - 50 * s)}) scale(${s.toFixed(3)})"${blur ? ` filter="url(#${pfx}soft)"` : ''}><path d="${ORB_SYMBOLS[attr]}" fill="${t.core}" fill-opacity=".92" stroke="${t.hi}" stroke-width="5" stroke-linejoin="round" paint-order="stroke"/></g>`;
  return out;
}

/** 立繪的畫面部分（不含卡框），立繪與頭像共用；pfx 讓兩者的 id 不衝突 */
function cardArt(card: CardFaceInput, pfx: string, opts: { blur: boolean }): ArtParts {
  const t = TONES[card.attribute];
  const pal: FigurePalette = { hi: t.hi, light: t.light, base: t.base, dark: t.dark, gold: GOLD };
  const fig = buildFigure(card.race, rngFor(`figure:${card.id}`), poseFor(card), pal);
  const [fx, fy] = fig.focus;
  const threads = starThreads(card, t, pfx);
  const rays = [-36, -18, 0, 18, 36]
    .map((a) => `<path d="M150 -30L${f(150 + Math.tan((a * Math.PI) / 180) * 430 - 14)} 400h28Z"/>`)
    .join('');

  const defs = `
    <radialGradient id="${pfx}bg" cx="50%" cy="34%" r="78%">${stops([[0, mix(t.base, t.dark, 0.55)], [0.4, mix(t.dark, NAVY, 0.35)], [1, mix(t.dark, DEEP, 0.85)]])}</radialGradient>
    <radialGradient id="${pfx}halo">${stops([[0, t.hi, 0.75], [0.35, t.light, 0.35], [1, t.light, 0]])}</radialGradient>
    <radialGradient id="${pfx}glow">${stops([[0, t.core, 0.95], [0.3, t.hi, 0.55], [1, t.light, 0]])}</radialGradient>
    <radialGradient id="${pfx}mist">${stops([[0, t.core, 0.45], [0.5, t.base, 0.3], [1, t.dark, 0]])}</radialGradient>
    <linearGradient id="${pfx}body" x1="0" y1="0" x2="0" y2="1">${stops([[0, mix(t.base, t.light, 0.2)], [0.45, t.base], [1, mix(t.dark, NAVY, 0.25)]])}</linearGradient>
    <linearGradient id="${pfx}back" x1="0" y1="0" x2="0" y2="1">${stops([[0, mix(t.base, t.dark, 0.3)], [1, mix(t.dark, DEEP, 0.45)]])}</linearGradient>
    <linearGradient id="${pfx}metal" x1="0" y1="0" x2="1" y2="1">${stops([[0, '#ffffff'], [0.4, t.hi], [1, mix(t.light, t.dark, 0.45)]])}</linearGradient>
    <linearGradient id="${pfx}gold" x1="0" y1="0" x2="0" y2="1">${stops([[0, '#fff3c8'], [0.5, GOLD], [1, GOLD_DEEP]])}</linearGradient>
    <linearGradient id="${pfx}shade" x1="0" y1="0" x2="1" y2="0.3">${stops([[0, '#fff', 0.12], [0.45, '#fff', 0], [1, DEEP, 0.38]])}</linearGradient>
    ${opts.blur ? `<filter id="${pfx}soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur in="SourceGraphic" stdDeviation="1.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>` : ''}`;

  const art = `<rect width="300" height="400" fill="url(#${pfx}bg)"/>
  <g fill="${t.hi}" opacity=".05">${rays}</g>
  ${card.rarity >= 6 ? astrolabe(t) : ''}
  ${starfield(card.id, 60, card.rarity >= 4 ? 7 : 4, t)}
  ${constellation(card.id)}
  <circle cx="${f(fx)}" cy="${f(fy + 10)}" r="130" fill="url(#${pfx}halo)"/>
  <ellipse cx="150" cy="356" rx="130" ry="26" fill="${t.light}" fill-opacity=".1"/>
  ${threads.behind}
  ${renderFigure(fig, t, card.attribute, pfx, opts.blur)}
  ${threads.front}`;

  return { defs, art, focus: fig.focus };
}

// ---------- 卡框零件 ----------

function attrBadge(attribute: Attribute, x: number, y: number, size: number, ringPaint: string): string {
  const t = TONES[attribute];
  const s = size / 100;
  return `<g transform="translate(${f(x)} ${f(y)}) scale(${s})">
    <circle cx="50" cy="50" r="48" fill="${DEEP}"/>
    <circle cx="50" cy="50" r="42" fill="${t.base}" stroke="${ringPaint}" stroke-width="9"/>
    <circle cx="50" cy="50" r="34" fill="${t.dark}" fill-opacity=".35"/>
    <path d="${ORB_SYMBOLS[attribute]}" fill="#fff" stroke="${t.dark}" stroke-width="5" stroke-linejoin="round" paint-order="stroke"/>
    <ellipse cx="38" cy="28" rx="16" ry="8" fill="#fff" fill-opacity=".3" transform="rotate(-25 38 28)"/>
  </g>`;
}

/** align=center 時 x 是中心；align=end 時 x 是最右邊（頭像左下角要留給等級） */
function starsRow(rarity: Rarity, x0: number, y: number, size: number, align: 'center' | 'end' = 'center'): string {
  const gap = size * 0.95;
  const start = align === 'center' ? x0 - ((rarity - 1) * gap) / 2 : x0 - size / 2 - (rarity - 1) * gap;
  let out = '';
  for (let i = 0; i < rarity; i++) {
    const x = start + i * gap;
    const r = size / 2;
    const p: string[] = [];
    for (let k = 0; k < 10; k++) {
      const a = -Math.PI / 2 + (k * Math.PI) / 5;
      const rr = k % 2 ? r * 0.45 : r;
      p.push(`${f(x + Math.cos(a) * rr)},${f(y + Math.sin(a) * rr)}`);
    }
    out += `<polygon points="${p.join(' ')}" fill="${GOLD}" stroke="#6b4c10" stroke-width="${f(size / 12)}" stroke-linejoin="round"/>`;
  }
  return out;
}

/** 四角星芒（4★ 以上，大小 8／11／14） */
function cornerSparkles(rarity: Rarity, w: number, h: number, inset: number, scale: number, color: string): string {
  if (rarity < 4) return '';
  const r = (rarity >= 6 ? 14 : rarity === 5 ? 11 : 8) * scale;
  return `<g fill="${color}">${[
    [inset, inset], [w - inset, inset], [inset, h - inset], [w - inset, h - inset],
  ].map(([x, y]) => sparkle(x, y, r, 0.2)).join('')}</g>`;
}

/** 卡框角飾：L 形金線＋菱形（3★ 以上） */
function cornerBrackets(w: number, h: number, inset: number, len: number, color: string, width: number): string {
  const d = [
    `M${inset} ${inset + len}V${inset}H${inset + len}`,
    `M${w - inset - len} ${inset}H${w - inset}V${inset + len}`,
    `M${inset} ${h - inset - len}V${h - inset}H${inset + len}`,
    `M${w - inset - len} ${h - inset}H${w - inset}V${h - inset - len}`,
  ].join('');
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round"/>`;
}

// ---------- 對外：頭像與立繪 ----------

/** 正方形頭像（背包、隊伍、戰鬥用）：從立繪臉部附近裁切 */
export function cardIconSvg(card: CardFaceInput): string {
  const pfx = `i${card.id}-`;
  const { defs, art, focus } = cardArt(card, pfx, { blur: false });
  const crop = card.race === 'material' ? 230 : 160;
  const x0 = Math.min(300 - crop, Math.max(0, focus[0] - crop / 2));
  const y0 = Math.min(400 - crop, Math.max(0, focus[1] - crop * 0.38));
  const glow = RARITY_FRAMES[card.rarity].glow;
  const light = RARITY_FRAMES[card.rarity].stops[0];
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escapeXml(card.name)}">
  <defs>${defs}${frameGradient(`${pfx}frame`, card.rarity)}
    <clipPath id="${pfx}clip"><rect x="3" y="3" width="94" height="94" rx="11"/></clipPath>
    <linearGradient id="${pfx}vig" x1="0" y1="0" x2="0" y2="1">${stops([[0.6, DEEP, 0], [1, DEEP, 0.75]])}</linearGradient>
  </defs>
  <rect x="2" y="2" width="96" height="96" rx="12" fill="${DEEP}"/>
  <g clip-path="url(#${pfx}clip)">
    <g transform="scale(${(100 / crop).toFixed(4)}) translate(${f(-x0)} ${f(-y0)})">${art}</g>
    <rect width="100" height="100" fill="url(#${pfx}vig)"/>
  </g>
  ${attrBadge(card.attribute, 5, 5, 22, `url(#${pfx}frame)`)}
  <g transform="translate(77 5)"><rect width="18" height="18" rx="5" fill="${DEEP}" fill-opacity=".78" stroke="${light}" stroke-opacity=".6"/><text x="9" y="13.6" text-anchor="middle" font-family="'Noto Serif TC',serif" font-weight="900" font-size="12" fill="#fff">${RACE_GLYPHS[card.race]}</text></g>
  ${starsRow(card.rarity, 94, 89, 8.5, 'end')}
  <rect x="3.5" y="3.5" width="93" height="93" rx="10.5" fill="none" stroke="${DEEP}" stroke-width="6"/>
  <rect x="3.5" y="3.5" width="93" height="93" rx="10.5" fill="none" stroke="url(#${pfx}frame)" stroke-width="4.5"/>
  ${glow ? `<rect x="6.5" y="6.5" width="87" height="87" rx="8" fill="none" stroke="${glow}" stroke-opacity=".75" stroke-width=".8"/>` : ''}
  ${cornerSparkles(card.rarity, 100, 100, 4, 0.42, light)}
</svg>`;
}

/** 直式立繪卡（卡片詳情、抽卡演出用），比例 3:4 */
export function cardPortraitSvg(card: CardFaceInput): string {
  const pfx = `p${card.id}-`;
  const W = 300;
  const H = 400;
  const t = TONES[card.attribute];
  const name = escapeXml(card.name);
  const { defs, art } = cardArt(card, pfx, { blur: true });
  const frame = RARITY_FRAMES[card.rarity];
  const light = frame.stops[0];
  const fp = `url(#${pfx}frame)`;
  const nameSize = [...card.name].length > 10 ? 18 : [...card.name].length > 8 ? 20 : 23;
  const orbit =
    card.rarity >= 5
      ? `<path d="M78 26Q150 4 222 26" fill="none" stroke="${light}" stroke-width="1.5" stroke-opacity=".9"/><g fill="${light}">${sparkle(150, 15, 7)}${sparkle(112, 19.5, 4.5)}${sparkle(188, 19.5, 4.5)}</g>`
      : '';
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${name}">
  <defs>${defs}${frameGradient(`${pfx}frame`, card.rarity)}
    <clipPath id="${pfx}clip"><rect x="5" y="5" width="${W - 10}" height="${H - 10}" rx="19"/></clipPath>
    <linearGradient id="${pfx}vig" x1="0" y1="0" x2="0" y2="1">${stops([[0, DEEP, 0.35], [0.12, DEEP, 0], [0.7, DEEP, 0], [1, DEEP, 0.85]])}</linearGradient>
    <linearGradient id="${pfx}plate" x1="0" y1="0" x2="0" y2="1">${stops([[0, mix(t.dark, DEEP, 0.55)], [1, DEEP]])}</linearGradient>
    <filter id="${pfx}fglow" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="4"/></filter>
  </defs>
  <rect x="4" y="4" width="${W - 8}" height="${H - 8}" rx="20" fill="${DEEP}"/>
  <g clip-path="url(#${pfx}clip)">${art}<rect width="${W}" height="${H}" fill="url(#${pfx}vig)"/></g>
  ${frame.glow ? `<rect x="12" y="12" width="${W - 24}" height="${H - 24}" rx="14" fill="none" stroke="${frame.glow}" stroke-width="5" stroke-opacity=".7" filter="url(#${pfx}fglow)"/>` : ''}
  ${card.rarity >= 3 ? `<rect x="14" y="14" width="${W - 28}" height="${H - 28}" rx="13" fill="none" stroke="${GOLD_SOFT}" stroke-opacity=".35" stroke-width="1"/>${cornerBrackets(W, H, 18, 26, light, 2)}` : ''}
  ${orbit}
  <path d="M30 318H270L286 351L270 384H30L14 351Z" fill="url(#${pfx}plate)" fill-opacity=".92" stroke="${fp}" stroke-width="2"/>
  <path d="M40 324H260L272 351L260 378H40L28 351Z" fill="none" stroke="${GOLD_SOFT}" stroke-opacity=".25"/>
  ${starsRow(card.rarity, 150, 320, 17)}
  <text x="150" y="${364 + (23 - nameSize) * 0.3}" text-anchor="middle" font-family="'Noto Serif TC',serif" font-size="${nameSize}" font-weight="900" fill="#fff" stroke="${DEEP}" stroke-width="4" paint-order="stroke" stroke-linejoin="round" letter-spacing="2">${name}</text>
  <text x="${W - 24}" y="304" text-anchor="end" font-size="11" fill="#fff" fill-opacity=".75" stroke="${DEEP}" stroke-width="3" paint-order="stroke">${ATTRIBUTE_NAMES[card.attribute]}屬性・No.${escapeXml(card.id)}</text>
  ${attrBadge(card.attribute, 14, 14, 44, fp)}
  <g transform="translate(${W - 74} 18)"><rect width="56" height="26" rx="13" fill="${DEEP}" fill-opacity=".82" stroke="${fp}" stroke-width="1.5"/><text x="28" y="18" text-anchor="middle" font-family="'Noto Serif TC',serif" font-weight="700" font-size="14" fill="#fff" letter-spacing="1">${RACE_NAMES[card.race]}</text></g>
  <rect x="5" y="5" width="${W - 10}" height="${H - 10}" rx="19" fill="none" stroke="${DEEP}" stroke-width="11"/>
  <rect x="5" y="5" width="${W - 10}" height="${H - 10}" rx="19" fill="none" stroke="${fp}" stroke-width="9"/>
  ${card.rarity >= 5 ? `<rect x="10" y="10" width="${W - 20}" height="${H - 20}" rx="15" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="1"/>` : ''}
  ${cornerSparkles(card.rarity, W, H, 9, 1, light)}
</svg>`;
}
