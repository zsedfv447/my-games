import { describe, expect, it } from 'vitest';
import type { QuestDef } from '../src/core/types';
import { gameData } from '../src/data/load';
import { createNewSave } from '../src/save/save';
import { questDestination } from '../src/ui/quest-goto';
import { stageListPath } from '../src/ui/stage-nav';

const now = new Date(2026, 9, 30, 12).getTime();
const quest = (counter: string): QuestDef => ({ id: `q-${counter}`, kind: 'daily', name: counter, counter, target: 1, reward: {} });
const dest = (counter: string, save = createNewSave(gameData.config, now)) => questDestination(quest(counter), save, gameData.stages, now);

describe('任務「前往」', () => {
  it('依 counter 帶到對應畫面', () => {
    expect(dest('stageClear:daily')).toEqual({ name: 'stages', args: ['daily'] });
    expect(dest('stageClear:event')).toEqual({ name: 'stages', args: ['event'] });
    expect(dest('towerFloor')).toEqual({ name: 'stages', args: ['tower'] });
    expect(dest('trialCleared')).toEqual({ name: 'archetypes', args: [] });
    expect(dest('gachaPull')).toEqual({ name: 'summon', args: [] });
    expect(dest('cardEnhance')).toEqual({ name: 'cards', args: [] });
    expect(dest('cardEvolve')).toEqual({ name: 'cards', args: [] });
    expect(dest('shopPurchase')).toEqual({ name: 'shop', args: [] });
    expect(dest('login')).toEqual({ name: 'login-bonus', args: [] });
  });

  it('戰鬥類任務帶到主線的下一關，全破後到冒險地圖', () => {
    for (const c of ['stageClear', 'mainCleared', 'combo5', 'combo10', 'orbsCleared', 'comboBest']) expect(dest(c)).toEqual({ name: 'prepare', args: ['st-1-1'] });
    const save = createNewSave(gameData.config, now);
    const main = gameData.stages.filter((s) => s.kind === 'main');
    const done = { ...save, progress: { ...save.progress, clearedStages: main.map((s) => s.id) } };
    expect(dest('stageClear', done)).toEqual({ name: 'adventure', args: [] });
  });

  it('沒有對應畫面的維持「進行中」', () => {
    expect(dest('questClaim:daily')).toBeNull();
    expect(dest('unknownCounter')).toBeNull();
  });

  it('資料裡每種 counter 都有決定（除了領任務本身）', () => {
    const counters = new Set(gameData.quests.map((q) => q.counter));
    for (const c of counters) if (!c.startsWith('questClaim')) expect(dest(c), c).not.toBeNull();
  });
});

describe('結算返回的關卡列表', () => {
  const first = (kind: string) => gameData.stages.find((s) => s.kind === kind)!;
  it('主線回到那一章，其他回到各自的列表', () => {
    const ch2 = gameData.stages.find((s) => s.kind === 'main' && s.chapter === 2)!;
    expect(stageListPath(ch2)).toBe('stages/2');
    expect(stageListPath(first('daily'))).toBe('stages/daily');
    expect(stageListPath(first('event'))).toBe('stages/event');
    expect(stageListPath(first('tower'))).toBe('stages/tower');
    expect(stageListPath(first('trial'))).toBe('archetypes');
  });
});
