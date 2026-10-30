import { describe, expect, it } from 'vitest';
import {
  addCards, claimAllCollectionRewards, claimCollectionReward, claimableCollection, collectionSummary,
  computeStats, expandInventory, filterCards, inventoryUsage, inventoryWarning, markSeen, previewSell, sellCards, sellPrice, setLocked, sortCards,
} from '../../src/growth';
import { ctx, makeSave, owned } from './fixtures';

describe('背包：加入卡片', () => {
  it('產生不重複 uid、記錄圖鑑，放不下的回傳 overflow', () => {
    const save = { ...makeSave([owned('u7', 'c905')]), inventory: { capacity: 3, cards: [owned('u7', 'c905')] } };
    const r = addCards(save, ctx, ['c106', { card: 'c107', level: 5 }, 'c206'], 123);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.added.map((c) => c.uid)).toEqual(['u8', 'u9']);
    expect(r.added[1]).toMatchObject({ level: 5, obtainedAt: 123 });
    expect(r.added[1].exp).toBeGreaterThan(0);
    expect(r.overflow).toEqual(['c206']);
    expect(r.save.collection.owned).toEqual(expect.arrayContaining(['c106', 'c107']));
    expect(r.save.collection.owned).not.toContain('c206');
    expect(r.save.collection.seen).toContain('c206');
    expect(inventoryUsage(r.save)).toEqual({ used: 3, capacity: 3, free: 0 });
  });

  it('未知卡號回報錯誤', () => {
    expect(addCards(makeSave(), ctx, ['nope'], 0)).toMatchObject({ ok: false, error: { code: 'unknownCard' } });
  });
});

describe('背包：上鎖、擴充、販賣', () => {
  it('上鎖與解鎖', () => {
    const save = makeSave([owned('u1', 'c106'), owned('u2', 'c107')]);
    const r = setLocked(save, ['u1', 'u2'], true);
    expect(r.ok && r.save.inventory.cards.every((c) => c.locked)).toBe(true);
    expect(setLocked(save, 'zz', true).ok).toBe(false);
  });

  it('用星晶擴充，有上限', () => {
    const save = makeSave();
    const r = expandInventory(save, ctx, 2);
    expect(r.ok && [r.capacity, r.gems, r.save.player.gems]).toEqual([60, 2, 98]);
    expect(expandInventory({ ...save, player: { ...save.player, gems: 0 } }, ctx)).toMatchObject({ error: { code: 'notEnoughGems' } });
    expect(expandInventory({ ...save, inventory: { ...save.inventory, capacity: 300 } }, ctx)).toMatchObject({ error: { code: 'capacityMax' } });
  });

  it('批次販賣：等級越高越值錢；上鎖或在隊伍中整批拒絕', () => {
    const save = makeSave([owned('u1', 'c106', { level: 21 }), owned('u2', 'c905'), owned('u3', 'c107', { locked: true }), owned('u4', 'c108')]);
    save.teams[0].members[0] = 'u4';
    expect(sellPrice({ level: 21 }, ctx.card('c106')!, ctx)).toBe(400);
    const r = sellCards(save, ctx, ['u1', 'u2'], { confirmHighRarity: true });
    expect(r.ok && [r.coin, r.save.inventory.cards.length]).toEqual([450, 2]);
    expect(sellCards(save, ctx, ['u1', 'u3'])).toMatchObject({ ok: false, error: { code: 'cardLocked', subject: 'u3' } });
    expect(sellCards(save, ctx, ['u4'])).toMatchObject({ ok: false, error: { code: 'cardInTeam' } });
  });

  it('4★ 以上的卡販賣要二次確認', () => {
    const save = makeSave([owned('u1', 'c106'), owned('u2', 'c905')]);
    expect(sellCards(save, ctx, ['u1', 'u2'])).toMatchObject({ ok: false, error: { code: 'confirmRequired', subject: 'u1' } });
    const r = sellCards(save, ctx, ['u1', 'u2'], { confirmHighRarity: true });
    expect(r.ok && r.save.inventory.cards).toEqual([]);
    expect(sellCards(save, ctx, ['u2']).ok).toBe(true);
  });

  it('Lv1 的卡賣價等於 sellValue 總和；任一張不能賣就整批不賣、存檔不變', () => {
    const save = makeSave([owned('a', 'c905'), owned('b', 'c906'), owned('c', 'c915'), owned('d', 'c108'), owned('e', 'c905', { locked: true })]);
    save.teams = [...save.teams, { name: '隊伍2', members: ['d', null, null, null, null] }];
    const sum = ['c905', 'c906', 'c915'].reduce((n, id) => n + ctx.card(id)!.sellValue, 0);
    const ok = sellCards(save, ctx, ['a', 'b', 'c'], { confirmHighRarity: true });
    expect(ok.ok && ok.coin).toBe(sum);
    expect(ok.ok && ok.save.player.coin).toBe(save.player.coin + sum);
    // 不在出戰中的其他隊伍也算隊伍中的卡
    expect(sellCards(save, ctx, ['a', 'd'])).toMatchObject({ ok: false, error: { code: 'cardInTeam', subject: 'd' } });
    expect(sellCards(save, ctx, ['a', 'e'])).toMatchObject({ ok: false, error: { code: 'cardLocked', subject: 'e' } });
    expect(save.inventory.cards).toHaveLength(5);
  });

  it('販賣預覽：排除上鎖與隊伍中的卡，標出高星卡，不改存檔', () => {
    const save = makeSave([
      owned('u1', 'c106', { level: 21 }), owned('u2', 'c102'), owned('u3', 'c107', { locked: true }), owned('u4', 'c108'),
    ]);
    save.teams[0].members[0] = 'u4';
    const p = previewSell(save, ctx, ['u1', 'u2', 'u3', 'u4', 'u1', 'nope']);
    expect(p.sellable).toEqual(['u1', 'u2']);
    expect(p.blocked).toEqual([{ uid: 'u3', reason: 'locked' }, { uid: 'u4', reason: 'inTeam' }]);
    expect(p.coin).toBe(400 + 200);
    expect(p.highRarity).toEqual(['u1', 'u2']);
    expect(p.needsConfirm).toBe(true);
    expect(save.inventory.cards).toHaveLength(4);
  });

  it('背包快滿與已滿的提醒', () => {
    const cards = Array.from({ length: 45 }, (_, i) => owned(`u${i}`, 'c905'));
    const save = makeSave(cards);
    expect(inventoryWarning(save, ctx)).toBe('almostFull');
    expect(inventoryWarning(makeSave(cards.slice(0, 44)), ctx)).toBe(null);
    expect(inventoryWarning({ ...save, inventory: { ...save.inventory, capacity: 45 } }, ctx)).toBe('full');
  });
});

