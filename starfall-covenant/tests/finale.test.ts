import { describe, expect, it } from 'vitest';
import { gameData } from '../src/data/load';
import { createNewSave } from '../src/save/save';
import { FINALE_ID, finaleRecap, shouldPlayFinale } from '../src/ui/finale-plan';

const name = (id: string) => gameData.cards.find((c) => c.id === id)?.name;

describe('穹頂篇片尾卡', () => {
  const base = createNewSave(gameData.config, new Date(2026, 9, 31).getTime());
  const main = gameData.stages.filter((s) => s.kind === 'main');

  it('回顧主線通關數、星章、勝場與最常並肩的隊長，最後一行是後續預告', () => {
    const save = {
      ...base,
      progress: { ...base.progress, clearedStages: main.map((s) => s.id), stars: Object.fromEntries(main.map((s) => [s.id, [true, true, false]])) },
      records: { battles: 80, wins: 70, maxCombo: 9, maxTurnDamage: 0, fastestTurns: {}, leaderClears: { c106: 40, c208: 12 }, archetypeClears: {} },
    };
    const r = finaleRecap(save, gameData.stages, name);
    expect(r.title).toBe('穹頂篇　完');
    expect(r.lines[0]).toBe(`走過主線 ${main.length}／${main.length} 關，點亮星章 ${main.length * 2}／${main.length * 3} 顆`);
    expect(r.lines[1]).toBe('一路贏下 70 場戰鬥，最高 9 Combo');
    expect(r.lines[2]).toBe(`最常並肩的隊長：${name('c106')}（40 場）`);
    expect(r.closing).toBe('後續篇章，敬請期待');
  });

  it('沒有戰績時只顯示通關與星章，不會出現空的隊長', () => {
    const r = finaleRecap(base, gameData.stages, name);
    expect(r.lines).toHaveLength(1);
    expect(r.lines[0]).toContain('走過主線 0／');
  });

  it('只在第 7 章結尾劇情、而且還沒看過片尾時接片尾卡；看過後不再自動播放', () => {
    expect(shouldPlayFinale('ch7-end', [])).toBe(true);
    expect(shouldPlayFinale('ch7-end', [FINALE_ID])).toBe(false);
    expect(shouldPlayFinale('ch6-end', [])).toBe(false);
    expect(gameData.stages.find((s) => s.id === 'st-7-9')?.story?.after).toBe('ch7-end');
    // 片尾卡的 id 不是劇情 id，不會混進劇情回顧的對白列表
    expect(FINALE_ID in gameData.story).toBe(false);
  });
});
