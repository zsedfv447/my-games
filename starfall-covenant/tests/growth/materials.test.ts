import { describe, expect, it } from 'vitest';
import { freeCards, isMaterialFor, isStarCore, materialCandidates } from '../../src/growth';
import { ctx, makeSave, owned } from './fixtures';

const def = (id: string) => ctx.card(id)!;
const uids = (xs: { owned: { uid: string } }[]) => xs.map((x) => x.owned.uid);

describe('素材資格', () => {
  it('各養成的資格判斷', () => {
    const t = { def: def('c102'), owned: { awakened: 0 } };
    expect(isMaterialFor('enhance', t, def('c107'), ctx)).toBe(true);
    expect(isMaterialFor('skill', t, def('c103'), ctx)).toBe(true);
    expect(isMaterialFor('skill', t, def('c107'), ctx)).toBe(false);
    expect(isMaterialFor('limitBreak', t, def('c102'), ctx)).toBe(true);
    expect(isMaterialFor('limitBreak', t, def('c106'), ctx)).toBe(false);
    expect(isMaterialFor('awaken', t, def('c916'), ctx)).toBe(true);
    expect(isMaterialFor('awaken', t, def('c905'), ctx)).toBe(false);
    expect(isMaterialFor('evolve', t, def('c915'), ctx)).toBe(true);
    expect(isMaterialFor('evolve', t, def('c906'), ctx)).toBe(false);
    expect(isStarCore('c916', ctx)).toBe(true);
  });

  it('候選素材排除自己、上鎖、任何隊伍中的卡；強化不列星核', () => {
    const save = makeSave([
      owned('t', 'c102'), owned('a', 'c905'), owned('b', 'c905', { locked: true }), owned('c', 'c905'), owned('k', 'c916'), owned('s', 'c102'),
    ]);
    save.teams = [...save.teams, { name: '隊伍2', members: ['c', null, null, null, null] }];
    expect(uids(freeCards(save, 't').map((owned) => ({ owned })))).toEqual(['a', 'k', 's']);
    expect(uids(materialCandidates(save, ctx, 't', 'enhance'))).toEqual(['a', 's']);
    expect(uids(materialCandidates(save, ctx, 't', 'limitBreak'))).toEqual(['s']);
    expect(uids(materialCandidates(save, ctx, 't', 'awaken'))).toEqual(['k']);
    expect(uids(materialCandidates(save, ctx, 't', 'evolve'))).toEqual(['a']);
  });
});
