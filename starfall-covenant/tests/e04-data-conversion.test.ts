import { describe, expect, it } from 'vitest';
import { gameData } from '../src/data/load';
import { ORB_TYPES, type ActiveSkillDef, type OrbType, type SkillEffect } from '../src/core/types';
import { convertOrbs, type Board } from '../src/battle/board';
import { createGrowthContext } from '../src/growth/context';
import { collectionEntries, claimableCollection, type CollectionFilter } from '../src/growth/collection';
import { createNewSave } from '../src/save/save';
import { matchesConversionSkill, type ConversionQuery } from '../src/ui/conversion-query';

const growth = createGrowthContext(gameData);
const save = createNewSave(gameData.config, 123);
function ids(query: ConversionQuery, filter: CollectionFilter = {}) {
  return collectionEntries(save, growth, filter)
    .filter(entry => matchesConversionSkill(entry.card.activeSkill ? growth.skill(entry.card.activeSkill) : undefined, query))
    .map(entry => entry.card.id);
}
const skill = (effects: SkillEffect[]): ActiveSkillDef => ({ id:'e04-data', name:'fixture', description:'', cooldown:{min:1,max:1}, effects });
function oneOrb(type: OrbType): Board {
  return { rows:1, cols:1, cells:[{type,enhanced:false,locked:false,poison:false,hidden:false}] };
}
/** Independent oracle: execute each individual effect on a real one-orb board.
 * Does not parse from scalar/array/all itself or compose effects into final results. */
function oracle(s: ActiveSkillDef | undefined, query: ConversionQuery): boolean {
  if (query.from === undefined && query.to === undefined) return true;
  for (const effect of s?.effects ?? []) {
    if (effect.type !== 'convertOrbs') continue;
    for (const source of ORB_TYPES) {
      const destination = convertOrbs(oneOrb(source), effect.from, effect.to).cells[0].type;
      if (destination === source) continue;
      if ((query.from === undefined || query.from === source) && (query.to === undefined || query.to === destination)) return true;
    }
  }
  return false;
}

describe('E04 independently verified actual dataset result sets', () => {
  // Lists independently read from current JSON before writing these assertions.
  it.each([
    ['heart','light',[]],
    ['wood','light',['c710']],
    ['dark','heart',['c301','c305','c306']],
    ['heart','dark',['c501','c509','c510','c812']],
    ['heart','fire',['c104','c105']],
  ] satisfies [OrbType, OrbType, string[]][])('%s → %s has exactly the verified cards', (from,to,expected) => {
    expect(ids({from,to})).toEqual(expected);
  });
  it('light beast + wood→light finds c710; classicbeast stays AND and returns zero', () => {
    expect(ids({from:'wood',to:'light'},{attribute:'light',race:'beast'})).toEqual(['c710']);
    expect(ids({from:'wood',to:'light'},{attribute:'light',race:'beast',archetype:'classicbeast'})).toEqual([]);
  });
  it('mixed c105 counts, enhancement/refresh/row/skyfall without explicit conversion never count', () => {
    const c105 = growth.card('c105')!;
    expect(matchesConversionSkill(growth.skill(c105.activeSkill!),{from:'heart',to:'fire'})).toBe(true);
    const excluded=gameData.skills.filter(s=>!s.effects.some(e=>e.type==='convertOrbs'));
    expect(excluded.length).toBeGreaterThan(0);
    for(const s of excluded) for(const color of ORB_TYPES) {
      expect(matchesConversionSkill(s,{from:color}),`${s.id} source`).toBe(false);
      expect(matchesConversionSkill(s,{to:color}),`${s.id} target`).toBe(false);
    }
    const thor=gameData.cards.find(c=>c.name.includes('索爾'))!;
    expect(thor).toBeDefined();
    expect(matchesConversionSkill(growth.skill(thor.activeSkill!),{to:'light'})).toBe(false);
  });
  it('inactive query preserves all112 entry identities/order/status/claimable and save bytes', () => {
    const seeded=createNewSave(gameData.config,456);
    seeded.collection={seen:['c104','c105','c710'],owned:['c104','c710'],claimed:['c104']};
    const before=JSON.stringify(seeded), original=collectionEntries(seeded,growth), claims=claimableCollection(seeded,growth);
    const filtered=original.filter(entry=>matchesConversionSkill(entry.card.activeSkill?growth.skill(entry.card.activeSkill):undefined,{from:undefined,to:undefined}));
    expect(filtered).toHaveLength(112); expect(filtered).toEqual(original);
    filtered.forEach((entry,i)=>expect(entry).toBe(original[i]));
    expect(filtered.find(e=>e.card.id==='c105')?.status).toBe('seen');
    expect(filtered.find(e=>e.card.id==='c104')?.claimable).toBe(0);
    expect(filtered.find(e=>e.card.id==='c710')?.claimable).toBeGreaterThan(0);
    expect(claimableCollection(seeded,growth)).toEqual(claims); expect(JSON.stringify(seeded)).toBe(before);
  });
});

describe('E04 actual per-effect board-conversion oracle', () => {
  it('matches every6×6 edge and single-sided query for actual data and synthetic source forms', () => {
    const samples: (ActiveSkillDef | undefined)[] = [undefined, skill([]),
      skill([{type:'convertOrbs',from:'heart',to:'dark'}]),
      skill([{type:'convertOrbs',from:['wood','heart','fire'],to:'fire'}]),
      skill([{type:'convertOrbs',from:'all',to:'light'}]),
      skill([{type:'convertOrbs',from:'light',to:'light'}]),
      skill([{type:'convertOrbs',from:'fire',to:'water'},{type:'convertOrbs',from:'water',to:'wood'}]),
      ...gameData.skills];
    const before=JSON.stringify(samples);
    const choices: (OrbType | undefined)[]=[undefined,...ORB_TYPES];
    for(const s of samples) for(const from of choices) for(const to of choices) {
      expect(matchesConversionSkill(s,{from,to}),`${s?.id} ${from}→${to}`).toBe(oracle(s,{from,to}));
    }
    expect(JSON.stringify(samples)).toBe(before);
  });
  it('does not join two segments into a nonexistent direct source→target edge', () => {
    const sequential=skill([{type:'convertOrbs',from:'fire',to:'water'},{type:'convertOrbs',from:'water',to:'wood'}]);
    const finalBoard=convertOrbs(convertOrbs(oneOrb('fire'),'fire','water'),'water','wood');
    expect(finalBoard.cells[0].type).toBe('wood');
    expect(matchesConversionSkill(sequential,{from:'fire',to:'wood'})).toBe(false);
    expect(matchesConversionSkill(sequential,{from:'fire',to:'water'})).toBe(true);
    expect(matchesConversionSkill(sequential,{from:'water',to:'wood'})).toBe(true);
  });
});
