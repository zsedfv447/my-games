import { describe, expect, it } from 'vitest';
import { ORB_TYPES } from '../src/core/types';
import { backTarget, buildHash, parseHash, type ScreenDef } from '../src/ui/router';
import { DESIGN_HEIGHT, fitStage } from '../src/ui/scale';
import { ORB_SYMBOLS, orbSvg } from '../src/ui/art/orbs';
import { cardIconSvg, cardPortraitSvg, constellationPoints, nameGlyph } from '../src/ui/art/card-face';
import { enemySvg } from '../src/ui/art/enemy';
import { indexAssets } from '../src/ui/assets';
import { comboFrequency } from '../src/ui/audio';
import { clampPct } from '../src/ui/components/basic';
import { SCREENS } from '../src/ui/screens';

describe('畫面路由', () => {
  it('解析與組合 hash 可以來回轉換', () => {
    const hash = buildHash('stages', [2], { from: 'map' });
    expect(hash).toBe('#/stages/2?from=map');
    expect(parseHash(hash)).toEqual({ name: 'stages', args: ['2'], query: { from: 'map' } });
  });

  it('空 hash 回到標題畫面，中文參數會正確編碼', () => {
    expect(parseHash('').name).toBe('title');
    expect(parseHash(buildHash('card', ['焰/1'])).args).toEqual(['焰/1']);
  });

  it('沒有站內紀錄時返回上層畫面，避免離開遊戲', () => {
    const s = { name: 'card', parent: 'cards' } as ScreenDef;
    expect(backTarget(s, 0)).toBe('cards');
    expect(backTarget(s, 2)).toBe('history');
    expect(backTarget({ name: 'x' } as ScreenDef, 0)).toBe('home');
  });

  it('GDD 2.5 的畫面都有註冊，名稱不重複的正式畫面會取代建置中畫面', () => {
    const names = new Set(SCREENS.map((s) => s.name));
    for (const n of ['title', 'home', 'adventure', 'stages', 'helper', 'prepare', 'battle', 'team', 'cards', 'card',
      'enhance', 'evolve', 'summon', 'summon-rates', 'summon-history', 'shop', 'login-bonus', 'settings', 'quests',
      'achievements', 'collection', 'archetypes', 'event', 'tower', 'daily', 'story', 'stories']) {
      expect(names.has(n), n).toBe(true);
    }
    for (const s of SCREENS) if (s.parent) expect(names.has(s.parent), `${s.name} → ${s.parent}`).toBe(true);
  });
});

describe('舞台縮放', () => {
  it('390×844 剛好 1 倍', () => {
    expect(fitStage(390, 844)).toEqual({ scale: 1, height: 844 });
  });
  it('較細長的手機保留寬度、多出高度', () => {
    const fit = fitStage(390, 900);
    expect(fit.scale).toBe(1);
    expect(fit.height).toBe(900);
  });
  it('桌機寬螢幕以高度縮放，不會超出畫面', () => {
    const fit = fitStage(1920, 1080);
    expect(fit.scale).toBeCloseTo(1080 / DESIGN_HEIGHT);
    expect(fit.height).toBe(DESIGN_HEIGHT);
  });
});

describe('程式產生的美術', () => {
  it('六種珠的符號都不同（色弱玩家靠形狀辨識）', () => {
    expect(new Set(ORB_TYPES.map((o) => ORB_SYMBOLS[o])).size).toBe(ORB_TYPES.length);
    for (const o of ORB_TYPES) expect(orbSvg(o)).toMatch(/^<svg[\s\S]*<\/svg>$/);
    expect(orbSvg('fire', { enhanced: true })).not.toBe(orbSvg('fire'));
  });

  const card = { id: 'c0102', name: '測試<角色>', attribute: 'fire', race: 'dragon', rarity: 5 } as const;

  it('卡面固定：同一張卡每次產生一樣，不同卡不一樣', () => {
    expect(cardIconSvg(card)).toBe(cardIconSvg(card));
    expect(cardIconSvg(card)).not.toBe(cardIconSvg({ ...card, id: 'c0103' }));
    expect(constellationPoints('c0102', 100, 100, 10).length).toBeGreaterThanOrEqual(5);
  });

  it('名字會跳脫，不會破壞 SVG', () => {
    expect(cardPortraitSvg(card)).toContain('測試&lt;角色&gt;');
    expect(cardPortraitSvg(card)).not.toContain('<角色>');
  });

  it('名字代表字取最後一段', () => {
    expect(nameGlyph('灰燼・狼王')).toBe('狼');
    expect(nameGlyph('星')).toBe('星');
  });

  it('敵人圖固定且 Boss 有王冠', () => {
    const e = { id: 'e0001', name: '測試', attribute: 'water' } as const;
    expect(enemySvg(e)).toBe(enemySvg(e));
    expect(enemySvg({ ...e, boss: true }).length).toBeGreaterThan(enemySvg(e).length);
  });
});

describe('使用者素材', () => {
  it('依資料夾與檔名建立索引，同名只取第一個', () => {
    const idx = indexAssets({
      '../../assets/user/cards/c0101.png': '/a.png',
      '../../assets/user/cards/c0101.webp': '/a.webp',
      '../../assets/user/bgm/home.ogg': '/home.ogg',
    });
    expect(idx.get('cards')?.get('c0101')).toBe('/a.png');
    expect(idx.get('bgm')?.get('home')).toBe('/home.ogg');
  });
});

describe('其他', () => {
  it('Combo 越高消除音越高', () => {
    for (let c = 1; c < 15; c++) expect(comboFrequency(c + 1)).toBeGreaterThan(comboFrequency(c));
  });
  it('進度條百分比限制在 0–100', () => {
    expect(clampPct(150, 100)).toBe(100);
    expect(clampPct(-5, 100)).toBe(0);
    expect(clampPct(1, 0)).toBe(0);
  });
});
