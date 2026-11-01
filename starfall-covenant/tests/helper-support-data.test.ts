import { expect, it } from 'vitest';
import { gameData } from '../src/data/load';
import { ARCHETYPE_IDS, type CardDef, type LeaderSkillDef, type SaveData } from '../src/core/types';
import { createNewSave } from '../src/save/save';
import { HELPER_NPCS, helperLevel, helperSkillLevel, helperRoster } from '../src/progression/helpers';
import { npcForHelperCard } from '../src/progression/helper-bond';
import { leaderSupportRoster } from '../src/ui/helper-support';
import { evaluateLeaderTurn, matchesFilter } from '../src/battle/leader';
import { startBattle } from '../src/battle/battle-state';
import { createRng } from '../src/core/rng';
const NOW = Date.parse('2026-11-01T05:00:00Z');
const stage = gameData.stages.find(s => s.id === 'st-1-1')!;
const fresh = () => createNewSave(gameData.config, NOW);
const roster = (save: SaveData, cards = gameData.cards, leaders = gameData.leaderSkills) => leaderSupportRoster(save, stage, cards, leaders, gameData.stages);
function team(ids: (string | null)[]) {
  const save = fresh(), template = save.inventory.cards[0];
  save.inventory.cards = ids.flatMap((cardId, i) => cardId ? [{ ...template, uid: `support-test-${i}`, cardId }] : []);
  save.teams[0].members = ids.map((id, i) => id ? `support-test-${i}` : null);
  save.activeTeam = 0;
  return save;
}
const eligible = gameData.cards.filter(c => c.race !== 'material' && gameData.leaderSkills.some(l => l.id === c.leaderSkill && l.rules.length > 0));

it('actual91 leaders/all15 tags are permanently present independent of ownership, closing original38/53 gap', () => {
  const save = fresh(); save.inventory.cards = []; save.teams[0].members = [null, null, null, null, null];
  const before = structuredClone(save), bytes = JSON.stringify(gameData);
  expect(gameData.cards).toHaveLength(112); expect(eligible).toHaveLength(91);
  const offered = roster(save);
  expect(offered.map(o => o.card.id).sort()).toEqual(eligible.map(c => c.id).sort());
  expect(new Set(offered.map(o => o.id)).size).toBe(91);
  expect(offered.every(o => o.id === `support:${o.card.id}` && !o.problem)).toBe(true);
  for (const tag of ARCHETYPE_IDS) expect(offered.some(o => o.card.archetypes.some(t => t.id === tag)), tag).toBe(true);
  const tiers = new Set(HELPER_NPCS.flatMap(n => n.tiers.map(t => t.card)));
  expect(tiers.size).toBe(38);
  expect(eligible.filter(c => !tiers.has(c.id))).toHaveLength(53);
  expect(helperRoster(save, stage, HELPER_NPCS, gameData.stages, id => gameData.cards.find(c => c.id === id), NOW)).toHaveLength(4);
  expect(save).toEqual(before); expect(JSON.stringify(gameData)).toBe(bytes);
});

it.each([0, 9, 18, 44, 45, 63])('all91 retain existing level/skill curve at %i cleared main stages', count => {
  const save = fresh(); save.progress.clearedStages = gameData.stages.filter(s => s.kind === 'main').slice(0, count).map(s => s.id);
  const before = structuredClone(save);
  const offers = roster(save); expect(offers).toHaveLength(91);
  for (const o of offers) {
    expect(o.level).toBe(helperLevel(o.card, count));
    expect(o.skillLevel).toBe(helperSkillLevel(count));
  }
  expect(save).toEqual(before);
});

it('null/missing first leader never promotes later c405 into a fictional same-leader recommendation', () => {
  for (const save of [team([null, 'c405']), team(['missing-definition', 'c405'])]) {
    const offers = roster(save);
    expect(offers).toHaveLength(91);
    expect(offers.flatMap(o => o.reasons).some(r => r.includes('同隊長') || r.includes('相同隊長技') || r.includes('相同類型'))).toBe(false);
  }
  expect(roster(team(['c405']))[0].card.id).toBe('c405');
});

