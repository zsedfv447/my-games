import { describe, expect, it } from 'vitest';
import type { LeaderSkillDef } from '../src/core/types';
import { canEvolveNow, skillCooldown } from '../src/growth';
import { applyBagFilter, emptyBagFilter, activeFilterCount } from '../src/ui/screens/bag-view';
import { leaderFit, previewSwap } from '../src/ui/team-compare';
import { teamTotals } from '../src/ui/team-summary';
import { ctx, makeSave, owned } from './growth/fixtures';

const card = (id: string) => ctx.card(id)!;
const leaderOf = (c: { leaderSkill?: string }) => (c.leaderSkill ? ctx.leaderSkill(c.leaderSkill) : undefined);
const cd = (c: Parameters<typeof skillCooldown>[0], lv: number) => skillCooldown(c, lv, ctx);
const m = (id: string, level = 1) => ({ card: card(id), level });

describe('換隊員時的比較', () => {
  it('增減等於換上前後 teamTotals 的差，Cost 也一起算', () => {
    const members = [m('c106'), m('c108'), m('c206'), null, null];
    const p = previewSwap(members, 1, { ...m('c107'), skillLevel: 1 }, leaderOf, cd);
    const before = teamTotals([m('c106'), m('c108'), m('c206')], leaderOf);
    const after = teamTotals([m('c106'), m('c107'), m('c206')], leaderOf);
    expect([p.dHp, p.dRcv]).toEqual([after.hp - before.hp, after.rcv - before.rcv]);
    expect(p.dCost).toBe(card('c107').cost - card('c108').cost);
    expect(p.cooldown).toBe(skillCooldown(card('c107'), 1, ctx));
    // 空位放卡：Cost 增加整張卡的 Cost
    expect(previewSwap(members, 3, { ...m('c107'), skillLevel: 1 }, leaderOf, cd).dCost).toBe(card('c107').cost);
  });

  it('看得出吃不吃得到隊長技：同屬性吃得到，別的屬性吃不到', () => {
    const mono = ctx.leaderSkill('l-mono-fire');
    expect(leaderFit(card('c107'), mono).boosts).toEqual(['攻擊 ×3']);
    expect(leaderFit(card('c206'), mono).boosts).toEqual([]);
    const berserk = ctx.leaderSkill('l-berserk');
    expect(leaderFit(card('c206'), berserk).boosts[0]).toContain('條件達成時');
  });

  it('會破壞「全隊」條件的卡會被標出來', () => {
    const allFire: LeaderSkillDef = {
      id: 'x', name: 'x', description: '',
      rules: [{ conditions: [{ type: 'teamAll', filter: { attribute: 'fire' } }], effects: [{ type: 'atkMultiplier', value: 4 }] }],
    };
    expect(leaderFit(card('c206'), allFire)).toEqual({ boosts: [], breaksTeamAll: 1 });
    expect(leaderFit(card('c107'), allFire)).toEqual({ boosts: ['攻擊 ×4'], breaksTeamAll: 0 });
  });

  it('換隊長時用新隊長的隊長技判斷', () => {
    const p = previewSwap([m('c206'), m('c107')], 0, { ...m('c106'), skillLevel: 1 }, leaderOf, cd);
    expect(p.leader.boosts).toEqual(['攻擊 ×3']);
  });
});

describe('背包：搜尋、類別、進化篩選', () => {
  const save = makeSave([
    owned('a', 'c102', { level: 90 }), owned('b', 'c102'), owned('m1', 'c905'), owned('m2', 'c905'), owned('m3', 'c915'), owned('w', 'c206'),
  ]);
  const ids = (f: Partial<ReturnType<typeof emptyBagFilter>>) => applyBagFilter(save, ctx, { ...emptyBagFilter(), ...f }).map((c) => c.uid);

  it('卡名搜尋與角色／素材分類', () => {
    expect(ids({ text: 'c206' })).toEqual(['w']);
    expect(ids({ kind: 'material' })).toEqual(['m1', 'm2', 'm3']);
    expect(ids({ kind: 'unit' })).toEqual(['a', 'b', 'w']);
  });

  it('有進化路線／現在可以進化（用 evolve 檢查：滿級、素材、金幣）', () => {
    expect(ids({ evolvable: true })).toEqual(['a', 'b']);
    expect(ids({ evolveReady: true })).toEqual(['a']);
    expect(canEvolveNow(save, ctx, 'b')).toBe(false);
    expect(canEvolveNow({ ...save, player: { ...save.player, coin: 0 } }, ctx, 'a')).toBe(false);
  });

  it('篩選數包含搜尋與新篩選', () => {
    expect(activeFilterCount({ ...emptyBagFilter(), text: ' 焰 ', kind: 'unit', evolveReady: true })).toBe(3);
  });
});
