import { describe, test, expect } from 'vitest';
import { World } from './sim';
import * as R from '../rules/state';
import { HABITATS, huntSpot } from '../data/habitats';
import { maps } from '../data/maps';
import { monsters } from '../data/monsters';

describe('v4.9 棲息地與狩獵目標',()=>{
  test('每張野外圖的主要魔物都有棲息地，弱的靠入口、強的在深處',()=>{
    for(const id of ['meadow','forest','cave','ruins']){const hs=Object.entries(HABITATS[id]);expect(hs.length).toBeGreaterThanOrEqual(3);
      const byLv=[...hs].sort((a,b)=>monsters[a[0]].level-monsters[b[0]].level);expect(byLv[0][1].x).toBeLessThan(byLv[byLv.length-1][1].x);}
  });
  test('大部分（約 75%）的同種魔物會出生在自己的棲息地',()=>{
    const w=new World(2);w.loadMap('forest',4,36);
    for(const [mid,h] of Object.entries(HABITATS.forest)){const list=w.monsters.filter(m=>m.def.id===mid);
      const inside=list.filter(m=>Math.abs(m.x-h.x)<=h.r+1&&Math.abs(m.y-h.y)<=h.r+1).length;expect(inside/list.length).toBeGreaterThanOrEqual(.6);}
  });
  test('狩獵目標：自動戰鬥略過較近的其他魔物，優先打目標',()=>{
    const w=new World(3);w.loadMap('meadow',4,36);w.setStats({...R.derive(R.createCharacter(R.newGame(),'獵人',0,0)),maxHp:9999},20);w.setVitals(9999,50);
    const p=w.player,other=w.monsters.find(m=>m.def.id==='jelly')!,prey=w.monsters.find(m=>m.def.id==='worm')!;w.monsters=[other,prey];
    Object.assign(other,{x:p.x+2,y:p.y,state:'idle'});Object.assign(prey,{x:p.x+8,y:p.y,state:'idle'});
    w.huntTarget='worm';w.setAuto(true);for(let i=0;i<10;i++)w.step(1/60);expect(p.target?.kind==='monster'&&p.target.id).toBe(prey.id);
  });
  test('被攻擊時還是會先反擊，不會為了目標挨打',()=>{
    const w=new World(3);w.loadMap('meadow',4,36);w.setStats({...R.derive(R.createCharacter(R.newGame(),'獵人',0,0)),maxHp:9999},20);w.setVitals(9999,50);
    const p=w.player,other=w.monsters.find(m=>m.def.id==='jelly')!,prey=w.monsters.find(m=>m.def.id==='worm')!;w.monsters=[other,prey];
    Object.assign(other,{x:p.x+2,y:p.y,state:'chase'});Object.assign(prey,{x:p.x+8,y:p.y,state:'idle'});
    w.huntTarget='worm';w.setAuto(true);for(let i=0;i<10;i++)w.step(1/60);expect(p.target?.kind==='monster'&&p.target.id).toBe(other.id);
  });
  test('狩獵地點：找得到每種棲息地魔物的地圖',()=>{expect(huntSpot('wolf')?.map).toBe('forest');expect(maps[huntSpot('bat')!.map]).toBeTruthy();});
});
