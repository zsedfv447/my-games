// 召喚用圖樣：星印（封印法陣）與卡背，全部程式產生
import { rngFor } from './seed';

function starPolygon(cx: number, cy: number, points: number, outer: number, inner: number): string {
  const p: string[] = [];
  for (let k = 0; k < points * 2; k++) {
    const a = -Math.PI / 2 + (k * Math.PI) / points;
    const r = k % 2 ? inner : outer;
    p.push(`${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)}`);
  }
  return p.join(' ');
}

/** 外圈刻度＋符點 */
function ringMarks(cx: number, cy: number, r: number, count: number, len: number): string {
  let out = '';
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const l = i % 6 === 0 ? len * 2 : len;
    const x1 = cx + Math.cos(a) * r;
    const y1 = cy + Math.sin(a) * r;
    const x2 = cx + Math.cos(a) * (r - l);
    const y2 = cy + Math.sin(a) * (r - l);
    out += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`;
  }
  return out;
}

/** 從中心往外的裂痕（解封進度越高越明顯），固定種子每次一樣 */
function cracks(cx: number, cy: number, r: number): string {
  const rng = rngFor('seal-cracks');
  let out = '';
  for (let i = 0; i < 9; i++) {
    let a = (i / 9) * Math.PI * 2 + rng.next() * 0.4;
    let x = cx;
    let y = cy;
    let d = `M${x} ${y}`;
    const steps = 4 + rng.int(3);
    for (let s = 0; s < steps; s++) {
      a += (rng.next() - 0.5) * 0.9;
      const step = (r / steps) * (0.8 + rng.next() * 0.4);
      x += Math.cos(a) * step;
      y += Math.sin(a) * step;
      d += `L${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    out += `<path d="${d}" pathLength="1"/>`;
  }
  return out;
}

/** 星印：外圈刻度、內圈符點、星座八芒星與裂痕；各層用 class 給 CSS 轉動，顏色跟著 CSS color 走 */
export function sealSvg(id = 'seal'): string {
  const c = 150;
  const runes = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2;
    const x = c + Math.cos(a) * 104;
    const y = c + Math.sin(a) * 104;
    return `<polygon points="${starPolygon(x, y, 4, 7, 2.5)}"/>`;
  }).join('');
  return `<svg class="seal" viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <radialGradient id="${id}-core" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="currentColor" stop-opacity=".9"/>
      <stop offset=".35" stop-color="currentColor" stop-opacity=".35"/>
      <stop offset="1" stop-color="#060a1f" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <circle class="seal-core" cx="${c}" cy="${c}" r="150" fill="url(#${id}-core)"/>
  <g class="seal-ring-outer" fill="none" stroke="currentColor" stroke-width="1.5">
    <circle cx="${c}" cy="${c}" r="142"/><circle cx="${c}" cy="${c}" r="134" stroke-dasharray="2 5"/>
    ${ringMarks(c, c, 142, 48, 6)}
  </g>
  <g class="seal-ring-inner" fill="currentColor" stroke="none">
    <circle cx="${c}" cy="${c}" r="118" fill="none" stroke="currentColor" stroke-opacity=".6"/>
    <circle cx="${c}" cy="${c}" r="90" fill="none" stroke="currentColor" stroke-opacity=".6"/>
    ${runes}
  </g>
  <g class="seal-star" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round">
    <polygon points="${starPolygon(c, c, 8, 86, 34)}"/>
    <polygon points="${starPolygon(c, c, 4, 60, 24)}" stroke-opacity=".7"/>
    <circle cx="${c}" cy="${c}" r="14" fill="currentColor" fill-opacity=".85"/>
  </g>
  <g class="seal-cracks" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round">${cracks(c, c, 140)}</g>
</svg>`;
}

