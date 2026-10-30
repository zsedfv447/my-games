import { describe, expect, it } from 'vitest';
import type { GachaPoolDef } from '../src/core/types';
import { createRng } from '../src/core/rng';
import { gameData } from '../src/data/load';
import { createNewSave } from '../src/save/save';
import { checkGachaPool, displayRates } from '../src/progression/gacha';
import { createSummonSession, setPending, startPull, takePending } from '../src/ui/screens/summon';
import { commit, getSave } from '../src/ui/state';
import { bus } from '../src/core/events';

const NOW = Date.UTC(2026, 9, 30);
const pool: GachaPoolDef = { id: 'test', name: '測試', cost: { gems: 5 }, rates: { 6: 1 }, pity: { rarity: 6, after: 39 }, tenPullGuarantee: { minRarity: 5 }, cards: { 6: ['c101'] }, period: null };
function sessionWith(gems = 100, capacity = 50) {
  let save = createNewSave(gameData.config, NOW);
  save = { ...save, player: { ...save.player, gems }, inventory: { cards: [], capacity }, collection: { seen: [], owned: [], claimed: [] } };
  const session = createSummonSession({ read: () => save, write: (next) => { save = next; }, rng: createRng(1), now: () => NOW });
  return { session, read: () => save };
}

describe('召喚互動流程', () => {
  it('揭曉前已保存結果，連點不會再次扣款；結束後才能下一次召喚', () => {
    const { session, read } = sessionWith();
    expect(session.begin(pool, 10).ok).toBe(true);
    expect(read().player.gems).toBe(50);
    expect(read().inventory.cards).toHaveLength(10);
    expect(read().gacha.history).toHaveLength(10);
    expect(session.begin(pool, 10)).toEqual({ ok: false, reason: 'busy' });
    expect(read().player.gems).toBe(50);
    session.finish();
    expect(session.begin(pool, 1).ok).toBe(true);
    expect(read().player.gems).toBe(45);
  });
  it('不足時不扣款，補足資源後仍可再試', () => {
    const { session, read } = sessionWith(49);
    expect(session.begin(pool, 10)).toEqual({ ok: false, reason: 'notEnoughGems' });
    expect(read().player.gems).toBe(49);
    expect(read().inventory.cards).toHaveLength(0);
    expect(session.begin(pool, 1).ok).toBe(true);
  });
  it('十連空位不足時不扣款也不寫入紀錄', () => {
    const { session, read } = sessionWith(100, 9);
    expect(session.begin(pool, 10)).toEqual({ ok: false, reason: 'inventoryFull' });
    expect(read().player.gems).toBe(100);
    expect(read().gacha.history).toEqual([]);
  });
  it('切頁後舊回呼不再召喚，已入背包的卡不會撤銷', () => {
    const { session, read } = sessionWith();
    session.begin(pool, 1);
    session.dispose();
    session.finish();
    expect(session.begin(pool, 1)).toEqual({ ok: false, reason: 'busy' });
    expect(read().inventory.cards).toHaveLength(1);
    expect(read().player.gems).toBe(95);
  });
  it('十連同卡只有第一次取得標示 NEW', () => {
    const { session } = sessionWith();
    const result = session.begin(pool, 10);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.results.map((r) => r.isNew)).toEqual([true, false, false, false, false, false, false, false, false, false]);
  });
});

describe('可遊玩的本作卡池', () => {
  it('提供常駐卡池，公開機率涵蓋所有結果，卡片存在且星數一致', () => {
    expect(gameData.gachaPools.length).toBeGreaterThan(0);
    for (const p of gameData.gachaPools) {
      expect(checkGachaPool(p)).toEqual([]);
      expect(displayRates(p).flatMap((r) => r.cards).reduce((sum, r) => sum + r.rate, 0)).toBeCloseTo(1, 10);
      for (const [rarity, ids] of Object.entries(p.cards)) for (const id of ids ?? []) {
        expect(gameData.cards.find((c) => c.id === id)?.rarity).toBe(Number(rarity));
      }
    }
    expect(gameData.gachaPools.some((p) => p.period === null)).toBe(true);
  });
});

describe('遠端卡池與演出結果相容', () => {
  it('沿用既有 pool-standard 保底進度，第81抽仍為五星保底', () => {
    const oldPool = gameData.gachaPools.find((p) => p.id === 'pool-standard')!;
    expect(oldPool).toBeDefined();
    let save = createNewSave(gameData.config, NOW);
    save = { ...save, gacha: { ...save.gacha, pityCounter: { 'pool-standard': 80, 'covenant-seal': 12 } } };
    const session = createSummonSession({ read: () => save, write: (next) => { save = next; }, rng: createRng(2), now: () => NOW });
    const result = session.begin(oldPool, 1);
    expect(result.ok && result.results[0]).toMatchObject({ rarity: 5, pity: true });
    expect(save.gacha.pityCounter['pool-standard']).toBe(0);
    expect(save.gacha.pityCounter['covenant-seal']).toBe(12);
    expect(save.gacha.history[0].pool).toBe('pool-standard');
  });
});


describe('星龍演出的單次結果交接', () => {
  it('等待演出的結果不能重複扣款，取走結果也不再抽卡', () => {
    const initial = getSave();
    try {
      commit({ ...initial, player: { ...initial.player, gems: 100 }, inventory: { ...initial.inventory, cards: [], capacity: 50 } });
      const result = startPull(pool, 1)!;
      expect(result.results).toHaveLength(1);
      setPending(result);
      expect(startPull(pool, 1)).toBeNull();
      expect(getSave().player.gems).toBe(95);
      expect(getSave().inventory.cards).toHaveLength(1);
      expect(takePending()).toBe(result);
      expect(takePending()).toBeNull();
      expect(getSave().player.gems).toBe(95);
      expect(getSave().inventory.cards).toHaveLength(1);
    } finally { takePending(); commit(initial); }
  });
  it('結算事件的重入呼叫不能造成第二筆扣款', () => {
    const initial = getSave();
    const attempts: unknown[] = [];
    const unsubscribe = bus.on('gachaPulled', () => { attempts.push(startPull(pool, 1)); });
    try {
      commit({ ...initial, player: { ...initial.player, gems: 100 }, inventory: { ...initial.inventory, cards: [], capacity: 50 } });
      expect(startPull(pool, 1)?.results).toHaveLength(1);
      expect(attempts).toEqual([null]);
      expect(getSave().player.gems).toBe(95);
      expect(getSave().inventory.cards).toHaveLength(1);
    } finally { unsubscribe(); takePending(); commit(initial); }
  });
});
