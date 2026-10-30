// 背景與標誌：星空、灰燈港遠景、遊戲標誌
import { rngFor } from './seed';

/** 全畫面星空底圖（固定在舞台最底層） */
export function starfieldSvg(w = 390, h = 900, count = 120): string {
  const rng = rngFor('starfield');
  let stars = '';
  for (let i = 0; i < count; i++) {
    const x = (rng.next() * w).toFixed(1);
    const y = (rng.next() * h).toFixed(1);
    const r = (0.3 + rng.next() * rng.next() * 1.6).toFixed(2);
    const o = (0.25 + rng.next() * 0.7).toFixed(2);
    const twinkle = rng.next() < 0.18
      ? `<animate attributeName="opacity" values="${o};.1;${o}" dur="${(2 + rng.next() * 4).toFixed(1)}s" repeatCount="indefinite"/>`
      : '';
    stars += `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity="${o}">${twinkle}</circle>`;
  }
  return `<svg class="starfield" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMin slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${stars}</svg>`;
}

/** 主城遠景：灰燈港的燈塔、海與墜落的星骸 */
export function harborSvg(): string {
  const rng = rngFor('harbor');
  let falling = '';
  for (let i = 0; i < 5; i++) {
    const x = 40 + rng.next() * 300;
    const y = 10 + rng.next() * 60;
    const len = 30 + rng.next() * 40;
    falling += `<path d="M${x.toFixed(0)} ${y.toFixed(0)}l${(len * 0.6).toFixed(0)} ${(len * 0.8).toFixed(0)}" stroke="url(#trail)" stroke-width="2" stroke-linecap="round"/>`;
  }
  let windows = '';
  for (let i = 0; i < 14; i++) {
    const x = 20 + rng.next() * 340;
    const y = 168 + rng.next() * 18;
    windows += `<rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="3" height="4" fill="#f2c45a" opacity="${(0.5 + rng.next() * 0.5).toFixed(2)}"/>`;
  }
  return `<svg viewBox="0 0 366 230" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b1230"/><stop offset=".7" stop-color="#2a3a85"/><stop offset="1" stop-color="#4b4a8f"/></linearGradient>
    <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b2864"/><stop offset="1" stop-color="#060a1f"/></linearGradient>
    <linearGradient id="trail" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#f7dc98"/></linearGradient>
    <radialGradient id="beam" cx="0" cy=".5" r="1"><stop offset="0" stop-color="#f7dc98" stop-opacity=".55"/><stop offset="1" stop-color="#f7dc98" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="366" height="230" fill="url(#sky)"/>
  ${starfieldSvg(366, 150, 60).replace('class="starfield" ', '')}
  ${falling}
  <g opacity=".75"><path d="M120 60c30-30 90-30 120 0" fill="none" stroke="#9aa4d6" stroke-width="1" stroke-dasharray="2 5"/><circle cx="180" cy="38" r="16" fill="#f7dc98" opacity=".9"/><circle cx="186" cy="34" r="14" fill="#2a3a85"/></g>
  <path d="M0 170 40 140 75 160 120 120 165 155 210 135 260 160 300 128 366 158V230H0z" fill="#141c45"/>
  <path d="M0 180h366v50H0z" fill="url(#sea)"/>
  <path d="M0 178h40v-14h18v-10h14v24h30v-18h22v18h40v-8h20v8h60v-22h16v22h34v-12h24v12h48v6H0z" fill="#0b1230"/>
  ${windows}
  <g transform="translate(300 96)">
    <path d="M-60 6 0 0v12z" fill="url(#beam)"/>
    <path d="M-7 82 -4 14h8l3 68z" fill="#d8dbe6"/><path d="M-5.6 50h11.2v8H-5.6z" fill="#e8553f"/>
    <rect x="-7" y="4" width="14" height="10" rx="2" fill="#f2c45a"/><path d="M-9 4 0-6 9 4z" fill="#e8553f"/>
  </g>
  <g stroke="#f7dc98" stroke-opacity=".25"><path d="M0 196h366M20 206h120M200 212h140"/></g>
</svg>`;
}

/** 標題標誌：八芒星環繞的碎裂星座 */
export function logoSvg(): string {
  return `<svg class="logo" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <radialGradient id="lg-core"><stop offset="0" stop-color="#fff6d8"/><stop offset=".45" stop-color="#f2c45a"/><stop offset="1" stop-color="#f2c45a" stop-opacity="0"/></radialGradient>
  </defs>
  <circle cx="100" cy="100" r="90" fill="url(#lg-core)" opacity=".35"/>
  <g fill="none" stroke="#f2c45a" stroke-opacity=".7">
    <circle cx="100" cy="100" r="78" stroke-dasharray="1 7" stroke-width="2"/>
    <circle cx="100" cy="100" r="64"/>
    <g>
      <animateTransform attributeName="transform" type="rotate" from="0 100 100" to="360 100 100" dur="60s" repeatCount="indefinite"/>
      <path d="M100 22l6 16-6 6-6-6z M178 100l-16 6-6-6 6-6z M100 178l-6-16 6-6 6 6z M22 100l16-6 6 6-6 6z" fill="#f2c45a" fill-opacity=".6"/>
    </g>
  </g>
  <path d="M100 52l11 37 37 11-37 11-11 37-11-37-37-11 37-11z" fill="#fff6d8" stroke="#b98a2a" stroke-width="2"/>
  <path d="M100 74l5 21 21 5-21 5-5 21-5-21-21-5 21-5z" fill="#f2c45a"/>
  <g fill="#f7dc98"><path d="M146 52l4 6-6 1z"/><path d="M58 146l-3-7 7 0z"/><path d="M150 140l6 3-5 4z"/><path d="M50 60l-2 6 6-1z"/></g>
</svg>`;
}
