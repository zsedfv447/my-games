import { describe, expect, it } from 'vitest';
import type { SaveData } from '../src/core/types';
import { gameData } from '../src/data/load';
import { createNewSave } from '../src/save/save';
import { addExpeditionReturn, applyBattleRecord, recordsEstimated, recordsOf } from '../src/progression/records';
import { OATHS, MAX_OATHS } from '../src/progression/oaths';
import { ABYSS_FLOORS } from '../src/progression/abyss';
import { titleProgress, TITLES, unlockedTitles } from '../src/progression/titles';
import { titleContext } from '../src/ui/economy';

const NOW = new Date(2026, 10, 2, 12).getTime();
const fresh = (): SaveData => createNewSave(gameData.config, NOW);
const mainIds = gameData.stages.filter((s) => s.kind === 'main').map((s) => s.id);
const withCleared = (ids: string[], extra: Partial<SaveData> = {}): SaveData => {
  const s = fresh();
  return { ...s, progress: { ...s.progress, clearedStages: ids }, ...extra };
};
const byId = (id: string) => TITLES.find((t) => t.id === id)!;
const unlocked = (s: SaveData, id: string) => titleProgress(s, byId(id), titleContext(s)).unlocked;

describe('老存檔的戰績補值（提案 124）', () => {
  it('勝場至少等於通關數、出戰至少等於勝場；讀進來就解鎖對應稱號', () => {
    const old = withCleared(mainIds.slice(0, 101));
    const r = recordsOf(old);
    expect(r.wins).toBe(Math.min(101, mainIds.length));
    expect(r.battles).toBe(r.wins);
    expect(recordsEstimated(old)).toBe(true);
    const ids = unlockedTitles(old, titleContext(old)).map((t) => t.id);
    expect(ids).toContain('t-first-win');
    if (r.wins >= 100) expect(ids).toContain('t-wins-100');
    // 補的值不寫回存檔
    expect(old.records).toBeUndefined();
  });

  it('取最大值：已有的紀錄比通關數多就不動', () => {
    const s = withCleared(mainIds.slice(0, 3), { records: { battles: 50, wins: 40, maxCombo: 9, maxTurnDamage: 0, fastestTurns: {}, leaderClears: {}, archetypeClears: {} } });
    expect(recordsOf(s)).toMatchObject({ battles: 50, wins: 40, maxCombo: 9 });
    expect(recordsEstimated(s)).toBe(false);
  });

  it('之後的戰鬥接著補過的值累計', () => {
    const old = withCleared(mainIds.slice(0, 10));
    const next = applyBattleRecord(old, { stageId: 'st-1-1', won: true, turns: 3, maxCombo: 4, maxTurnDamage: 0 }).save;
    expect(recordsOf(next).wins).toBe(11);
  });
});

describe('新稱號（提案 125）', () => {
  it('引用的關卡存在；門檻在系統上限以內', () => {
    const stageIds = new Set(gameData.stages.map((s) => s.id));
    const maxOath = OATHS.map((o) => o.points).sort((a, b) => b - a).slice(0, MAX_OATHS).reduce((a, b) => a + b, 0);
    for (const t of TITLES) {
      const c = t.condition;
      if (c.type === 'stageCleared') expect(stageIds.has(c.id), t.id).toBe(true);
      if (c.type === 'eclipseChapter') expect(c.atLeast, t.id).toBeLessThanOrEqual(27);
      if (c.type === 'oathHighest') expect(c.atLeast, t.id).toBeLessThanOrEqual(maxOath);
    }
    expect(maxOath).toBe(7);
    expect(TITLES.some((t) => t.condition.type === 'abyssBest' && t.condition.atLeast === ABYSS_FLOORS)).toBe(true);
  });

  it('第 6、7 章通關', () => {
    expect(unlocked(withCleared(['st-6-9']), 't-ch6-clear')).toBe(true);
    expect(unlocked(withCleared(['st-6-9']), 't-ch7-clear')).toBe(false);
    expect(unlocked(withCleared(['st-7-9']), 't-ch7-clear')).toBe(true);
  });

  it('星蝕：同一章的星章才累計', () => {
    const ch1 = gameData.stages.filter((s) => s.kind === 'main' && s.chapter === 1).map((s) => s.id);
    const ch2 = gameData.stages.filter((s) => s.kind === 'main' && s.chapter === 2).map((s) => s.id);
    const full = Object.fromEntries(ch1.map((id) => [id, [true, true, true]]));
    const s = withCleared([], { eclipse: { cleared: ch1, stars: full } });
    expect(titleContext(s).eclipseBestChapterStars).toBe(27);
    expect(unlocked(s, 't-eclipse-27')).toBe(true);
    // 兩章各 6 顆：不算 12
    const split = Object.fromEntries([...ch1.slice(0, 2), ...ch2.slice(0, 2)].map((id) => [id, [true, true, true]]));
    const s2 = withCleared([], { eclipse: { cleared: [], stars: split } });
    expect(titleContext(s2).eclipseBestChapterStars).toBe(6);
    expect(unlocked(s2, 't-eclipse-9')).toBe(false);
  });

  it('星淵歷來最高層、誓約碑最高點數、遠行次數、觀測錄', () => {
    const s = withCleared([], { abyss: { week: '2026-10-26', best: 12, claimed: [], allTimeBest: 41 }, oaths: { week: '2026-10-26', best: {}, gems: 0, highest: 7 } });
    expect(unlocked(s, 't-abyss-40')).toBe(true);
    expect(unlocked(s, 't-abyss-50')).toBe(false);
    expect(unlocked(s, 't-oath-7')).toBe(true);
    let e = fresh();
    for (let i = 0; i < 10; i++) e = addExpeditionReturn(e);
    expect(recordsOf(e).expeditionsReturned).toBe(10);
    expect(unlocked(e, 't-expedition-10')).toBe(true);
    expect(unlocked(e, 't-expedition-50')).toBe(false);
    const total = titleContext(fresh()).bestiary!.total;
    expect(total).toBeGreaterThanOrEqual(50);
    const all = withCleared(gameData.stages.filter((x) => x.kind === 'main').map((x) => x.id));
    expect(titleContext(all).bestiary!.seen).toBeGreaterThan(0);
  });
});
