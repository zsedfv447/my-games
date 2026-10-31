import { describe, expect, it } from 'vitest';
import { ARCHETYPE_IDS } from '../src/core/types';
import { gameData } from '../src/data/load';
import { createNewSave } from '../src/save/save';
import { archetypeCodex, claimAllCollectionRewards, claimCollectionReward, collectionEntries, collectionSummary, createGrowthContext, markOwned, markSeen } from '../src/growth';

const ctx = createGrowthContext(gameData);
const fresh = () => createNewSave({ ...gameData.config, newPlayer: { ...gameData.config.newPlayer, starterCards: [] } }, 0);

describe('全部已實作流派的圖鑑覆蓋', () => {
  it('定義、型別、卡牌標籤雙向一致，無遺漏或重複', () => {
    const ids = gameData.archetypes.map(a => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual([...ARCHETYPE_IDS].sort());
    for (const a of gameData.archetypes) {
      for (const field of ['name', 'summary', 'howToPlay', 'weakness', 'starterPath'] as const) expect(a[field].trim(), `${a.id}/${field}`).not.toBe('');
      expect(gameData.cards.some(c => c.archetypes.some(t => t.id === a.id)), a.id).toBe(true);
      expect(gameData.stages.some(s => s.kind === 'trial' && s.archetype === a.id), a.id).toBe(true);
    }
    for (const card of gameData.cards) {
      if (card.race !== 'material') expect(card.archetypes.length, card.id).toBeGreaterThan(0);
      for (const tag of card.archetypes) expect(ids, card.id).toContain(tag.id);
    }
  });
  it('流派圖鑑與每個篩選包含全部所屬卡，即使一張也未持有', () => {
    const save = fresh();
    const before = structuredClone(save);
    const codex = archetypeCodex(save, ctx);
    expect(codex.map(a => a.id)).toEqual(gameData.archetypes.map(a => a.id));
    for (const a of gameData.archetypes) {
      const expected = gameData.cards.filter(c => c.archetypes.some(t => t.id === a.id)).map(c => c.id).sort();
      expect(codex.find(c => c.id === a.id)!.cards.map(c => c.cardId).sort(), a.id).toEqual(expected);
      expect(collectionEntries(save, ctx, { archetype: a.id }).map(c => c.card.id).sort(), a.id).toEqual(expected);
    }
    expect(save).toEqual(before);
    expect(collectionSummary(save, ctx).owned).toBe(0);
    expect(collectionEntries(save, ctx).every(c => c.status === 'unseen' && c.claimable === 0)).toBe(true);
  });
  it('看資料/見過不等於取得；只有取得者可領且只能領一次', () => {
    const id = gameData.cards.find(c => c.race !== 'material')!.id;
    let save = fresh();
    collectionEntries(save, ctx); archetypeCodex(save, ctx);
    expect(claimCollectionReward(save, ctx, id)).toMatchObject({ ok: false, error: { code: 'notOwned' } });
    save = markSeen(save, [id]);
    expect(collectionEntries(save, ctx).find(c => c.card.id === id)).toMatchObject({ status: 'seen', claimable: 0 });
    expect(claimCollectionReward(save, ctx, id)).toMatchObject({ ok: false, error: { code: 'notOwned' } });
    const none = claimAllCollectionRewards(save, ctx);
    expect(none).toMatchObject({ ok: true, cards: [], gems: 0 });
    save = markOwned(save, [id]);
    const reward = claimCollectionReward(save, ctx, id);
    expect(reward.ok).toBe(true);
    if (!reward.ok) throw new Error('Expected acquired card reward');
    expect(claimCollectionReward(reward.save, ctx, id)).toMatchObject({ ok: false, error: { code: 'alreadyClaimed' } });
    expect(reward.save.inventory.cards).toEqual([]); // no synthetic cards from codex/reward
  });
});
