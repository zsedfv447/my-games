// 戰鬥模擬：讓自動轉珠策略打完一場戰鬥，或跑「流派 × 關卡」矩陣並整理成報表。
import type { ArchetypeId, CardDef, LeaderSkillDef, StageDef } from '../../src/core/types';
import { createRng } from '../../src/core/rng';
import { startBattle, type BattleData, type TeamMemberInput } from '../../src/battle/battle-state';
import { DEFAULT_PLANNER, planMove, type PlannerOptions } from './planner';
import { castSkills } from './skills';
import { STRATEGIES } from './strategies';

export interface SimTeam {
  archetype: ArchetypeId;
  members: TeamMemberInput[];
  helper: TeamMemberInput | null;
}

export interface SimOptions {
  /** 超過這個回合數視為失敗（避免打不動時無限迴圈） */
  maxTurns: number;
  planner: PlannerOptions;
}

export const DEFAULT_SIM: SimOptions = { maxTurns: 60, planner: DEFAULT_PLANNER };

export interface BattleOutcome {
  win: boolean;
  turns: number;
  maxCombo: number;
}

export function simulateBattle(
  stage: StageDef,
  team: SimTeam,
  data: BattleData,
  seed: number,
  opts: SimOptions = DEFAULT_SIM,
): BattleOutcome {
  const rng = createRng(seed);
  const battle = startBattle(stage, team.members, team.helper, rng, data);
  const strategy = STRATEGIES[team.archetype];
  const cardById = new Map<string, CardDef>(data.cards.map((c) => [c.id, c]));
  const leaderById = new Map<string, LeaderSkillDef>(data.leaderSkills.map((l) => [l.id, l]));
  const leaderOf = (input: TeamMemberInput | null) => {
    const id = input ? cardById.get(input.cardId)?.leaderSkill : undefined;
    return id ? leaderById.get(id) : undefined;
  };
  const leaders = [leaderOf(team.members[0]), leaderOf(team.helper)];
  const inputs = team.helper ? [...team.members, team.helper] : team.members;
  const skillById = new Map(data.skills.map((s) => [s.id, s]));
  const skillOf = (member: number) => {
    const id = cardById.get(inputs[member]?.cardId ?? '')?.activeSkill;
    return id ? skillById.get(id) : undefined;
  };

  let state = battle.getState();
  while (state.phase === 'player' && state.turns < opts.maxTurns) {
    // 打血最少的敵人，加快清場（單體傷害技能也會打這隻）
    const pickTarget = () => {
      const alive = state.enemies.map((e, i) => ({ e, i })).filter((x) => x.e.hp > 0);
      if (alive.length > 0) battle.setTarget(alive.reduce((a, b) => (b.e.hp < a.e.hp ? b : a)).i);
    };
    pickTarget();
    // 依技能效果與戰況施放主動技（skills.ts）；技能可能直接清掉這一波
    const usedSkill = castSkills(battle, skillOf, team.archetype);
    state = battle.getState();
    if (state.phase !== 'player') break;
    pickTarget();
    state = battle.getState();
    const { path } = planMove(state, leaders, strategy, data.config.battle, opts.planner, usedSkill);
    const r = battle.submitMove(path);
    if (!r.ok) break;
    state = battle.getState();
  }
  return { win: state.phase === 'won', turns: state.turns, maxCombo: state.maxCombo };
}

export interface CellResult {
  archetype: ArchetypeId;
  stageId: string;
  runs: number;
  winRate: number;
  /** 勝場的平均回合數；沒有勝場為 null */
  avgTurns: number | null;
  avgMaxCombo: number;
}

