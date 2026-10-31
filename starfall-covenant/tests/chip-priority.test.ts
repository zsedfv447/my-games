import { describe, expect, it } from 'vitest';
import { gameData } from '../src/data/load';
import { nemesisView } from '../src/ui/nemesis';
import { firstClearPreview } from '../src/ui/reward-plan';

const name = (id: string) => gameData.cards.find((c) => c.id === id)!.name;
const isRare = (id: string) => { const c = gameData.cards.find((x) => x.id === id); return c?.race === 'material' && c.rarity >= 5; };

describe('首通標籤依稀有程度排序（最多 2 種）', () => {
  it('克星週高級關：星晶、星輝結晶優先，星核放進「…」', () => {
    const top = gameData.stages.find((s) => s.id === 'nm-ironwall-3')!;
    const p = firstClearPreview(top.rewards.periodFirstClear, false, '本週首通')!;
    expect(p.parts).toEqual([{ icon: 'gem', amount: 2 }, { icon: 'card', amount: 1, name: name('c921') }]);
    expect(p.more).toBe(true);
  });

  it('星核排在金幣前面；只有兩種時全部顯示', () => {
    const p = firstClearPreview({ coin: 5000, cards: [{ card: 'c916', count: 1 }] }, false)!;
    expect(p.parts.map((x) => x.name ?? x.icon)).toEqual([name('c916'), 'coin']);
    expect(p.more).toBe(false);
  });

  it('戰鬥卡和星輝結晶同一級，依原本順序；代幣排在金幣前、體力最後', () => {
    const p = firstClearPreview({ stamina: 10, coin: 100, tokens: { 'token-beast': 20 } }, false)!;
    expect(p.parts.map((x) => x.icon)).toEqual(['token', 'coin']);
    const hero = firstClearPreview({ coin: 100, cards: [{ card: 'c601', count: 1 }] }, false)!;
    expect(hero.parts.map((x) => x.name ?? x.icon)).toEqual(['卡', 'coin']);
  });
});

describe('克星週列表說明', () => {
  it('列出高級關每週首通的星輝結晶', () => {
    const v = nemesisView(gameData.events, gameData.stages, (id) => id, new Date(2026, 10, 3, 12).getTime(), isRare)!;
    expect(v.rareRewards).toEqual(['c921']);
    expect(nemesisView(gameData.events, gameData.stages, (id) => id, new Date(2026, 10, 3, 12).getTime())!.rareRewards).toEqual([]);
  });
});
