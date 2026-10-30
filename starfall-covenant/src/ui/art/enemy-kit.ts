// 敵人造型的共用零件：配色、漸層、描邊、晶體裂紋、發光眼、Boss 頭冠與光環、屬性粒子
// 風格指南第 7 節：被星骸侵蝕的生物，身上一定有發光的晶體裂紋；Boss 有專屬頭冠或光環
import type { Attribute } from '../../core/types';
import { ORB_COLORS } from './palette';
import { rngFor } from './seed';

export type Pt = [number, number];

/** 屬性五階色（暗部／中間／亮部／高光／特效核心，見風格指南 1.2）＋眼睛發光色 */
export interface Tones {
  dark: string;
  base: string;
  light: string;
  hi: string;
  core: string;
  glow: string;
}

const EXTRA: Record<Attribute, Pick<Tones, 'hi' | 'core' | 'glow'>> = {
  fire: { hi: '#ffe3c4', core: '#fff4d6', glow: '#ffd45e' },
  water: { hi: '#dff1ff', core: '#f2fbff', glow: '#86f3ff' },
  wood: { hi: '#e4ffd9', core: '#f6fff0', glow: '#dcff6e' },
  light: { hi: '#fffbe8', core: '#ffffff', glow: '#fff6b0' },
  dark: { hi: '#f1e4ff', core: '#ffd6ff', glow: '#ff7ae0' },
};

export function tonesOf(attribute: Attribute): Tones {
  return { ...ORB_COLORS[attribute], ...EXTRA[attribute] };
}

/** 描邊色：所有敵人共用同一種近黑的深靛，縮小到 60px 時輪廓仍清楚 */
export const INK = '#140f26';
const GOLD = { deep: '#b98a2a', base: '#f2c45a', soft: '#f7dc98' };

export class Kit {
  readonly t: Tones;
  readonly rng: ReturnType<typeof rngFor>;
  /** 星骸晶體色：蝕屬敵人用桃紅，其餘用星骸紫，確保與身體色區隔 */
  readonly crystal: string;
  readonly crystalCore: string;
  private defs = new Map<string, string>();

  constructor(
    readonly uid: string,
    readonly attribute: Attribute,
    readonly boss: boolean,
  ) {
    this.t = tonesOf(attribute);
    this.rng = rngFor(`enemy:${uid}`);
    this.crystal = attribute === 'dark' ? '#ff8ae6' : '#c792ff';
    this.crystalCore = attribute === 'dark' ? '#fff0fb' : '#f6ecff';
    const { t } = this;
    this.rad('b', [t.light, t.base, t.dark], '38%', '30%');
    this.lin('s', [t.base, t.dark]);
    this.lin('d', [t.dark, '#0d0a1e']);
    this.lin('x', [this.crystalCore, this.crystal, attribute === 'dark' ? '#a8308f' : '#6b3fb8']);
    this.lin('g', [GOLD.soft, GOLD.base, GOLD.deep]);
    this.rad('a', [t.base, t.base], '50%', '50%', [0.5, 0]);
    this.defs.set('glow', `<filter id="${uid}-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`);
    this.defs.set('blur', `<filter id="${uid}-blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>`);
  }

  // ---------- 填色 ----------
  /** 身體主色（左上亮、右下暗的徑向漸層） */
  get B(): string { return `url(#${this.uid}-b)`; }
  /** 身體陰影面（中間→暗部） */
  get S(): string { return `url(#${this.uid}-s)`; }
  /** 遠側肢體（暗部→近黑） */
  get D(): string { return `url(#${this.uid}-d)`; }
  /** 星骸晶體 */
  get X(): string { return `url(#${this.uid}-x)`; }
  /** 星光金 */
  get G(): string { return `url(#${this.uid}-g)`; }

  /** 自訂直向漸層，回傳 url(#…) */
  lin(name: string, stops: string[], horizontal = false): string {
    const id = `${this.uid}-${name}`;
    if (!this.defs.has(name)) {
      const dir = horizontal ? 'x1="0" y1="0" x2="1" y2="0"' : 'x1="0" y1="0" x2="0" y2="1"';
      this.defs.set(name, `<linearGradient id="${id}" ${dir}>${stopTags(stops)}</linearGradient>`);
    }
    return `url(#${id})`;
  }

