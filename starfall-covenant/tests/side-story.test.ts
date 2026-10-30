import { describe, expect, it } from 'vitest';
import type { SaveData } from '../src/core/types';
import { gameData } from '../src/data/load';
import { createNewSave } from '../src/save/save';
import { nextStageAfter } from '../src/progression/stages';
import { isKnownCounter } from '../src/progression/quests';
import { lockText, sideStoryProgress, stageContext, stageListPath, stageRow } from '../src/ui/stage-nav';
import { storyTitle } from '../src/ui/screens/story';

const NOW = new Date(2026, 10, 2, 12).getTime();
const side = gameData.stages.filter((s) => s.kind === 'side');
const ctx = stageContext(gameData.stages);
const withCleared = (ids: string[]): SaveData => {
  const save = createNewSave(gameData.config, NOW);
  return { ...save, progress: { ...save.progress, clearedStages: ids } };
};

describe('外傳章：灰燈港夜話', () => {
  it('3～5 關、低體力、故事 key 用 side-harbor-*', () => {
    expect(side.length).toBeGreaterThanOrEqual(3);
    expect(side.length).toBeLessThanOrEqual(5);
    for (const s of side) {
      expect(s.id).toMatch(/^side-harbor-\d$/);
      expect(s.stamina).toBeGreaterThanOrEqual(3);
      expect(s.stamina).toBeLessThanOrEqual(5);
      expect(s.story?.before).toBe(s.id);
      expect(gameData.story[s.story!.before!]?.length).toBeGreaterThan(0);
    }
    expect(gameData.story['side-harbor-end']?.length).toBeGreaterThan(0);
  });

  it('第 3 章通關後開放，之後一關接一關', () => {
    expect(side[0].unlockAfter).toBe('st-3-9');
    side.slice(1).forEach((s, i) => expect(s.unlockAfter).toBe(side[i].id));
    // 主線的下一關仍然是第 4 章
    expect(nextStageAfter(gameData.stages.find((s) => s.id === 'st-3-9')!, gameData.stages)?.id).toBe('st-4-1');
    expect(nextStageAfter(side[0], gameData.stages)?.id).toBe(side[1].id);
  });

  it('敵人都是現有的，難度不超過第 2 章（Boss 生命不超過第 2 章 Boss）', () => {
    const enemy = (id: string) => gameData.enemies.find((e) => e.id === id);
    const ch2BossHp = enemy('e0034')!.hp;
    const ch2NormalHp = Math.max(...['e0006', 'e0007', 'e0008', 'e0009', 'e0010'].map((id) => enemy(id)!.hp));
    for (const s of side) {
      for (const w of s.waves) for (const id of w.enemies) {
        const e = enemy(id);
        expect(e, id).toBeDefined();
        expect(e!.hp).toBeLessThanOrEqual(w.boss ? ch2BossHp : ch2NormalHp);
      }
    }
  });

  it('首通給 3★→4★ 進化用的星核，五種都拿得到', () => {
    const cores = side.flatMap((s) => s.rewards.firstClear?.cards?.map((c) => c.card) ?? []);
    expect(new Set(cores)).toEqual(new Set(['c916', 'c917', 'c918', 'c919', 'c920']));
  });

  it('外傳放在資料檔最後面（不重排既有關卡）', () => {
    const ids = gameData.stages.map((s) => s.id);
    expect(ids.slice(-side.length)).toEqual(side.map((s) => s.id));
  });

  it('關卡列表路徑、鎖定說明、冒險頁進度', () => {
    expect(stageListPath(side[0])).toBe('stages/side');
    const fresh = withCleared([]);
    expect(lockText(stageRow(fresh, side[0], ctx, NOW), gameData.stages)).toBe('通過第 3 章「聖樹根冠」後開放');
    expect(lockText(stageRow(fresh, side[1], ctx, NOW), gameData.stages)).toBe('通過前一關後開放');
    expect(sideStoryProgress(fresh, ctx, NOW)).toMatchObject({ open: false, cleared: 0, total: side.length });
    const opened = withCleared(['st-3-9', side[0].id]);
    expect(sideStoryProgress(opened, ctx, NOW)).toMatchObject({ open: true, cleared: 1 });
    expect(lockText(stageRow(opened, side[1], ctx, NOW), gameData.stages)).toBe('');
  });

  it('劇情回顧標題與任務計數', () => {
    expect(storyTitle('side-harbor-2')).toBe('外傳・灰燈港夜話・第 2 話');
    expect(storyTitle('side-harbor-end')).toBe('外傳・灰燈港夜話・尾聲');
    expect(isKnownCounter('stageClear:side', 'daily')).toBe(true);
  });
});
