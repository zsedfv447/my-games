// 戰鬥執行期狀態的型別。battle-state.ts 會原樣 re-export，介面組與模擬器從那裡引用即可。

import type { Attribute, CardDef, EnemyDef, OrbType, StatusId, UnitFilter } from '../core/types';
import type { Board } from './board';
import type { BattleMember } from './damage';

export type BattlePhase = 'player' | 'won' | 'lost';

export interface MemberState extends BattleMember {
  /** 0 = 隊長，最後一位為助戰 */
  index: number;
  isHelper: boolean;
  card: CardDef;
  /** 主動技剩餘冷卻；0 = 可施放；沒有主動技為 null */
  skillCooldown: number | null;
  /** 依技能等級算出的冷卻回合數；沒有主動技為 null */
  skillMaxCooldown: number | null;
}

/** 一個持續中的異常狀態（敵人身上或我方身上） */
export interface StatusInstance {
  id: StatusId;
  /** 剩餘回合；null = 永久（直到被解除） */
  turns: number | null;
  value?: number;
  params?: Record<string, number | string>;
}

/** 對敵人的持續傷害 */
export interface DamageOverTime {
  /** 每回合造成的傷害（未計剋制與防禦） */
  amount: number;
  attribute: Attribute;
  turns: number;
}

export interface EnemyState {
  def: EnemyDef;
  hp: number;
  maxHp: number;
  /** 距離攻擊還有幾回合 */
  cooldown: number;
  maxCooldown: number;
  statuses: StatusInstance[];
  dots: DamageOverTime[];
  /** 被鎖定行動的剩餘回合（期間不倒數、不攻擊） */
  lockedTurns: number;
  /** 出場後經過的我方回合數（everyNTurns 用） */
  turnsOnField: number;
  /** 已觸發過的一次性技能（onStart、hpBelow）在 def.abilities 裡的索引 */
  triggered: number[];
}

/** 主動技留下的持續效果；turns 為剩餘回合，施放當回合算第 1 回合 */
export type Buff =
  | { kind: 'attack'; target?: UnitFilter; multiplier: number; turns: number }
  | { kind: 'rcvToAtk'; ratio: number; turns: number }
  | { kind: 'reduceDamage'; percent: number; turns: number }
  | { kind: 'moveTime'; seconds: number; turns: number }
  | { kind: 'noSkyfallCombo'; turns: number }
  | { kind: 'skyfallRate'; orb: OrbType; rate: number; turns: number }
  | { kind: 'enhancedSkyfall'; rate: number; turns: number }
  | { kind: 'surviveOnce'; turns: number }
  | { kind: 'chainOnSkill'; member: number; multiplier: number; turns: number };

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
  /** 本回合轉珠時限（秒），已含隊長技、主動技與異常狀態 */
  moveTimeSeconds: number;
  /** 已完成的轉珠回合數 */
  turns: number;
  maxCombo: number;
  usedActiveSkill: boolean;
  continues: number;
  /** 我方持續中的主動技效果 */
  buffs: Buff[];
  /** 我方身上的異常狀態（中毒、技能封印、珠子鎖定、轉珠時間縮短、心珠封印） */
  teamStatuses: StatusInstance[];
}