  /** 自訂徑向漸層，回傳 url(#…) */
  rad(name: string, stops: string[], cx = '40%', cy = '35%', opacity?: number[]): string {
    const id = `${this.uid}-${name}`;
    if (!this.defs.has(name)) {
      this.defs.set(name, `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="70%">${stopTags(stops, opacity)}</radialGradient>`);
    }
    return `url(#${id})`;
  }

  defsSvg(): string {
    return [...this.defs.values()].join('');
  }

  // ---------- 基本形 ----------
  /** 有描邊的形狀 */
  p(d: string, fill = this.B, sw = 2.2, extra = ''): string {
    return `<path d="${d}" fill="${fill}" stroke="${INK}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round"${extra ? ` ${extra}` : ''}/>`;
  }

  /** 無描邊的形狀（陰影、亮面、霧） */
  f(d: string, fill: string, opacity = 1, extra = ''): string {
    return `<path d="${d}" fill="${fill}"${opacity < 1 ? ` opacity="${opacity}"` : ''}${extra ? ` ${extra}` : ''}/>`;
  }

  /** 線條 */
  l(d: string, color = INK, w = 2, extra = ''): string {
    return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${extra ? ` ${extra}` : ''}/>`;
  }

  e(cx: number, cy: number, rx: number, ry: number, fill = this.B, sw = 2.2, extra = ''): string {
    return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}"${sw > 0 ? ` stroke="${INK}" stroke-width="${sw}"` : ''}${extra ? ` ${extra}` : ''}/>`;
  }

  /** 包一層群組（例如位移、透明度、濾鏡） */
  g(attrs: string, ...children: string[]): string {
    return `<g ${attrs}>${children.join('')}</g>`;
  }

  get glowAttr(): string { return `filter="url(#${this.uid}-glow)"`; }
  get blurAttr(): string { return `filter="url(#${this.uid}-blur)"`; }

  // ---------- 星骸識別 ----------
  /** 發光的晶體裂紋：外層晶體色＋內層白芯 */
  crack(...lines: Pt[][]): string {
    const ds = lines.map((pts) => `M${pts.map(([x, y]) => `${x} ${y}`).join('L')}`).join('');
    return this.g(this.glowAttr, this.l(ds, this.crystal, 2.2), this.l(ds, this.crystalCore, 0.8));
  }

  /** 由身上長出的晶體碎片：長六角柱，角度以度計（0 = 朝上） */
  shard(x: number, y: number, h: number, angle = 0, w = h * 0.38): string {
    const d = `M0 ${-h}L${w} ${-h * 0.62}L${w * 0.8} 0L${-w * 0.8} 0L${-w} ${-h * 0.62}Z`;
    return this.g(
      `transform="translate(${x} ${y}) rotate(${angle})"`,
      this.p(d, this.X, 1.4),
      this.l(`M${-w * 0.25} ${-h * 0.15}L${-w * 0.4} ${-h * 0.75}`, '#fff', 1, 'opacity=".8"'),
    );
  }

  /** 一叢晶體（2–3 根） */
  cluster(x: number, y: number, h: number, angle = 0): string {
    return this.shard(x - h * 0.3, y, h * 0.7, angle - 24) + this.shard(x + h * 0.3, y, h * 0.6, angle + 22) + this.shard(x, y, h, angle);
  }

