import type { OwnedCard, SaveData } from '../core/types';
import type { GrowthContext } from './context';
import { fail, type GrowthResult } from './result';
import { crystalUsage, isMaterialFor } from './materials';
import { isFailure, replaceCard, resolveMaterials, resolveTarget } from './save-ops';

/**
 * 突破：吞同名卡（同一條進化鏈的任何型態）或星輝結晶，可以混用，每張 +1 階，最多 +5。
 * 用到星輝結晶時必須帶 confirmCrystals（畫面先跳確認框），避免不小心用掉。
 */
export function limitBreak(
  save: SaveData, ctx: GrowthContext, targetUid: string, materialUids: string[], opts: { confirmCrystals?: boolean } = {},
): GrowthResult<{ card: OwnedCard; limitBreak: number }> {
  const target = resolveTarget(save, ctx, targetUid);
  if (isFailure(target)) return target;
  const { owned, def } = target;
  const max = ctx.rules.maxLimitBreak;
  if (owned.limitBreak >= max) return fail('maxLimitBreak', `已經突破到 +${max}`, targetUid);
  if (owned.limitBreak + materialUids.length > max) {
    return fail('tooManyMaterials', `只需要 ${max - owned.limitBreak} 張就能突破到 +${max}`);
  }
  const mats = resolveMaterials(save, ctx, materialUids, targetUid);
  if (isFailure(mats)) return mats;
  const wrong = mats.find((m) => !isMaterialFor('limitBreak', { def, owned }, m.def, ctx));
  if (wrong) return fail('wrongMaterial', '突破需要同名卡或星輝結晶', wrong.owned.uid);
  const crystals = crystalUsage(save, ctx, materialUids);
  if (crystals.used > 0 && !opts.confirmCrystals) {
    return fail('confirmRequired', `會用掉 ${crystals.used} 顆星輝結晶（剩 ${crystals.left} 顆），請再次確認`);
  }

  const card: OwnedCard = { ...owned, limitBreak: owned.limitBreak + mats.length };
  return { ok: true, save: replaceCard(save, card, materialUids), card, limitBreak: card.limitBreak };
}
