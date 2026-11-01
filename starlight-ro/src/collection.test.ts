import { describe, expect, it } from 'vitest';
import { buildCollection, collectionSources, filterCollection, paginateCollection } from './collection';
import { cards, items, shopStock } from './data/items';
import { maps } from './data/maps';
import { monsters } from './data/monsters';
import { newGame } from './rules/state';

describe('adventure collection', () => {
  it('derives every card and equipment entry from the current catalogs without granting ownership', () => {
    const state = newGame(), before = structuredClone(state), entries = buildCollection(state);
    expect(entries.filter(e => e.kind === 'card').map(e => e.id)).toEqual(Object.keys(cards));
    expect(entries.filter(e => e.kind === 'equip').map(e => e.id)).toEqual(Object.values(items).filter(e => e.kind === 'equip').map(e => e.id));
    expect(entries.filter(e => e.kind === 'monster')).toHaveLength(Object.keys(monsters).length);
    expect(entries.filter(e => e.kind !== 'monster').every(e => !e.owned)).toBe(true);
    expect(state).toEqual(before);
  });
  it('reports actual drop monsters and their spawn maps, and only actual shop stock as shops', () => {
    for (const monster of Object.values(monsters)) {
      const source = collectionSources('card', monster.card).find(s => s.monsterId === monster.id);
      expect(source?.rate).toBe(monster.cardRate);
      expect(source?.mapIds).toEqual(Object.values(maps).filter(m => m.spawns.some(sp => sp.monster === monster.id)).map(m => m.id));
    }
    expect(collectionSources('equip', 'rod').some(s => s.kind === 'shop')).toBe(true);
    const dropOnly = Object.values(items).find(d => d.kind === 'equip' && !shopStock.gear.includes(d.id))!;
    expect(collectionSources('equip', dropOnly.id).some(s => s.kind === 'shop')).toBe(false);
  });
  it('searches module and source text together with category, job, area and ownership filters', () => {
    const state = newGame();
    state.cards.push({id:'owned',defId:'jellyCard',level:3,loc:{kind:'bag'},locked:false});
    const entries = buildCollection(state);
    expect(filterCollection(entries,{kind:'card',text:'  黏黏吸取  ',job:'swordman',map:'meadow',ownership:'owned'}).map(e=>e.id)).toContain('jellyCard');
    expect(filterCollection(entries,{kind:'card',text:'噗噗果凍',map:'cave'})).toHaveLength(0);
    expect(filterCollection(entries,{kind:'equip',job:'mage'}).some(e=>e.id==='sword')).toBe(false);
    expect(filterCollection(entries,{kind:'equip',job:'mage'}).some(e=>e.id==='knife')).toBe(true);
    expect(filterCollection(entries,{kind:'card',ownership:'missing'}).some(e=>e.id==='jellyCard')).toBe(false);
  });
  it('keeps owned card instances distinct, and counts only equipped gear as worn', () => {
    const state=newGame();
    state.cards=[{id:'a',defId:'jellyCard',level:4,loc:{kind:'bag'},locked:false},{id:'b',defId:'jellyCard',level:1,loc:{kind:'bag'},locked:false}];
    state.equipment=[{id:'g',defId:'knife'}];
    const card=buildCollection(state).find(e=>e.kind==='card'&&e.id==='jellyCard')!;
    expect(card.ownership).toContain('Lv.4');expect(card.ownership).toContain('Lv.1');
    expect(buildCollection(state).find(e=>e.kind==='equip'&&e.id==='knife')?.ownership).not.toContain('穿著中');
    state.equipped.weapon='g';
    expect(buildCollection(state).find(e=>e.kind==='equip'&&e.id==='knife')?.ownership).toContain('穿著中');
  });
  it('clamps pages, caps DOM batches at 24, and handles empty or invalid requests', () => {
    const values=Array.from({length:61},(_,i)=>i);
    expect(paginateCollection(values,2,24)).toEqual({entries:values.slice(48),page:2,pageCount:3,total:61});
    expect(paginateCollection(values,99,100).entries).toHaveLength(13);
    expect(paginateCollection(values,-10,12).entries).toEqual(values.slice(0,12));
    expect(paginateCollection(values,NaN,NaN).entries).toHaveLength(12);
    expect(paginateCollection([],8)).toEqual({entries:[],page:0,pageCount:1,total:0});
  });
});
