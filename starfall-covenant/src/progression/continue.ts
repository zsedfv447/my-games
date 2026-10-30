// 續戰：戰鬥失敗後花星晶回滿生命。扣星晶在這裡，回滿生命由戰鬥模組的 continueBattle() 處理。
import type { SaveData } from '../core/types';
import { fail, ok, type SaveResult } from './result';

/** 續戰一次的星晶（和單抽同價） */
export const CONTINUE_COST_GEMS = 5;

export const canPayContinue = (save: SaveData) => save.player.gems >= CONTINUE_COST_GEMS;

/** 扣續戰星晶；成功後介面再呼叫 battle.continueBattle() */
export function payContinue(save: SaveData): SaveResult<'notEnoughGems'> {
  if (!canPayContinue(save)) return fail('notEnoughGems');
  return ok({ ...save, player: { ...save.player, gems: save.player.gems - CONTINUE_COST_GEMS } });
}
