import { describe, expect, it } from 'vitest';
import { gameData } from '../src/data/load';
import { createGrowthContext, expForLevel, GROWTH_RULES } from '../src/growth';
import { estimateProgress, mainOrder } from '../tools/sim/progress';

// 經驗曲線的目標（總監指派）：照主線推進（每關 2 次、每關 1 次每日關卡），
// 主力 3★ 約第 3 章末滿級可進化，5★ 約第 5 章前段滿級可進化。
const ctx = createGrowthContext(gameData);
const order = mainOrder(gameData.stages);
const card = (rarity: number) => gameData.cards.find((c) => c.rarity === rarity && c.race !== 'material')!;
const maxExpOf = (rarity: number) => expForLevel(card(rarity), card(rarity).maxLevel, ctx.rules);
/** 第一個「打到這關時隊員經驗已足夠升滿」的關卡 */
const maxedAt = (rarity: number) =>
  order.find((s) => estimateProgress(s, gameData.stages, ctx, 'fire').cardExpPerMember >= maxExpOf(rarity))?.id;
const pos = (id: string | undefined) => (id ? order.findIndex((s) => s.id === id) : Infinity);

describe('卡片經驗曲線', () => {
  it('稀有度越高，每級需要的經驗越多', () => {
    const scale = GROWTH_RULES.expScale;
    for (let r = 2; r <= 6; r++) expect(scale[r as 1]).toBeGreaterThan(scale[(r - 1) as 1]);
  });

  it('3★ 在第 3 章後半滿級（可進化成 4★）', () => {
    const at = pos(maxedAt(3));
    expect(at).toBeGreaterThanOrEqual(pos('st-3-5'));
    expect(at).toBeLessThanOrEqual(pos('st-3-9'));
  });

  it('5★ 在第 5 章前段滿級（可進化成 6★）', () => {
    const at = pos(maxedAt(5));
    expect(at).toBeGreaterThanOrEqual(pos('st-5-1'));
    expect(at).toBeLessThanOrEqual(pos('st-5-4'));
  });

  it('第 4 章起主線的卡片經驗比前一章最後一關多', () => {
    const exp = (id: string) => gameData.stages.find((s) => s.id === id)!.rewards.cardExp ?? 0;
    expect(exp('st-4-1')).toBeGreaterThan(exp('st-3-9'));
  });
});
