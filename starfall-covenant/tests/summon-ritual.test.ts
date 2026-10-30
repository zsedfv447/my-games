import { describe, expect, it } from 'vitest';
import { sealColor } from '../src/ui/screens/summon-ritual';

describe('召喚演出的星印顏色', () => {
  it('還沒劃時是白光，劃完透露最高稀有度', () => {
    expect(sealColor(5, 0, 0)).toBe('rgb(255 255 255)');
    expect(sealColor(3, 1, 0)).toBe('rgb(150 200 255)');
    expect(sealColor(4, 1, 0)).toBe('rgb(242 196 90)');
    expect(sealColor(5, 1, 0)).toBe('rgb(199 146 255)');
  });

  it('6★ 是會變色的彩虹', () => {
    expect(sealColor(6, 1, 0)).not.toBe(sealColor(6, 1, 1200));
  });
});
