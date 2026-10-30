import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/ui/assets', () => ({
  userAsset: (_kind: string, name: string) => ({
    'orb-fire': '/assets/fire.webp',
    'orb-fire-enhanced': '/assets/fire-plus.webp',
    'orb-fire-locked': '/assets/fire-lock.webp',
  } as Record<string, string>)[name],
}));

import { orbDataUrl, orbSvg } from '../src/ui/art/orbs';

describe('符石圖片在 Canvas 與介面一致', () => {
  it('Canvas 直接載入圖片網址，避免 SVG 外連圖片無法繪製', () => {
    expect(orbDataUrl('fire')).toBe('/assets/fire.webp');
    expect(orbDataUrl('fire', { enhanced: true })).toBe('/assets/fire-plus.webp');
    expect(orbDataUrl('fire', { locked: true })).toBe('/assets/fire-lock.webp');
    expect(orbSvg('fire')).toContain('/assets/fire.webp');
  });
  it('沒有對應狀態的素材仍保留強化與鎖定提示，不冒用普通珠', () => {
    const source = orbDataUrl('water', { enhanced: true, locked: true });
    expect(source).toMatch(/^data:image\/svg\+xml/);
    const svg = decodeURIComponent(source.split(',')[1]);
    expect(svg).toContain('stroke-dasharray');
    expect(svg).toContain('M18 18 82 82');
    expect(orbDataUrl('hidden')).toMatch(/^data:image\/svg\+xml/);
  });
});
