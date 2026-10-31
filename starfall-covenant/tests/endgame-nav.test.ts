// 找差距第 122 項：冒險頁的紅點只算一次，底部導覽「冒險」分頁讀同一份
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/data/load';
import { createNewSave } from '../src/save/save';
import type { SaveData } from '../src/core/types';
import { adventureDots, anyAdventureDot, type AdventureDots } from '../src/ui/adventure-badges';
import { homeBadges } from '../src/ui/economy';

const NOW = new Date(2026, 10, 12, 12).getTime(); // 工匠座活動的休息期
const none: AdventureDots = { chapters: [], eclipse: [], event: false, puzzle: false, abyss: false, expedition: false };

/** 第 1 章全部通關、滿星，還沒領章節獎勵 */
function chapterOneDone(): SaveData {
  const s = createNewSave(gameData.config, NOW);
  const ch1 = gameData.stages.filter((x) => x.kind === 'main' && x.chapter === 1);
  return {
    ...s,
    progress: {
      ...s.progress,
      clearedStages: ch1.map((x) => x.id),
      stars: Object.fromEntries(ch1.map((x) => [x.id, (x.stars ?? []).map(() => true)])),
    },
  };
}

describe('冒險頁紅點', () => {
  it('任何一個子項目有紅點，冒險分頁就亮；全部沒有就不亮', () => {
    expect(anyAdventureDot(none)).toBe(false);
    for (const k of ['event', 'puzzle', 'abyss', 'expedition'] as const) expect(anyAdventureDot({ ...none, [k]: true })).toBe(true);
    expect(anyAdventureDot({ ...none, chapters: [1] })).toBe(true);
    expect(anyAdventureDot({ ...none, eclipse: [2] })).toBe(true);
  });

  it('章節星章集滿還沒領，算在章節紅點裡', () => {
    const d = adventureDots(chapterOneDone(), NOW);
    expect(d.chapters).toEqual([1]);
    expect(d.event).toBe(false);
    expect(d.abyss).toBe(false); // 主線還沒通關，星淵沒開放不亮
  });

  it('主城與底部導覽沿用同一份判斷：homeBadges.chapters／adventure 和 adventureDots 一致', () => {
    for (const s of [createNewSave(gameData.config, NOW), chapterOneDone()]) {
      const d = adventureDots(s, NOW);
      const b = homeBadges(s, NOW);
      expect(b.chapters).toBe(d.chapters.length > 0);
      expect(b.adventure).toBe(anyAdventureDot(d));
    }
  });
});
