import { describe, expect, it } from 'vitest';
import type { CardDef, SaveData, StageDef } from '../src/core/types';
import { createRng } from '../src/core/rng';
import { gameData } from '../src/data/load';
import { createNewSave } from '../src/save/save';
import {
  chapterRewardStatus, chapterStars, liveStarStatus, nextStageAfter, stagesUnlockedBy, checkStar, claimChapterStarReward, claimableChapterRewards, checkTeamRule, completeStage, enterStage, stageLockReason, teamUnits, type BattleSummary,
} from '../src/progression/stages';
import { expToNext } from '../src/progression/player';

// 測試不受初始卡影響
const config = { ...gameData.config, newPlayer: { ...gameData.config.newPlayer, starterCards: [] } };
// 2026-11-02 是週一（當地時間）
const MON = new Date(2026, 10, 2, 12).getTime();

const stage = (over: Partial<StageDef> & { id: string }): StageDef => ({
  kind: 'main', chapter: 1, name: over.id, stamina: 5, unlockAfter: null,
  waves: [{ enemies: ['e1'] }], rewards: { coin: 100, playerExp: 10 }, drops: [], ...over,
});

const s11 = stage({
  id: 'st-1-1',
  rewards: { coin: 300, playerExp: 30, cardExp: 50, firstClear: { gems: 1 } },
  stars: [{ type: 'clearWithinTurns', turns: 5 }, { type: 'noActiveSkill' }, { type: 'teamAll', filter: { attribute: 'fire' } }],
  drops: [{ card: 'c0901', rate: 1, level: 3 }, { card: 'c0902', rate: 0 + 1e-9 }],
});
const s12 = stage({ id: 'st-1-2', unlockAfter: 'st-1-1', stars: [{ type: 'maxCombo', combo: 8 }, { type: 'noContinue' }] });
const daily = stage({ id: 'dl-mon', kind: 'daily', chapter: undefined, weekdays: [1] });
const ev = stage({ id: 'ev-1', kind: 'event', chapter: undefined, event: 'ev-harvest' });
const tower = [1, 2, 3].map((n) => stage({ id: `tw-${n}`, kind: 'tower', chapter: undefined, stamina: 0, unlockAfter: n > 1 ? `tw-${n - 1}` : null }));
const trial = stage({
  id: 'tr-combo', kind: 'trial', chapter: undefined, archetype: 'combo',
  fixedTeam: { members: [{ card: 'c2006', level: 30 }] },
  teamRule: { archetype: 'combo' },
  rewards: { coin: 0, playerExp: 0, firstClear: { cards: [{ card: 'c2011', count: 1 }] } },
});
const ctx = { stages: [s11, s12, daily, ev, ...tower, trial], openEvents: new Set(['ev-harvest']) };

const summary = (over: Partial<BattleSummary> = {}): BattleSummary => ({
  turns: 4, usedActiveSkill: false, maxCombo: 6, continues: 0,
  team: [{ attribute: 'fire', race: 'beast' }], ...over,
});

const card = (id: string, over: Partial<CardDef> = {}): CardDef => ({
  id, name: id, attribute: 'water', race: 'beast', rarity: 4, maxLevel: 50,
  stats: { hp: [1, 2], atk: [1, 2], rcv: [1, 2] }, growthCurve: 1, cost: 5, expValue: 1, sellValue: 1,
  archetypes: [{ id: 'combo', role: 'core' }], art: {}, flavor: '', ...over,
});

const fresh = (): SaveData => createNewSave(config, MON);

