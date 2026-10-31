import { describe, expect, it } from 'vitest';
import { gameData } from '../src/data/load';
import { createNewSave } from '../src/save/save';
import {
  ABYSS_FLOORS, ABYSS_UNLOCK_STAGE, abyssFloor, abyssFloorReward, abyssLock, abyssOmen, abyssProgress, abyssStageId, abyssStrength,
  abyssWeeklyTotal, completeAbyssFloor, parseAbyssId,
} from '../src/progression/abyss';
import { weekKey } from '../src/progression/time';
import { stageContext } from '../src/ui/stage-nav';
import type { SaveData } from '../src/core/types';

const config = gameData.config;
// 2026-11-04（週三）與下一週
const NOW = new Date(2026, 10, 4, 12).getTime();
const NEXT_WEEK = NOW + 7 * 86_400_000;
const WEEK = weekKey(NOW);
const base = gameData.enemies;
const floors = (week: string) => Array.from({ length: ABYSS_FLOORS }, (_, i) => abyssFloor(week, i + 1, base));
const summary = { turns: 5, usedActiveSkill: false, maxCombo: 6, continues: 0, team: [] };
const opened = (): SaveData => {
  const s = createNewSave(config, NOW);
  return { ...s, progress: { ...s.progress, clearedStages: [ABYSS_UNLOCK_STAGE] } };
};

describe('星淵回廊產生器', () => {
  it('同一週、同一層的結果固定；不同週不同', () => {
    expect(floors(WEEK)).toEqual(floors(WEEK));
    const other = floors(weekKey(NEXT_WEEK));
    expect(other.map((f) => f.enemies.map((e) => e.name))).not.toEqual(floors(WEEK).map((f) => f.enemies.map((e) => e.name)));
  });

  it('強度隨層數單調上升，每 5 層是 Boss 層', () => {
    const all = floors(WEEK);
    const strength = all.map((f) => abyssStrength(f.stage, f.enemies));
    for (let i = 1; i < strength.length; i++) {
      // Boss 層之後的一般層比 Boss 層少一波，比較同類型的層
      const prevSame = all.slice(0, i).reverse().find((f) => (f.stage.waves.length === all[i].stage.waves.length));
      if (prevSame) expect(strength[i]).toBeGreaterThan(abyssStrength(prevSame.stage, prevSame.enemies));
    }
    all.forEach((f, i) => expect(!!f.stage.waves.at(-1)?.boss).toBe((i + 1) % 5 === 0));
  });

  it('每層只用到存在的敵人原型，敵人 id 都對得上，關卡 id 可以讀回週與層數', () => {
    const names = new Set(base.map((e) => e.name));
    for (const f of floors(WEEK)) {
      const ids = new Set(f.enemies.map((e) => e.id));
      for (const w of f.stage.waves) for (const id of w.enemies) expect(ids.has(id)).toBe(true);
      for (const e of f.enemies) expect(names.has(e.name.replace(/^星淵・/, ''))).toBe(true);
      expect(parseAbyssId(f.stage.id)).toEqual({ week: WEEK, floor: Number(f.stage.name.match(/第 (\d+) 層/)![1]) });
      expect(f.stage.kind).toBe('abyss');
    }
    expect(parseAbyssId('st-1-1')).toBeNull();
    expect(parseAbyssId(abyssStageId(WEEK, 31))).toBeNull();
  });

  it('每週一個星象，同一週固定', () => {
    expect(abyssOmen(WEEK)).toEqual(abyssOmen(WEEK));
    expect(abyssOmen(WEEK).name).toBeTruthy();
  });
});

