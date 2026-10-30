import type { CardDef, OwnedCard, PassiveEffect, SaveData } from '../core/types';
import type { GrowthContext } from './context';
import { fail, type GrowthResult } from './result';
import { addCoin, isFailure, replaceCard, resolveMaterials, resolveTarget } from './save-ops';

export interface AwakenRequirement {
  /** 第幾個覺醒（0 起算） */
  slot: number;
  passive: PassiveEffect;
  limitBreak: number;
  coin: number;
  /** 需要的星核卡號與張數 */
  material: string;
  materials: number;
}

/** 下一個星紋覺醒的條件；沒有可解鎖的回傳 null */
export function nextAwakening(def: CardDef, owned: Pick<OwnedCard, 'awakened'>, ctx: GrowthContext): AwakenRequirement | null {
  const list = def.awakenings ?? [];
  const slot = owned.awakened;
  if (slot >= list.length) return null;
  const pickRule = (arr: number[]) => arr[Math.min(slot, arr.length - 1)] ?? 0;
  return {
    slot,
    passive: list[slot],
    limitBreak: pickRule(ctx.rules.awakenLimitBreakGate),
    coin: pickRule(ctx.rules.awakenCoin),
    material: ctx.rules.awakenMaterialByAttribute[def.attribute],
    materials: pickRule(ctx.rules.awakenMaterialCount),
  };
}

/** 星紋覺醒：依序解鎖卡片的被動，需要突破階數、金幣與同屬性星核 */
export function awaken(
  save: SaveData, ctx: GrowthContext, targetUid: string, materialUids: string[],
): GrowthResult<{ card: OwnedCard; unlocked: PassiveEffect }> {
  const target = resolveTarget(save, ctx, targetUid);
  if (isFailure(target)) return target;
  const { owned, def } = target;
  if (!def.awakenings?.length) return fail('noAwakening', '這張卡沒有星紋覺醒', targetUid);
  const req = nextAwakening(def, owned, ctx);
  if (!req) return fail('maxAwakening', '星紋覺醒已全部解鎖', targetUid);
  if (owned.limitBreak < req.limitBreak) {
    return fail('limitBreakRequired', `需要突破到 +${req.limitBreak} 才能解鎖這個覺醒`, targetUid);
  }
  const materialName = ctx.card(req.material)?.name ?? req.material;
  if (materialUids.length !== req.materials) {
    return fail(materialUids.length > req.materials ? 'tooManyMaterials' : 'noMaterials', `需要 ${req.materials} 張${materialName}`);
  }
  const mats = resolveMaterials(save, ctx, materialUids, targetUid);
  if (isFailure(mats)) return mats;
  const wrong = mats.find((m) => m.def.id !== req.material);
  if (wrong) return fail('wrongMaterial', `星紋覺醒需要${materialName}`, wrong.owned.uid);
  if (save.player.coin < req.coin) return fail('notEnoughCoin', `金幣不足，需要 ${req.coin}`);

  const card: OwnedCard = { ...owned, awakened: owned.awakened + 1 };
  return { ok: true, save: addCoin(replaceCard(save, card, materialUids), -req.coin), card, unlocked: req.passive };
}
