import { describe, expect, it } from 'vitest';
import { gameData } from '../src/data/load';
import { validateCardBonds } from '../src/data/validate';
import { createGrowthContext } from '../src/growth/context';
import { createNewSave } from '../src/save/save';
import { addPoint, nextTierOf, tiersReached } from '../src/progression/bond-tiers';
import {
  addCardBondsOnClear, CARD_BOND_TIERS, CARD_BONDS, cardBondLevel, cardBondPoints, nextCardBondTier, teamFamilies,
} from '../src/progression/card-bond';

const ctx = createGrowthContext(gameData);
const fresh = () => createNewSave(gameData.config, 0);
const withCards = (ids: string[]) => {
  const s = fresh();
  const cards = ids.map((cardId, i) => ({ ...s.inventory.cards[0], uid: `u${i}`, cardId }));
  return { ...s, inventory: { ...s.inventory, cards } };
};

describe('共用羈絆門檻', () => {
  it('門檻、下一個門檻與跨門檻只解鎖一次', () => {
    expect(tiersReached([10, 30], 29)).toBe(1);
    expect(nextTierOf([10, 30], 30)).toBeNull();
    let map: Record<string, number> | undefined;
    const hits: number[][] = [];
    for (let i = 0; i < 35; i++) {
      const g = addPoint(map, 'a', [10, 30]);
      map = g.map;
      if (g.unlocked.length) hits.push([g.after, ...g.unlocked]);
    }
    expect(hits).toEqual([[10, 0], [30, 1]]);
  });
});

describe('角色羈絆', () => {
  it('舊存檔沒有欄位時讀成 0', () => {
    expect(fresh().cardBond).toBeUndefined();
    expect(cardBondPoints(fresh(), 'c106')).toBe(0);
  });

  it('進化前後算同一位，同家族在隊上兩張也只算一次', () => {
    const save = withCards(['c109', 'c110', 'c106']);
    expect(teamFamilies(save, ['u0', 'u1', 'u2'], ctx.family)).toEqual(['c109', 'c106']);
    expect(teamFamilies(save, ['u0', 'missing'], ctx.family)).toEqual(['c109']);
  });

  it('通關一場每個家族 +1，10、30 場各解鎖一次', () => {
    let save = fresh();
    const unlocked: [number, number][] = [];
    for (let i = 0; i < 31; i++) {
      const r = addCardBondsOnClear(save, ['c109', 'c106']);
      save = r.save;
      for (const g of r.gains.filter((x) => x.family === 'c109')) for (const t of g.unlocked) unlocked.push([g.after, t]);
    }
    expect(unlocked).toEqual([[10, 0], [30, 1]]);
    expect(cardBondPoints(save, 'c106')).toBe(31);
    expect(cardBondPoints(save, 'c206')).toBe(0);
  });

  it('沒有隊員（借用隊伍）時存檔不變', () => {
    const save = fresh();
    expect(addCardBondsOnClear(save, []).save).toBe(save);
  });

  it('門檻函式', () => {
    expect(CARD_BOND_TIERS).toEqual([10, 30]);
    expect([0, 9, 10, 29, 30].map(cardBondLevel)).toEqual([0, 0, 1, 1, 2]);
    expect(nextCardBondTier(10)).toBe(30);
  });
});

describe('羈絆小劇場資料', () => {
  it('所有 5★ 以上角色與新卡都有小劇場，每個流派都有代表，通過驗證', () => {
    expect(validateCardBonds(CARD_BONDS, gameData.cards)).toEqual([]);
    const families = new Set(CARD_BONDS.map((b) => b.family));
    const evolvedInto = new Set(gameData.cards.flatMap((c) => (c.evolution ? [c.evolution.to] : [])));
    const roots = gameData.cards.filter((c) => c.race !== 'material' && !evolvedInto.has(c.id));
    for (const c of roots.filter((r) => r.rarity >= 5)) expect(families.has(c.id), c.id).toBe(true);
    for (const id of ['c606', ...Array.from({ length: 11 }, (_, i) => `c7${String(i + 1).padStart(2, '0')}`)]) expect(families.has(id), id).toBe(true);
    const archetypes = new Set(CARD_BONDS.flatMap((b) => gameData.cards.find((c) => c.id === b.family)!.archetypes.filter((a) => a.role === 'leader').map((a) => a.id)));
    expect(archetypes.size).toBe(12);
  });

  it('驗證會擋下進化後的卡號與句數不對的劇場', () => {
    const errors = validateCardBonds([{ ...CARD_BONDS[0], family: 'c110' }, { ...CARD_BONDS[1], scenes: [CARD_BONDS[1].scenes[0]] }], gameData.cards);
    expect(errors.some((e) => e.includes('最初型態'))).toBe(true);
    expect(errors.some((e) => e.includes('要有 2 段'))).toBe(true);
  });
});
