import { describe, expect, it } from 'vitest';
import type { SaveData } from '../src/core/types';
import { createRng } from '../src/core/rng';
import { gameData } from '../src/data/load';
import { startBattle } from '../src/battle/battle-state';
import { createNewSave } from '../src/save/save';
import {
  ECLIPSE, baseIdOf, eclipseScale, claimEclipseChapterReward, completeEclipseStage, eclipseChapterStages, eclipseEnemies, eclipseEnemy,
  eclipseIdOf, eclipseLockReason, eclipseOf, eclipseRewardStatus, eclipseUnlocked, isEclipseId, resolveStage,
} from '../src/progression/eclipse';
import type { BattleSummary } from '../src/progression/stages';

const config = { ...gameData.config, newPlayer: { ...gameData.config.newPlayer, starterCards: [] } };
const NOW = new Date(2026, 10, 2, 12).getTime();
const ch1 = gameData.stages.filter((s) => s.kind === 'main' && s.chapter === 1);
const summary: BattleSummary = { turns: 3, usedActiveSkill: false, maxCombo: 12, continues: 0, team: [{ attribute: 'fire', race: 'human' }] };

/** 第 1 章原版全部通關、滿星 */
function starredChapter1(): SaveData {
  const save = createNewSave(config, NOW);
  return {
    ...save,
    progress: {
      ...save.progress,
      clearedStages: ch1.map((s) => s.id),
      stars: Object.fromEntries(ch1.map((s) => [s.id, (s.stars ?? []).map(() => true)])),
    },
  };
}

describe('星蝕：轉換', () => {
  it('id 互轉', () => {
    expect(eclipseIdOf('st-1-1')).toBe('st-1-1@eclipse');
    expect(eclipseIdOf('st-1-1@eclipse')).toBe('st-1-1@eclipse');
    expect(baseIdOf('st-1-1@eclipse')).toBe('st-1-1');
    expect(isEclipseId('st-1-1')).toBe(false);
  });

  it('敵人生命、攻擊、防禦乘上係數，Boss 加上狂暴', () => {
    const e = gameData.enemies.find((x) => x.abilities.every((a) => a.status !== 'enrage'))!;
    const k = eclipseScale(3);
    const normal = eclipseEnemy(e, false, 3);
    expect(normal).toMatchObject({ id: `${e.id}@eclipse`, hp: Math.round(e.hp * k.hp), atk: Math.round(e.atk * k.atk), def: Math.round(e.def * k.def) });
    expect(eclipseScale(99)).toBe(ECLIPSE.default);
    expect(normal.abilities).toEqual(e.abilities);
    const boss = eclipseEnemy(e, true);
    expect(boss.abilities.at(-1)).toMatchObject({ status: 'enrage', trigger: 'hpBelow', value: ECLIPSE.bossEnrage.value });
    // 原資料不被改動
    expect(gameData.enemies.find((x) => x.id === e.id)).toBe(e);
  });

  it('關卡：體力、獎勵、解鎖鏈、首通獎勵；不掉落、不播劇情', () => {
    const base = ch1[1];
    const st = resolveStage(eclipseIdOf(base.id), gameData)!;
    expect(st.id).toBe(`${base.id}@eclipse`);
    expect(st.stamina).toBe(Math.ceil(base.stamina * ECLIPSE.stamina));
    expect(st.unlockAfter).toBe(eclipseIdOf(ch1[0].id));
    expect(st.waves.flatMap((w) => w.enemies).every(isEclipseId)).toBe(true);
    expect(st.drops).toEqual([]);
    expect(st.story).toBeUndefined();
    expect(st.stars).toEqual(base.stars);
    expect(st.rewards.firstClear?.gems).toBeGreaterThan(0);
    // 第一關沒有前置星蝕關，靠章節滿星開放
    expect(resolveStage(eclipseIdOf(ch1[0].id), gameData)!.unlockAfter).toBeNull();
    // Boss 關首通給星核
    const boss = eclipseChapterStages(1, gameData).find((s) => s.waves.some((w) => w.boss))!;
    expect(boss.rewards.firstClear?.cards?.some((c) => ['c916', 'c917', 'c918', 'c919', 'c920'].includes(c.card))).toBe(true);
    // 只有主線有星蝕版；原版 id 照常找到原關卡
    expect(resolveStage('tw-01@eclipse', gameData)).toBeUndefined();
    expect(resolveStage(base.id, gameData)).toBe(base);
  });

  it('戰鬥資料補上星蝕敵人，可以直接開打', () => {
    const st = resolveStage(eclipseIdOf(ch1[8].id), gameData)!;
    const enemies = eclipseEnemies(st, gameData.enemies);
    const battle = startBattle(st, [{ cardId: 'c106', level: 30 }], null, createRng(1), { ...gameData, enemies });
    const first = gameData.enemies.find((e) => e.id === ch1[8].waves[0].enemies[0])!;
    expect(battle.getState().enemies[0].maxHp).toBe(Math.round(first.hp * eclipseScale(1).hp));
  });
});

