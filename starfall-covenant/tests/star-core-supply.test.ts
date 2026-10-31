import { describe, expect, it } from 'vitest';
import type { Attribute } from '../src/core/types';
import { gameData } from '../src/data/load';
import { createGrowthContext } from '../src/growth';
import { CORE_DEMAND, estimateCores } from '../tools/sim/core-supply';

const ctx = createGrowthContext(gameData);
const ATTRS: Attribute[] = ['fire', 'water', 'wood', 'light', 'dark'];

describe('星核供需（tools/sim/reports/2026-10-31-star-core-supply.md）', () => {
  it('星核試煉每天開放', () => {
    for (const s of gameData.stages.filter((x) => x.id.startsWith('dl-core'))) expect(s.weekdays, s.id).toBeUndefined();
  });

  it('第 4 章 Boss 首通給五屬星核各 1 顆', () => {
    const cards = gameData.stages.find((s) => s.id === 'st-4-9')!.rewards.firstClear!.cards!.map((c) => c.card);
    for (const id of ['c916', 'c917', 'c918', 'c919', 'c920']) expect(cards).toContain(id);
  });

  it('照主線推進到第 5 章前段（st-5-3），每個屬性不靠每週來源也夠進化 1 張 5★（含覺醒與同屬 3★ 進化）', () => {
    for (const attr of ATTRS) {
      const c = estimateCores('st-5-3', attr, gameData.stages, gameData.events, ctx);
      expect(c.base, attr).toBeGreaterThanOrEqual(CORE_DEMAND.oneFiveStar);
    }
  });
});
