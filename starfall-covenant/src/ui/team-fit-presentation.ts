import type { CardDef } from '../core/types';
import { matchesFilter, type TeamArchetypeReport } from '../growth/archetype';

/** Display only: keep analyzeTeam's scoring/recommendations independent of warning severity. */
export function presentTeamFit(card: CardDef | undefined, report: Pick<TeamArchetypeReport, 'primary' | 'filter'>): {
  kind: 'none' | 'tag' | 'filter' | 'both'; warning: boolean; tagMismatch: boolean;
} {
  if (!card) return { kind: 'none', warning: false, tagMismatch: false };
  const warning = !!report.filter && !matchesFilter(card, report.filter);
  const tagMismatch = !!report.primary && report.primary !== 'mono' && report.primary !== 'race'
    && !card.archetypes.some(t => t.id === report.primary || t.role === 'support');
  return { kind: warning ? (tagMismatch ? 'both' : 'filter') : tagMismatch ? 'tag' : 'none', warning, tagMismatch };
}
