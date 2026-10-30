// 主動技留下的持續效果：怎麼影響傷害、天降、轉珠時間與受傷。

import type { SkyfallOptions } from '../board';
import type { BattleMember } from '../damage';
import { matchesFilter } from '../leader';
import type { BattleState, Buff } from '../runtime';

type BuffOf<K extends Buff['kind']> = Extract<Buff, { kind: K }>;

export const buffsOf = <K extends Buff['kind']>(state: BattleState, kind: K) =>
  state.buffs.filter((b): b is BuffOf<K> => b.kind === kind);

/** 主動技攻擊加成（每位隊員），多個 buff 相乘 */
export function buffAttackMultipliers(state: BattleState): number[] {
  return state.team.map((m) =>
    buffsOf(state, 'attack').reduce((mul, b) => (matchesFilter(m, b.target) ? mul * b.multiplier : mul), 1),
  );
}

/** 回復力轉攻擊：攻擊力加上 回復力 × ratio */
export function teamWithRcvToAtk<T extends BattleMember>(state: BattleState, team: T[]): T[] {
  const ratio = buffsOf(state, 'rcvToAtk').reduce((sum, b) => sum + b.ratio, 0);
  return ratio ? team.map((m) => ({ ...m, atk: m.atk + m.rcv * ratio })) : team;
}

export const buffDamageReductions = (state: BattleState) => buffsOf(state, 'reduceDamage').map((b) => b.percent);

export const buffMoveTime = (state: BattleState) => buffsOf(state, 'moveTime').reduce((sum, b) => sum + b.seconds, 0);

/** 依目前的 buff 組出天降設定；同一種珠有多個設定時取最後施放的 */
export function skyfallOptions(state: BattleState): SkyfallOptions {
  const rates: SkyfallOptions['rates'] = {};
  for (const b of buffsOf(state, 'skyfallRate')) rates[b.orb] = b.rate;
  const enhanced = buffsOf(state, 'enhancedSkyfall');
  return {
    rates,
    enhancedChance: enhanced.length ? Math.max(...enhanced.map((b) => b.rate)) : 0,
    skyfallCombo: buffsOf(state, 'noSkyfallCombo').length === 0,
  };
}

/** 經過一回合：回合數 −1，歸零的移除 */
export function tickBuffs(buffs: Buff[]): Buff[] {
  return buffs.filter((b) => b.turns > 1).map((b) => ({ ...b, turns: b.turns - 1 }));
}

/** 瀕死保命：有的話消耗掉並回傳 true */
export function consumeSurviveOnce(state: BattleState): boolean {
  const i = state.buffs.findIndex((b) => b.kind === 'surviveOnce');
  if (i < 0) return false;
  state.buffs = state.buffs.filter((_, k) => k !== i);
  return true;
}
