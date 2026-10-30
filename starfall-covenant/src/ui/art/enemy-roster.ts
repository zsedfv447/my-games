// 40 種敵人的個別造型（外觀依 docs/proposals/002-enemies-and-trials.md 第 3–5 節）
// 畫布 120×120，地面 y≈108；側身的生物一律面向左。每隻都有星骸晶體與發光的眼睛。
import { INK, Kit, polyStar, starPath } from './enemy-kit';

export interface EnemyDesign {
  /** 體型模板（風格指南第 7 節：至少 3 種；這裡用來在圖鑑與測試裡分組） */
  shape: 'beast' | 'serpent' | 'winged' | 'humanoid' | 'machine' | 'spirit' | 'colossus';
  draw(k: Kit): string;
  /** Boss 頭冠位置：x、y、縮放、傾斜角 */
  crown: [number, number, number, number?];
}

const charcoal = (k: Kit) => k.rad('char', ['#5a4040', '#2c1f24', '#120c12']);
const stone = (k: Kit) => k.lin('stone', ['#a9a7b8', '#6b6a80', '#3a3950']);
const bone = (k: Kit) => k.lin('bone', ['#fbf3df', '#d9cdb0', '#8f826a']);
const metal = (k: Kit, tint: string) => k.lin('metal', ['#eef0f6', tint, '#2b2e44']);
const rust = '#a44f25';

// ---------- 第 1 章：獸座（焦骨荒原） ----------

/** 狼形：灰燼狼與叛牙狼首共用骨架 */
function wolf(k: Kit, o: { fur: string; mane: string; boss?: boolean }): string {
  return [
    // 尾巴
    k.p('M86 62C98 58 108 46 106 32C102 40 100 38 98 44C96 40 94 46 92 44C92 50 88 54 84 56Z', o.mane),
    // 遠側腳
    k.leg(44, 72, 106, 8, k.D),
    k.leg(82, 72, 106, 9, k.D),
    // 身體
    k.p('M34 58C44 46 72 48 88 56C98 62 96 78 86 82C72 86 50 86 40 80C30 74 28 64 34 58Z', o.fur),
    // 近側腳
    k.leg(50, 74, 108, 9, o.fur),
    k.leg(88, 72, 108, 10, o.fur),
    k.p('M80 64C88 60 96 66 94 78C92 86 82 86 78 80Z', o.fur, 1.6),
    // 頸部鬃毛
    k.p('M54 54L48 40L44 50L38 36L34 50L26 44L30 58L36 72L50 70Z', o.mane),
    // 頭
    k.p('M40 46C36 36 28 34 20 38L8 44L6 50L14 54L24 56C32 58 42 54 40 46Z', o.fur),
    k.p('M28 40L28 24L20 36Z', o.fur, 1.8),
    k.p('M36 42L40 28L32 38Z', o.mane, 1.8),
    k.fangs(8, 22, 51, 4, 4),
    k.l('M6 50L24 52', INK, 1.8),
    k.e(7, 46, 2.4, 2, INK, 0),
    k.eye(23, 44, 3.4, { slit: true, angry: -1 }),
    // 星骸
    k.crack([[52, 58], [60, 66], [58, 72], [66, 78]], [[70, 54], [74, 62]]),
    k.cluster(64, 52, 12, 10),
    o.boss ? k.l('M18 38L28 48', '#ffdfd0', 1.6) : '',
  ].join('');
}

const e0001: EnemyDesign = {
  shape: 'beast',
  crown: [28, 34, 0.7, -10],
  draw: (k) => wolf(k, { fur: charcoal(k), mane: k.lin('ember', ['#ffb199', '#e8553f', '#3a1c1c']) })
    + k.crack([[36, 64], [42, 70]], [[84, 66], [90, 72], [88, 78]])
    + k.particles(14, [6, 10, 114, 70]),
};

const e0002: EnemyDesign = {
  shape: 'beast',
  crown: [28, 50, 0.7],
  draw: (k) => [
    k.leg(44, 78, 106, 10, k.D),
    k.leg(84, 78, 106, 10, k.D),
    k.p('M30 66C30 50 50 42 72 44C92 46 102 58 100 72C98 84 82 90 60 90C42 90 30 80 30 66Z'),
    k.leg(52, 80, 108, 11),
    k.leg(92, 78, 108, 11),
    // 背上的岩板（長苔、長晶體）
    k.p('M40 52L48 34L68 26L90 32L98 50C82 44 58 44 40 52Z', stone(k)),
    k.l('M54 34L60 44M76 30L74 42', '#3a3950', 1.4),
    k.e(58, 30, 8, 3.5, k.t.base, 1.4),
    k.e(82, 32, 6, 3, k.t.base, 1.4),
    k.cluster(70, 30, 13, 6),
    // 頭
    k.p('M42 54C32 50 20 54 16 62L8 70C8 80 16 82 24 82L36 84C46 80 48 62 42 54Z'),
    k.p('M38 52L46 42L48 56Z', k.S, 1.8),
    k.e(10, 75, 4.2, 6, k.t.light, 1.8),
    k.e(9, 73, 0.9, 1.6, INK, 0), k.e(10, 78, 0.9, 1.6, INK, 0),
    // 長苔的獠牙
    k.p('M22 80C14 80 8 72 10 60C13 69 18 73 24 74Z', '#f3ead2', 1.8),
    k.e(13, 66, 2.6, 3, k.t.base, 0), k.e(16, 74, 2, 1.8, k.t.light, 0),
    k.eye(30, 64, 3, { angry: -1 }),
    k.crack([[58, 60], [64, 70], [62, 80]], [[78, 58], [84, 66]]),
    k.particles(8, [10, 10, 110, 50]),
  ].join(''),
};

const e0003: EnemyDesign = {
  shape: 'beast',
  crown: [60, 40, 0.8],
  draw: (k) => [
    // 泥灘
    k.f('M10 106C30 98 90 98 110 106C90 112 30 112 10 106Z', '#2b2140', 0.7),
    // 後腿
    k.p('M18 92C8 86 8 72 20 70C26 80 30 88 34 96Z', k.S),
    k.p('M102 92C112 86 112 72 100 70C94 80 90 88 86 96Z', k.S),
    // 身體
    k.p('M20 96C14 80 22 58 40 52C50 48 70 48 80 52C98 58 106 80 100 96C90 104 30 104 20 96Z'),
    // 背上的晶體
    k.cluster(60, 54, 12),
    // 凸眼
    k.e(38, 52, 11, 10), k.e(82, 52, 11, 10),
    k.eye(38, 50, 5, { slit: true }), k.eye(82, 50, 5, { slit: true }),
    // 大嘴
    k.l('M26 70Q60 84 94 70', INK, 2.6),
    // 毒喉囊
    k.e(60, 88, 22, 13, k.rad('sac', ['#f0d2ff', '#b56cff', '#5a2190']), 2),
    k.e(52, 84, 3, 3, '#f6ecff', 0, 'opacity=".7"'), k.e(64, 90, 2, 2, '#f6ecff', 0, 'opacity=".6"'), k.e(70, 84, 1.6, 1.6, '#f6ecff', 0, 'opacity=".6"'),
    // 前腳
    k.p('M30 94L18 106L24 104L28 108L34 104L38 106L38 96Z', k.B, 1.8),
    k.p('M90 94L102 106L96 104L92 108L86 104L82 106L82 96Z', k.B, 1.8),
    // 泥滴
    k.f('M42 100q2 6 0 8q-2-2 0-8Z', '#3a2a50'),
    k.crack([[28, 66], [34, 74], [32, 82]], [[92, 64], [86, 72]]),
    k.particles(9, [6, 12, 114, 60]),
  ].join(''),
};

const e0004: EnemyDesign = {
  shape: 'beast',
  crown: [36, 22, 0.6],
  draw: (k) => [
    // 枯萎的花
    k.l('M98 108q-2-8 2-12M106 108q1-6-2-9', '#6f6a54', 1.4),
    k.e(100, 95, 2.6, 2, '#8b7f63', 0), k.e(104, 98, 2.4, 1.8, '#8b7f63', 0),
    k.leg(48, 72, 106, 5, k.D, false), k.leg(84, 72, 106, 5, k.D, false),
    k.p('M88 56C96 52 100 58 96 62Z', k.B, 1.6),
    k.p('M40 56C50 50 76 50 88 56C96 60 96 72 88 76C76 80 52 80 42 76C34 72 34 60 40 56Z'),
    k.leg(54, 74, 108, 5.5, k.B, false), k.leg(90, 72, 108, 5.5, k.B, false),
    // 頸與頭
    k.p('M38 62C34 50 32 42 34 34L46 32C46 42 50 52 54 58Z'),
    k.p('M46 30C44 24 38 22 30 24L20 30C18 34 20 37 24 37L36 39C44 39 48 35 46 30Z'),
    k.p('M44 26L56 22L46 31Z', k.S, 1.6),
    k.e(20, 33, 1.6, 1.4, INK, 0),
    k.eye(33, 29, 2.6),
    // 星骸晶體鹿角
    k.g(k.glowAttr,
      k.l('M40 24C40 14 46 8 52 2M44 14L56 12M48 8L52 14M38 24C34 14 28 10 22 4M32 14L22 14M28 9L30 3', k.crystal, 4),
      k.l('M40 24C40 14 46 8 52 2M44 14L56 12M48 8L52 14M38 24C34 14 28 10 22 4M32 14L22 14M28 9L30 3', k.crystalCore, 1.4),
    ),
    // 鳴叫的光波
    k.l('M14 26q-4 4 0 8M9 23q-6 7 0 14', k.t.hi, 1.4, 'opacity=".7"'),
    k.crack([[56, 58], [62, 66], [60, 74]], [[74, 56], [78, 64]]),
    k.particles(12, [8, 40, 112, 104]),
  ].join(''),
};

const e0005: EnemyDesign = {
  shape: 'spirit',
  crown: [60, 30, 0.8],
  draw: (k) => [
    // 黑影本體（模糊、半透明）
    k.g('opacity=".92"',
      k.f('M28 98C18 76 24 46 42 36L46 20L54 34C58 33 62 33 66 34L74 20L78 36C96 46 102 76 92 98C78 106 42 106 28 98Z', '#140a2a', 1, k.blurAttr),
      k.f('M32 96C24 76 30 50 44 40L48 26L55 37C58 36 62 36 65 37L72 26L76 40C90 50 96 76 88 96C76 102 44 102 32 96Z', '#1d0f3a'),
    ),
    k.l('M48 26L55 37M72 26L65 37', k.t.base, 1.2, 'opacity=".7"'),
    // 眼睛與笑
    k.eye(48, 56, 6, { slit: true, angry: -1, color: '#ffe066' }),
    k.eye(72, 56, 6, { slit: true, angry: 1, color: '#ffe066' }),
    k.l('M46 72Q60 80 74 72', k.t.glow, 1.8, k.glowAttr),
    k.fangs(52, 68, 75, 4, 3),
    // 爪子：只有爪看得見
    ...[[-1, 26], [1, 94]].map(([s, x]) => [0, 1, 2].map((i) =>
      k.p(`M${x} ${74 + i * 8}C${x + s * 8} ${70 + i * 8} ${x + s * 18} ${74 + i * 8} ${x + s * 22} ${84 + i * 8}C${x + s * 14} ${80 + i * 8} ${x + s * 8} ${80 + i * 8} ${x} ${80 + i * 8}Z`, k.lin('claw', ['#ffffff', k.t.hi, '#9b7ad0']), 1.4),
    ).join('')),
    k.crack([[56, 40], [60, 46], [58, 50]]),
    k.shard(60, 92, 9),
    k.particles(10),
  ].join(''),
};