describe('背包：篩選與排序', () => {
  const save = makeSave([
    owned('u1', 'c106', { level: 30, obtainedAt: 3 }),
    owned('u2', 'c102', { level: 10, obtainedAt: 1 }),
    owned('u3', 'c211', { obtainedAt: 2, locked: true }),
    owned('u4', 'c905', { obtainedAt: 4 }),
  ]);
  const uids = (list: { uid: string }[]) => list.map((c) => c.uid);

  it('依屬性、稀有度、流派、角色、上鎖、素材篩選', () => {
    expect(uids(filterCards(save, ctx, { attribute: ['fire'] }))).toEqual(['u1', 'u2', 'u4']);
    expect(uids(filterCards(save, ctx, { rarity: [5, 6] }))).toEqual(['u2']);
    expect(uids(filterCards(save, ctx, { archetype: ['chain'] }))).toEqual(['u2']);
    expect(uids(filterCards(save, ctx, { role: ['leader'] }))).toEqual(['u1', 'u2']);
    expect(uids(filterCards(save, ctx, { archetype: ['combo'], role: ['leader'] }))).toEqual([]);
    expect(uids(filterCards(save, ctx, { locked: true }))).toEqual(['u3']);
    expect(uids(filterCards(save, ctx, { material: false, minLevel: 10 }))).toEqual(['u1', 'u2']);
    expect(uids(filterCards(save, ctx, { evolvable: true }))).toEqual(['u2']);
  });

  it('依取得時間、稀有度、等級、能力值排序', () => {
    const cards = save.inventory.cards;
    expect(uids(sortCards(cards, ctx, 'obtainedAt'))).toEqual(['u4', 'u1', 'u3', 'u2']);
    expect(uids(sortCards(cards, ctx, 'obtainedAt', 'asc'))).toEqual(['u2', 'u3', 'u1', 'u4']);
    expect(uids(sortCards(cards, ctx, 'rarity')).slice(0, 1)).toEqual(['u2']);
    expect(uids(sortCards(cards, ctx, 'level'))[0]).toBe('u1');
    const stats = (c: typeof cards[number], def: Parameters<typeof computeStats>[0]) => computeStats(def, c, ctx.rules);
    expect(uids(sortCards(filterCards(save, ctx, { material: false }), ctx, 'atk', 'desc', stats))).toEqual(['u1', 'u2', 'u3']);
  });
});

describe('圖鑑', () => {
  it('第一次擁有可領星晶，只能領一次', () => {
    let save = makeSave([owned('u1', 'c102'), owned('u2', 'c106')]);
    expect(claimableCollection(save, ctx)).toEqual(['c102', 'c106']);
    const one = claimCollectionReward(save, ctx, 'c102');
    expect(one.ok && one.gems).toBe(3);
    if (!one.ok) return;
    save = one.save;
    expect(claimCollectionReward(save, ctx, 'c102')).toMatchObject({ error: { code: 'alreadyClaimed' } });
    expect(claimCollectionReward(save, ctx, 'c206')).toMatchObject({ error: { code: 'notOwned' } });
    const all = claimAllCollectionRewards(save, ctx);
    expect(all.ok && [all.gems, all.cards, all.save.player.gems]).toEqual([1, ['c106'], 104]);
  });

  it('統計見過、擁有與各稀有度進度', () => {
    const save = markSeen(makeSave([owned('u1', 'c102'), owned('u2', 'c905')]), ['c206']);
    const s = collectionSummary(save, ctx);
    expect(s).toMatchObject({ total: 11, owned: 2, seen: 3, materials: { owned: 1, total: 4 } });
    expect(s.byRarity[5]).toEqual({ owned: 1, total: 1 });
  });
});
