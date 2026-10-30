import { describe, expect, it } from 'vitest';
import type { SaveData, ShopItemDef } from '../src/core/types';
import { gameData } from '../src/data/load';
import { validateGameData } from '../src/data/validate';
import { eventPeriod, eventStatusText, type EventDef } from '../src/progression/events';
import { completeStage } from '../src/progression/stages';
import { createRng } from '../src/core/rng';
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

describe('常駐活動與新活動「工匠座的失竊齒輪」', () => {
  const beastLion = gameData.shop.find((i) => i.id === 'ev-c601')!;
  const base = createNewSave(config, P1);
  const withPurchases = (p: Record<string, number>): SaveData => ({ ...base, daily: { ...base.daily, shopPurchases: p } });

  it('獸王改成常駐：不倒數，顯示「常駐」', () => {
    const beast = gameData.events.find((e) => e.id === 'ev-beast-call')!;
    expect(beast.period).toBeNull();
    expect(eventStatusText(beast, at('2030-01-01T00:00:00'))).toBe('常駐');
  });

  it('改成常駐不會重置已買的限購（舊的商品 id 鍵、有檔期日期的鍵都算）', () => {
    for (const p of [{ 'ev-c601': 1 }, { 'ev-c601@eev-beast-call:2026-10-26': 1 }] as Record<string, number>[]) {
      expect(remainingPurchases(withPurchases(p), beastLion, at('2030-01-01T00:00:00'), gameData.events)).toBe(0);
    }
    const fresh = withPurchases({});
    expect(remainingPurchases(fresh, beastLion, P1, gameData.events)).toBe(1);
  });

  it('齒輪活動：代幣有名稱，兌換品都是活動限購或每週限購，下一期重置', () => {
    expect(tokenName('token-gear')).toBe('黃銅齒輪');
    const items = gameData.shop.filter((i) => i.price.tokens?.['token-gear']);
    expect(items.length).toBeGreaterThan(5);
    for (const i of items) expect(['event', 'week']).toContain(i.limit?.per);
    const kado = items.find((i) => i.id === 'ev-gear-c104')!;
    const rich = { ...base, player: { ...base.player, tokens: { 'token-gear': 1000 } } };
    const r = buyItem(rich, kado, config, at('2026-11-01T12:00:00'), gameData.events);
    if (!r.ok) throw new Error(r.reason);
    expect(remainingPurchases(r.save, kado, at('2026-11-12T12:00:00'), gameData.events)).toBe(0);
    expect(remainingPurchases(r.save, kado, at('2026-11-17T12:00:00'), gameData.events)).toBe(1);
  });

  it('活動關卡每次通關都給代幣，首通另外加碼', () => {
    const stage = gameData.stages.find((s) => s.id === 'ev-gear-1')!;
    const ctx = { stages: gameData.stages };
    const summary = { turns: 3, usedActiveSkill: false, maxCombo: 5, continues: 0, team: [] };
    const first = completeStage(base, stage, summary, ctx, config, createRng(1), P1);
    expect(first.result.tokens).toEqual({ 'token-gear': 4 });
    expect(first.save.player.tokens['token-gear']).toBe(4 + 20);
    const again = completeStage(first.save, stage, summary, ctx, config, createRng(1), P1);
    expect(again.save.player.tokens['token-gear']).toBe(4 + 20 + 4);
  });

  it('新關卡只用現有的敵人與卡片，劇情都存在', () => {
    const enemyIds = new Set(gameData.enemies.map((e) => e.id));
    for (const s of gameData.stages.filter((x) => x.event === 'ev-gear-theft')) {
      for (const w of s.waves) for (const e of w.enemies) expect(enemyIds.has(e), e).toBe(true);
      for (const id of Object.values(s.story ?? {})) expect(gameData.story[id!]?.length, id).toBeGreaterThan(0);
    }
    expect(gameData.story['ev-gear-end'].length).toBeGreaterThan(0);
  });
});
