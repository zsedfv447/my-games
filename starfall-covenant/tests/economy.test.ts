import { describe, expect, it } from 'vitest';
import type { QuestDef, SaveData, ShopItemDef } from '../src/core/types';
import { EventBus, type GameEvents } from '../src/core/events';
import { gameData } from '../src/data/load';
import loginRewards from '../data/login-rewards.json';
import { createNewSave } from '../src/save/save';
import { claimLoginReward, loginDayFor, type LoginRewardDef } from '../src/progression/login';
import { buyItem, remainingPurchases } from '../src/progression/shop';
import {
  addQuestCounters, claimQuest, countersForEvent, isKnownCounter, questProgress, resetQuestsIfNeeded, subscribeQuestCounters,
} from '../src/progression/quests';
import { grantReward, mergeRewards } from '../src/progression/rewards';
import { canPayContinue, CONTINUE_COST_GEMS, payContinue } from '../src/progression/continue';

// 測試不受初始卡影響
const config = { ...gameData.config, newPlayer: { ...gameData.config.newPlayer, starterCards: [] } };
const DAY = 86_400_000;
const MON = new Date(2026, 10, 2, 12).getTime();
const fresh = (): SaveData => createNewSave(config, MON);
const rewards = loginRewards as LoginRewardDef[];

describe('獎勵', () => {
  it('發放金幣、星晶、代幣、體力、卡片', () => {
    const { save, cards } = grantReward(fresh(), {
      coin: 10, gems: 2, stamina: 5, tokens: { star: 3 }, cards: [{ card: 'c1', count: 2 }],
    }, config, MON);
    expect(save.player).toMatchObject({ coin: config.newPlayer.coin + 10, gems: config.newPlayer.gems + 2, tokens: { star: 3 } });
    expect(save.stamina.current).toBe(config.stamina.baseMax + 5);
    expect(cards.map((c) => c.uid)).toEqual(['u1', 'u2']);
    expect(save.collection.owned).toEqual(['c1']);
  });

  it('合併獎勵', () => {
    expect(mergeRewards({ coin: 1, cards: [{ card: 'a', count: 1 }] }, undefined, { coin: 2, tokens: { t: 1 }, cards: [{ card: 'a', count: 2 }] }))
      .toEqual({ coin: 3, tokens: { t: 1 }, cards: [{ card: 'a', count: 3 }] });
  });
});

describe('7 日登入', () => {
  it('每天領一次，依序第 1～7 天後循環', () => {
    let s = fresh();
    const got: number[] = [];
    for (let d = 0; d < 9; d++) {
      const now = MON + d * DAY;
      const r = claimLoginReward(s, rewards, config, now);
      if (!r.ok) throw new Error(r.reason);
      got.push(r.day);
      s = r.save;
      expect(claimLoginReward(s, rewards, config, now + 1000)).toEqual({ ok: false, reason: 'alreadyClaimed' });
    }
    expect(got).toEqual([1, 2, 3, 4, 5, 6, 7, 1, 2]);
    expect(loginDayFor(s, MON + 9 * DAY)).toBe(3);
  });

  it('中斷幾天不會重置', () => {
    const r1 = claimLoginReward(fresh(), rewards, config, MON);
    if (!r1.ok) throw new Error();
    const r2 = claimLoginReward(r1.save, rewards, config, MON + 5 * DAY);
    expect(r2.ok && r2.day).toBe(2);
    expect(r2.ok && r2.save.player.gems).toBe(config.newPlayer.gems + 1);
  });
});

