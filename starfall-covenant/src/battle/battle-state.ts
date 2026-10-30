// 戰鬥對外介面：startBattle(stage, team, helper, rng) 與戰鬥事件。
// 介面與關卡模擬器只透過這裡操作戰鬥；內部再呼叫 board / damage / leader / skills。
//
// v0 範圍：轉珠 → 消除 → 隊長技 → 傷害與回復 → 敵人倒數攻擊 → 換波／勝敗、續戰。
// 尚未實作（之後的 PR 補上，介面不變）：主動技效果、敵人技能與異常狀態。

import { bus, EventBus } from '../core/events';
import type { Rng } from '../core/rng';
import type { CardDef, EnemyDef, GameConfig, LeaderSkillDef, OwnedCard, StageDef } from '../core/types';
import { gameData } from '../data/load';
import type { GameData } from '../data/validate';
import { applyPath, createBoard, resolveBoard, type Board, type MatchGroup, type Pos } from './board';
import {
  applyHits,
  computeAttacks,
  computeHeal,
  incomingDamage,
  poisonOrbDamage,
  type BattleMember,
  type HitResult,
} from './damage';
import { evaluateLeaderStatic, evaluateLeaderTurn } from './leader';

// ---------- 輸入 ----------

/** 出戰卡片：取自存檔的 OwnedCard，助戰可只給 cardId 與等級 */
export type TeamMemberInput = Pick<OwnedCard, 'cardId' | 'level'> &
  Partial<Pick<OwnedCard, 'uid' | 'skillLevel' | 'limitBreak' | 'awakened'>>;

/** 戰鬥需要的資料；不傳時用 data/*.json，測試與模擬器可傳假資料 */
export type BattleData = Pick<GameData, 'config' | 'cards' | 'skills' | 'leaderSkills' | 'enemies'>;

// ---------- 狀態快照（唯讀，給介面繪製） ----------

export type BattlePhase = 'player' | 'won' | 'lost';

export interface MemberState extends BattleMember {
  /** 0 = 隊長，最後一位為助戰 */
  index: number;
  isHelper: boolean;
  card: CardDef;
  /** 主動技剩餘冷卻；0 = 可施放；沒有主動技為 null */
  skillCooldown: number | null;
}

export interface EnemyState {
  def: EnemyDef;
  hp: number;
  maxHp: number;
  /** 距離攻擊還有幾回合 */
  cooldown: number;
  maxCooldown: number;
}

export interface BattleState {
  stageId: string;
  phase: BattlePhase;
  /** 目前波數（0 起算）與總波數 */
  wave: number;
  waveCount: number;
  board: Board;
  team: MemberState[];
  hp: number;
  maxHp: number;
  enemies: EnemyState[];
  /** 單體攻擊的目標敵人 */
  target: number;
  /** 本回合轉珠時限（秒） */
  moveTimeSeconds: number;
  /** 已完成的轉珠回合數 */
  turns: number;
  maxCombo: number;
  usedActiveSkill: boolean;
  continues: number;
}

// ---------- 事件 ----------

export interface TurnSummary {
  turn: number;
  groups: MatchGroup[];
  combo: number;
  hits: HitResult[];
  heal: number;
  poisonDamage: number;
}

export interface EnemyAttack {
  enemy: number;
  damage: number;
}

export interface BattleEvents extends Record<string, unknown> {
  battleStart: { state: BattleState };
  waveStart: { wave: number; enemies: EnemyState[] };
  /** 轉珠結算完（傷害已扣、回復已加），介面據此播放消除與傷害動畫 */
  turnResolved: TurnSummary;
  enemyDefeated: { enemy: number; enemyId: string };
  enemyAttack: EnemyAttack;
  waveCleared: { wave: number };
  battleEnd: { result: BattleResult };
  continued: { continues: number };
}

// ---------- 結算 ----------

export interface BattleResult {
  stageId: string;
  outcome: 'win' | 'lose' | 'forfeit';
  turns: number;
  maxCombo: number;
  usedActiveSkill: boolean;
  continues: number;
  /** 全隊卡片 id（含助戰），供星章 teamAll 判定 */
  teamCardIds: string[];
}

export type ActionError = { ok: false; reason: string };
export type ActionResult<T> = ({ ok: true } & T) | ActionError;

// ---------- 戰鬥物件 ----------

export interface Battle {
  readonly events: EventBus<BattleEvents>;
  /** 目前狀態的快照（每次呼叫都是新物件，可安全保存） */
  getState(): BattleState;
  setTarget(enemy: number): ActionResult<object>;
  /** 轉珠前施放主動技（v0 尚未實作效果） */
  useSkill(member: number): ActionResult<object>;
  /** 送出一次轉珠路徑：結算消除、傷害、敵人行動、換波與勝敗 */
  submitMove(path: Pos[]): ActionResult<{ summary: TurnSummary; enemyAttacks: EnemyAttack[] }>;
  /** 失敗後續戰：回滿生命 */
  continueBattle(): ActionResult<object>;
  forfeit(): BattleResult;
  /** 戰鬥結束後才有值 */
  getResult(): BattleResult | null;
}

