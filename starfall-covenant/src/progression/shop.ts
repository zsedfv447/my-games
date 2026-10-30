// 商店：星晶／金幣／活動代幣購買，限購次數依每日／每週／永久／活動計算
import type { GameConfig, SaveData, ShopItemDef } from '../core/types';
import { maxStamina } from './player';
import { fail, ok, type SaveResult } from './result';
import { grantReward } from './rewards';
import { regenStamina } from './stamina';
import { dateKey, weekKey } from './time';

export type ShopFail = 'soldOut' | 'notEnoughGems' | 'notEnoughCoin' | 'notEnoughTokens' | 'alreadyFull';

/** 限購計數的存檔鍵：商品 id＋週期，例如 coin-pack@d2026-10-30 */
function purchaseKey(item: ShopItemDef, now: number): string {
  switch (item.limit?.per) {
    case 'day': return `${item.id}@d${dateKey(now)}`;
    case 'week': return `${item.id}@w${weekKey(now)}`;
    default: return item.id;
  }
}

export function purchasedCount(save: SaveData, item: ShopItemDef, now: number): number {
  return save.daily.shopPurchases[purchaseKey(item, now)] ?? 0;
}

export function remainingPurchases(save: SaveData, item: ShopItemDef, now: number): number {
  if (!item.limit) return Infinity;
  return Math.max(0, item.limit.count - purchasedCount(save, item, now));
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

export function buyItem(save: SaveData, item: ShopItemDef, config: GameConfig, now: number): SaveResult<ShopFail> {
  if (remainingPurchases(save, item, now) <= 0) return fail('soldOut');
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

  const key = purchaseKey(item, now);
  const purchases = pruneOld(s.daily.shopPurchases, now);
  purchases[key] = (purchases[key] ?? 0) + 1;
  return ok({ ...s, daily: { ...s.daily, shopPurchases: purchases } });
}
