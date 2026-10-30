import { describe, expect, it } from 'vitest';
import { ARCHETYPE_IDS } from '../src/core/types';
import { gameData } from '../src/data/load';

const { stages, chapters } = gameData;
const byKind = (kind: string) => stages.filter((s) => s.kind === kind);

describe('關卡資料（docs/stage-plan.md）', () => {
  it('數量：主線第 1～5 章各 9 關、第 6 章先上 3 關（預定 9 關）、每日 21、活動 10（獸王 5＋齒輪 5）、流派克星週 18（6 主題×3）、塔 30、試煉 12', () => {
    expect(chapters.map((c) => c.chapter)).toEqual([1, 2, 3, 4, 5, 6]);
    for (const c of chapters) expect(byKind('main').filter((s) => s.chapter === c.chapter)).toHaveLength(c.chapter === 6 ? 3 : 9);
    expect(chapters[5].stageCount).toBe(9);
    expect(byKind('daily')).toHaveLength(21);
    const nemesis = new Set(gameData.events.filter((e) => e.series === 'nemesis').map((e) => e.id));
    expect(byKind('event').filter((s) => !nemesis.has(s.event!))).toHaveLength(10);
    expect(byKind('event').filter((s) => nemesis.has(s.event!))).toHaveLength(18);
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

  it('第 6 章：接在第 5 章最後一關後面，開場與前篇結尾劇情都存在，敵人沿用第 5 章的造型且數值較高', () => {
    const ch6 = byKind('main').filter((s) => s.chapter === 6);
    expect(ch6.map((s) => s.id)).toEqual(['st-6-1', 'st-6-2', 'st-6-3']);
    expect(ch6[0].unlockAfter).toBe('st-5-9');
    expect(ch6[0].story?.before).toBe('ch6-open');
    expect(ch6[2].story?.after).toBe('ch6-mid');
    for (const id of ['ch6-open', 'ch6-mid']) expect(gameData.story[id]?.length).toBeGreaterThan(5);
    const enemy = new Map(gameData.enemies.map((e) => [e.id, e]));
    const ch5Max = Math.max(...byKind('main').filter((s) => s.chapter === 5).flatMap((s) => s.waves.filter((w) => !w.boss).flatMap((w) => w.enemies)).map((id) => enemy.get(id)!.atk));
    for (const s of ch6) {
      for (const id of s.waves.flatMap((w) => w.enemies)) {
        const e = enemy.get(id)!;
        expect(e.art.sprite, id).toMatch(/^assets\/user\/enemies\/e00(2[1-5])\.webp$/);
      }
      expect(s.stamina).toBeGreaterThanOrEqual(12);
    }
    // 雜兵攻擊力比第 5 章雜兵最高值再高一點
    expect(Math.max(...ch6.flatMap((s) => s.waves.flatMap((w) => w.enemies)).map((id) => enemy.get(id)!.atk))).toBeGreaterThan(ch5Max);
  });

  it('初始卡是一張隊長加四張通用輔助', () => {
    expect(gameData.config.newPlayer.starterCards).toEqual(['c106', 'c108', 'c208', 'c308', 'c408']);
  });
});
