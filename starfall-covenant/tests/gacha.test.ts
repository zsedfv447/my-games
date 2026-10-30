import { describe, expect, it } from 'vitest';
import type { GachaPoolDef, SaveData } from '../src/core/types';
import { createRng } from '../src/core/rng';
import { gameData } from '../src/data/load';
import { createNewSave } from '../src/save/save';
import {
  checkGachaPool, displayRates, GACHA_HISTORY_LIMIT, isPoolOpen, pullGacha, pullsUntilPity, type PullResult,
} from '../src/progression/gacha';

// 測試不受初始卡影響
const config = { ...gameData.config, newPlayer: { ...gameData.config.newPlayer, starterCards: [] } };
const NOW = Date.UTC(2026, 9, 30);

const standard: GachaPoolDef = {
  id: 'pool-standard', name: '星海召喚', cost: { gems: 5 },
  rates: { 5: 0.03, 4: 0.17, 3: 0.8 },
  pity: { rarity: 5, after: 80 },
  tenPullGuarantee: { minRarity: 4 },
  cards: { 5: ['c5a', 'c5b'], 4: ['c4a', 'c4b', 'c4c'], 3: ['c3a', 'c3b'] },
  period: null,
};

const limited: GachaPoolDef = {
  ...standard, id: 'pool-limited', name: '限定召喚',
  rates: { 6: 0.01, 5: 0.03, 4: 0.16, 3: 0.8 },
  cards: { ...standard.cards, 6: ['c6x'], 5: ['c5a', 'c5b', 'c5up'] },
  rateUp: [{ card: 'c5up', share: 0.5 }],
  period: { start: '2026-10-01T00:00:00Z', end: '2026-11-01T00:00:00Z' },
};

function richSave(gems = 100_000): SaveData {
  const s = createNewSave(config, NOW);
  return { ...s, player: { ...s.player, gems }, inventory: { ...s.inventory, capacity: 100_000 } };
}

/** 連續抽 n 次十連，回傳全部結果與最後存檔 */
function pullMany(save: SaveData, pool: GachaPoolDef, tens: number, seed = 1) {
  const rng = createRng(seed);
  const all: PullResult[] = [];
  for (let i = 0; i < tens; i++) {
    const r = pullGacha(save, pool, 10, rng, NOW);
    if (!r.ok) throw new Error(r.reason);
    // 清空背包，避免大量模擬時陣列越複製越慢
    save = { ...r.save, inventory: { ...r.save.inventory, cards: [] } };
    all.push(...r.results);
  }
  return { save, all };
}

