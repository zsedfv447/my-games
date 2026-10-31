import { describe, expect, it } from 'vitest';
import type { SaveData } from '../src/core/types';
import { gameData } from '../src/data/load';
import { createNewSave } from '../src/save/save';
import { dateKey, weekKey } from '../src/progression/time';
import { checklistSummary, weeklyChecklist } from '../src/ui/weekly-checklist';

const NOW = new Date(2026, 10, 3, 12).getTime();
const row = (save: SaveData, id: string) => weeklyChecklist(save, NOW, gameData).find((r) => r.id === id)!;
const mainIds = (upTo: string) => {
  const main = gameData.stages.filter((s) => s.kind === 'main').map((s) => s.id);
  return main.slice(0, main.indexOf(upTo) + 1);
};
const veteran = (): SaveData => {
  const s = createNewSave(gameData.config, NOW);
  return { ...s, progress: { ...s.progress, clearedStages: mainIds('st-5-9') } };
};

describe('本週契約（提案 123）', () => {
  it('新玩家：只有謎題開放，其他寫開放條件；摘要 0/1', () => {
    const s = createNewSave(gameData.config, NOW);
    const rows = weeklyChecklist(s, NOW, gameData);
    expect(rows.map((r) => r.id)).toEqual(['nemesis', 'abyss', 'expedition', 'oath', 'puzzle']);
    expect(rows.filter((r) => r.open).map((r) => r.id)).toEqual(['puzzle']);
    expect(row(s, 'nemesis').hint).toMatch(/後開放$/);
    expect(checklistSummary(rows)).toEqual({ done: 0, total: 1, text: '本週契約 0/1' });
  });

  it('進度都由各系統既有的存檔欄位讀出', () => {
    const base = veteran();
    const week = weekKey(NOW);
    const s: SaveData = {
      ...base,
      abyss: { week, best: 18, claimed: [], allTimeBest: 18 },
      oaths: { week, best: {}, gems: 4, highest: 5 },
      expeditions: [{ id: 'x1', chapter: 1, uids: [], hours: 2, startedAt: NOW - 3 * 3_600_000 }],
      puzzle: { lastDay: dateKey(NOW), streak: 12, solvedDays: [dateKey(NOW)] },
    } as SaveData;
    expect(row(s, 'abyss')).toMatchObject({ open: true, progress: '18/30', done: false, to: ['abyss', []] });
    expect(row(s, 'oath')).toMatchObject({ open: true, progress: '本週星晶 4/10', done: false, to: ['stages', ['5']] });
    expect(row(s, 'expedition')).toMatchObject({ open: true, progress: '1 隊已歸來', done: false });
    expect(row(s, 'puzzle')).toMatchObject({ progress: '連續 12 天', done: true });
    expect(row(s, 'nemesis')).toMatchObject({ open: true, progress: '0/3', to: ['stages', ['nemesis']] });
  });

  it('上週的紀錄不算本週；達到上限算完成', () => {
    const base = veteran();
    const s = { ...base, abyss: { week: '2026-10-26', best: 30, claimed: [], allTimeBest: 30 }, oaths: { week: weekKey(NOW), best: {}, gems: 10, highest: 7 } } as SaveData;
    expect(row(s, 'abyss').progress).toBe('0/30');
    expect(row(s, 'oath').done).toBe(true);
  });

  it('只讀不寫存檔', () => {
    const s = veteran();
    const before = JSON.stringify(s);
    weeklyChecklist(s, NOW, gameData);
    expect(JSON.stringify(s)).toBe(before);
  });
});
