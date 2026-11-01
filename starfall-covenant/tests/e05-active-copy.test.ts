import { describe, expect, it } from 'vitest';
import { gameData } from '../src/data/load';

const cases = [
  {
    id: 's103', description: '扣除目前生命 50%（至少保留 1 點生命），把潮珠轉為焰珠，1 回合內全隊攻擊力 2 倍。',
    cooldown: { max: 10, min: 5 },
    effects: [{ type: 'selfDamage', percentCurrentHp: 50 }, { type: 'convertOrbs', from: 'water', to: 'fire' }, { type: 'buffAttack', multiplier: 2, turns: 1 }],
  },
  {
    id: 's110', description: '扣除目前生命 30%（至少保留 1 點生命），1 回合內全隊攻擊力 1.5 倍，並在 1 回合內獲得一次致命傷害保命效果（觸發時保留 1 點生命）。',
    cooldown: { max: 8, min: 4 },
    effects: [{ type: 'selfDamage', percentCurrentHp: 30 }, { type: 'surviveOnce', turns: 1 }, { type: 'buffAttack', multiplier: 1.5, turns: 1 }],
  },
  {
    id: 's205', description: '把焰珠轉為潮珠、蝕珠轉為輝珠，並強化全部潮珠與輝珠。',
    cooldown: { max: 11, min: 6 },
    effects: [{ type: 'convertOrbs', from: 'fire', to: 'water' }, { type: 'convertOrbs', from: 'dark', to: 'light' }, { type: 'enhanceOrbs', orbs: ['water', 'light'] }],
  },
  {
    id: 's305', description: '對全體敵人造成 50000 固定傷害（無視防禦與護盾），回復生命上限 15%，並把蝕珠轉為心珠。',
    cooldown: { max: 12, min: 7 },
    effects: [{ type: 'damage', target: 'all', mode: 'fixed', value: 50000, ignoreDefense: true, ignoreShield: true }, { type: 'heal', mode: 'percentMaxHp', value: 15 }, { type: 'convertOrbs', from: 'dark', to: 'heart' }],
  },
  {
    id: 's410', description: '其他隊員的主動技冷卻減少 1 回合，不包含施放者。',
    cooldown: { max: 8, min: 5 }, effects: [{ type: 'reduceAllyCooldown', turns: 1 }],
  },
];

describe('主動技獨立完整文案', () => {
  it.each(cases)('$id 單獨閱讀時列出完整效果與限制', ({ id, description }) => {
    expect(gameData.skills.find(s => s.id === id)?.description).toBe(description);
  });
  it.each(cases)('$id 真實效果、目標、數值、持續時間、冷卻保持原樣', ({ id, effects, cooldown }) => {
    const actual = gameData.skills.find(s => s.id === id)!;
    expect(actual.effects).toEqual(effects);
    expect(actual.cooldown).toEqual(cooldown);
  });
  it('所有主動技說明均可獨立閱讀，不再引用同上', () => {
    expect(gameData.skills.filter(s => s.description.includes('同上')).map(s => s.id)).toEqual([]);
  });
});
