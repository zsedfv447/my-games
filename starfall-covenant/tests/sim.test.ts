import { describe, expect, it } from 'vitest';
import { boardFromStrings } from '../src/battle/board';
import { startBattle } from '../src/battle/battle-state';
import { createRng } from '../src/core/rng';
import { ARCHETYPE_IDS } from '../src/core/types';
import { validateGameData } from '../src/data/validate';
import { gameData } from '../src/data/load';
import { benchmarkStages, fixtureData, starterTeams } from '../tools/sim/fixtures';
import { planMove, scoreBoard } from '../tools/sim/planner';
import { balanceFlags, formatReport, simulateBattle, simulateMatrix, type CellResult } from '../tools/sim/simulate';
import { STRATEGIES } from '../tools/sim/strategies';

const config = fixtureData.config.battle;
const FAST = { maxTurns: 40, planner: { stepsPerSecond: 4, beamWidth: 8, maxSteps: 12 } };

function battleState(archetype: (typeof ARCHETYPE_IDS)[number], rows?: string[]) {
  const team = starterTeams().find((t) => t.archetype === archetype)!;
  const b = startBattle(benchmarkStages[0], team.members, team.helper, createRng(1), fixtureData);
  const state = b.getState();
  if (rows) state.board = boardFromStrings(rows);
  const leaderOf = (id: string) => fixtureData.leaderSkills.find((l) => l.id === fixtureData.cards.find((c) => c.id === id)?.leaderSkill);
  return { state, leaders: [leaderOf(team.members[0].cardId), leaderOf(team.helper!.cardId)] };
}

describe('模擬器資料', () => {
  it('提案 001 的暫定資料能通過資料驗證', () => {
    const data = { ...gameData, ...fixtureData, stages: benchmarkStages, chapters: [] };
    expect(validateGameData(data)).toEqual([]);
  });

  it('12 個流派都有策略和免抽入門隊', () => {
    for (const id of ARCHETYPE_IDS) expect(STRATEGIES[id].id).toBe(id);
    expect(starterTeams().map((t) => t.archetype)).toEqual([...ARCHETYPE_IDS]);
  });
});

describe('轉珠規劃器', () => {
  // f 焰 w 潮 g 森 l 輝 d 蝕 h 心
  const rows = ['ffwgld', 'wgfldh', 'gldhfw', 'ldhfwg', 'dhfwgl'];

  it('找到的路徑分數不低於不動', () => {
    const { state, leaders } = battleState('combo', rows);
    const still = scoreBoard(state.board, state, leaders, STRATEGIES.combo, config);
    const plan = planMove(state, leaders, STRATEGIES.combo, config, FAST.planner);
    expect(plan.path.length).toBeGreaterThan(1);
    expect(plan.score).toBeGreaterThan(still);
  });

  it('路徑長度受轉珠時間限制', () => {
    const { state, leaders } = battleState('combo', rows);
    state.moveTimeSeconds = 1;
    expect(planMove(state, leaders, STRATEGIES.combo, config, { stepsPerSecond: 4, beamWidth: 8, maxSteps: 30 }).path.length).toBeLessThanOrEqual(5);
  });

  it('流派偏好：連擊喜歡多組，長串喜歡一大串', () => {
    const g = (orb: 'fire' | 'heart', n: number) => ({ orb, cells: Array.from({ length: n }, (_, i) => i), enhancedCount: 0, poisonCount: 0, cascade: 0 });
    const ctx = (groups: ReturnType<typeof g>[]) => ({ groups, combo: groups.length, mainAttribute: 'fire' as const, teamAttributes: ['fire' as const], hpPercent: 100 });
    const threeSmall = ctx([g('fire', 3), g('fire', 3), g('fire', 3)]);
    const oneLong = ctx([g('fire', 9)]);
    expect(STRATEGIES.combo.shape(threeSmall)).toBeGreaterThan(STRATEGIES.combo.shape(oneLong));
    expect(STRATEGIES.chain.shape(oneLong)).toBeGreaterThan(STRATEGIES.chain.shape(threeSmall));
    expect(STRATEGIES.fixed.shape(ctx([g('heart', 3)]))).toBeGreaterThan(STRATEGIES.fixed.shape(ctx([g('fire', 3)])));
    expect(STRATEGIES.berserk.healWeight(80)).toBeLessThan(0);
  });
});

describe('戰鬥模擬', () => {
  it('同一種子結果相同，且能打贏標準關卡', () => {
    const team = starterTeams().find((t) => t.archetype === 'rainbow')!;
    const a = simulateBattle(benchmarkStages[0], team, fixtureData, 3, FAST);
    const b = simulateBattle(benchmarkStages[0], team, fixtureData, 3, FAST);
    expect(a).toEqual(b);
    expect(a.win).toBe(true);
  });

  it('矩陣與報表', () => {
    const teams = starterTeams().filter((t) => t.archetype === 'combo' || t.archetype === 'mono');
    const results = simulateMatrix([benchmarkStages[1]], teams, fixtureData, 2, 1, FAST);
    expect(results).toHaveLength(2);
    expect(formatReport(results)).toContain('| 連擊狂潮 |');
  });

  it('平衡檢查：超過中位數 ±20% 或打不過會被標出', () => {
    const cell = (archetype: CellResult['archetype'], avgTurns: number | null): CellResult =>
      ({ archetype, stageId: 's', runs: 1, winRate: avgTurns === null ? 0 : 1, avgTurns, avgMaxCombo: 0 });
    const flags = balanceFlags([cell('mono', 10), cell('combo', 10), cell('chain', 13), cell('heart', 7), cell('fixed', null)]);
    expect(flags).toEqual([
      { archetype: 'chain', stageId: 's', deviation: expect.closeTo(0.3, 5), reason: 'slow' },
      { archetype: 'heart', stageId: 's', deviation: expect.closeTo(-0.3, 5), reason: 'fast' },
      { archetype: 'fixed', stageId: 's', deviation: null, reason: 'cannotClear' },
    ]);
  });
});
