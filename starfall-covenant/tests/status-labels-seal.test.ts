import { describe, expect, it } from 'vitest';
import { statusChip, statusName } from '../src/ui/status-labels';

describe('星紋封印的中文標籤', () => {
  it('名稱帶上被封印的屬性', () => {
    expect(statusName('attributeSeal', { attribute: 'fire' })).toBe('星紋封印・焰');
    expect(statusName('attributeSeal', { attribute: 'fire,water' })).toBe('星紋封印・焰潮');
    expect(statusName('attributeSeal', { attribute: 'leader' })).toBe('星紋封印・隊長屬性');
    expect(statusName('attributeSeal')).toBe('星紋封印');
    expect(statusName('darkOrbs')).toBe('隱藏珠');
  });

  it('我方狀態標籤顯示剩餘回合與說明', () => {
    const chip = statusChip({ id: 'attributeSeal', turns: 2, params: { attribute: 'fire' } }, 'debuff');
    expect(chip.text).toBe('星紋封印・焰 2');
    expect(chip.detail).toContain('不能施放主動技');
  });
});
