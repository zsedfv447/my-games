// 戰鬥模擬：讓自動轉珠策略打完一場戰鬥，或跑「流派 × 關卡」矩陣並整理成報表。
import type { ActiveSkillDef, ArchetypeId, CardDef, LeaderSkillDef, SkillEffect, StageDef } from '../../src/core/types';
import { createRng } from '../../src/core/rng';
import { startBattle, type BattleData, type BattleState, type TeamMemberInput } from '../../src/battle/battle-state';
import { DEFAULT_PLANNER, planMove, type PlannerOptions } from './planner';
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
  const skillById = new Map<string, ActiveSkillDef>(data.skills.map((sk) => [sk.id, sk]));
  const inputs = team.helper ? [...team.members, team.helper] : team.members;
  const memberSkills = inputs.map((m) => {
    const id = cardById.get(m.cardId)?.activeSkill;
    return id ? skillById.get(id) : undefined;
  });

  let state = battle.getState();
  while (state.phase === 'player' && state.turns < opts.maxTurns) {
    // 依施放時機與順序放主動技（被封印時 useSkill 會回傳失敗，直接略過）
    let skillUsed = false;
    const ready = state.team
      .map((m, i) => ({ i, skill: memberSkills[i], cd: m.skillCooldown }))
      .filter((x) => x.skill && x.cd === 0)
      .sort((a, b) => castOrder(a.skill!) - castOrder(b.skill!));
    for (const { i, skill } of ready) {
      if (!shouldCast(skill!, battle.getState())) continue;
      if (battle.useSkill(i).ok) skillUsed = true;
    }
    // 打血最少的敵人，加快清場
    const alive = state.enemies.map((e, i) => ({ e, i })).filter((x) => x.e.hp > 0);
    if (alive.length > 0) battle.setTarget(alive.reduce((a, b) => (b.e.hp < a.e.hp ? b : a)).i);
    state = battle.getState();
    const { path } = planMove(state, leaders, strategy, data.config.battle, opts.planner, skillUsed);
    const r = battle.submitMove(path);
    if (!r.ok) break;
    state = battle.getState();
  }
  return { win: state.phase === 'won', turns: state.turns, maxCombo: state.maxCombo };
}

// ---------- 主動技施放時機 ----------

/** 轉珠前施放的順序：先保命、再增益、最後改盤面（改完盤面才轉珠） */
const CAST_ORDER: Record<SkillEffect['type'], number> = {
  heal: 0, cleanse: 0, reduceDamage: 1, surviveOnce: 1, delayEnemy: 1, lockEnemy: 1,
  selfDamage: 2, buffAttack: 3, rcvToAtk: 3, chainOnSkill: 3, reduceAllyCooldown: 3, extendMoveTime: 3,
  damage: 4, damageOverTime: 4, setSkyfallRate: 5, noSkyfallCombo: 5,
  setEnhancedSkyfallRate: 5,
  convertOrbs: 6, enhanceOrbs: 6, refreshBoard: 6, balanceBoard: 6, fillMissingOrbs: 6,
};

const has = (skill: ActiveSkillDef, type: SkillEffect['type']) => skill.effects.some((e) => e.type === type);

/**
 * 這回合要不要放這個技能：
 * - 回血技能只在生命低於 50% 時放；
 * - 自損技能在生命高於 40% 時放（背水：先壓血再攻擊），快死時不放；
 * - 減傷、延遲在敵人下回合要攻擊時放；
 * - 其他（轉珠、強化、增益、傷害）好了就放。
 */
export function shouldCast(skill: ActiveSkillDef, state: BattleState): boolean {
  const hp = (state.hp / state.maxHp) * 100;
  const pureHeal = skill.effects.every((e) => e.type === 'heal' || e.type === 'cleanse');
  if (pureHeal) return hp < 50;
  if (has(skill, 'selfDamage')) return hp > 40;
  const defensive = skill.effects.every((e) => ['reduceDamage', 'delayEnemy', 'lockEnemy', 'surviveOnce'].includes(e.type));
  if (defensive) return state.enemies.some((e) => e.hp > 0 && e.cooldown <= 1);
  return true;
}

export function castOrder(skill: ActiveSkillDef): number {
  return Math.max(...skill.effects.map((e) => CAST_ORDER[e.type] ?? 3));
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
