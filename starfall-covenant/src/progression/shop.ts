// 商店：星晶／金幣／活動代幣購買，限購次數依每日／每週／永久／活動計算
import type { GameConfig, SaveData, ShopItemDef } from '../core/types';
import { maxStamina } from './player';
import { fail, ok, type SaveResult } from './result';
import { grantReward } from './rewards';
import { regenStamina } from './stamina';
import { eventPeriod, type EventDef } from './events';
import { dateKey, weekKey } from './time';

export type ShopFail = 'soldOut' | 'notEnoughGems' | 'notEnoughCoin' | 'notEnoughTokens' | 'alreadyFull';

/** 活動限購的商品屬於哪個活動：用該活動代幣標價的就是 */
export function shopItemEvent(item: ShopItemDef, events: EventDef[]): EventDef | undefined {
  const tokens = Object.keys(item.price.tokens ?? {});
  return events.find((e) => e.token && tokens.includes(e.token));
}

/**
 * 限購計數的存檔鍵：商品 id＋週期，例如 coin-pack@d2026-10-30。
 * 活動限購＝商品 id＋活動 id＋檔期開始日（ev-c601@eev-beast-call:2026-10-26），下一期自動重置。
 * 舊存檔的活動限購只存商品 id（見 legacyEventCount）。
 */
function purchaseKey(item: ShopItemDef, now: number, events: EventDef[]): string {
  switch (item.limit?.per) {
    case 'day': return `${item.id}@d${dateKey(now)}`;
    case 'week': return `${item.id}@w${weekKey(now)}`;
    case 'event': {
      const event = shopItemEvent(item, events);
      if (!event) return item.id;
      const { start } = eventPeriod(event, now);
      return `${item.id}@e${event.id}${start === null ? '' : `:${dateKey(start)}`}`;
    }
    default: return item.id;
  }
}

/** 舊存檔以商品 id 記的活動限購：視為第 0 期（第一期）買的，只在第一期內有效 */
function legacyEventCount(save: SaveData, item: ShopItemDef, now: number, events: EventDef[]): number {
  if (item.limit?.per !== 'event') return 0;
  const event = shopItemEvent(item, events);
  if (!event || eventPeriod(event, now).index !== 0) return 0;
  return save.daily.shopPurchases[item.id] ?? 0;
}

export function purchasedCount(save: SaveData, item: ShopItemDef, now: number, events: EventDef[] = []): number {
  const legacy = legacyEventCount(save, item, now, events);
  const event = item.limit?.per === 'event' ? shopItemEvent(item, events) : undefined;
  if (event && !event.period) {
    // 常駐活動只有一期：改成常駐前在各檔期買的都算數，限購不會因此重置
    const prefix = `${item.id}@e${event.id}`;
    let n = legacy;
    for (const [k, v] of Object.entries(save.daily.shopPurchases)) if (k === prefix || k.startsWith(`${prefix}:`)) n += v;
    return n;
  }
  return (save.daily.shopPurchases[purchaseKey(item, now, events)] ?? 0) + legacy;
}

export function remainingPurchases(save: SaveData, item: ShopItemDef, now: number, events: EventDef[] = []): number {
  if (!item.limit) return Infinity;
  return Math.max(0, item.limit.count - purchasedCount(save, item, now, events));
}

/** 丟掉已過期的每日／每週計數，避免存檔越長越大 */
function pruneOld(purchases: Record<string, number>, now: number): Record<string, number> {
  const today = `@d${dateKey(now)}`;
  const week = `@w${weekKey(now)}`;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(purchases)) {
    if ((k.includes('@d') && !k.endsWith(today)) || (k.includes('@w') && !k.endsWith(week))) continue;
    out[k] = v;
  }
  return out;
}

/** events：活動資料（data/events.json），活動限購依檔期計算；不給時活動限購視為永久限購 */
export function buyItem(save: SaveData, item: ShopItemDef, config: GameConfig, now: number, events: EventDef[] = []): SaveResult<ShopFail> {
  if (remainingPurchases(save, item, now, events) <= 0) return fail('soldOut');
  const { gems = 0, coin = 0, tokens = {} } = item.price;
  if (save.player.gems < gems) return fail('notEnoughGems');
  if (save.player.coin < coin) return fail('notEnoughCoin');
  for (const [t, n] of Object.entries(tokens)) if ((save.player.tokens[t] ?? 0) < n) return fail('notEnoughTokens');

  let s: SaveData = regenStamina(save, config, now);
  const paidTokens = { ...s.player.tokens };
  for (const [t, n] of Object.entries(tokens)) paidTokens[t] -= n;
  s = { ...s, player: { ...s.player, gems: s.player.gems - gems, coin: s.player.coin - coin, tokens: paidTokens } };

  const reward = item.reward;
  if ('type' in reward && reward.type === 'refillStamina') {
    const cap = maxStamina(s.player.level, config);
    if (s.stamina.current >= cap) return fail('alreadyFull');
    s = { ...s, stamina: { current: cap, lastUpdate: now } };
  } else if ('type' in reward && reward.type === 'expandInventory') {
    s = { ...s, inventory: { ...s.inventory, capacity: s.inventory.capacity + reward.amount } };
  } else {
    s = grantReward(s, reward, config, now).save;
  }

  const key = purchaseKey(item, now, events);
  const purchases = pruneOld(s.daily.shopPurchases, now);
  purchases[key] = (purchases[key] ?? 0) + 1;
  return ok({ ...s, daily: { ...s.daily, shopPurchases: purchases } });
}
