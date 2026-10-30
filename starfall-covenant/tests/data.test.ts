import { describe, expect, it } from 'vitest';
import { gameData } from '../src/data/load';
import { validateGameData } from '../src/data/validate';

describe('遊戲資料', () => {
  it('data/*.json 全部通過驗證', () => {
    expect(validateGameData(gameData)).toEqual([]);
  });

  it('能抓到錯誤的交叉引用', () => {
    const broken = structuredClone(gameData);
    broken.stages.push({
      id: 'st-x', kind: 'main', name: 'x', stamina: 1, unlockAfter: 'nope',
      waves: [{ enemies: ['missing'] }], rewards: { coin: 0, playerExp: 0 }, drops: [],
    });
    const errors = validateGameData(broken);
    expect(errors).toContain('stages/st-x: 解鎖條件關卡 nope 不存在');
    expect(errors).toContain('stages/st-x: 找不到敵人 missing');
  });
});
