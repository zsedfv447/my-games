// 程式產生美術共用的配色（與 theme.css 的 CSS 變數一致；SVG 轉成圖片時讀不到 CSS 變數，所以另存一份）
import type { Attribute, OrbType, Race, Rarity } from '../../core/types';

export const ORB_COLORS: Record<OrbType, { base: string; light: string; dark: string }> = {
  fire: { base: '#e8553f', light: '#ffb199', dark: '#8f2414' },
  water: { base: '#3f8ee8', light: '#a8d4ff', dark: '#163f8a' },
  wood: { base: '#4cbf6a', light: '#b5f2c4', dark: '#1d6634' },
  light: { base: '#f2c45a', light: '#fff1c2', dark: '#a0700f' },
  dark: { base: '#9b5de5', light: '#dcc0ff', dark: '#4a2183' },
  heart: { base: '#ff8fc1', light: '#ffd6ea', dark: '#b03c78' },
};

export const ATTRIBUTE_NAMES: Record<Attribute, string> = {
  fire: '焰', water: '潮', wood: '森', light: '輝', dark: '蝕',
};
export const ORB_NAMES: Record<OrbType, string> = { ...ATTRIBUTE_NAMES, heart: '心' };

export const RACE_NAMES: Record<Race, string> = {
  beast: '獸裔', dragon: '龍嗣', machina: '機構', sylph: '靈仙', nether: '冥裔', human: '人傑', material: '素材',
};

export const RARITY_FRAMES: Record<Rarity, { stops: string[]; glow?: string }> = {
  1: { stops: ['#a5a9b4', '#6b6f7a', '#a5a9b4'] },
  2: { stops: ['#c08a5a', '#7a4f2c', '#c08a5a'] },
  3: { stops: ['#e6edf8', '#8d99ad', '#e6edf8'] },
  4: { stops: ['#fff0b8', '#c9952e', '#fff0b8'], glow: '#f2c45a' },
  5: { stops: ['#f1dcff', '#9b5de5', '#6fd6ff', '#f1dcff'], glow: '#c792ff' },
  6: { stops: ['#ffd1e8', '#ff8fc1', '#f2c45a', '#6fd6ff', '#c792ff', '#ffd1e8'], glow: '#ff9fd6' },
};
