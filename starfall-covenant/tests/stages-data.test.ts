import { describe, expect, it } from 'vitest';
import { ARCHETYPE_IDS } from '../src/core/types';
import { gameData } from '../src/data/load';

const { stages, chapters } = gameData;
const byKind = (kind: string) => stages.filter((s) => s.kind === kind);

describe('關卡資料（docs/stage-plan.md）', () => {
  it('數量：主線第 1～7 章各 9 關、每日 21、活動 10（獸王 5＋齒輪 5）、流派克星週 18（6 主題×3）、塔 30、試煉 12', () => {
    expect(chapters.map((c) => c.chapter)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    for (const c of chapters) expect(byKind('main').filter((s) => s.chapter === c.chapter)).toHaveLength(9);
    expect(chapters[5].stageCount).toBe(9);
    expect(chapters[6].stageCount).toBe(9);
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
    expect(ch6.map((s) => s.id)).toEqual(Array.from({ length: 9 }, (_, i) => `st-6-${i + 1}`));
    expect(ch6[0].unlockAfter).toBe('st-5-9');
    expect(ch6[0].story?.before).toBe('ch6-open');
    expect(ch6[2].story?.after).toBe('ch6-mid');
    expect(ch6[3].story?.beforeBoss).toBe('ch6-mid2');
    expect(ch6[8].story).toEqual({ beforeBoss: 'ch6-boss', after: 'ch6-end' });
    for (const id of ['ch6-open', 'ch6-mid', 'ch6-mid2', 'ch6-boss', 'ch6-end']) expect(gameData.story[id]?.length).toBeGreaterThan(5);
    // 第 4、9 關有 Boss 波；Boss 用第 5 章 Boss 的造型
    expect(ch6.filter((s) => s.waves.some((w) => w.boss)).map((s) => s.id)).toEqual(['st-6-4', 'st-6-9']);
    const enemy = new Map(gameData.enemies.map((e) => [e.id, e]));
    const ch5Max = Math.max(...byKind('main').filter((s) => s.chapter === 5).flatMap((s) => s.waves.filter((w) => !w.boss).flatMap((w) => w.enemies)).map((id) => enemy.get(id)!.atk));
    for (const s of ch6) {
      for (const id of s.waves.flatMap((w) => w.enemies)) {
        const e = enemy.get(id)!;
        expect(e.art.sprite, id).toMatch(/^assets\/user\/enemies\/e00(2[1-5]|39|40)\.webp$/);
      }
      expect(s.stamina).toBeGreaterThanOrEqual(12);
    }
    // 雜兵攻擊力比第 5 章雜兵最高值再高一點
    expect(Math.max(...ch6.flatMap((s) => s.waves.flatMap((w) => w.enemies)).map((id) => enemy.get(id)!.atk))).toBeGreaterThan(ch5Max);
  });

  it('第 7 章回聲迴廊：接在 6-9 之後、開場劇情、前章 Boss 的回聲沿用原圖、至少一關有七曜環', () => {
    const enemy = new Map(gameData.enemies.map((e) => [e.id, e]));
    const ch7 = byKind('main').filter((s) => s.chapter === 7);
    expect(ch7.map((s) => s.id)).toEqual(Array.from({ length: 9 }, (_, i) => `st-7-${i + 1}`));
    expect(ch7[3].story?.beforeBoss).toBe('ch7-mid');
    expect(ch7[7].story?.after).toBe('ch7-mid2');
    expect(ch7[8].story).toEqual({ beforeBoss: 'ch7-boss', after: 'ch7-end' });
    for (const id of ['ch7-mid', 'ch7-mid2', 'ch7-boss', 'ch7-end']) expect(gameData.story[id]?.length).toBeGreaterThan(5);
    expect(ch7.filter((s) => s.waves.some((w) => w.boss)).map((s) => s.id)).toEqual(['st-7-1', 'st-7-2', 'st-7-3', 'st-7-4', 'st-7-9']);
    expect(ch7[0].unlockAfter).toBe('st-6-9');
    expect(ch7[0].story?.before).toBe('ch7-open');
    expect(gameData.story['ch7-open']?.length).toBeGreaterThan(5);
    const ids = ch7.flatMap((s) => s.waves.flatMap((w) => w.enemies));
    // 新敵人從 e0057 開始編；沿用的圖都指向已有的敵人圖（e0056 以前），回聲用前章 Boss 的圖
    for (const id of ids.filter((x) => Number(x.slice(1)) >= 57)) {
      const sprite = enemy.get(id)!.art.sprite;
      if (sprite) expect(Number(/e(\d{4})\.webp$/.exec(sprite)?.[1]), id).toBeLessThan(57);
    }
    for (const id of ['e0057', 'e0058', 'e0059', 'e0060', 'e0061', 'e0062']) expect(enemy.get(id)!.art.sprite, id).toMatch(/^assets\/user\/enemies\/e00(3[0-9]|40)\.webp$/);
    const withRing = ch7.filter((s) => s.waves.some((w) => w.enemies.some((id) => enemy.get(id)!.abilities.some((a) => a.status === 'ringShield'))));
    expect(withRing.length).toBeGreaterThanOrEqual(3);
    // 終 Boss 瑟隆本身帶七曜環
    const finalBoss = enemy.get(ch7[8].waves.at(-1)!.enemies[0])!;
    expect(finalBoss.name).toContain('瑟隆');
    expect(finalBoss.abilities.map((a) => a.status)).toContain('ringShield');
  });

  it('第 6 章後半用到新機制：隱藏珠與星紋封印至少各 2 關，Boss 兩種都有', () => {
    const enemy = new Map(gameData.enemies.map((e) => [e.id, e]));
    const uses = (s: (typeof stages)[number], status: string) => s.waves.some((w) => w.enemies.some((id) => enemy.get(id)!.abilities.some((a) => a.status === status)));
    const late = byKind('main').filter((s) => s.chapter === 6 && Number(s.id.split('-')[2]) >= 4);
    for (const status of ['darkOrbs', 'attributeSeal']) expect(late.filter((s) => uses(s, status)).length, status).toBeGreaterThanOrEqual(2);
    const boss = enemy.get(late.at(-1)!.waves.at(-1)!.enemies[0])!;
    expect(boss.name).toContain('卡隆');
    expect(boss.abilities.map((a) => a.status)).toEqual(expect.arrayContaining(['darkOrbs', 'attributeSeal']));
    // 第 6 章後半的敵人從 e0048 開始編（e0046、e0047 是 battle-feel 的示範敵人）
    expect(late.flatMap((s) => s.waves.flatMap((w) => w.enemies)).every((id) => Number(id.slice(1)) >= 41 && id !== 'e0046' && id !== 'e0047')).toBe(true);
  });

  it('初始卡是一張隊長加四張通用輔助', () => {
    expect(gameData.config.newPlayer.starterCards).toEqual(['c106', 'c108', 'c208', 'c308', 'c408']);
  });
});
