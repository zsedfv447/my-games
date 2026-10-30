// 轉珠規劃器：以束搜尋（beam search）找出得分最高的拖曳路徑。
// 分數 = 實際傷害（佔場上敵人剩餘生命的比例，0–100）＋ 回復價值 ＋ 流派偏好 ＋ 每 Combo 0.5 基本分。
// 只看玩家轉出的第一層消除（不預測天降），和真人玩家看得到的資訊一致。
// 會把主動技 buff、回復轉攻擊、敵人護盾、心珠封印、不能消除的珠種算進去，和戰鬥模組的結算一致。
import type { LeaderSkillDef } from '../../src/core/types';
import { findMatches, type Board, type Pos } from '../../src/battle/board';
import { applyHits, computeAttacks, computeHeal, type BattleConfig } from '../../src/battle/damage';
import { evaluateLeaderTurn } from '../../src/battle/leader';
import type { BattleState } from '../../src/battle/battle-state';
import { buffAttackMultipliers, teamWithRcvToAtk } from '../../src/battle/skills/buffs';
import { defenseProfile, isHeartSealed, sealedOrbs } from '../../src/battle/skills/status';
import type { Strategy } from './strategies';

export interface PlannerOptions {
  /** 每秒可以拖過幾格（真人約 3–5 格） */
  stepsPerSecond: number;
  beamWidth: number;
  /** 路徑最多幾步（再受轉珠時間限制） */
  maxSteps: number;
}

export const DEFAULT_PLANNER: PlannerOptions = { stepsPerSecond: 4, beamWidth: 24, maxSteps: 24 };

const DIRS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];

interface Node {
  cells: Board['cells'];
  path: Pos[];
  score: number;
}

export function scoreBoard(
  board: Board,
  state: BattleState,
  leaders: (LeaderSkillDef | undefined)[],
  strategy: Strategy,
  config: BattleConfig,
  skillUsedThisTurn = false,
): number {
  const groups = findMatches(board, 0, sealedOrbs(state));
  if (groups.length === 0) return 0;
  const combo = groups.length;
  const hpPercent = (state.hp / state.maxHp) * 100;
  const team = teamWithRcvToAtk(state, state.team);
  const heartSealed = isHeartSealed(state);
  const turn = evaluateLeaderTurn(leaders, {
    team,
    groups: heartSealed ? groups.filter((g) => g.orb !== 'heart') : groups,
    combo,
    hpPercent,
    skillUsedThisTurn,
  });
  const buffMul = buffAttackMultipliers(state);
  const atkMultipliers = turn.atkMultipliers.map((v, i) => v * buffMul[i]);
  const hits = [
    ...computeAttacks({ team, groups, combo, config, atkMultipliers, ignoreDefense: turn.ignoreDefense }),
    ...turn.followUps,
  ];
  const enemies = state.enemies.map((e) => ({ ...defenseProfile(e), hp: e.hp, maxHp: e.maxHp }));
  const before = enemies.reduce((a, e) => a + Math.max(0, e.hp), 0);
  const after = applyHits(hits, enemies, state.target, { combo, config }).hp.reduce((a, h) => a + Math.max(0, h), 0);
  const damageScore = before > 0 ? ((before - after) / before) * 100 : 0;
  const heal = heartSealed ? 0 : computeHeal({ team, groups, combo, config, rcvMultipliers: turn.rcvMultipliers });
  const healScore = (Math.min(heal, state.maxHp - state.hp) / state.maxHp) * 100 * strategy.healWeight(hpPercent);
  const attrs = [...new Set(team.map((m) => m.attribute))];
  const shape = strategy.shape({ groups, combo, mainAttribute: team[0].attribute, teamAttributes: attrs, hpPercent });
  // 每個 Combo 都有一點基本分：沒有傷害時也會消珠換盤面，不會原地不動
  return damageScore + healScore + shape + combo * 0.5;
}

export function planMove(
  state: BattleState,
  leaders: (LeaderSkillDef | undefined)[],
  strategy: Strategy,
  config: BattleConfig,
  opts: PlannerOptions = DEFAULT_PLANNER,
  skillUsedThisTurn = false,
): { path: Pos[]; score: number } {
  const { cols, rows } = state.board;
  const steps = Math.min(opts.maxSteps, Math.floor(state.moveTimeSeconds * opts.stepsPerSecond));
  const evalCells = (cells: Board['cells']) => scoreBoard({ cols, rows, cells }, state, leaders, strategy, config, skillUsedThisTurn);

  let beam: Node[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (state.board.cells[row * cols + col].locked) continue;
      beam.push({ cells: state.board.cells, path: [{ row, col }], score: 0 });
    }
  }
  let best: Node = beam[0] ?? { cells: state.board.cells, path: [], score: 0 };

  for (let depth = 0; depth < steps; depth++) {
    const next: Node[] = [];
    for (const node of beam) {
      const cur = node.path[node.path.length - 1];
      const prev = node.path[node.path.length - 2];
      for (const [dr, dc] of DIRS) {
        const to = { row: cur.row + dr, col: cur.col + dc };
        if (to.row < 0 || to.row >= rows || to.col < 0 || to.col >= cols) continue;
        if (prev && prev.row === to.row && prev.col === to.col) continue;
        const ib = to.row * cols + to.col;
        if (node.cells[ib].locked) continue;
        const cells = node.cells.slice();
        const ia = cur.row * cols + cur.col;
        [cells[ia], cells[ib]] = [cells[ib], cells[ia]];
        const child = { cells, path: [...node.path, to], score: evalCells(cells) };
        next.push(child);
        if (child.score > best.score) best = child;
      }
    }
    if (next.length === 0) break;
    next.sort((a, b) => b.score - a.score);
    beam = next.slice(0, opts.beamWidth);
  }
  return { path: best.path, score: best.score };
}