export function simulateMatrix(
  stages: StageDef[],
  teams: SimTeam[],
  data: BattleData,
  runs: number,
  baseSeed = 1,
  opts: SimOptions = DEFAULT_SIM,
): CellResult[] {
  const out: CellResult[] = [];
  for (const stage of stages) {
    for (const team of teams) {
      let wins = 0;
      let winTurns = 0;
      let combos = 0;
      for (let i = 0; i < runs; i++) {
        const r = simulateBattle(stage, team, data, baseSeed + i, opts);
        combos += r.maxCombo;
        if (r.win) {
          wins++;
          winTurns += r.turns;
        }
      }
      out.push({
        archetype: team.archetype,
        stageId: stage.id,
        runs,
        winRate: wins / runs,
        avgTurns: wins > 0 ? winTurns / wins : null,
        avgMaxCombo: combos / runs,
      });
    }
  }
  return out;
}

/** GDD 2.0 平衡目標：同一關各流派的通關回合，與中位數相差不超過 ±20% */
export const BALANCE_TOLERANCE = 0.2;

export interface BalanceFlag {
  archetype: ArchetypeId;
  stageId: string;
  /** 相對中位數的偏差，例如 0.35 = 比中位數多 35% 回合 */
  deviation: number | null;
  reason: 'slow' | 'fast' | 'cannotClear';
}

export function balanceFlags(results: CellResult[], tolerance = BALANCE_TOLERANCE): BalanceFlag[] {
  const flags: BalanceFlag[] = [];
  const byStage = new Map<string, CellResult[]>();
  for (const r of results) byStage.set(r.stageId, [...(byStage.get(r.stageId) ?? []), r]);
  for (const [stageId, cells] of byStage) {
    const turns = cells.map((c) => c.avgTurns).filter((t): t is number => t !== null).sort((a, b) => a - b);
    const median = turns.length === 0 ? null : turns.length % 2 ? turns[(turns.length - 1) / 2] : (turns[turns.length / 2 - 1] + turns[turns.length / 2]) / 2;
    for (const c of cells) {
      if (c.avgTurns === null || median === null) {
        flags.push({ archetype: c.archetype, stageId, deviation: null, reason: 'cannotClear' });
        continue;
      }
      const deviation = c.avgTurns / median - 1;
      if (deviation > tolerance) flags.push({ archetype: c.archetype, stageId, deviation, reason: 'slow' });
      else if (deviation < -tolerance) flags.push({ archetype: c.archetype, stageId, deviation, reason: 'fast' });
    }
  }
  return flags;
}

/** 輸出 Markdown 報表：每格「勝率／平均回合」 */
export function formatReport(results: CellResult[], stageNames: Record<string, string> = {}): string {
  const stages = [...new Set(results.map((r) => r.stageId))];
  const archetypes = [...new Set(results.map((r) => r.archetype))];
  const cell = (a: ArchetypeId, s: string) => {
    const r = results.find((x) => x.archetype === a && x.stageId === s);
    // 稀疏矩陣（例如試煉只跑借用隊伍）沒有的格子留白
    if (!r) return '';
    const pct = `${Math.round(r.winRate * 100)}%`;
    return r.avgTurns === null ? `${pct}／—` : `${pct}／${r.avgTurns.toFixed(1)}`;
  };
  const lines = [
    `| 流派 | ${stages.map((s) => stageNames[s] ?? s).join(' | ')} |`,
    `|---|${stages.map(() => '---').join('|')}|`,
    ...archetypes.map((a) => `| ${STRATEGIES[a].name} | ${stages.map((s) => cell(a, s)).join(' | ')} |`),
  ];
  const flags = balanceFlags(results);
  if (flags.length > 0) {
    lines.push('', `**超出 ±${BALANCE_TOLERANCE * 100}% 平衡目標**`, '');
    for (const f of flags) {
      const where = `${STRATEGIES[f.archetype].name} @ ${stageNames[f.stageId] ?? f.stageId}`;
      lines.push(f.reason === 'cannotClear' ? `- ${where}：打不過` : `- ${where}：${f.deviation! > 0 ? '慢' : '快'} ${Math.round(Math.abs(f.deviation!) * 100)}%`);
    }
  }
  return lines.join('\n');
}
