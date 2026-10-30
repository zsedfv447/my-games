import type { CardDef, OwnedCard, SaveData } from '../core/types';
import type { GrowthContext } from './context';
import { levelForExp, maxExp } from './level';
import { fail, type GrowthFailure, type GrowthResult } from './result';
import { addCoin, isFailure, replaceCard, resolveMaterials, resolveTarget } from './save-ops';

/** 一張素材能給目標多少經驗 */
export function materialExp(target: CardDef, material: CardDef, materialOwned: OwnedCard, ctx: GrowthContext): number {
  const { rules } = ctx;
  const levelBonus = 1 + rules.materialLevelExpBonus * (materialOwned.level - 1);
  const attrBonus = material.attribute === target.attribute ? rules.sameAttributeExpBonus : 1;
  return Math.floor(material.expValue * levelBonus * attrBonus);
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

/** 強化：吃掉素材卡換經驗，同屬性 ×1.5，消耗金幣 */
export function enhance(
  save: SaveData, ctx: GrowthContext, targetUid: string, materialUids: string[],
): GrowthResult<EnhancePreview & { card: OwnedCard }> {
  const preview = previewEnhance(save, ctx, targetUid, materialUids);
  if (!preview.ok) return preview;
  if (save.player.coin < preview.coin) return fail('notEnoughCoin', `金幣不足，需要 ${preview.coin}`);

  const owned = save.inventory.cards.find((c) => c.uid === targetUid)!;
  const card: OwnedCard = { ...owned, exp: owned.exp + preview.expGained, level: preview.levelAfter };
  const next = addCoin(replaceCard(save, card, materialUids), -preview.coin);
  const { ok: _ok, ...detail } = preview;
  return { ok: true, save: next, ...detail, card };
}
