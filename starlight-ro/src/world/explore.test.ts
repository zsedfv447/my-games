import { describe, test, expect } from 'vitest';
import { World, type SimEvent } from './sim';
import * as R from '../rules/state';
import * as X from '../rules/explore';
import { items } from '../data/items';
import { CHEST, TRIALS } from '../data/explore';
import { monsters } from '../data/monsters';

const run=(w:World,sec:number)=>{const ev:SimEvent[]=[];for(let i=0;i<Math.round(sec*60);i++)ev.push(...w.step(1/60));return ev;};
function arena(map='meadow',clock={t:1_000_000}){
  const w=new World(5,()=>clock.t);w.loadMap(map,4,36);const s=R.createCharacter(R.newGame(),'探險家',0,0);
  const d={...R.derive(s),maxHp:50000,maxSp:5000,atk:9999,weaponAtk:9999,hit:9999,range:2};w.setStats(d,60);w.setVitals(50000,5000);return {w,d,clock};
}
const seq=(...v:number[])=>{let i=0;return ()=>v[i++%v.length];};

describe('v4.6 寶箱',()=>{
  test('野外地圖有固定數量的寶箱，城鎮沒有；位置都可走到',()=>{
    const {w}=arena();expect(w.chests.length).toBe(CHEST.perMap);
    for(const c of w.chests){expect(w.map.grid.walkable(Math.floor(c.x),Math.floor(c.y))).toBe(true);expect(w.map.reachable[Math.floor(c.y)*w.map.w+Math.floor(c.x)]).toBeTruthy();}
    const t=arena('town').w;expect(t.chests.length).toBe(0);
  });
  test('寶箱用獨立亂數，不改變魔物生成位置',()=>{
    const a=new World(9);a.loadMap('meadow',4,36);const pos=a.monsters.map(m=>`${m.x},${m.y}`).join('|');
    const b=new World(9);b.loadMap('meadow',4,36);expect(b.monsters.map(m=>`${m.x},${m.y}`).join('|')).toBe(pos);
  });
  test('走過去打開寶箱：發出事件、該格冷卻 3 分鐘才補新寶箱',()=>{
    const {w}=arena();const c=w.chests[0];w.player.x=c.x+.5;w.player.y=c.y;w.monsters.length=0;
    w.openChest(c.id);const ev=run(w,1);
    expect(ev.filter(e=>e.t==='chest')).toHaveLength(1);expect(w.chests.length).toBe(CHEST.perMap-1);
    run(w,10);expect(w.chests.length).toBe(CHEST.perMap-1);
    run(w,CHEST.respawn);expect(w.chests.length).toBe(CHEST.perMap);
  });
  test('冷卻會存進存檔：重新載入不會把開過的寶箱立刻補回來（防止 F5 刷寶箱）',()=>{
    const {w,clock}=arena();const c=w.chests[0];w.player.x=c.x;w.player.y=c.y;w.monsters.length=0;w.openChest(c.id);run(w,1);
    const saved=w.exportExploreCooldowns();expect(Object.keys(saved).some(k=>k.startsWith('chest:meadow:'))).toBe(true);
    const w2=new World(6,()=>clock.t);w2.loadMap('meadow',4,36);w2.importExploreCooldowns(saved);expect(w2.chests.length).toBe(CHEST.perMap-1);
    clock.t+=CHEST.respawn*1000+1;const w3=new World(7,()=>clock.t);w3.loadMap('meadow',4,36);w3.importExploreCooldowns(saved);expect(w3.chests.length).toBe(CHEST.perMap);
  });
  test('寶箱內容：試煉寶箱必定有裝備；補給箱只有食物與藥水；稀有寶箱錢比較多',()=>{
    for(let i=0;i<20;i++){const t=X.rollChest('forest','trial',Math.random,'sapling');expect(Object.keys(t.items).some(id=>items[id].kind==='equip')).toBe(true);}
    const sup=X.rollChest('cave','supply',Math.random);expect(Object.keys(sup.items).every(id=>items[id].kind==='use')).toBe(true);
    const n=X.rollChest('meadow','normal',seq(.5)),r=X.rollChest('meadow','rare',seq(.5));expect(r.zeny).toBeGreaterThan(n.zeny*3);
  });
  test('開寶箱會加進背包並記錄探索紀錄',()=>{
    let s=R.createCharacter(R.newGame(),'探險家',0,0);const z=s.char.zeny;
    s=X.openChest(s,{zeny:120,items:{dawnBread:2},card:'jellyCard'},'rare');
    expect(s.char.zeny).toBe(z+120);expect(s.items.dawnBread).toBe(2);expect(s.cards.some(c=>c.defId==='jellyCard')).toBe(true);expect(s.explore!.chests.rare).toBe(1);
    expect(()=>R.validateGame(s)).not.toThrow();
  });
});

