// 敵人技能與 15 種異常狀態，語意依 docs/proposals/002-enemies-and-trials.md 第 1 節。
//
// | status          | 作用對象 | value                   | params                             | turns          |
// |-----------------|----------|-------------------------|------------------------------------|----------------|
// | poison          | 我方     | 每回合扣生命上限 %      |                                    | 持續回合       |
// | skillSeal       | 我方     |                         |                                    | 封印回合       |
// | orbLock         | 盤面     | 鎖定顆數（預設 5）      |                                    | 回合，到期解鎖 |
// | moveTimeDown    | 我方     | 縮短秒數                |                                    | 回合           |
// | shield          | 敵人     | 減傷 %（不填 = 完全免疫）|                                   | 0／不填 = 永久 |
// | attributeShield | 敵人     | 減傷 %                  | attribute：「fire,water」或 rotate | 0／不填 = 永久 |
// | comboShield     | 敵人     | 需要的 Combo 數         |                                    | 0／不填 = 永久 |
// | heartSeal       | 我方     |                         |                                    | 回合           |
// | darkOrbs        | 盤面     | 顆數（預設 5）          |                                    | 回合，到期顯示 |
// | poisonOrbs      | 盤面     | 顆數（預設 5）          |                                    | —              |
// | lockedOrbs      | 盤面     |                         | orb：不能消除的珠種                | 回合           |
// | damageAbsorb    | 敵人     | 一回合傷害門檻          |                                    | 0／不填 = 永久 |
// | enrage          | 敵人     | 攻擊倍率                |                                    | 0／不填 = 永久 |
// | delayImmune     | 敵人     |                         |                                    | 0／不填 = 永久 |
// | multiHit        | 敵人     | 段數（總傷不變，拆段）  |                                    | 0／不填 = 永久 |
// | attributeSeal   | 我方     |                         | attribute：「fire,water」或 leader | 封印回合       |
//
// 觸發時機 trigger：onStart（出場時）、onAttack（每次攻擊之後）、
// hpBelow（生命低於 params.percent %，預設 50，只觸發一次）、everyNTurns（每 params.n 回合，預設 3）。
// attributeShield 的 rotate：從焰開始，每經過一回合換下一個屬性（焰→潮→森→輝→蝕）。
// attributeSeal（星紋封印）：指定屬性的隊員轉珠攻擊無效（不影響主動技與回復）；leader = 封印我方隊長的屬性。

import {
  ATTRIBUTES,
  ORB_TYPES,
  type Attribute,
  type EnemyAbility,
  type OrbType,
  type StatusId,
} from '../../core/types';
import type { Rng } from '../../core/rng';
import { applyInterference, clearInterference, type Board } from '../board';
import type { DefenseProfile } from '../damage';
import type { BattleState, EnemyState, MemberState, StatusInstance } from '../runtime';

export type StatusSide = 'team' | 'board' | 'enemy';

export const STATUS_INFO: Record<StatusId, { name: string; side: StatusSide }> = {
  poison: { name: '中毒', side: 'team' },
  skillSeal: { name: '技能封印', side: 'team' },
  orbLock: { name: '珠子鎖定', side: 'board' },
  moveTimeDown: { name: '轉珠時間縮短', side: 'team' },
  shield: { name: '護盾', side: 'enemy' },
  attributeShield: { name: '屬性減傷', side: 'enemy' },
  comboShield: { name: 'Combo 盾', side: 'enemy' },
  heartSeal: { name: '心珠封印', side: 'team' },
  darkOrbs: { name: '暗珠', side: 'board' },
  poisonOrbs: { name: '毒珠', side: 'board' },
  lockedOrbs: { name: '封鎖珠', side: 'board' },
  damageAbsorb: { name: '傷害吸收', side: 'enemy' },
  enrage: { name: '狂暴', side: 'enemy' },
  delayImmune: { name: '不受延遲', side: 'enemy' },
  multiHit: { name: '連擊', side: 'enemy' },
  attributeSeal: { name: '星紋封印', side: 'team' },
};

const DEFAULT_ORB_COUNT = 5;

export const findStatus = (list: StatusInstance[], id: StatusId) => list.find((s) => s.id === id);

/** 加上狀態；同一種狀態只保留最新的一個 */
export function addStatus(list: StatusInstance[], status: StatusInstance): StatusInstance[] {
  return [...list.filter((s) => s.id !== status.id), status];
}

/** 經過一回合：回合數 −1，歸零的移除；回傳 [剩下的, 結束的] */
export function tickStatuses(list: StatusInstance[]): [StatusInstance[], StatusInstance[]] {
  const kept: StatusInstance[] = [];
  const expired: StatusInstance[] = [];
  for (const s of list) {
    if (s.turns === null) kept.push(s);
    else if (s.turns > 1) kept.push({ ...s, turns: s.turns - 1 });
    else expired.push(s);
  }
  return [kept, expired];
}

const toStatus = (a: EnemyAbility): StatusInstance => ({
  id: a.status,
  // 0 或不填 = 永久
  turns: a.turns ? a.turns : null,
  value: a.value,
  params: a.params,
});

function parseAttributes(v: number | string | undefined): Attribute[] {
  if (typeof v !== 'string') return [];
  return v.split(',').map((s) => s.trim()).filter((s): s is Attribute => (ATTRIBUTES as readonly string[]).includes(s));
}

function parseOrb(v: number | string | undefined): OrbType | undefined {
  return typeof v === 'string' && (ORB_TYPES as readonly string[]).includes(v) ? (v as OrbType) : undefined;
}

// ---------- 敵人身上的狀態 ----------