// ---------- 第 2 章：工匠座（鏽齒工坊） ----------

const e0006: EnemyDesign = {
  shape: 'machine',
  crown: [60, 32, 0.8],
  draw: (k) => {
    const brass = metal(k, '#c7984a');
    return [
      // 掃描光
      k.f('M52 48L4 96L32 106Z', k.t.hi, 0.25),
      // 斷掉的底座與垂下的電線
      k.p('M18 108L26 92L94 92L102 108Z', stone(k)),
      k.l('M40 96q-2 6 2 10M76 96q4 5 0 10', INK, 1.6),
      // 軀幹
      k.p('M28 62L92 62L98 94L86 88L76 96L64 88L52 96L42 88L22 94Z', brass),
      k.l('M34 72L86 72M36 82L84 82', '#6b4c10', 1.2),
      k.e(42, 76, 3, 3, rust, 0, 'opacity=".8"'), k.e(80, 86, 4, 2.5, rust, 0, 'opacity=".8"'),
      // 肩上齒輪與手臂（左手長槍）
      k.gear(24, 64, 11, 9, brass, 10), k.gear(96, 64, 11, 9, brass),
      k.p('M18 70L10 92L16 94L24 74Z', brass, 1.8),
      k.l('M12 94L4 108', INK, 3), k.p('M10 18L14 34L6 34Z', k.G, 1.4),
      k.l('M10 34L8 96', '#6b4c10', 2.6),
      k.p('M102 70L110 88L104 92L98 74Z', brass, 1.8),
      // 頭罩＋單眼
      k.p('M40 62C40 36 80 36 80 62Z', brass),
      k.p('M46 50L74 50L72 58L48 58Z', INK, 1.2),
      k.eye(60, 54, 5, { color: k.t.glow }),
      k.l('M60 36L60 28', INK, 2), k.e(60, 26, 2.6, 2.6, k.t.glow, 1.2),
      // 胸口裂開長出的晶體
      k.crack([[60, 66], [56, 74], [62, 80], [58, 88]]),
      k.cluster(66, 80, 10, 20),
      k.particles(8, [6, 10, 114, 50]),
    ].join('');
  },
};

const e0007: EnemyDesign = {
  shape: 'machine',
  crown: [26, 38, 0.7, -8],
  draw: (k) => {
    const gun = metal(k, '#7a6b9a');
    const oil = (x: number, y: number, s = 1) => k.p(`M${x} ${y}q${3 * s} ${6 * s} 0 ${8 * s}q${-3 * s}-${2 * s} 0-${8 * s}Z`, '#0a0814', 1) + k.e(x - 0.6 * s, y + 5 * s, 0.6 * s, 1 * s, '#9b8ac8', 0);
    return [
      k.f('M30 106C46 102 70 102 92 106C76 110 46 110 30 106Z', '#0a0814', 0.9),
      // 尾巴天線
      k.l('M88 58L100 40', INK, 2.6), k.e(100, 40, 3, 3, k.t.glow, 1.2),
      // 遠側腳（關節節段）
      k.p('M42 76L38 92L44 106L50 106L46 92L48 78Z', k.D, 1.8),
      k.p('M80 76L84 92L78 106L84 106L90 92L86 78Z', k.D, 1.8),
      // 身體
      k.p('M32 54L86 52L94 62L90 80L36 82L28 70Z', gun),
      k.l('M40 60L84 58M40 70L86 68', '#2b2e44', 1.2),
      k.gear(62, 66, 8, 8, k.B),
      // 近側腳
      k.p('M48 78L44 94L50 108L58 108L52 94L56 80Z', gun, 1.8),
      k.p('M86 76L92 92L86 108L94 108L100 92L94 76Z', gun, 1.8),
      k.e(52, 94, 3.4, 3.4, k.S, 1.4), k.e(94, 92, 3.4, 3.4, k.S, 1.4),
      oil(52, 98), oil(94, 96, 0.8), oil(36, 82, 0.9),
      // 頭
      k.p('M12 46L36 40L42 56L34 66L14 64L8 54Z', gun),
      k.p('M10 58L32 60L30 68L14 68Z', k.S, 1.6),
      k.fangs(12, 30, 60, 5, 3.5),
      k.p('M30 42L34 28L40 42Z', gun, 1.6),
      k.eye(22, 50, 4, { angry: -1, color: '#ff5fa2' }),
      oil(16, 68, 0.9),
      k.crack([[56, 56], [50, 64], [54, 72]], [[74, 56], [78, 62], [74, 70]]),
      k.shard(70, 54, 10, 10),
    ].join('');
  },
};

const e0008: EnemyDesign = {
  shape: 'machine',
  crown: [60, 18, 0.8],
  draw: (k) => {
    const iron = metal(k, '#b86a54');
    const legs = [[34, -1], [44, -1], [76, 1], [86, 1]].map(([x, s]) =>
      k.p(`M${x} 80L${x + s * 12} 92L${x + s * 6} 108L${x + s * 10} 108L${x + s * 18} 92L${x + s * 4} 76Z`, iron, 1.8)).join('');
    return [
      // 被吸回去的蒸氣漩渦
      k.l('M60 6C88 4 108 26 102 50M60 6C32 4 12 26 18 50', k.t.hi, 2.2, 'opacity=".55"'),
      k.p('M100 44L104 54L96 50Z', k.t.hi, 0, 'opacity=".7"'),
      k.p('M20 44L16 54L24 50Z', k.t.hi, 0, 'opacity=".7"'),
      k.e(30, 20, 9, 6, '#e9e4f2', 0, `opacity=".5" ${k.blurAttr}`), k.e(90, 18, 10, 6, '#e9e4f2', 0, `opacity=".5" ${k.blurAttr}`),
      legs,
      // 煙囪
      k.p('M68 28L68 14L80 14L80 32Z', iron),
      k.p('M66 12L82 12L82 16L66 16Z', k.S, 1.4),
      // 鍋爐本體
      k.p('M32 40C32 28 88 28 88 40L88 76C88 88 32 88 32 76Z', iron),
      k.l('M32 46C40 50 80 50 88 46M32 70C40 74 80 74 88 70', '#4a2020', 1.6),
      ...[38, 50, 62, 74, 84].map((x) => k.e(x, 47.5, 1.3, 1.3, '#ffd9c4', 0)),
      // 壓力計
      k.e(46, 38, 7, 7, '#f6ede2', 1.8), k.l('M46 38L51 34', '#c0281a', 1.6),
      // 火門
      k.p('M46 54L74 54L74 68L46 68Z', k.rad('fur', [k.t.core, k.t.glow, k.t.base]), 2),
      k.l('M52 54L52 68M60 54L60 68M68 54L68 68', INK, 1.6),
      k.eye(70, 38, 3.4, { angry: 1 }),
      k.crack([[36, 52], [40, 60], [36, 66]], [[84, 54], [80, 62]]),
      k.cluster(60, 30, 9),
      k.particles(10, [20, 50, 100, 104]),
    ].join('');
  },
};

const e0009: EnemyDesign = {
  shape: 'machine',
  crown: [30, 38, 0.6],
  draw: (k) => {
    const wing = (d: string) => k.p(d, '#e9f7ff', 1.4, 'fill-opacity=".45"');
    const tiny = (x: number, y: number) => k.g(`transform="translate(${x} ${y}) scale(.32)"`,
      k.e(10, 0, 14, 10, k.B, 3), k.e(-10, -2, 9, 9, k.S, 3), k.e(-12, -3, 4, 4, k.t.glow, 0));
    return [
      tiny(96, 22), tiny(16, 94),
      // 翅膀（邊緣是齒輪齒）
      wing('M44 50C34 22 50 10 64 18C70 30 60 44 48 54Z'),
      wing('M54 52C60 26 82 20 90 32C90 44 72 52 58 56Z'),
      k.gear(60, 30, 6, 7, k.S, 8),
      // 腹部（條紋）
      k.p('M54 60C60 46 90 46 98 62C104 76 92 88 76 86C62 84 50 74 54 60Z'),
      k.l('M64 52C60 62 64 76 70 84M78 50C74 62 78 76 84 86M90 56C86 64 88 76 94 82', INK, 4),
      k.p('M98 70L112 76L98 78Z', k.S, 1.6),
      // 胸部
      k.e(46, 60, 12, 11, metal(k, '#7fae6a')),
      k.gear(46, 60, 6, 8, k.B),
      k.l('M40 70L34 84M46 72L44 88M52 70L56 84', INK, 2),
      // 頭與口器
      k.e(30, 54, 10, 10, metal(k, '#7fae6a')),
      k.eye(26, 52, 5, { color: k.t.glow }),
      k.p('M22 62L16 70L24 66L28 72L30 62Z', '#e7f0e0', 1.4),
      k.l('M30 46L26 34M34 46L40 34', INK, 1.6), k.e(26, 33, 2, 2, k.t.glow, 1), k.e(40, 33, 2, 2, k.t.glow, 1),
      k.crack([[70, 56], [74, 64], [80, 66]]),
      k.shard(86, 54, 9, 30),
      k.particles(6),
    ].join('');
  },
};

const e0010: EnemyDesign = {
  shape: 'machine',
  crown: [60, 16, 0.8],
  draw: (k) => {
    const bronze = metal(k, '#5f8fc4');
    return [
      // 鐘聲波紋
      k.l('M14 46q-8 14 0 28M8 40q-12 20 0 40M106 46q8 14 0 28M112 40q12 20 0 40', k.t.light, 1.8, 'opacity=".6"'),
      // 吊架
      k.p('M30 92L34 22C34 12 86 12 86 22L90 92L84 92L80 24C80 18 40 18 40 24L36 92Z', k.D, 1.8),
      k.gear(60, 18, 7, 8, k.G),
      // 鐘身
      k.p('M60 24C44 24 38 36 38 52C38 70 32 80 24 88L96 88C88 80 82 70 82 52C82 36 76 24 60 24Z', bronze),
      k.p('M22 86L98 86L98 92L22 92Z', k.S, 1.8),
      k.l('M40 46L80 46', '#163f8a', 1.2),
      // 封印紋（星紋熄滅的圓陣）
      `<circle cx="60" cy="64" r="13" fill="none" stroke="${k.t.hi}" stroke-width="1.4" stroke-dasharray="3 2"/>`,
      k.f(polyStar(60, 64, 11, 5, 6), k.t.hi, 0.35),
      k.eye(60, 64, 5.5, { color: k.t.glow }),
      // 鐘錘與三隻短腳
      k.e(60, 98, 6, 6, bronze),
      k.l('M60 92L60 98', INK, 2),
      k.p('M30 92L24 108L32 108L36 92Z', k.D, 1.6), k.p('M84 92L88 108L96 108L90 92Z', k.D, 1.6),
      k.crack([[48, 30], [44, 40], [48, 50]], [[74, 34], [78, 42]]),
      k.shard(70, 28, 9, 24),
      k.particles(8),
    ].join('');
  },
};

