import { describe, expect, it } from 'vitest';
import type { OwnedCard, SaveData } from '../src/core/types';
import { gameData } from '../src/data/load';
import { nurtureSteps, nurtureTarget } from '../src/progression/nurture';
import { claimableQuests, isKnownCounter } from '../src/progression/quests';
import { createNewSave } from '../src/save/save';
import { questDerived } from '../src/ui/economy';
import { questDestination } from '../src/ui/quest-goto';

const NOW = new Date(2026, 10, 1, 12).getTime();
const journey = gameData.quests.filter((q) => q.kind === 'journey');
const card = (uid: string, cardId: string, level = 1, obtainedAt = NOW): OwnedCard =>
  ({ uid, cardId, level, exp: 0, skillLevel: 1, limitBreak: 0, awakened: 0, locked: false, obtainedAt });
const withCards = (extra: OwnedCard[], owned: string[] = []): SaveData => {
  const s = createNewSave(gameData.config, NOW);
  return { ...s, inventory: { ...s.inventory, cards: [...s.inventory.cards, ...extra] }, collection: { ...s.collection, owned: [...s.collection.owned, ...owned] } };
};
const target = (s: SaveData) => nurtureTarget(s, gameData.cards, gameData.stages)!;

describe('養成之路：資料', () => {
  it('4 個步驟依序排列，獎勵合計不超過 15 星晶，只用推算計數', () => {
    expect(journey.map((q) => q.counter)).toEqual(['journeyEnhanced', 'journeyMaxLevel', 'journeyMaterials', 'journeyEvolved']);
    expect(journey.reduce((n, q) => n + (q.reward.gems ?? 0), 0)).toBeLessThanOrEqual(15);
    for (const q of journey) expect(isKnownCounter(q.counter, q.kind), q.id).toBe(true);
  });
});

describe('養成之路：目標卡與步驟（全部由存檔推算）', () => {
  it('還沒有低星進化卡：推薦主線最早拿得到的一條（首通），步驟都未完成', () => {
    const line = target(createNewSave(gameData.config, NOW));
    expect(line.base.rarity).toBeLessThanOrEqual(4);
    expect(line.source).toBeDefined();
    expect(gameData.stages.find((s) => s.id === line.source)!.rewards.firstClear?.cards?.some((c) => c.card === line.base.id)).toBe(true);
    expect(nurtureSteps(createNewSave(gameData.config, NOW), line)).toEqual({ enhanced: false, maxLevel: false, materials: false, evolved: false });
  });

  it('挑最早拿到的那張，之後拿到新的候選卡也不換目標', () => {
    const s = withCards([card('u90', 'c109', 1, NOW - 1000), card('u91', 'c209', 1, NOW)]);
    expect(target(s).base.id).toBe('c109');
  });

  it('依序推進：強化 → 滿級 → 素材 → 進化', () => {
    const base = gameData.cards.find((c) => c.id === 'c109')!;
    const core = base.evolution!.materials[0];
    expect(nurtureSteps(withCards([card('u90', 'c109')]), target(withCards([card('u90', 'c109')])))).toMatchObject({ enhanced: false });
    const lv2 = withCards([card('u90', 'c109', 2)]);
    expect(nurtureSteps(lv2, target(lv2))).toEqual({ enhanced: true, maxLevel: false, materials: false, evolved: false });
    const max = withCards([card('u90', 'c109', base.maxLevel), card('u91', core)]);
    expect(nurtureSteps(max, target(max))).toEqual({ enhanced: true, maxLevel: true, materials: true, evolved: false });
  });

  it('老玩家已經進化過：四步都可以直接領', () => {
    const s = withCards([card('u90', 'c110', 1)], ['c109', 'c110']);
    expect(target(s).base.id).toBe('c109');
    const ready = claimableQuests(s, gameData.quests, NOW, questDerived(s)).filter((q) => q.kind === 'journey').map((q) => q.id);
    expect(ready).toEqual(journey.map((q) => q.id));
  });
});

describe('養成之路：「前往」', () => {
  const q = (counter: string) => journey.find((x) => x.counter === counter)!;
  it('有卡：強化／進化畫面直接帶這張卡；素材到每日關卡；沒卡：先去拿得到的關卡', () => {
    const s = withCards([card('u90', 'c109', 3)]);
    expect(questDestination(q('journeyEnhanced'), s, gameData.stages, NOW, gameData.cards)).toEqual({ name: 'enhance', args: ['u90'] });
    expect(questDestination(q('journeyEvolved'), s, gameData.stages, NOW, gameData.cards)).toEqual({ name: 'evolve', args: ['u90'] });
    expect(questDestination(q('journeyMaterials'), s, gameData.stages, NOW, gameData.cards)).toEqual({ name: 'stages', args: ['daily'] });
    const fresh = createNewSave(gameData.config, NOW);
    expect(questDestination(q('journeyEnhanced'), fresh, gameData.stages, NOW, gameData.cards)?.name).toBe('prepare');
  });
});
