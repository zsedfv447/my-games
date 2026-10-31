import { describe, expect, it } from 'vitest';
import type { SaveData } from '../src/core/types';
import { gameData } from '../src/data/load';
import { createNewSave } from '../src/save/save';
import { applyBattleRecord, recordsOf, WEEKS_KEPT } from '../src/progression/records';
import { abyssStageId } from '../src/progression/abyss';
import { lastWeekKey, markWeeklyReportShown, weekDays, weeklyReport, weeklyReportToShow } from '../src/progression/weekly-report';

// 2026-11-02 是週一
const at = (m: number, d: number, h = 12) => new Date(2026, m - 1, d, h).getTime();
const cardOf = (id: string) => gameData.cards.find((c) => c.id === id);
const fresh = (): SaveData => createNewSave({ ...gameData.config, newPlayer: { ...gameData.config.newPlayer, starterCards: [] } }, at(10, 20));
const win = (s: SaveData, when: number, extra: Partial<Parameters<typeof applyBattleRecord>[1]> = {}) =>
  applyBattleRecord(s, { stageId: 'st-1-1', won: true, turns: 3, maxCombo: 5, maxTurnDamage: 1000, leaderCardId: 'c106', at: when, ...extra }).save;

describe('每週累計', () => {
  it('依週一分組；勝場、隊長、星淵最高層、克星週次數', () => {
    let s = fresh();
    s = win(s, at(10, 26));
    s = win(s, at(10, 27), { leaderCardId: 'c201', maxCombo: 9 });
    s = win(s, at(10, 28), { leaderCardId: 'c201', stageId: abyssStageId('2026-10-26', 12) });
    s = win(s, at(11, 1, 23), { stageId: 'nm-ironwall-2' });
    s = applyBattleRecord(s, { stageId: 'st-1-2', won: false, turns: 2, maxCombo: 3, maxTurnDamage: 0, at: at(10, 29) }).save;
    s = win(s, at(11, 2)); // 下一週
    const w = recordsOf(s).weeks!['2026-10-26'];
    expect(w).toMatchObject({ battles: 5, wins: 4, maxCombo: 9, leaderClears: { c106: 2, c201: 2 }, abyssBest: 12, nemesisClears: 1 });
    expect(recordsOf(s).weeks!['2026-11-02'].battles).toBe(1);
  });

  it('沒給時間的戰鬥不記每週；只保留最近幾週', () => {
    let s = applyBattleRecord(fresh(), { stageId: 'st-1-1', won: true, turns: 3, maxCombo: 5, maxTurnDamage: 0 }).save;
    expect(recordsOf(s).weeks).toBeUndefined();
    for (let i = 0; i < WEEKS_KEPT + 3; i++) s = win(s, at(9, 7) + i * 7 * 86_400_000);
    expect(Object.keys(recordsOf(s).weeks!)).toHaveLength(WEEKS_KEPT);
  });
});

describe('契約週報', () => {
  it('上週的週一與 7 天', () => {
    expect(lastWeekKey(at(11, 2))).toBe('2026-10-26');
    expect(lastWeekKey(at(11, 8, 23))).toBe('2026-10-26');
    expect(weekDays('2026-10-26')).toEqual(['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01']);
  });

  it('內容：戰績、最常用的隊長、謎題、新收的星靈（不含素材、不重複、高稀有度在前）', () => {
    let s = win(fresh(), at(10, 27));
    s = win(s, at(10, 28), { leaderCardId: 'c201' });
    s = win(s, at(10, 29), { leaderCardId: 'c201' });
    s = { ...s, puzzle: { lastDay: '2026-11-01', streak: 4, solvedDays: ['2026-10-25', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01'] } };
    const card = (cardId: string, uid: string, when: number) => ({ uid, cardId, level: 1, exp: 0, skillLevel: 1, limitBreak: 0, awakened: 0, locked: false, obtainedAt: when });
    s = { ...s, inventory: { ...s.inventory, cards: [card('c106', 'a', at(10, 27)), card('c101', 'b', at(10, 30)), card('c106', 'c', at(10, 31)), card('c901', 'd', at(10, 31)), card('c201', 'e', at(11, 2))] } };
    const r = weeklyReport(s, '2026-10-26', cardOf)!;
    expect(r.range).toBe('10/26～11/01');
    expect(r.stats.wins).toBe(3);
    expect(r.topLeader).toEqual({ cardId: 'c201', clears: 2 });
    expect([r.puzzleDays, r.puzzleStreak]).toEqual([4, 4]);
    expect(r.newCards).toEqual(['c101', 'c106']);
  });

  it('上週什麼都沒做就不跳；每週只自動跳一次', () => {
    expect(weeklyReportToShow(fresh(), at(11, 2), cardOf)).toBeNull();
    const s = win(fresh(), at(10, 28));
    const r = weeklyReportToShow(s, at(11, 2), cardOf);
    expect(r?.week).toBe('2026-10-26');
    const shown = markWeeklyReportShown(s, r!.week);
    expect(weeklyReportToShow(shown, at(11, 4), cardOf)).toBeNull();
    // 手札裡仍然可以重看
    expect(weeklyReport(shown, '2026-10-26', cardOf)).not.toBeNull();
  });
});

describe('分享圖', () => {
  it('週報分享圖的版面', async () => {
    const { weeklySharePlan, sharePlan } = await import('../src/ui/share-plan');
    const plan = weeklySharePlan({ week: '2026-10-26', range: '10/26～11/01', wins: 12, battles: 15, maxCombo: 9, puzzleDays: 5, lines: ['a', 'b', 'c', 'd', 'e'], members: [{ cardId: 'c106', name: '蘿希' }], playerName: '契印師', playerLevel: 20, title: '連珠詠者' });
    expect(plan.title).toBe('契約週報');
    expect(plan.badge).toBe('「連珠詠者」');
    expect(plan.stats.map((s) => s.value)).toEqual(['12', '9', '5 天']);
    expect(plan.starRows).toHaveLength(4);
    expect(plan.slots).toHaveLength(1);
    expect(plan.footer).toBe('「連珠詠者」契印師・契印師 Lv.20・出戰 15 場');
    expect(plan.fileName).toBe('starfall-weekly-20261026.png');
    // 結算分享圖帶上稱號
    const clear = sharePlan({ stageName: '荒原入口', place: '第 1 章', turns: 3, maxCombo: 5, stars: [], starTexts: [], team: [], playerName: '契印師', playerLevel: 1, at: Date.UTC(2026, 9, 31), firstClear: false, title: '星紋初醒' });
    expect(clear.footer.startsWith('「星紋初醒」契印師')).toBe(true);
  });
});