describe('商店', () => {
  const coinPack: ShopItemDef = { id: 'mat', name: '素材', price: { coin: 100 }, reward: { cards: [{ card: 'c0901', count: 1 }] }, limit: { count: 2, per: 'day' } };
  const refill: ShopItemDef = { id: 'refill', name: '補體力', price: { gems: 1 }, reward: { type: 'refillStamina' } };
  const expand: ShopItemDef = { id: 'expand', name: '擴充背包', price: { gems: 1 }, reward: { type: 'expandInventory', amount: 5 } };
  const tokenItem: ShopItemDef = { id: 'ev-card', name: '兌換', price: { tokens: { harvest: 50 } }, reward: { cards: [{ card: 'c601', count: 1 }] }, limit: { count: 1, per: 'event' } };
  const weekly: ShopItemDef = { id: 'wk', name: '每週', price: { coin: 1 }, reward: { gems: 1 }, limit: { count: 1, per: 'week' } };

  it('每日限購，隔天重置', () => {
    let s = fresh();
    for (let i = 0; i < 2; i++) {
      const r = buyItem(s, coinPack, config, MON);
      if (!r.ok) throw new Error(r.reason);
      s = r.save;
    }
    expect(s.player.coin).toBe(config.newPlayer.coin - 200);
    expect(s.inventory.cards).toHaveLength(2);
    expect(buyItem(s, coinPack, config, MON)).toEqual({ ok: false, reason: 'soldOut' });
    expect(remainingPurchases(s, coinPack, MON + DAY)).toBe(2);
    const next = buyItem(s, coinPack, config, MON + DAY);
    expect(next.ok && Object.keys(next.save.daily.shopPurchases)).toHaveLength(1);
  });

  it('每週限購，下週一重置', () => {
    const r = buyItem(fresh(), weekly, config, MON);
    if (!r.ok) throw new Error();
    expect(remainingPurchases(r.save, weekly, MON + 6 * DAY)).toBe(0);
    expect(remainingPurchases(r.save, weekly, MON + 7 * DAY)).toBe(1);
  });

  it('補體力、擴背包', () => {
    expect(buyItem(fresh(), refill, config, MON)).toEqual({ ok: false, reason: 'alreadyFull' });
    const tired = { ...fresh(), stamina: { current: 0, lastUpdate: MON } };
    const r = buyItem(tired, refill, config, MON);
    expect(r.ok && r.save.stamina.current).toBe(config.stamina.baseMax);
    const e = buyItem(fresh(), expand, config, MON);
    expect(e.ok && e.save.inventory.capacity).toBe(config.inventory.baseCapacity + 5);
  });

  it('代幣兌換', () => {
    expect(buyItem(fresh(), tokenItem, config, MON)).toEqual({ ok: false, reason: 'notEnoughTokens' });
    const rich = { ...fresh(), player: { ...fresh().player, tokens: { harvest: 60 } } };
    const r = buyItem(rich, tokenItem, config, MON);
    if (!r.ok) throw new Error();
    expect(r.save.player.tokens.harvest).toBe(10);
    expect(buyItem({ ...r.save, player: { ...r.save.player, tokens: { harvest: 99 } } }, tokenItem, config, MON + 30 * DAY))
      .toEqual({ ok: false, reason: 'soldOut' });
  });

  it('錢不夠', () => {
    const poor = { ...fresh(), player: { ...fresh().player, coin: 0, gems: 0 } };
    expect(buyItem(poor, coinPack, config, MON)).toEqual({ ok: false, reason: 'notEnoughCoin' });
    expect(buyItem(poor, expand, config, MON)).toEqual({ ok: false, reason: 'notEnoughGems' });
  });
});

