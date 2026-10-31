// 戰鬥對外介面：startBattle(stage, team, helper, rng) 與戰鬥事件。
// 介面與關卡模擬器只透過這裡操作戰鬥；內部再呼叫 board / damage / leader / skills。
// 介面已定案：之後只新增欄位與事件，不改現有簽名。
//
// 一回合的順序（submitMove）：
// 1. 轉珠 → 消除與落下（天降依主動技 buff）
// 2. 隊長技 → 我方攻擊、追打、心珠回復、毒珠扣血
// 3. 敵人持續傷害結算 → 敵人 hpBelow 技能
// 4. 敵人行動：被鎖定的跳過；倒數 −1，歸零時攻擊（狂暴、連擊分段、減傷、瀕死保命）→ onAttack 技能；everyNTurns 技能
// 5. 我方中毒扣血
// 6. 經過一回合：buff、異常狀態、敵人鎖定回合 −1；主動技冷卻 −1（再加隊長技 allyCooldownPerTurn）
// 7. 判定勝敗與換波

import { bus, EventBus } from '../core/events';
import { createRng, type Rng } from '../core/rng';
import type { Attribute, CardDef, GameConfig, LeaderSkillDef, OrbType, OwnedCard, StageDef } from '../core/types';
import { gameData } from '../data/load';
import type { GameData } from '../data/validate';
import { applyPath, createBoard, resolveBoard, type Board, type MatchGroup, type Pos, type ResolveStep } from './board';
import {
  applyHits,
  computeAttacks,
  computeHeal,
  incomingDamage,
  poisonOrbDamage,
  type BattleMember,
  type Hit,
  type HitResult,
} from './damage';
import { evaluateLeaderStatic, evaluateLeaderTurn } from './leader';
import type { BattleState, EnemyState, MemberState, StatusInstance } from './runtime';
import { applyActiveSkill, cooldownAtLevel } from './skills/active';
import { breakRingSlots } from './skills/ring';
import {
  buffAttackMultipliers,
  buffDamageReductions,
  buffMoveTime,
  consumeSurviveOnce,
  skyfallOptions,
  teamWithRcvToAtk,
  tickBuffs,
} from './skills/buffs';
import {
  addStatus,
  abilitiesToTrigger,
  applyEnemyAbility,
  attributeSealMultipliers,
  defenseProfile,
  enemyAtkMultiplier,
  enemyHitCount,
  isHeartSealed,
  isMemberSealed,
  isSkillSealed,
  moveTimePenalty,
  poisonPercent,
  releaseBoardStatus,
  sealedOrbs,
  STATUS_INFO,
  tickStatuses,
  type StatusSide,
} from './skills/status';

export type { BattlePhase, BattleState, Buff, DamageOverTime, EnemyState, MemberState, StatusInstance } from './runtime';

// ---------- 輸入 ----------

/** 出戰卡片：取自存檔的 OwnedCard，助戰可只給 cardId 與等級 */
export type TeamMemberInput = Pick<OwnedCard, 'cardId' | 'level'> &
  Partial<Pick<OwnedCard, 'uid' | 'skillLevel' | 'limitBreak' | 'awakened'>>;

/** 戰鬥需要的資料；不傳時用 data/*.json，測試與模擬器可傳假資料 */
export type BattleData = Pick<GameData, 'config' | 'cards' | 'skills' | 'leaderSkills' | 'enemies'>;

// ---------- 事件 ----------

export interface TurnSummary {
  turn: number;
  groups: MatchGroup[];
  combo: number;
  hits: HitResult[];
  heal: number;
  poisonDamage: number;
  /** 持續傷害（主動技 damageOverTime） */
  dotHits: HitResult[];
  /** 轉珠放手後的盤面（第一段消除前） */
  movedBoard: Board;
  /** 逐段的「消除 → 落下補珠」，介面依序播放；沒有消除時為空陣列 */
  steps: ResolveStep[];
}

export interface EnemyAttack {
  enemy: number;
  /** 本次攻擊的總傷害（連擊時為各下加總） */
  damage: number;
  /** 攻擊次數 */
  hits: number;
  /** 瀕死保命是否在這次攻擊觸發 */
  survived: boolean;
}