// ---------- 第 3 章：羽座（雲林） ----------

/** 正面展翅的鳥形：迷霧羽妖、枯羽鴞、狂嵐羽后共用 */
function bird(k: Kit, o: { feather: string; tip: string; wingSpan: number }): string {
  const w = o.wingSpan;
  const wingL = `M48 52C${48 - w * 0.5} 38 ${60 - w} 34 ${60 - w} 50C${60 - w + 4} 52 ${60 - w + 2} 58 ${60 - w + 8} 60C${60 - w + 8} 66 ${60 - w + 14} 68 ${60 - w + 18} 70C${60 - w + 22} 76 ${42} 78 50 72Z`;
  const wingR = `M72 52C${72 + w * 0.5} 38 ${60 + w} 34 ${60 + w} 50C${60 + w - 4} 52 ${60 + w - 2} 58 ${60 + w - 8} 60C${60 + w - 8} 66 ${60 + w - 14} 68 ${60 + w - 18} 70C${60 + w - 22} 76 ${78} 78 70 72Z`;
  return [
    k.p(wingL, o.feather), k.p(wingR, o.feather),
    k.l(`M${60 - w + 2} 52L48 58M${60 - w + 10} 62L50 64M${60 + w - 2} 52L72 58M${60 + w - 10} 62L70 64`, o.tip, 2),
  ].join('');
}

const e0011: EnemyDesign = {
  shape: 'winged',
  crown: [60, 22, 0.7],
  draw: (k) => [
    // 翅膀拍出的霧
    k.e(18, 78, 16, 8, k.t.hi, 0, `opacity=".55" ${k.blurAttr}`),
    k.e(102, 78, 16, 8, k.t.hi, 0, `opacity=".55" ${k.blurAttr}`),
    k.e(60, 102, 30, 7, '#ffffff', 0, `opacity=".4" ${k.blurAttr}`),
    bird(k, { feather: k.B, tip: k.t.dark, wingSpan: 50 }),
    // 長尾羽
    k.p('M54 80L46 108L56 96L60 110L64 96L74 108L66 80Z', k.S),
    // 身體
    k.p('M46 52C46 38 74 38 74 52C76 68 70 84 60 86C50 84 44 68 46 52Z'),
    k.l('M52 62q8 4 16 0M52 70q8 4 16 0', k.t.dark, 1.4),
    // 頭：面具般的臉、長冠羽
    k.p('M58 30C50 20 52 10 56 4C58 14 60 20 62 30Z', k.t.light, 1.6),
    k.p('M54 32C48 24 40 22 36 18C42 26 46 32 52 36Z', k.t.light, 1.6),
    k.p('M66 32C72 24 80 22 84 18C78 26 74 32 68 36Z', k.t.light, 1.6),
    k.e(60, 40, 12, 11),
    k.p('M50 36Q60 30 70 36L68 44Q60 40 52 44Z', '#fffbe8', 1.4),
    k.eye(55, 39, 2.6, { slit: true }), k.eye(65, 39, 2.6, { slit: true }),
    k.p('M57 46L60 54L63 46Z', k.t.dark, 1.4),
    k.crack([[52, 56], [56, 64], [54, 72]], [[30, 48], [36, 56]], [[90, 48], [84, 56]]),
    k.shard(66, 62, 9, 20),
    k.particles(10),
  ].join(''),
};

const e0012: EnemyDesign = {
  shape: 'winged',
  crown: [60, 26, 0.8],
  draw: (k) => {
    const withered = k.lin('wither', ['#d8c27a', '#9a7f42', '#4a3a24']);
    return [
      // 被吸走的生氣（綠色光絲流向牠）
      k.l('M6 30C20 34 28 44 38 52M114 30C100 34 92 44 82 52M10 96C22 88 30 84 40 82', '#8cf0a0', 1.4, 'opacity=".7" stroke-dasharray="2 3"'),
      // 枯枝
      k.p('M10 98L110 94L110 100L10 104Z', '#3a2a24', 1.6),
      k.l('M24 100l-6 8M94 96l8 10', '#3a2a24', 2.4),
      bird(k, { feather: withered, tip: k.t.base, wingSpan: 44 }),
      // 身體
      k.p('M36 60C36 32 84 32 84 60C84 84 74 96 60 96C46 96 36 84 36 60Z'),
      k.p('M44 68C44 84 52 92 60 92C68 92 76 84 76 68C70 74 50 74 44 68Z', withered, 1.4),
      k.l('M50 78l4 3 4-3 4 3 4-3 4 3M52 86l4 3 4-3 4 3 4-3', k.t.dark, 1.2),
      // 耳羽
      k.p('M40 42L34 24L50 36Z', withered, 1.8), k.p('M80 42L86 24L70 36Z', withered, 1.8),
      // 臉盤與大眼
      k.e(49, 50, 11, 10, k.t.light, 1.6), k.e(71, 50, 11, 10, k.t.light, 1.6),
      k.eye(49, 50, 6.5), k.eye(71, 50, 6.5),
      k.l('M38 40L56 46M82 40L64 46', INK, 2.4),
      k.p('M57 56L60 66L63 56Z', '#e0b85a', 1.4),
      // 腳爪
      k.l('M52 94l-3 6M56 94l0 6M64 94l0 6M68 94l3 6', '#e0b85a', 2),
      k.crack([[40, 62], [44, 70], [42, 78]], [[80, 60], [76, 70]]),
      k.cluster(60, 38, 9),
    ].join('');
  },
};

const e0013: EnemyDesign = {
  shape: 'spirit',
  crown: [60, 18, 0.8],
  draw: (k) => {
    const tentacle = (x: number, sway: number, len: number) =>
      k.l(`M${x} 62C${x + sway} ${70} ${x - sway} ${80} ${x + sway * 0.6} ${62 + len}`, k.t.light, 3, 'opacity=".9"')
      + k.e(x + sway * 0.6, 62 + len, 2.4, 2.4, '#b56cff', 1);
    return [
      // 雲
      k.e(30, 92, 20, 10, '#e8f2ff', 0, `opacity=".7" ${k.blurAttr}`),
      k.e(88, 96, 22, 10, '#e8f2ff', 0, `opacity=".7" ${k.blurAttr}`),
      tentacle(40, -6, 34), tentacle(50, 5, 42), tentacle(60, -4, 46), tentacle(70, 6, 40), tentacle(80, -5, 32),
      // 口腕
      k.p('M52 60C48 74 56 82 54 92C62 84 64 72 68 60Z', k.S, 1.6, 'fill-opacity=".85"'),
      // 傘
      k.p('M22 62C20 36 40 20 60 20C80 20 100 36 98 62C92 58 88 66 82 62C76 66 70 60 64 64C56 60 50 66 44 62C38 66 32 58 22 62Z', k.B, 2.2, 'fill-opacity=".88"'),
      k.e(60, 40, 16, 12, k.t.hi, 0, 'opacity=".35"'),
      k.l('M36 50Q60 34 84 50', k.t.hi, 1.2, 'opacity=".7"'),
      // 傘裡的晶核
      k.cluster(60, 50, 12),
      k.eye(44, 46, 3), k.eye(76, 46, 3),
      k.crack([[32, 44], [38, 52]], [[88, 44], [82, 52]]),
      k.particles(10),
    ].join('');
  },
};

const e0014: EnemyDesign = {
  shape: 'spirit',
  crown: [60, 8, 0.6],
  draw: (k) => {
    const spore = (x: number, y: number, r: number) => k.e(x, y, r, r, '#b56cff', 0, 'opacity=".75"') + k.e(x - r * 0.3, y - r * 0.3, r * 0.35, r * 0.35, '#f6ecff', 0);
    return [
      // 紫色孢子雲
      k.e(60, 14, 30, 10, '#9b5de5', 0, `opacity=".35" ${k.blurAttr}`),
      spore(30, 10, 3), spore(42, 4, 2.2), spore(78, 6, 2.6), spore(92, 14, 3.2), spore(22, 24, 2), spore(98, 28, 2.2),
      // 葉子裙
      k.p('M60 70C44 72 30 88 26 106L40 100L46 108L54 100L60 108L66 100L74 108L80 100L94 106C90 88 76 72 60 70Z', k.S),
      k.l('M60 74L60 104M46 82L40 100M74 82L80 100', k.t.light, 1.2),
      // 手臂藤蔓
      k.l('M48 72C38 70 30 62 24 64M72 72C82 70 90 62 96 64', k.t.dark, 3),
      k.p('M24 64C16 60 14 54 20 52C22 58 26 60 24 64Z', k.B, 1.4), k.p('M96 64C104 60 106 54 100 52C98 58 94 60 96 64Z', k.B, 1.4),
      // 頭
      k.e(60, 58, 14, 13),
      k.eye(54, 58, 3, { angry: -1 }), k.eye(66, 58, 3, { angry: 1 }),
      k.l('M55 66q5 3 10 0', INK, 1.6),
      // 頭上的毒花
      k.l('M60 46L60 38', k.t.dark, 3),
      ...[0, 72, 144, 216, 288].map((deg) => k.p('M60 32C54 22 56 14 60 12C64 14 66 22 60 32Z', k.lin('petal', ['#f0d2ff', '#b56cff', '#5a2190']), 1.6, `transform="rotate(${deg} 60 30)"`)),
      k.e(60, 30, 6, 6, k.rad('pist', ['#fff6b0', '#dcff6e', '#4cbf6a']), 1.6),
      k.crack([[50, 50], [54, 56]], [[60, 80], [56, 90], [62, 98]]),
      k.shard(70, 80, 8, 20),
    ].join('');
  },
};

