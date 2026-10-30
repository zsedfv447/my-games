// 卡面的角色剪影模板（風格指南 2.1）：依種族用不同模板，由卡號種子決定姿勢與配件。
// 只畫剪影＋符號，不畫人臉。座標以 300×400 立繪為準。
import type { Race } from '../../core/types';
import type { Rng } from '../../core/rng';

/** 剪影分層：back 是披風、翅膀、尾巴；body 是身體；metal 是武器與機械；gold 是星光金配件 */
export type LayerKind = 'back' | 'body' | 'metal' | 'gold';

export interface FigureLayer {
  kind: LayerKind;
  shapes: string;
}

export interface FigurePalette {
  hi: string;
  light: string;
  base: string;
  dark: string;
  gold: string;
}

export interface Figure {
  layers: FigureLayer[];
  /** 畫在剪影上的細節（甲片縫、羽紋、眼睛），自帶顏色 */
  details: string;
  /** 發光點：屬性符號、燈、核心、掌心 */
  glows: { x: number; y: number; r: number }[];
  /** 屬性符號的位置（胸口或核心），size 是符號寬度 */
  emblem: { x: number; y: number; size: number };
  /** 頭像裁切的中心（臉部附近） */
  focus: [number, number];
}

export const POSES_PER_RACE = 3;

const f = (n: number) => (Math.round(n * 10) / 10).toString();

type Pt = [number, number];

function path(d: string, extra = ''): string {
  return `<path d="${d}"${extra}/>`;
}

function poly(pts: Pt[]): string {
  return path(`M${pts.map(([x, y]) => `${f(x)} ${f(y)}`).join('L')}Z`);
}

function circle(x: number, y: number, r: number): string {
  return `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}"/>`;
}

function ell(x: number, y: number, rx: number, ry: number, rot = 0): string {
  return `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(rx)}" ry="${f(ry)}"${rot ? ` transform="rotate(${f(rot)} ${f(x)} ${f(y)})"` : ''}/>`;
}

/** 兩端粗細不同的圓頭肢體 */
function cap(x1: number, y1: number, x2: number, y2: number, r1: number, r2: number): string {
  const a = Math.atan2(y2 - y1, x2 - x1) + Math.PI / 2;
  const cx = Math.cos(a);
  const cy = Math.sin(a);
  return (
    poly([
      [x1 + cx * r1, y1 + cy * r1],
      [x2 + cx * r2, y2 + cy * r2],
      [x2 - cx * r2, y2 - cy * r2],
      [x1 - cx * r1, y1 - cy * r1],
    ]) +
    circle(x1, y1, r1) +
    circle(x2, y2, r2)
  );
}

function bez(p: Pt[], t: number): Pt {
  const u = 1 - t;
  const [a, b, c, d] = p;
  return [
    u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0],
    u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1],
  ];
}

/** 沿三次貝茲曲線、半徑由 r0 漸變到 r1 的管狀（尾巴、脖子、蛇身） */
function tube(p: Pt[], r0: number, r1: number, n = 22): string {
  const left: Pt[] = [];
  const right: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const [x, y] = bez(p, t);
    const [x2, y2] = bez(p, Math.min(1, t + 0.01));
    const [x0, y0] = bez(p, Math.max(0, t - 0.01));
    const a = Math.atan2(y2 - y0, x2 - x0) + Math.PI / 2;
    const r = r0 + (r1 - r0) * t;
    left.push([x + Math.cos(a) * r, y + Math.sin(a) * r]);
    right.push([x - Math.cos(a) * r, y - Math.sin(a) * r]);
  }
  return poly([...left, ...right.reverse()]) + circle(p[0][0], p[0][1], r0);
}

/** 尖頭葉形（羽毛、葉片、尖刺） */
function leaf(x: number, y: number, len: number, w: number, angle: number): string {
  const a = (angle * Math.PI) / 180;
  const tx = x + Math.cos(a) * len;
  const ty = y + Math.sin(a) * len;
  const nx = -Math.sin(a) * w;
  const ny = Math.cos(a) * w;
  const mx = x + Math.cos(a) * len * 0.45;
  const my = y + Math.sin(a) * len * 0.45;
  return path(`M${f(x)} ${f(y)}Q${f(mx + nx)} ${f(my + ny)} ${f(tx)} ${f(ty)}Q${f(mx - nx)} ${f(my - ny)} ${f(x)} ${f(y)}Z`);
}

