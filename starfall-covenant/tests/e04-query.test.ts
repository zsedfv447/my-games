import { describe, expect, it } from 'vitest';
import { ORB_TYPES, type SkillEffect, type ActiveSkillDef } from '../src/core/types';
import { conversionQueryActive, matchesConversionSkill } from '../src/ui/conversion-query';

const skill = (...effects: SkillEffect[]): ActiveSkillDef => ({ id: 'test', name: '測試', description: '不可從這段說明猜轉換', cooldown: { max: 5, min: 5 }, effects });

describe('明確轉珠段查詢', () => {
  it('無條件時所有技能及無技能均通過；純條件活動狀態', () => {
    expect(conversionQueryActive({})).toBe(false);
    expect(conversionQueryActive({ from: 'heart' })).toBe(true);
    expect(conversionQueryActive({ to: 'light' })).toBe(true);
    expect(matchesConversionSkill(undefined, {})).toBe(true);
    expect(matchesConversionSkill(skill(), {})).toBe(true);
    expect(matchesConversionSkill(undefined, { from: 'heart' })).toBe(false);
  });
  it('單來源支援來源、目標或兩者，不比對描述文字', () => {
    const s = skill({ type: 'convertOrbs', from: 'wood', to: 'light' });
    expect(matchesConversionSkill(s, { from: 'wood' })).toBe(true);
    expect(matchesConversionSkill(s, { to: 'light' })).toBe(true);
    expect(matchesConversionSkill(s, { from: 'wood', to: 'light' })).toBe(true);
    expect(matchesConversionSkill(s, { from: 'heart', to: 'light' })).toBe(false);
    expect(matchesConversionSkill(s, { from: 'wood', to: 'dark' })).toBe(false);
  });
  it('陣列來源展開，但排除來源等於目標的恆等段', () => {
    const s = skill({ type: 'convertOrbs', from: ['wood', 'heart', 'light'], to: 'light' });
    expect(matchesConversionSkill(s, { from: 'wood', to: 'light' })).toBe(true);
    expect(matchesConversionSkill(s, { from: 'heart', to: 'light' })).toBe(true);
    expect(matchesConversionSkill(s, { from: 'light' })).toBe(false);
    expect(matchesConversionSkill(s, { from: 'light', to: 'light' })).toBe(false);
    expect(matchesConversionSkill(skill({ type: 'convertOrbs', from: 'light', to: 'light' }), { to: 'light' })).toBe(false);
    expect(matchesConversionSkill(skill({ type: 'convertOrbs', from: [], to: 'light' }), { to: 'light' })).toBe(false);
  });
  it('all 包含六種來源，但只有五條非恆等邊', () => {
    const s = skill({ type: 'convertOrbs', from: 'all', to: 'heart' });
    expect(ORB_TYPES.filter(from => matchesConversionSkill(s, { from, to: 'heart' }))).toEqual(['fire', 'water', 'wood', 'light', 'dark']);
    expect(matchesConversionSkill(s, { from: 'heart' })).toBe(false);
    expect(matchesConversionSkill(s, { to: 'heart' })).toBe(true);
  });
  it('同一條邊同時符合兩端，不跨段拼接，不模擬最後盤面', () => {
    const s = skill({ type: 'convertOrbs', from: 'wood', to: 'heart' }, { type: 'convertOrbs', from: 'heart', to: 'light' });
    expect(matchesConversionSkill(s, { from: 'wood', to: 'light' })).toBe(false);
    expect(matchesConversionSkill(s, { from: 'wood', to: 'heart' })).toBe(true);
    expect(matchesConversionSkill(s, { from: 'heart', to: 'light' })).toBe(true);
  });
  it('混合技能只要有明確段就匹配；非 convertOrbs 技能不混入', () => {
    const other = { type: 'heal', mode: 'percentMaxHp', value: 25 } as const;
    const mixed = skill(other, { type: 'convertOrbs', from: 'heart', to: 'fire' });
    expect(matchesConversionSkill(mixed, { from: 'heart', to: 'fire' })).toBe(true);
    expect(matchesConversionSkill(skill(other), { to: 'heart' })).toBe(false);
    const excluded: SkillEffect[] = [
      { type: 'refreshBoard' }, { type: 'balanceBoard' }, { type: 'rowToOrb', row: 0, to: 'heart' },
      { type: 'twoColorBoard', colors: ['heart', 'fire'] }, { type: 'enhanceOrbs', orbs: 'all' },
      { type: 'fillMissingOrbs', count: 3 }, { type: 'setSkyfallRate', orb: 'heart', rate: 0.3, turns: 3 },
      { type: 'setEnhancedSkyfallRate', rate: 1, turns: 2 },
    ];
    for (const effect of excluded) expect(matchesConversionSkill(skill(effect), { to: 'heart' }), effect.type).toBe(false);

  });
  it('查詢不改技能、來源陣列或條件', () => {
    const s = skill({ type: 'convertOrbs', from: ['wood', 'heart'], to: 'light' });
    const query = { from: 'heart', to: 'light' } as const;
    const before = JSON.stringify({ s, query });
    expect(matchesConversionSkill(s, query)).toBe(true);
    expect(JSON.stringify({ s, query })).toBe(before);
  });
});