const e0015: EnemyDesign = {
  shape: 'spirit',
  crown: [56, 22, 0.6, -8],
  draw: (k) => [
    // 逆風線
    k.l('M118 30C90 30 84 40 64 36M118 54C96 52 90 62 70 60M118 80C98 78 92 88 74 86M116 98C100 98 94 104 82 104', k.t.hi, 1.8, 'opacity=".65"'),
    k.l('M70 60q-8 2-6-6M64 36q-8 2-6-6', k.t.hi, 1.6, 'opacity=".65"'),
    // 蜻蜓翅
    k.p('M50 52C30 34 14 36 12 44C18 52 34 54 48 56Z', '#fff4e6', 1.4, 'fill-opacity=".5"'),
    k.p('M50 58C32 66 20 76 24 82C32 82 42 72 50 62Z', '#fff4e6', 1.4, 'fill-opacity=".5"'),
    k.p('M64 52C84 34 100 36 102 44C96 52 80 54 66 56Z', '#fff4e6', 1.4, 'fill-opacity=".5"'),
    k.p('M64 58C82 66 94 76 90 82C82 82 72 72 64 62Z', '#fff4e6', 1.4, 'fill-opacity=".5"'),
    // 身體（洋裝）
    k.p('M50 56C46 66 44 78 46 88L68 88C70 78 68 66 64 56Z'),
    k.l('M52 88L50 100M62 88L64 100', INK, 2.6),
    // 頭與火焰頭髮
    k.p('M44 38C40 26 46 16 50 10C50 18 54 20 56 14C58 20 62 20 64 10C70 18 74 28 70 40Z', k.lin('flame', [k.t.core, k.t.glow, k.t.base]), 1.6),
    k.e(57, 42, 11, 11, '#ffe9de'),
    k.eye(53, 42, 2.6, { angry: -1 }), k.eye(62, 42, 2.6, { angry: 1 }),
    k.l('M54 49q3 2 6 0', INK, 1.4),
    // 吹氣
    k.l('M44 48q-6 0-10 4', k.t.hi, 1.6),
    k.crack([[54, 62], [58, 70], [56, 78]]),
    k.shard(64, 66, 7, 24),
    k.particles(12, [20, 4, 112, 108]),
  ].join(''),
};

// ---------- 第 4 章：龍座（龍脊火山） ----------

/** 正面展翼的龍翼（左右對稱），x0/y0 為翼根 */
function dragonWings(k: Kit, fill: string, span: number, y0: number, membrane = true): string {
  const one = (s: number) => {
    const x0 = 60 + s * 12;
    const tip = 60 + s * span;
    const bones = `M${x0} ${y0}L${tip} ${y0 - 28}M${tip} ${y0 - 28}L${60 + s * span * 0.78} ${y0 + 8}M${tip} ${y0 - 28}L${60 + s * span * 0.5} ${y0 + 14}`;
    const skin = `M${x0} ${y0}L${tip} ${y0 - 28}L${60 + s * span * 0.95} ${y0 - 4}L${60 + s * span * 0.78} ${y0 + 8}L${60 + s * span * 0.64} ${y0 + 6}L${60 + s * span * 0.5} ${y0 + 14}L${x0} ${y0 + 14}Z`;
    return (membrane ? k.p(skin, fill, 2) : '') + k.l(bones, membrane ? INK : '#e8dcc0', membrane ? 2.2 : 3.4);
  };
  return one(-1) + one(1);
}

const e0016: EnemyDesign = {
  shape: 'serpent',
  crown: [60, 30, 0.6],
  draw: (k) => [
    dragonWings(k, k.S, 52, 52),
    // 尾
    k.p('M64 74C76 84 84 96 98 98C88 102 74 96 60 82Z', k.B, 1.8),
    k.p('M96 94L106 98L96 102Z', k.t.dark, 1.4),
    // 身體與腳
    k.p('M48 50C48 40 72 40 72 50L70 76C68 84 52 84 50 76Z'),
    k.p('M50 60C52 70 54 78 60 80C66 78 68 70 70 60C66 66 54 66 50 60Z', k.t.light, 1.4),
    k.l('M52 80l-4 8M68 80l4 8', INK, 2.6),
    // 熔岩裂紋
    k.g(k.glowAttr, k.l('M54 50L58 56L56 62M66 52L64 58', k.t.glow, 1.6)),
    // 頭
    k.p('M50 42C46 30 52 22 60 22C68 22 74 30 70 42C68 48 52 48 50 42Z'),
    k.p('M52 26L44 14L54 22ZM68 26L76 14L66 22Z', k.t.dark, 1.6),
    k.eye(54, 34, 2.8, { slit: true, angry: -1 }), k.eye(66, 34, 2.8, { slit: true, angry: 1 }),
    k.p('M54 44Q60 50 66 44L64 48Q60 52 56 48Z', '#3a0d08', 1.2),
    // 連吐三團火
    ...[[30, 104, 6], [16, 96, 5], [40, 94, 4.5]].map(([x, y, r]) =>
      k.e(x, y, r, r, k.rad('fb', [k.t.core, k.t.glow, k.t.base]), 1.4, k.glowAttr)),
    k.l('M58 50Q46 76 32 98', k.t.glow, 2, 'opacity=".5" stroke-dasharray="3 3"'),
    k.cluster(60, 60, 8),
    k.particles(10),
  ].join(''),
};

const e0017: EnemyDesign = {
  shape: 'beast',
  crown: [24, 52, 0.7, -6],
  draw: (k) => {
    // 城牆般的背甲（垛口）
    const merlons = [36, 50, 64, 78, 92].map((x, i) =>
      k.p(`M${x} 58L${x} ${42 - (i % 2) * 4}L${x + 12} ${42 - (i % 2) * 4}L${x + 12} 58Z`, stone(k), 1.8)).join('');
    return [
      // 尾
      k.p('M96 70C106 72 114 82 116 96C108 88 100 84 94 82Z', k.S),
      k.leg(42, 80, 104, 10, k.D), k.leg(86, 80, 104, 10, k.D),
      merlons,
      // 身體
      k.p('M24 70C26 58 46 54 70 54C94 54 104 62 104 74C104 84 90 90 66 90C42 90 22 84 24 70Z'),
      k.l('M34 64L98 64M30 76L102 76', k.t.dark, 1.4),
      ...[40, 56, 72, 88].map((x) => k.l(`M${x} 56L${x + 2} 64M${x + 6} 64L${x + 8} 76`, k.t.dark, 1.2)).join(''),
      k.leg(50, 82, 108, 12), k.leg(94, 82, 108, 12),
      // 頭
      k.p('M30 62C20 58 10 62 6 70L6 76C14 82 26 82 34 78Z'),
      k.p('M10 66L18 60L26 62L22 68Z', stone(k), 1.4),
      k.l('M6 74L24 74', INK, 1.8),
      k.eye(20, 68, 2.8, { slit: true, angry: -1 }),
      k.crack([[60, 66], [64, 72], [62, 80]], [[78, 68], [82, 76]]),
      k.cluster(56, 44, 10),
      k.cluster(88, 40, 8, 10),
      k.particles(6, [6, 10, 114, 40]),
    ].join('');
  },
};

const e0018: EnemyDesign = {
  shape: 'serpent',
  crown: [34, 22, 0.6, -10],
  draw: (k) => {
    const body = 'M28 34C40 30 54 40 56 52C58 66 44 70 46 82C48 96 70 100 82 92C94 84 98 70 108 66';
    return [
      // 雷光身體：粗光帶＋亮芯（半透明）
      k.l(body, k.t.dark, 16, 'opacity=".55"'),
      k.g(k.glowAttr, k.l(body, k.t.base, 11), k.l(body, k.t.hi, 4)),
      // 閃電
      k.g(k.glowAttr,
        k.l('M64 18L56 32L64 34L54 48', k.t.core, 2.2),
        k.l('M98 30L92 42L98 44L90 56', k.t.core, 2),
        k.l('M18 76L26 86L20 88L28 100', k.t.core, 2),
      ),
      // 被光散開的蝕之力
      k.e(84, 100, 6, 3, '#2a1450', 0, `opacity=".6" ${k.blurAttr}`), k.e(100, 88, 5, 3, '#2a1450', 0, `opacity=".6" ${k.blurAttr}`),
      // 背鰭
      k.p('M48 42L56 34L56 46ZM52 62L62 58L56 68ZM58 92L64 84L68 96ZM86 88L96 82L92 94Z', k.t.light, 1.2),
      // 頭
      k.p('M38 32C34 22 26 18 16 20L6 28L10 34L20 34L14 40L26 42C34 42 40 38 38 32Z'),
      k.p('M30 22L40 10L36 24ZM24 20L28 8L20 20Z', k.X, 1.4),
      k.l('M6 28C2 26 0 20 2 16M10 34C6 38 4 44 6 48', k.t.hi, 1.4),
      k.eye(24, 28, 3, { slit: true, angry: -1 }),
      k.crack([[54, 50], [50, 58]], [[70, 94], [76, 88]]),
      k.particles(12),
    ].join('');
  },
};

const e0019: EnemyDesign = {
  shape: 'humanoid',
  crown: [56, 18, 0.6],
  draw: (k) => [
    // 三叉戟
    k.l('M88 12L84 108', '#5a6a88', 3.4),
    k.p('M80 18L82 4L84 14L88 2L90 14L94 4L94 20L86 22Z', metal(k, '#8fd0ff'), 1.4),
    // 尾
    k.p('M64 84C74 96 84 104 98 106C88 110 72 108 60 94Z', k.S, 1.8),
    // 腳
    k.p('M48 84L42 106L52 106L56 86Z', k.S), k.p('M62 84L66 106L76 106L68 84Z', k.S),
    // 軀幹與鎧甲
    k.p('M44 46C44 38 72 38 72 46L70 86L46 86Z'),
    k.p('M46 52L70 52L68 70L48 70Z', metal(k, '#8fd0ff'), 1.6),
    k.l('M58 52L58 70M48 61L68 61', '#163f8a', 1),
    // 圓盾（架式）
    k.e(36, 66, 14, 16, metal(k, '#5f8fc4'), 2.2),
    k.f(polyStar(36, 66, 9, 4, 5), k.t.hi, 0.6),
    k.e(36, 66, 3, 3, k.t.glow, 1),
    // 持戟手
    k.p('M70 50L86 56L86 62L70 58Z', k.B, 1.8),
    // 頭（龍人）
    k.p('M46 30C44 20 52 14 58 14C66 14 70 22 68 30L62 40L50 40Z'),
    k.p('M44 26L36 18L46 22ZM70 26L78 16L68 22Z', k.t.light, 1.4),
    k.p('M50 34L66 34L62 40L52 40Z', k.t.light, 1.2),
    k.eye(53, 27, 2.4, { slit: true, angry: -1 }), k.eye(63, 27, 2.4, { slit: true, angry: 1 }),
    // 鱗
    k.l('M48 76q3 3 6 0q3 3 6 0q3 3 6 0', k.t.dark, 1.2),
    k.crack([[62, 72], [64, 78], [60, 84]]),
    k.shard(48, 46, 8, -20),
    k.particles(8),
  ].join(''),
};