describe('星蝕：解鎖、結算、星章獎勵', () => {
  it('章節原版滿星才開放，之後依序解鎖', () => {
    const fresh = createNewSave(config, NOW);
    const [e1, e2] = eclipseChapterStages(1, gameData);
    expect(eclipseUnlocked(fresh, 1, gameData.stages, gameData.chapters)).toBe(false);
    expect(eclipseLockReason(fresh, e1, gameData.stages, gameData.chapters)).toBe('chapterNotStarred');
    const save = starredChapter1();
    expect(eclipseLockReason(save, e1, gameData.stages, gameData.chapters)).toBeNull();
    expect(eclipseLockReason(save, e2, gameData.stages, gameData.chapters)).toBe('locked');
  });

  it('通關記在 save.eclipse，不動原版紀錄；首通只發一次', () => {
    const save = starredChapter1();
    const st = eclipseChapterStages(1, gameData)[0];
    const ctx = { stages: gameData.stages };
    const first = completeEclipseStage(save, st, summary, ctx, config, createRng(1), NOW);
    expect(eclipseOf(first.save).cleared).toEqual([ch1[0].id]);
    expect(eclipseOf(first.save).stars[ch1[0].id]?.length).toBe(st.stars?.length ?? 0);
    expect(first.save.progress.clearedStages).toEqual(save.progress.clearedStages);
    expect(first.save.progress.stars).toEqual(save.progress.stars);
    expect(first.result.firstClear).toEqual(st.rewards.firstClear);
    // 升級也可能給星晶，所以只檢查至少拿到首通的量
    expect(first.save.player.gems).toBeGreaterThanOrEqual(save.player.gems + (st.rewards.firstClear?.gems ?? 0));
    expect(first.result.drops).toEqual([]);
    const again = completeEclipseStage(first.save, st, summary, ctx, config, createRng(1), NOW);
    expect(again.result.firstClear).toBeUndefined();
    expect(eclipseLockReason(first.save, eclipseChapterStages(1, gameData)[1], gameData.stages, gameData.chapters)).toBeNull();
  });

  it('星蝕星章全滿可以領一次章節獎勵', () => {
    let save = starredChapter1();
    expect(eclipseRewardStatus(save, 1, gameData.stages)).toBe('incomplete');
    expect(claimEclipseChapterReward(save, 1, gameData.stages, gameData.cards, config, NOW).ok).toBe(false);
    save = { ...save, eclipse: { cleared: ch1.map((s) => s.id), stars: Object.fromEntries(ch1.map((s) => [s.id, (s.stars ?? []).map(() => true)])) } };
    expect(eclipseRewardStatus(save, 1, gameData.stages)).toBe('claimable');
    const r = claimEclipseChapterReward(save, 1, gameData.stages, gameData.cards, config, NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.save.player.gems).toBe(save.player.gems + ECLIPSE.chapterReward.gems);
    expect(eclipseRewardStatus(r.save, 1, gameData.stages)).toBe('claimed');
  });

  it('舊存檔沒有 eclipse 欄位也能讀', () => {
    expect(eclipseOf(createNewSave(config, NOW))).toEqual({ cleared: [], stars: {}, chapterRewardsClaimed: [] });
  });
});
