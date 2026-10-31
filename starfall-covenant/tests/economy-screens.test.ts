import { describe, expect, it } from 'vitest';
import type { SaveData } from '../src/core/types';
import { gameData } from '../src/data/load';
import { createNewSave } from '../src/save/save';
import { claimLoginReward } from '../src/progression/login';
import { buyItem, remainingPurchases } from '../src/progression/shop';
import { addQuestCounters, claimAllQuests, claimableQuests, claimQuest, derivedCounters, questProgress } from '../src/progression/quests';
import {
  homeBadges, limitText, loginCalendar, loginRewards, questDerived, rewardParts, shopItemDetail, shopPrice, shopTab, sortQuests,
} from '../src/ui/economy';
import { SCREENS } from '../src/ui/screens';
import { placeholderScreens } from '../src/ui/screens/placeholders';

const config = { ...gameData.config, newPlayer: { ...gameData.config.newPlayer, starterCards: [] } };
const DAY = 86_400_000;
const MON = new Date(2026, 10, 2, 12).getTime();
const fresh = (): SaveData => createNewSave(config, MON);
const shopItem = (id: string) => gameData.shop.find((i) => i.id === id)!;
const quest = (id: string) => gameData.quests.find((q) => q.id === id)!;

describe('商店與任務資料', () => {
  it('每日、每週任務與 73 項成就', () => {
    const count = (k: string) => gameData.quests.filter((q) => q.kind === k).length;
    expect(count('daily')).toBeGreaterThanOrEqual(5);
    expect(count('weekly')).toBeGreaterThanOrEqual(5);
    expect(count('achievement')).toBe(73);
  });

  it('星晶產出跟抽卡價格平衡：每日＋每週任務每週約 2–4 次單抽', () => {
    const gems = (k: string) => gameData.quests.filter((q) => q.kind === k).reduce((n, q) => n + (q.reward.gems ?? 0), 0);
    const perWeek = gems('daily') * 7 + gems('weekly');
    const single = gameData.gachaPools[0].cost.gems;
    expect(perWeek / single).toBeGreaterThanOrEqual(2);
    expect(perWeek / single).toBeLessThanOrEqual(4);
  });

  it('商店有星晶、金幣、活動兌換三類，素材每日／每週／每月限購', () => {
    const tabs = new Set(gameData.shop.map(shopTab));
    expect([...tabs].sort()).toEqual(['coin', 'event', 'gems']);
    for (const item of gameData.shop.filter((i) => shopTab(i) === 'coin')) expect(['day', 'week', 'month']).toContain(item.limit?.per);
  });

  it('活動兌換照關卡規劃：c601 要 200 代幣、限 1', () => {
    expect(shopItem('ev-c601')).toMatchObject({ price: { tokens: { 'token-beast': 200 } }, limit: { count: 1 } });
  });
});

describe('商店購買', () => {
  it('補體力扣星晶並補滿，滿體力時不扣款', () => {
    const item = shopItem('gem-refill');
    let s = fresh();
    expect(buyItem(s, item, config, MON)).toEqual({ ok: false, reason: 'alreadyFull' });
    s = { ...s, stamina: { current: 0, lastUpdate: MON } };
    const r = buyItem(s, item, config, MON);
    if (!r.ok) throw new Error(r.reason);
    expect(r.save.player.gems).toBe(config.newPlayer.gems - item.price.gems!);
    expect(r.save.stamina.current).toBe(config.stamina.baseMax);
  });

  it('金幣買素材：給卡、扣金幣、每日限購隔天恢復', () => {
    const item = shopItem('coin-fire-mid');
    let s = { ...fresh(), player: { ...fresh().player, coin: 100_000 } };
    for (let i = 0; i < item.limit!.count; i++) {
      const r = buyItem(s, item, config, MON);
      if (!r.ok) throw new Error(r.reason);
      s = r.save;
    }
    expect(s.inventory.cards.map((c) => c.cardId)).toEqual(['c902', 'c902']);
    expect(s.player.coin).toBe(100_000 - 2 * item.price.coin!);
    expect(buyItem(s, item, config, MON)).toEqual({ ok: false, reason: 'soldOut' });
    expect(remainingPurchases(s, item, MON + DAY)).toBe(item.limit!.count);
  });

  it('代幣不足不能兌換', () => {
    expect(buyItem(fresh(), shopItem('ev-c601'), config, MON)).toEqual({ ok: false, reason: 'notEnoughTokens' });
  });

  it('價格、限購、商品說明文字', () => {
    expect(shopPrice(shopItem('ev-gems'))).toEqual({ icon: 'token', amount: 30, token: 'token-beast' });
    expect(limitText(shopItem('gem-refill'), 2)).toBe('每日 2/3');
    expect(shopItemDetail(shopItem('gem-expand'))).toBe('卡片背包上限 +5');
    expect(shopItemDetail(shopItem('coin-water-core'))).toBe('4★ 潮屬性・素材');
    expect(shopItemDetail(shopItem('gem-coin'))).toBe('金幣 ×10,000');
  });
});

