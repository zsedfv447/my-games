import { describe, expect, it } from 'vitest';
import type { SaveData } from '../src/core/types';
import { gameData } from '../src/data/load';
import { createNewSave } from '../src/save/save';
import { buyItem } from '../src/progression/shop';
import { acquireRoutes, materialGuide, rateText, type GuideData } from '../src/ui/acquire-guide';

const data: GuideData = gameData;
const OPEN = new Date(2026, 10, 2, 12).getTime();
// 齒輪大盜活動 10/26～11/9，每 21 天一輪；11/12 不在檔期內
const CLOSED = new Date(2026, 10, 12, 12).getTime();
const fresh = () => createNewSave(gameData.config, OPEN);
const kinds = (save: SaveData, id: string, now = OPEN) => acquireRoutes(save, id, data, now).map((r) => r.kind);

describe('追卡指南', () => {
  it('首通必得：還沒開放的關卡標出原因並導到關卡列表，通關後標成已領過', () => {
    const r = acquireRoutes(fresh(), 'c206', data, OPEN).find((x) => x.kind === 'firstClear' && x.stage.id === 'st-1-4')!;
    expect(r.available).toBe(false);
    expect(r.note).toBeTruthy();
    expect(r.go).toEqual(['stages', ['1']]);
    const s = fresh();
    const open = { ...s, progress: { ...s.progress, clearedStages: ['st-1-1', 'st-1-2', 'st-1-3'] } };
    const now = acquireRoutes(open, 'c206', data, OPEN).find((x) => x.kind === 'firstClear')!;
    expect(now.available).toBe(true);
    expect(now.go).toEqual(['prepare', ['st-1-4']]);
    const done = { ...open, progress: { ...open.progress, clearedStages: [...open.progress.clearedStages, 'st-1-4'] } };
    const after = acquireRoutes(done, 'c206', data, OPEN).find((x) => x.kind === 'firstClear')!;
    expect(after.available).toBe(false);
    expect(after.note).toBe('已經通關領過了');
  });

  it('隨機掉落附上掉落率，文字照實寫成百分比', () => {
    const drops = acquireRoutes(fresh(), 'c916', data, OPEN).filter((r) => r.kind === 'drop');
    expect(drops.length).toBeGreaterThan(0);
    for (const d of drops) if (d.kind === 'drop') expect(d.rate).toBeGreaterThan(0);
    expect(rateText(0.2)).toBe('20%');
    expect(rateText(0.05)).toBe('5%');
    expect(rateText(0.004)).toBe('0.4%');
  });

  it('兌換：列出剩餘次數，買完或活動沒開就不能換', () => {
    const shop = (s: SaveData, now = OPEN) => acquireRoutes(s, 'c902', data, now).find((r) => r.kind === 'shop' && r.item.id === 'coin-fire-mid')!;
    const r = shop(fresh());
    expect(r.kind === 'shop' && r.remaining).toBe(2);
    expect(r.available).toBe(true);
    expect(r.go).toEqual(['shop', ['coin']]);
    const item = gameData.shop.find((i) => i.id === 'coin-fire-mid')!;
    let s: SaveData = { ...fresh(), player: { ...fresh().player, coin: 1e6 } };
    for (let i = 0; i < 2; i++) { const b = buyItem(s, item, gameData.config, OPEN, gameData.events); if (b.ok) s = b.save; }
    expect(shop(s).available).toBe(false);
    const gear = (now: number) => acquireRoutes(fresh(), 'c108', data, now).find((x) => x.kind === 'shop' && x.item.id === 'ev-gear-c108')!;
    expect(gear(OPEN).available).toBe(true);
    expect(gear(CLOSED).available).toBe(false);
    expect(gear(CLOSED).note).toContain('未開放');
  });

  it('由某卡進化：持有進化前的卡才算現在拿得到', () => {
    const s = fresh();
    const r = acquireRoutes(s, 'c110', data, OPEN).find((x) => x.kind === 'evolve')!;
    expect(r.kind === 'evolve' && r.from.id).toBe('c109');
    expect(r.available).toBe(false);
    expect(r.go).toEqual(['collection-card', ['c109']]);
    const withFrom = { ...s, inventory: { ...s.inventory, cards: [...s.inventory.cards, { ...s.inventory.cards[0], uid: 'x1', cardId: 'c109' }] } };
    expect(acquireRoutes(withFrom, 'c110', data, OPEN).find((x) => x.kind === 'evolve')!.available).toBe(true);
  });

  it('卡池：列出含這張卡的卡池，並導到召喚', () => {
    const pool = gameData.gachaPools.find((p) => p.id === 'pool-standard')!;
    const id = Object.values(pool.cards).flat()[0]!;
    const r = acquireRoutes(fresh(), id, data, OPEN).find((x) => x.kind === 'gacha' && x.pool.id === 'pool-standard')!;
    expect(r.go).toEqual(['summon', []]);
  });

  it('現在拿得到的排在前面', () => {
    const list = acquireRoutes(fresh(), 'c916', data, OPEN);
    const firstLocked = list.findIndex((r) => !r.available);
    if (firstLocked >= 0) expect(list.slice(firstLocked).every((r) => !r.available)).toBe(true);
    expect(kinds(fresh(), 'c916')).toEqual(expect.arrayContaining(['drop', 'shop']));
  });
});

describe('進化缺素材時指路', () => {
  it('列出需要／持有，只給掉落與商店的去處', () => {
    const g = materialGuide(fresh(), [{ id: 'c916', need: 2, have: 0 }], data, OPEN);
    expect(g).toHaveLength(1);
    expect(g[0].need).toBe(2);
    expect(g[0].have).toBe(0);
    expect(g[0].routes.length).toBeGreaterThan(0);
    for (const r of g[0].routes) expect(['drop', 'firstClear', 'shop']).toContain(r.kind);
  });
});