describe('任務與成就', () => {
  const quests: QuestDef[] = [
    { id: 'q-d-combo', kind: 'daily', name: '轉出 10 Combo', counter: 'combo10', target: 1, reward: { gems: 1 } },
    { id: 'q-d-clear', kind: 'daily', name: '通關 3 次', counter: 'stageClear', target: 3, reward: { coin: 500 } },
    { id: 'q-w-gacha', kind: 'weekly', name: '召喚 10 次', counter: 'gachaPull', target: 10, reward: { gems: 2 } },
    { id: 'a-best', kind: 'achievement', name: '單回合 12 Combo', counter: 'comboBest', target: 12, reward: { gems: 5 } },
  ];

  it('data/quests.json 只用已知的計數器', () => {
    expect(gameData.quests.filter((q) => !isKnownCounter(q.counter)).map((q) => q.id)).toEqual([]);
    expect(quests.every((q) => isKnownCounter(q.counter))).toBe(true);
  });

  it('事件轉成計數', () => {
    expect(countersForEvent('comboResolved', { combo: 9, orbsCleared: 30 }))
      .toEqual({ comboTotal: 9, comboBest: 9, orbsCleared: 30, combo5: 1, combo8: 1 });
    expect(countersForEvent('stageCleared', { stageId: 'x', turns: 3, stars: [true, true, true] }, { stageKind: 'main' }))
      .toEqual({ stageClear: 1, 'stageClear:main': 1, stageClear3Stars: 1 });
    expect(countersForEvent('gachaPulled', { poolId: 'p', count: 10 })).toEqual({ gachaPull: 10 });
  });

  it('達標領獎，不能重複領', () => {
    let s = addQuestCounters(fresh(), { combo10: 1 }, quests, MON);
    const q = quests[0];
    expect(questProgress(s, q)).toEqual({ value: 1, done: true, claimed: false });
    const r = claimQuest(s, q, quests, config, MON);
    if (!r.ok) throw new Error(r.reason);
    s = r.save;
    expect(s.player.gems).toBe(config.newPlayer.gems + 1);
    expect(claimQuest(s, q, quests, config, MON)).toEqual({ ok: false, reason: 'alreadyClaimed' });
    expect(claimQuest(s, quests[1], quests, config, MON)).toEqual({ ok: false, reason: 'notDone' });
  });

  it('每日跨日重置、每週跨週重置、成就不重置', () => {
    let s = addQuestCounters(fresh(), { combo10: 1, gachaPull: 10, comboBest: 12 }, quests, MON);
    const r = claimQuest(s, quests[0], quests, config, MON);
    if (!r.ok) throw new Error();
    s = resetQuestsIfNeeded(r.save, quests, MON + DAY);
    expect(questProgress(s, quests[0])).toEqual({ value: 0, done: false, claimed: false });
    expect(questProgress(s, quests[2]).done).toBe(true);
    s = resetQuestsIfNeeded(s, quests, MON + 7 * DAY);
    expect(questProgress(s, quests[2]).done).toBe(false);
    expect(questProgress(s, quests[3]).done).toBe(true);
  });

  it('最高 Combo 取最大值', () => {
    let s = addQuestCounters(fresh(), { comboBest: 12 }, quests, MON);
    s = addQuestCounters(s, { comboBest: 4 }, quests, MON);
    expect(s.quests.counters.comboBest).toBe(12);
  });

  it('訂閱事件匯流排自動計數', () => {
    const bus = new EventBus<GameEvents>();
    let s = fresh();
    const off = subscribeQuestCounters(bus, (fn) => { s = fn(s); }, quests, () => 'main', () => MON);
    bus.emit('stageCleared', { stageId: 'st-1-1', turns: 3, stars: [] });
    bus.emit('stageCleared', { stageId: 'st-1-2', turns: 3, stars: [] });
    bus.emit('comboResolved', { combo: 10, orbsCleared: 30 });
    off();
    bus.emit('stageCleared', { stageId: 'st-1-3', turns: 3, stars: [] });
    expect(s.quests.counters['d:stageClear']).toBe(2);
    expect(s.quests.counters['stageClear:main']).toBe(2);
    expect(questProgress(s, quests[0]).done).toBe(true);
  });
});

describe('續戰', () => {
  it('扣 5 星晶；不夠時失敗', () => {
    const r = payContinue(fresh());
    expect(r.ok && r.save.player.gems).toBe(config.newPlayer.gems - CONTINUE_COST_GEMS);
    expect(CONTINUE_COST_GEMS).toBe(5);
    const poor = { ...fresh(), player: { ...fresh().player, gems: 4 } };
    expect(canPayContinue(poor)).toBe(false);
    expect(payContinue(poor)).toEqual({ ok: false, reason: 'notEnoughGems' });
  });
});
