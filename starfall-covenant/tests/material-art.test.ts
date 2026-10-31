import { describe, expect, it } from 'vitest';
import { gameData } from '../src/data/load';
import { materialIconSvg, materialKind, materialPortraitSvg } from '../src/ui/art/material';
import { ORB_COLORS } from '../src/ui/art/palette';

const card = (id: string) => gameData.cards.find((c) => c.id === id)!;
const cores = gameData.cards.filter((c) => c.race === 'material' && c.name.endsWith('星核'));

describe('素材卡的程式繪製圖示', () => {
  it('星核五屬各一張、星輝結晶一張；塵靈和一般角色卡不換', () => {
    expect(cores.map((c) => c.attribute).sort()).toEqual(['dark', 'fire', 'light', 'water', 'wood']);
    for (const c of cores) expect(materialKind(c)).toBe('core');
    expect(materialKind(card('c921'))).toBe('crystal');
    expect(materialKind(card('c901'))).toBeNull();
    expect(materialKind(gameData.cards.find((c) => c.race !== 'material')!)).toBeNull();
  });

  it('星核依屬性換色，五張圖互不相同', () => {
    const svgs = cores.map((c) => materialIconSvg(c)!);
    for (const [i, c] of cores.entries()) expect(svgs[i]).toContain(ORB_COLORS[c.attribute].base);
    expect(new Set(svgs).size).toBe(5);
  });

  it('星輝結晶和星核明顯不同：不同形狀（三柱晶簇）、沒有屬性符號', () => {
    const crystal = materialIconSvg(card('c921'))!;
    const core = materialIconSvg(cores[0])!;
    expect(crystal).not.toBe(core);
    expect(crystal).not.toContain(ORB_COLORS[cores[0].attribute].base);
    expect((crystal.match(/<path d="M\d+ \d+ L/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });

  it('是完整的 SVG（不用圖片檔），有名字給螢幕閱讀器；直式大圖也有', () => {
    for (const c of [...cores, card('c921')]) {
      const icon = materialIconSvg(c)!;
      expect(icon.startsWith('<svg')).toBe(true);
      expect(icon).toContain(`aria-label="${c.name}"`);
      expect(icon).not.toMatch(/<image|href="[^#]/);
      expect(materialPortraitSvg(c)).toContain(c.name);
    }
    expect(materialPortraitSvg(card('c901'))).toBeNull();
  });
});
