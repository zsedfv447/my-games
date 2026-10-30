// 7 日登入：每天第一次登入領一次，依序領第 1～7 天，領完第 7 天後回到第 1 天（中斷不重置）
import type { GameConfig, Reward, SaveData } from '../core/types';
import { fail } from './result';
import { grantReward } from './rewards';
import { dateKey } from './time';

export interface LoginRewardDef {
  day: number;
  reward: Reward;
}

export function canClaimLogin(save: SaveData, now: number): boolean {
  return save.daily.lastLogin !== dateKey(now);
}

/** 今天會領到第幾天的獎勵（已領過則是今天領的那天） */
export function loginDayFor(save: SaveData, now: number, cycle = 7): number {
  return canClaimLogin(save, now) ? (save.daily.loginDay % cycle) + 1 : save.daily.loginDay;
}

export function claimLoginReward(
  save: SaveData,
  rewards: LoginRewardDef[],
  config: GameConfig,
  now: number,
): { ok: true; save: SaveData; day: number; reward: Reward } | { ok: false; reason: 'alreadyClaimed' | 'noReward' } {
  if (!canClaimLogin(save, now)) return fail('alreadyClaimed');
  const day = loginDayFor(save, now, rewards.length);
  const def = rewards.find((r) => r.day === day);
  if (!def) return fail('noReward');
  const granted = grantReward(save, def.reward, config, now).save;
  return { ok: true, day, reward: def.reward, save: { ...granted, daily: { ...granted.daily, loginDay: day, lastLogin: dateKey(now) } } };
}
