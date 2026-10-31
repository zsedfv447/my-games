import { describe, expect, it } from 'vitest';
import type { SaveData } from '../src/core/types';
import { gameData } from '../src/data/load';
import { createNewSave } from '../src/save/save';
import { createGrowthContext, enhance, previewSell } from '../src/growth';
import { freeCards } from '../src/growth/materials';
import {
  claimExpedition, dispatch, dispatchProblem, EXPEDITION, expeditionReward, expeditionUnits, hasReturned, openChapters, recallExpedition,
} from '../src/progression/expedition';

const ctx = createGrowthContext(gameData);
const card = (id: string) => gameData.cards.find((c) => c.id === id);
const HOUR = 3_600_000;
const NOW = new Date(2026, 10, 2, 12).getTime();
const ch = (n: number) => gameData.stages.filter((s) => s.kind === 'main' && s.chapter === n).map((s) => s.id);

/** 通過第 1 章，另外有 3 張不在隊伍裡的卡（u10 獸裔、u11、u12）和 1 張上鎖的卡 */
function setup(): SaveData {
  const s = createNewSave(gameData.config, NOW);
  const extra = [
    { uid: 'u10', cardId: 'c109' }, { uid: 'u11', cardId: 'c206' }, { uid: 'u12', cardId: 'c306' },
    { uid: 'u13', cardId: 'c209', locked: true }, { uid: 'u14', cardId: 'c901' },
  ].map((c) => ({ ...s.inventory.cards[0], locked: false, ...c }));
  return {
    ...s,
    inventory: { ...s.inventory, cards: [...s.inventory.cards, ...extra] },
    progress: { ...s.progress, clearedStages: ch(1) },
  };
}
const go = (save: SaveData, uids: string[], hours = 8, chapter = 1) =>
  dispatch(save, { chapter, uids, hours }, gameData.chapters, gameData.stages, card, NOW);

describe('星靈遠行：出發條件', () => {
  it('只能去已通關的章節', () => {
    expect(openChapters(setup(), gameData.chapters, gameData.stages).map((c) => c.chapter)).toEqual([1]);
    expect(dispatchProblem(setup(), { chapter: 2, uids: ['u10'], hours: 8 }, gameData.chapters, gameData.stages, card)).toBe('chapterLocked');
  });

  it('不能派隊伍中、上鎖、素材、重複或已在遠行的卡；時間與人數有限制', () => {
    const p = (uids: string[], hours = 8) => dispatchProblem(setup(), { chapter: 1, uids, hours }, gameData.chapters, gameData.stages, card);
    expect(p(['u1'])).toBe('inTeam');
    expect(p(['u13'])).toBe('locked');
    expect(p(['u14'])).toBe('material');
    expect(p(['u10', 'u10'])).toBe('duplicated');
    expect(p([])).toBe('memberCount');
    expect(p(['u10', 'u11', 'u12', 'u1'])).toBe('memberCount');
    expect(p(['u10'], 3)).toBe('badHours');
    const r = go(setup(), ['u10']);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(dispatchProblem(r.save, { chapter: 1, uids: ['u10'], hours: 2 }, gameData.chapters, gameData.stages, card)).toBe('onExpedition');
  });

  it(`最多同時 ${EXPEDITION.maxParties} 隊`, () => {
    let s = setup();
    for (const uid of ['u10', 'u11', 'u12']) {
      const r = go(s, [uid]);
      expect(r.ok).toBe(true);
      if (r.ok) s = r.save;
    }
    s = { ...s, inventory: { ...s.inventory, cards: [...s.inventory.cards, { ...s.inventory.cards[0], uid: 'u20', cardId: 'c406' }] } };
    expect(dispatchProblem(s, { chapter: 1, uids: ['u20'], hours: 2 }, gameData.chapters, gameData.stages, card)).toBe('tooManyParties');
  });
});

