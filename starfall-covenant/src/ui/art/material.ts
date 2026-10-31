// 素材卡的程式繪製圖示（提案 105）：星核依屬性換色，星輝結晶是完全不同的三柱晶簇。
// 全部是靜態 SVG（低特效一樣清楚），不需要圖片檔；比使用者素材優先，因為「物品」用角色立繪會看不懂。
import type { CardDef } from '../../core/types';
import { ORB_COLORS, RARITY_FRAMES } from './palette';
import { ORB_SYMBOLS } from './orbs';
import { escapeXml } from './seed';

export type MaterialKind = 'core' | 'crystal';

type MaterialInput = Pick<CardDef, 'id' | 'name' | 'attribute' | 'race' | 'rarity'>;

/** 哪些素材卡用程式繪製的圖示：名字以「星核」結尾的是星核，「星輝結晶」是結晶；其他（塵靈）沿用卡面 */
export function materialKind(card: MaterialInput): MaterialKind | null {
  if (card.race !== 'material') return null;
  if (card.name.endsWith('星核')) return 'core';
  if (card.name.includes('結晶')) return 'crystal';
  return null;
}

function frame(uid: string, card: MaterialInput): { defs: string; stroke: string } {
  const { stops } = RARITY_FRAMES[card.rarity];
  const s = stops.map((c, i) => `<stop offset="${(i / (stops.length - 1)).toFixed(2)}" stop-color="${c}"/>`).join('');
  return { defs: `<linearGradient id="mf-${uid}" x1="0" y1="0" x2="1" y2="1">${s}</linearGradient>`, stroke: `url(#mf-${uid})` };
}

/** 星核：多面的核心寶石＋外圈軌道＋中間的屬性符號（色弱也分得出屬性） */
function coreBody(uid: string, card: MaterialInput): string {
  const c = ORB_COLORS[card.attribute];
  return `<defs>
      <radialGradient id="mc-${uid}" cx="42%" cy="36%" r="70%"><stop offset="0" stop-color="${c.light}"/><stop offset=".55" stop-color="${c.base}"/><stop offset="1" stop-color="${c.dark}"/></radialGradient>
      <radialGradient id="mg-${uid}" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="${c.light}" stop-opacity=".7"/><stop offset="1" stop-color="${c.light}" stop-opacity="0"/></radialGradient>
    </defs>
    <circle cx="50" cy="52" r="40" fill="url(#mg-${uid})"/>
    <ellipse cx="50" cy="54" rx="40" ry="13" fill="none" stroke="${c.light}" stroke-width="2" stroke-opacity=".7" transform="rotate(-18 50 54)"/>
    <path d="M50 14 L76 40 L66 78 L34 78 L24 40 Z" fill="url(#mc-${uid})" stroke="${c.dark}" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M50 14 L60 42 L50 78 L40 42 Z M24 40 L60 42 M76 40 L40 42" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="1.5"/>
    <g transform="translate(35 31) scale(.3)"><path d="${ORB_SYMBOLS[card.attribute]}" fill="#fff" fill-opacity=".95" stroke="${c.dark}" stroke-width="5" stroke-linejoin="round"/></g>
    <circle cx="84" cy="40" r="3" fill="#fff"/>`;
}