export interface SkillUsed {
  member: number;
  skillId: string;
  hits: HitResult[];
  heal: number;
  selfDamage: number;
  boardChanged: boolean;
  /** 被延遲或鎖定的敵人 */
  delayed: number[];
}

export interface StatusEvent {
  side: StatusSide;
  /** side = 'enemy' 時是哪一隻敵人 */
  enemy?: number;
  status: StatusInstance;
}

export interface BattleEvents extends Record<string, unknown> {
  battleStart: { state: BattleState };
  waveStart: { wave: number; enemies: EnemyState[] };
  /** 主動技施放完（傷害已扣、盤面已變），介面據此播放技能動畫 */
  skillUsed: SkillUsed;
  /** 轉珠以外造成的盤面變化（主動技、敵人技能），介面據此重畫盤面 */
  boardChanged: { board: Board; reason: 'skill' | 'enemy' | 'status' };
  /** 轉珠結算完（傷害已扣、回復已加），介面據此播放消除與傷害動畫 */
  turnResolved: TurnSummary;
  enemyDefeated: { enemy: number; enemyId: string };
  enemyAttack: EnemyAttack;
  statusApplied: StatusEvent & { resisted: boolean };
  statusExpired: StatusEvent;
  /** 我方中毒扣血 */
  poisonTick: { damage: number };
  waveCleared: { wave: number };
  /** 七曜環點掉了格子；shattered = 全部點掉、環碎裂 */
  ringBroken: { enemy: number; broken: OrbType[]; shattered: boolean };
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
  /** 轉珠前施放主動技 */
  useSkill(member: number): ActionResult<{ skill: SkillUsed }>;
  /** 送出一次轉珠路徑：結算消除、傷害、敵人行動、換波與勝敗 */
  submitMove(path: Pos[]): ActionResult<{ summary: TurnSummary; enemyAttacks: EnemyAttack[] }>;
  /** 失敗後續戰：回滿生命、解除我方異常狀態 */
  continueBattle(): ActionResult<object>;
  forfeit(): BattleResult;
  /** 戰鬥結束後才有值 */
  getResult(): BattleResult | null;
  /** 可存進存檔的快照（純 JSON）；用 resumeBattle 還原後，之後的盤面與隨機結果和沒中斷時完全相同 */
  snapshot(): BattleSnapshot;
}

// ---------- 中斷續戰 ----------

export const BATTLE_SNAPSHOT_VERSION = 1;

/** 存檔用的戰鬥狀態：卡片與敵人只記 id，還原時再從資料查回來 */
export type StoredBattleState = Omit<BattleState, 'team' | 'enemies'> & {
  team: Omit<MemberState, 'card'>[];
  enemies: (Omit<EnemyState, 'def'> & { defId: string })[];
};

/**
 * 開戰時額外加上的狀態（誓約碑等）：teamStatuses 開場就在我方身上（續戰後也會重新加上），
 * enemyStatuses 每一波敵人出場時就有。只用既有的狀態積木。
 */
export interface BattleModifiers {
  teamStatuses?: StatusInstance[];
  enemyStatuses?: StatusInstance[];
  /** 給畫面顯示用（誓約 id） */
  oaths?: string[];
}

export interface BattleSnapshot {
  v: number;
  /** 開戰時的額外狀態（選填；舊快照沒有就是沒有） */
  modifiers?: BattleModifiers;
  stageId: string;
  team: TeamMemberInput[];
  helper: TeamMemberInput | null;
  /** 亂數產生器的內部狀態 */
  rng: number;
  state: StoredBattleState;
  result: BattleResult | null;
  skillUsedThisTurn: boolean;
  takenThisTurn: number[];
}

/** 從快照還原戰鬥。關卡或卡片、敵人資料對不上時丟出錯誤（例如改版後舊快照） */
export function resumeBattle(stage: StageDef, snap: BattleSnapshot, data: BattleData = gameData): Battle {
  if (snap.v !== BATTLE_SNAPSHOT_VERSION) throw new Error(`不支援的戰鬥快照版本 ${snap.v}`);
  if (snap.stageId !== stage.id) throw new Error(`快照是關卡 ${snap.stageId}，不是 ${stage.id}`);
  return startBattle(stage, snap.team, snap.helper, createRng(snap.rng), data, snap, snap.modifiers);
}