const e0020: EnemyDesign = {
  shape: 'serpent',
  crown: [60, 14, 0.7],
  draw: (k) => {
    const b = bone(k);
    return [
      // 破洞的翼膜＋骨
      k.g('opacity=".7"', dragonWings(k, k.lin('mem', ['#4a2183', '#241040']), 54, 48)),
      k.e(24, 40, 4, 3, '#0b1230', 0), k.e(98, 46, 3, 4, '#0b1230', 0),
      dragonWings(k, '', 54, 48, false),
      // 尾椎
      k.l('M60 84C70 96 86 100 104 96', b, 4), k.l('M60 84C70 96 86 100 104 96', INK, 1, 'stroke-dasharray="1 4"'),
      // 肋骨籠
      k.p('M48 44L72 44L74 80L46 80Z', '#0b0618', 1.6),
      k.l('M60 42L60 84', b, 4),
      ...[50, 58, 66, 74].map((y) => k.l(`M60 ${y}C52 ${y} 46 ${y + 4} 46 ${y + 8}M60 ${y}C68 ${y} 74 ${y + 4} 74 ${y + 8}`, b, 3)),
      // 籠中停擺的碎時鐘（時間對牠沒有意義）
      k.e(60, 64, 7, 7, '#f7efd8', 1.4, 'opacity=".9"'),
      k.l('M60 64L60 59M60 64L64 66', INK, 1.2), k.l('M55 60L62 69', k.crystal, 1),
      // 腳骨
      k.l('M50 80L44 92L48 106M70 80L76 92L72 106', b, 3.4),
      // 頭骨
      k.p('M48 30C46 18 54 12 60 12C66 12 74 18 72 30L68 42L52 42Z', b),
      k.p('M50 22L40 8L52 18ZM70 22L80 8L68 18Z', b, 1.6),
      k.e(54, 28, 4, 4.4, '#0b0618', 0), k.e(66, 28, 4, 4.4, '#0b0618', 0),
      k.eye(54, 28, 2.2), k.eye(66, 28, 2.2),
      k.fangs(52, 68, 38, 5, 4),
      k.crack([[56, 14], [58, 20]], [[64, 34], [62, 40]]),
      k.particles(10),
    ].join('');
  },
};

// ---------- 第 5 章：冥河座（冥河下游） ----------

const e0021: EnemyDesign = {
  shape: 'humanoid',
  crown: [52, 16, 0.6],
  draw: (k) => {
    const b = bone(k);
    return [
      // 冥河漩渦
      k.f('M4 100C24 92 44 104 60 98C78 92 96 104 116 98L116 112L4 112Z', k.lin('river', ['#4a2183', '#170a30'])),
      k.l('M10 102q10-6 20 0M50 104q10-6 20 0M88 102q10-6 20 0', k.t.light, 1.2, 'opacity=".6"'),
      // 船頭
      k.p('M18 92L96 92L88 104L26 104Z', '#3a2a24', 1.8),
      // 槳
      k.l('M90 20L70 104', '#6a4c32', 3.6),
      k.p('M66 96L76 100L72 112L62 108Z', '#6a4c32', 1.6),
      // 斗篷
      k.p('M38 34C34 50 30 76 26 92L82 92C78 76 74 50 70 34C64 28 44 28 38 34Z', k.S),
      k.l('M44 50L40 90M60 52L62 90', '#170a30', 1.4),
      // 骨手握槳
      k.l('M66 58L84 48M44 62L80 64', b, 3.4),
      k.e(84, 48, 3, 3, b, 1.4), k.e(80, 64, 3, 3, b, 1.4),
      // 兜帽與骷髏
      k.p('M36 38C34 20 46 12 54 12C64 12 74 20 72 38C68 32 40 32 36 38Z', k.B),
      k.p('M44 30C44 22 64 22 64 30L62 42L46 42Z', b, 1.8),
      k.e(50, 31, 3, 3.4, '#0b0618', 0), k.e(58, 31, 3, 3.4, '#0b0618', 0),
      k.eye(50, 31, 1.8), k.eye(58, 31, 1.8),
      k.l('M48 40L60 40M51 38L51 42M54 38L54 42M57 38L57 42', INK, 1),
      k.crack([[46, 62], [50, 70], [46, 78]]),
      k.cluster(54, 92, 9),
      k.particles(8, [6, 6, 114, 80]),
    ].join('');
  },
};

const e0022: EnemyDesign = {
  shape: 'spirit',
  crown: [60, 18, 0.7],
  draw: (k) => {
    const chain = (d: string) => k.l(d, '#7a6a48', 4) + k.l(d, '#e8d9a8', 2.2, 'stroke-dasharray="4 2"');
    return [
      // 甩出去的鎖鏈
      chain('M44 64C28 70 16 64 8 50'), chain('M76 64C92 74 100 90 112 96'), chain('M56 84C50 96 40 102 26 106'),
      k.p('M4 44L12 44L12 54L4 54Z', '#7a6a48', 1.6), k.p('M108 92L116 92L116 102L108 102Z', '#7a6a48', 1.6),
      // 幽靈身體（尾巴漸隱）
      k.p('M38 52C36 30 48 18 60 18C72 18 84 30 82 52C82 70 76 84 70 96C66 90 64 100 60 106C56 98 52 92 48 98C44 86 38 70 38 52Z', k.lin('ghost', [k.t.hi, k.t.light, k.t.base]), 2, 'fill-opacity=".92"'),
      // 頸枷
      k.p('M42 56L78 56L76 64L44 64Z', '#7a6a48', 1.6),
      // 臉
      k.e(52, 40, 4.4, 5.2, '#2a1a08', 0), k.e(68, 40, 4.4, 5.2, '#2a1a08', 0),
      k.eye(52, 41, 2.2, { color: k.t.glow }), k.eye(68, 41, 2.2, { color: k.t.glow }),
      k.p('M54 48Q60 54 66 48Q60 58 54 48Z', '#2a1a08', 1),
      // 手（伸向前）
      k.p('M38 60C30 62 26 68 24 74L30 72L34 66Z', k.lin('ghost', []), 1.6),
      k.p('M82 60C90 62 94 68 96 74L90 72L86 66Z', k.lin('ghost', []), 1.6),
      k.crack([[56, 66], [60, 74], [58, 82]], [[48, 24], [52, 30]]),
      k.shard(70, 70, 8, 20),
      k.particles(10),
    ].join('');
  },
};

const e0023: EnemyDesign = {
  shape: 'humanoid',
  crown: [60, 12, 0.7],
  draw: (k) => [
    // 熄滅的光環
    `<circle cx="60" cy="30" r="20" fill="none" stroke="${k.t.light}" stroke-width="2" stroke-dasharray="6 4" opacity=".6"/>`,
    // 長袍
    k.p('M40 46C34 66 26 90 22 106L98 106C94 90 86 66 80 46Z', k.S),
    k.l('M50 60L44 104M70 60L76 104M60 64L60 104', '#0f2a5a', 1.4),
    // 頭紗
    k.p('M40 50C36 28 46 16 60 16C74 16 84 28 80 50C76 44 72 40 72 32C72 26 48 26 48 32C48 40 44 44 40 50Z', k.B),
    // 白色頭巾與沒有嘴的臉
    k.p('M48 30C48 22 72 22 72 30L72 40C72 48 66 52 60 52C54 52 48 48 48 40Z', '#f2f4ff', 1.8),
    k.e(60, 38, 9, 10, '#d9deef', 0),
    k.eye(55, 37, 2.2, { color: k.t.glow }), k.eye(65, 37, 2.2, { color: k.t.glow }),
    k.l('M55 46L65 46', '#b8c0dc', 1.2, 'opacity=".6"'),
    // 合十的手與念珠
    k.p('M54 62L60 52L66 62L62 70L58 70Z', '#f2f4ff', 1.6),
    k.l('M48 60C48 76 54 84 60 86C66 84 72 76 72 60', '#e8d9a8', 1.4, 'stroke-dasharray="1.5 2.5"'),
    k.f(starPath(60, 88, 3.6), k.t.hi),
    // 祈禱聲（封印字紋）
    k.l('M24 46q-4 6 0 12M18 42q-6 10 0 20M96 46q4 6 0 12M102 42q6 10 0 20', k.t.light, 1.4, 'opacity=".6"'),
    k.crack([[46, 74], [42, 84], [46, 94]], [[72, 76], [76, 86]]),
    k.shard(80, 92, 9, 20),
    k.particles(8),
  ].join(''),
};

const e0024: EnemyDesign = {
  shape: 'spirit',
  crown: [56, 10, 0.6],
  draw: (k) => {
    const flame = k.lin('wisp', [k.t.core, k.t.glow, k.t.base, k.t.dark]);
    const wisp = (x: number, y: number, s: number) => k.g(`transform="translate(${x} ${y}) scale(${s})"`,
      k.p('M0 -14C6 -8 8 -2 6 4C4 8 -4 8 -6 4C-8 -2 -4 -6 0 -14Z', flame, 2),
      k.e(-2, 0, 1.3, 1.6, INK, 0), k.e(2.4, 0, 1.3, 1.6, INK, 0));
    return [
      wisp(18, 40, 1.1), wisp(102, 48, 1),
      // 提燈（吊鉤＋燈籠）
      k.l('M60 6L60 18', INK, 2), k.e(60, 6, 4, 4, 'none', 1.8),
      k.p('M46 22L74 22L70 28L50 28Z', '#3a2a24', 1.6),
      k.p('M48 28C40 44 40 72 48 86L72 86C80 72 80 44 72 28Z', '#3a2a24', 2),
      k.p('M52 32C46 46 46 70 52 82L68 82C74 70 74 46 68 32Z', k.rad('lamp', [k.t.core, k.t.glow, k.t.base]), 1.4, 'fill-opacity=".85"'),
      k.l('M60 28L60 86M44 56L76 56', '#3a2a24', 2.4),
      k.p('M46 86L74 86L70 94L50 94Z', '#3a2a24', 1.6),
      // 燈火中的臉
      k.p('M60 40C66 48 68 56 64 62C62 66 58 66 56 62C52 56 54 48 60 40Z', flame, 1.4),
      k.e(57.6, 56, 1.4, 1.8, INK, 0), k.e(62.4, 56, 1.4, 1.8, INK, 0),
      // 停住的時鐘指針（時間不流動）
      `<circle cx="60" cy="102" r="7" fill="none" stroke="${k.t.light}" stroke-width="1.4" opacity=".8"/>`,
      k.l('M60 102L60 97M60 102L64 102', k.t.light, 1.4),
      k.crack([[48, 46], [46, 54]], [[72, 66], [74, 74]]),
      k.shard(74, 26, 8, 30),
      k.particles(10),
    ].join('');
  },
};