/** 星輝結晶：三柱稜晶的晶簇，七彩漸層＋閃光，和星核的單顆寶石形狀完全不同 */
function crystalBody(uid: string): string {
  const prism = (x: number, y: number, w: number, hgt: number, grad: string) =>
    `<path d="M${x} ${y + hgt} L${x} ${y + w * 0.6} L${x + w / 2} ${y} L${x + w} ${y + w * 0.6} L${x + w} ${y + hgt} Z" fill="url(#${grad})" stroke="#2a2550" stroke-width="2" stroke-linejoin="round"/>
     <path d="M${x + w / 2} ${y} L${x + w / 2} ${y + hgt}" stroke="#fff" stroke-opacity=".45" stroke-width="1.5"/>`;
  return `<defs>
      <linearGradient id="ma-${uid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff6d8"/><stop offset=".45" stop-color="#9fe3ff"/><stop offset="1" stop-color="#9b7bff"/></linearGradient>
      <linearGradient id="mb-${uid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffd6ea"/><stop offset=".5" stop-color="#c792ff"/><stop offset="1" stop-color="#5a3fb0"/></linearGradient>
      <linearGradient id="md-${uid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e8fff1"/><stop offset=".5" stop-color="#7ff0d0"/><stop offset="1" stop-color="#3f8ee8"/></linearGradient>
      <radialGradient id="mh-${uid}" cx="50%" cy="60%" r="50%"><stop offset="0" stop-color="#fff6d8" stop-opacity=".6"/><stop offset="1" stop-color="#fff6d8" stop-opacity="0"/></radialGradient>
    </defs>
    <ellipse cx="50" cy="80" rx="34" ry="8" fill="#060a1f" fill-opacity=".5"/>
    <circle cx="50" cy="58" r="38" fill="url(#mh-${uid})"/>
    ${prism(22, 38, 18, 42, `mb-${uid}`)}
    ${prism(58, 34, 18, 46, `md-${uid}`)}
    ${prism(38, 14, 24, 66, `ma-${uid}`)}
    <path d="M78 14l2.5 6.5 6.5 2.5-6.5 2.5L78 32l-2.5-6.5L69 23l6.5-2.5z" fill="#fff6d8" stroke="#a0700f" stroke-width="1"/>
    <path d="M20 26l1.5 4 4 1.5-4 1.5-1.5 4-1.5-4-4-1.5 4-1.5z" fill="#fff"/>`;
}

/** 正方形圖示（縮圖、清單、獎勵用）；不是這兩種素材回傳 null */
export function materialIconSvg(card: MaterialInput): string | null {
  const kind = materialKind(card);
  if (!kind) return null;
  const uid = escapeXml(card.id);
  const f = frame(uid, card);
  const glow = RARITY_FRAMES[card.rarity].glow;
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escapeXml(card.name)}">
  <defs>${f.defs}</defs>
  <rect x="2" y="2" width="96" height="96" rx="12" fill="#10142e"/>
  <rect x="2" y="2" width="96" height="96" rx="12" fill="${kind === 'core' ? ORB_COLORS[card.attribute].dark : '#2a2550'}" fill-opacity=".55"/>
  ${kind === 'core' ? coreBody(uid, card) : crystalBody(uid)}
  <rect x="3" y="3" width="94" height="94" rx="11" fill="none" stroke="${f.stroke}" stroke-width="5"/>
  ${glow ? `<rect x="3" y="3" width="94" height="94" rx="11" fill="none" stroke="${glow}" stroke-opacity=".5" stroke-width="1"/>` : ''}
</svg>`;
}

/** 直式大圖（卡片詳情用，3:4）：同一個圖示放大置中，下方寫名字 */
export function materialPortraitSvg(card: MaterialInput): string | null {
  const kind = materialKind(card);
  if (!kind) return null;
  const uid = `p-${escapeXml(card.id)}`;
  const f = frame(uid, card);
  const name = escapeXml(card.name);
  return `<svg viewBox="0 0 300 400" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${name}">
  <defs>${f.defs}</defs>
  <rect x="4" y="4" width="292" height="392" rx="20" fill="#10142e"/>
  <rect x="4" y="4" width="292" height="392" rx="20" fill="${kind === 'core' ? ORB_COLORS[card.attribute].dark : '#2a2550'}" fill-opacity=".55"/>
  <g transform="translate(40 50) scale(2.2)">${kind === 'core' ? coreBody(uid, card) : crystalBody(uid)}</g>
  <rect x="16" y="308" width="268" height="76" rx="12" fill="#060a1f" fill-opacity=".78" stroke="${f.stroke}" stroke-width="1.5"/>
  <text x="150" y="356" text-anchor="middle" font-family="'Noto Serif TC',serif" font-size="26" font-weight="700" fill="#fff" letter-spacing="3">${name}</text>
  <rect x="6" y="6" width="288" height="388" rx="18" fill="none" stroke="${f.stroke}" stroke-width="6"/>
</svg>`;
}