/** 圓環（環形光圈、齒輪內孔用 evenodd） */
function ring(x: number, y: number, r: number, w: number, ry = r): string {
  const ri = r - w;
  const ryi = ry - w;
  return path(
    `M${f(x - r)} ${f(y)}a${f(r)} ${f(ry)} 0 1 0 ${f(r * 2)} 0a${f(r)} ${f(ry)} 0 1 0 ${f(-r * 2)} 0Z` +
      `M${f(x - ri)} ${f(y)}a${f(ri)} ${f(ryi)} 0 1 0 ${f(ri * 2)} 0a${f(ri)} ${f(ryi)} 0 1 0 ${f(-ri * 2)} 0Z`,
    ' fill-rule="evenodd"',
  );
}

function gear(x: number, y: number, r: number, teeth: number, hole: number): string {
  let d = '';
  for (let i = 0; i < teeth * 2; i++) {
    const a0 = (i * Math.PI) / teeth;
    const a1 = ((i + 1) * Math.PI) / teeth;
    const rr = i % 2 ? r * 0.86 : r;
    const p0: Pt = [x + Math.cos(a0 + 0.05) * rr, y + Math.sin(a0 + 0.05) * rr];
    const p1: Pt = [x + Math.cos(a1 - 0.05) * rr, y + Math.sin(a1 - 0.05) * rr];
    d += `${i ? 'L' : 'M'}${f(p0[0])} ${f(p0[1])}L${f(p1[0])} ${f(p1[1])}`;
  }
  d += `ZM${f(x - hole)} ${f(y)}a${f(hole)} ${f(hole)} 0 1 0 ${f(hole * 2)} 0a${f(hole)} ${f(hole)} 0 1 0 ${f(-hole * 2)} 0Z`;
  return path(d, ' fill-rule="evenodd"');
}

/** 四芒星（金色配件、星屑） */
export function sparkle(x: number, y: number, r: number, thin = 0.28): string {
  const t = r * thin;
  return path(
    `M${f(x)} ${f(y - r)}Q${f(x + t)} ${f(y - t)} ${f(x + r)} ${f(y)}Q${f(x + t)} ${f(y + t)} ${f(x)} ${f(y + r)}Q${f(x - t)} ${f(y + t)} ${f(x - r)} ${f(y)}Q${f(x - t)} ${f(y - t)} ${f(x)} ${f(y - r)}Z`,
  );
}

function line(x1: number, y1: number, x2: number, y2: number, color: string, w: number, op = 1): string {
  return `<path d="M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}" stroke="${color}" stroke-width="${w}" stroke-opacity="${op}" stroke-linecap="round" fill="none"/>`;
}

