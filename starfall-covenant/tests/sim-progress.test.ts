import { describe, expect, it } from 'vitest';
import { gameData } from '../src/data/load';
import { createGrowthContext } from '../src/growth';
import { teamCostLimit } from '../src/progression/player';
import {
  archetypeFiveStars, buildProgressTeam, estimateProgress, fiveStarCount, mainOrder, progressHelper, PROGRESS_ASSUMPTIONS,
  type ProgressEstimate,
} from '../tools/sim/progress';

const ctx = createGrowthContext(gameData);
const stages = gameData.stages;
const order = mainOrder(stages);
const est = (id: string) => estimateProgress(order.find((s) => s.id === id)!, stages, ctx, 'fire');
const zeroCores = { fire: 0, water: 0, wood: 0, light: 0, dark: 0 };
const fake = (over: Partial<ProgressEstimate>): ProgressEstimate => ({
  stageId: 'x', mainCleared: 0, chapter: 1, playerLevel: 1, teamCostLimit: 33, coin: 0, dailyRuns: 0, cardExpPerMember: 0, cores: zeroCores, crystals: 0, ...over,
});

describe('sim --progress：進度估算', () => {
  it('主線依解鎖順序排列', () => {
    expect(order[0].id).toBe('st-1-1');
    expect(order).toHaveLength(stages.filter((s) => s.kind === 'main').length);
    for (let i = 1; i < order.length; i++) expect(order[i].unlockAfter).toBe(order[i - 1].id);
  });

  it('第一關是新玩家：Lv1、隊伍空間用 teamCostLimit、沒有每日關卡', () => {
    const p = est('st-1-1');
    expect(p).toMatchObject({ mainCleared: 0, playerLevel: 1, teamCostLimit: teamCostLimit(1), dailyRuns: 0, cardExpPerMember: 0 });
  });

  it('越後面的關，玩家等級、卡片經驗、星核都不會變少', () => {
    let prev = est(order[0].id);
    for (const s of order.slice(1)) {
      const p = est(s.id);
      expect(p.playerLevel).toBeGreaterThanOrEqual(prev.playerLevel);
      expect(p.teamCostLimit).toBe(teamCostLimit(p.playerLevel));
      expect(p.cardExpPerMember).toBeGreaterThanOrEqual(prev.cardExpPerMember);
      expect(p.cores.fire).toBeGreaterThanOrEqual(prev.cores.fire);
      prev = p;
    }
    // 星核只從每日關卡來，第 1 章結束後才開始累積
    expect(est('st-1-9').cores.fire).toBe(0);
    expect(est('st-3-1').cores.fire).toBeGreaterThan(0);
  });

  it('5★ 張數依章節', () => {
    expect(fiveStarCount(1)).toBe(1);
    expect(fiveStarCount(3)).toBe(2);
    expect(fiveStarCount(5, { ...PROGRESS_ASSUMPTIONS, fiveStarsByChapter: [] })).toBe(0);
  });
});

describe('sim --progress：一次性獎勵', () => {
  // 正式資料目前首通沒有星核，用改過的資料驗證
  const stagesWithRewards = stages.map((s) => (s.id === 'st-2-9'
    ? { ...s, rewards: { ...s.rewards, firstClear: { ...s.rewards.firstClear, coin: 1000, cards: [{ card: 'c916', count: 2 }, { card: 'c921', count: 1 }, { card: 'c901', count: 3 }] } } }
    : s));
  const chapters = [{ ...gameData.chapters.find((c) => c.chapter === 2)!, starReward: { cards: [{ card: 'c917', count: 1 }] } }];
  const at = (id: string, st = stagesWithRewards, ch = chapters) => estimateProgress(order.find((s) => s.id === id)!, st, ctx, 'fire', PROGRESS_ASSUMPTIONS, ch);

  it('首通獎勵的星核、結晶、經驗素材、金幣都算進去（打完那關之後才有）', () => {
    const base = at('st-3-1', stages, []);
    const p = at('st-3-1', stagesWithRewards, []);
    expect(p.cores.fire - base.cores.fire).toBeCloseTo(2);
    expect(p.crystals - base.crystals).toBeCloseTo(1);
    expect(p.coin - base.coin).toBe(1000);
    expect(p.cardExpPerMember - base.cardExpPerMember).toBe(Math.floor(3 * ctx.card('c901')!.expValue / 5));
    expect(at('st-2-9', stagesWithRewards, []).cores.fire).toBe(at('st-2-9', stages, []).cores.fire);
  });

  it('章節星章獎勵在打完該章最後一關後才算', () => {
    expect(at('st-2-9').cores.water).toBe(at('st-2-9', stagesWithRewards, []).cores.water);
    expect(at('st-3-1').cores.water - at('st-3-1', stagesWithRewards, []).cores.water).toBeCloseTo(1);
  });

  it('獎勵給的結晶不扣商店金幣', () => {
    expect(at('st-3-5').coin - at('st-3-5', stages, []).coin).toBe(1000);
  });
});

