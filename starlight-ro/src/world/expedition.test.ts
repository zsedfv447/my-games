import { describe, test, expect } from 'vitest';
import { World } from './sim';
import * as R from '../rules/state';
import { maps } from '../data/maps';
import { monsters } from '../data/monsters';
import { items, cards } from '../data/items';
import { quests, challengeIds } from '../data/quests';
import { nextWarp } from '../navigation';
import { buildMap } from './mapgen';
import { baseLevelCap, baseExpNeed, jobs } from '../data/jobs';
import { TRIALS, MAP_TIER } from '../data/explore';
import { HABITATS } from '../data/habitats';

const NEW=['frontier','mistMarsh','emberRift','skyGarden','starCitadel'];
describe('v5.0 星界遠征',()=>{
  test('從晨光鎮一路走得到星界城塞，每張圖的傳送點都可達',()=>{
    let at='town';const path=[at];for(let i=0;i<12&&at!=='starCitadel';i++){const w=nextWarp(at,'starCitadel');expect(w).toBeTruthy();at=w!.to;path.push(at);}
    expect(at).toBe('starCitadel');expect(path).toContain('frontier');
    for(const id of NEW){const m=buildMap(id);for(const w of maps[id].warps){const c=m.grid.nearestWalkable(w.x,w.y,3)!;expect(m.reachable[c.y*m.w+c.x]).toBeTruthy();}}
  });
  test('新魔物、卡片、掉落都完整，MVP 都是挑戰委託',()=>{
    for(const id of NEW.slice(1))for(const sp of maps[id].spawns){const m=monsters[sp.monster];expect(m).toBeTruthy();expect(cards[m.card]).toBeTruthy();for(const d of m.drops)expect(items[d.item]).toBeTruthy();}
    for(const b of ['mistQueen','lavaColossus','skyKing','astralLord']){expect(monsters[b].mvp).toBe(true);expect((challengeIds as readonly string[]).includes(b)).toBe(true);}
  });
  test('等級曲線：Lv.45 以下不變、之後變陡；上限 90（v6.0）、職業 70',()=>{
    expect(baseLevelCap).toBe(90);expect(baseExpNeed(30)).toBe(10+6*900);expect(baseExpNeed(70)).toBeGreaterThan((10+6*4900)*3);
    for(const j of ['swordman','mage','archer'] as const)expect(jobs[j].maxJobLv).toBe(70);
  });
  test('新委託的目標魔物與獎勵道具都存在',()=>{
    for(const q of quests.slice(-14)){if(q.goal.kind==='kill')expect(monsters[q.goal.monster]).toBeTruthy();if(q.goal.kind==='collect')expect(items[q.goal.item]).toBeTruthy();for(const id of Object.keys(q.reward.items??{}))expect(items[id]).toBeTruthy();}
  });
  test('新地圖有寶箱、試煉、棲息地；MVP 巢穴附近沒有棲息地',()=>{
    for(const id of NEW.slice(1)){expect(MAP_TIER[id]).toBeGreaterThan(40);expect(TRIALS[`${id}:1`]).toBeTruthy();
      const lair=maps[id].spawns.find(s=>monsters[s.monster].mvp)!.area!,c={x:lair.x+lair.w/2,y:lair.y+lair.h/2};
      for(const h of Object.values(HABITATS[id]))expect(Math.hypot(h.x-c.x,h.y-c.y)).toBeGreaterThan(20);
      const w=new World(3);w.loadMap(id,maps[id].start.x,maps[id].start.y);expect(w.chests.length).toBeGreaterThan(0);expect(w.monsters.length).toBeGreaterThan(30);}
  });
  test('舊存檔在新版本仍可讀，前哨可以存檔與傳送',()=>{
    const s=R.createCharacter(R.newGame(),'舊檔',0,0);expect(()=>R.validateGame(R.normalizeGame(s))).not.toThrow();
    const t=R.setSavePoint(s,{map:'frontier',x:37.5,y:26});expect(()=>R.validateGame(t)).not.toThrow();
  });
});
