import { describe, expect, it } from 'vitest';
import { gameData } from '../src/data/load';
import {
  clearItems, countDuration, countValue, firstClearPreview, levelUpView, revealSchedule, revealSfx, rewardItems, tickInterval,
} from '../src/ui/reward-plan';
import type { StageClearResult } from '../src/progression/stages';
import { maxStamina, teamCostLimit } from '../src/progression/player';

const clear: StageClearResult = {
  coin: 240, playerExp: 18, cardExp: 60, firstClear: { gems: 1 },
  drops: [{ cardId: 'c901', uid: 'u9' }, { cardId: 'c901', uid: 'u10' }],
  stars: [true, false, true], newStars: [true, false, false],
};

describe('結算演出項目', () => {
  it('依序：戰績 → 金幣 → 經驗 → 首通星晶 → 掉落卡 → 星章', () => {
    const items = clearItems({ turns: 4, maxCombo: 7 }, clear, ['a', 'b', 'c'], { team: [{ cardId: 'c101', from: 3, to: 4 }] });
    expect(items.map((i) => i.kind)).toEqual(['stat', 'stat', 'count', 'count', 'team', 'count', 'card', 'card', 'star', 'star', 'star']);
    expect(items[4]).toEqual({ kind: 'team', amount: 60, members: [{ cardId: 'c101', from: 3, to: 4 }] });
    expect(items[5]).toMatchObject({ icon: 'gem', label: '星晶', amount: 1, tag: '首通', special: true });
    expect(items.slice(8)).toEqual([
      { kind: 'star', text: 'a', got: true, isNew: true },
      { kind: 'star', text: 'b', got: false, isNew: false },
      { kind: 'star', text: 'c', got: true, isNew: false },
    ]);
  });
  it('隊員經驗沒有發給任何人時不顯示；章節獎勵接在首通後面', () => {
    const items = clearItems({ turns: 4, maxCombo: 7 }, clear, [], { team: [], chapterReward: { gems: 5 } });
    expect(items.some((i) => i.kind === 'team')).toBe(false);
    expect(items.filter((i) => i.kind === 'count' && i.icon === 'gem').map((i) => i.kind === 'count' && i.tag)).toEqual(['首通', '章節']);
  });
  it('練習關沒有結算資料時只顯示戰績；數量為 0 的項目不顯示', () => {
    expect(clearItems({ turns: 3, maxCombo: 2 }, null)).toHaveLength(2);
    const items = clearItems({ turns: 3, maxCombo: 2 }, { ...clear, cardExp: 0, firstClear: undefined, drops: [] });
    expect(items.map((i) => (i.kind === 'count' ? i.label : i.kind))).toEqual(['stat', 'stat', '金幣', '玩家經驗']);
  });
  it('一般獎勵：星晶放最後壓軸，卡片與代幣都拆出來', () => {
    const items = rewardItems({ gems: 5, coin: 1000, stamina: 10, tokens: { 'token-beast': 3 }, cards: [{ card: 'c901', count: 2 }] });
    expect(items.map((i) => (i.kind === 'count' ? i.label : i.kind))).toEqual(['金幣', '體力', '獸王代幣', 'card', '星晶']);
    expect(rewardItems({})).toEqual([]);
  });
});

describe('數字滾動與時間表', () => {
  it('滾動數值為整數、單調遞增、結束時剛好等於目標', () => {
    let prev = 0;
    for (let i = 0; i <= 20; i++) {
      const v = countValue(1234, i / 20);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
    expect(countValue(1234, 1)).toBe(1234);
    expect(countValue(1234, 0)).toBe(0);
    expect(countValue(1234, 2)).toBe(1234);
  });
  it('滾動時間隨數量變長，但不超過 0.9 秒；1 不用滾', () => {
    expect(countDuration(1)).toBe(0);
    expect(countDuration(10)).toBeLessThan(countDuration(10000));
    expect(countDuration(1e12)).toBe(900);
  });
  it('時間表依序排開，加速時整體變短', () => {
    const items = clearItems({ turns: 4, maxCombo: 7 }, clear, ['a', 'b', 'c']);
    const normal = revealSchedule(items);
    expect(normal.starts[0]).toBe(0);
    for (let i = 1; i < items.length; i++) expect(normal.starts[i]).toBeGreaterThan(normal.starts[i - 1]);
    expect(revealSchedule(items, 2).total).toBeLessThan(normal.total);
    // 整段結算演出控制在 6 秒內，點畫面可以快轉
    expect(normal.total).toBeLessThan(6000);
  });
  it('音效：星晶有專屬音，沒拿到的星章不出聲，計數音最多 8 下', () => {
    expect(revealSfx({ kind: 'count', icon: 'gem', label: '星晶', amount: 1, special: true })).toBe('gem');
    expect(revealSfx({ kind: 'count', icon: 'coin', label: '金幣', amount: 9 })).toBe('reward');
    expect(revealSfx({ kind: 'star', text: '', got: false, isNew: false })).toBeNull();
    expect(revealSfx({ kind: 'star', text: '', got: true, isNew: true })).toBe('star');
    expect(Math.floor(900 / tickInterval(900))).toBeLessThanOrEqual(8);
  });
});

describe('升級卡與首通預告', () => {
  it('升級卡顯示體力上限與隊伍空間的前後值', () => {
    const v = levelUpView({ from: 4, to: 6, gems: 2 }, gameData.config);
    expect(v).toEqual({
      from: 4, to: 6, gems: 2,
      stamina: [maxStamina(4, gameData.config), maxStamina(6, gameData.config)],
      cost: [teamCostLimit(4), teamCostLimit(6)],
    });
    expect(v.cost[1]).toBeGreaterThan(v.cost[0]);
  });
  it('首通預告：未通關顯示數量，通關後顯示已領，沒有首通獎勵不顯示', () => {
    expect(firstClearPreview({ gems: 1 }, false)).toEqual({ text: '首通 +1', full: '首通：星晶 +1', claimed: false, icon: 'gem' });
    expect(firstClearPreview({ gems: 3, coin: 500 }, false)).toMatchObject({ text: '首通 +3 …', full: '首通：星晶 +3、金幣 +500' });
    // 活動關卡：chip 精簡，完整內容（星晶＋活動代幣）放 title（#68）
    expect(firstClearPreview({ gems: 1, tokens: { 'token-beast': 20 } }, false)).toMatchObject({ text: '首通 +1 …', full: '首通：星晶 +1、獸王代幣 +20', icon: 'gem' });
    expect(firstClearPreview({ gems: 1 }, true)).toMatchObject({ text: '首通 已領', claimed: true });
    expect(firstClearPreview(undefined, false)).toBeNull();
    expect(firstClearPreview({}, false)).toBeNull();
  });
});
