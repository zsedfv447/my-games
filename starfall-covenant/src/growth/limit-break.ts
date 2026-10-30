import type { OwnedCard, SaveData } from '../core/types';
import type { GrowthContext } from './context';
import { fail, type GrowthResult } from './result';
import { isFailure, replaceCard, resolveMaterials, resolveTarget } from './save-ops';

/** 突破：吞同名卡（同一條進化鏈的任何型態），每張 +1 階，最多 +5 */
export function limitBreak(
  save: SaveData, ctx: GrowthContext, targetUid: string, materialUids: string[],
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
  const family = ctx.family(def.id);
  const wrong = mats.find((m) => ctx.family(m.def.id) !== family);
  if (wrong) return fail('wrongMaterial', '突破需要同名卡', wrong.owned.uid);

  const card: OwnedCard = { ...owned, limitBreak: owned.limitBreak + mats.length };
  return { ok: true, save: replaceCard(save, card, materialUids), card, limitBreak: card.limitBreak };
}
