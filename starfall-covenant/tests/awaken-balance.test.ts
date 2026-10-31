import { describe, expect, it } from 'vitest';
import { gameData } from '../src/data/load';
import { createGrowthContext, GROWTH_RULES } from '../src/growth';
import { starterTeams } from '../tools/sim/fixtures';
import { archetypeFiveStars, buildProgressTeam, estimateProgress, mainOrder } from '../tools/sim/progress';

// 覺醒與進化搶資源的目標（總監指派）：照主線推進，第 5 章前段能進化 5★，第 6 章前段每隊平均有 1～2 個覺醒
const ctx = createGrowthContext(gameData);
const order = mainOrder(gameData.stages);
const pool = Object.values(gameData.gachaPools.find((p) => !p.period)!.cards).flat();
const teamsAt = (id: string) => starterTeams().map((t) => {
  const p = estimateProgress(order.find((s) => s.id === id)!, gameData.stages, ctx, ctx.card(t.members[0].cardId)!.attribute, undefined, gameData.chapters);
  return buildProgressTeam(t.archetype, t.members.map((m) => m.cardId), archetypeFiveStars(t.archetype, pool, ctx), p, ctx);
});
const avgAwakened = (id: string) => {
  const teams = teamsAt(id);
  return teams.reduce((n, b) => n + b.members.reduce((x, m) => x + m.awakened, 0), 0) / teams.length;
};

describe('覺醒與進化的資源平衡', () => {
  it('覺醒的金幣逐級增加', () => {
    const c = GROWTH_RULES.awakenCoin;
    for (let i = 1; i < c.length; i++) expect(c[i]).toBeGreaterThan(c[i - 1]);
  });

  it('第 5 章中段，過半的隊伍已經把 5★ 進化成 6★', () => {
    const teams = teamsAt('st-5-5');
    const evolved = teams.filter((b) => b.members.some((m) => m.evolved && ctx.card(m.baseId)!.rarity === 5)).length;
    expect(evolved).toBeGreaterThan(teams.length / 2);
  });

  it('第 6 章前段每隊平均至少 1 個覺醒，到 6-5 接近 2 個', () => {
    expect(avgAwakened('st-6-1')).toBeGreaterThanOrEqual(1);
    expect(avgAwakened('st-6-5')).toBeGreaterThanOrEqual(1.5);
  });
});