export function defenseProfile(enemy: EnemyState): DefenseProfile {
  const profile: DefenseProfile = { attribute: enemy.def.attribute, def: enemy.def.def };
  for (const s of enemy.statuses) {
    switch (s.id) {
      case 'shield':
        profile.shieldPercent = s.value ?? 100;
        break;
      case 'attributeShield': {
        const attributes = s.params?.attribute === 'rotate'
          ? [ATTRIBUTES[enemy.turnsOnField % ATTRIBUTES.length]]
          : parseAttributes(s.params?.attribute);
        profile.attributeShield = { attributes, percent: s.value ?? 0 };
        break;
      }
      case 'comboShield':
        profile.comboShield = s.value ?? 0;
        break;
      case 'damageAbsorb':
        profile.damageAbsorb = s.value ?? 0;
        break;
    }
  }
  return profile;
}

export const enemyAtkMultiplier = (enemy: EnemyState) => findStatus(enemy.statuses, 'enrage')?.value ?? 1;
/** 連擊段數：總傷害不變，拆成幾段 */
export const enemyHitCount = (enemy: EnemyState) => Math.max(1, Math.floor(findStatus(enemy.statuses, 'multiHit')?.value ?? 1));
export const isDelayImmune = (enemy: EnemyState) => !!findStatus(enemy.statuses, 'delayImmune');

/** 這個時機要觸發的敵人技能 */
export function abilitiesToTrigger(enemy: EnemyState, trigger: EnemyAbility['trigger']): number[] {
  const out: number[] = [];
  enemy.def.abilities.forEach((a, i) => {
    if (a.trigger !== trigger) return;
    switch (trigger) {
      case 'onStart':
        if (!enemy.triggered.includes(i)) out.push(i);
        break;
      case 'hpBelow': {
        const percent = Number(a.params?.percent ?? 50);
        if (!enemy.triggered.includes(i) && enemy.hp > 0 && (enemy.hp / enemy.maxHp) * 100 < percent) out.push(i);
        break;
      }
      case 'everyNTurns': {
        const every = Math.max(1, Number(a.params?.n ?? 3));
        if (enemy.turnsOnField > 0 && enemy.turnsOnField % every === 0) out.push(i);
        break;
      }
      case 'onAttack':
        out.push(i);
        break;
    }
  });
  return out;
}

// ---------- 套用到我方或盤面 ----------

/** 全隊對某狀態的抵抗率（星紋覺醒 resistStatus 加總，最多 100%） */
export function resistChance(team: MemberState[], status: StatusId): number {
  let total = 0;
  for (const m of team) for (const p of m.passives ?? []) if (p.type === 'resistStatus' && p.status === status) total += p.percent;
  return Math.min(100, total);
}

export type AbilityOutcome =
  | { side: 'enemy'; status: StatusInstance }
  | { side: 'team' | 'board'; status: StatusInstance; resisted: boolean };

/** 套用敵人技能，直接修改 state；回傳發生了什麼給事件使用 */
export function applyEnemyAbility(state: BattleState, enemyIndex: number, ability: EnemyAbility, rng: Rng): AbilityOutcome {
  const status = toStatus(ability);
  const side = STATUS_INFO[ability.status].side;
  if (side === 'enemy') {
    const enemy = state.enemies[enemyIndex];
    enemy.statuses = addStatus(enemy.statuses, status);
    return { side, status };
  }
  if (rng.next() * 100 < resistChance(state.team, ability.status)) return { side, status, resisted: true };

  const count = status.value ?? DEFAULT_ORB_COUNT;
  switch (ability.status) {
    case 'orbLock':
      state.board = applyInterference(state.board, rng, 'locked', count);
      break;
    case 'darkOrbs':
      state.board = applyInterference(state.board, rng, 'hidden', count);
      break;
    case 'poisonOrbs':
      state.board = applyInterference(state.board, rng, 'poison', count);
      // 毒珠留在盤面直到被消除，不需要記錄成狀態
      return { side, status, resisted: false };
  }
  state.teamStatuses = addStatus(state.teamStatuses, status);
  return { side, status, resisted: false };
}

/** 狀態到期時對盤面的影響：珠子鎖定解鎖、暗珠恢復顯示 */
export function releaseBoardStatus(board: Board, status: StatusInstance): Board {
  if (status.id === 'orbLock') return clearInterference(board, ['locked']);
  if (status.id === 'darkOrbs') return clearInterference(board, ['hidden']);
  return board;
}

/** lockedOrbs：目前不能消除的珠種 */
export function sealedOrbs(state: BattleState): OrbType[] {
  const orb = parseOrb(findStatus(state.teamStatuses, 'lockedOrbs')?.params?.orb);
  return orb ? [orb] : [];
}

/** attributeSeal：目前被封印、轉珠不能攻擊的屬性；leader 代表我方隊長的屬性 */
export function sealedAttributes(state: BattleState): Attribute[] {
  const raw = findStatus(state.teamStatuses, 'attributeSeal')?.params?.attribute;
  if (raw === 'leader') return state.team[0] ? [state.team[0].attribute] : [];
  return parseAttributes(raw);
}

/** 每位隊員的攻擊倍率：被星紋封印的屬性為 0，其餘為 1 */
export function attributeSealMultipliers(state: BattleState): number[] {
  const sealed = sealedAttributes(state);
  return state.team.map((m) => (sealed.includes(m.attribute) ? 0 : 1));
}

/** 我方是否被封印主動技／心珠 */
export const isSkillSealed = (state: BattleState) => !!findStatus(state.teamStatuses, 'skillSeal');
export const isHeartSealed = (state: BattleState) => !!findStatus(state.teamStatuses, 'heartSeal');
export const moveTimePenalty = (state: BattleState) => findStatus(state.teamStatuses, 'moveTimeDown')?.value ?? 0;
export const poisonPercent = (state: BattleState) => findStatus(state.teamStatuses, 'poison')?.value ?? 0;
