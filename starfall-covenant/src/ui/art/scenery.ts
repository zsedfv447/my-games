// 背景與標誌：星空、遊戲標誌；各場景背景在 scenes.ts
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

export { sceneSvg, SCENE_IDS, SCENE_NAMES, type SceneId } from './scenes';