describe('sim --progress：組隊', () => {
  const starter = ['c106', 'c107', 'c111', 'c109', 'c108'];
  const pool = archetypeFiveStars('mono', Object.values(gameData.gachaPools[0].cards).flat(), ctx);

  it('流派 5★ 從常駐池取，換掉稀有度最低的隊員，而且放得下才換', () => {
    expect(pool.map((c) => c.id)).toContain('c104');
    const t = buildProgressTeam('mono', starter, pool, fake({ teamCostLimit: 33 }), ctx);
    expect(t.fiveStars).toBe(1);
    expect(t.members.map((m) => m.cardId)).toEqual(['c106', 'c107', 'c111', 'c104', 'c108']); // 同稀有度同 Cost 時換後面的
    expect(t.cost).toBeLessThanOrEqual(33);
    const tight = buildProgressTeam('mono', starter, pool, fake({ teamCostLimit: 26 }), ctx);
    expect(tight.fiveStars).toBe(0);
    expect(tight.members.map((m) => m.cardId)).toEqual(starter);
  });

  it('滿級又有星核、金幣時進化；星核不夠就不進化', () => {
    const big = fake({ cardExpPerMember: 10_000_000, coin: 1_000_000, cores: { ...zeroCores, fire: 5 }, teamCostLimit: 200 });
    const t = buildProgressTeam('mono', starter, [], big, ctx);
    expect(t.members.find((m) => m.baseId === 'c109')).toMatchObject({ cardId: 'c110', evolved: true });
    expect(t.members.find((m) => m.baseId === 'c106')?.level).toBe(ctx.card('c106')!.maxLevel);
    const noCore = buildProgressTeam('mono', starter, [], { ...big, cores: zeroCores }, ctx);
    expect(noCore.members.some((m) => m.evolved)).toBe(false);
  });

  it('進化後超過隊伍空間就退回進化前', () => {
    const big = fake({ cardExpPerMember: 10_000_000, coin: 1_000_000, cores: { ...zeroCores, fire: 5 }, teamCostLimit: 26 });
    const t = buildProgressTeam('mono', starter, [], big, ctx);
    expect(t.cost).toBeLessThanOrEqual(26);
    expect(t.members.some((m) => m.evolved)).toBe(false);
  });

  it('星核期望值是小數相加（≈ 0.9999…）也算夠 1 張', () => {
    const cores = { ...zeroCores, fire: 0.7 + 0.1 + 0.1 + 0.1 };
    expect(cores.fire).toBeLessThan(1);
    const t = buildProgressTeam('berserk', ['c102', 'c107', 'c111', 'c109', 'c108'], [], fake({ coin: 1_000_000, cores, teamCostLimit: 200 }), ctx);
    expect(t.members[0].awakened).toBe(1);
  });

  it('隊長有剩下的星核與金幣時解鎖第 1 個覺醒', () => {
    const leaderWithAwaken = ['c102', 'c107', 'c111', 'c109', 'c108'];
    const rich = fake({ cardExpPerMember: 0, coin: 1_000_000, cores: { ...zeroCores, fire: 1 }, teamCostLimit: 200 });
    expect(buildProgressTeam('berserk', leaderWithAwaken, [], rich, ctx).members[0].awakened).toBe(1);
    expect(buildProgressTeam('berserk', leaderWithAwaken, [], { ...rich, coin: 0 }, ctx).members[0].awakened).toBe(0);
  });

  it('星輝結晶：突破有覺醒的隊員，突破夠了就依序解鎖覺醒 2、3', () => {
    const team = ['c102', 'c107', 'c111', 'c109', 'c108'];
    const rich = fake({ coin: 10_000_000, cores: { ...zeroCores, fire: 20 }, teamCostLimit: 200 });
    const none = buildProgressTeam('berserk', team, [], rich, ctx).members[0];
    expect(none).toMatchObject({ limitBreak: 0, awakened: 1 });
    const five = buildProgressTeam('berserk', team, [], { ...rich, crystals: 5 }, ctx).members[0];
    expect(five).toMatchObject({ limitBreak: 5, awakened: 3 });
    const three = buildProgressTeam('berserk', team, [], { ...rich, crystals: 3.2 }, ctx).members[0];
    expect(three).toMatchObject({ limitBreak: 3, awakened: 2 });
    // 金幣不夠就停在前一個覺醒
    expect(buildProgressTeam('berserk', team, [], { ...rich, coin: 20_000, crystals: 5 }, ctx).members[0].awakened).toBe(1);
  });

  it('結晶從克星週開放後才開始累積，並扣掉商店購買的金幣', () => {
    expect(est('st-3-1').crystals).toBe(0);
    expect(est('st-3-5').crystals).toBeCloseTo(PROGRESS_ASSUMPTIONS.crystalsPerMainStage * 3);
    const noCrystal = estimateProgress(order.find((s) => s.id === 'st-4-1')!, stages, ctx, 'fire', { ...PROGRESS_ASSUMPTIONS, crystalsPerMainStage: 0 });
    const p = est('st-4-1');
    expect(noCrystal.coin - p.coin).toBe(Math.round(p.crystals * PROGRESS_ASSUMPTIONS.crystalShopShare * PROGRESS_ASSUMPTIONS.crystalCoin));
  });

  it('助戰和出擊準備一樣取第一位可用的 NPC', () => {
    const h = progressHelper(order[0], stages, ctx, Date.UTC(2026, 9, 31));
    expect(h === null || h.level >= 1).toBe(true);
  });
});
