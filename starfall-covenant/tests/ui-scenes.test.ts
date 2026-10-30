import { describe, expect, it } from 'vitest';
import { SCENE_IDS, sceneSvg } from '../src/ui/art/scenes';
import { sceneForStage } from '../src/ui/backdrop';
import { storyScene } from '../src/ui/screens/story';

describe('場景背景', () => {
  it('每個場景與 Boss 版都產生直式 390×844 的 SVG，且每次輸出相同', () => {
    for (const id of SCENE_IDS) {
      for (const boss of [false, true]) {
        const a = sceneSvg(id, { boss });
        expect(a).toContain('viewBox="0 0 390 844"');
        expect(a).toBe(sceneSvg(id, { boss }));
        expect(a).not.toMatch(/NaN|undefined/);
      }
    }
  });

  it('漸層 id 都帶場景前綴且不重複，同頁放多張不會互相覆蓋', () => {
    const all = SCENE_IDS.flatMap((id) => [sceneSvg(id), sceneSvg(id, { boss: true })]);
    const ids = all.flatMap((s) => [...s.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]));
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of all) {
      for (const [, ref] of s.matchAll(/url\(#([^)]+)\)/g)) expect(s).toContain(`id="${ref}"`);
    }
  });

  it('減少動態時不輸出動畫', () => {
    for (const id of SCENE_IDS) expect(sceneSvg(id, { boss: true, animate: false })).not.toMatch(/<animate/);
  });

  it('關卡對到場景：主線依章節、活動、塔與試煉、每日依屬性', () => {
    expect(sceneForStage({ id: 'st-3-2', kind: 'main', chapter: 3 })).toBe('chapter-3');
    expect(sceneForStage({ id: 'ev-1', kind: 'event' })).toBe('event');
    expect(sceneForStage({ id: 'tw-10', kind: 'tower' })).toBe('tower');
    expect(sceneForStage({ id: 'tr-1', kind: 'trial' })).toBe('tower');
    expect(sceneForStage({ id: 'dl-fire-2', kind: 'daily' })).toBe('chapter-4');
    expect(sceneForStage({ id: 'dl-coin-1', kind: 'daily' })).toBe('home');
  });

  it('劇情對到場景：決戰前用 Boss 版', () => {
    expect(storyScene('ch2-boss')).toEqual({ scene: 'chapter-2', boss: true });
    expect(storyScene('ch5-open')).toEqual({ scene: 'chapter-5', boss: false });
    expect(storyScene('tower-30').scene).toBe('tower');
    expect(storyScene('ev-beast-end').scene).toBe('event');
    expect(storyScene('prologue').scene).toBe('home');
  });
});
