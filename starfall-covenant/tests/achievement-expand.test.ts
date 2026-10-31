import { describe, expect, it } from 'vitest';
import type { SaveData } from '../src/core/types';
import { gameData } from '../src/data/load';
import { createNewSave } from '../src/save/save';
import { claimableQuests, isKnownCounter } from '../src/progression/quests';
import { questDerived } from '../src/ui/economy';
import lore from '../data/lore.json';

const NOW = new Date(2026, 10, 2, 12).getTime();
const fresh = () => createNewSave(gameData.config, NOW);
const achievements = gameData.quests.filter((q) => q.kind === 'achievement');
const NEW_COUNTERS = ['awakenedCards', 'cardBondScenes', 'helperBondTiers', 'lorePages', 'nemesisCleared', 'puzzleBestStreak', 'collectionPercent'];
const maxTarget = (counter: string) => Math.max(...achievements.filter((q) => q.counter === counter).map((q) => q.target));

describe('成就補齊', () => {
  it('主線通關到最後一關；圖鑑全收用完成度 100%，跟圖鑑總數連動', () => {
    expect(maxTarget('mainCleared')).toBe(gameData.stages.filter((s) => s.kind === 'main').length);
    // 持有卡的成就不寫死總數；「全收」由 collectionPercent 100 判斷，分母是 cards.json 全部卡（含素材，跟圖鑑頁的收集數一致）
    expect(maxTarget('cardsOwned')).toBeLessThan(gameData.cards.length);
    const s = fresh();
    const all = { ...s, collection: { ...s.collection, owned: gameData.cards.map((c) => c.id) } };
    const allButOne = { ...s, collection: { ...s.collection, owned: gameData.cards.slice(1).map((c) => c.id) } };
    expect(questDerived(all).collectionPercent).toBe(100);
    expect(questDerived(allButOne).collectionPercent).toBeLessThan(100);
  });

  it('新成就的計數器都認得，而且只給成就與新手契約用', () => {
    for (const c of NEW_COUNTERS) {
      expect(isKnownCounter(c, 'achievement'), c).toBe(true);
      expect(isKnownCounter(c, 'daily'), c).toBe(false);
      expect(achievements.some((q) => q.counter === c), c).toBe(true);
    }
  });

  it('目標不超過能達到的上限', () => {
    expect(maxTarget('lorePages')).toBe(lore.volumes.reduce((n, v) => n + v.pages.length, 0));
    expect(maxTarget('helperBondTiers')).toBeLessThanOrEqual(12 * 3);
    expect(maxTarget('collectionPercent')).toBe(100);
    const nemesis = new Set(gameData.events.filter((e) => e.series === 'nemesis').map((e) => e.id));
    expect(maxTarget('nemesisCleared')).toBeLessThanOrEqual(gameData.stages.filter((s) => s.event && nemesis.has(s.event)).length);
  });

  it('圖鑑完成度里程碑 25／50／75／100% 各一次', () => {
    expect(achievements.filter((q) => q.counter === 'collectionPercent').map((q) => q.target).sort((a, b) => a - b)).toEqual([25, 50, 75, 100]);
  });

  it('這次新增的成就星晶合計不超過 150', () => {
    const added = achievements.filter((q) => NEW_COUNTERS.includes(q.counter) || ['a-mainCleared-54', 'a-cardsOwned-80'].includes(q.id));
    expect(added.reduce((n, q) => n + (q.reward.gems ?? 0), 0)).toBeLessThanOrEqual(150);
  });
});

describe('由存檔推算，老玩家讀檔就能判斷', () => {
  it('覺醒、羈絆、情誼、殘頁、克星週、謎題、圖鑑完成度', () => {
    const s = fresh();
    const nemesis = new Set(gameData.events.filter((e) => e.series === 'nemesis').map((e) => e.id));
    const nemesisIds = gameData.stages.filter((st) => st.event && nemesis.has(st.event)).map((st) => st.id);
    const owned = gameData.cards.slice(0, Math.ceil(gameData.cards.length / 2)).map((c) => c.id);
    const veteran: SaveData = {
      ...s,
      inventory: { ...s.inventory, cards: s.inventory.cards.map((c, i) => ({ ...c, awakened: i < 2 ? 1 : 0 })) },
      cardBond: { c106: 31, c109: 10, c206: 3 },
      helperBond: { 'npc-mono': 20, 'npc-heart': 5 },
      lorePages: ['p1', 'p2', 'p3', 'p3'],
      progress: { ...s.progress, clearedStages: nemesisIds.slice(0, 2) },
      puzzle: { lastDay: '2026-10-10', streak: 1, solvedDays: ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-05', '2026-10-10'] },
      collection: { ...s.collection, owned },
    };
    const d = questDerived(veteran);
    expect(d.awakenedCards).toBe(2);
    expect(d.cardBondScenes).toBe(3);
    expect(d.helperBondTiers).toBe(4);
    expect(d.lorePages).toBe(3);
    expect(d.nemesisCleared).toBe(2);
    // 目前只連續 1 天，但紀錄裡曾經連續 3 天
    expect(d.puzzleBestStreak).toBe(3);
    expect(d.collectionPercent).toBe(50);
    const ready = claimableQuests(veteran, achievements, NOW, d).map((q) => q.id);
    expect(ready).toEqual(expect.arrayContaining([
      'a-awakenedCards-1', 'a-cardBondScenes-1', 'a-helperBondTiers-1', 'a-lorePages-3', 'a-nemesisCleared-1', 'a-puzzleBestStreak-3', 'a-collection-25', 'a-collection-50',
    ]));
    expect(ready).not.toContain('a-collection-75');
  });

  it('新存檔這些成就都還沒達成', () => {
    const s = fresh();
    const ready = claimableQuests(s, achievements.filter((q) => NEW_COUNTERS.includes(q.counter)), NOW, questDerived(s));
    expect(ready).toEqual([]);
  });
});