/** 毒珠每顆扣最大生命的百分比（之後可移到 config） */
const POISON_ORB_PERCENT = 5;
/** 轉珠時間下限（秒） */
const MIN_MOVE_TIME = 1;

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
  restore?: BattleSnapshot,
  modifiers: BattleModifiers = restore?.modifiers ?? {},
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
  const skills = cards.map((c) => (c.activeSkill ? byId(data.skills, c.activeSkill, '主動技') : undefined));
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
    const skill = skills[i];
    const maxCd = skill ? cooldownAtLevel(skill, inputs[i].skillLevel ?? 1) : null;
    return {
      ...m,
      hp: Math.round(m.hp * leaderStatic.hpMultipliers[i]),
      rcv: Math.round(m.rcv * leaderStatic.rcvMultipliers[i]),
      index: i,
      isHelper: !!helper && i === cards.length - 1,
      card: cards[i],
      skillCooldown: maxCd === null ? null : leaderStatic.skillsStartCharged ? 0 : maxCd,
      skillMaxCooldown: maxCd,
    };
  });
  const maxHp = members.reduce((sum, m) => sum + m.hp, 0);
  const boardSize = leaderStatic.boardSize ?? config.board;

  const createEnemies = (wave: number): EnemyState[] =>
    stage.waves[wave].enemies.map((id) => {
      const def = byId(data.enemies, id, '敵人');
      const maxCooldown = def.cd + leaderStatic.enemyCooldownPlus;
      return {
        def, hp: def.hp, maxHp: def.hp, cooldown: maxCooldown, maxCooldown,
        statuses: [], dots: [], lockedTurns: 0, turnsOnField: 0, triggered: [],
      };
    });

  const hydrate = (stored: StoredBattleState): BattleState => {
    if (stored.team.length !== members.length || stored.wave >= stage.waves.length) throw new Error('快照與關卡資料不符');
    return {
      ...structuredClone(stored),
      team: stored.team.map((m, i) => {
        if (m.cardId !== members[i].cardId) throw new Error('快照與隊伍不符');
        return { ...structuredClone(m), card: members[i].card };
      }),
      enemies: stored.enemies.map(({ defId, ...e }) => ({ ...structuredClone(e), def: byId(data.enemies, defId, '敵人') })),
    };
  };

  // 還原時不能用 rng 產生新盤面，否則亂數序列會和中斷前不同
  const state: BattleState = restore ? hydrate(restore.state) : {
    stageId: stage.id,
    phase: 'player',
    wave: 0,
    waveCount: stage.waves.length,
    board: createBoard(boardSize, rng),
    team: members,
    hp: maxHp,
    maxHp,
    enemies: [],
    target: 0,
    moveTimeSeconds: 0,
    turns: 0,
    maxCombo: 0,
    usedActiveSkill: false,
    continues: 0,
    buffs: [],
    // 開戰的額外狀態（誓約碑）開場就在我方身上
    teamStatuses: structuredClone(modifiers.teamStatuses ?? []),
  };

  const events = new EventBus<BattleEvents>();
  let result: BattleResult | null = restore ? structuredClone(restore.result) : null;
  let skillUsedThisTurn = restore?.skillUsedThisTurn ?? false;
  /** 每隻敵人本回合已受到的傷害（傷害吸收用），回合結束與換波時歸零 */
  let takenThisTurn: number[] = restore ? [...restore.takenThisTurn] : [];

  const snapshot = (): BattleState => structuredClone(state);
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
  const updateMoveTime = () => {
    state.moveTimeSeconds = Math.max(
      MIN_MOVE_TIME,
      config.board.moveTimeSeconds + leaderStatic.moveTimeBonus + buffMoveTime(state) - moveTimePenalty(state),
    );
  };

  /** 觸發某隻敵人在某時機的技能 */
  const triggerAbilities = (enemyIndex: number, trigger: 'onStart' | 'onAttack' | 'hpBelow' | 'everyNTurns') => {
    const enemy = state.enemies[enemyIndex];
    for (const k of abilitiesToTrigger(enemy, trigger)) {
      if (trigger === 'onStart' || trigger === 'hpBelow') enemy.triggered.push(k);
      const boardBefore = state.board;
      const outcome = applyEnemyAbility(state, enemyIndex, enemy.def.abilities[k], rng);
      events.emit('statusApplied', {
        side: outcome.side,
        enemy: outcome.side === 'enemy' ? enemyIndex : undefined,
        status: outcome.status,
        resisted: outcome.side === 'enemy' ? false : outcome.resisted,
      });
      if (state.board !== boardBefore) events.emit('boardChanged', { board: structuredClone(state.board), reason: 'enemy' });
    }
  };

  const spawnWave = (wave: number) => {
    state.wave = wave;
    state.enemies = createEnemies(wave);
    // 開戰的額外狀態（誓約碑）：每一波敵人出場就帶著
    for (const e of state.enemies) for (const s of modifiers.enemyStatuses ?? []) e.statuses = addStatus(e.statuses, structuredClone(s));
    state.target = 0;
    takenThisTurn = state.enemies.map(() => 0);
    state.enemies.forEach((_, i) => triggerAbilities(i, 'onStart'));
    updateMoveTime();
  };

  /** 把傷害打到敵人身上，處理倒下事件與 hpBelow 技能 */
  const dealDamage = (hits: Hit[], combo: number): HitResult[] => {
    if (hits.length === 0) return [];
    const targets = state.enemies.map((e, i) => ({
      ...defenseProfile(e), hp: e.hp, maxHp: e.maxHp, takenThisTurn: takenThisTurn[i],
    }));
    const applied = applyHits(hits, targets, state.target, { combo, config: config.battle });
    takenThisTurn = applied.taken;
    state.enemies.forEach((e, i) => {
      const before = e.hp;
      e.hp = applied.hp[i];
      if (before > 0 && e.hp <= 0) events.emit('enemyDefeated', { enemy: i, enemyId: e.def.id });
    });
    state.enemies.forEach((e, i) => {
      if (e.hp > 0) triggerAbilities(i, 'hpBelow');
    });
    // 七曜環：這批攻擊裡實際打中的屬性攻擊點掉對應的格子（固定、百分比傷害不算）
    state.enemies.forEach((e, i) => {
      if (e.hp <= 0) return;
      const attrs = applied.results
        .filter((r) => r.enemy === i && r.damage > 0 && r.hit.attribute && !r.hit.fixed && r.hit.percentMaxHp === undefined)
        .map((r) => r.hit.attribute!);
      breakRing(i, attrs, false);
    });
    if (state.enemies[state.target]?.hp <= 0 && firstAlive() >= 0) state.target = firstAlive();
    return applied.results;
  };

  const breakRing = (i: number, attrs: Attribute[], heartsCleared: boolean) => {
    const r = breakRingSlots(state.enemies[i], attrs, heartsCleared);
    if (r.broken.length) events.emit('ringBroken', { enemy: i, broken: r.broken, shattered: r.shattered });
  };

  /** 我方受傷；有瀕死保命時留 1 點 */
  const hurtTeam = (damage: number): boolean => {
    state.hp = Math.max(0, state.hp - damage);
    if (state.hp === 0 && consumeSurviveOnce(state)) {
      state.hp = 1;
      return true;
    }
    return false;
  };

  /** 波次清空就換波或勝利 */
  const checkWaveEnd = () => {
    if (state.phase !== 'player' || firstAlive() >= 0) return;
    events.emit('waveCleared', { wave: state.wave });
    if (state.wave + 1 >= state.waveCount) {
      state.phase = 'won';
      finish('win');
    } else {
      spawnWave(state.wave + 1);
      events.emit('waveStart', { wave: state.wave, enemies: structuredClone(state.enemies) });
    }
  };

  const endOfTurn = () => {
    // 我方中毒
    const poison = poisonPercent(state);
    if (poison > 0 && state.hp > 0) {
      const damage = Math.floor((state.maxHp * poison) / 100);
      hurtTeam(damage);
      events.emit('poisonTick', { damage });
    }

    // 持續效果與異常狀態經過一回合
    state.buffs = tickBuffs(state.buffs);
    const [kept, expired] = tickStatuses(state.teamStatuses);
    state.teamStatuses = kept;
    for (const s of expired) {
      const board = releaseBoardStatus(state.board, s);
      if (board !== state.board) {
        state.board = board;
        events.emit('boardChanged', { board: structuredClone(state.board), reason: 'status' });
      }
      events.emit('statusExpired', { side: STATUS_INFO[s.id].side, status: s });
    }
    state.enemies.forEach((e, i) => {
      const [k, x] = tickStatuses(e.statuses);
      e.statuses = k;
      for (const s of x) events.emit('statusExpired', { side: 'enemy', enemy: i, status: s });
      e.dots = e.dots.filter((d) => d.turns > 1).map((d) => ({ ...d, turns: d.turns - 1 }));
    });
    takenThisTurn = state.enemies.map(() => 0);

    // 主動技冷卻
    const step = 1 + leaderStatic.allyCooldownPerTurn;
    for (const m of state.team) if (m.skillCooldown) m.skillCooldown = Math.max(0, m.skillCooldown - step);
    skillUsedThisTurn = false;
    updateMoveTime();
  };

  if (!restore) spawnWave(0);

  const battle: Battle = {
    events,
    getState: snapshot,
    getResult: () => result,

    snapshot() {
      if (!rng.state) throw new Error('這個亂數產生器不能存檔');
      const s = structuredClone(state);
      return {
        v: BATTLE_SNAPSHOT_VERSION,
        ...(modifiers.teamStatuses?.length || modifiers.enemyStatuses?.length || modifiers.oaths?.length ? { modifiers: structuredClone(modifiers) } : {}),
        stageId: stage.id,
        team: structuredClone(team),
        helper: helper ? structuredClone(helper) : null,
        rng: rng.state(),
        state: {
          ...s,
          team: s.team.map(({ card: _card, ...m }) => m),
          enemies: s.enemies.map(({ def, ...e }) => ({ ...e, defId: def.id })),
        },
        result: structuredClone(result),
        skillUsedThisTurn,
        takenThisTurn: [...takenThisTurn],
      };
    },

    setTarget(enemy) {
      if (!state.enemies[enemy] || state.enemies[enemy].hp <= 0) return fail('目標不存在或已倒下');
      state.target = enemy;
      return { ok: true };
    },

    useSkill(member) {
      if (state.phase !== 'player') return fail('戰鬥已結束');
      const m = state.team[member];
      const skill = skills[member];
      if (!m || !skill || m.skillCooldown === null) return fail('這名隊員沒有主動技');
      if (isSkillSealed(state)) return fail('主動技被封印');
      if (isMemberSealed(state, member)) return fail('這名隊員被星紋封印');
      if (m.skillCooldown > 0) return fail('主動技冷卻中');

      const outcome = applyActiveSkill(state, member, skill, rng);
      m.skillCooldown = m.skillMaxCooldown;
      skillUsedThisTurn = true;
      state.usedActiveSkill = true;
      state.hp = Math.min(state.maxHp, state.hp + outcome.heal);
      if (outcome.boardChanged) events.emit('boardChanged', { board: structuredClone(state.board), reason: 'skill' });
      const hits = dealDamage(outcome.hits, 0);
      updateMoveTime();
      const used: SkillUsed = {
        member,
        skillId: skill.id,
        hits,
        heal: outcome.heal,
        selfDamage: outcome.selfDamage,
        boardChanged: outcome.boardChanged,
        delayed: outcome.delayed,
      };
      events.emit('skillUsed', used);
      checkWaveEnd();
      return { ok: true, skill: used };
    },

    submitMove(path) {
      if (state.phase !== 'player') return fail('戰鬥已結束');
      const moved = applyPath(state.board, path);
      const skyfall = skyfallOptions(state);
      // 隊長技的強化珠天降和主動技的設定取較高者
      skyfall.enhancedChance = Math.max(skyfall.enhancedChance ?? 0, leaderStatic.enhancedSkyfall);
      const resolved = resolveBoard(moved.board, rng, { ...skyfall, sealedOrbs: sealedOrbs(state) });
      const { groups, combo } = resolved;
      state.board = resolved.board;
      const heartSealed = isHeartSealed(state);
      state.turns++;
      state.maxCombo = Math.max(state.maxCombo, combo);

      // 我方攻擊與回復
      const team = teamWithRcvToAtk(state, state.team);
      const turn = evaluateLeaderTurn(leaders, {
        team,
        // 心珠封印時，消除的心珠不算進隊長技條件
        groups: heartSealed ? groups.filter((g) => g.orb !== 'heart') : groups,
        combo,
        hpPercent: (state.hp / state.maxHp) * 100,
        skillUsedThisTurn,
      });
      const buffMul = buffAttackMultipliers(state);
      // 星紋封印：被封印屬性的隊員這回合轉珠攻擊無效
      const sealMul = attributeSealMultipliers(state);
      const atkMultipliers = turn.atkMultipliers.map((v, i) => v * buffMul[i] * sealMul[i]);
      const hits = [
        ...computeAttacks({ team, groups, combo, config: config.battle, atkMultipliers, ignoreDefense: turn.ignoreDefense }),
        ...turn.followUps,
      ];
      const results = dealDamage(hits, combo);
      // 七曜環的心格：這回合消除了心珠（心珠被封印時不算）
      if (!heartSealed && groups.some((g) => g.orb === 'heart')) state.enemies.forEach((e, i) => { if (e.hp > 0) breakRing(i, [], true); });
      const heal = heartSealed
        ? 0
        : computeHeal({ team, groups, combo, config: config.battle, rcvMultipliers: turn.rcvMultipliers });
      const poison = poisonOrbDamage(groups, state.maxHp, POISON_ORB_PERCENT);
      state.hp = Math.min(state.maxHp, state.hp + heal);
      hurtTeam(poison);

      // 持續傷害
      const dotHits: HitResult[] = [];
      state.enemies.forEach((e, i) => {
        if (e.hp <= 0 || e.dots.length === 0) return;
        const saved = state.target;
        state.target = i;
        dotHits.push(...dealDamage(e.dots.map((d) => ({ member: -1, attribute: d.attribute, target: 'single', amount: d.amount })), combo));
        state.target = saved;
      });
      if (state.enemies[state.target]?.hp <= 0 && firstAlive() >= 0) state.target = firstAlive();

      const summary: TurnSummary = {
        turn: state.turns, groups, combo, hits: results, heal, poisonDamage: poison, dotHits,
        movedBoard: moved.board, steps: resolved.steps,
      };
      events.emit('turnResolved', summary);
      // 任務與成就計數用全遊戲事件
      bus.emit('comboResolved', { combo, orbsCleared: groups.reduce((sum, g) => sum + g.cells.length, 0), stageId: stage.id });

      // 敵人行動
      const enemyAttacks: EnemyAttack[] = [];
      const reductions = [...turn.damageReductions, ...buffDamageReductions(state)];
      state.enemies.forEach((e, i) => {
        if (e.hp <= 0 || state.hp <= 0) return;
        e.turnsOnField++;
        if (e.lockedTurns > 0) {
          e.lockedTurns--;
        } else if (--e.cooldown <= 0) {
          e.cooldown = e.maxCooldown;
          const count = enemyHitCount(e);
          const perHit = incomingDamage((e.def.atk * enemyAtkMultiplier(e)) / count, reductions);
          let damage = 0;
          let survived = false;
          for (let h = 0; h < count && state.hp > 0; h++) {
            damage += perHit;
            survived = hurtTeam(perHit) || survived;
          }
          const attack: EnemyAttack = { enemy: i, damage, hits: count, survived };
          enemyAttacks.push(attack);
          events.emit('enemyAttack', attack);
          if (state.hp > 0) triggerAbilities(i, 'onAttack');
        }
        if (state.hp > 0) triggerAbilities(i, 'everyNTurns');
      });

      if (state.hp > 0) endOfTurn();

      if (state.hp <= 0) {
        state.phase = 'lost';
        finish('lose');
      } else {
        checkWaveEnd();
      }
      return { ok: true, summary, enemyAttacks };
    },

    continueBattle() {
      if (state.phase !== 'lost') return fail('只有失敗時可以續戰');
      state.phase = 'player';
      state.hp = state.maxHp;
      for (const s of state.teamStatuses) state.board = releaseBoardStatus(state.board, s);
      // 續戰清掉異常狀態，但開戰時的額外狀態（誓約）照樣保留
      state.teamStatuses = structuredClone(modifiers.teamStatuses ?? []);
      state.continues++;
      result = null;
      updateMoveTime();
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
    if (!restore) events.emit('waveStart', { wave: 0, enemies: structuredClone(state.enemies) });
  });
  return battle;
}
