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
      story: { before: 'prologue', after: 'no-such-story' },
    });
    const errors = validateGameData(broken);
    expect(errors).toContain('stages/st-x: 解鎖條件關卡 nope 不存在');
    expect(errors).toContain('stages/st-x: 找不到敵人 missing');
    expect(errors).toContain('stages/st-x: 劇情 after 引用的 no-such-story 不存在');
    expect(errors.some((e) => e.includes('prologue'))).toBe(false);
  });

  it('提案 003 的劇情都已寫入', () => {
    const ids = ['prologue', 'ch4-stars', 'tower-30', 'ev-beast-end'];
    for (let ch = 1; ch <= 5; ch++) for (const part of ['open', 'mid', 'boss', 'end']) ids.push(`ch${ch}-${part}`);
    for (let n = 1; n <= 5; n++) ids.push(`ev-beast-${n}`);
    for (const id of ids) expect(gameData.story[id]?.length, id).toBeGreaterThan(0);
  });
});
