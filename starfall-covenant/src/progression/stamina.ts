// 體力：依真實時間回復（離線也算），回復只到上限；獎勵或補滿可以超過上限
import type { GameConfig, SaveData } from '../core/types';
import { maxStamina } from './player';
import { fail, ok, type SaveResult } from './result';

const MINUTE = 60_000;

/** 結算到 now 為止自然回復的體力。lastUpdate 只前進整數個回復週期，不吃掉零頭時間。 */
export function regenStamina(save: SaveData, config: GameConfig, now: number): SaveData {
  const cap = maxStamina(save.player.level, config);
  const { current, lastUpdate } = save.stamina;
  // 時鐘倒退（玩家改系統時間）：不倒扣，計時從現在重新開始
  if (now < lastUpdate) return { ...save, stamina: { current, lastUpdate: now } };
  // 已滿時不計時；扣體力時才從當下開始算
  if (current >= cap) return save;
  const interval = config.stamina.regenMinutes * MINUTE;
  const ticks = Math.floor((now - lastUpdate) / interval);
  if (ticks === 0) return save;
  const next = Math.min(cap, current + ticks);
  return {
    ...save,
    stamina: { current: next, lastUpdate: next >= cap ? now : lastUpdate + ticks * interval },
  };
}

/** 距離下一點體力回復的毫秒數；已滿時回傳 0 */
export function msUntilNextStamina(save: SaveData, config: GameConfig, now: number): number {
  const s = regenStamina(save, config, now);
  if (s.stamina.current >= maxStamina(s.player.level, config)) return 0;
  return s.stamina.lastUpdate + config.stamina.regenMinutes * MINUTE - now;
}

/** 距離體力回滿的毫秒數 */
export function msUntilFullStamina(save: SaveData, config: GameConfig, now: number): number {
  const s = regenStamina(save, config, now);
  const missing = maxStamina(s.player.level, config) - s.stamina.current;
  if (missing <= 0) return 0;
  return msUntilNextStamina(s, config, now) + (missing - 1) * config.stamina.regenMinutes * MINUTE;
}

export function spendStamina(save: SaveData, amount: number, config: GameConfig, now: number): SaveResult<'notEnoughStamina'> {
  const s = regenStamina(save, config, now);
  if (s.stamina.current < amount) return fail('notEnoughStamina');
  const wasFull = s.stamina.current >= maxStamina(s.player.level, config);
  // 從滿的狀態扣體力時，回復計時從現在開始
  return ok({ ...s, stamina: { current: s.stamina.current - amount, lastUpdate: wasFull ? now : s.stamina.lastUpdate } });
}

/** 直接加體力（登入獎勵、道具），可超過上限 */
export function addStamina(save: SaveData, amount: number, config: GameConfig, now: number): SaveData {
  const s = regenStamina(save, config, now);
  return { ...s, stamina: { ...s.stamina, current: s.stamina.current + amount } };
}

/** 星晶補滿體力的價格 */
export const REFILL_STAMINA_GEMS = 1;

export function refillStaminaWithGems(save: SaveData, config: GameConfig, now: number): SaveResult<'notEnoughGems' | 'alreadyFull'> {
  const s = regenStamina(save, config, now);
  const cap = maxStamina(s.player.level, config);
  if (s.stamina.current >= cap) return fail('alreadyFull');
  if (s.player.gems < REFILL_STAMINA_GEMS) return fail('notEnoughGems');
  return ok({
    ...s,
    player: { ...s.player, gems: s.player.gems - REFILL_STAMINA_GEMS },
    stamina: { current: cap, lastUpdate: now },
  });
}