describe('星淵回廊獎勵與進度', () => {
  it('一週的星晶不超過 10，星核每 5 層一顆', () => {
    const total = abyssWeeklyTotal(WEEK, gameData.cards);
    expect(total.gems).toBe(10);
    // 星核每 5 層一顆（6 顆），星輝結晶只在第 30 層（每週 1 顆）
    expect(Object.values(total.cards).reduce((a, b) => a + b, 0)).toBe(7);
    expect(total.cards.c921).toBe(1);
    expect(abyssFloorReward(WEEK, 3, gameData.cards)).toBeUndefined();
  });

  it('星輝結晶 c921 只在第 30 層', () => {
    expect(abyssFloorReward(WEEK, 30, gameData.cards)?.cards?.map((c) => c.card)).toContain('c921');
    expect(abyssFloorReward(WEEK, 10, gameData.cards)?.cards?.map((c) => c.card)).not.toContain('c921');
    expect(abyssFloorReward(WEEK, 20, gameData.cards)?.gems).toBe(3);
  });

  it('主線通關才開放，只能挑戰下一層；換週重置', () => {
    expect(abyssLock(createNewSave(config, NOW), WEEK, 1, NOW)).toBe('locked');
    const s = opened();
    expect(abyssLock(s, WEEK, 1, NOW)).toBeNull();
    expect(abyssLock(s, WEEK, 2, NOW)).toBe('previous');
    const cleared = { ...s, abyss: { week: WEEK, best: 7, claimed: [1, 2, 3, 4, 5, 6, 7] } };
    expect(abyssLock(cleared, WEEK, 8, NOW)).toBeNull();
    expect(abyssProgress(cleared, NEXT_WEEK)).toEqual({ week: weekKey(NEXT_WEEK), best: 0, claimed: [] });
    expect(abyssLock(cleared, WEEK, 1, NEXT_WEEK)).toBe('wrongWeek');
  });

  it('通關：發金幣經驗、本週首通獎勵只發一次，不寫進 clearedStages', () => {
    const s = opened();
    const { stage } = abyssFloor(WEEK, 10, base);
    const ctx = stageContext(gameData.stages, gameData.events);
    const first = completeAbyssFloor({ ...s, abyss: { week: WEEK, best: 9, claimed: [] } }, stage, summary, ctx, config, NOW, gameData.cards);
    expect(first.result.periodFirstClear?.gems).toBe(3);
    // 跟「這層本週已領過」的同一場比，差額就是首通的 3 星晶（玩家升級送的星晶兩邊一樣）
    const claimedBefore = completeAbyssFloor({ ...s, abyss: { week: WEEK, best: 10, claimed: [10] } }, stage, summary, ctx, config, NOW, gameData.cards);
    expect(first.save.player.gems).toBe(claimedBefore.save.player.gems + 3);
    expect(first.save.player.coin).toBe(s.player.coin + stage.rewards.coin);
    expect(first.save.abyss).toEqual({ week: WEEK, best: 10, claimed: [10] });
    expect(first.save.progress.clearedStages).toEqual(s.progress.clearedStages);
    const again = completeAbyssFloor(first.save, stage, summary, ctx, config, NOW, gameData.cards);
    expect(again.result.periodFirstClear).toBeUndefined();
    expect(again.save.abyss).toEqual(first.save.abyss);
  });
});

describe('星淵回廊的戰鬥與中途續戰', () => {
  it('用關卡 id 找回同一層，戰鬥資料帶上這層的敵人；快照還原後狀態一致', async () => {
    const { findStage, battleDataFor } = await import('../src/ui/stage-lookup');
    const { startBattle, resumeBattle } = await import('../src/battle/battle-state');
    const { createRng } = await import('../src/core/rng');
    const id = abyssStageId(WEEK, 5);
    const stage = findStage(id)!;
    expect(stage).toEqual(abyssFloor(WEEK, 5, base).stage);
    expect(findStage('st-1-1')?.id).toBe('st-1-1');
    const data = battleDataFor(stage);
    const team = [{ cardId: gameData.config.newPlayer.starterCards[0], level: 50 }];
    const battle = startBattle(stage, team, null, createRng(9), data);
    battle.submitMove([]);
    // 重新整理後：重新產生同一層、用快照還原
    const again = resumeBattle(findStage(id)!, JSON.parse(JSON.stringify(battle.snapshot())), battleDataFor(findStage(id)!));
    expect(again.getState()).toEqual(battle.getState());
  });
});
