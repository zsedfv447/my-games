import { describe, expect, it } from 'vitest';
import { ARCHETYPE_IDS } from '../src/core/types';
import { gameData } from '../src/data/load';

const { stages, chapters } = gameData;
const byKind = (kind: string) => stages.filter((s) => s.kind === kind);

describe('關卡資料（docs/stage-plan.md）', () => {
  it('數量：主線 5 章 45 關、每日 21、活動 5、塔 30、試煉 12', () => {
    expect(chapters.map((c) => c.chapter)).toEqual([1, 2, 3, 4, 5]);
    for (const c of chapters) expect(byKind('main').filter((s) => s.chapter === c.chapter)).toHaveLength(9);
    expect(byKind('daily')).toHaveLength(21);
    expect(byKind('event')).toHaveLength(5);
    expect(byKind('tower')).toHaveLength(30);
    expect(byKind('trial')).toHaveLength(12);
  });

  it('主線依序解鎖，每關都有推薦流派與 3 個星章', () => {
    const main = byKind('main');
    main.forEach((s, i) => {
      expect(s.unlockAfter).toBe(i === 0 ? null : main[i - 1].id);
      expect(s.recommendedArchetypes?.length).toBeGreaterThan(0);
      expect(s.stars).toHaveLength(3);
    });
  });

  it('每個流派在主線至少被推薦 3 次', () => {
    const count = Object.fromEntries(ARCHETYPE_IDS.map((a) => [a, 0]));
    for (const s of byKind('main')) for (const a of s.recommendedArchetypes ?? []) count[a]++;
    expect(Object.entries(count).filter(([, n]) => n < 3)).toEqual([]);
  });

  it('12 個流派各有一關試煉，借用隊伍 5 人＋助戰，首通送隊長卡', () => {
    const trials = byKind('trial');
    expect(trials.map((s) => s.archetype).sort()).toEqual([...ARCHETYPE_IDS].sort());
    for (const t of trials) {
      expect(t.fixedTeam?.members).toHaveLength(5);
      expect(t.fixedTeam?.helper).toBeDefined();
      expect(t.rewards.firstClear?.cards?.[0].card).toBe(t.fixedTeam!.members[0].card);
      expect(t.stamina).toBe(0);
    }
  });

  it('挑戰之塔不耗體力，第 10、30 層送 c602、c603；第 4 章星章送 c604', () => {
    const tower = byKind('tower');
    expect(tower.every((s) => s.stamina === 0)).toBe(true);
    expect(tower[9].rewards.firstClear?.cards).toEqual([{ card: 'c602', count: 1 }]);
    expect(tower[29].rewards.firstClear?.cards).toEqual([{ card: 'c603', count: 1 }]);
    expect(chapters[3].starReward.cards).toEqual([{ card: 'c604', count: 1 }]);
  });

  it('初始卡是一張隊長加四張通用輔助', () => {
    expect(gameData.config.newPlayer.starterCards).toEqual(['c106', 'c108', 'c208', 'c308', 'c408']);
  });
});
