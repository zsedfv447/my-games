import { describe, expect, it } from 'vitest';
import type { SaveData } from '../src/core/types';
import { gameData } from '../src/data/load';
import { createNewSave } from '../src/save/save';
import { addQuestCounters, claimAllQuests, claimableQuests, isKnownCounter, questProgress, resetQuestsIfNeeded } from '../src/progression/quests';
import { homeBadges, questDerived } from '../src/ui/economy';
import { questDestination } from '../src/ui/quest-goto';

const NOW = new Date(2026, 10, 2, 12).getTime();
const starter = gameData.quests.filter((q) => q.kind === 'starter');
const main = gameData.stages.filter((s) => s.kind === 'main');
const fresh = () => createNewSave(gameData.config, NOW);

/** 什麼都做過的老玩家（新手契約上線前的存檔） */
function veteran(): SaveData {
  const s = fresh();
  // 強化沿用終身計數器；召喚與進化由召喚紀錄、圖鑑推算（計數器上線前的老存檔也算）
  const counted = addQuestCounters(s, { cardEnhance: 12 }, gameData.quests, NOW);
  return {
    ...counted,
    gacha: { ...counted.gacha, history: [{ pool: 'standard', card: 'c206', at: 0 }] },
    collection: { ...counted.collection, owned: [...counted.collection.owned, 'c109', 'c110'] },
    teams: counted.teams.map((t, i) => (i === 0 ? { ...t, members: ['u2', 'u1', 'u3', 'u4', 'u5'] } : t)),
    progress: { ...counted.progress, clearedStages: main.slice(0, 20).map((st) => st.id), chapterRewardsClaimed: [1] },
    helperBond: { 'npc-mono': 4 },
    puzzle: { lastDay: '2026-10-01', streak: 1, solvedDays: ['2026-10-01'] },
  };
}

describe('新手契約資料', () => {
  it('8～10 項、一次性、計數器都認得、合計約 30 星晶', () => {
    expect(starter.length).toBeGreaterThanOrEqual(8);
    expect(starter.length).toBeLessThanOrEqual(10);
    for (const q of starter) expect(isKnownCounter(q.counter, q.kind), q.id).toBe(true);
    const gems = starter.reduce((n, q) => n + (q.reward.gems ?? 0), 0);
    expect(gems).toBeGreaterThanOrEqual(28);
    expect(gems).toBeLessThanOrEqual(32);
  });

  it('每一項都有「前往」的去處', () => {
    for (const q of starter) expect(questDestination(q, fresh(), gameData.stages, NOW), q.id).not.toBeNull();
  });

  it('推算型計數器只給一次性任務用，每日任務不能用', () => {
    expect(isKnownCounter('teamEdited', 'starter')).toBe(true);
    expect(isKnownCounter('teamEdited', 'daily')).toBe(false);
  });
});

describe('新手契約進度', () => {
  it('新存檔一項都還沒達成', () => {
    const s = fresh();
    expect(claimableQuests(s, starter, NOW, questDerived(s))).toEqual([]);
  });

  it('老玩家讀檔就全部算達成，可以一次領完', () => {
    const s = veteran();
    expect(claimableQuests(s, starter, NOW, questDerived(s)).map((q) => q.id)).toEqual(starter.map((q) => q.id));
    const r = claimAllQuests(s, ['starter'], gameData.quests, gameData.config, NOW, questDerived);
    expect(r.claimed.length).toBe(starter.length);
    expect(r.save.player.gems - s.player.gems).toBe(starter.reduce((n, q) => n + (q.reward.gems ?? 0), 0));
    // 領過就不能再領，跨日、跨週也不會重置
    const later = resetQuestsIfNeeded(r.save, gameData.quests, NOW + 8 * 86400_000);
    expect(claimableQuests(later, starter, NOW + 8 * 86400_000, questDerived(later))).toEqual([]);
    expect(starter.every((q) => later.quests.claimed.includes(q.id))).toBe(true);
  });

  it('換隊員、帶助戰通關、解謎題分別推進對應項目', () => {
    const s = fresh();
    const prog = (save: SaveData, id: string) => questProgress(save, starter.find((q) => q.id === id)!, questDerived(save)).done;
    expect(prog(s, 'st-team')).toBe(false);
    expect(prog({ ...s, teams: s.teams.map((t, i) => (i === 1 ? { ...t, members: ['u1', null, null, null, null] } : t)) }, 'st-team')).toBe(true);
    expect(prog({ ...s, helperBond: { 'npc-heart': 1 } }, 'st-helper')).toBe(true);
    expect(prog({ ...s, puzzle: { lastDay: '2026-11-02', streak: 1, solvedDays: ['2026-11-02'] } }, 'st-puzzle')).toBe(true);
  });

  it('召喚看召喚紀錄、進化看圖鑑有沒有進化後的型態', () => {
    const s = fresh();
    const prog = (save: SaveData, id: string) => questProgress(save, starter.find((q) => q.id === id)!, questDerived(save)).done;
    expect(prog(s, 'st-summon')).toBe(false);
    expect(prog({ ...s, gacha: { ...s.gacha, history: [{ pool: 'standard', card: 'c206', at: 0 }] } }, 'st-summon')).toBe(true);
    expect(prog({ ...s, collection: { ...s.collection, owned: [...s.collection.owned, 'c109'] } }, 'st-evolve')).toBe(false);
    expect(prog({ ...s, collection: { ...s.collection, owned: [...s.collection.owned, 'c110'] } }, 'st-evolve')).toBe(true);
  });

  it('主城紅點會算進可領的新手契約', () => {
    const s = veteran();
    // 只留新手契約可領：其他任務先全部標成已領
    const others = gameData.quests.filter((q) => q.kind !== 'starter').map((q) => q.id);
    const onlyStarter = { ...s, quests: { ...s.quests, claimed: others } };
    expect(homeBadges(onlyStarter, NOW).quests).toBe(true);
    const done = { ...onlyStarter, quests: { ...onlyStarter.quests, claimed: gameData.quests.map((q) => q.id) } };
    expect(homeBadges(done, NOW).quests).toBe(false);
  });
});
