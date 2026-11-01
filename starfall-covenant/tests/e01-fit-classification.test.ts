import { expect, it } from 'vitest';
import { presentTeamFit } from '../src/ui/team-fit-presentation';
import { gameData } from '../src/data/load';
import type { UnitFilter, ArchetypeId } from '../src/core/types';
import type { TeamArchetypeReport } from '../src/growth/archetype';
const card = gameData.cards.find(c => c.id === 'c710')!;
const cases: [string, UnitFilter | undefined, ArchetypeId | null, boolean, boolean][] = [
  ['tag', { race: 'beast' }, 'classicbeast', false, true],
  ['filter', { race: 'human' }, 'dual', true, false],
  ['both', { race: 'human' }, 'classicbeast', true, true],
  ['none', { race: 'beast' }, 'dual', false, false],
  ['none', undefined, null, false, false],
];
it.each(cases)('classifies %s from structure, never translated reasons', (kind, filter, primary, warning, tagMismatch) => {
  const report: Pick<TeamArchetypeReport, 'primary' | 'filter'> = { primary, filter };
  const result = presentTeamFit(card, report);
  expect(result).toEqual({ kind, warning, tagMismatch });
});
it('race/mono score does not require role tag and missing cards/empty report stay neutral', () => {
  expect(presentTeamFit(card, { primary: 'race', filter: { race: 'beast' } }).kind).toBe('none');
  expect(presentTeamFit(undefined, { primary: null }).kind).toBe('none');
});