  /** 發光眼：外光暈＋亮核；slit 為縱向瞳孔，angry 加怒眉 */
  eye(cx: number, cy: number, r: number, o: { slit?: boolean; angry?: -1 | 1; color?: string } = {}): string {
    const color = o.color ?? this.t.glow;
    const parts = [
      `<ellipse cx="${cx}" cy="${cy}" rx="${r * 1.9}" ry="${r * 1.5}" fill="${color}" opacity=".28" ${this.blurAttr}/>`,
      `<ellipse cx="${cx}" cy="${cy}" rx="${r}" ry="${r * 0.82}" fill="${color}" stroke="${INK}" stroke-width="${Math.max(1, r * 0.3)}"/>`,
      `<ellipse cx="${cx - r * 0.2}" cy="${cy - r * 0.15}" rx="${r * 0.45}" ry="${r * 0.38}" fill="#fff"/>`,
    ];
    if (o.slit) parts.push(`<ellipse cx="${cx}" cy="${cy}" rx="${r * 0.2}" ry="${r * 0.7}" fill="${INK}"/>`);
    if (o.angry) {
      const s = o.angry;
      parts.push(this.l(`M${cx - r * 1.3 * s} ${cy - r * 1.5}L${cx + r * 1.2 * s} ${cy - r * 0.7}`, INK, Math.max(1.6, r * 0.5)));
    }
    return parts.join('');
  }

  /** 尖牙：一排三角形 */
  fangs(x1: number, x2: number, y: number, n: number, h: number, up = false): string {
    const w = (x2 - x1) / n;
    let d = '';
    for (let i = 0; i < n; i++) {
      const a = x1 + i * w;
      d += `M${a} ${y}L${a + w / 2} ${y + (up ? -h : h)}L${a + w} ${y}Z`;
    }
    return this.p(d, '#fff6e6', 1);
  }

  /** 齒輪 */
  gear(cx: number, cy: number, r: number, teeth: number, fill = this.B, rot = 0): string {
    const pts: string[] = [];
    for (let i = 0; i < teeth * 2; i++) {
      const a = ((i + 0.5) / (teeth * 2)) * Math.PI * 2 + (rot * Math.PI) / 180;
      const rr = i % 2 === 0 ? r : r * 0.78;
      const a1 = a - Math.PI / (teeth * 2) * 0.55;
      const a2 = a + Math.PI / (teeth * 2) * 0.55;
      pts.push(`${(cx + Math.cos(a1) * rr).toFixed(1)} ${(cy + Math.sin(a1) * rr).toFixed(1)}`);
      pts.push(`${(cx + Math.cos(a2) * rr).toFixed(1)} ${(cy + Math.sin(a2) * rr).toFixed(1)}`);
    }
    return this.p(`M${pts.join('L')}Z`, fill, 1.6) + this.e(cx, cy, r * 0.32, r * 0.32, INK, 0) + this.e(cx, cy, r * 0.16, r * 0.16, this.t.glow, 0);
  }

  /** 腳：由 top 往下到地面，腳掌朝左 */
  leg(x: number, top: number, bottom: number, w: number, fill = this.B, paw = true): string {
    const h = w / 2;
    const d = paw
      ? `M${x - h} ${top}L${x - h * 0.8} ${bottom - 3}Q${x - h - 4} ${bottom - 1} ${x - h - 2} ${bottom}L${x + h} ${bottom}L${x + h * 0.9} ${top}Z`
      : `M${x - h} ${top}L${x - h * 0.6} ${bottom}L${x + h * 0.6} ${bottom}L${x + h} ${top}Z`;
    return this.p(d, fill, 2);
  }

  // ---------- Boss ----------
  /** 星金頭冠：5 尖、中央鑲晶體，s 為縮放 */
  crown(x: number, y: number, s = 1, tilt = 0): string {
    const d = 'M-14 0L-16 -12L-9 -6L-5 -17L0 -8L5 -17L9 -6L16 -12L14 0Z';
    return this.g(
      `transform="translate(${x} ${y}) rotate(${tilt}) scale(${s})"`,
      this.p(d, this.G, 1.6),
      this.l('M-13 -2L13 -2', '#6b4c10', 1.2),
      `<path d="M0 -10L2.4 -5L0 -1L-2.4 -5Z" fill="${this.crystal}" stroke="${INK}" stroke-width="1"/>`,
      `<circle cx="-5" cy="-17" r="1.6" fill="${GOLD.soft}"/><circle cx="5" cy="-17" r="1.6" fill="${GOLD.soft}"/>`,
    );
  }