function strokePath(d: string, color: string, w: number, op = 1): string {
  return `<path d="${d}" stroke="${color}" stroke-width="${w}" stroke-opacity="${op}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
}

// ---------- 人傑：人形持武器 ----------
function human(rng: Rng, pose: number, p: FigurePalette): Figure {
  const back: string[] = [];
  const body: string[] = [];
  const metal: string[] = [];
  const gold: string[] = [];
  let details = '';
  const glows: Figure['glows'] = [];
  const robe = pose === 2;

  // 披風（法師改成長袍，披風短一點）
  const hem = robe ? 300 : 352;
  back.push(path(`M124 104C92 160 70 250 50 ${hem}L84 ${hem - 14}L104 ${hem + 4}L128 ${hem - 12}L150 128ZM176 104C208 160 230 250 250 ${hem}L216 ${hem - 14}L196 ${hem + 4}L172 ${hem - 12}L150 128Z`));

  // 頭、頸、軀幹、肩甲
  body.push(circle(150, 74, 19), path('M142 88h16v20h-16z'), path('M129 80Q126 52 150 50Q176 52 172 82Q166 64 150 64Q136 64 129 80Z'));
  body.push(path('M118 106Q150 96 182 106L174 180Q150 188 126 180Z'));
  if (robe) body.push(path('M126 172L174 172C186 230 200 300 214 372L86 372C100 300 114 230 126 172Z'));
  else {
    body.push(path('M126 172L174 172L194 256Q150 268 106 256Z'));
    body.push(cap(138, 250, 130, 342, 12, 9), cap(162, 250, 172, 342, 12, 9), ell(126, 348, 16, 8), ell(176, 348, 16, 8));
  }
  metal.push(ell(116, 112, 18, 12, -18), ell(184, 112, 18, 12, 18));

  // 頭飾：王冠、馬尾、角盔
  const head = rng.int(3);
  if (head === 0) gold.push(poly([[132, 62], [136, 40], [143, 54], [150, 34], [157, 54], [164, 40], [168, 62]]));
  else if (head === 1) back.push(tube([[160, 62], [196, 58], [204, 96], [222, 128]], 9, 3));
  else body.push(tube([[138, 64], [120, 54], [116, 40], [122, 28]], 6, 2), tube([[162, 64], [180, 54], [184, 40], [178, 28]], 6, 2));

  if (pose === 0) {
    // 雙手按劍、劍尖朝下
    body.push(cap(118, 112, 132, 150, 10, 8), cap(132, 150, 146, 168, 8, 7), cap(182, 112, 168, 150, 10, 8), cap(168, 150, 154, 168, 8, 7));
    metal.push(poly([[144, 180], [156, 180], [154, 338], [150, 352], [146, 338]]));
    gold.push(path('M120 172h60l-6 8h-48z'), circle(150, 160, 7));
    details += line(150, 186, 150, 334, p.hi, 1.5, 0.8);
  } else if (pose === 1) {
    // 長槍立在身側
    body.push(cap(118, 112, 104, 150, 10, 8), cap(104, 150, 122, 174, 8, 7));
    body.push(cap(182, 112, 202, 146, 10, 8), cap(202, 146, 210, 124, 8, 7));
    metal.push(path('M207 20h6v356h-6z'), path('M210 0Q224 26 210 50Q196 26 210 0Z'));
    gold.push(path('M198 50h24l-4 8h-16z'), circle(210, 124, 6));
  } else {
    // 法杖＋掌心光
    body.push(cap(118, 112, 98, 146, 10, 8), cap(98, 146, 94, 120, 8, 7));
    body.push(cap(182, 112, 214, 140, 10, 8), cap(214, 140, 238, 148, 8, 7));
    metal.push(path('M89 36h7v340h-7z'));
    gold.push(ring(92, 30, 18, 4), sparkle(92, 30, 9));
    glows.push({ x: 92, y: 30, r: 16 }, { x: 244, y: 148, r: 14 });
  }
  details += strokePath('M126 120Q150 132 174 120', p.light, 1.5, 0.5) + strokePath('M128 176Q150 184 172 176', p.gold, 2, 0.8);
  if (!robe) details += strokePath('M132 196L150 252L168 196', p.light, 1.2, 0.35);
  else details += strokePath('M150 186V368', p.light, 1.2, 0.35);

  return {
    layers: [
      { kind: 'back', shapes: back.join('') },
      { kind: 'body', shapes: body.join('') },
      { kind: 'metal', shapes: metal.join('') },
      { kind: 'gold', shapes: gold.join('') },
    ],
    details,
    glows,
    emblem: { x: 150, y: 140, size: 30 },
    focus: [150, 96],
  };
}

// ---------- 靈仙：羽翼、光環、長裙飄浮 ----------
function sylph(rng: Rng, pose: number, p: FigurePalette): Figure {
  const back: string[] = [];
  const body: string[] = [];
  const gold: string[] = [];
  let details = '';
  const glows: Figure['glows'] = [];

  // 羽翼：每邊 6 片羽毛扇形展開
  const spread = pose === 0 ? [-160, -70] : pose === 1 ? [-185, -110] : [-215, -160];
  for (const side of [-1, 1]) {
    for (let i = 0; i < 6; i++) {
      const t = i / 5;
      let a = spread[0] + (spread[1] - spread[0]) * t;
      if (side === 1) a = 180 - a;
      const len = 150 - Math.abs(t - 0.35) * 70 + rng.next() * 10;
      const ox = 150 + side * 10;
      back.push(leaf(ox, 128, len, 15, a));
      details += line(ox, 128, ox + Math.cos((a * Math.PI) / 180) * len * 0.85, 128 + Math.sin((a * Math.PI) / 180) * len * 0.85, p.hi, 1, 0.35);
    }
  }
  // 光環
  gold.push(ring(150, 52, 30, 3.5, 9));

  // 頭與長髮
  body.push(circle(150, 80, 17));
  body.push(path('M134 76Q128 120 112 150Q132 140 140 100ZM166 76Q172 120 188 150Q168 140 160 100Z'));
  // 身體與長裙
  body.push(path('M136 102L164 102L160 172L140 172Z'));
  body.push(path('M138 166L162 166C186 236 210 300 232 372Q212 360 192 374Q170 360 150 376Q130 360 108 374Q88 360 68 372C90 300 114 236 138 166Z'));

  if (pose === 0) {
    body.push(cap(136, 108, 108, 150, 7, 5), cap(108, 150, 86, 176, 5, 4), cap(164, 108, 192, 150, 7, 5), cap(192, 150, 214, 176, 5, 4));
    glows.push({ x: 84, y: 180, r: 10 }, { x: 216, y: 180, r: 10 });
  } else if (pose === 1) {
    body.push(cap(136, 108, 122, 70, 7, 5), cap(122, 70, 138, 30, 5, 4), cap(164, 108, 178, 70, 7, 5), cap(178, 70, 162, 30, 5, 4));
    gold.push(sparkle(150, 18, 14));
    glows.push({ x: 150, y: 22, r: 22 });
  } else {
    body.push(cap(136, 108, 128, 140, 7, 5), cap(128, 140, 148, 136, 5, 4), cap(164, 108, 172, 140, 7, 5), cap(172, 140, 152, 136, 5, 4));
    glows.push({ x: 150, y: 136, r: 14 });
  }
  // 緞帶
  const ribbon = rng.int(2) ? 'M140 170C90 190 70 240 40 250' : 'M160 170C210 190 230 240 260 250';
  details += strokePath(ribbon, p.hi, 3, 0.55) + strokePath('M150 180V360M134 210Q122 290 100 362M166 210Q178 290 200 362', p.light, 1, 0.3);

  return {
    layers: [
      { kind: 'back', shapes: back.join('') },
      { kind: 'body', shapes: body.join('') },
      { kind: 'gold', shapes: gold.join('') },
    ],
    details,
    glows,
    emblem: { x: 150, y: 134, size: 22 },
    focus: [150, 92],
  };
}

// ---------- 冥裔：兜帽斗篷與燈 ----------
function nether(rng: Rng, pose: number, p: FigurePalette): Figure {
  const back: string[] = [];
  const body: string[] = [];
  const metal: string[] = [];
  const gold: string[] = [];
  let details = '';
  const glows: Figure['glows'] = [];

  // 斗篷下擺破碎
  back.push(path('M106 150C88 220 70 300 52 374L78 352L98 376L122 350L146 378L170 350L194 376L218 352L248 374C230 300 212 220 194 150Z'));
  // 兜帽與肩披
  body.push(path('M150 34C120 44 108 84 110 120C98 132 96 150 104 168L196 168C204 150 202 132 190 120C192 84 180 44 150 34Z'));
  body.push(path('M104 150Q150 130 196 150L206 196Q150 210 94 196Z'));
  // 兜帽裡的空洞與發光的眼
  details += ell(150, 98, 20, 25).replace('/>', ` fill="#05040c"/>`);
  details += ell(142, 98, 4, 2.2).replace('/>', ` fill="${p.hi}"/>`) + ell(158, 98, 4, 2.2).replace('/>', ` fill="${p.hi}"/>`);
  details += strokePath('M110 168L130 360M190 168L170 360M150 200V370', p.light, 1.2, 0.25);
  gold.push(circle(150, 150, 7));

  if (pose === 0) {
    // 伸手提燈
    body.push(tube([[188, 160], [212, 170], [228, 186], [238, 196]], 14, 20));
    details += line(238, 206, 238, 232, p.gold, 2);
    metal.push(path('M226 236h24l4 10v28l-4 10h-24l-4-10v-28z'), path('M230 228h16l-3 8h-10z'));
    glows.push({ x: 238, y: 260, r: 24 });
  } else if (pose === 1) {
    // 彎頭長杖掛燈
    metal.push(path('M80 60h7v320h-7z'), path('M80 64C80 30 120 26 120 54h-7C113 38 87 40 87 64z'));
    body.push(tube([[112, 160], [96, 170], [88, 180], [84, 190]], 14, 18));
    details += line(116, 58, 116, 80, p.gold, 2);
    metal.push(path('M106 84h20l3 8v22l-3 8h-20l-3-8v-22z'));
    glows.push({ x: 116, y: 104, r: 22 });
  } else {
    // 雙手合攏，身邊漂浮三盞魂火
    body.push(tube([[108, 160], [118, 180], [134, 190], [146, 192]], 14, 12), tube([[192, 160], [182, 180], [166, 190], [154, 192]], 14, 12));
    const spots: Pt[] = [[70, 120], [234, 104], [250, 230]];
    for (const [x, y] of spots) {
      metal.push(path(`M${x} ${y - 22}Q${x + 14} ${y - 4} ${x + 9} ${y + 8}Q${x} ${y + 16} ${x - 9} ${y + 8}Q${x - 14} ${y - 4} ${x} ${y - 22}Z`));
      glows.push({ x, y: y + 2, r: 16 });
    }
    glows.push({ x: 150, y: 194, r: 12 });
  }
  if (rng.int(2)) gold.push(path('M130 46L150 24L170 46L162 44L150 34L138 44Z'));

  return {
    layers: [
      { kind: 'back', shapes: back.join('') },
      { kind: 'body', shapes: body.join('') },
      { kind: 'metal', shapes: metal.join('') },
      { kind: 'gold', shapes: gold.join('') },
    ],
    details,
    glows,
    emblem: { x: 150, y: 178, size: 26 },
    focus: [150, 100],
  };
}

// ---------- 獸裔：四足 ----------
function beast(rng: Rng, pose: number, p: FigurePalette): Figure {
  const back: string[] = [];
  const body: string[] = [];
  const gold: string[] = [];
  let details = '';
  let focus: Pt;
  let emblem: Figure['emblem'];
  const eye = (x: number, y: number, rot: number) => ell(x, y, 5, 2, rot).replace('/>', ` fill="${p.hi}"/>`);

  if (pose === 0) {
    // 坐姿仰頭長嚎
    back.push(tube([[96, 300], [40, 300], [30, 230], [60, 196]], 20, 7));
    body.push(ell(126, 282, 52, 48), ell(108, 336, 40, 14));
    body.push(ell(166, 206, 38, 62, -14));
    body.push(cap(176, 236, 182, 344, 13, 9), cap(152, 244, 152, 346, 13, 9), ell(186, 348, 15, 7), ell(156, 350, 15, 7));
    body.push(tube([[160, 180], [170, 150], [176, 130], [182, 112]], 30, 22));
    body.push(ell(186, 98, 26, 20, -40), cap(196, 86, 228, 54, 12, 6));
    body.push(poly([[170, 86], [160, 46], [186, 74]]), poly([[184, 76], [186, 38], [200, 70]]));
    back.push(poly([[140, 120], [118, 150], [138, 154], [120, 186], [146, 182], [138, 214], [170, 196], [200, 150], [196, 110]]));
    details += eye(200, 84, -40) + strokePath('M150 180Q166 200 160 240', p.light, 1.5, 0.4);
    focus = [190, 100];
    emblem = { x: 166, y: 214, size: 24 };
  } else if (pose === 1) {
    // 站姿側身，鬃毛
    back.push(tube([[70, 214], [40, 200], [30, 150], [44, 120]], 12, 6), leaf(44, 124, 30, 12, -100));
    back.push(path(`M${[...Array(16)].map((_, i) => {
      const a = (i / 16) * Math.PI * 2;
      const r = i % 2 ? 46 : 62;
      return `${f(218 + Math.cos(a) * r)} ${f(156 + Math.sin(a) * r)}`;
    }).join('L')}Z`));
    body.push(ell(140, 236, 78, 44));
    body.push(cap(90, 250, 84, 350, 15, 10), cap(118, 256, 120, 352, 13, 9), cap(176, 252, 170, 350, 15, 10), cap(200, 246, 206, 348, 13, 9));
    body.push(ell(226, 162, 26, 30), cap(232, 176, 256, 186, 14, 9));
    body.push(poly([[210, 136], [204, 108], [224, 128]]), poly([[236, 134], [244, 108], [248, 138]]));
    details += eye(238, 156, 10) + strokePath('M80 230Q140 216 200 232', p.light, 1.5, 0.35);
    focus = [224, 160];
    emblem = { x: 140, y: 236, size: 30 };
  } else {
    // 人立撲擊
    back.push(tube([[110, 320], [60, 340], [36, 290], [50, 240]], 16, 5));
    body.push(tube([[118, 320], [130, 260], [150, 210], [176, 164]], 42, 34));
    body.push(cap(110, 330, 96, 372, 15, 10), cap(140, 330, 150, 372, 15, 10));
    body.push(cap(190, 176, 226, 160, 12, 9), cap(226, 160, 246, 132, 9, 7), cap(176, 196, 218, 200, 12, 9), cap(218, 200, 240, 178, 9, 7));
    for (const [x, y] of [[248, 128], [242, 174]] as Pt[]) for (let k = 0; k < 3; k++) body.push(leaf(x, y, 12, 2.5, -70 + k * 30));
    body.push(ell(196, 110, 28, 24, -20), cap(208, 106, 240, 96, 13, 8));
    body.push(poly([[180, 94], [170, 56], [196, 86]]), poly([[194, 88], [204, 52], [212, 88]]));
    details += eye(210, 100, -15) + strokePath('M232 104L218 110', p.hi, 2, 0.8);
    focus = [200, 112];
    emblem = { x: 150, y: 240, size: 28 };
  }
  // 額頭或胸前的星金飾
  if (rng.int(2)) gold.push(sparkle(focus[0] - 4, focus[1] - 18, 7));

  return {
    layers: [
      { kind: 'back', shapes: back.join('') },
      { kind: 'body', shapes: body.join('') },
      { kind: 'gold', shapes: gold.join('') },
    ],
    details,
    glows: [],
    emblem,
    focus,
  };
}

// ---------- 龍嗣：翼與長尾 ----------
function dragon(rng: Rng, pose: number, p: FigurePalette): Figure {
  const back: string[] = [];
  const body: string[] = [];
  const metal: string[] = [];
  let details = '';
  const eye = (x: number, y: number) => ell(x, y, 5, 2.2, -10).replace('/>', ` fill="${p.hi}"/>`);
  const horns = (x: number, y: number) => tube([[x - 6, y - 6], [x - 18, y - 22], [x - 30, y - 30], [x - 44, y - 30]], 5, 1) + tube([[x + 2, y - 8], [x - 2, y - 28], [x - 10, y - 38], [x - 22, y - 46]], 5, 1);

  if (pose === 2) {
    // 蛇身東方龍盤旋
    body.push(tube([[60, 380], [280, 360], [260, 220], [150, 230]], 10, 24, 30));
    body.push(tube([[150, 230], [40, 240], [60, 120], [150, 130]], 24, 22, 30));
    body.push(tube([[150, 130], [210, 136], [200, 90], [176, 74]], 22, 18));
    body.push(path('M150 70Q170 50 200 58L236 72Q226 88 200 90Q170 94 150 70Z'));
    for (let i = 0; i < 9; i++) {
      const [x, y] = bez([[150, 230], [40, 240], [60, 120], [150, 130]], i / 9);
      back.push(leaf(x, y, 22, 6, -110 + i * 25));
    }
    body.push(cap(80, 200, 54, 222, 8, 5), cap(214, 280, 244, 300, 8, 5));
    metal.push(horns(166, 66));
    details += eye(196, 70) + strokePath('M226 80C250 90 262 120 270 150M222 84C240 104 238 130 246 158', p.hi, 1.5, 0.7);
    details += strokePath('M70 180C70 140 110 128 150 136', p.light, 1.5, 0.35);
    return {
      layers: [
        { kind: 'back', shapes: back.join('') },
        { kind: 'body', shapes: body.join('') },
        { kind: 'metal', shapes: metal.join('') },
      ],
      details,
      glows: [],
      emblem: { x: 64, y: 184, size: 24 },
      focus: [190, 80],
    };
  }

  // 雙足飛龍：翅膀上舉（0）或展開（1）
  const tipY = pose === 0 ? 20 : 70;
  const tipX = pose === 0 ? 30 : 6;
  for (const s of [-1, 1]) {
    const X = (x: number) => 150 + s * (150 - x);
    back.push(path(`M${X(128)} 128L${X(tipX)} ${tipY}Q${X(48)} ${tipY + 60} ${X(16)} ${tipY + 110}Q${X(56)} ${tipY + 110} ${X(40)} ${tipY + 160}Q${X(82)} ${tipY + 148} ${X(76)} ${tipY + 196}Q${X(110)} ${tipY + 170} ${X(132)} 176Z`));
    details += strokePath(`M${X(128)} 128L${X(48)} ${tipY + 60}M${X(128)} 128L${X(56)} ${tipY + 110}M${X(128)} 128L${X(82)} ${tipY + 148}`, p.light, 1.2, 0.4);
  }
  back.push(tube([[160, 270], [250, 290], [250, 360], [190, 380]], 18, 3));
  body.push(ell(150, 206, 40, 60));
  body.push(ell(126, 270, 22, 30), ell(174, 270, 22, 30), cap(122, 290, 114, 346, 12, 8), cap(178, 290, 186, 346, 12, 8), ell(110, 350, 16, 7), ell(190, 350, 16, 7));
  body.push(cap(128, 172, 108, 210, 9, 6), cap(172, 172, 192, 210, 9, 6));
  body.push(tube([[150, 156], [150, 130], [156, 110], [164, 90]], 20, 15));
  const roar = pose === 0;
  body.push(path(roar ? 'M148 82Q156 58 182 62L214 68L188 82L214 94L182 100Q156 104 148 82Z' : 'M148 82Q156 60 182 64L214 78Q204 94 182 96Q156 102 148 82Z'));
  for (let i = 0; i < 5; i++) body.push(leaf(160 - i * 2, 96 + i * 14, 14, 4, 200 + i * 4));
  metal.push(horns(166, 74));
  details += eye(180, 76) + strokePath('M136 180h28M134 198h32M136 216h28M140 234h20', p.light, 1.5, 0.45);
  if (rng.int(2)) metal.push(path('M128 150h44l-6 10h-32z'));

  return {
    layers: [
      { kind: 'back', shapes: back.join('') },
      { kind: 'body', shapes: body.join('') },
      { kind: 'metal', shapes: metal.join('') },
    ],
    details,
    glows: roar ? [{ x: 200, y: 82, r: 12 }] : [],
    emblem: { x: 150, y: 206, size: 26 },
    focus: [176, 88],
  };
}

// ---------- 機構：齒輪與方形 ----------
function machina(rng: Rng, pose: number, p: FigurePalette): Figure {
  const back: string[] = [];
  const body: string[] = [];
  const metal: string[] = [];
  const gold: string[] = [];
  let details = '';
  const glows: Figure['glows'] = [];
  const teeth = 10 + rng.int(4);

  back.push(gear(150, 150, 112, teeth, 84));
  // 頭（方盒＋目鏡）
  body.push(path('M128 50h44l6 8v30l-6 8h-44l-6-8v-30z'));
  details += `<rect x="132" y="66" width="36" height="8" rx="3" fill="${p.hi}"/>`;
  metal.push(path('M148 36h4v14h-4z'), circle(150, 34, 5));
  // 軀幹與肩甲
  body.push(path('M106 102h88l12 30-10 70h-92l-10-70z'));
  metal.push(path('M74 98h40v42H82l-8-10z'), path('M186 98h40v32l-8 10h-32z'));
  details += strokePath('M114 150h72M120 176h60', p.light, 1.5, 0.4);
  gold.push(ring(150, 140, 15, 3));
  glows.push({ x: 150, y: 140, r: 14 });

  if (pose === 2) {
    // 懸浮：沒有腳，下方光環與環繞的護板
    body.push(path('M112 198h76l-14 40h-48z'));
    gold.push(ring(150, 268, 46, 3, 12), ring(150, 300, 30, 3, 8));
    for (const [x, y, r] of [[60, 200, -20], [240, 200, 20], [70, 300, -10], [230, 300, 10]] as [number, number, number][]) {
      metal.push(path(`M${x - 16} ${y - 20}h32l8 20-8 20h-32l-8-20z`).replace('/>', ` transform="rotate(${r} ${x} ${y})"/>`));
    }
    body.push(cap(84, 130, 74, 176, 11, 9), cap(216, 130, 226, 176, 11, 9));
    glows.push({ x: 150, y: 250, r: 18 });
  } else {
    body.push(path('M116 198h68l8 42h-84z'));
    body.push(path('M112 236h30l-4 108h-30z'), path('M158 236h30l6 108h-30z'), path('M100 340h44v14h-48zM158 340h44l4 14h-48z'));
    metal.push(ell(124, 286, 13, 10), ell(176, 286, 13, 10));
    body.push(cap(84, 130, 80, 196, 12, 10), circle(80, 206, 14));
    if (pose === 1) {
      // 砲臂
      metal.push(path('M200 126h26l42-60 18 12-42 62v18h-44z'));
      gold.push(path('M268 62l22 14-6 8-22-14z'));
      glows.push({ x: 282, y: 70, r: 14 });
    } else {
      body.push(cap(216, 130, 220, 196, 12, 10), circle(220, 206, 14));
    }
  }

  return {
    layers: [
      { kind: 'back', shapes: back.join('') },
      { kind: 'body', shapes: body.join('') },
      { kind: 'metal', shapes: metal.join('') },
      { kind: 'gold', shapes: gold.join('') },
    ],
    details,
    glows,
    emblem: { x: 150, y: 140, size: 18 },
    focus: [150, 82],
  };
}

// ---------- 素材：星晶與符文石 ----------
function material(rng: Rng, pose: number, p: FigurePalette): Figure {
  const body: string[] = [];
  const back: string[] = [];
  const gold: string[] = [];
  let details = '';
  const glows: Figure['glows'] = [];

  if (pose === 0) {
    // 晶簇
    back.push(path('M70 300Q150 250 230 300Q236 330 150 344Q64 330 70 300Z'));
    const n = 3 + rng.int(3);
    for (let i = 0; i < n; i++) {
      const x = 90 + (i / (n - 1)) * 120;
      const hgt = i === Math.floor(n / 2) ? 210 : 110 + rng.next() * 70;
      const w = i === Math.floor(n / 2) ? 34 : 20;
      const tilt = (x - 150) * 0.35;
      body.push(poly([[x - w, 300], [x - w + tilt * 0.4, 300 - hgt * 0.75], [x + tilt, 300 - hgt], [x + w + tilt * 0.4, 300 - hgt * 0.75], [x + w, 300]]));
      details += strokePath(`M${f(x + tilt)} ${f(300 - hgt)}L${f(x + tilt * 0.2)} 298`, p.hi, 1.5, 0.6);
    }
    glows.push({ x: 150, y: 170, r: 30 });
  } else if (pose === 1) {
    // 星形碎晶＋星環
    gold.push(ring(150, 190, 110, 4, 30));
    body.push(sparkle(150, 190, 110, 0.22));
    details += strokePath('M150 80V300M40 190H260', p.hi, 1.5, 0.5);
    glows.push({ x: 150, y: 190, r: 34 });
  } else {
    // 符文蛋石
    body.push(ell(150, 200, 78, 104));
    gold.push(ring(150, 200, 82, 4, 24));
    details += strokePath('M110 140Q150 120 190 140M100 250Q150 276 200 250', p.light, 2, 0.45);
    glows.push({ x: 150, y: 200, r: 26 });
  }

  return {
    layers: [
      { kind: 'back', shapes: back.join('') },
      { kind: 'body', shapes: body.join('') },
      { kind: 'gold', shapes: gold.join('') },
    ],
    details,
    glows,
    emblem: pose === 2 ? { x: 150, y: 200, size: 50 } : { x: 150, y: pose === 0 ? 220 : 190, size: 40 },
    focus: [150, pose === 0 ? 190 : 196],
  };
}

const BUILDERS: Record<Race, (rng: Rng, pose: number, p: FigurePalette) => Figure> = {
  human, sylph, nether, beast, dragon, machina, material,
};

/** 依種族與種子產生剪影；pose 0–2 */
export function buildFigure(race: Race, rng: Rng, pose: number, palette: FigurePalette): Figure {
  return BUILDERS[race](rng, pose % POSES_PER_RACE, palette);
}
