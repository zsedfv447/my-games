import { describe, expect, it } from 'vitest';
import { evolve, pickEvolutionMaterials } from '../../src/growth';
import { ctx, makeSave, owned } from './fixtures';

const maxed = (extra = {}) => owned('u1', 'c102', { level: 90, exp: 9_999_999, skillLevel: 5, limitBreak: 3, awakened: 3, ...extra });

describe('進化', () => {
  it('滿級＋正確素材＋金幣：換卡號、等級歸零、保留技能與突破，覺醒截到新型態上限', () => {
    const save = makeSave([maxed(), owned('u2', 'c905'), owned('u3', 'c905'), owned('u4', 'c915')]);
    const r = evolve(save, ctx, 'u1', ['u4', 'u2', 'u3']);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.card).toMatchObject({ uid: 'u1', cardId: 'c103', level: 1, exp: 0, limitBreak: 3, awakened: 2 });
    // c103 的技能 CD 8→6，最高 3 級
    expect(r.card.skillLevel).toBe(3);
    expect(r.save.inventory.cards.map((c) => c.uid)).toEqual(['u1']);
    expect(r.save.player.coin).toBe(save.player.coin - 50000);
    expect(r.save.collection.owned).toContain('c103');
  });

  it('未滿級、素材不符、不能進化的卡會被擋下', () => {
    const save = makeSave([
      owned('u1', 'c102', { level: 89 }), owned('u2', 'c905'), owned('u3', 'c905'), owned('u4', 'c915'),
      owned('u5', 'c106', { level: 50 }), owned('u6', 'c906'),
    ]);
    const code = (r: ReturnType<typeof evolve>) => (r.ok ? 'ok' : r.error.code);
    expect(code(evolve(save, ctx, 'u1', ['u2', 'u3', 'u4']))).toBe('notMaxLevel');
    const lv90 = { ...save, inventory: { ...save.inventory, cards: save.inventory.cards.map((c) => (c.uid === 'u1' ? { ...c, level: 90 } : c)) } };
    expect(code(evolve(lv90, ctx, 'u1', ['u2', 'u3']))).toBe('wrongMaterial');
    expect(code(evolve(lv90, ctx, 'u1', ['u2', 'u6', 'u4']))).toBe('wrongMaterial');
    expect(code(evolve(lv90, ctx, 'u5', ['u2']))).toBe('cannotEvolve');
    expect(code(evolve({ ...lv90, player: { ...lv90.player, coin: 10 } }, ctx, 'u1', ['u2', 'u3', 'u4']))).toBe('notEnoughCoin');
  });

  it('自動挑素材：避開上鎖與隊伍中的卡，回報缺少的素材', () => {
    const save = makeSave([
      maxed(), owned('u2', 'c905', { locked: true }), owned('u3', 'c905'), owned('u4', 'c905'), owned('u5', 'c905'),
    ]);
    save.teams[0].members[1] = 'u4';
    expect(pickEvolutionMaterials(save, ctx, 'u1')).toEqual({ uids: ['u3', 'u5'], missing: ['c915'] });
  });
});
