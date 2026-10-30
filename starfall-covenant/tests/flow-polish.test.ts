// 畫面流程小修（找差距第五輪 73～79）：活動排序、章節進度一致、製作中提示、謎題圖示
import { describe, expect, it } from 'vitest';
import { gameData } from '../src/data/load';
import { createNewSave } from '../src/save/save';
import { chapterStars } from '../src/progression/stages';
import type { EventDef } from '../src/progression/events';
import { openLimitedEvents, sortEventsForList } from '../src/ui/event-order';
import { chapterProgress, stageContext, upcomingStageRange } from '../src/ui/stage-nav';
import { ICONS } from '../src/ui/art/icons';

const NOW = new Date(2026, 10, 1, 12).getTime();
const ev = (id: string, period: EventDef['period']): EventDef => ({ id, name: id, summary: '', period });

describe('活動排序', () => {
  const always = ev('always', null);
  const soon = ev('soon', { start: '2026-10-20T00:00:00', end: '2026-11-03T00:00:00' });
  const later = ev('later', { start: '2026-10-20T00:00:00', end: '2026-11-20T00:00:00' });
  const upcoming = ev('upcoming', { start: '2026-12-01T00:00:00', end: '2026-12-10T00:00:00' });
  const ended = ev('ended', { start: '2026-09-01T00:00:00', end: '2026-09-10T00:00:00' });

  it('開放中的限時活動在最前面（快結束的優先），常駐在後', () => {
    expect(sortEventsForList([always, ended, later, upcoming, soon], NOW).map((e) => e.id)).toEqual(['soon', 'later', 'upcoming', 'always', 'ended']);
  });

  it('系列活動（流派克星週）不進活動列表與主城橫幅', () => {
    const nemesis = { ...ev('nemesis-week', { start: '2026-10-26T00:00:00', end: '2026-11-02T00:00:00' }), series: 'nemesis' };
    expect(sortEventsForList([always, nemesis, soon], NOW).map((e) => e.id)).toEqual(['soon', 'always']);
    expect(openLimitedEvents([nemesis, soon], NOW).map((e) => e.id)).toEqual(['soon']);
    for (const e of openLimitedEvents(gameData.events, NOW)) expect(e.series).toBeUndefined();
  });

  it('主城橫幅只放開放中的限時活動，不放常駐活動', () => {
    expect(openLimitedEvents([always, later, soon, upcoming], NOW).map((e) => e.id)).toEqual(['soon', 'later']);
  });

  it('正式資料：工匠座在檔期內排在常駐的獸王前面', () => {
    const at = new Date(2026, 9, 31, 12).getTime();
    expect(sortEventsForList(gameData.events, at)[0].id).toBe('ev-gear-theft');
    expect(openLimitedEvents(gameData.events, at).map((e) => e.id)).toEqual(['ev-gear-theft']);
  });
});

describe('章節進度與製作中提示', () => {
  const ctx = stageContext(gameData.stages);
  const save = createNewSave(gameData.config, NOW);

  it('冒險頁章節卡和章節頁的星章總數一致', () => {
    for (const c of gameData.chapters) {
      expect(chapterProgress(save, c.chapter, ctx, NOW, c.stageCount).maxStars, `第 ${c.chapter} 章`)
        .toBe(chapterStars(save, c.chapter, gameData.stages, gameData.chapters).total);
    }
  });

  it('預定關數多於已上線關數時顯示製作中範圍，全部上線後自動消失', () => {
    expect(upcomingStageRange(9, 3)).toEqual({ from: 4, to: 9 });
    expect(upcomingStageRange(9, 9)).toBeNull();
    expect(upcomingStageRange(undefined, 9)).toBeNull();
    // 第 6 章 9 關已全部上線，提示自動消失
    const ch6 = gameData.chapters.find((c) => c.chapter === 6)!;
    const live = gameData.stages.filter((s) => s.kind === 'main' && s.chapter === 6).length;
    expect(upcomingStageRange(ch6.stageCount, live)).toBeNull();
  });
});

it('星紋謎題有自己的圖示，不再和流派試煉重複', () => {
  expect(ICONS.puzzle).toBeDefined();
  expect(ICONS.puzzle).not.toBe(ICONS.constellation);
});