describe('關卡解鎖與進場', () => {
  it('需要先通過前一關', () => {
    expect(stageLockReason(fresh(), s12, ctx, MON)).toBe('locked');
    const s = { ...fresh(), progress: { ...fresh().progress, clearedStages: ['st-1-1'] } };
    expect(stageLockReason(s, s12, ctx, MON)).toBeNull();
  });

  it('每日關卡只在指定星期開放；活動關卡要活動開放', () => {
    expect(stageLockReason(fresh(), daily, ctx, MON)).toBeNull();
    expect(stageLockReason(fresh(), daily, ctx, MON + 86_400_000)).toBe('wrongDay');
    expect(stageLockReason(fresh(), ev, ctx, MON)).toBeNull();
    expect(stageLockReason(fresh(), ev, { stages: ctx.stages }, MON)).toBe('eventClosed');
  });

  it('進場扣體力；體力不足或背包滿時不能進', () => {
    const r = enterStage(fresh(), s11, ctx, config, MON);
    expect(r.ok && r.save.stamina.current).toBe(config.stamina.baseMax - 5);
    const tired = { ...fresh(), stamina: { current: 2, lastUpdate: MON } };
    expect(enterStage(tired, s11, ctx, config, MON)).toEqual({ ok: false, reason: 'notEnoughStamina' });
    const full = { ...fresh(), inventory: { ...fresh().inventory, capacity: 0 } };
    expect(enterStage(full, s11, ctx, config, MON)).toEqual({ ok: false, reason: 'inventoryFull' });
  });

  it('挑戰之塔不耗體力', () => {
    const tired = { ...fresh(), stamina: { current: 0, lastUpdate: MON } };
    expect(enterStage(tired, tower[0], ctx, config, MON).ok).toBe(true);
  });

  it('隊伍限制', () => {
    expect(checkTeamRule({ archetype: 'combo' }, [card('a'), card('b')])).toBeNull();
    expect(checkTeamRule({ archetype: 'combo' }, [card('a'), card('b', { archetypes: [{ id: 'mono', role: 'core' }] })])).toBe('teamArchetype');
    expect(checkTeamRule({ filter: { attribute: 'water' } }, [card('a')], card('h', { attribute: 'fire' }))).toBe('teamFilter');
    expect(checkTeamRule({ noHelper: true }, [card('a')], card('h'))).toBe('helperNotAllowed');
    expect(checkTeamRule({ requiredCards: ['x'] }, [card('a')])).toBe('teamMissingCard');
    expect(checkTeamRule({ maxMembers: 1 }, [card('a'), card('b')])).toBe('teamTooLarge');
    const rule = stage({ id: 'r', teamRule: { filter: { race: 'dragon' } } });
    expect(enterStage(fresh(), rule, ctx, config, MON, { members: [card('a')] })).toEqual({ ok: false, reason: 'teamFilter' });
  });

  it('流派試煉用借用隊伍，不檢查玩家隊伍', () => {
    const r = enterStage(fresh(), trial, ctx, config, MON, { members: [card('a', { archetypes: [{ id: 'mono', role: 'core' }] })] });
    expect(r.ok).toBe(true);
  });
});

describe('星章', () => {
  it('各種條件', () => {
    expect(checkStar({ type: 'clearWithinTurns', turns: 5 }, summary({ turns: 5 }))).toBe(true);
    expect(checkStar({ type: 'clearWithinTurns', turns: 5 }, summary({ turns: 6 }))).toBe(false);
    expect(checkStar({ type: 'noActiveSkill' }, summary({ usedActiveSkill: true }))).toBe(false);
    expect(checkStar({ type: 'maxCombo', combo: 8 }, summary({ maxCombo: 8 }))).toBe(true);
    expect(checkStar({ type: 'noContinue' }, summary({ continues: 1 }))).toBe(false);
    const mixed = summary({ team: [{ attribute: 'fire', race: 'beast' }, { attribute: 'water', race: 'beast' }] });
    expect(checkStar({ type: 'teamAll', filter: { attribute: 'fire' } }, mixed)).toBe(false);
    expect(checkStar({ type: 'teamAll', filter: { attribute: ['fire', 'water'], race: 'beast' } }, mixed)).toBe(true);
  });

  it('teamUnits 把隊伍 uid 轉成屬性與種族', () => {
    const s = { ...fresh(), inventory: { ...fresh().inventory, cards: [
      { uid: 'u1', cardId: 'c1', level: 1, exp: 0, skillLevel: 1, limitBreak: 0, awakened: 0, locked: false, obtainedAt: 0 },
    ] } };
    expect(teamUnits(s, ['u1', null, 'u9'], [card('c1', { attribute: 'dark', race: 'nether' })])).toEqual([{ attribute: 'dark', race: 'nether' }]);
  });
});