describe('7 日登入日曆', () => {
  it('新玩家第 1 天可領；領完後標示已領', () => {
    let s = fresh();
    expect(loginCalendar(s, MON).map((d) => d.state)).toEqual(['today', ...Array(6).fill('upcoming')]);
    const r = claimLoginReward(s, loginRewards, config, MON);
    if (!r.ok) throw new Error(r.reason);
    s = r.save;
    expect(loginCalendar(s, MON).map((d) => d.state)).toEqual(['claimedToday', ...Array(6).fill('upcoming')]);
    expect(loginCalendar(s, MON + DAY).map((d) => d.state).slice(0, 3)).toEqual(['claimed', 'today', 'upcoming']);
  });

  it('領完第 7 天後的隔天回到第 1 天', () => {
    let s = fresh();
    for (let d = 0; d < 7; d++) {
      const r = claimLoginReward(s, loginRewards, config, MON + d * DAY);
      if (!r.ok) throw new Error(r.reason);
      s = r.save;
    }
    expect(loginCalendar(s, MON + 6 * DAY).every((d) => d.state === 'claimed' || d.state === 'claimedToday')).toBe(true);
    expect(loginCalendar(s, MON + 7 * DAY)[0].state).toBe('today');
  });
});

describe('任務與成就', () => {
  it('成就可用存檔推算的數值：玩家等級、收集數、主線通關數', () => {
    const s = { ...fresh(), player: { ...fresh().player, level: 12 }, progress: { ...fresh().progress, clearedStages: ['st-1-1', 'st-1-2', 'trial-mono'] } };
    const d = questDerived(s);
    expect(d).toMatchObject({ playerLevel: 12, mainCleared: 2, trialCleared: 1 });
    expect(questProgress(s, quest('a-playerLevel-10'), d)).toEqual({ value: 10, done: true, claimed: false });
    expect(derivedCounters(s, () => 'main').mainCleared).toBe(3);
  });

  it('每日任務只看計數器，不會被推算數值影響', () => {
    const daily = { ...quest('d-login'), counter: 'playerLevel' };
    expect(questProgress(fresh(), daily, { playerLevel: 50 }).done).toBe(false);
  });

  it('領每日任務會累計「領取每日任務」任務', () => {
    let s = addQuestCounters(fresh(), { login: 1, stageClear: 3, 'stageClear:daily': 1, combo5: 5, orbsCleared: 150 }, gameData.quests, MON);
    for (const id of ['d-login', 'd-clear', 'd-daily-stage', 'd-combo5', 'd-orbs']) {
      const r = claimQuest(s, quest(id), gameData.quests, config, MON);
      if (!r.ok) throw new Error(`${id} ${r.reason}`);
      s = r.save;
    }
    expect(questProgress(s, quest('d-all')).done).toBe(true);
    expect(claimableQuests(s, gameData.quests, MON).map((q) => q.id)).toContain('d-all');
  });

  it('一鍵領取：同一次操作連帶領到「領取 5 個每日任務」，不碰其他種類', () => {
    const s = addQuestCounters(fresh(), { login: 1, stageClear: 3, 'stageClear:daily': 1, combo5: 5, orbsCleared: 150, gachaPull: 1 }, gameData.quests, MON);
    const r = claimAllQuests(s, ['daily'], gameData.quests, config, MON);
    expect(r.claimed.map((q) => q.id).sort()).toEqual(['d-all', 'd-clear', 'd-combo5', 'd-daily-stage', 'd-login', 'd-orbs']);
    expect(r.save.player.gems).toBe(config.newPlayer.gems + 1);
    expect(r.save.quests.claimed).not.toContain('a-gachaPull-1');
    expect(claimAllQuests(r.save, ['daily'], gameData.quests, config, MON).claimed).toEqual([]);
  });

  it('一鍵領取成就時用 derive 推算存檔數值', () => {
    const s = { ...fresh(), player: { ...fresh().player, level: 20 } };
    const r = claimAllQuests(s, ['achievement'], gameData.quests, config, MON, questDerived);
    expect(r.claimed.map((q) => q.id)).toEqual(['a-playerLevel-10', 'a-playerLevel-20']);
    expect(claimAllQuests(s, ['achievement'], gameData.quests, config, MON).claimed).toEqual([]);
  });

  it('主城紅點：可領登入、任務、成就時亮起', () => {
    const s = fresh();
    expect(homeBadges(s, MON)).toEqual({ login: true, quests: false, achievements: false, chapters: false, collection: false });
    const busy = addQuestCounters(s, { stageClear: 3, gachaPull: 1 }, gameData.quests, MON);
    expect(homeBadges(busy, MON)).toMatchObject({ quests: true, achievements: true });
  });

  it('主城紅點：第 1 章星章集滿且還沒領時亮起，領完熄滅', () => {
    const s = fresh();
    const stars = Object.fromEntries(gameData.stages.filter((st) => st.kind === 'main' && st.chapter === 1).map((st) => [st.id, (st.stars ?? []).map(() => true)]));
    const full = { ...s, progress: { ...s.progress, stars } };
    expect(homeBadges(full, MON).chapters).toBe(true);
    const claimed = { ...full, progress: { ...full.progress, chapterRewardsClaimed: [1] } };
    expect(homeBadges(claimed, MON).chapters).toBe(false);
  });

  it('主城紅點：圖鑑有可領的收集獎勵時亮起，領完熄滅', () => {
    const s = fresh();
    const owned = { ...s, collection: { ...s.collection, owned: ['c206'] } };
    expect(homeBadges(owned, MON).collection).toBe(true);
    const claimed = { ...owned, collection: { ...owned.collection, claimed: ['c206'] } };
    expect(homeBadges(claimed, MON).collection).toBe(false);
  });

  it('列表排序：可領 → 進行中 → 已領', () => {
    const rows = [{ id: 'a', done: false, claimed: false }, { id: 'b', done: true, claimed: true }, { id: 'c', done: true, claimed: false }];
    expect(sortQuests(rows).map((r) => r.id)).toEqual(['c', 'a', 'b']);
  });

  it('獎勵文字', () => {
    expect(rewardParts({ gems: 2, coin: 10000, tokens: { 'token-beast': 20 }, cards: [{ card: 'c601', count: 1 }] }).map((p) => p.label))
      .toEqual(['星晶 ×2', '金幣 ×10,000', '獸王代幣 ×20', '金鬃獅王・格魯']);
  });
});

describe('畫面註冊', () => {
  it('商店、登入、任務、成就換成正式畫面', () => {
    const stubs = new Set(placeholderScreens.map((s) => s.name));
    for (const name of ['shop', 'login-bonus', 'quests', 'achievements']) {
      expect(stubs.has(name), name).toBe(false);
      expect(SCREENS.filter((s) => s.name === name)).toHaveLength(1);
    }
  });
});
