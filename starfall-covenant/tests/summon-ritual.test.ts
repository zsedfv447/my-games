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

// 原 SKSealCard 的 320 基準：最多下拉360，放手達310才出卡；此頁使用2倍素材座標。
describe('龍形卡夾下拉規則', () => {
  it('只在放手時通過原版容許距離，不足距離或取消回位', async () => {
    const { releasePull } = await import('../src/ui/screens/summon-ritual');
    expect(releasePull(619, false)).toBe(false);
    expect(releasePull(620, false)).toBe(true);
    expect(releasePull(720, false)).toBe(true);
    expect(releasePull(720, true)).toBe(false);
  });
  it('每30設計像素播放拉動音，同幀跨多段只播放一次，回位不播放', async () => {
    const { createPullSoundSteps } = await import('../src/ui/screens/summon-ritual');
    const steps = createPullSoundSteps();
    expect(steps.advance(29, 100)).toBe(false);
    expect(steps.advance(30, 110)).toBe(true);
    expect(steps.advance(120, 110)).toBe(false);
    expect(steps.advance(150, 190)).toBe(true);
    expect(steps.advance(10, 300)).toBe(false);
    steps.reset();
    expect(steps.advance(30, 400)).toBe(true);
  });
});