describe('召喚', () => {
  it('單抽扣星晶、加卡、記錄', () => {
    const r = pullGacha(richSave(10), standard, 1, createRng(3), NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.save.player.gems).toBe(5);
    expect(r.save.inventory.cards).toHaveLength(1);
    expect(r.save.inventory.cards[0]).toMatchObject({ uid: r.results[0].uid, cardId: r.results[0].cardId, level: 1 });
    expect(r.save.gacha.history).toEqual([{ pool: 'pool-standard', card: r.results[0].cardId, at: NOW }]);
    expect(r.save.collection.owned).toContain(r.results[0].cardId);
    expect(r.results[0].isNew).toBe(true);
  });

  it('星晶不足、背包已滿、卡池未開放時失敗', () => {
    expect(pullGacha(richSave(49), standard, 10, createRng(1), NOW)).toEqual({ ok: false, reason: 'notEnoughGems' });
    const full = createNewSave(config, NOW);
    full.player.gems = 999;
    full.inventory.capacity = 5;
    expect(pullGacha(full, standard, 10, createRng(1), NOW)).toEqual({ ok: false, reason: 'inventoryFull' });
    expect(pullGacha(richSave(), limited, 1, createRng(1), Date.UTC(2026, 10, 1))).toEqual({ ok: false, reason: 'poolClosed' });
    expect(isPoolOpen(limited, Date.UTC(2026, 9, 15))).toBe(true);
  });

  it('十連一定有 4★ 以上', () => {
    const rng = createRng(7);
    let save = richSave();
    for (let i = 0; i < 2000; i++) {
      const r = pullGacha(save, standard, 10, rng, NOW);
      if (!r.ok) throw new Error(r.reason);
      expect(r.results.some((x) => x.rarity >= 4)).toBe(true);
      save = { ...r.save, inventory: { ...r.save.inventory, cards: [] } };
    }
  });

  it('連續 80 抽沒有 5★，第 81 抽必出 5★', () => {
    const noLuck: GachaPoolDef = { ...standard, rates: { 5: 1e-12, 4: 0.17, 3: 0.83 - 1e-12 } };
    let save = richSave();
    const rng = createRng(1);
    for (let i = 0; i < 80; i++) {
      const r = pullGacha(save, noLuck, 1, rng, NOW);
      if (!r.ok) throw new Error(r.reason);
      expect(r.results[0].rarity).toBeLessThan(5);
      save = r.save;
    }
    expect(pullsUntilPity(save, noLuck)).toBe(1);
    const r = pullGacha(save, noLuck, 1, rng, NOW);
    expect(r.ok && r.results[0]).toMatchObject({ rarity: 5, pity: true });
    expect(r.ok && r.save.gacha.pityCounter['pool-standard']).toBe(0);
  });

  it('大量模擬：任兩張 5★ 之間不超過 81 抽，整體機率含保底在合理範圍', () => {
    const { all, save } = pullMany(richSave(10_000_000), standard, 10_000);
    let gap = 0;
    let maxGap = 0;
    for (const r of all) {
      gap = r.rarity >= 5 ? 0 : gap + 1;
      maxGap = Math.max(maxGap, gap);
    }
    expect(maxGap).toBeLessThanOrEqual(80);
    const rate5 = all.filter((r) => r.rarity === 5).length / all.length;
    expect(rate5).toBeGreaterThan(0.03);
    expect(rate5).toBeLessThan(0.04);
    expect(save.gacha.history).toHaveLength(GACHA_HISTORY_LIMIT);
  });

  it('保底計數各卡池分開', () => {
    const r1 = pullGacha(richSave(), standard, 10, createRng(2), NOW);
    if (!r1.ok) throw new Error();
    expect(r1.save.gacha.pityCounter['pool-limited']).toBeUndefined();
  });

  it('限定池：機率提升角色佔 5★ 的一半', () => {
    const { all } = pullMany(richSave(10_000_000), limited, 10_000, 9);
    const fives = all.filter((r) => r.rarity === 5);
    const upShare = fives.filter((r) => r.cardId === 'c5up').length / fives.length;
    expect(upShare).toBeGreaterThan(0.45);
    expect(upShare).toBeLessThan(0.55);
    expect(all.some((r) => r.cardId === 'c6x')).toBe(true);
  });

  it('同一種子結果相同', () => {
    const a = pullGacha(richSave(), limited, 10, createRng(5), NOW);
    const b = pullGacha(richSave(), limited, 10, createRng(5), NOW);
    expect(a).toEqual(b);
  });

  it('公開機率加總為 1', () => {
    for (const pool of [standard, limited]) {
      const rows = displayRates(pool);
      const total = rows.flatMap((r) => r.cards).reduce((a, c) => a + c.rate, 0);
      expect(total).toBeCloseTo(1, 9);
    }
    const five = displayRates(limited).find((r) => r.rarity === 5)!;
    expect(five.cards.find((c) => c.card === 'c5up')!.rate).toBeCloseTo(0.015, 9);
  });

  it('卡池資料檢查', () => {
    expect(checkGachaPool(standard)).toEqual([]);
    expect(checkGachaPool(limited)).toEqual([]);
    const bad: GachaPoolDef = { ...limited, rateUp: [{ card: 'nope', share: 0.5 }], cards: { 3: ['c3a'] } };
    expect(checkGachaPool(bad)).toEqual(expect.arrayContaining([
      'gacha-pools/pool-limited: 保底稀有度 5★ 沒有卡',
      'gacha-pools/pool-limited: 機率提升的 nope 不在卡池內',
    ]));
  });

  it('data/gacha-pools.json 通過召喚規則檢查', () => {
    expect(gameData.gachaPools.flatMap(checkGachaPool)).toEqual([]);
  });
});