describe('星靈遠行：時間與收穫', () => {
  it('時間到了才能領，領完卡片回來；提前召回沒有收穫', () => {
    const r = go(setup(), ['u10', 'u11'], 4);
    if (!r.ok) throw new Error('dispatch failed');
    expect(hasReturned(r.expedition, NOW + 4 * HOUR - 1)).toBe(false);
    expect(claimExpedition(r.save, r.expedition.id, NOW + 4 * HOUR - 1, gameData.chapters, card, gameData.config)).toEqual({ ok: false, reason: 'notReturned' });
    const done = claimExpedition(r.save, r.expedition.id, NOW + 4 * HOUR, gameData.chapters, card, gameData.config);
    expect(done.ok).toBe(true);
    if (!done.ok) return;
    expect(done.save.expeditions).toEqual([]);
    expect(done.save.player.coin).toBe(r.save.player.coin + done.reward.coin!);
    expect(done.reward).not.toHaveProperty('gems');
    const back = recallExpedition(r.save, r.expedition.id);
    expect(back.expeditions).toEqual([]);
    expect(back.player.coin).toBe(r.save.player.coin);
  });

  it('人數與種族加成：獸裔去獸座 +50%', () => {
    expect(expeditionUnits(8, ['human'], 'beast')).toBe(8);
    expect(expeditionUnits(8, ['human', 'human', 'human'], 'beast')).toBe(12);
    expect(expeditionUnits(8, ['beast'], 'beast')).toBe(12);
    expect(expeditionUnits(8, ['beast', 'human'], 'beast')).toBeCloseTo(8 * 1.25 * 1.25);
  });

  it('收穫固定（同一趟重算結果一樣），只有金幣、塵靈與星核，沒有星晶與星輝結晶', () => {
    const e = { id: 'x', chapter: 1, uids: ['u10', 'u11', 'u12'], hours: 8, startedAt: NOW };
    const members = ['c109', 'c206', 'c306'].map((id) => card(id)!);
    const a = expeditionReward(e, members, 'beast');
    expect(expeditionReward(e, members, 'beast')).toEqual(a);
    expect(a.gems).toBeUndefined();
    const allowed = new Set(['c901', 'c902', 'c903', 'c916']);
    for (const c of a.cards ?? []) expect(allowed.has(c.card), c.card).toBe(true);
  });

  it('一天的收穫約等於一次每日關卡：3 隊 × 3 張 × 8 小時 × 2 輪，不加種族', () => {
    let coin = 0;
    let exp = 0;
    const members = ['c406', 'c409', 'c209'].map((id) => card(id)!);
    for (let i = 0; i < 600; i++) {
      const r = expeditionReward({ id: 'x', chapter: 1, uids: ['a', 'b', 'c'], hours: 8, startedAt: NOW + i * 7919 }, members, 'beast');
      coin += r.coin ?? 0;
      for (const c of r.cards ?? []) exp += (card(c.card)!.expValue ?? 0) * c.count;
    }
    // 600 趟 = 100 天（每天 6 趟）
    const perDay = { coin: coin / 100, exp: exp / 100 };
    expect(perDay.coin).toBeGreaterThan(2000);
    expect(perDay.coin).toBeLessThan(3000);
    // 每日關卡高級約 8,800 經驗（0.8 微光＋0.4 燭光＋0.3 烈光）
    expect(perDay.exp).toBeGreaterThan(6000);
    expect(perDay.exp).toBeLessThan(12000);
  });
});

describe('遠行中的卡在養成被擋住', () => {
  const away = () => {
    const r = go(setup(), ['u10', 'u11']);
    if (!r.ok) throw new Error('dispatch failed');
    return r.save;
  };

  it('不能強化（當目標）也不能當素材', () => {
    const s = { ...away(), player: { ...away().player, coin: 1e7 } };
    const asTarget = enhance(s, ctx, 'u10', ['u12']);
    expect(asTarget.ok).toBe(false);
    if (!asTarget.ok) expect(asTarget.error.code).toBe('cardOnExpedition');
    const asMaterial = enhance(s, ctx, 'u12', ['u11']);
    expect(asMaterial.ok).toBe(false);
    if (!asMaterial.ok) expect(asMaterial.error.code).toBe('materialOnExpedition');
    expect(freeCards(s).map((c) => c.uid)).not.toContain('u10');
  });

  it('不能販賣', () => {
    const p = previewSell(away(), ctx, ['u10', 'u12']);
    expect(p.sellable).toEqual(['u12']);
    expect(p.blocked).toEqual([{ uid: 'u10', reason: 'expedition' }]);
  });
});