const e0025: EnemyDesign = {
  shape: 'colossus',
  crown: [60, 16, 0.8],
  draw: (k) => {
    const s = stone(k);
    const block = (d: string) => k.p(d, s, 2);
    return [
      // 腳
      block('M38 84L34 108L52 108L54 84Z'), block('M66 84L68 108L86 108L82 84Z'),
      // 手臂（碎片堆成）
      block('M24 46L38 44L40 62L32 64Z'), block('M18 64L32 62L34 82L16 84Z'), k.cluster(22, 86, 10, 180),
      block('M82 44L96 46L88 64L80 62Z'), block('M88 62L102 64L104 84L86 82Z'), k.cluster(98, 86, 10, 180),
      // 軀幹
      block('M36 40L84 40L88 66L80 88L40 88L32 66Z'),
      k.l('M36 56L58 52L84 58M40 74L62 70L82 76M58 52L62 70', '#3a3950', 1.4),
      // 苔
      k.e(44, 42, 8, 3, k.t.base, 1.2), k.e(80, 66, 5, 3, k.t.base, 1.2), k.e(52, 88, 6, 2.6, k.t.base, 1.2),
      // 胸口核心晶體
      k.cluster(60, 72, 16),
      // 頭
      block('M48 22L72 22L74 40L46 40Z'),
      k.e(60, 24, 10, 3, k.t.base, 1.2),
      k.p('M50 30L70 30L68 34L52 34Z', INK, 0),
      k.eye(55, 32, 2.6), k.eye(65, 32, 2.6),
      k.crack([[40, 46], [46, 56], [42, 64]], [[78, 46], [74, 54]], [[50, 80], [56, 86]], [[70, 80], [66, 86]]),
      k.shard(84, 40, 10, 30), k.shard(36, 40, 10, -30),
      k.particles(8, [8, 4, 112, 30]),
    ].join('');
  },
};

// ---------- 活動 Boss：獸王的召集令 ----------

const e0026: EnemyDesign = {
  shape: 'beast',
  crown: [28, 34, 0.7, -10],
  draw: (k) => wolf(k, { fur: k.B, mane: k.lin('redmane', ['#ffe3c4', '#e8553f', '#5a1208']), boss: true })
    // 骨頭項鍊
    + k.l('M34 60C40 68 48 70 56 66', '#e8dcc0', 1.4)
    + [38, 44, 50].map((x, i) => k.p(`M${x} ${64 + i}l2 6l2-6Z`, bone(k), 1)).join('')
    // 叛牙：第二根大獠牙
    + k.p('M16 52L14 62L20 54Z', '#fff6e6', 1.2)
    + k.particles(12, [6, 10, 114, 70]),
};

const e0027: EnemyDesign = {
  shape: 'beast',
  crown: [30, 44, 0.7, -6],
  draw: (k) => [
    k.f('M4 96C30 88 90 88 116 96L116 112L4 112Z', k.lin('swamp', ['#2f5c5a', '#13202a']), 0.9),
    // 尾
    k.p('M92 76C104 74 112 80 116 90C108 88 100 88 92 88Z', k.S),
    // 身體（低矮）
    k.p('M40 72C44 62 70 60 92 66C102 70 102 86 92 90C74 94 52 94 42 88Z'),
    ...[52, 64, 76, 88].map((x) => k.p(`M${x} 64L${x + 4} 58L${x + 8} 64Z`, k.t.dark, 1.2)).join(''),
    k.leg(56, 86, 102, 9), k.leg(86, 86, 102, 9),
    // 張開的大嘴
    k.p('M44 70C32 64 18 58 4 60L6 66L40 76Z'),
    k.p('M42 78C30 82 16 86 6 84L6 78L42 74Z', k.S),
    k.f('M8 66L40 74L8 78Z', '#5a1830'),
    k.fangs(8, 38, 66, 7, 4), k.fangs(8, 38, 78, 7, 4, true),
    k.e(36, 62, 6, 5),
    k.eye(36, 61, 3, { slit: true, angry: -1 }),
    // 毒液
    k.p('M14 84q3 7 0 10q-3-3 0-10Z', '#b56cff', 1),
    k.e(70, 104, 5, 2, '#b56cff', 0, 'opacity=".7"'), k.e(26, 102, 4, 1.6, '#b56cff', 0, 'opacity=".7"'),
    k.crack([[60, 70], [66, 78], [64, 86]], [[80, 70], [84, 78]]),
    k.cluster(72, 62, 10),
    k.particles(10, [10, 10, 110, 56]),
  ].join(''),
};

const e0028: EnemyDesign = {
  shape: 'beast',
  crown: [42, 36, 0.7, -6],
  draw: (k) => {
    const iron = metal(k, '#c9a24a');
    return [
      k.leg(46, 78, 106, 12, k.D, false), k.leg(88, 78, 106, 12, k.D, false),
      k.p('M30 62C32 46 56 40 78 42C98 44 106 56 104 72C102 84 88 88 66 88C44 88 28 80 30 62Z'),
      // 板甲
      k.p('M44 48C56 40 80 40 96 50L94 68C80 62 58 62 46 68Z', iron, 2),
      k.l('M58 44L60 64M76 42L78 64', '#6b4c10', 1.4),
      ...[52, 68, 84].map((x) => k.e(x, 56, 1.6, 1.6, '#fff4c4', 0)).join(''),
      k.leg(54, 80, 108, 13, k.B, false), k.leg(96, 78, 108, 13, k.B, false),
      k.p('M48 104L60 104L60 108L48 108ZM90 104L102 104L102 108L90 108Z', iron, 1.4),
      // 頭與鐵角
      k.p('M40 52C30 48 18 52 12 62L8 74C14 80 26 80 36 76C44 70 46 58 40 52Z'),
      k.p('M10 64C6 52 8 40 16 30C18 42 20 52 22 62Z', iron, 2),
      k.p('M24 56C24 50 26 46 30 42C32 48 32 52 30 58Z', iron, 1.6),
      k.p('M18 58L38 54L40 66L22 70Z', iron, 1.6),
      k.eye(30, 62, 2.8, { angry: -1 }),
      k.crack([[62, 70], [66, 78]], [[82, 68], [86, 76]]),
      k.cluster(86, 46, 9, 10),
      k.particles(8, [6, 6, 114, 40]),
    ].join('');
  },
};

const e0029: EnemyDesign = {
  shape: 'beast',
  crown: [28, 40, 0.7, -10],
  draw: (k) => {
    const sleek = k.rad('panther', ['#6a4a9a', '#2a1650', '#0d0620']);
    return [
      // 影子鬃毛流動
      k.g('opacity=".85"', k.f('M30 44C40 30 60 28 76 36C94 30 108 38 116 30C110 44 96 50 80 50C64 52 46 58 30 44Z', '#3a1c6a', 1, k.blurAttr)),
      // 長尾
      k.l('M88 66C104 64 112 76 108 90C106 96 100 98 96 94', '#1d0f3a', 5),
      k.leg(46, 72, 106, 7, k.D), k.leg(84, 72, 106, 7, k.D),
      k.p('M34 60C44 50 72 52 88 58C96 62 96 74 86 78C72 82 50 82 40 78C30 74 28 66 34 60Z', sleek),
      k.leg(52, 74, 108, 8, sleek), k.leg(90, 72, 108, 8, sleek),
      // 頭
      k.p('M40 50C36 42 28 40 20 42L10 50L12 56L24 58C34 58 42 56 40 50Z', sleek),
      k.p('M28 42L30 32L36 42ZM36 46L40 36L42 46Z', sleek, 1.6),
      k.eye(24, 48, 3.2, { slit: true, angry: -1, color: '#ffe066' }),
      k.l('M10 54L22 55', INK, 1.4),
      // 影鬃（尖刺狀）
      k.p('M38 44L46 30L50 42L58 30L60 44L70 34L70 48Z', '#3a1c6a', 1.6),
      // 被遮住的珠影
      ...[[100, 18], [86, 12], [110, 52]].map(([x, y]) => k.e(x, y, 4, 4, '#1d0f3a', 1.2) + k.e(x, y, 1.4, 1.4, k.t.glow, 0)).join(''),
      k.crack([[54, 62], [60, 70], [58, 76]], [[72, 60], [76, 68]]),
      k.cluster(64, 56, 9),
      k.particles(10),
    ].join('');
  },
};

const e0030: EnemyDesign = {
  shape: 'beast',
  crown: [32, 26, 0.8, -6],
  draw: (k) => [
    // 後半身散成影子
    k.g('opacity=".55"', k.f('M70 56C90 52 110 58 116 74C108 70 104 82 96 78C92 90 82 84 76 90Z', k.t.dark, 1, k.blurAttr)),
    k.leg(46, 72, 106, 9, k.D),
    k.p('M32 60C40 50 64 50 82 56C92 60 92 76 82 80C68 84 48 84 38 78C28 72 26 66 32 60Z', k.S),
    k.leg(54, 74, 108, 10),
    k.leg(84, 74, 104, 9, k.D),
    // 藤葉鬃毛
    ...[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => {
      const a = -150 + i * 30;
      return k.p('M0 0C6 -8 6 -20 0 -28C-6 -20 -6 -8 0 0Z', i % 2 ? k.B : k.lin('leaf', [k.t.light, k.t.dark]), 1.4, `transform="translate(30 50) rotate(${a})"`);
    }).join(''),
    // 頭
    k.e(30, 50, 15, 14),
    k.p('M18 54L8 60L14 66L26 64Z'),
    k.e(10, 60, 2, 1.6, INK, 0),
    // 空洞的眼
    k.e(24, 46, 3.4, 3, '#0d0a1e', 0), k.e(36, 46, 3.4, 3, '#0d0a1e', 0),
    k.eye(24, 46, 1.6, { color: k.t.glow }), k.eye(36, 46, 1.6, { color: k.t.glow }),
    k.l('M14 64L26 66', INK, 1.4),
    // 一絲金鬃：格魯仍在裡面
    k.l('M38 30C44 22 50 22 54 26', '#f2c45a', 2, k.glowAttr),
    k.crack([[52, 60], [58, 68], [56, 76]], [[70, 58], [74, 66]], [[30, 38], [32, 44]]),
    k.cluster(66, 52, 10),
    k.particles(12),
  ].join(''),
};

// ---------- 主線 Boss ----------

const e0031: EnemyDesign = {
  shape: 'colossus',
  crown: [60, 16, 0.9],
  draw: (k) => {
    const fur = k.rad('bear', ['#8ec48a', '#3f7a48', '#173a22']);
    return [
      // 腳
      k.p('M38 88L34 108L54 108L54 88Z', fur), k.p('M66 88L66 108L86 108L82 88Z', fur),
      // 身體（站立）
      k.p('M30 56C28 36 44 28 60 28C76 28 92 36 90 56C92 72 88 92 60 94C32 92 28 72 30 56Z', fur),
      k.e(60, 70, 18, 20, k.t.light, 1.6),
      // 手臂與爪
      k.p('M32 50C20 56 14 70 16 86L26 86C26 74 30 66 36 60Z', fur),
      k.p('M88 50C100 56 106 70 104 86L94 86C94 74 90 66 84 60Z', fur),
      k.fangs(14, 28, 86, 3, 4), k.fangs(92, 106, 86, 3, 4),
      // 頭
      k.e(60, 32, 16, 14, fur),
      k.e(46, 20, 5, 5, fur), k.e(74, 20, 5, 5, fur),
      k.e(60, 38, 7, 5, k.t.light, 1.4), k.e(60, 35, 2.6, 2, INK, 0),
      k.eye(53, 29, 2.6, { angry: -1 }), k.eye(67, 29, 2.6, { angry: 1 }),
      k.l('M55 42q5 3 10 0', INK, 1.6),
      // 肩上長出的晶體
      k.cluster(36, 44, 14, -30), k.cluster(84, 44, 14, 30),
      k.crack([[50, 60], [56, 70], [52, 80]], [[70, 60], [66, 72]]),
      k.particles(8),
    ].join('');
  },
};

