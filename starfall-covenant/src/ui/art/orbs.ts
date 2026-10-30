// 星紋珠：每種珠除了顏色，還有不同符號（照顧色弱玩家，GDD 2.6）
import type { OrbType } from '../../core/types';
import { ORB_COLORS } from './palette';
import { userAsset } from '../assets';

/** 符號只用形狀區分：焰＝火焰、潮＝水滴、森＝葉片、輝＝四芒星、蝕＝新月、心＝愛心 */
export const ORB_SYMBOLS: Record<OrbType, string> = {
  fire: 'M50 22c4 10 16 16 16 31a16 16 0 0 1-32 0c0-7 3-11 7-15 0 6 2 9 5 10-2-10 0-18 4-26z',
  water: 'M50 21c8 12 17 22 17 34a17 17 0 0 1-34 0c0-12 9-22 17-34z',
  wood: 'M30 70c0-25 14-40 42-44-2 28-17 42-42 44zm0 0 22-22',
  light: 'M50 20l7 23 23 7-23 7-7 23-7-23-23-7 23-7z',
  dark: 'M58 24a27 27 0 1 0 18 41 22 22 0 1 1-18-41z',
  heart: 'M50 74 27 51a13 13 0 0 1 23-17 13 13 0 0 1 23 17z',
};

export type OrbKind = OrbType | 'poison' | 'hidden';

export interface OrbOptions {
  /** 強化珠：外圈發光＋右上小星 */
  enhanced?: boolean;
  /** 鎖定珠：十字鎖鏈 */
  locked?: boolean;
}

const POISON = { base: '#5b3a6e', light: '#b48ccf', dark: '#2a1636' };
const HIDDEN = { base: '#2a2f4a', light: '#596089', dark: '#12152a' };
function orbTexture(kind: OrbKind, opts: OrbOptions): string | undefined {
  return userAsset('ui', `orb-${kind}${opts.enhanced ? '-enhanced' : ''}${opts.locked ? '-locked' : ''}`);
}
const POISON_SYMBOL = 'M50 26a18 17 0 0 0-18 17c0 7 3 11 7 13v8h22v-8c4-2 7-6 7-13a18 17 0 0 0-18-17zM42 44a4 4 0 1 0 0 .1zm16 0a4 4 0 1 0 0 .1zM44 64v6M50 64v6M56 64v6';

export function orbSvg(kind: OrbKind, opts: OrbOptions = {}): string {
  const texture = orbTexture(kind, opts);
  if (texture) return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" role="img"><image href="${texture}" width="100" height="100"/></svg>`;
  const c = kind === 'poison' ? POISON : kind === 'hidden' ? HIDDEN : ORB_COLORS[kind];
  const symbol = kind === 'poison' ? POISON_SYMBOL : kind === 'hidden' ? '' : ORB_SYMBOLS[kind];
  const id = `orb-${kind}${opts.enhanced ? '-e' : ''}`;
  const isStroke = kind === 'wood' || kind === 'poison';
  const parts: string[] = [];
  parts.push(`<defs>
    <radialGradient id="${id}-g" cx="38%" cy="32%" r="70%">
      <stop offset="0" stop-color="${c.light}"/><stop offset=".55" stop-color="${c.base}"/><stop offset="1" stop-color="${c.dark}"/>
    </radialGradient>
  </defs>`);
  if (opts.enhanced) {
    parts.push(`<circle cx="50" cy="50" r="48" fill="none" stroke="#fff6d8" stroke-width="3" stroke-dasharray="6 5" opacity=".9"/>`);
  }
  parts.push(`<circle cx="50" cy="50" r="42" fill="url(#${id}-g)" stroke="${c.dark}" stroke-width="3"/>`);
  if (symbol) {
    // 白色符號＋深色描邊，任何底色都看得清楚
    parts.push(
      isStroke
        ? `<path d="${symbol}" fill="#fff" fill-opacity=".92" stroke="${c.dark}" stroke-width="3" stroke-linejoin="round"/>`
        : `<path d="${symbol}" fill="#fff" fill-opacity=".92" stroke="${c.dark}" stroke-width="2.5" stroke-linejoin="round"/>`,
    );
  } else {
    parts.push(`<text x="50" y="62" text-anchor="middle" font-size="34" font-weight="700" fill="${c.light}">?</text>`);
  }
  parts.push(`<ellipse cx="36" cy="28" rx="13" ry="7" fill="#fff" opacity=".35" transform="rotate(-25 36 28)"/>`);
  if (opts.enhanced) {
    parts.push(`<path d="M80 6l3.5 9 9 3.5-9 3.5L80 31l-3.5-9-9-3.5 9-3.5z" fill="#fff6d8" stroke="#a0700f" stroke-width="1.5"/>`);
  }
  if (opts.locked) {
    parts.push(`<g stroke="#d8dbe6" stroke-width="5" stroke-linecap="round" opacity=".9"><path d="M18 18 82 82M82 18 18 82"/></g>
      <rect x="40" y="40" width="20" height="18" rx="3" fill="#596089" stroke="#d8dbe6" stroke-width="2.5"/>`);
  }
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" role="img">${parts.join('')}</svg>`;
}

/** 給 Canvas 用：轉成可直接 drawImage 的 data URL */
export function orbDataUrl(kind: OrbKind, opts: OrbOptions = {}): string {
  const texture = orbTexture(kind, opts);
  if (texture) return texture;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(orbSvg(kind, opts))}`;
}