  /** 身後的星環：金色細圈＋四顆星芒（Boss 用） */
  halo(cx: number, cy: number, r: number): string {
    const stars = [0, 90, 180, 270].map((deg) => {
      const a = ((deg - 45) * Math.PI) / 180;
      return starPath(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 4.5);
    }).join('');
    return this.g(
      'opacity=".85"',
      `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${GOLD.base}" stroke-width="1.6" stroke-dasharray="2 3"/>`,
      `<circle cx="${cx}" cy="${cy}" r="${r - 5}" fill="none" stroke="${this.crystal}" stroke-width=".8" opacity=".7"/>`,
      `<path d="${stars}" fill="${GOLD.soft}"/>`,
    );
  }

  // ---------- 屬性材質粒子（焰＝火星、潮＝水泡、森＝葉片、輝＝光塵、蝕＝墨霧） ----------
  particles(n: number, box: [number, number, number, number] = [8, 8, 112, 100]): string {
    const [x1, y1, x2, y2] = box;
    const out: string[] = [];
    for (let i = 0; i < n; i++) {
      const x = +(x1 + this.rng.next() * (x2 - x1)).toFixed(1);
      const y = +(y1 + this.rng.next() * (y2 - y1)).toFixed(1);
      const s = 1.4 + this.rng.next() * 2;
      const op = (0.5 + this.rng.next() * 0.45).toFixed(2);
      switch (this.attribute) {
        case 'fire':
          out.push(`<path d="M${x} ${y - s * 1.6}L${x + s * 0.6} ${y}L${x} ${y + s * 0.8}L${x - s * 0.6} ${y}Z" fill="${i % 2 ? this.t.glow : this.t.light}" opacity="${op}"/>`);
          break;
        case 'water':
          out.push(`<circle cx="${x}" cy="${y}" r="${s}" fill="${this.t.hi}" fill-opacity=".2" stroke="${this.t.hi}" stroke-width=".8" opacity="${op}"/>`);
          break;
        case 'wood':
          out.push(`<path d="M${x - s * 1.4} ${y}Q${x} ${y - s * 1.3} ${x + s * 1.4} ${y}Q${x} ${y + s * 1.3} ${x - s * 1.4} ${y}Z" fill="${this.t.light}" transform="rotate(${Math.round(this.rng.next() * 180)} ${x} ${y})" opacity="${op}"/>`);
          break;
        case 'light':
          out.push(`<path d="${starPath(x, y, s * 1.3)}" fill="${this.t.hi}" opacity="${op}"/>`);
          break;
        case 'dark':
          out.push(`<ellipse cx="${x}" cy="${y}" rx="${s * 2.6}" ry="${s * 1.4}" fill="#2a1450" opacity="${op}" ${this.blurAttr}/>`);
          break;
      }
    }
    return out.join('');
  }
}

/** 四芒星 */
export function starPath(x: number, y: number, r: number): string {
  const k = r * 0.28;
  return `M${x} ${y - r}L${x + k} ${y - k}L${x + r} ${y}L${x + k} ${y + k}L${x} ${y + r}L${x - k} ${y + k}L${x - r} ${y}L${x - k} ${y - k}Z`;
}

/** n 芒星（e0040 胸口的七曜星紋） */
export function polyStar(x: number, y: number, r: number, inner: number, n: number, rot = -90): string {
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = ((rot + (i * 180) / n) * Math.PI) / 180;
    const rr = i % 2 === 0 ? r : inner;
    pts.push(`${(x + Math.cos(a) * rr).toFixed(1)} ${(y + Math.sin(a) * rr).toFixed(1)}`);
  }
  return `M${pts.join('L')}Z`;
}

function stopTags(stops: string[], opacity?: number[]): string {
  return stops
    .map((c, i) => {
      const off = stops.length === 1 ? 0 : i / (stops.length - 1);
      const op = opacity?.[i];
      return `<stop offset="${off.toFixed(2)}" stop-color="${c}"${op !== undefined ? ` stop-opacity="${op}"` : ''}/>`;
    })
    .join('');
}
