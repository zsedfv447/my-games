import { describe, test, expect } from 'vitest';
import { World, type SimEvent, WORLD_EVENT } from './sim';
import * as R from '../rules/state';
import { monsters } from '../data/monsters';

const run=(w:World,sec:number)=>{const ev:SimEvent[]=[];for(let i=0;i<Math.round(sec*60);i++)ev.push(...w.step(1/60));return ev;};
function field(map='forest'){const w=new World(6);w.loadMap(map,30,36);w.setStats({...R.derive(R.createCharacter(R.newGame(),'冒險者',0,0)),maxHp:99999,atk:9999,weaponAtk:9999,hit:9999},40);w.setVitals(99999,100);return w;}

describe('v5.1 星光異變',()=>{
  test('野外會自動發生事件，城鎮不會',()=>{
    const w=field();expect((w as unknown as {nextWorldEventAt:number}).nextWorldEventAt-w.time).toBeGreaterThanOrEqual(WORLD_EVENT.first[0]-.01);(w as unknown as {nextWorldEventAt:number}).nextWorldEventAt=w.time+1;const ev=run(w,2);expect(ev.some(e=>e.t==='worldEvent'&&e.phase==='start')).toBe(true);
    const t=new World(6);t.loadMap('town',24,30);t.setStats(R.derive(R.createCharacter(R.newGame(),'x',0,0)),10);expect(t.startWorldEvent('meteor')).toBe(false);
  });
  test('流星雨：流星落下、留下星屑，經驗加成 20%，時間到就結束',()=>{
    const w=field();w.startWorldEvent('meteor');expect(w.eventExpMult).toBe(1.2);
    const ev=run(w,20);expect(ev.filter(e=>e.t==='fx'&&e.kind==='meteor').length).toBeGreaterThan(5);
    expect(w.items.some(i=>i.defId==='starFragment')||ev.some(e=>e.t==='drop')).toBe(true);
    run(w,WORLD_EVENT.meteor);expect(w.worldEvent).toBeNull();expect(w.eventExpMult).toBe(1);
  });
  test('黃金魔物：變金、變硬、經驗 ×5；打倒噴錢並留下稀有寶箱，之後恢復原狀',()=>{
    const w=field();w.startWorldEvent('golden');const m=w.monsters.find(x=>x.golden)!;const base=monsters[m.def.id];
    expect(m.def.name).toContain('黃金');expect(m.maxHp).toBe(base.hp*4);expect(m.def.exp).toBe(base.exp*5);
    m.hp=1;w.player.x=m.x-1;w.player.y=m.y;w.attack(m.id);const ev=run(w,3);
    expect(ev.some(e=>e.t==='worldEvent'&&e.phase==='success'&&e.kind==='golden'&&(e.zeny??0)>0)).toBe(true);
    expect(w.chests.some(c=>c.bonus&&c.tier==='rare')).toBe(true);expect(m.def).toBe(base);expect(w.worldEvent).toBeNull();
  });
  test('黃金魔物沒打倒，時間到就恢復原本的魔物',()=>{
    const w=field();w.startWorldEvent('golden');const m=w.monsters.find(x=>x.golden)!;const id=m.def.id;
    const ev=run(w,WORLD_EVENT.golden+1);expect(ev.some(e=>e.t==='worldEvent'&&e.phase==='fail')).toBe(true);expect(m.golden).toBe(false);expect(m.def).toBe(monsters[id]);
  });
  test('魔物大進攻：三波來襲，全部擊退得到寶箱與經驗',()=>{
    const w=field();w.startWorldEvent('invasion');let waves=0;
    for(let i=0;i<WORLD_EVENT.waves;i++){const ev=run(w,WORLD_EVENT.waveEvery+.5);waves+=ev.filter(e=>e.t==='worldEvent'&&e.phase==='start'&&e.text.includes('波')).length;
      for(const m of w.monsters)if(m.invasion&&m.state!=='dead'){m.hp=1;w.attack(m.id);run(w,.6);}}
    for(let k=0;k<30&&w.worldEvent;k++){const m=w.monsters.find(x=>x.invasion&&x.state!=='dead');if(m){m.hp=1;w.player.x=m.x-1;w.player.y=m.y;w.attack(m.id);}run(w,.5);}
    expect(waves).toBe(3);expect(w.worldEvent).toBeNull();expect(w.chests.some(c=>c.bonus)).toBe(true);
  });
  test('換地圖會結束事件',()=>{const w=field();w.startWorldEvent('meteor');w.loadMap('town',24,30);expect(w.worldEvent).toBeNull();});
});

describe('v6.2 手感修正',()=>{
  test('魔物大進攻：魔物出現在玩家附近，就算離很遠也會一直追過來',()=>{
    const w=field();w.setStats({...w.derived,atk:0,weaponAtk:0},40);w.startWorldEvent('invasion');run(w,2);
    const inv=w.monsters.filter(m=>m.invasion);expect(inv.length).toBeGreaterThan(3);
    for(const m of inv)expect(Math.hypot(m.x-w.player.x,m.y-w.player.y)).toBeLessThan(12);
    const far=inv[0];far.x=w.player.x+16;far.y=w.player.y;run(w,1);expect(far.state).toBe('chase');
  });
  test('走過自己的掉落物就會撿起來',()=>{
    const w=field();const p=w.player;w.items.push({id:9999,kind:'item',defId:'starFragment',count:1,x:p.x+2,y:p.y,expires:w.time+60,mine:true});
    w.moveTo(p.x+3,p.y);const ev=run(w,2);expect(ev.some(e=>e.t==='pickup'&&e.item.id===9999)).toBe(true);
  });
});
