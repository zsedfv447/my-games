import 'fake-indexeddb/auto';
import {describe,expect,test} from 'vitest';
import {items,cards,modules,shopStock,type EquipDef} from './items';
import {monsters} from './monsters';
import {maps} from './maps';
import {World} from '../world/sim';
import {SaveStore} from '../save';
import * as R from '../rules/state';
const gear=()=>Object.values(items).filter((d):d is EquipDef=>d.kind==='equip'&&d.id.startsWith('exp_'));
const newCards=()=>Object.values(cards).filter(c=>c.id.startsWith('exp_'));
const made=()=>R.createCharacter(R.newGame(),'內容驗證',0,0);

describe('內容擴充的正常取得與相容性',()=>{
  test('四個戰鬥區提供40種實際生成的亞種與40張卡片，城鎮維持安全',()=>{
    expect(newCards()).toHaveLength(40);
    expect(Object.keys(cards).length).toBeGreaterThanOrEqual(60);
    expect(Object.values(monsters).filter(m=>m.id.startsWith('exp_'))).toHaveLength(40);
    expect(maps.town.spawns).toEqual([]);
    const limits={meadow:[1,12,52],forest:[10,22,49],cave:[18,35,44],ruins:[28,45,34]};
    for(const [map,[min,max,density]] of Object.entries(limits)){
      const w=new World(42);w.loadMap(map,4,map==='cave'?32:36);
      const spawned=w.monsters.filter(m=>m.def.id.startsWith('exp_'));
      expect(spawned).toHaveLength(10);
      expect(maps[map].spawns.reduce((n,s)=>n+s.count,0)).toBe(density);
      for(const m of spawned){expect(m.def.level).toBeGreaterThanOrEqual(min);expect(m.def.level).toBeLessThanOrEqual(max);expect(w.map.grid.free(m.x,m.y)).toBe(true);}
    }
  });
  test('每張新卡都由可抵達戰鬥區的對應魔物掉落，並沿用現有模組與機率',()=>{
    expect(newCards()).toHaveLength(40);
    for(const c of newCards()){
      const source=monsters[c.monster];expect(source,c.id).toBeDefined();
      expect(source.card).toBe(c.id);expect(source.cardRate).toBe(1/150);expect(source.mvp).not.toBe(true);
      expect(Object.values(maps).some(m=>m.spawns.some(s=>s.monster===source.id))).toBe(true);
      expect(modules[c.moduleId]).toBeDefined();expect(c.maxLevel).toBe(5);
    }
  });
  test('100件新裝含40把武器全部有正常取得管道，五階均有四種武器及六部位',()=>{
    const defs=gear();expect(defs).toHaveLength(100);expect(defs.filter(g=>g.slot==='weapon')).toHaveLength(40);
    for(const d of defs){
      const sources=Object.values(monsters).filter(m=>m.drops.some(x=>x.item===d.id&&x.rate>0));
      expect(shopStock.gear.includes(d.id)||sources.length>0,d.id).toBe(true);
      expect(d.slots).toBeGreaterThanOrEqual(1);expect(d.reqLv).toBeGreaterThan(1);expect(d.price).toBeGreaterThan(0);
      for(const m of sources){expect(Object.values(maps).some(map=>map.spawns.some(s=>s.monster===m.id))).toBe(true);expect(m.drops.find(x=>x.item===d.id)!.rate).toBeLessThanOrEqual(.015);}
    }
    for(const lv of [6,12,18,24,30]){
      const tier=defs.filter(g=>g.reqLv===lv);expect(tier).toHaveLength(20);
      expect(new Set(tier.filter(g=>g.slot==='weapon').map(g=>g.weaponType)).size).toBe(4);
      expect(new Set(tier.map(g=>g.slot)).size).toBe(6);
    }
  });
  test('亞種實際擊倒會走既有掉落與拾取流程，所有100件新裝可進入背包',()=>{
    let s=made();const picked=new Set<string>();
    for(const map of ['meadow','forest','cave','ruins']){
      const w=new World(42);w.loadMap(map,4,map==='cave'?32:36);
      w.setStats({...R.derive(s),atk:10000,weaponAtk:10000,hit:10000,maxHp:100000,attackDelay:.28},99);
      w.setVitals(100000,10);w.dropMultiplier=1000;w.cardMultiplier=1000;
      for(const m of w.monsters.filter(m=>m.def.id.startsWith('exp_'))){
        m.hp=1;w.player.x=m.x;w.player.y=m.y;w.attack(m.id);
        const events=Array.from({length:120},()=>w.step(1/60)).flat();
        expect(events.some(e=>e.t==='kill'&&e.id===m.id),m.def.id).toBe(true);
        expect(events.some(e=>e.t==='drop'&&e.item.kind==='card'&&e.item.defId===m.def.card),m.def.card).toBe(true);
        for(const e of events)if(e.t==='pickup'){
          if(e.item.kind==='card')s=R.addCard(s,e.item.defId).state;
          else{s=R.addItem(s,e.item.defId);picked.add(e.item.defId);}
        }
      }
    }
    for(const d of gear()){expect(picked.has(d.id),d.id).toBe(true);expect(s.equipment.some(e=>e.defId===d.id)).toBe(true);}
    for(const c of newCards())expect(s.cards.some(i=>i.defId===c.id)).toBe(true);
    R.validateGame(s);
  });
  test('新舊裝備與所有新卡能完整存回version2，原始卡片與裝備ID保留',async()=>{
    expect(gear()).toHaveLength(100);expect(newCards()).toHaveLength(40);
    let s=made();s=R.addCard(s,'jellyCard').state;const original=structuredClone(s);
    for(const d of gear())s=R.addItem(s,d.id);
    for(const c of newCards())s=R.addCard(s,c.id).state;
    R.validateGame(s);const store=new SaveStore(`expansion-${Date.now()}`);await store.save(s);const loaded=await store.load();
    expect(loaded).toEqual(s);expect(loaded!.version).toBe(2);
    expect(loaded!.equipment.slice(0,original.equipment.length)).toEqual(original.equipment);
    expect(loaded!.cards[0]).toEqual(original.cards[0]);
  });
  test('替代來源卡仍為單張升級，持續穿戴才生效、免費拆裝且不同卡ID不能互吃',()=>{
    expect(cards.exp_dewJellyCard).toBeDefined();
    let s=made();const first=R.addCard(s,'exp_dewJellyCard');s=R.insertCard(first.state,first.cardId,s.equipped.weapon!,{});
    const material=R.addCard(s,'exp_dewJellyCard');s=R.upgradeCard(material.state,first.cardId,[material.cardId],{});
    expect(s.cards.find(c=>c.id===first.cardId)!.level).toBe(2);
    expect(R.resolveModules(s)).toContainEqual(expect.objectContaining({moduleId:'leech',level:2,cardId:first.cardId}));
    const wrong=R.addCard(s,'jellyCard'),right=R.addCard(wrong.state,'exp_dewJellyCard');
    expect(()=>R.upgradeCard(right.state,first.cardId,[wrong.cardId,right.cardId],{})).toThrow(/同名/);
    const z=s.char.zeny;s=R.unequip(s,'weapon',{});expect(R.resolveModules(s)).toEqual([]);
    s=R.removeCard(s,first.cardId,{});s=R.insertCard(s,first.cardId,s.equipment[0].id,{});s=R.equip(s,s.equipment[0].id,{});
    expect(s.char.zeny).toBe(z);expect(R.resolveModules(s)[0].level).toBe(2);R.validateGame(s);
  });
});