const e0032: EnemyDesign = {
  shape: 'colossus',
  crown: [60, 14, 0.9],
  draw: (k) => {
    const hide = k.rad('primal', ['#ffb199', '#c23a26', '#4a0f08']);
    return [
      // 多重角
      k.p('M36 34C26 26 20 14 22 4C30 14 36 20 44 26Z', bone(k)),
      k.p('M84 34C94 26 100 14 98 4C90 14 84 20 76 26Z', bone(k)),
      k.p('M30 46C18 44 8 36 6 26C16 32 24 36 34 38Z', bone(k), 1.8),
      k.p('M90 46C102 44 112 36 114 26C104 32 96 36 86 38Z', bone(k), 1.8),
      // 鬃
      k.p('M20 66L12 52L24 54L18 38L32 44L32 28L44 38L50 22L60 34L70 22L76 38L88 28L88 44L102 38L96 54L108 52L100 66Z', k.lin('mane2', [k.t.glow, k.t.base, '#4a0f08'])),
      // 身體與前肢
      k.p('M30 70C30 58 90 58 90 70L94 100L26 100Z', hide),
      k.p('M26 92L20 108L42 108L42 92Z', hide), k.p('M94 92L100 108L78 108L78 92Z', hide),
      k.fangs(20, 40, 107, 3, -3), k.fangs(80, 100, 107, 3, -3),
      // 頭（咆哮）
      k.p('M36 52C34 36 46 30 60 30C74 30 86 36 84 52C84 66 74 76 60 76C46 76 36 66 36 52Z', hide),
      k.p('M44 58Q60 54 76 58L72 72Q60 78 48 72Z', '#2a0804', 1.8),
      k.fangs(46, 74, 58, 6, 5), k.fangs(50, 70, 72, 4, 4, true),
      k.eye(48, 46, 3.4, { angry: -1 }), k.eye(72, 46, 3.4, { angry: 1 }),
      // 額頭的星骸碎片（附身之源）
      k.shard(60, 42, 12),
      k.g(k.glowAttr, `<circle cx="60" cy="36" r="10" fill="none" stroke="${k.crystal}" stroke-width="1"/>`),
      k.crack([[40, 80], [46, 88], [42, 96]], [[80, 80], [74, 90]], [[54, 82], [60, 92], [66, 84]]),
      k.cluster(30, 66, 10, -40), k.cluster(90, 66, 10, 40),
      k.particles(14),
    ].join('');
  },
};

const e0033: EnemyDesign = {
  shape: 'machine',
  crown: [60, 20, 0.8],
  draw: (k) => {
    const iron = metal(k, '#c06a40');
    return [
      // 鐵軌（透視）
      k.l('M22 108L44 78M98 108L76 78', '#5a5470', 3),
      k.l('M30 98L90 98M38 88L82 88', '#3a3450', 3),
      // 速度線
      k.l('M4 40L20 40M2 56L18 56M6 72L22 72M100 40L116 40M102 56L118 56M98 72L114 72', k.t.hi, 1.6, 'opacity=".6"'),
      // 車身
      k.p('M26 46L94 46L100 90L20 90Z', iron),
      k.l('M24 60L96 60', '#4a1a10', 1.6),
      // 熔岩貨斗
      k.p('M30 46C34 34 86 34 90 46Z', k.rad('lava', [k.t.core, k.t.glow, k.t.base]), 1.8),
      k.g(k.glowAttr, k.e(46, 38, 3, 2, k.t.core, 0), k.e(70, 36, 4, 2, k.t.core, 0)),
      // 臉（車頭燈眼、柵欄嘴）
      k.eye(42, 70, 6, { angry: -1, color: k.t.glow }), k.eye(78, 70, 6, { angry: 1, color: k.t.glow }),
      k.p('M46 80L74 80L72 88L48 88Z', INK, 1.2),
      k.l('M52 80L52 88M58 80L58 88M64 80L64 88M70 80L70 88', k.t.base, 1.2),
      // 輪子
      k.gear(32, 94, 10, 10, iron), k.gear(88, 94, 10, 10, iron, 18),
      // 火花
      k.g(k.glowAttr, k.l('M20 104L10 98M22 108L12 108M100 104L110 98M98 108L108 108', k.t.glow, 1.6)),
      k.crack([[30, 52], [36, 58]], [[86, 50], [90, 58]]),
      k.cluster(60, 30, 10),
      k.particles(10, [8, 4, 112, 34]),
    ].join('');
  },
};

const e0034: EnemyDesign = {
  shape: 'machine',
  crown: [60, 22, 1, 6],
  draw: (k) => {
    const brass = metal(k, '#d9aa4a');
    return [
      // 自己改造成的王座（背板齒輪）
      k.gear(60, 44, 34, 18, k.lin('throne', ['#8a6a2a', '#4a3410', '#24180a']), 8),
      k.p('M24 74L96 74L100 108L20 108Z', k.lin('throne', []), 2),
      // 多手臂與工具
      k.l('M36 60L16 46L10 30M84 60L104 46L110 32M38 72L14 80M82 72L106 80', brass, 4),
      k.l('M36 60L16 46L10 30M84 60L104 46L110 32M38 72L14 80M82 72L106 80', INK, 1, 'stroke-dasharray="2 5"'),
      k.p('M4 24L14 22L16 32L8 34Z', metal(k, '#9aa4c0'), 1.4),
      k.gear(110, 30, 6, 8, metal(k, '#9aa4c0')),
      k.p('M8 76L18 74L20 86L10 86Z', metal(k, '#9aa4c0'), 1.4),
      k.l('M106 80L116 90M112 84L108 90', INK, 2.4),
      // 軀幹
      k.p('M40 48C40 40 80 40 80 48L84 86L36 86Z', brass),
      k.e(60, 66, 9, 9, k.S, 1.8), k.gear(60, 66, 7, 10, k.B),
      k.e(46, 80, 3, 2, rust, 0), k.e(74, 54, 3, 2, rust, 0),
      // 頭與面罩
      k.p('M46 42C46 26 74 26 74 42Z', brass),
      k.p('M48 34L72 34L70 40L50 40Z', INK, 1),
      k.eye(54, 37, 2.4, { color: k.t.glow }), k.eye(66, 37, 2.4, { color: k.t.glow }),
      k.l('M50 46L70 46', '#6b4c10', 1.4),
      // 腳
      k.p('M42 86L40 104L54 104L54 86ZM66 86L66 104L80 104L78 86Z', brass, 1.8),
      k.crack([[46, 54], [50, 62], [46, 70]], [[70, 74], [76, 82]]),
      k.cluster(30, 76, 10, -20), k.cluster(90, 76, 10, 20),
      k.particles(8),
    ].join('');
  },
};

const e0035: EnemyDesign = {
  shape: 'winged',
  crown: [60, 14, 0.8],
  draw: (k) => [
    // 狂嵐漩渦
    k.l('M60 104C20 104 8 70 24 52M60 104C100 104 112 70 96 52', k.t.hi, 2, 'opacity=".5"'),
    k.l('M16 30q8-10 18-4M104 30q-8-10-18-4', k.t.hi, 1.6, 'opacity=".6"'),
    bird(k, { feather: k.S, tip: k.t.hi, wingSpan: 56 }),
    // 長髮
    k.p('M44 30C36 44 38 64 30 80C42 74 48 60 50 46ZM76 30C84 44 82 64 90 80C78 74 72 60 70 46Z', k.lin('hair', [k.t.light, k.t.base, k.t.dark]), 1.8),
    // 身體（羽毛長裙）
    k.p('M50 48C46 60 44 76 40 98L80 98C76 76 74 60 70 48Z', k.B),
    ...[56, 66, 76, 86].map((y) => k.l(`M${46 + (y - 56) * -0.1} ${y}q7 4 14 0q7 4 14 0`, k.t.dark, 1.2)).join(''),
    // 鳥爪
    k.l('M52 98l-4 8M56 98l0 8M64 98l0 8M68 98l4 8', '#e0b85a', 2),
    // 臉
    k.e(60, 34, 10, 11, '#eef6ff'),
    k.p('M48 30C48 18 72 18 72 30C68 24 52 24 48 30Z', k.lin('hair', []), 1.6),
    k.eye(55, 34, 2.4, { angry: -1 }), k.eye(65, 34, 2.4, { angry: 1 }),
    k.l('M57 41q3 1.6 6 0', INK, 1.4),
    // 羽冠
    k.p('M50 22L44 6L54 18ZM70 22L76 6L66 18Z', k.t.hi, 1.4),
    // 被封住的輝珠
    k.e(98, 96, 5, 5, '#f2c45a', 1.4), k.l('M94 92L102 100M102 92L94 100', INK, 1.6),
    k.crack([[54, 56], [58, 66], [56, 74]], [[66, 72], [70, 82]]),
    k.shard(70, 60, 8, 20),
    k.particles(10),
  ].join(''),
};

const e0036: EnemyDesign = {
  shape: 'colossus',
  crown: [60, 12, 1],
  draw: (k) => {
    const bark = k.lin('bark', ['#8a7a5a', '#4a3a28', '#22180f']);
    const feather = (x: number, y: number, a: number) => k.p('M0 0C4 6 4 14 0 20C-4 14 -4 6 0 0Z', k.lin('dry', ['#e4d49a', '#a08a4a']), 1.2, `transform="translate(${x} ${y}) rotate(${a})"`);
    return [
      // 枯枝樹冠
      k.l('M60 40C50 26 34 20 18 22M60 40C70 26 86 20 102 22M44 30L36 12M76 30L84 12M30 22L18 8M90 22L102 8', '#3a2a1c', 4),
      // 掛著的羽毛（取代葉子）
      feather(18, 22, 10), feather(36, 12, -10), feather(84, 12, 10), feather(102, 22, -10), feather(26, 26, 20), feather(94, 26, -20), feather(50, 26, 0),
      // 樹幹
      k.p('M42 108C46 90 44 66 46 44C50 36 70 36 74 44C76 66 74 90 78 108Z', bark),
      // 根系
      k.p('M42 108C34 100 22 100 10 106L44 102ZM78 108C86 100 98 100 110 106L76 102Z', bark, 1.6),
      // 樹幹中的臉（閉目哀傷，額上枯冠）
      k.p('M50 54C50 46 70 46 70 54L68 72C66 78 54 78 52 72Z', k.rad('face', ['#e8dcc0', '#b8a880', '#6a5a40']), 1.6),
      k.l('M52 60q3 2 6 0M62 60q3 2 6 0', INK, 1.4),
      k.eye(55, 62, 1.4), k.eye(65, 62, 1.4),
      k.l('M56 70q4-2 8 0', INK, 1.2),
      k.l('M55 64L54 70M65 64L66 70', k.t.glow, 1, 'opacity=".8"'),
      // 半邊根系發光（與千年樹母相連的伏筆）
      k.g(k.glowAttr, k.l('M46 96C40 98 32 98 24 102', k.t.glow, 1.6)),
      k.crack([[48, 80], [52, 88], [48, 96]], [[72, 82], [68, 92]], [[60, 40], [60, 46]]),
      k.cluster(46, 44, 10, -30), k.cluster(74, 44, 10, 30),
      k.particles(10),
    ].join('');
  },
};

