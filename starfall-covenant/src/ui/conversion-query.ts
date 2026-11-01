import { ORB_TYPES, type ActiveSkillDef, type OrbType } from '../core/types';

export interface ConversionQuery {
  from?: OrbType;
  to?: OrbType;
}

export function conversionQueryActive(query: ConversionQuery): boolean {
  return query.from !== undefined || query.to !== undefined;
}

/** 搜尋技能內明確的轉換段，不推算多段技能施放後的最終盤面。 */
export function matchesConversionSkill(skill: ActiveSkillDef | undefined, query: ConversionQuery): boolean {
  if (!conversionQueryActive(query)) return true;
  return skill?.effects.some(effect => {
    if (effect.type !== 'convertOrbs') return false;
    const sources = effect.from === 'all' ? ORB_TYPES : Array.isArray(effect.from) ? effect.from : [effect.from];
    return sources.some(source => source !== effect.to
      && (query.from === undefined || source === query.from)
      && (query.to === undefined || effect.to === query.to));
  }) ?? false;
}