describe('v4.6 自動戰鬥',()=>{
  test('自動戰鬥會順手打開附近的寶箱',()=>{
    const {w}=arena();w.monsters.length=0;const c=w.chests[0];w.player.x=c.x+3;w.player.y=c.y;w.setAuto(true);
    const ev=run(w,4);expect(ev.some(e=>e.t==='chest')).toBe(true);
  });
});
describe('v4.6 地標',()=>{
  test('營地補給：走過去出現補給箱，10 分鐘內不能再領',()=>{
    const {w}=arena();const at=w.landmarkCell('meadow:0')!;w.player.x=at.x;w.player.y=at.y+1;w.monsters.length=0;
    w.useLandmark('meadow:0');run(w,1);expect(w.chests.some(c=>c.tier==='supply')).toBe(true);expect(w.landmarkCooldown('meadow:0')).toBeGreaterThan(500);
    const before=w.chests.length;w.useLandmark('meadow:0');const ev=run(w,1);expect(w.chests.length).toBe(before);expect(ev.some(e=>e.t==='explore')).toBe(true);
  });
  test('試煉：叫出強化精英與手下；打倒精英出現試煉寶箱並進入冷卻',()=>{
    const {w}=arena();const at=w.landmarkCell('meadow:1')!;w.player.x=at.x;w.player.y=at.y+1;w.monsters.length=0;
    w.useLandmark('meadow:1');const ev=run(w,.5);expect(ev.some(e=>e.t==='trialStart')).toBe(true);
    const e=w.monsters.find(m=>m.trial==='meadow:1')!;const T=TRIALS['meadow:1'];
    expect(e.maxHp).toBe(Math.round(monsters[T.elite].hp*T.hpMul));expect(e.def.name).toContain('試煉');expect(w.monsters.length).toBe(1+T.minions[0][1]);
    expect(Math.hypot(e.x-at.x,e.y-at.y)).toBeLessThan(7);
    e.hp=1;w.attack(e.id);const ev2=run(w,3);
    expect(ev2.some(x=>x.t==='trialDone')).toBe(true);expect(w.chests.some(c=>c.tier==='trial'&&c.elite===T.elite)).toBe(true);
    expect(w.trial).toBeNull();expect(w.landmarkCooldown('meadow:1')).toBeGreaterThan(500);
  });
  test('換地圖會中斷試煉，精英不會留下來或重生',()=>{
    const {w}=arena();const at=w.landmarkCell('meadow:1')!;w.player.x=at.x;w.player.y=at.y+1;w.useLandmark('meadow:1');run(w,.5);
    w.loadMap('town',24,30);w.loadMap('meadow',4,36);expect(w.trial).toBeNull();expect(w.monsters.some(m=>m.trial)).toBe(false);
  });
});

describe('v4.6 懸賞',()=>{
  test('依等級出 3 個不同魔物的懸賞；接下後擊殺會累積，完成給錢與經驗並換新委託',()=>{
    let s=R.createCharacter(R.newGame(),'獵人',0,0);s={...s,char:{...s.char,baseLv:15}};
    const offers=X.bountyState(s).offers;expect(offers).toHaveLength(3);expect(new Set(offers.map(o=>o.monster)).size).toBe(3);
    for(const o of offers){expect(monsters[o.monster].mvp).toBeFalsy();expect(monsters[o.monster].level).toBeGreaterThanOrEqual(7);expect(monsters[o.monster].level).toBeLessThanOrEqual(18);}
    s=X.acceptBounty(s,0);expect(()=>X.acceptBounty(s,1)).toThrow();
    const a=s.bounty!.active!;expect(()=>X.completeBounty(s)).toThrow();
    for(let i=0;i<a.count+3;i++)s=R.noteKill(s,a.monster);expect(s.bounty!.active!.progress).toBe(a.count);
    const z=s.char.zeny,r=X.completeBounty(s);expect(r.state.char.zeny).toBe(z+a.zeny);expect(r.state.bounty!.active).toBeNull();expect(r.state.bounty!.seed).toBe(2);expect(r.state.explore!.bounties).toBe(1);
    expect(()=>R.validateGame(r.state)).not.toThrow();
  });
  test('舊存檔沒有探索與懸賞欄位也能正常讀取',()=>{
    const s=R.createCharacter(R.newGame(),'舊檔',0,0);const old={...s} as Record<string,unknown>;delete old.explore;delete old.bounty;delete old.exploreCooldowns;
    expect(()=>R.validateGame(R.normalizeGame(old))).not.toThrow();expect(X.bountyState(old as never).offers.length).toBe(3);
  });
});
