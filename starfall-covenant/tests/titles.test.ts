import { describe, expect, it } from 'vitest';
import type { SaveData } from '../src/core/types';
import { gameData } from '../src/data/load';
import { createNewSave, parseSave, serializeSave } from '../src/save/save';
import { nextPuzzleBonus, PUZZLE_MILESTONES, puzzleStreakGems } from '../src/progression/milestones';
import {
  equipTitle, equippedTitle, longestStreak, markTitlesSeen, newTitles, nextBondTitle, titleProgress, TITLES, titleStateOf, unlockedTitles,
  type TitleContext,
} from '../src/progression/titles';
import { applyBattleRecord } from '../src/progression/records';

const NOW = new Date(2026, 10, 2, 12).getTime();
const fresh = (): SaveData => createNewSave(gameData.config, NOW);
const ctx = (done: string[] = [], collected = 0): TitleContext => ({ achievementDone: (id) => done.includes(id), lorePages: { collected, total: 9 } });
const byId = (id: string) => TITLES.find((t) => t.id === id)!;

describe('謎題連續天數里程碑', () => {
  it('7、14、30、60 天送里程碑星晶，其他每滿 7 天 1 顆', () => {
    expect(PUZZLE_MILESTONES.map((m) => m.days)).toEqual([7, 14, 30, 60]);
    expect([1, 6, 7, 14, 21, 28, 30, 35, 60, 63].map(puzzleStreakGems)).toEqual([0, 0, 3, 5, 1, 1, 10, 1, 20, 1]);
  });
  it('下一個加送星晶的天數', () => {
    expect(nextPuzzleBonus(0)).toEqual({ days: 7, gems: 3, milestone: true });
    expect(nextPuzzleBonus(14)).toEqual({ days: 21, gems: 1, milestone: false });
    expect(nextPuzzleBonus(28)).toEqual({ days: 30, gems: 10, milestone: true });
  });
});

describe('契印師稱號', () => {
  it('至少 20 個，id 不重複，名稱是中文', () => {
    expect(TITLES.length).toBeGreaterThanOrEqual(20);
    expect(new Set(TITLES.map((t) => t.id)).size).toBe(TITLES.length);
    for (const t of TITLES) expect(t.name).toMatch(/[一-鿿]/);
  });

  it('引用的成就都存在於 quests.json', () => {
    const achievements = new Set(gameData.quests.filter((q) => q.kind === 'achievement').map((q) => q.id));
    for (const t of TITLES) if (t.condition.type === 'achievement') expect(achievements.has(t.condition.id), t.id).toBe(true);
  });

  it('新存檔沒有稱號；選填欄位補預設值', () => {
    expect(unlockedTitles(fresh(), ctx())).toEqual([]);
    expect(titleStateOf(fresh())).toEqual({ equipped: null, seen: [] });
  });

  it('各種條件：戰績、成就、羈絆、情誼、殘頁、謎題', () => {
    let s = applyBattleRecord(fresh(), { stageId: 'st-1-1', won: true, turns: 3, maxCombo: 10, maxTurnDamage: 2_000_000, leaderCardId: 'c106', archetype: 'mono' }).save;
    s = { ...s, cardBond: { c101: 55, c201: 30 }, helperBond: { npc: 31 } };
    const ids = unlockedTitles(s, ctx(['a-stageFail-1'], 3)).map((t) => t.id);
    expect(ids).toEqual(expect.arrayContaining(['t-first-win', 't-fall-once', 't-combo-10', 't-damage-1m', 't-bond-50', 't-wanderer-friend', 't-page-finder']));
    expect(ids).not.toContain('t-bond-100');
    expect(ids).not.toContain('t-historian');
    expect(titleProgress(s, byId('t-bond-100'), ctx())).toEqual({ value: 55, target: 100, unlocked: false });
    expect(titleProgress(s, byId('t-historian'), ctx([], 3))).toEqual({ value: 3, target: 9, unlocked: false });
    expect(titleProgress(s, byId('t-historian'), ctx([], 9)).unlocked).toBe(true);
    expect(titleProgress(s, byId('t-many-friends'), ctx())).toEqual({ value: 2, target: 5, unlocked: false });
  });

  it('謎題最長連續天數（跨月、重複日期、中斷）', () => {
    expect(longestStreak([])).toBe(0);
    expect(longestStreak(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-03', '2026-11-03'])).toBe(3);
    const days = Array.from({ length: 30 }, (_, i) => new Date(Date.UTC(2026, 10, 1 + i)).toISOString().slice(0, 10));
    const s = { ...fresh(), puzzle: { lastDay: days[29], streak: 30, solvedDays: days } };
    expect(titleProgress(s, byId('t-puzzle-master'), ctx()).unlocked).toBe(true);
  });

  it('只能裝備已解鎖的稱號，條件消失時不顯示；可以卸下', () => {
    const s = applyBattleRecord(fresh(), { stageId: 'st-1-1', won: true, turns: 3, maxCombo: 3, maxTurnDamage: 100 }).save;
    expect(equipTitle(s, 't-wins-100', ctx())).toEqual({ ok: false, reason: 'locked' });
    expect(equipTitle(s, 'nope', ctx())).toEqual({ ok: false, reason: 'unknownTitle' });
    const r = equipTitle(s, 't-first-win', ctx());
    if (!r.ok) throw new Error(r.reason);
    expect(equippedTitle(r.save, ctx())?.name).toBe('星紋初醒');
    // 成就類條件不成立時（例如測試把成就拿掉）不顯示
    const fall = equipTitle({ ...r.save }, 't-fall-once', ctx(['a-stageFail-1']));
    if (!fall.ok) throw new Error(fall.reason);
    expect(equippedTitle(fall.save, ctx())).toBeUndefined();
    const off = equipTitle(r.save, null, ctx());
    expect(off.ok && equippedTitle(off.save, ctx())).toBeUndefined();
  });

  it('NEW 標記：看過就不再是新的；稱號跟著存檔寫入讀回', () => {
    const s = applyBattleRecord(fresh(), { stageId: 'st-1-1', won: true, turns: 3, maxCombo: 3, maxTurnDamage: 100 }).save;
    expect(newTitles(s, ctx()).map((t) => t.id)).toEqual(['t-first-win']);
    const seen = markTitlesSeen(s, ['t-first-win']);
    expect(newTitles(seen, ctx())).toEqual([]);
    expect(markTitlesSeen(seen, ['t-first-win'])).toBe(seen);
    const r = equipTitle(seen, 't-first-win', ctx());
    const loaded = parseSave(serializeSave(r.ok ? r.save : seen), gameData.config, NOW);
    expect(loaded.ok && titleStateOf(loaded.save)).toEqual({ equipped: 't-first-win', seen: ['t-first-win'] });
  });

  it('羈絆、情誼到上限後的下一個稱號目標', () => {
    expect(nextBondTitle('cardBond', 30)).toMatchObject({ atLeast: 50, title: { id: 't-bond-50' } });
    expect(nextBondTitle('cardBond', 60)).toMatchObject({ atLeast: 100 });
    expect(nextBondTitle('cardBond', 100)).toBeUndefined();
    expect(nextBondTitle('helperBond', 20)).toMatchObject({ atLeast: 30, title: { id: 't-wanderer-friend' } });
  });
});
