import { describe, expect, it } from 'vitest';
import { gameData } from '../src/data/load';
import { createRng } from '../src/core/rng';
import { createNewSave, importSaveCode, exportSaveCode } from '../src/save/save';
import { resumeBattle, startBattle } from '../src/battle/battle-state';
import {
  activeBattleFor, beginActiveBattle, clearActiveBattle, dropSeed, recordBattleSnapshot,
} from '../src/progression/active-battle';
import { completeStage } from '../src/progression/stages';
import { stageContext } from '../src/ui/stage-nav';

const config = gameData.config;
const NOW = Date.UTC(2026, 9, 31, 6, 0, 0);
const stage = gameData.stages.find((s) => s.id === 'st-1-1')!;
const members = [{ cardId: gameData.config.newPlayer.starterCards[0], level: 10, uid: 'u1' }];

const begin = () => beginActiveBattle(createNewSave(config, NOW), { stageId: stage.id, seed: 2024, members, helper: null }, NOW);

describe('進行中的戰鬥（入場券）', () => {
  it('出戰時寫入隊伍與種子，只對同一關有效', () => {
    const save = begin();
    expect(activeBattleFor(save, stage.id)).toEqual({ stageId: stage.id, seed: 2024, members, helper: null, startedAt: NOW, snapshot: null });
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
    const snap = activeBattleFor(loaded.save, stage.id)!.snapshot!;
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
});