/** 毒珠每顆扣最大生命的百分比（之後可移到 config） */
const POISON_ORB_PERCENT = 5;

/** 等級對應數值：Lv1 到 LvMax 依 growthCurve 曲線插值 */
export function statsAtLevel(card: CardDef, level: number): Pick<BattleMember, 'hp' | 'atk' | 'rcv'> {
  const t = card.maxLevel <= 1 ? 1 : Math.min(1, Math.max(0, (level - 1) / (card.maxLevel - 1))) ** card.growthCurve;
  const at = ([min, max]: [number, number]) => Math.round(min + (max - min) * t);
  return { hp: at(card.stats.hp), atk: at(card.stats.atk), rcv: at(card.stats.rcv) };
}

export function startBattle(
  stage: StageDef,
  team: TeamMemberInput[],
  helper: TeamMemberInput | null,
  rng: Rng,
  data: BattleData = gameData,
): Battle {
  const config: GameConfig = data.config;
  const byId = <T extends { id: string }>(list: T[], id: string, kind: string): T => {
    const found = list.find((x) => x.id === id);
    if (!found) throw new Error(`找不到${kind} ${id}`);
    return found;
  };
  if (team.length === 0) throw new Error('隊伍至少要 1 名成員');
  if (stage.waves.length === 0) throw new Error(`關卡 ${stage.id} 沒有敵人`);

  const inputs = helper ? [...team, helper] : [...team];
  const cards = inputs.map((m) => byId(data.cards, m.cardId, '卡片'));
  const leaders: (LeaderSkillDef | undefined)[] = [cards[0], helper ? cards[cards.length - 1] : undefined].map(
    (c) => (c?.leaderSkill ? byId(data.leaderSkills, c.leaderSkill, '隊長技') : undefined),
  );

  const baseMembers: BattleMember[] = cards.map((card, i) => ({
    cardId: card.id,
    attribute: card.attribute,
    race: card.race,
    ...statsAtLevel(card, inputs[i].level),
    passives: card.awakenings?.slice(0, inputs[i].awakened ?? 0),
  }));
  const leaderStatic = evaluateLeaderStatic(leaders, baseMembers);

  const members: MemberState[] = baseMembers.map((m, i) => {
    const skill = cards[i].activeSkill ? byId(data.skills, cards[i].activeSkill!, '主動技') : undefined;
    return {
      ...m,
      hp: Math.round(m.hp * leaderStatic.hpMultipliers[i]),
      rcv: Math.round(m.rcv * leaderStatic.rcvMultipliers[i]),
      index: i,
      isHelper: !!helper && i === cards.length - 1,
      card: cards[i],
      skillCooldown: skill ? (leaderStatic.skillsStartCharged ? 0 : skill.cooldown.max) : null,
    };
  });
  const maxHp = members.reduce((sum, m) => sum + m.hp, 0);
  const boardSize = leaderStatic.boardSize ?? config.board;

  const spawnWave = (wave: number): EnemyState[] =>
    stage.waves[wave].enemies.map((id) => {
      const def = byId(data.enemies, id, '敵人');
      const maxCooldown = def.cd + leaderStatic.enemyCooldownPlus;
      return { def, hp: def.hp, maxHp: def.hp, cooldown: maxCooldown, maxCooldown };
    });

  const state: BattleState = {
    stageId: stage.id,
    phase: 'player',
    wave: 0,
    waveCount: stage.waves.length,
    board: createBoard(boardSize, rng),
    team: members,
    hp: maxHp,
    maxHp,
    enemies: spawnWave(0),
    target: 0,
    moveTimeSeconds: config.board.moveTimeSeconds + leaderStatic.moveTimeBonus,
    turns: 0,
    maxCombo: 0,
    usedActiveSkill: false,
    continues: 0,
  };

  const events = new EventBus<BattleEvents>();
  let result: BattleResult | null = null;
  let skillUsedThisTurn = false;

  const snapshot = (): BattleState => ({
    ...state,
    board: { ...state.board, cells: state.board.cells.map((o) => ({ ...o })) },
    team: state.team.map((m) => ({ ...m })),
    enemies: state.enemies.map((e) => ({ ...e })),
  });
  const fail = (reason: string): ActionError => ({ ok: false, reason });
  const finish = (outcome: BattleResult['outcome']): BattleResult => {
    result = {
      stageId: stage.id,
      outcome,
      turns: state.turns,
      maxCombo: state.maxCombo,
      usedActiveSkill: state.usedActiveSkill,
      continues: state.continues,
      teamCardIds: cards.map((c) => c.id),
    };
    events.emit('battleEnd', { result });
    return result;
  };
  const firstAlive = () => state.enemies.findIndex((e) => e.hp > 0);

  const battle: Battle = {
    events,
    getState: snapshot,
    getResult: () => result,

    setTarget(enemy) {
      if (!state.enemies[enemy] || state.enemies[enemy].hp <= 0) return fail('目標不存在或已倒下');
      state.target = enemy;
      return { ok: true };
    },

    useSkill(member) {
      if (state.phase !== 'player') return fail('戰鬥已結束');
      const m = state.team[member];
      if (!m || m.skillCooldown === null) return fail('這名隊員沒有主動技');
      if (m.skillCooldown > 0) return fail('主動技冷卻中');
      return fail('主動技效果尚未實作');
    },

    submitMove(path) {
      if (state.phase !== 'player') return fail('戰鬥已結束');
      const moved = applyPath(state.board, path);
      const { board, groups, combo } = resolveBoard(moved.board, rng);
      state.board = board;
      state.turns++;
      state.maxCombo = Math.max(state.maxCombo, combo);

      const team = state.team;
      const turn = evaluateLeaderTurn(leaders, {
        team,
        groups,
        combo,
        hpPercent: (state.hp / state.maxHp) * 100,
        skillUsedThisTurn,
      });
      const hits = [
        ...computeAttacks({ team, groups, combo, config: config.battle, atkMultipliers: turn.atkMultipliers, ignoreDefense: turn.ignoreDefense }),
        ...turn.followUps,
      ];
      const enemyTargets = state.enemies.map((e) => ({ ...e.def, hp: e.hp }));
      const applied = applyHits(hits, enemyTargets, state.target, { combo, config: config.battle });
      const heal = computeHeal({ team, groups, combo, config: config.battle, rcvMultipliers: turn.rcvMultipliers });
      const poison = poisonOrbDamage(groups, state.maxHp, POISON_ORB_PERCENT);
      state.hp = Math.max(0, Math.min(state.maxHp, state.hp + heal - poison));

      const summary: TurnSummary = { turn: state.turns, groups, combo, hits: applied.results, heal, poisonDamage: poison };
      state.enemies.forEach((e, i) => {
        const before = e.hp;
        e.hp = applied.hp[i];
        if (before > 0 && e.hp <= 0) events.emit('enemyDefeated', { enemy: i, enemyId: e.def.id });
      });
      events.emit('turnResolved', summary);
      // 任務與成就計數用全遊戲事件
      bus.emit('comboResolved', { combo, orbsCleared: groups.reduce((sum, g) => sum + g.cells.length, 0) });

      // 敵人行動：每回合倒數 −1，歸零攻擊並重置
      const enemyAttacks: EnemyAttack[] = [];
      if (state.hp > 0) {
        state.enemies.forEach((e, i) => {
          if (e.hp <= 0) return;
          e.cooldown--;
          if (e.cooldown > 0) return;
          e.cooldown = e.maxCooldown;
          const damage = incomingDamage(e.def.atk, turn.damageReductions);
          state.hp = Math.max(0, state.hp - damage);
          const attack = { enemy: i, damage };
          enemyAttacks.push(attack);
          events.emit('enemyAttack', attack);
        });
      }

      // 主動技冷卻
      for (const m of state.team) if (m.skillCooldown) m.skillCooldown--;
      skillUsedThisTurn = false;

      if (state.hp <= 0) {
        state.phase = 'lost';
        finish('lose');
      } else if (firstAlive() < 0) {
        events.emit('waveCleared', { wave: state.wave });
        if (state.wave + 1 >= state.waveCount) {
          state.phase = 'won';
          finish('win');
        } else {
          state.wave++;
          state.enemies = spawnWave(state.wave);
          state.target = 0;
          events.emit('waveStart', { wave: state.wave, enemies: snapshot().enemies });
        }
      } else if (state.enemies[state.target].hp <= 0) {
        state.target = firstAlive();
      }
      return { ok: true, summary, enemyAttacks };
    },

    continueBattle() {
      if (state.phase !== 'lost') return fail('只有失敗時可以續戰');
      state.phase = 'player';
      state.hp = state.maxHp;
      state.continues++;
      result = null;
      events.emit('continued', { continues: state.continues });
      return { ok: true };
    },

    forfeit() {
      state.phase = 'lost';
      return finish('forfeit');
    },
  };

  // 讓呼叫端先訂閱事件再收到開場事件
  queueMicrotask(() => {
    events.emit('battleStart', { state: snapshot() });
    events.emit('waveStart', { wave: 0, enemies: snapshot().enemies });
  });
  return battle;
}
