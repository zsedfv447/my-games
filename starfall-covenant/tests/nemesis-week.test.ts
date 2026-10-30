import { afterEach, describe, expect, it } from 'vitest';
import { createRng } from '../src/core/rng';
import { gameData } from '../src/data/load';
import { currentSeriesEvent, eventPeriodKey, isEventOpen } from '../src/progression/events';
import { completeStage, periodFirstClearClaimed, stageLockReason } from '../src/progression/stages';
import { createNewSave } from '../src/save/save';
import { firstClearPreview } from '../src/ui/reward-plan';
import { isSeriesStage, NEMESIS, nemesisView } from '../src/ui/nemesis';
import { stageContext, stageListPath } from '../src/ui/stage-nav';

const config = { ...gameData.config, newPlayer: { ...gameData.config.newPlayer, starterCards: [] } };
const themes = gameData.events.filter((e) => e.series === NEMESIS);
const local = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min).getTime();
const themeAt = (now: number) => currentSeriesEvent(gameData.events, NEMESIS, now)?.event.id;
const archetypeName = (id: string) => gameData.archetypes.find((a) => a.id === id)!.name;

describe('流派克星週：本週主題', () => {
  it('6 個主題，每個推薦 2 個流派，12 個流派都會輪到', () => {
    expect(themes).toHaveLength(6);
    for (const t of themes) expect(t.recommendedArchetypes).toHaveLength(2);
    const covered = new Set(themes.flatMap((t) => t.recommendedArchetypes));
    expect(covered.size).toBe(12);
  });

  it('同一時間只會開一個主題（掃過整整兩輪，每小時檢查一次）', () => {
    for (let t = local(2026, 10, 26); t < local(2026, 10, 26) + 84 * 86_400_000; t += 3_600_000) {
      expect(themes.filter((e) => isEventOpen(e, t)), new Date(t).toString()).toHaveLength(1);
    }
  });

  it('週一 00:00 換主題（週日 23:59 還是上一週）', () => {
    expect(themeAt(local(2026, 11, 1, 23, 59))).toBe(themes[0].id);
    expect(themeAt(local(2026, 11, 2, 0, 0))).toBe(themes[1].id);
  });

  it('6 週一輪後回到第一個主題', () => {
    expect(themeAt(local(2026, 12, 7, 12))).toBe(themes[0].id);
    expect(themeAt(local(2027, 6, 14, 12))).toBe(themeAt(local(2027, 6, 14, 12) - 42 * 86_400_000));
  });

  describe('時區：以裝置當地時間的週一午夜換週', () => {
    const tz = process.env.TZ;
    afterEach(() => { process.env.TZ = tz; });
    for (const zone of ['Asia/Taipei', 'America/Los_Angeles']) {
      it(zone, () => {
        process.env.TZ = zone;
        const monday = new Date(2026, 10, 2, 0, 0).getTime();
        expect(new Date(monday).getDay()).toBe(1);
        expect(themeAt(monday - 1)).toBe(themes[0].id);
        expect(themeAt(monday)).toBe(themes[1].id);
      });
    }
  });

  it('入口資料：主題名稱、剩餘時間、推薦流派、本週 3 關', () => {
    const v = nemesisView(gameData.events, gameData.stages, archetypeName, local(2026, 11, 3, 12))!;
    expect(v.event.id).toBe(themes[1].id);
    expect(v.open).toBe(true);
    expect(v.status).toBe('剩餘 5 天 12 小時');
    expect(v.archetypes).toEqual(themes[1].recommendedArchetypes!.map(archetypeName));
    expect(v.stages.map((s) => s.id)).toEqual([1, 2, 3].map((n) => `${themes[1].id}-${n}`));
  });
});

describe('流派克星週：關卡與每週首通', () => {
  const stages = gameData.stages.filter((s) => isSeriesStage(s, gameData.events));
  const summary = { turns: 5, usedActiveSkill: false, maxCombo: 6, continues: 0, team: [] };
  const base = () => {
    const s = createNewSave(config, local(2026, 11, 3));
    return { ...s, progress: { ...s.progress, clearedStages: ['st-3-1'] } };
  };

  it('每週 3 關，只用現有敵人；不出現在限時活動，結束後回到克星週列表', () => {
    expect(stages).toHaveLength(18);
    const enemies = new Set(gameData.enemies.map((e) => e.id));
    for (const s of stages) {
      for (const w of s.waves) for (const e of w.enemies) expect(enemies.has(e), `${s.id} ${e}`).toBe(true);
      expect(stageListPath(s, gameData.events)).toBe('stages/nemesis');
      expect(s.rewards.firstClear).toBeUndefined();
      expect(s.rewards.periodFirstClear?.gems).toBeGreaterThan(0);
    }
  });

  it('只有本週主題的關卡能進', () => {
    const now = local(2026, 11, 3, 12);
    const ctx = stageContext(gameData.stages, gameData.events, now);
    const save = base();
    const thisWeek = stages.find((s) => s.event === themes[1].id && s.unlockAfter === 'st-3-1')!;
    const otherWeek = stages.find((s) => s.event === themes[2].id && s.unlockAfter === 'st-3-1')!;
    expect(stageLockReason(save, thisWeek, ctx, now)).toBeNull();
    expect(stageLockReason(save, otherWeek, ctx, now)).toBe('eventClosed');
  });

  it('每週第一次通關給星晶（中級以上加星核），同一週再打不給，下一輪同主題再給', () => {
    const stage = gameData.stages.find((s) => s.id === `${themes[1].id}-2`)!;
    const wk = local(2026, 11, 3, 12);
    const ctx = { stages: gameData.stages, events: gameData.events };
    const first = completeStage(base(), stage, summary, ctx, config, createRng(1), wk);
    expect(first.result.periodFirstClear).toEqual(stage.rewards.periodFirstClear);
    expect(first.save.inventory.cards.map((c) => c.cardId)).toEqual(stage.rewards.periodFirstClear!.cards!.map((c) => c.card));
    expect(periodFirstClearClaimed(first.save, stage, gameData.events, wk)).toBe(true);
    const again = completeStage(first.save, stage, summary, ctx, config, createRng(1), wk + 86_400_000);
    expect(again.result.periodFirstClear).toBeUndefined();
    expect(again.save.inventory.cards).toHaveLength(first.save.inventory.cards.length);
    const nextCycle = wk + 42 * 86_400_000;
    expect(periodFirstClearClaimed(again.save, stage, gameData.events, nextCycle)).toBe(false);
    const later = completeStage(again.save, stage, summary, ctx, config, createRng(1), nextCycle);
    expect(later.result.periodFirstClear).toBeDefined();
    // 舊一期的紀錄被換掉，存檔不會一直變大
    expect(Object.keys(later.save.quests.counters).filter((k) => k.startsWith(`periodClear:${stage.id}@`))).toHaveLength(1);
  });

  it('檔期鍵和商店限購同一套規則', () => {
    const t = themes[1];
    expect(eventPeriodKey(t, local(2026, 11, 3))).toBe(`@e${t.id}:2026-11-02`);
    expect(eventPeriodKey(t, local(2026, 12, 15))).toBe(`@e${t.id}:2026-12-14`);
  });

  it('關卡列表預告寫「本週首通」', () => {
    expect(firstClearPreview({ gems: 2 }, false, '本週首通')?.text).toBe('本週首通 +2');
    expect(firstClearPreview({ gems: 2 }, true, '本週首通')?.text).toBe('本週首通 已領');
  });
});
