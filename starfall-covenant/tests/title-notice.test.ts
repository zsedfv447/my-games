import { describe, expect, it } from 'vitest';
import type { SaveData } from '../src/core/types';
import { gameData } from '../src/data/load';
import { createNewSave } from '../src/save/save';
import { LAMP_MAX, lampsAfterSolve, missedDays, streakWithLamps } from '../src/progression/milestones';
import { markTitlesSeen, titleProgress, TITLES, titlesGained, type TitleContext } from '../src/progression/titles';
import { applyBattleRecord } from '../src/progression/records';
import { homeBadges, titleContext } from '../src/ui/economy';

const NOW = new Date(2026, 10, 2, 12).getTime();
const fresh = (): SaveData => createNewSave(gameData.config, NOW);
const ctx: TitleContext = { achievementDone: () => false, lorePages: { collected: 0, total: 9 } };

describe('星燈守夜', () => {
  it('漏掉的天數', () => {
    expect(missedDays('2026-11-01', '2026-11-02')).toBe(0);
    expect(missedDays('2026-11-02', '2026-11-02')).toBe(0);
    expect(missedDays('2026-10-30', '2026-11-02')).toBe(2);
  });

  it('漏的天數不超過燈數就保住，否則歸零', () => {
    const r = { lastDay: '2026-11-01', streak: 20 };
    expect(streakWithLamps({ ...r }, '2026-11-02')).toEqual({ streak: 20, lampsUsed: 0 });
    expect(streakWithLamps({ ...r, lamps: 0 }, '2026-11-03')).toEqual({ streak: 0, lampsUsed: 0 });
    expect(streakWithLamps({ ...r, lamps: 1 }, '2026-11-03')).toEqual({ streak: 20, lampsUsed: 1 });
    expect(streakWithLamps({ ...r, lamps: 2 }, '2026-11-04')).toEqual({ streak: 20, lampsUsed: 2 });
    expect(streakWithLamps({ ...r, lamps: 2 }, '2026-11-05')).toEqual({ streak: 0, lampsUsed: 0 });
    expect(streakWithLamps({ lastDay: null, streak: 0, lamps: 2 }, '2026-11-05')).toEqual({ streak: 0, lampsUsed: 0 });
  });

  it('每連續 14 天得 1 盞，最多 2 盞；先扣用掉的再加', () => {
    expect(lampsAfterSolve(0, 0, 13)).toBe(0);
    expect(lampsAfterSolve(0, 0, 14)).toBe(1);
    expect(lampsAfterSolve(1, 0, 28)).toBe(2);
    expect(lampsAfterSolve(2, 0, 42)).toBe(LAMP_MAX);
    expect(lampsAfterSolve(2, 1, 42)).toBe(2);
    expect(lampsAfterSolve(1, 1, 15)).toBe(0);
  });
});

describe('新稱號提示', () => {
  it('結算比對：開戰時沒有、現在有的稱號', () => {
    const before = fresh();
    const after = applyBattleRecord(before, { stageId: 'st-1-1', won: true, turns: 3, maxCombo: 10, maxTurnDamage: 100 }).save;
    expect(titlesGained([], after, ctx).map((t) => t.id)).toEqual(['t-first-win', 't-combo-10']);
    expect(titlesGained(['t-first-win'], after, ctx).map((t) => t.id)).toEqual(['t-combo-10']);
    expect(titlesGained(['t-first-win', 't-combo-10'], after, ctx)).toEqual([]);
  });

  it('主城紅點：有沒看過的新稱號才亮，看過就消失', () => {
    const s = applyBattleRecord(fresh(), { stageId: 'st-1-1', won: true, turns: 3, maxCombo: 3, maxTurnDamage: 100 }).save;
    expect(homeBadges(fresh(), NOW).titles).toBe(false);
    expect(homeBadges(s, NOW).titles).toBe(true);
    expect(homeBadges(markTitlesSeen(s, ['t-first-win']), NOW).titles).toBe(false);
    expect(titleContext(s).lorePages.total).toBeGreaterThan(0);
  });
});

describe('高門檻稱號打得到（提案 107）', () => {
  it('單回合傷害稱號不超過任何一波敵人的總血量上限（傷害會被剩餘血量截斷）', () => {
    const hp = new Map(gameData.enemies.map((e) => [e.id, e.hp]));
    const maxWave = Math.max(...gameData.stages.flatMap((s) => s.waves.map((w) => w.enemies.reduce((sum, id) => sum + (hp.get(id) ?? 0), 0))));
    const damageTitles = TITLES.filter((t) => t.condition.type === 'record' && t.condition.key === 'maxTurnDamage');
    expect(damageTitles.length).toBeGreaterThan(0);
    for (const t of damageTitles) expect(t.condition.type === 'record' && t.condition.atLeast, t.id).toBeLessThanOrEqual(maxWave);
  });

  it('謎題稱號看歷來最長連續（含星燈保住的天數），中斷後不會失去', () => {
    const s = { ...fresh(), puzzle: { lastDay: '2026-09-01', streak: 3, solvedDays: ['2026-09-01'], bestStreak: 30 } };
    expect(titleProgress(s, TITLES.find((t) => t.id === 't-puzzle-master')!, ctx).unlocked).toBe(true);
  });
});