describe('通關結算', () => {
  it('首通：記錄通關、星章、首通獎勵、金幣、掉落、玩家經驗', () => {
    const { save, result } = completeStage(fresh(), s11, summary({ usedActiveSkill: true }), ctx, config, createRng(1), MON);
    expect(save.progress.clearedStages).toEqual(['st-1-1']);
    expect(save.progress.stars['st-1-1']).toEqual([true, false, true]);
    expect(save.player.coin).toBe(config.newPlayer.coin + 300);
    expect(save.player.gems).toBe(config.newPlayer.gems + 1 + (result.levelUp?.gems ?? 0));
    expect(result).toMatchObject({ coin: 300, playerExp: 30, cardExp: 50, firstClear: { gems: 1 }, stars: [true, false, true] });
    expect(result.drops).toEqual([{ cardId: 'c0901', uid: 'u1' }]);
    expect(save.inventory.cards[0]).toMatchObject({ cardId: 'c0901', level: 3 });
    expect(save.collection.owned).toContain('c0901');
    expect(result.levelUp).toEqual({ from: 1, to: 2, gems: 1 });
    expect(save.player.exp).toBe(30 - expToNext(1));
  });

  it('重複通關：沒有首通獎勵，星章取聯集', () => {
    const first = completeStage(fresh(), s11, summary({ usedActiveSkill: true }), ctx, config, createRng(1), MON).save;
    const { save, result } = completeStage(first, s11, summary({ turns: 9 }), ctx, config, createRng(1), MON);
    expect(result.firstClear).toBeUndefined();
    expect(save.progress.clearedStages).toEqual(['st-1-1']);
    expect(result.newStars).toEqual([false, true, false]);
    expect(save.progress.stars['st-1-1']).toEqual([true, true, true]);
    expect(chapterStars(save, 1, ctx.stages)).toEqual({ got: 3, total: 5 });
  });

  it('掉落依機率判定（可重現）', () => {
    const many = Array.from({ length: 2000 }, (_, i) =>
      completeStage(fresh(), stage({ id: 'x', drops: [{ card: 'c1', rate: 0.3 }] }), summary(), ctx, config, createRng(i), MON).result.drops.length);
    const rate = many.reduce((a, b) => a + b, 0) / many.length;
    expect(rate).toBeGreaterThan(0.25);
    expect(rate).toBeLessThan(0.35);
  });

  it('挑戰之塔記錄最高樓層', () => {
    let s = fresh();
    s = completeStage(s, tower[1], summary(), ctx, config, createRng(1), MON).save;
    expect(s.progress.towerFloor).toBe(2);
    s = completeStage(s, tower[0], summary(), ctx, config, createRng(1), MON).save;
    expect(s.progress.towerFloor).toBe(2);
  });

  it('流派試煉首通送卡', () => {
    const { save } = completeStage(fresh(), trial, summary(), ctx, config, createRng(1), MON);
    expect(save.inventory.cards.map((c) => c.cardId)).toEqual(['c2011']);
  });
});