it('actual c405 retains dragon attack rules while mixed roster blocks only whole-dragon reduction; candidate is included', () => {
  const leader = gameData.leaderSkills.find(l => l.id === 'l405')!;
  const evaluate = (ids: string[], helper: string) => {
    const battle = startBattle(stage, ids.map(cardId => ({ cardId, level: 1 })), { cardId: helper, level: 1 }, createRng(501), gameData);
    return evaluateLeaderTurn([leader], { team: battle.getState().team, groups: [], combo: 0, hpPercent: 100, skillUsedThisTurn: false });
  };
  expect(evaluate(['c405', 'c206'], 'c405').damageReductions).toEqual([]);
  expect(evaluate(['c405', 'c206'], 'c405').atkMultipliers).toEqual([3.5, 1, 3.5]);
  expect(evaluate(['c405', 'c107'], 'c405').damageReductions).toEqual([20]);
  expect(evaluate(['c405', 'c107'], 'c206').damageReductions).toEqual([]);
  const mixed = roster(team(['c405', 'c206'])).find(o => o.card.id === 'c405')!;
  const all = roster(team(['c405', 'c107'])).find(o => o.card.id === 'c405')!;
  expect(mixed.problem).toBeNull(); expect(all.problem).toBeNull();
  expect(mixed.warnings.some(w => w.includes('全隊') || w.includes('編成'))).toBe(true);
  expect(all.warnings.some(w => w.includes('未滿足') || w.includes('不符合'))).toBe(false);
});

it('actual dual c710 and lowHP c507 remain selectable conditional leaders, not currently-activated multipliers', () => {
  for (const id of ['c710', 'c507']) {
    const save = team([id]);
    const offer = roster(save).find(o => o.card.id === id)!;
    expect(offer.problem).toBeNull();
    expect(offer.reasons.join(' ')).toContain('同隊長');
    expect([...offer.reasons, ...offer.warnings].join(' ')).not.toMatch(/已生效|目前生效|保證生效/);
  }
  const c710 = gameData.cards.find(c => c.id === 'c710')!;
  expect(c710.archetypes.some(t => t.id === 'classicbeast')).toBe(false);
  const beasts = roster(team(['c811', 'c710']));
  expect(beasts.find(o => o.card.id === 'c815')!.problem).toBeNull();
  expect(beasts.find(o => o.card.id === 'c815')!.warnings).toEqual([]);
});

it('target coverage uses scalar/array attribute AND race as the actual engine, not tags or HP/RCV targets', () => {
  const save = team(['c811', 'c710', 'c806']); // dark/beast, light/beast, water/god
  const base = gameData.cards.find(c => c.id === 'c710')!;
  const filters = [{ attribute: 'light' as const }, { race: ['beast', 'god'] as const }, { attribute: ['light', 'water'] as const, race: 'beast' as const }];
  for (const filter of filters) {
    const target = structuredClone(filter) as { attribute?: 'light' | ('light' | 'water')[]; race?: 'beast' | ('beast' | 'god')[] };
    const skill: LeaderSkillDef = { id: 'test-support-leader', name: 'fixture', description: 'target fixture', rules: [{ conditions: [{ type: 'always' }], effects: [{ type: 'atkMultiplier', target, value: 2 }, { type: 'hpMultiplier', value: 4 }] }] };
    const card: CardDef = { ...base, id: 'test-support-card', leaderSkill: skill.id };
    const members = save.inventory.cards.map(c => gameData.cards.find(d => d.id === c.cardId)!);
    const expected = members.filter(c => matchesFilter({ cardId: c.id, attribute: c.attribute, race: c.race, hp: 1, atk: 1, rcv: 1 }, target)).length;
    const offer = roster(save, [...gameData.cards, card], [...gameData.leaderSkills, skill]).find(o => o.card.id === card.id)!;
    const coverage = offer.reasons.join(' ').match(/涵蓋\s*(\d+)\s*\/\s*(\d+)/);
    expect(coverage).not.toBeNull(); expect(Number(coverage![1])).toBe(expected); expect(Number(coverage![2])).toBe(3);
  }
});

it('catalog preserves existing card-based NPC bond mapping and hard helper exclusions', () => {
  const save = fresh(), before = structuredClone(save);
  const offers = roster(save); expect(offers).toHaveLength(91);
  for (const o of offers) {
    const originalNpc = HELPER_NPCS.find(n => n.tiers.some(t => t.card === o.card.id));
    expect(npcForHelperCard(o.card.id, HELPER_NPCS)).toEqual(originalNpc);
  }
  expect(npcForHelperCard('c801', HELPER_NPCS)?.id).toBe('npc-norse');
  expect(npcForHelperCard('c805', HELPER_NPCS)).toBeUndefined();
  const fixed = gameData.stages.find(s => s.fixedTeam)!;
  for (const st of [fixed, { ...stage, teamRule: { noHelper: true } }]) expect(leaderSupportRoster(save, st, gameData.cards, gameData.leaderSkills, gameData.stages)).toEqual([]);
  expect(save).toEqual(before);
});
