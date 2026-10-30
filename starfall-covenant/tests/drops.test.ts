import { describe, expect, it } from 'vitest';
import type { StageDef } from '../src/core/types';
import { createRng } from '../src/core/rng';
import { gameData } from '../src/data/load';
import { createNewSave } from '../src/save/save';
import { dropsOn, planDrops, planMatches, plannedCards } from '../src/progression/drops';
import { completeStage } from '../src/progression/stages';

const config = { ...gameData.config, newPlayer: { ...gameData.config.newPlayer, starterCards: [] } };
const NOW = new Date(2026, 10, 2, 12).getTime();

const stage = (over: Partial<StageDef> = {}): StageDef => ({
  id: 'st-x', kind: 'main', chapter: 1, name: 'x', stamina: 5, unlockAfter: null,
  waves: [{ enemies: ['e1', 'e2'] }, { enemies: ['e3'] }],
  rewards: { coin: 100, playerExp: 10 },
  drops: [{ card: 'c0901', rate: 1, level: 3 }, { card: 'c0902', rate: 1 }, { card: 'c0903', rate: 0 }],
  ...over,
});

describe('進場時骰好的掉落', () => {
  it('依機率骰出掉落，每份交給一隻存在的敵人', () => {
    const plan = planDrops(stage(), createRng(7));
    expect(plan.stageId).toBe('st-x');
    expect(plan.drops.map((d) => d.cardId)).toEqual(['c0901', 'c0902']);
    expect(plan.drops[0].level).toBe(3);
    expect('level' in plan.drops[1]).toBe(false);
    for (const d of plan.drops) expect(stage().waves[d.wave].enemies[d.enemy]).toBeDefined();
    expect(planMatches(plan, stage())).toBe(true);
  });

  it('同一個種子結果相同；計畫是純 JSON，存檔讀回不變', () => {
    const a = planDrops(stage(), createRng(42));
    expect(planDrops(stage(), createRng(42))).toEqual(a);
    expect(JSON.parse(JSON.stringify(a))).toEqual(a);
  });

  it('掉落機率和結算時骰的一樣', () => {
    const s = stage({ drops: [{ card: 'c1', rate: 0.3 }] });
    let total = 0;
    for (let i = 0; i < 2000; i++) total += planDrops(s, createRng(i)).drops.length;
    expect(total / 2000).toBeGreaterThan(0.25);
    expect(total / 2000).toBeLessThan(0.35);
  });

  it('掉落平均分到每隻敵人', () => {
    const s = stage({ drops: [{ card: 'c1', rate: 1 }] });
    const counts = new Map<string, number>();
    for (let i = 0; i < 3000; i++) {
      const d = planDrops(s, createRng(i)).drops[0];
      counts.set(`${d.wave}-${d.enemy}`, (counts.get(`${d.wave}-${d.enemy}`) ?? 0) + 1);
    }
    expect([...counts.keys()].sort()).toEqual(['0-0', '0-1', '1-0']);
    for (const n of counts.values()) expect(n).toBeGreaterThan(850);
  });

  it('沒有敵人或沒有掉落時是空的', () => {
    expect(planDrops(stage({ drops: [] }), createRng(1)).drops).toEqual([]);
    expect(planDrops(stage({ waves: [] }), createRng(1)).drops).toEqual([]);
  });

  it('入場券綁定關卡：別關的計畫或指到不存在的敵人都不算', () => {
    const plan = planDrops(stage(), createRng(3));
    expect(planMatches(plan, stage({ id: 'other' }))).toBe(false);
    expect(planMatches({ ...plan, drops: [{ cardId: 'c1', wave: 5, enemy: 0 }] }, stage())).toBe(false);
    expect(planMatches(null, stage())).toBe(false);
  });

  it('查詢某隻敵人身上的掉落', () => {
    const plan = { stageId: 'st-x', drops: [{ cardId: 'a', wave: 0, enemy: 1 }, { cardId: 'b', wave: 0, enemy: 1 }, { cardId: 'c', wave: 1, enemy: 0 }] };
    expect(dropsOn(plan, 0, 1).map((d) => d.cardId)).toEqual(['a', 'b']);
    expect(dropsOn(plan, 0, 0)).toEqual([]);
    expect(dropsOn(null, 0, 0)).toEqual([]);
  });

  it('通關時照計畫發卡，不再重骰', () => {
    const plan = planDrops(stage(), createRng(9));
    const summary = { turns: 3, usedActiveSkill: false, maxCombo: 3, continues: 0, team: [] };
    const ctx = { stages: [stage()], openEvents: new Set<string>() };
    for (const seed of [1, 2, 3]) {
      const { result, save } = completeStage(createNewSave(config, NOW), stage(), summary, ctx, config, createRng(seed), NOW, plannedCards(plan));
      expect(result.drops.map((d) => d.cardId)).toEqual(['c0901', 'c0902']);
      expect(save.inventory.cards.find((c) => c.cardId === 'c0901')?.level).toBe(3);
    }
    const none = completeStage(createNewSave(config, NOW), stage(), summary, ctx, config, createRng(1), NOW, []);
    expect(none.result.drops).toEqual([]);
  });
});
