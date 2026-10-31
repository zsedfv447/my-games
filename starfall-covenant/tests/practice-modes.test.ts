import { describe, expect, it } from 'vitest';
import { applyPath, findMatches, type Board, type Pos } from '../src/battle/board';
import { startBattle } from '../src/battle/battle-state';
import { bus, EventBus, type GameEvents } from '../src/core/events';
import { createRng } from '../src/core/rng';
import { gameData } from '../src/data/load';
import { subscribeQuestCounters } from '../src/progression/quests';
import { createNewSave } from '../src/save/save';
import { battlePolicy } from '../src/ui/battle-policy';
import { DEMO_HELPER, DEMO_TEAM, PRACTICE_MECHANIC_HP, PRACTICE_MODES, practiceSetup } from '../src/ui/demo';

const stageKindOf = (id: string) => gameData.stages.find((s) => s.id === id)?.kind;
const fresh = () => createNewSave(gameData.config, new Date(2026, 10, 2, 12).getTime());

/** 找一條直線拖曳能消除的路徑 */
function anyMatch(board: Board): Pos[] {
  for (let i = 0; i < board.cells.length; i++) {
    const a = { row: Math.floor(i / board.cols), col: i % board.cols };
    for (const [dr, dc] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
      const path = [a];
      for (let k = 1; k <= 5; k++) {
        const p = { row: a.row + dr * k, col: a.col + dc * k };
        if (p.row < 0 || p.col < 0 || p.row >= board.rows || p.col >= board.cols) break;
        path.push(p);
        if (findMatches(applyPath(board, path).board).length) return [...path];
      }
    }
  }
  return [];
}

describe('練習與教學不影響存檔', () => {
  it('練習場、新手教學：不扣體力、不給獎勵、不寫手札、不發關卡事件、不存續戰、續戰免費', () => {
    const none = { costsStamina: false, grantsRewards: false, recordsNotebook: false, emitsStageEvents: false, savesProgress: false, paidContinue: false };
    expect(battlePolicy({ practice: true })).toEqual(none);
    expect(battlePolicy({ practice: true, tutorial: true })).toEqual(none);
    expect(Object.values(battlePolicy({ practice: false })).every(Boolean)).toBe(true);
  });

  it('練習場不是正式關卡', () => {
    expect(stageKindOf('practice')).toBeUndefined();
    expect(stageKindOf('tutorial')).toBeUndefined();
  });

  it('任務計數：練習場與教學的轉珠不算，正式關卡照算；沒帶關卡的舊事件照算', () => {
    const local = new EventBus<GameEvents>();
    let s = fresh();
    const off = subscribeQuestCounters(local, (fn) => { s = fn(s); }, gameData.quests, stageKindOf, () => Date.now());
    local.emit('comboResolved', { combo: 9, orbsCleared: 30, stageId: 'practice' });
    local.emit('comboResolved', { combo: 9, orbsCleared: 30, stageId: 'tutorial' });
    expect(s.quests.counters.comboTotal ?? 0).toBe(0);
    local.emit('comboResolved', { combo: 4, orbsCleared: 12, stageId: gameData.stages[0].id });
    expect(s.quests.counters.comboTotal).toBe(4);
    local.emit('comboResolved', { combo: 2, orbsCleared: 6 });
    expect(s.quests.counters.comboTotal).toBe(6);
    off();
  });

  it('實際打練習場：轉珠事件帶著練習場的關卡 id，任務計數不變', () => {
    let s = fresh();
    const off = subscribeQuestCounters(bus, (fn) => { s = fn(s); }, gameData.quests, stageKindOf, () => Date.now());
    const seen: (string | undefined)[] = [];
    const offSeen = bus.on('comboResolved', (e) => seen.push(e.stageId));
    for (const m of PRACTICE_MODES) {
      const { stage, data } = practiceSetup(m.id);
      const b = startBattle(stage, DEMO_TEAM, DEMO_HELPER, createRng(3), data);
      b.submitMove(anyMatch(b.getState().board));
    }
    off();
    offSeen();
    expect(seen.length).toBe(PRACTICE_MODES.length);
    expect(seen.every((id) => id === 'practice')).toBe(true);
    expect(s.quests.counters).toEqual(fresh().quests.counters);
  });
});

describe('練習模式', () => {
  it('每種模式都有說明', () => {
    // 機制示範在前，後面接戰術課（tests/drills.test.ts）
    expect(PRACTICE_MODES.map((m) => m.id).slice(0, 5)).toEqual(['normal', 'darkOrbs', 'attributeSeal', 'percentFollowUp', 'ringShield']);
    for (const m of PRACTICE_MODES) expect(m.description.length).toBeGreaterThan(8);
  });

  it('機制示範敵人的生命只在練習場調整，正式資料不變', () => {
    for (const [mode, id] of [['darkOrbs', 'e0046'], ['attributeSeal', 'e0047']] as const) {
      const { data } = practiceSetup(mode);
      expect(data.enemies.find((e) => e.id === id)?.hp).toBe(PRACTICE_MECHANIC_HP);
      expect(gameData.enemies.find((e) => e.id === id)?.hp).not.toBe(PRACTICE_MECHANIC_HP);
    }
  });

  it('打得很好（每回合 3 萬）也撐得過 3 回合，至少看到開場和第 3 回合兩次機制', () => {
    for (const [mode, id] of [['darkOrbs', 'e0046'], ['attributeSeal', 'e0047']] as const) {
      const def = practiceSetup(mode).data.enemies.find((e) => e.id === id)!;
      const every = Number(def.abilities.find((a) => a.trigger === 'everyNTurns')?.params?.n);
      expect(def.abilities.some((a) => a.trigger === 'onStart' && a.status === mode)).toBe(true);
      expect(Math.ceil(def.hp / 30000)).toBeGreaterThan(every);
    }
  });
});