/** 卡背：夜空底＋金框＋八芒星 */
export function cardBackSvg(): string {
  const W = 300;
  const H = 400;
  const rng = rngFor('card-back');
  let dust = '';
  for (let i = 0; i < 40; i++) {
    dust += `<circle cx="${(rng.next() * W).toFixed(1)}" cy="${(rng.next() * H).toFixed(1)}" r="${(0.5 + rng.next()).toFixed(2)}" fill="#fff" opacity="${(0.2 + rng.next() * 0.5).toFixed(2)}"/>`;
  }
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <radialGradient id="cb-bg" cx="50%" cy="45%" r="75%"><stop offset="0" stop-color="#1f2c62"/><stop offset="1" stop-color="#060a1f"/></radialGradient>
    <linearGradient id="cb-frame" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff0b8"/><stop offset=".5" stop-color="#b98a2a"/><stop offset="1" stop-color="#fff0b8"/></linearGradient>
  </defs>
  <rect x="4" y="4" width="${W - 8}" height="${H - 8}" rx="20" fill="url(#cb-bg)"/>
  ${dust}
  <g fill="none" stroke="#f2c45a" stroke-opacity=".75" stroke-width="1.5">
    <circle cx="150" cy="200" r="92"/><circle cx="150" cy="200" r="70" stroke-dasharray="3 6"/>
    <polygon points="${starPolygon(150, 200, 8, 80, 32)}"/>
  </g>
  <polygon points="${starPolygon(150, 200, 4, 30, 9)}" fill="#f7dc98"/>
  <rect x="18" y="18" width="${W - 36}" height="${H - 36}" rx="12" fill="none" stroke="#f2c45a" stroke-opacity=".35"/>
  <rect x="5" y="5" width="${W - 10}" height="${H - 10}" rx="19" fill="none" stroke="url(#cb-frame)" stroke-width="9"/>
</svg>`;
}

/** 守護封印的星龍頭（正面），雙眼用 class dragon-eye 給 CSS 點亮 */
export function starDragonSvg(): string {
  // 左半邊的輪廓，右半邊鏡射
  const half = 'M120 18 C104 20 92 28 84 40 L58 6 L64 44 C52 50 44 60 40 72 L10 64 L34 88 C34 100 40 112 52 120 L70 132 C84 140 100 146 120 148';
  const horn = 'M84 40 C70 24 56 14 40 10 C54 22 62 34 66 46';
  const whisker = 'M60 118 C42 124 26 136 14 150';
  const brow = 'M66 70 C78 62 92 62 102 70';
  const mirror = (d: string) => `<path d="${d}"/><path d="${d}" transform="translate(240 0) scale(-1 1)"/>`;
  const stars = [[120, 34], [96, 50], [144, 50], [120, 92], [86, 106], [154, 106]]
    .map(([x, y]) => `<polygon points="${starPolygon(x, y, 4, 5, 1.6)}"/>`).join('');
  return `<svg class="star-dragon" viewBox="0 0 240 160" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <radialGradient id="dragon-fill" cx="50%" cy="40%" r="60%"><stop offset="0" stop-color="#2a3a86"/><stop offset="1" stop-color="#0b1230"/></radialGradient>
  </defs>
  <path d="${half}" fill="url(#dragon-fill)"/><path d="${half}" fill="url(#dragon-fill)" transform="translate(240 0) scale(-1 1)"/>
  <g fill="none" stroke="#f2c45a" stroke-width="2" stroke-linejoin="round" stroke-linecap="round">
    ${mirror(half)}${mirror(horn)}${mirror(whisker)}${mirror(brow)}
    <path d="M120 100 L108 128 L120 140 L132 128 Z" stroke-opacity=".8"/>
    <path d="M110 132 L104 136 M130 132 L136 136" stroke-opacity=".7"/>
  </g>
  <g fill="#f7dc98" opacity=".75">${stars}</g>
  <g class="dragon-eyes">
    <path class="dragon-eye" d="M70 82 C80 74 94 74 102 84 C92 90 80 90 70 82 Z"/>
    <path class="dragon-eye" d="M170 82 C160 74 146 74 138 84 C148 90 160 90 170 82 Z"/>
  </g>
</svg>`;
}
