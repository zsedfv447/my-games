import { describe, expect, it } from 'vitest';
import { gameData } from '../src/data/load';
import { validateHelperBonds } from '../src/data/validate';
import { createNewSave } from '../src/save/save';
import {
  addBondOnClear, BOND_TIERS, bondLevel, bondPoints, hasBondFrame, HELPER_BONDS, nextBondTier, npcForHelperCard,
} from '../src/progression/helper-bond';
import { HELPER_NPCS } from '../src/progression/helpers';

const fresh = () => createNewSave(gameData.config, 0);

describe('同行情誼', () => {
  it('舊存檔沒有欄位時讀成 0 點', () => {
    const save = fresh();
    expect(save.helperBond).toBeUndefined();
    expect(bondPoints(save, 'npc-mono')).toBe(0);
  });

  it('通關一次加 1 點，只加在借用的 NPC 身上', () => {
    const r = addBondOnClear(fresh(), 'npc-mono');
    expect(r.before).toBe(0);
    expect(r.after).toBe(1);
    expect(bondPoints(r.save, 'npc-mono')).toBe(1);
    expect(bondPoints(r.save, 'npc-heart')).toBe(0);
  });

  it('到 5、10、20 點各解鎖一次，不會重複解鎖', () => {
    let save = fresh();
    const unlockedAt: [number, number][] = [];
    for (let i = 0; i < 25; i++) {
      const r = addBondOnClear(save, 'npc-combo');
      save = r.save;
      for (const t of r.unlocked) unlockedAt.push([r.after, t]);
    }
    expect(unlockedAt).toEqual([[5, 0], [10, 1], [20, 2]]);
    expect(bondPoints(save, 'npc-combo')).toBe(25);
  });

  it('門檻、下一個門檻與頭像框', () => {
    expect([0, 4, 5, 9, 10, 19, 20, 99].map(bondLevel)).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
    expect(nextBondTier(0)).toBe(5);
    expect(nextBondTier(5)).toBe(10);
    expect(nextBondTier(19)).toBe(20);
    expect(nextBondTier(20)).toBeNull();
    expect(hasBondFrame(19)).toBe(false);
    expect(hasBondFrame(BOND_TIERS[BOND_TIERS.length - 1])).toBe(true);
  });

  it('由助戰卡找回 NPC；每張助戰卡只屬於一位 NPC', () => {
    expect(npcForHelperCard('c106', HELPER_NPCS)?.id).toBe('npc-mono');
    expect(npcForHelperCard('c999', HELPER_NPCS)).toBeUndefined();
    const cards = HELPER_NPCS.flatMap((n) => n.tiers.map((t) => t.card));
    expect(new Set(cards).size).toBe(cards.length);
  });
});

describe('情誼資料', () => {
  it('12 位 NPC 各 3 段劇情、3 句感謝台詞，通過驗證', () => {
    expect(validateHelperBonds(HELPER_BONDS, HELPER_NPCS)).toEqual([]);
    expect(HELPER_BONDS.length).toBe(HELPER_NPCS.length);
  });

  it('驗證會擋下缺漏與過長的資料', () => {
    const broken = [{ ...HELPER_BONDS[0], thanks: ['好', '這一句台詞寫得非常非常長，長到超過結算畫面可以放得下的字數上限了吧', ''] }, { ...HELPER_BONDS[1], stories: HELPER_BONDS[1].stories.slice(0, 2) }];
    const errors = validateHelperBonds(broken, HELPER_NPCS);
    expect(errors.some((e) => e.includes('超過'))).toBe(true);
    expect(errors.some((e) => e.includes('是空的'))).toBe(true);
    expect(errors.some((e) => e.includes('劇情要有 3 段'))).toBe(true);
    expect(errors.some((e) => e.includes('npc-heart 沒有情誼資料'))).toBe(true);
  });
});
