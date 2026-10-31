// 素材資格：哪張卡能拿來做哪種養成。各養成函式與畫面共用同一份判斷。
import type { CardDef, OwnedCard, SaveData } from '../core/types';
import type { GrowthContext } from './context';
import { nextAwakening } from './awaken';
import { expeditionUids, teamUids } from './save-ops';
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
    case 'limitBreak': return ctx.family(material.id) === ctx.family(target.def.id) || ctx.rules.limitBreakMaterialIds.includes(material.id);
    case 'awaken': return nextAwakening(target.def, target.owned, ctx)?.material === material.id;
    case 'evolve': return target.def.evolution?.materials.includes(material.id) ?? false;
  }
}

/** 可以被吃掉或賣掉的卡：不是 exceptUid、沒上鎖、不在任何隊伍裡、不在星靈遠行中 */
export function freeCards(save: SaveData, exceptUid?: string): OwnedCard[] {
  const inTeam = teamUids(save);
  const away = expeditionUids(save);
  return save.inventory.cards.filter((c) => c.uid !== exceptUid && !c.locked && !inTeam.has(c.uid) && !away.has(c.uid));
}

/**
 * 某張卡某種養成的候選素材（給選素材畫面用）。
 * 強化不列星核與星輝結晶：留給覺醒與突破，避免誤吃（仍可手動傳給 enhance）。
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
    if (use === 'enhance' && (isStarCore(m.id, ctx) || ctx.rules.limitBreakMaterialIds.includes(m.id))) continue;
    out.push({ owned: c, def: m });
  }
  return out;
}

/** 星輝結晶（通用突破素材） */
export function isLimitBreakCrystal(cardId: string, ctx: GrowthContext): boolean {
  return ctx.rules.limitBreakMaterialIds.includes(cardId);
}

/**
 * 突破的自動選擇：只挑同名卡（等級低、取得早的先），不放星輝結晶——結晶很珍貴，要玩家自己點。
 * 最多選到突破滿為止。
 */
export function autoPickLimitBreak(save: SaveData, ctx: GrowthContext, targetUid: string): string[] {
  const owned = save.inventory.cards.find((c) => c.uid === targetUid);
  if (!owned) return [];
  const need = Math.max(0, ctx.rules.maxLimitBreak - owned.limitBreak);
  return materialCandidates(save, ctx, targetUid, 'limitBreak')
    .filter((m) => !isLimitBreakCrystal(m.def.id, ctx))
    .sort((a, b) => a.owned.level - b.owned.level || a.owned.obtainedAt - b.owned.obtainedAt)
    .slice(0, need)
    .map((m) => m.owned.uid);
}

/** 這次突破會用掉幾顆星輝結晶、用完背包還剩幾顆（確認框用） */
export function crystalUsage(save: SaveData, ctx: GrowthContext, materialUids: string[]): { used: number; left: number } {
  const pick = new Set(materialUids);
  let used = 0;
  let total = 0;
  for (const c of save.inventory.cards) {
    if (!isLimitBreakCrystal(c.cardId, ctx)) continue;
    total++;
    if (pick.has(c.uid)) used++;
  }
  return { used, left: total - used };
}