const e0037: EnemyDesign = {
  shape: 'serpent',
  crown: [38, 18, 0.6, -14],
  draw: (k) => {
    const head = (x: number, s: number, tint: string) => k.g(`transform="translate(${x} 0) scale(${s} 1)"`,
      k.p('M0 52C-2 40 -4 32 -10 26', tint, 0) + k.l('M0 54C0 40 -4 32 -10 26', INK, 12) + k.l('M0 54C0 40 -4 32 -10 26', tint, 9),
      k.p('M-18 16C-22 24 -18 32 -10 34C-2 34 4 28 2 20C0 14 -12 10 -18 16Z', tint),
      k.p('M-14 14L-22 2L-10 12Z', bone(k), 1.4), k.p('M-4 14L2 2L0 16Z', bone(k), 1.4),
      k.p('M-20 26Q-12 32 -4 28L-8 34Q-14 36 -20 30Z', '#2a0804', 1.2),
      k.eye(-12, 21, 2.4, { slit: true, angry: -1 }),
    );
    return [
      dragonWings(k, k.S, 56, 62),
      k.p('M64 92C76 100 90 104 106 102C98 108 80 108 62 100Z', k.S, 1.8),
      // 身體
      k.p('M40 60C40 48 80 48 80 60L78 92C74 104 46 104 42 92Z'),
      k.p('M48 66C50 82 54 96 60 98C66 96 70 82 72 66C66 72 54 72 48 66Z', k.t.light, 1.4),
      k.l('M46 100l-4 8M74 100l4 8', INK, 3),
      // 左首格倫（較亮）、右首達古（較暗）
      head(46, 1, k.B),
      head(74, -1, k.lin('dark2', [k.t.base, k.t.dark, '#2a0804'])),
      k.g(k.glowAttr, k.l('M50 70L56 78L52 86M68 72L64 80', k.t.glow, 1.6)),
      k.crack([[60, 56], [58, 62]]),
      k.cluster(60, 56, 10),
      k.particles(12),
    ].join('');
  },
};

const e0038: EnemyDesign = {
  shape: 'serpent',
  crown: [60, 10, 0.8],
  draw: (k) => {
    // 鱗色每回合變一次：鱗片拼上五屬性色
    const scales = ['#e8553f', '#3f8ee8', '#4cbf6a', '#f2c45a', '#9b5de5'];
    const patch = (x: number, y: number, i: number) => k.p(`M${x} ${y}l4 -5 4 5 -4 5Z`, scales[i % 5], 1);
    return [
      dragonWings(k, k.S, 58, 50),
      // 尾
      k.p('M66 86C80 98 98 100 114 92C106 104 82 108 62 96Z', k.S, 1.8),
      // 身體
      k.p('M40 50C40 38 80 38 80 50L80 88C76 102 44 102 40 88Z'),
      ...[[48, 58], [60, 54], [70, 60], [52, 70], [64, 68], [44, 80], [58, 82], [70, 78], [52, 92], [64, 92]].map(([x, y], i) => patch(x, y, i)).join(''),
      k.l('M44 100l-4 8M76 100l4 8', INK, 3),
      // 頭與巨角
      k.p('M32 30C20 22 16 10 20 0C26 10 32 16 42 22Z', bone(k)),
      k.p('M88 30C100 22 104 10 100 0C94 10 88 16 78 22Z', bone(k)),
      k.p('M44 38C40 24 50 16 60 16C70 16 80 24 76 38C74 46 46 46 44 38Z'),
      k.p('M50 40Q60 46 70 40L68 46Q60 50 52 46Z', '#14082a', 1.2),
      k.fangs(52, 68, 42, 4, 3),
      k.eye(52, 30, 3, { slit: true, angry: -1 }), k.eye(68, 30, 3, { slit: true, angry: 1 }),
      // 碎星：額上碎裂的星與漂浮碎片
      k.f(starPath(60, 22, 5), '#fff6d8'),
      k.l('M58 18L62 26', INK, 1),
      ...[[20, 74], [100, 70], [14, 52], [106, 46]].map(([x, y], i) => k.f(starPath(x, y, 3 + (i % 2)), k.t.hi, 0.9)).join(''),
      k.crack([[46, 52], [42, 62], [46, 72]], [[74, 50], [78, 60]], [[60, 74], [58, 86]]),
      k.cluster(42, 40, 9, -40), k.cluster(78, 40, 9, 40),
      k.particles(12),
    ].join('');
  },
};

const e0039: EnemyDesign = {
  shape: 'humanoid',
  crown: [60, 10, 0.8],
  draw: (k) => {
    const face = (x: number, s: number, mood: 'calm' | 'grin' | 'weep') => k.g(`transform="translate(${x} 30) scale(${s})"`,
      k.e(0, 0, 9, 11, k.rad('mask', ['#f4eaff', '#c9b4e8', '#6a4a9a']), 1.8),
      k.eye(-3.4, -2, 1.8), k.eye(3.4, -2, 1.8),
      mood === 'calm' ? k.l('M-3 5L3 5', INK, 1.4) : mood === 'grin' ? k.l('M-4 4Q0 8 4 4', INK, 1.4) : k.l('M-4 6Q0 3 4 6', INK, 1.4),
    );
    return [
      // 冥門（身後拱門）
      k.p('M14 108L14 40C14 14 106 14 106 40L106 108L96 108L96 42C96 24 24 24 24 42L24 108Z', k.lin('gate', ['#4a3a6a', '#24183a', '#0d0a1e']), 2),
      ...[30, 50, 70, 90].map((x) => k.l(`M${x} 30L${x} 108`, '#3a2a5a', 2)).join(''),
      // 長袍
      k.p('M36 44C30 64 26 92 24 108L96 108C94 92 90 64 84 44Z', k.S),
      k.l('M60 48L60 108', '#170a30', 1.4),
      // 鑰匙串與燈
      k.l('M40 64C34 72 32 80 34 88', '#e8d9a8', 1.4),
      k.p('M30 88L38 88L38 96L34 100L30 96Z', '#e8d9a8', 1.4),
      k.l('M80 60L94 74', '#6a4c32', 2.4),
      k.e(96, 78, 5, 6, k.rad('lamp2', [k.t.core, k.t.glow, k.t.base]), 1.6, k.glowAttr),
      // 兜帽
      k.p('M32 46C28 24 42 8 60 8C78 8 92 24 88 46C82 40 38 40 32 46Z', k.B),
      // 三張臉：正面（靜）、左側（笑）、右側（泣）
      face(40, 0.72, 'grin'), face(80, 0.72, 'weep'), face(60, 1, 'calm'),
      k.crack([[44, 60], [48, 70], [44, 80]], [[74, 64], [78, 74]]),
      k.cluster(60, 60, 10),
      k.particles(10),
    ].join('');
  },
};

const e0040: EnemyDesign = {
  shape: 'humanoid',
  crown: [60, 10, 0.9],
  draw: (k) => {
    const shadow = k.lin('void', ['#2a2448', '#120e26', '#05040d']);
    return [
      // 背後光芒
      k.g('opacity=".55"', ...[0, 30, 60, 90, 120, 150].map((a) => k.f('M60 56L56 0L64 0Z', k.t.light, 0.5, `transform="rotate(${a} 60 56)"`))),
      k.g('opacity=".35"', ...[15, 45, 75, 105, 135, 165].map((a) => k.f('M60 56L56 0L64 0Z', k.t.light, 0.5, `transform="rotate(${a + 180} 60 56)"`))),
      // 模糊的輪廓（外圈虛影＋本體）
      k.g('opacity=".6"', k.f('M60 14C72 14 78 24 76 36C88 40 98 52 100 72C102 88 96 100 92 108L28 108C24 100 18 88 20 72C22 52 32 40 44 36C42 24 48 14 60 14Z', '#3a3466', 1, k.blurAttr)),
      k.p('M60 18C70 18 75 26 73 37C84 41 93 53 95 72C96 86 92 98 88 108L32 108C28 98 24 86 25 72C27 53 36 41 47 37C45 26 50 18 60 18Z', shadow, 1.8),
      // 輪廓的輝光邊緣
      k.l('M47 37C36 41 27 53 25 72M73 37C84 41 93 53 95 72', k.t.light, 1.2, 'opacity=".7"'),
      // 一雙幾乎看不見的眼
      k.eye(55, 28, 1.6, { color: k.t.hi }), k.eye(65, 28, 1.6, { color: k.t.hi }),
      // 胸口：唯一清楚的完整七曜星紋
      k.e(60, 62, 16, 16, k.rad('core', [k.t.core, k.t.glow, k.t.base], '50%', '50%', [1, 0.7, 0]), 0),
      `<circle cx="60" cy="62" r="13" fill="none" stroke="${k.t.light}" stroke-width="1.2"/>`,
      k.g(k.glowAttr, k.p(polyStar(60, 62, 11, 4.6, 7), k.t.core, 1.2)),
      ...[0, 1, 2, 3, 4, 5, 6].map((i) => {
        const a = ((-90 + i * (360 / 7)) * Math.PI) / 180;
        return `<circle cx="${(60 + Math.cos(a) * 17).toFixed(1)}" cy="${(62 + Math.sin(a) * 17).toFixed(1)}" r="1.6" fill="${['#e8553f', '#3f8ee8', '#4cbf6a', '#f2c45a', '#9b5de5', '#ff8fc1', '#ffffff'][i]}"/>`;
      }).join(''),
      // 裂開的影子
      k.crack([[40, 70], [36, 82], [40, 94]], [[80, 72], [84, 84], [80, 96]], [[50, 86], [56, 98]]),
      k.shard(30, 100, 10, -20), k.shard(90, 100, 10, 20),
      k.particles(14),
    ].join('');
  },
};

export const ENEMY_DESIGNS: Record<string, EnemyDesign> = {
  e0001, e0002, e0003, e0004, e0005, e0006, e0007, e0008, e0009, e0010,
  e0011, e0012, e0013, e0014, e0015, e0016, e0017, e0018, e0019, e0020,
  e0021, e0022, e0023, e0024, e0025, e0026, e0027, e0028, e0029, e0030,
  e0031, e0032, e0033, e0034, e0035, e0036, e0037, e0038, e0039, e0040,
};
