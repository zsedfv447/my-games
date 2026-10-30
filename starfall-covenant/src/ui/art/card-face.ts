// 程式產生的卡面：屬性底色＋稀有度卡框＋專屬星座圖樣＋名字（GDD 2.6，正式立繪來之前的替代品）
import type { Attribute, CardDef, Race, Rarity } from '../../core/types';
import { ATTRIBUTE_NAMES, ORB_COLORS, RACE_NAMES, RARITY_FRAMES } from './palette';
import { ORB_SYMBOLS } from './orbs';
import { escapeXml, rngFor } from './seed';

/** 卡面只需要這些欄位，方便還沒有完整資料時預覽 */
export type CardFaceInput = Pick<CardDef, 'id' | 'name' | 'attribute' | 'race' | 'rarity'>;

const RACE_GLYPHS: Record<Race, string> = {
  beast: '獸', dragon: '龍', machina: '機', sylph: '靈', nether: '冥', human: '人', material: '材',
};

function frameGradient(id: string, rarity: Rarity): string {
  const { stops } = RARITY_FRAMES[rarity];
  const s = stops.map((c, i) => `<stop offset="${(i / (stops.length - 1)).toFixed(2)}" stop-color="${c}"/>`).join('');
  return `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">${s}</linearGradient>`;
}

