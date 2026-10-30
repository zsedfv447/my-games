import { describe, expect, it } from 'vitest';
import { gameData } from '../src/data/load';
import { createNewSave } from '../src/save/save';
import { chapterProgress, isPlayable, nextMainStage, stageContext, stageRow, weekdayText } from '../src/ui/stage-nav';

const ctx = stageContext(gameData.stages);
const now = new Date(2026, 9, 30, 12).getTime(); // 週五

describe('關卡導覽', () => {
  it('新玩家只開放第 1 章第 1 關', () => {
    const save = createNewSave(gameData.config, now);
    expect(nextMainStage(save, ctx, now)?.id).toBe('st-1-1');
    const p1 = chapterProgress(save, 1, ctx, now);
    expect(p1.unlocked).toBe(true);
    expect(p1.cleared).toBe(0);
    expect(chapterProgress(save, 2, ctx, now).unlocked).toBe(false);
  });

  it('通過後顯示已通過，並開放下一關', () => {
    const save = createNewSave(gameData.config, now);
    save.progress.clearedStages = ['st-1-1'];
    const first = gameData.stages.find((s) => s.id === 'st-1-1')!;
    expect(stageRow(save, first, ctx, now).status).toBe('cleared');
    expect(nextMainStage(save, ctx, now)?.unlockAfter).toBe('st-1-1');
  });

  it('挑戰之塔第 2 層要先爬過第 1 層，活動視為開放', () => {
    const save = createNewSave(gameData.config, now);
    const tower = gameData.stages.filter((s) => s.kind === 'tower');
    expect(stageRow(save, tower[0], ctx, now).status).toBe('open');
    expect(isPlayable(stageRow(save, tower[1], ctx, now).status)).toBe(false);
    const ev = gameData.stages.find((s) => s.kind === 'event' && !s.unlockAfter);
    if (ev) expect(isPlayable(stageRow(save, ev, ctx, now).status)).toBe(true);
  });

  it('星期文字', () => {
    expect(weekdayText([1, 6])).toBe('週一、六');
    expect(weekdayText(undefined)).toBe('');
  });
});
