import { describe, expect, it } from 'vitest';
import type { SaveData, ShopItemDef } from '../src/core/types';
import { gameData } from '../src/data/load';
import { validateGameData } from '../src/data/validate';
import { eventPeriod, type EventDef } from '../src/progression/events';
import { buyItem, purchasedCount, remainingPurchases, shopItemEvent } from '../src/progression/shop';
import { createNewSave } from '../src/save/save';
import { tokenName } from '../src/ui/economy';

const config = { ...gameData.config, newPlayer: { ...gameData.config.newPlayer, starterCards: [] } };
const at = (s: string) => new Date(s).getTime();
const DAY = 86_400_000;
// 每 21 天一期，每期開 14 天
const event: EventDef = {
  id: 'ev-test', name: '測試活動', summary: '', token: 'tok', tokenName: '測試代幣',
  period: { start: '2026-11-02T00:00:00', end: '2026-11-16T00:00:00', repeatDays: 21 },
};
const lion: ShopItemDef = { id: 'ev-lion', name: '獅王', price: { tokens: { tok: 100 } }, reward: { coin: 1 }, limit: { count: 1, per: 'event' } };
const relic: ShopItemDef = { id: 'relic', name: '遺物', price: { tokens: { tok: 10 } }, reward: { coin: 1 }, limit: { count: 1, per: 'forever' } };
const P1 = at('2026-11-03T12:00:00');
const REST = at('2026-11-20T12:00:00');
const P2 = at('2026-11-24T12:00:00');
const rich = (): SaveData => {
  const s = createNewSave(config, P1);
  return { ...s, player: { ...s.player, tokens: { tok: 10_000 } } };
};
const buy = (s: SaveData, item: ShopItemDef, now: number) => {
  const r = buyItem(s, item, config, now, [event]);
  if (!r.ok) throw new Error(r.reason);
  return r.save;
};

describe('代幣名稱放在資料', () => {
  it('名稱來自 events.json', () => {
    expect(tokenName('token-beast')).toBe(gameData.events.find((e) => e.token === 'token-beast')!.tokenName);
    expect(tokenName('unknown')).toBe('unknown');
  });

  it('驗證：用到的代幣都要有名稱，活動限購要對得到活動', () => {
    const broken = structuredClone(gameData);
    broken.events = broken.events.map((e) => ({ ...e, tokenName: undefined }));
    expect(validateGameData(broken).some((e) => e.includes('代幣 token-beast 沒有名稱'))).toBe(true);
    const orphan = structuredClone(gameData);
    orphan.shop.push({ ...lion, id: 'orphan' });
    expect(validateGameData(orphan)).toContain('shop/orphan: 活動限購的商品要用某個活動的代幣標價');
  });
});

describe('活動限購依檔期重置', () => {
  it('商品用哪個活動的代幣，就算那個活動', () => {
    expect(shopItemEvent(lion, [event])?.id).toBe('ev-test');
    expect(gameData.shop.filter((i) => i.limit?.per === 'event').every((i) => shopItemEvent(i, gameData.events))).toBe(true);
  });

  it('期數：開始前算第 0 期，休息期間仍算上一期', () => {
    expect(eventPeriod(event, at('2026-10-01T00:00:00')).index).toBe(0);
    expect(eventPeriod(event, P1)).toEqual({ index: 0, start: at('2026-11-02T00:00:00') });
    expect(eventPeriod(event, REST).index).toBe(0);
    expect(eventPeriod(event, P2)).toEqual({ index: 1, start: at('2026-11-23T00:00:00') });
  });

  it('同一期限購有效（休息期間也不能再買），下一期重置', () => {
    const s = buy(rich(), lion, P1);
    expect(Object.keys(s.daily.shopPurchases)).toEqual(['ev-lion@eev-test:2026-11-02']);
    expect(buyItem(s, lion, config, P1 + DAY, [event])).toEqual({ ok: false, reason: 'soldOut' });
    expect(remainingPurchases(s, lion, REST, [event])).toBe(0);
    expect(remainingPurchases(s, lion, P2, [event])).toBe(1);
    const again = buy(s, lion, P2);
    expect(purchasedCount(again, lion, P2, [event])).toBe(1);
  });

  it("'forever' 不受檔期影響", () => {
    const s = buy(rich(), relic, P1);
    expect(s.daily.shopPurchases).toEqual({ relic: 1 });
    expect(remainingPurchases(s, relic, P2 + 100 * DAY, [event])).toBe(0);
  });

  it('舊存檔只記商品 id：視為第一期買的，同一期不能再買，下一期重置', () => {
    const old = rich();
    const legacy = { ...old, daily: { ...old.daily, shopPurchases: { 'ev-lion': 1 } } };
    expect(remainingPurchases(legacy, lion, P1, [event])).toBe(0);
    expect(buyItem(legacy, lion, config, REST, [event])).toEqual({ ok: false, reason: 'soldOut' });
    expect(remainingPurchases(legacy, lion, P2, [event])).toBe(1);
    expect(purchasedCount(buy(legacy, lion, P2), lion, P2, [event])).toBe(1);
  });

  it('現有存檔在現有活動（長檔期）裡買過的不能再買', () => {
    const item = gameData.shop.find((i) => i.id === 'ev-c601')!;
    const s = rich();
    const legacy = { ...s, daily: { ...s.daily, shopPurchases: { 'ev-c601': 1 } } };
    expect(remainingPurchases(legacy, item, at('2027-06-01T00:00:00'), gameData.events)).toBe(0);
  });
});
