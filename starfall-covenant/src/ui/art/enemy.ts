// 程式產生的敵人：以敵人 id 為種子，組合身形、眼睛、角與尖刺，墜域裡被星骸扭曲的生物
import type { Attribute, EnemyDef } from '../../core/types';
import { ORB_COLORS } from './palette';
import { escapeXml, rngFor } from './seed';

export type EnemyArtInput = Pick<EnemyDef, 'id' | 'name' | 'attribute'> & { boss?: boolean };

function blob(rng: ReturnType<typeof rngFor>, cx: number, cy: number, r: number, points: number, jitter: number): string {
  const pts: [number, number][] = [];
  for (let i = 0; i < points; i++) {
    const a = (i / points) * Math.PI * 2 - Math.PI / 2;
    const rr = r * (1 - jitter + rng.next() * jitter * 2);
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.92]);
  }
  // 以中點做平滑的二次曲線
  const mid = (a: [number, number], b: [number, number]) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  let d = '';
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const next = pts[(i + 1) % pts.length];
    const m = mid(p, next);
    if (i === 0) {
      const start = mid(pts[pts.length - 1], p);
      d += `M${start[0].toFixed(1)} ${start[1].toFixed(1)}`;
    }
    d += `Q${p[0].toFixed(1)} ${p[1].toFixed(1)} ${m[0].toFixed(1)} ${m[1].toFixed(1)}`;
  }
  return `${d}Z`;
}

export function enemySvg(enemy: EnemyArtInput): string {
  const rng = rngFor(`enemy:${enemy.id}`);
  const c = ORB_COLORS[enemy.attribute as Attribute];
  const id = `en-${enemy.id}`;
  const bodyR = 30 + rng.int(8);
  const cy = 64;
  const parts: string[] = [];

  // 光暈（Boss 較大且有王冠）
  parts.push(`<circle cx="60" cy="${cy}" r="${enemy.boss ? 56 : 46}" fill="url(#${id}-aura)"/>`);

  // 角或耳
  const hornKind = rng.int(3);
  const hornLen = 14 + rng.int(14);
  for (const side of [-1, 1]) {
    const x = 60 + side * (bodyR * 0.55);
    const y = cy - bodyR * 0.7;
    if (hornKind === 0) {
      parts.push(`<path d="M${x - 6} ${y + 6}Q${x + side * 4} ${y - hornLen} ${x + side * 14} ${y - hornLen - 4}Q${x + side * 6} ${y - 4} ${x + 6} ${y + 8}Z" fill="${c.light}" stroke="${c.dark}" stroke-width="2"/>`);
    } else if (hornKind === 1) {
      parts.push(`<path d="M${x - 8} ${y + 8}L${x + side * 3} ${y - hornLen}L${x + 8} ${y + 8}Z" fill="${c.dark}" stroke="${c.light}" stroke-width="1.5"/>`);
    } else {
      parts.push(`<ellipse cx="${x + side * 4}" cy="${y - 2}" rx="7" ry="${hornLen / 2 + 4}" transform="rotate(${side * 25} ${x} ${y})" fill="${c.base}" stroke="${c.dark}" stroke-width="2"/>`);
    }
  }

  // 身體
  parts.push(`<path d="${blob(rng, 60, cy, bodyR, 7 + rng.int(4), 0.18)}" fill="url(#${id}-body)" stroke="${c.dark}" stroke-width="3"/>`);

  // 星骸碎片（嵌在身上的發光結晶）
  const shards = 1 + rng.int(3);
  for (let i = 0; i < shards; i++) {
    const sx = 60 + (rng.next() - 0.5) * bodyR;
    const sy = cy + bodyR * (0.15 + rng.next() * 0.4);
    const s = 4 + rng.int(4);
    parts.push(`<path d="M${sx} ${sy - s * 1.6}L${sx + s} ${sy}L${sx} ${sy + s * 1.6}L${sx - s} ${sy}Z" fill="#fff6d8" stroke="${c.dark}" stroke-width="1.2" opacity=".9"/>`);
  }

  // 眼睛：1–3 顆
  const eyes = 1 + rng.int(3);
  const eyeY = cy - bodyR * 0.15;
  const spread = eyes === 1 ? 0 : bodyR * 0.42;
  for (let i = 0; i < eyes; i++) {
    const ex = eyes === 1 ? 60 : 60 - spread + (i * spread * 2) / (eyes - 1);
    const er = eyes === 1 ? 10 : 6.5;
    parts.push(`<ellipse cx="${ex.toFixed(1)}" cy="${eyeY.toFixed(1)}" rx="${er}" ry="${er * 0.85}" fill="#fff"/>`);
    parts.push(`<ellipse cx="${ex.toFixed(1)}" cy="${(eyeY + 1).toFixed(1)}" rx="${er * 0.35}" ry="${er * 0.7}" fill="#12152a"/>`);
  }

  // 嘴
  const mouthY = cy + bodyR * 0.32;
  if (rng.next() < 0.5) {
    parts.push(`<path d="M${60 - 10} ${mouthY}l4 5 3-5 3 5 3-5 3 5 4-5" fill="none" stroke="${c.dark}" stroke-width="2.2" stroke-linejoin="round"/>`);
  } else {
    parts.push(`<path d="M${60 - 9} ${mouthY}q9 7 18 0" fill="none" stroke="${c.dark}" stroke-width="2.5" stroke-linecap="round"/>`);
  }

  if (enemy.boss) {
    parts.push(`<path d="M44 ${cy - bodyR - 6}l5-12 6 8 5-12 5 12 6-8 5 12z" fill="#f2c45a" stroke="#6b4c10" stroke-width="2" stroke-linejoin="round"/>`);
  }

  return `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escapeXml(enemy.name)}">
  <defs>
    <radialGradient id="${id}-body" cx="40%" cy="35%" r="75%"><stop offset="0" stop-color="${c.light}"/><stop offset=".5" stop-color="${c.base}"/><stop offset="1" stop-color="${c.dark}"/></radialGradient>
    <radialGradient id="${id}-aura"><stop offset="0" stop-color="${c.base}" stop-opacity=".45"/><stop offset="1" stop-color="${c.base}" stop-opacity="0"/></radialGradient>
  </defs>
  <ellipse cx="60" cy="112" rx="34" ry="5" fill="#000" opacity=".35"/>
  ${parts.join('\n  ')}
</svg>`;
}
