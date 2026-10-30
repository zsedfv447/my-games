// 正式卡片資料（data/cards.json）的養成面檢查：卡數、進化鏈、覺醒、流派與種族分配
import { describe, expect, it } from 'vitest';
import { ARCHETYPE_IDS, RACES } from '../../src/core/types';
import { gameData } from '../../src/data/load';
import { GROWTH_RULES, archetypeCodex, createGrowthContext } from '../../src/growth';
import { makeSave } from './fixtures';

const ctx = createGrowthContext(gameData);
const battle = gameData.cards.filter((c) => c.race !== 'material');
const materials = gameData.cards.filter((c) => c.race === 'material');
const evolvedIds = new Set(gameData.cards.flatMap((c) => (c.evolution ? [c.evolution.to] : [])));

describe('正式卡片資料', () => {
  it('64 張戰鬥卡＋20 張素材卡，對應 44 位角色', () => {
    expect(battle).toHaveLength(64);
    expect(materials).toHaveLength(20);
    expect(battle.filter((c) => !evolvedIds.has(c.id))).toHaveLength(44);
  });

  it('進化用同屬性星核，進化後稀有度 +1 且流派不變', () => {
    for (const c of gameData.cards) {
      if (!c.evolution) continue;
      const to = ctx.card(c.evolution.to)!;
      expect(to.rarity, c.id).toBe(c.rarity + 1);
      expect(to.attribute, c.id).toBe(c.attribute);
      expect(to.archetypes, c.id).toEqual(c.archetypes);
      for (const m of c.evolution.materials) expect(m, c.id).toBe(GROWTH_RULES.awakenMaterialByAttribute[c.attribute]);
    }
  });

  it('5★ 以上每張都有 3 個星紋覺醒，4★ 以下沒有', () => {
    for (const c of battle) expect(c.awakenings?.length ?? 0, c.id).toBe(c.rarity >= 5 ? 3 : 0);
  });

  it('覺醒用的星核卡號都存在', () => {
    for (const id of Object.values(GROWTH_RULES.awakenMaterialByAttribute)) expect(ctx.card(id)?.race).toBe('material');
  });

  it('每個流派都有隊長與核心或輔助（種族羈絆的成員看種族，不另掛標籤）', () => {
    const codex = archetypeCodex(makeSave(), ctx);
    for (const id of ARCHETYPE_IDS) {
      const entry = codex.find((e) => e.id === id)!;
      expect(entry.cards.some((c) => c.role === 'leader'), id).toBe(true);
      if (id !== 'race') expect(entry.cards.some((c) => c.role !== 'leader'), id).toBe(true);
    }
  });

  it('種族分配：每個種族 ≥6 位角色、橫跨 ≥3 屬性', () => {
    const roots = battle.filter((c) => !evolvedIds.has(c.id));
    for (const race of RACES.filter((r) => r !== 'material')) {
      const members = roots.filter((c) => c.race === race);
      expect(members.length, race).toBeGreaterThanOrEqual(6);
      expect(new Set(members.map((c) => c.attribute)).size, race).toBeGreaterThanOrEqual(3);
    }
  });
});
