import type { CardDef, OwnedCard, SaveData } from '../core/types';
import type { GrowthContext } from './context';
import { fail, type GrowthResult } from './result';
import { isFailure, replaceCard, resolveMaterials, resolveTarget } from './save-ops';

/** 技能最高等級：每升 1 級冷卻 −1，從 max 降到 min */
export function maxSkillLevel(def: CardDef, ctx: GrowthContext): number {
  const skill = def.activeSkill ? ctx.skill(def.activeSkill) : undefined;
  if (!skill) return 1;
  return Math.max(1, skill.cooldown.max - skill.cooldown.min + 1);
}

/** 目前技能等級下的冷卻回合數；沒有主動技回傳 null */
export function skillCooldown(def: CardDef, skillLevel: number, ctx: GrowthContext): number | null {
  const skill = def.activeSkill ? ctx.skill(def.activeSkill) : undefined;
  if (!skill) return null;
  return Math.max(skill.cooldown.min, skill.cooldown.max - (skillLevel - 1));
}

/** 是否能拿 material 來升 target 的技能：同名卡（同一條進化鏈）或指定技能素材 */
export function isSkillMaterial(target: CardDef, material: CardDef, ctx: GrowthContext): boolean {
  return ctx.family(material.id) === ctx.family(target.id) || ctx.rules.skillMaterialIds.includes(material.id);
}

/** 技能升級：每張同名卡或技能素材讓技能 +1 級（必定成功），多放會被拒絕以免浪費 */
export function skillUp(
  save: SaveData, ctx: GrowthContext, targetUid: string, materialUids: string[],
): GrowthResult<{ card: OwnedCard; skillLevel: number; cooldown: number }> {
  const target = resolveTarget(save, ctx, targetUid);
  if (isFailure(target)) return target;
  const { owned, def } = target;
  if (!def.activeSkill || !ctx.skill(def.activeSkill)) return fail('noActiveSkill', '這張卡沒有主動技', targetUid);
  const max = maxSkillLevel(def, ctx);
  if (owned.skillLevel >= max) return fail('maxSkillLevel', '技能已經是最高等級', targetUid);
  if (owned.skillLevel + materialUids.length > max) {
    return fail('tooManyMaterials', `只需要 ${max - owned.skillLevel} 張就能升滿技能`);
  }
  const mats = resolveMaterials(save, ctx, materialUids, targetUid);
  if (isFailure(mats)) return mats;
  const wrong = mats.find((m) => !isSkillMaterial(def, m.def, ctx));
  if (wrong) return fail('wrongMaterial', '技能升級需要同名卡或技能素材', wrong.owned.uid);

  const skillLevel = owned.skillLevel + mats.length;
  const card: OwnedCard = { ...owned, skillLevel };
  return {
    ok: true,
    save: replaceCard(save, card, materialUids),
    card,
    skillLevel,
    cooldown: skillCooldown(def, skillLevel, ctx)!,
  };
}