function bgGradient(id: string, attribute: Attribute): string {
  const c = ORB_COLORS[attribute];
  return `<radialGradient id="${id}" cx="50%" cy="30%" r="85%">
    <stop offset="0" stop-color="${c.base}"/><stop offset=".6" stop-color="${c.dark}"/><stop offset="1" stop-color="#060a1f"/>
  </radialGradient>`;
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

function constellation(cardId: string, w: number, h: number, margin: number, scale: number): string {
  const pts = constellationPoints(cardId, w, h, margin);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join('');
  const stars = pts
    .map(([x, y], i) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${((i % 3 ? 1.6 : 2.6) * scale).toFixed(1)}" fill="#fff"/>`)
    .join('');
  return `<path d="${line}" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="${scale}"/>${stars}`;
}

function dust(key: string, w: number, h: number, count: number): string {
  const rng = rngFor(`dust:${key}`);
  let out = '';
  for (let i = 0; i < count; i++) {
    out += `<circle cx="${(rng.next() * w).toFixed(1)}" cy="${(rng.next() * h).toFixed(1)}" r="${(0.4 + rng.next() * 0.9).toFixed(2)}" fill="#fff" opacity="${(0.25 + rng.next() * 0.5).toFixed(2)}"/>`;
  }
  return out;
}

function attrBadge(attribute: Attribute, x: number, y: number, size: number): string {
  const c = ORB_COLORS[attribute];
  const s = size / 100;
  return `<g transform="translate(${x} ${y}) scale(${s})">
    <circle cx="50" cy="50" r="46" fill="${c.base}" stroke="#fff" stroke-width="7"/>
    <path d="${ORB_SYMBOLS[attribute]}" fill="#fff" stroke="${c.dark}" stroke-width="4"/>
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
      p.push(`${(x + Math.cos(a) * rr).toFixed(1)},${(y + Math.sin(a) * rr).toFixed(1)}`);
    }
    out += `<polygon points="${p.join(' ')}" fill="#f2c45a" stroke="#6b4c10" stroke-width="${(size / 12).toFixed(1)}"/>`;
  }
  return out;
}

/** 名字的代表字：取第一個字（「・」分隔時取第二段的第一字） */
export function nameGlyph(name: string): string {
  const parts = name.split(/[・·\s]/).filter(Boolean);
  const pick = parts.length > 1 ? parts[parts.length - 1] : name;
  return [...(pick || '?')][0];
}

/** 正方形頭像（背包、隊伍、戰鬥用） */
export function cardIconSvg(card: CardFaceInput): string {
  const uid = card.id;
  const glow = RARITY_FRAMES[card.rarity].glow;
  const glyph = escapeXml(nameGlyph(card.name));
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escapeXml(card.name)}">
  <defs>${frameGradient(`fi-${uid}`, card.rarity)}${bgGradient(`bi-${uid}`, card.attribute)}</defs>
  <rect x="2" y="2" width="96" height="96" rx="12" fill="url(#bi-${uid})"/>
  ${dust(uid, 100, 100, 14)}
  ${constellation(uid, 100, 100, 18, 0.7)}
  <text x="50" y="66" text-anchor="middle" font-family="'Noto Serif TC',serif" font-size="44" font-weight="900" fill="#fff" stroke="#060a1f" stroke-width="3" paint-order="stroke">${glyph}</text>
  ${attrBadge(card.attribute, 5, 5, 22)}
  <g transform="translate(78 5)"><rect width="17" height="17" rx="4" fill="#060a1f" fill-opacity=".7"/><text x="8.5" y="13.2" text-anchor="middle" font-size="12" fill="#fff">${RACE_GLYPHS[card.race]}</text></g>
  ${starsRow(card.rarity, 93, 89, 8, 'end')}
  <rect x="3" y="3" width="94" height="94" rx="11" fill="none" stroke="url(#fi-${uid})" stroke-width="5"/>
  ${glow ? `<rect x="3" y="3" width="94" height="94" rx="11" fill="none" stroke="${glow}" stroke-opacity=".5" stroke-width="1"/>` : ''}
</svg>`;
}

/** 直式立繪卡（卡片詳情、抽卡演出用），比例 3:4 */
export function cardPortraitSvg(card: CardFaceInput): string {
  const uid = card.id;
  const W = 300;
  const H = 400;
  const c = ORB_COLORS[card.attribute];
  const glyph = escapeXml(nameGlyph(card.name));
  const name = escapeXml(card.name);
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${name}">
  <defs>${frameGradient(`fp-${uid}`, card.rarity)}${bgGradient(`bp-${uid}`, card.attribute)}
    <radialGradient id="halo-${uid}" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="${c.light}" stop-opacity=".55"/><stop offset="1" stop-color="${c.light}" stop-opacity="0"/></radialGradient>
  </defs>
  <rect x="4" y="4" width="${W - 8}" height="${H - 8}" rx="20" fill="url(#bp-${uid})"/>
  ${dust(uid, W, H, 70)}
  <circle cx="150" cy="170" r="120" fill="url(#halo-${uid})"/>
  <g fill="none" stroke="#fff" stroke-opacity=".18"><circle cx="150" cy="170" r="96"/><circle cx="150" cy="170" r="70" stroke-dasharray="3 6"/></g>
  <text x="150" y="215" text-anchor="middle" font-family="'Noto Serif TC',serif" font-size="130" font-weight="900" fill="#fff" fill-opacity=".14">${glyph}</text>
  <g transform="translate(20 40)">${constellation(uid, 260, 260, 26, 1.6)}</g>
  ${attrBadge(card.attribute, 16, 16, 40)}
  <g transform="translate(${W - 64} 16)"><rect width="48" height="26" rx="13" fill="#060a1f" fill-opacity=".75" stroke="#fff" stroke-opacity=".3"/><text x="24" y="18" text-anchor="middle" font-size="14" fill="#fff">${RACE_NAMES[card.race]}</text></g>
  <rect x="16" y="${H - 92}" width="${W - 32}" height="76" rx="12" fill="#060a1f" fill-opacity=".78" stroke="url(#fp-${uid})" stroke-width="1.5"/>
  ${starsRow(card.rarity, 150, H - 74, 16)}
  <text x="150" y="${H - 34}" text-anchor="middle" font-family="'Noto Serif TC',serif" font-size="24" font-weight="700" fill="#fff" letter-spacing="3">${name}</text>
  <text x="${W - 22}" y="${H - 102}" text-anchor="end" font-size="11" fill="#fff" fill-opacity=".6">${ATTRIBUTE_NAMES[card.attribute]}屬性・No.${escapeXml(card.id)}</text>
  <rect x="5" y="5" width="${W - 10}" height="${H - 10}" rx="19" fill="none" stroke="url(#fp-${uid})" stroke-width="9"/>
</svg>`;
}
