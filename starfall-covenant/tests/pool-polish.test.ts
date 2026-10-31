import { describe, expect, it } from 'vitest';
import { gameData } from '../src/data/load';
import { createNewSave } from '../src/save/save';
import { firstClearPreview } from '../src/ui/reward-plan';
import { nemesisLock, nemesisView } from '../src/ui/nemesis';
import { stageContext } from '../src/ui/stage-nav';
import { bannerCopy } from '../src/ui/summon-copy';

const pool = (id: string) => gameData.gachaPools.find((p) => p.id === id)!;
/** 玩家主要使用的卡池：召喚頁前兩個分頁（教學單抽也是刻印封印） */
const MAIN_POOLS = ['covenant-seal', 'twilight-seal'];
const cardById = new Map(gameData.cards.map((c) => [c.id, c]));

describe('第 81 項：新卡也在主要卡池', () => {
  it('每張可抽的戰鬥卡都在至少一個主要卡池裡（主要卡池沒有的稀有度除外）', () => {
    const mainRarities = new Set(MAIN_POOLS.flatMap((id) => Object.keys(pool(id).rates)));
    const inMain = new Set(MAIN_POOLS.flatMap((id) => Object.values(pool(id).cards).flat()));
    const missing: string[] = [];
    const skipped: string[] = [];
    for (const p of gameData.gachaPools) {
      for (const [rarity, ids] of Object.entries(p.cards)) {
        for (const id of ids ?? []) {
          if (cardById.get(id)?.race === 'material') continue;
          if (!mainRarities.has(rarity)) skipped.push(id);
          else if (!inMain.has(id)) missing.push(id);
        }
      }
    }
    expect(missing).toEqual([]);
    // 3★ 只有星海召喚有機率；主要卡池的機率不能動，所以 3★ 新卡留在星海召喚
    expect([...new Set(skipped)].every((id) => cardById.get(id)!.rarity === 3)).toBe(true);
  });

  it('刻印封印收錄新卡 4★～6★，機率與保底不變；星海召喚保留', () => {
    const cov = pool('covenant-seal');
    for (const [r, id] of [['4', 'c702'], ['4', 'c703'], ['4', 'c709'], ['4', 'c710'], ['5', 'c705'], ['5', 'c707'], ['5', 'c708'], ['6', 'c706']] as const) {
      expect(cov.cards[Number(r) as 4 | 5 | 6], id).toContain(id);
    }
    expect(cov.rates).toEqual({ 4: 0.8, 5: 0.17, 6: 0.03 });
    expect(cov.pity).toEqual({ rarity: 6, after: 39 });
    expect(cov.tenPullGuarantee).toEqual({ minRarity: 5 });
    expect(Object.values(pool('pool-standard').cards).flat()).toContain('c701');
  });
});

describe('第 87 項：卡池橫幅文案', () => {
  it('刻印封印與星海召喚的文案不同，事實由卡池資料算出', () => {
    const cov = bannerCopy(pool('covenant-seal'));
    const std = bannerCopy(pool('pool-standard'));
    expect(cov.tag).not.toBe(std.tag);
    expect(cov.en).not.toBe(std.en);
    expect(cov.flavor).not.toBe(std.flavor);
    expect(cov.facts).toBe('收錄 4★～6★・6★ 機率 3%');
    expect(std.facts).toBe('收錄 3★～6★・6★ 機率 1%');
    for (const id of std.featured) expect(cardById.has(id), id).toBe(true);
  });

  it('光闇契約顯示機率提升的角色', () => {
    const tw = pool('twilight-seal');
    expect(bannerCopy(tw).featured).toEqual(tw.rateUp!.map((u) => u.card));
  });
});

describe('第 84 項：克星週入口與獎勵標籤', () => {
  const now = new Date(2026, 10, 3, 12).getTime();
  const view = nemesisView(gameData.events, gameData.stages, (id) => id, now)!;
  const ctx = stageContext(gameData.stages, gameData.events, now);

  it('第 3 章「雲端林道」通關前寫出開放條件；通關後沒有', () => {
    const fresh = createNewSave(gameData.config, now);
    const lock = nemesisLock(fresh, view, ctx, now);
    const gate = gameData.stages.find((s) => s.id === 'st-3-1')!;
    expect(lock).toBe(`通過第 3 章「${gate.name}」後開放`);
    const opened = { ...fresh, progress: { ...fresh.progress, clearedStages: ['st-3-1'] } };
    expect(nemesisLock(opened, view, ctx, now)).toBe('');
  });

  it('星核獎勵的標籤寫星核名稱，不是「卡」；戰鬥卡仍寫「卡」', () => {
    const core = firstClearPreview({ gems: 1, cards: [{ card: 'c918', count: 1 }] }, false, '本週首通')!;
    expect(core.parts).toEqual([{ icon: 'gem', amount: 1 }, { icon: 'card', amount: 1, name: cardById.get('c918')!.name }]);
    const hero = firstClearPreview({ cards: [{ card: 'c601', count: 1 }] }, false)!;
    expect(hero.parts[0].name).toBe('卡');
  });
});
