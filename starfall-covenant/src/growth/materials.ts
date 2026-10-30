// 素材資格：哪張卡能拿來做哪種養成。各養成函式與畫面共用同一份判斷。
import type { CardDef, OwnedCard, SaveData } from '../core/types';
import type { GrowthContext } from './context';
import { nextAwakening } from './awaken';
import { teamUids } from './save-ops';
import { isSkillMaterial } from './skill';

export type MaterialUse = 'enhance' | 'skill' | 'limitBreak' | 'awaken' | 'evolve';

/** 星核：覺醒專用素材 */
export function isStarCore(cardId: string, ctx: GrowthContext): boolean {
  return Object.values(ctx.rules.awakenMaterialByAttribute).includes(cardId);
}

/** material 能不能用在 target 的這種養成（不檢查上鎖、隊伍、張數） */
export function isMaterialFor(
  use: MaterialUse, target: { def: CardDef; owned: Pick<OwnedCard, 'awakened'> }, material: CardDef, ctx: GrowthContext,
): boolean {
  switch (use) {
    case 'enhance': return true;
    case 'skill': return isSkillMaterial(target.def, material, ctx);
    case 'limitBreak': return ctx.family(material.id) === ctx.family(target.def.id);
    case 'awaken': return nextAwakening(target.def, target.owned, ctx)?.material === material.id;
    case 'evolve': return target.def.evolution?.materials.includes(material.id) ?? false;
  }
}

/** 可以被吃掉或賣掉的卡：不是 exceptUid、沒上鎖、不在任何隊伍裡 */
export function freeCards(save: SaveData, exceptUid?: string): OwnedCard[] {
  const inTeam = teamUids(save);
  return save.inventory.cards.filter((c) => c.uid !== exceptUid && !c.locked && !inTeam.has(c.uid));
}

/**
 * 某張卡某種養成的候選素材（給選素材畫面用）。
 * 強化不列星核：星核留給覺醒，避免誤吃（仍可手動傳給 enhance）。
 */
export function materialCandidates(
  save: SaveData, ctx: GrowthContext, targetUid: string, use: MaterialUse,
): { owned: OwnedCard; def: CardDef }[] {
  const owned = save.inventory.cards.find((c) => c.uid === targetUid);
  const def = owned && ctx.card(owned.cardId);
  if (!owned || !def) return [];
  const out: { owned: OwnedCard; def: CardDef }[] = [];
  for (const c of freeCards(save, targetUid)) {
    const m = ctx.card(c.cardId);
    if (!m || !isMaterialFor(use, { def, owned }, m, ctx)) continue;
    if (use === 'enhance' && isStarCore(m.id, ctx)) continue;
    out.push({ owned: c, def: m });
  }
  return out;
}
