import { describe, expect, it } from 'vitest';
import { boardToStrings, findMatches, type Pos } from '../src/battle/board';
import { gameData } from '../src/data/load';
import { createNewSave } from '../src/save/save';
import { dateKey } from '../src/progression/time';
import {
  PUZZLE_COIN, claimPuzzle, currentStreak, dailyPuzzle, dayNumber, judgePuzzle, previousDay, puzzleOf, solvedToday,
} from '../src/progression/puzzle';

const config = { ...gameData.config, newPlayer: { ...gameData.config.newPlayer, starterCards: [] } };
const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12).getTime();
const days = Array.from({ length: 40 }, (_, i) => dateKey(at(2026, 11, 1 + i)));

describe('每日謎題出題', () => {
  it('同一天題目固定，不同天盤面不同', () => {
    const a = dailyPuzzle('2026-11-05');
    expect(dailyPuzzle('2026-11-05')).toEqual(a);
    const boards = new Set(days.map((d) => boardToStrings(dailyPuzzle(d).board).join('/')));
    expect(boards.size).toBe(days.length);
  });

  it('題型四天一輪，四種都會出現', () => {
    const kinds = days.slice(0, 8).map((d) => dailyPuzzle(d).goal.kind);
    expect(new Set(kinds).size).toBe(4);
    expect(kinds.slice(0, 4)).toEqual(kinds.slice(4, 8));
    expect(dayNumber('1970-01-02')).toBe(1);
  });

  it('每一題都有解：參考解在步數內、判定為解開；開場盤面不會自己消除', () => {
    for (const d of days) {
      const p = dailyPuzzle(d);
      expect(findMatches(p.board), d).toEqual([]);
      expect(p.solution.length - 1, d).toBeLessThanOrEqual(p.maxSteps);
      expect(judgePuzzle(p, p.solution).solved, `${d} ${JSON.stringify(p.goal)}`).toBe(true);
      // 不動就不算解開
      expect(judgePuzzle(p, [p.solution[0]]).solved, d).toBe(false);
    }
  });

  it('題目門檻不會太簡單', () => {
    for (const d of days) {
      const g = dailyPuzzle(d).goal;
      if (g.kind === 'combo') expect(g.combo).toBeGreaterThanOrEqual(3);
      if (g.kind === 'colorCount') expect(g.count).toBeGreaterThanOrEqual(5);
      if (g.kind === 'rainbow') expect(g.colors).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('判定', () => {
  const p = dailyPuzzle('2026-11-03');
  it('超過步數不算', () => {
    const zigzag: Pos[] = [{ row: 0, col: 0 }];
    for (let i = 0; i <= p.maxSteps; i++) zigzag.push({ row: 0, col: i % 2 === 0 ? 1 : 0 });
    expect(judgePuzzle(p, zigzag)).toMatchObject({ solved: false, invalid: 'tooManySteps' });
  });
  it('不相鄰的路徑不算', () => {
    expect(judgePuzzle(p, [{ row: 0, col: 0 }, { row: 3, col: 3 }])).toMatchObject({ solved: false, invalid: 'blocked' });
  });
  it('清色題：剩下的顆數為 0 才算解開', () => {
    const clear = days.map((d) => dailyPuzzle(d)).find((x) => x.goal.kind === 'clearColor')!;
    expect(judgePuzzle(clear, clear.solution).value).toBe(0);
    expect(judgePuzzle(clear, [clear.solution[0]]).value).toBeGreaterThan(0);
  });
});

describe('獎勵與連續天數', () => {
  const solve = (save: ReturnType<typeof createNewSave>, now: number) => {
    const p = dailyPuzzle(dateKey(now));
    const r = claimPuzzle(save, p, p.solution, config, now);
    if (!r.ok) throw new Error(r.reason);
    return r;
  };

  it('解開送金幣，同一天不能重複領', () => {
    const now = at(2026, 11, 2);
    const s0 = createNewSave(config, now);
    const r = solve(s0, now);
    expect(r.save.player.coin).toBe(s0.player.coin + PUZZLE_COIN);
    expect(r.reward).toEqual({ coin: PUZZLE_COIN });
    expect(solvedToday(r.save, now)).toBe(true);
    const p = dailyPuzzle(dateKey(now));
    expect(claimPuzzle(r.save, p, p.solution, config, now + 3600_000)).toEqual({ ok: false, reason: 'alreadyClaimed' });
  });

  it('沒解開、或拿別天的題目都不能領', () => {
    const now = at(2026, 11, 2);
    const s0 = createNewSave(config, now);
    const p = dailyPuzzle(dateKey(now));
    expect(claimPuzzle(s0, p, [p.solution[0]], config, now)).toEqual({ ok: false, reason: 'notSolved' });
    const old = dailyPuzzle('2026-11-01');
    expect(claimPuzzle(s0, old, old.solution, config, now)).toEqual({ ok: false, reason: 'wrongDay' });
  });

  it('連續 7 天送 3 星晶、第 14 天送 5（里程碑）；星燈保住一次中斷，沒燈後重新計算', () => {
    let s = createNewSave(config, at(2026, 11, 1));
    const gems0 = s.player.gems;
    const gemDays: number[] = [];
    for (let d = 1; d <= 14; d++) {
      const r = solve(s, at(2026, 11, d));
      if (r.reward?.gems) gemDays.push(d);
      expect(r.streak).toBe(d);
      s = r.save;
    }
    expect(gemDays).toEqual([7, 14]);
    expect(s.player.gems).toBe(gems0 + 3 + 5);
    // 第 14 天得到 1 盞星燈：跳過 11/15 時燈保住連續，11/16 接著算第 15 天並用掉那盞燈
    expect(puzzleOf(s).lamps).toBe(1);
    expect(currentStreak(s, at(2026, 11, 16))).toBe(14);
    const kept = solve(s, at(2026, 11, 16));
    expect(kept.streak).toBe(15);
    expect(puzzleOf(kept.save).lamps).toBe(0);
    expect(puzzleOf(kept.save).bestStreak).toBe(15);
    // 沒有燈之後再漏一天（11/17），11/18 重新從 1 開始
    expect(currentStreak(kept.save, at(2026, 11, 18))).toBe(0);
    expect(solve(kept.save, at(2026, 11, 18)).streak).toBe(1);
  });

  it('舊存檔沒有 puzzle 欄位時補預設值；跨月也算連續', () => {
    const s = createNewSave(config, at(2026, 11, 30));
    expect(puzzleOf(s)).toEqual({ lastDay: null, streak: 0, solvedDays: [] });
    expect(previousDay(at(2026, 12, 1))).toBe('2026-11-30');
    const r1 = solve(s, at(2026, 11, 30));
    expect(solve(r1.save, at(2026, 12, 1)).streak).toBe(2);
  });
});
