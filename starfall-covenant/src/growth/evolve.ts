import type { OwnedCard, SaveData } from '../core/types';
import type { GrowthContext } from './context';
import { markOwned } from './collection';
import { fail, type GrowthResult } from './result';
import { addCoin, isFailure, replaceCard, resolveMaterials, resolveTarget, teamUids } from './save-ops';
import { maxSkillLevel } from './skill';

/**
 * 進化：滿級後消耗指定素材＋金幣，變成新卡號。
 * 等級與經驗歸零；技能等級、突破、覺醒保留（超過新型態上限時截到上限）。
 */
export function evolve(
  save: SaveData, ctx: GrowthContext, targetUid: string, materialUids: string[],
): GrowthResult<{ card: OwnedCard; from: string; to: string }> {
  const target = resolveTarget(save, ctx, targetUid);
  if (isFailure(target)) return target;
  const { owned, def } = target;
  const evo = def.evolution;
  if (!evo) return fail('cannotEvolve', '這張卡不能進化', targetUid);
  const toDef = ctx.card(evo.to);
  if (!toDef) return fail('unknownCard', `進化後的卡片資料 ${evo.to} 不存在`, evo.to);
  if (owned.level < def.maxLevel) return fail('notMaxLevel', `需要升到 Lv${def.maxLevel} 才能進化`, targetUid);

  const mats = resolveMaterials(save, ctx, materialUids, targetUid);
  if (isFailure(mats)) return mats;
  const need = [...evo.materials].sort();
  const got = mats.map((m) => m.def.id).sort();
  if (need.length !== got.length || need.some((id, i) => id !== got[i])) {
    return fail('wrongMaterial', `進化素材不符，需要：${evo.materials.map((id) => ctx.card(id)?.name ?? id).join('、')}`);
  }
  if (save.player.coin < evo.coin) return fail('notEnoughCoin', `金幣不足，需要 ${evo.coin}`);

  const card: OwnedCard = {
    ...owned,
    cardId: toDef.id,
    level: 1,
    exp: 0,
    skillLevel: Math.min(owned.skillLevel, maxSkillLevel(toDef, ctx)),
    awakened: Math.min(owned.awakened, toDef.awakenings?.length ?? 0),
  };
  const next = markOwned(addCoin(replaceCard(save, card, materialUids), -evo.coin), [toDef.id]);
  return { ok: true, save: next, card, from: def.id, to: toDef.id };
}

/**
 * 自動挑選進化素材：優先用等級最低、最早取得的卡；上鎖或在隊伍裡的不選。
 * 素材不夠時回傳缺少的卡號。
 */
export function pickEvolutionMaterials(
  save: SaveData, ctx: GrowthContext, targetUid: string,
): { uids: string[]; missing: string[] } {
  const owned = save.inventory.cards.find((c) => c.uid === targetUid);
  const evo = owned ? ctx.card(owned.cardId)?.evolution : undefined;
  if (!evo) return { uids: [], missing: [] };
  const inTeam = teamUids(save);
  const pool = save.inventory.cards
    .filter((c) => c.uid !== targetUid && !c.locked && !inTeam.has(c.uid))
    .sort((a, b) => a.level - b.level || a.obtainedAt - b.obtainedAt);
  const used = new Set<string>();
  const uids: string[] = [];
  const missing: string[] = [];
  for (const id of evo.materials) {
    const hit = pool.find((c) => c.cardId === id && !used.has(c.uid));
    if (hit) { used.add(hit.uid); uids.push(hit.uid); } else missing.push(id);
  }
  return { uids, missing };
}
