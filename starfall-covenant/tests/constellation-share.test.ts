import { describe, expect, it } from 'vitest';
import { gameData } from '../src/data/load';
import {
  chapterStarMask, chapterStarSlots, constellationLayout, constellationSvg, freshStars, plannedStarCount,
} from '../src/ui/art/constellation';
import { memberSlots, SHARE_W, shareDate, sharePlan, type ShareInput } from '../src/ui/share-plan';

describe('星座圖', () => {
  it('同一章每次畫出來都一樣，不同章不一樣', () => {
    expect(constellationLayout('1', 27)).toEqual(constellationLayout('1', 27));
    expect(constellationLayout('2', 27).stars).not.toEqual(constellationLayout('1', 27).stars);
  });
  it('星都在畫面內、彼此不重疊，由左到右排序', () => {
    for (const ch of ['1', '2', '3', '4', '5']) {
      const { stars, width, height } = constellationLayout(ch, 27);
      expect(stars).toHaveLength(27);
      for (const s of stars) {
        expect(s.x).toBeGreaterThanOrEqual(0);
        expect(s.x).toBeLessThanOrEqual(width);
        expect(s.y).toBeGreaterThanOrEqual(0);
        expect(s.y).toBeLessThanOrEqual(height);
      }
      for (let i = 1; i < stars.length; i++) expect(stars[i].x).toBeGreaterThanOrEqual(stars[i - 1].x);
      for (let i = 0; i < stars.length; i++) {
        for (let j = i + 1; j < stars.length; j++) expect(Math.hypot(stars[i].x - stars[j].x, stars[i].y - stars[j].y)).toBeGreaterThan(8);
      }
    }
  });
  it('連線是一棵樹：n-1 條線，每顆星都連得到', () => {
    const { stars, edges } = constellationLayout('3', 27);
    expect(edges).toHaveLength(26);
    const seen = new Set([0]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const [a, b] of edges) {
        if (seen.has(a) !== seen.has(b)) { seen.add(a); seen.add(b); grew = true; }
      }
    }
    expect(seen.size).toBe(stars.length);
    expect(constellationLayout('x', 1).edges).toEqual([]);
    expect(constellationLayout('x', 0).stars).toEqual([]);
  });
  it('星章依關卡順序攤平成每顆星，主線每章 27 顆', () => {
    const slots = chapterStarSlots(gameData.stages, 1);
    expect(slots).toHaveLength(27);
    expect(slots.slice(0, 4)).toEqual([
      { stageId: 'st-1-1', index: 0 }, { stageId: 'st-1-1', index: 1 }, { stageId: 'st-1-1', index: 2 }, { stageId: 'st-1-2', index: 0 },
    ]);
    const mask = chapterStarMask(slots, { 'st-1-1': [true, false, true], 'st-1-2': [false, true] });
    expect(mask.slice(0, 6)).toEqual([true, false, true, false, true, false]);
    expect(mask.filter(Boolean)).toHaveLength(3);
  });
  it('分批上線的章節：星座照預定星數畫，不會少於已上線的星', () => {
    expect(plannedStarCount(9, 9)).toBe(27);
    expect(plannedStarCount(undefined, 27)).toBe(27);
    expect(plannedStarCount(3, 12)).toBe(12);
  });
  it('新點亮的星：之前沒紀錄時不算新的', () => {
    expect(freshStars(undefined, [true, false])).toEqual([false, false]);
    expect(freshStars([true, false, false], [true, true, false])).toEqual([false, true, false]);
  });
  it('SVG：點亮的星與兩端都亮的連線發光，全亮時加 complete，新點亮的星依序延遲', () => {
    const layout = constellationLayout('1', 3);
    const svg = constellationSvg(layout, [true, true, false], { fresh: [false, true, false], name: '獸座' });
    expect(svg.match(/class="cst-star lit/g)).toHaveLength(2);
    expect(svg).toContain('cst-star lit fresh');
    expect(svg).toContain('獸座');
    expect(svg).not.toContain('constellation complete');
    expect(constellationSvg(layout, [true, true, true])).toContain('constellation complete');
    expect(constellationSvg(layout, [true, true, true], { name: '<x>' })).toContain('&lt;x&gt;');
  });
});

const input: ShareInput = {
  stageName: '荒原入口', place: '第 1 章・焦骨荒原', constellation: '獸座', turns: 4, maxCombo: 7,
  stars: [true, false, true], starTexts: ['5 回合內通關', '不續戰', '單回合達成 6 Combo'],
  team: Array.from({ length: 6 }, (_, i) => ({ cardId: `c${i}`, name: `卡${i}`, level: 10 + i, isHelper: i === 5 })),
  playerName: '契印師', playerLevel: 12, at: new Date(2026, 9, 31, 9, 5).getTime(), firstClear: true,
};

describe('契約回憶分享圖', () => {
  it('文字：戰績、星章、首通標記、頁尾與檔名', () => {
    const p = sharePlan(input);
    expect(p.place).toBe('第 1 章・焦骨荒原・獸座');
    expect(p.stats).toEqual([
      { label: '回合數', value: '4' }, { label: '最高 Combo', value: '7' }, { label: '星章', value: '2/3' },
    ]);
    expect(p.starLine).toBe('★☆★');
    expect(p.starRows[1]).toEqual({ text: '不續戰', got: false });
    expect(p.badge).toBe('首次淨化');
    expect(p.footer).toBe('契印師・契印師 Lv.12・2026/10/31');
    expect(p.fileName).toBe('starfall-荒原入口-20261031-0905.png');
    expect(sharePlan({ ...input, firstClear: false, stars: [], starTexts: [] }).stats[2].value).toBe('—');
    expect(shareDate(new Date(2026, 0, 2).getTime())).toBe('2026/01/02');
  });
  it('隊伍頭像置中排列且不超出畫布', () => {
    for (const n of [1, 3, 5, 6]) {
      const slots = memberSlots(input.team.slice(0, n), 0);
      expect(slots).toHaveLength(n);
      const left = slots[0].x;
      const right = slots.at(-1)!.x + slots[0].size;
      expect(left).toBeGreaterThanOrEqual(30);
      expect(right).toBeLessThanOrEqual(SHARE_W - 30);
      expect(Math.abs(left - (SHARE_W - right))).toBeLessThanOrEqual(1);
    }
    expect(memberSlots([], 0)).toEqual([]);
  });
});

import constellations from '../data/constellations.json';
describe('星座資料', () => {
  it('每章都有資料、星數等於該章星章數、連線是 n-1 條且索引有效', () => {
    for (const c of gameData.chapters) {
      const d = (constellations as { chapter: number; stars: number[][]; edges: number[][] }[]).find((x) => x.chapter === c.chapter)!;
      const n = plannedStarCount(c.stageCount, chapterStarSlots(gameData.stages, c.chapter).length);
      expect(d.stars).toHaveLength(n);
      expect(d.edges).toHaveLength(n - 1);
      for (const [a, b] of d.edges) { expect(a).toBeLessThan(n); expect(b).toBeLessThan(n); }
    }
  });
});
