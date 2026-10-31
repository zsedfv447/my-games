// 七曜環（ringShield，第 7 章「環心」的新機制，提案 96）。純邏輯。
//
// 敵人身上有一圈 N 格的環（預設 6 格：焰、潮、森、輝、蝕、心）：
// - 屬性格：有該屬性的攻擊打中這隻敵人（實際造成傷害）就點掉一格；
// - 心格：心珠不能攻擊，所以改成「這回合消除了心珠」就點掉（對所有帶環的敵人）。
// - 環還在時，這隻敵人受到的所有傷害減少 value%（預設 75%），和一般護盾一樣，ignoreShield 可以穿透；
// - 全部點掉後環碎裂：之後受到的屬性攻擊 ×vulnerable（預設 2，易傷），固定傷害與百分比傷害不吃易傷。
// - 固定傷害與百分比傷害都不能點掉格子，只能打本體（仍會被環減傷）。
// - 破格在這一批攻擊結算完後才生效：同一次轉珠裡，打破最後一格的那幾下不吃易傷。
// 已點掉的格子記在狀態的 params.broken（例「fire,heart」），會跟著續戰快照一起存。
//
// 資料寫法：{ "status": "ringShield", "trigger": "onStart", "value": 75, "params": { "slots": "fire,water,wood,light,dark,heart", "vulnerable": 2 } }

import { ORB_TYPES, type Attribute, type OrbType } from '../../core/types';
import type { EnemyState, StatusInstance } from '../runtime';

export const DEFAULT_RING_SLOTS: OrbType[] = ['fire', 'water', 'wood', 'light', 'dark', 'heart'];
export const DEFAULT_RING_REDUCTION = 75;
export const DEFAULT_RING_VULNERABLE = 2;

export interface RingState {
  slots: OrbType[];
  broken: OrbType[];
  /** 環還在時的減傷 % */
  reduction: number;
  /** 碎裂後屬性攻擊的倍率 */
  vulnerable: number;
  /** 全部格子都點掉了 */
  shattered: boolean;
}

function parseOrbList(v: number | string | undefined): OrbType[] {
  if (typeof v !== 'string') return [];
  const out: OrbType[] = [];
  for (const s of v.split(',').map((x) => x.trim())) {
    if ((ORB_TYPES as readonly string[]).includes(s) && !out.includes(s as OrbType)) out.push(s as OrbType);
  }
  return out;
}

/** 讀出敵人身上的七曜環；沒有環回傳 null */
export function ringOf(enemy: Pick<EnemyState, 'statuses'>): RingState | null {
  const s = enemy.statuses.find((x) => x.id === 'ringShield');
  if (!s) return null;
  const slots = parseOrbList(s.params?.slots);
  const list = slots.length ? slots : DEFAULT_RING_SLOTS;
  const broken = parseOrbList(s.params?.broken).filter((o) => list.includes(o));
  return {
    slots: list,
    broken,
    reduction: s.value ?? DEFAULT_RING_REDUCTION,
    vulnerable: Number(s.params?.vulnerable ?? DEFAULT_RING_VULNERABLE),
    shattered: broken.length >= list.length,
  };
}

/** 給 defenseProfile 用：環還在 → 減傷；碎裂 → 易傷 */
export function ringDefense(enemy: Pick<EnemyState, 'statuses'>): { ringReduction?: number; vulnerable?: number } {
  const ring = ringOf(enemy);
  if (!ring) return {};
  return ring.shattered ? { vulnerable: ring.vulnerable } : { ringReduction: ring.reduction };
}

export interface RingBreak {
  /** 這次新點掉的格子 */
  broken: OrbType[];
  /** 這次讓環完全碎裂 */
  shattered: boolean;
}

/**
 * 點掉格子：hitAttributes 是這批攻擊中「實際打中這隻敵人」的屬性攻擊的屬性，heartsCleared 是這回合有沒有消除心珠。
 * 直接修改敵人的狀態（換一個新的 params 物件，不會動到敵人資料本身）。沒有環或已碎裂時不做事。
 */
export function breakRingSlots(enemy: Pick<EnemyState, 'statuses'>, hitAttributes: readonly Attribute[], heartsCleared: boolean): RingBreak {
  const ring = ringOf(enemy);
  if (!ring || ring.shattered) return { broken: [], shattered: false };
  const newly = ring.slots.filter((o) => !ring.broken.includes(o) && (o === 'heart' ? heartsCleared : hitAttributes.includes(o as Attribute)));
  if (!newly.length) return { broken: [], shattered: false };
  const broken = ring.slots.filter((o) => ring.broken.includes(o) || newly.includes(o));
  const idx = enemy.statuses.findIndex((x) => x.id === 'ringShield');
  const old: StatusInstance = enemy.statuses[idx];
  enemy.statuses[idx] = { ...old, params: { ...old.params, broken: broken.join(',') } };
  return { broken: newly, shattered: broken.length >= ring.slots.length };
}
