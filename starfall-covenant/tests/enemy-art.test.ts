import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { gameData } from '../src/data/load';
import { DEMO_DATA } from '../src/ui/demo';
import shared from '../assets/user/enemy-art-shared.json';

const names = new Map([...gameData.enemies, ...DEMO_DATA.enemies].map((e) => [e.id, e.name]));
const label = (id: string) => `${id}（${names.get(id) ?? '未知'}）`;

describe('敵人共用圖清單（提案 48）', () => {
  it('列出圖片被共用的敵人，交給美術補圖', () => {
    const lines = shared.groups.map((g) => `${label(g.owner)} 的圖也被 ${g.borrowers.map(label).join('、')} 使用（相似度 ${g.minSimilarity}）`);
    // 只輸出清單，有共用不算失敗；這些敵人在遊戲裡已改用程式產生的圖
    console.info(`圖片被共用的敵人（${shared.groups.reduce((n, g) => n + g.borrowers.length, 0)} 隻改用程式產生的圖）：\n${lines.join('\n') || '（無）'}`);
    expect(Array.isArray(shared.groups)).toBe(true);
  });

  it('清單裡的敵人都存在，且原主還有圖片檔', () => {
    for (const g of shared.groups) {
      for (const id of [g.owner, ...g.borrowers]) expect(names.has(id), id).toBe(true);
      expect(existsSync(new URL(`../assets/user/enemies/${g.owner}.webp`, import.meta.url)), g.owner).toBe(true);
      expect(g.borrowers).not.toContain(g.owner);
    }
  });
});
