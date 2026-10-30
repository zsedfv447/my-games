import type { CardDef, OwnedCard, SaveData } from '../core/types';
import type { GrowthContext } from './context';
import { levelForExp, maxExp } from './level';
import { fail, type GrowthFailure, type GrowthResult } from './result';
import { addCoin, isFailure, replaceCard, resolveMaterials, resolveTarget } from './save-ops';

/** 素材本身的經驗（含等級加成，不含同屬加成） */
export function materialBaseExp(material: CardDef, materialOwned: Pick<OwnedCard, 'level'>, ctx: GrowthContext): number {
  return material.expValue * (1 + ctx.rules.materialLevelExpBonus * (materialOwned.level - 1));
}

/** 一張素材能給目標多少經驗 */
export function materialExp(target: CardDef, material: CardDef, materialOwned: OwnedCard, ctx: GrowthContext): number {
  const attrBonus = material.attribute === target.attribute ? ctx.rules.sameAttributeExpBonus : 1;
  return Math.floor(materialBaseExp(material, materialOwned, ctx) * attrBonus);
}

/** 需要先確認才能吃掉的素材：enhanceConfirmRarity 以上的角色卡（素材卡不算） */
export function enhanceRiskyMaterials(save: SaveData, ctx: GrowthContext, materialUids: string[]): string[] {
  return materialUids.filter((uid) => {
    const owned = save.inventory.cards.find((c) => c.uid === uid);
    const def = owned && ctx.card(owned.cardId);
    return !!def && def.race !== 'material' && def.rarity >= ctx.rules.enhanceConfirmRarity;
  });
}

export function enhanceCost(targetLevel: number, materialCount: number, ctx: GrowthContext): number {
  return materialCount * targetLevel * ctx.rules.enhanceCoinPerMaterialLevel;
}

export interface EnhancePreview {
  expGained: number;
  /** 超過滿級、被浪費掉的經驗 */
  expWasted: number;
  coin: number;
  levelBefore: number;
  levelAfter: number;
}

/** 強化預覽：算出會得到多少經驗、升到幾級、花多少金幣（不改存檔） */
export function previewEnhance(
  save: SaveData, ctx: GrowthContext, targetUid: string, materialUids: string[],
): ({ ok: true } & EnhancePreview) | GrowthFailure {
  const target = resolveTarget(save, ctx, targetUid);
  if (isFailure(target)) return target;
  const { owned, def } = target;
  if (owned.level >= def.maxLevel) return fail('maxLevel', '已經是最高等級', targetUid);
  if (materialUids.length > ctx.rules.maxMaterialsPerEnhance) {
    return fail('tooManyMaterials', `一次最多放 ${ctx.rules.maxMaterialsPerEnhance} 張素材`);
  }
  const mats = resolveMaterials(save, ctx, materialUids, targetUid);
  if (isFailure(mats)) return mats;

  const raw = mats.reduce((sum, m) => sum + materialExp(def, m.def, m.owned, ctx), 0);
  const cap = maxExp(def, ctx.rules);
  const newExp = Math.min(cap, owned.exp + raw);
  return {
    ok: true,
    expGained: newExp - owned.exp,
    expWasted: owned.exp + raw - newExp,
    coin: enhanceCost(owned.level, mats.length, ctx),
    levelBefore: owned.level,
    levelAfter: levelForExp(def, newExp, ctx.rules),
  };
}

/** 強化：吃掉素材卡換經驗，同屬性 ×1.5，消耗金幣；吃 4★ 以上角色卡要帶 confirmRisky */
export function enhance(
  save: SaveData, ctx: GrowthContext, targetUid: string, materialUids: string[], opts: { confirmRisky?: boolean } = {},
): GrowthResult<EnhancePreview & { card: OwnedCard }> {
  const preview = previewEnhance(save, ctx, targetUid, materialUids);
  if (!preview.ok) return preview;
  const risky = enhanceRiskyMaterials(save, ctx, materialUids);
  if (risky.length && !opts.confirmRisky) {
    return fail('confirmRequired', `素材裡有 ${risky.length} 張 ${ctx.rules.enhanceConfirmRarity}★ 以上的角色卡，請再次確認`, risky[0]);
  }
  if (save.player.coin < preview.coin) return fail('notEnoughCoin', `金幣不足，需要 ${preview.coin}`);

  const owned = save.inventory.cards.find((c) => c.uid === targetUid)!;
  const card: OwnedCard = { ...owned, exp: owned.exp + preview.expGained, level: preview.levelAfter };
  const next = addCoin(replaceCard(save, card, materialUids), -preview.coin);
  const { ok: _ok, ...detail } = preview;
  return { ok: true, save: next, ...detail, card };
}
