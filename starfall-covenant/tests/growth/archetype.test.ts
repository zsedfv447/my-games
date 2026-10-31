import { describe, expect, it } from 'vitest';
import { analyzeTeam, archetypeCodex, cardSources, isFreeToObtain, leaderTeamFilter } from '../../src/growth';
import { ctx, makeSave, owned } from './fixtures';

describe('取得途徑', () => {
  it('掉落、首通、卡池與進化來源', () => {
    expect(cardSources(ctx, 'c106')).toMatchObject({ stages: ['st-1-1'], gacha: [] });
    expect(cardSources(ctx, 'c108').stages).toEqual(['st-1-1']);
    expect(cardSources(ctx, 'c103')).toMatchObject({ evolvesFrom: 'c102', stages: [] });
    expect(isFreeToObtain(ctx, 'c106')).toBe(true);
    expect(isFreeToObtain(ctx, 'c102')).toBe(false);
    expect(isFreeToObtain(ctx, 'c103')).toBe(false);
  });
});

describe('流派圖鑑', () => {
  it('列出每個流派的卡、擁有狀況、免抽隊長與是否已能組隊', () => {
    const save = makeSave([owned('u1', 'c102'), owned('u2', 'c206'), owned('u3', 'c211')]);
    const codex = archetypeCodex(save, ctx);
    expect(codex).toHaveLength(15);
    const chain = codex.find((e) => e.id === 'chain')!;
    expect(chain.cards.map((c) => c.cardId)).toEqual(['c102', 'c103', 'c107']);
    // c103 沒擁有，但同鏈的 c102 有
    expect(chain.cards.find((c) => c.cardId === 'c103')).toMatchObject({ owned: false, ownedFamily: true });
    expect(codex.find((e) => e.id === 'mono')).toMatchObject({ hasFreeLeader: true, playable: false, owned: 0, total: 1 });
    expect(codex.find((e) => e.id === 'combo')).toMatchObject({ playable: true, owned: 2 });
    expect(codex.find((e) => e.id === 'berserk')).toMatchObject({ hasFreeLeader: false, playable: false });
  });
});

describe('隊伍流派提示', () => {
  it('從隊長技推出隊伍條件', () => {
    expect(leaderTeamFilter(ctx, ctx.card('c106')!)).toEqual({ attribute: ['fire'] });
    expect(leaderTeamFilter(ctx, ctx.card('c102')!)).toBeUndefined();
  });

  it('單屬隊：屬性不符的成員被標為不搭，並推薦背包裡的同屬卡', () => {
    const save = makeSave([
      owned('u1', 'c106'), owned('u2', 'c107'), owned('u3', 'c211'), owned('u4', 'c102', { level: 50 }), owned('u5', 'c905'),
    ]);
    const r = analyzeTeam(save, ctx, ['u1', 'u2', 'u3', null, null], 'c106');
    expect(r.primary).toBe('mono');
    expect(r.filter).toEqual({ attribute: ['fire'] });
    expect(r.members.map((m) => [m.cardId, m.fits])).toEqual([['c106', true], ['c107', true], ['c211', false], ['c106', true]]);
    expect(r.members[2].reasons[0]).toContain('焰屬性');
    expect(r.members[3].isHelper).toBe(true);
    expect(r.completion).toBe(0.75);
    expect(r.suggestions).toEqual(['u4']);
  });

  it('非單屬流派：沒有流派標籤的卡不搭，通用輔助算搭，並回報缺少的角色', () => {
    const save = makeSave([owned('u1', 'c206'), owned('u2', 'c108'), owned('u3', 'c107'), owned('u4', 'c211')]);
    const r = analyzeTeam(save, ctx, ['u1', 'u2', 'u3']);
    expect(r.primary).toBe('combo');
    expect(r.members.map((m) => [m.cardId, m.fits, m.role])).toEqual([
      ['c206', true, 'leader'], ['c108', true, 'support'], ['c107', false, null],
    ]);
    expect(r.members[2].reasons).toEqual(['不屬於「連擊狂潮」流派']);
    expect(r.missingRoles).toEqual(['core']);
    expect(r.suggestions).toEqual(['u4']);
    expect(r.secondary).not.toBe('combo');
  });

  it('空隊伍', () => {
    expect(analyzeTeam(makeSave(), ctx, [null])).toMatchObject({ primary: null, members: [], completion: 0 });
  });
});
