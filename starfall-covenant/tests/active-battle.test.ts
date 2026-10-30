import { describe, expect, it } from 'vitest';
import { gameData } from '../src/data/load';
import { createRng } from '../src/core/rng';
import { createNewSave, importSaveCode, exportSaveCode } from '../src/save/save';
import { resumeBattle, startBattle } from '../src/battle/battle-state';
import {
  activeBattleFor, beginActiveBattle, clearActiveBattle, dropSeed, recordBattleSnapshot, sanitizeActiveBattle,
} from '../src/progression/active-battle';
import { parseSave, serializeSave } from '../src/save/save';
import { completeStage } from '../src/progression/stages';
import { stageContext } from '../src/ui/stage-nav';

const config = gameData.config;
const NOW = Date.UTC(2026, 9, 31, 6, 0, 0);
const stage = gameData.stages.find((s) => s.id === 'st-1-1')!;
const members = [{ cardId: gameData.config.newPlayer.starterCards[0], level: 10, uid: 'u1' }];

const plan = { stageId: stage.id, drops: [{ cardId: 'c0901', level: 3, wave: 0, enemy: 0 }] };
const begin = () => beginActiveBattle(createNewSave(config, NOW), { stageId: stage.id, seed: 2024, members, helper: null, drops: plan }, NOW);

describe('進行中的戰鬥（入場券）', () => {
  it('出戰時寫入隊伍與種子，只對同一關有效', () => {
    const save = begin();
    expect(activeBattleFor(save, stage.id)).toEqual({ stageId: stage.id, seed: 2024, members, helper: null, drops: plan, startedAt: NOW, snapshot: null });
    expect(activeBattleFor(save, 'st-1-2')).toBeNull();
    expect(clearActiveBattle(save).activeBattle).toBeNull();
  });

  it('同一個種子開出同一個盤面：重新整理不能重骰開場', () => {
    const a = startBattle(stage, members, null, createRng(2024), gameData);
    const b = startBattle(stage, members, null, createRng(2024), gameData);
    expect(a.getState().board).toEqual(b.getState().board);
  });

  it('快照存進存檔、匯出匯入後還原，狀態一致', () => {
    const battle = startBattle(stage, members, null, createRng(2024), gameData);
    battle.submitMove([]);
    const save = recordBattleSnapshot(begin(), battle.snapshot());
    const loaded = importSaveCode(exportSaveCode(save), config, NOW);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    const active = activeBattleFor(loaded.save, stage.id)!;
    // 進場骰好的掉落跟著存檔走，存快照與存讀之後都不變
    expect(active.drops).toEqual(plan);
    const snap = active.snapshot!;
    expect(resumeBattle(stage, snap, gameData).getState()).toEqual(battle.getState());
  });

  it('戰鬥已放棄（存檔沒有這一關）時，不會被舊快照寫回來', () => {
    const battle = startBattle(stage, members, null, createRng(1), gameData);
    const cleared = clearActiveBattle(begin());
    expect(recordBattleSnapshot(cleared, battle.snapshot())).toBe(cleared);
  });

  it('掉落由出戰種子決定：同一場戰鬥結算幾次掉落都一樣', () => {
    const active = activeBattleFor(begin(), stage.id)!;
    const summary = { turns: 3, usedActiveSkill: false, maxCombo: 4, continues: 0, team: [] };
    const roll = () => completeStage(begin(), stage, summary, stageContext(gameData.stages), config, createRng(dropSeed(active)), NOW).result.drops;
    expect(roll()).toEqual(roll());
    expect(dropSeed(active)).not.toBe(active.seed);
  });

  it('進行中的戰鬥壞掉時讀檔直接丟掉，其他進度照常讀進來', () => {
    const good = begin();
    expect(sanitizeActiveBattle(good.activeBattle)).toEqual(good.activeBattle);
    const broken = [
      'garbage', 42, [], { ...good.activeBattle, members: [] }, { ...good.activeBattle, seed: 'x' },
      { ...good.activeBattle, drops: { stageId: 'other', drops: [] } }, { ...good.activeBattle, snapshot: { stageId: 'other', state: {} } },
      { ...good.activeBattle, helper: { level: 1 } },
    ];
    for (const bad of broken) {
      const save = { ...good, player: { ...good.player, coin: 777 }, activeBattle: bad } as unknown as typeof good;
      const r = parseSave(serializeSave(save), config, NOW);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.save.activeBattle).toBeNull();
      expect(r.save.player.coin).toBe(777);
    }
  });
});