describe('章節星章獎勵', () => {
  const chapters = [
    { chapter: 1, name: '一', constellation: '甲', race: 'beast' as const, starReward: { gems: 5 } },
    { chapter: 2, name: '二', constellation: '乙', race: 'beast' as const, starReward: { gems: 5 } },
  ];
  const stages = [s11, s12];
  const withStars = (stars: Record<string, boolean[]>): SaveData => {
    const s = createNewSave(config, MON);
    return { ...s, progress: { ...s.progress, stars } };
  };

  it('星章沒集滿不能領；沒有星章的章節也不能領', () => {
    const save = withStars({ 'st-1-1': [true, true, true], 'st-1-2': [true, false] });
    expect(chapterRewardStatus(save, 1, stages)).toBe('incomplete');
    expect(chapterRewardStatus(save, 2, stages)).toBe('incomplete');
    expect(claimableChapterRewards(save, chapters, stages)).toEqual([]);
    expect(claimChapterStarReward(save, 1, chapters, stages, config, MON)).toEqual({ ok: false, reason: 'notComplete' });
    expect(claimChapterStarReward(save, 9, chapters, stages, config, MON)).toEqual({ ok: false, reason: 'unknownChapter' });
  });

  it('集滿可領一次，領完紀錄在存檔，不能重複領', () => {
    const save = withStars({ 'st-1-1': [true, true, true], 'st-1-2': [true, true] });
    expect(claimableChapterRewards(save, chapters, stages)).toEqual([1]);
    const r = claimChapterStarReward(save, 1, chapters, stages, config, MON);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.reward).toEqual({ gems: 5 });
    expect(r.save.player.gems).toBe(save.player.gems + 5);
    expect(r.save.progress.chapterRewardsClaimed).toEqual([1]);
    expect(chapterRewardStatus(r.save, 1, stages)).toBe('claimed');
    expect(claimableChapterRewards(r.save, chapters, stages)).toEqual([]);
    expect(claimChapterStarReward(r.save, 1, chapters, stages, config, MON)).toEqual({ ok: false, reason: 'alreadyClaimed' });
  });

  it('分批上線的章節：預定關數還沒上完時，已上線的星章全拿也不能領', () => {
    const partial = [{ ...chapters[0], stageCount: 4 }, chapters[1]];
    const save = withStars({ 'st-1-1': [true, true, true], 'st-1-2': [true, true] });
    // 已上線 2 關共 5 顆，預定 4 關：還差 2 關 × 3 顆
    expect(chapterStars(save, 1, stages, partial)).toEqual({ got: 5, total: 11 });
    expect(chapterStars(save, 1, stages)).toEqual({ got: 5, total: 5 });
    expect(chapterRewardStatus(save, 1, stages, partial)).toBe('incomplete');
    expect(claimableChapterRewards(save, partial, stages)).toEqual([]);
    expect(claimChapterStarReward(save, 1, partial, stages, config, MON)).toEqual({ ok: false, reason: 'notComplete' });
    // 預定關數不大於已上線關數時不影響
    expect(chapterStars(save, 1, stages, [{ ...chapters[0], stageCount: 2 }])).toEqual({ got: 5, total: 5 });
  });
});

describe('戰鬥中的星章狀態', () => {
  const live = (over: Partial<BattleSummary>, won = false) => (c: Parameters<typeof liveStarStatus>[0]) => liveStarStatus(c, summary(over), won);

  it('回合條件：打完第 N 回合還沒贏就失敗', () => {
    const c = { type: 'clearWithinTurns' as const, turns: 5 };
    expect(live({ turns: 4 })(c)).toBe('pending');
    expect(live({ turns: 5 })(c)).toBe('failed');
    expect(live({ turns: 5 }, true)(c)).toBe('done');
    expect(live({ turns: 6 }, true)(c)).toBe('failed');
  });

  it('不用主動技／不續戰：犯規立刻失敗，否則等結果', () => {
    expect(live({})({ type: 'noActiveSkill' })).toBe('pending');
    expect(live({ usedActiveSkill: true })({ type: 'noActiveSkill' })).toBe('failed');
    expect(live({ continues: 1 })({ type: 'noContinue' })).toBe('failed');
    expect(live({}, true)({ type: 'noContinue' })).toBe('done');
  });

  it('Combo 條件達成就亮；隊伍條件出戰時決定', () => {
    expect(live({ maxCombo: 5 })({ type: 'maxCombo', combo: 6 })).toBe('pending');
    expect(live({ maxCombo: 6 })({ type: 'maxCombo', combo: 6 })).toBe('done');
    const fire = { type: 'teamAll' as const, filter: { attribute: 'fire' as const } };
    expect(live({ team: [{ attribute: 'fire', race: 'human' }] })(fire)).toBe('done');
    expect(live({ team: [{ attribute: 'water', race: 'human' }] })(fire)).toBe('failed');
  });
});

describe('下一關', () => {
  it('找出被這一關開放的關卡，優先同類型', () => {
    expect(stagesUnlockedBy('st-1-1', ctx.stages).map((s) => s.id)).toEqual(['st-1-2']);
    expect(nextStageAfter(s11, ctx.stages)?.id).toBe('st-1-2');
    expect(nextStageAfter(tower[0], ctx.stages)?.id).toBe('tw-2');
    expect(nextStageAfter(tower[2], ctx.stages)).toBeUndefined();
    const side = stage({ id: 'ev-x', kind: 'event', unlockAfter: 'st-1-2' });
    const s13 = stage({ id: 'st-2-1', chapter: 2, unlockAfter: 'st-1-2' });
    expect(nextStageAfter(s12, [side, s13])?.id).toBe('st-2-1');
    expect(nextStageAfter(s12, [side])?.id).toBe('ev-x');
  });
});
