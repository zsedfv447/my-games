// 產生 data/constellations.json：每章一個星座的座標與連線（用 art/constellation.ts 的產生器跑一次後存成資料，之後可手動微調）
// 執行：npx vite-node tools/gen-constellations.ts
import { writeFileSync } from 'node:fs';
import { gameData } from '../src/data/load';
import { chapterStarSlots, constellationLayout } from '../src/ui/art/constellation';

const out = gameData.chapters.map((c) => {
  const count = chapterStarSlots(gameData.stages, c.chapter).length;
  const { width, height, stars, edges } = constellationLayout(String(c.chapter), count);
  return { chapter: c.chapter, width, height, stars: stars.map((s) => [s.x, s.y, s.r]), edges };
});
writeFileSync(new URL('../data/constellations.json', import.meta.url), `[\n${out.map((o) => `  ${JSON.stringify(o)}`).join(',\n')}\n]\n`);
console.log(`寫入 ${out.length} 個星座`);
