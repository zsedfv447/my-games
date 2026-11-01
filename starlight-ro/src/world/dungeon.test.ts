import { describe, test, expect } from 'vitest';
import { World } from './sim';
import { maps } from '../data/maps';
import { monsters } from '../data/monsters';
import { items, cards } from '../data/items';
import { CHEST } from '../data/explore';
import { buildMap } from './mapgen';
import * as R from '../rules/state';

describe('v4.8 封印冰庫',()=>{
  test('兩層地圖都能生成，入口與出口傳送點走得到',()=>{
    for(const id of ['vault1','vault2','jellyHollow','grove']){const m=buildMap(id);
      for(const w of maps[id].warps){const c=m.grid.nearestWalkable(w.x,w.y,3)!;expect(c).toBeTruthy();expect(m.reachable[c.y*m.w+c.x]).toBeTruthy();}
      const s=m.grid.nearestWalkable(maps[id].start.x,maps[id].start.y,3)!;expect(m.reachable[s.y*m.w+s.x]).toBeTruthy();}
  });
  test('冰庫魔物有強化，精英有名稱與更高血量；BOSS 在深處',()=>{
    const w=new World(4);w.loadMap('vault1',4,28);
    const fox=w.monsters.find(m=>m.def.id==='iceFox'&&!m.def.name.includes('精英'))!;expect(fox.maxHp).toBe(Math.round(monsters.iceFox.hp*1.8));
    const elites=w.monsters.filter(m=>m.def.name.startsWith('【精英】'));expect(elites.length).toBe(4);expect(elites.every(e=>e.maxHp>=monsters[e.def.id].hp*6-1)).toBe(true);
    expect(w.chests.length).toBe(CHEST.perMap);
    const w2=new World(4);w2.loadMap('vault2',4,24);const boss=w2.monsters.find(m=>m.def.id==='vaultWarden')!;expect(boss.def.mvp).toBe(true);expect(boss.x).toBeGreaterThan(30);
  });
  test('BOSS 掉落與卡片設定完整',()=>{
    for(const d of monsters.vaultWarden.drops)expect(items[d.item]).toBeTruthy();expect(cards.vaultWardenCard.monster).toBe('vaultWarden');
  });
  test('BOSS 冷卻可以存檔與讀回',()=>{
    const w=new World(4);w.loadMap('vault2',4,24);w.importMvpCooldowns({'vault2:vaultWarden':Date.now()+60000});w.loadMap('vault2',4,24);
    expect(w.monsters.find(m=>m.def.id==='vaultWarden')!.state).toBe('dead');
  });
  test('強化魔物重生後仍是強化狀態',()=>{
    const w=new World(4);w.loadMap('vault1',4,28);w.setStats({...R.derive(R.createCharacter(R.newGame(),'x',0,0)),maxHp:99999},40);w.setVitals(99999,10);const m=w.monsters.find(x=>x.def.name.startsWith('【精英】'))!;const hp=m.maxHp;
    m.hp=0;m.state='dead';m.respawnTimer=.01;for(let i=0;i<10;i++)w.step(1/60);expect(m.state).not.toBe('dead');expect(m.maxHp).toBe(hp);expect(m.hp).toBe(hp);
  });

  test('秘境入口都對應一個試煉地標，目的地存在；秘境有寶箱與精英',async()=>{
    const { SECRET_AREAS, TRIALS }=await import('../data/explore');
    for(const [k,a] of Object.entries(SECRET_AREAS)){expect(TRIALS[k]).toBeTruthy();expect(maps[a.map]).toBeTruthy();expect(maps[a.map].warps.length).toBeGreaterThan(0);}
    for(const id of ['jellyHollow','grove']){const w=new World(8);w.loadMap(id,maps[id].start.x,maps[id].start.y);expect(w.chests.length).toBe(CHEST.perMap);expect(w.monsters.some(m=>m.def.name.startsWith('【精英】'))).toBe(true);
      for(const sp of maps[id].spawns)expect(monsters[sp.monster]).toBeTruthy();}
  });
});

