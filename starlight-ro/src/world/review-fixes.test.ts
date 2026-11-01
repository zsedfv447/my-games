// Regression tests for the 審查助手 findings on v4.6–v4.8.
import { describe, test, expect } from 'vitest';
import { World, type SimEvent } from './sim';
import * as R from '../rules/state';
import * as X from '../rules/explore';
import { CHEST } from '../data/explore';

const run=(w:World,sec:number)=>{const ev:SimEvent[]=[];for(let i=0;i<Math.round(sec*60);i++)ev.push(...w.step(1/60));return ev;};
function arena(seed=5,clock={t:1_000_000}){const w=new World(seed,()=>clock.t);w.loadMap('meadow',4,36);const s=R.createCharacter(R.newGame(),'審查',0,0);
  w.setStats({...R.derive(s),maxHp:50000,maxSp:5000},60);w.setVitals(50000,5000);w.monsters.length=0;return {w,clock};}
const open=(w:World,i=0)=>{const c=w.chests[i];w.player.x=c.x;w.player.y=c.y;w.openChest(c.id);run(w,.5);};
function reload(w:World,clock:{t:number},seed=99){const cd=w.exportExploreCooldowns(),ch=w.exportChests();const n=new World(seed,()=>clock.t);n.loadMap('meadow',4,36);n.importExploreCooldowns(cd);n.importChests(ch);n.setStats({...R.derive(R.createCharacter(R.newGame(),'審查',0,0)),maxHp:50000},60);n.setVitals(50000,500);return n;}

describe('審查修正',()=>{
  test('重新整理後寶箱位置與稀有度不變（不能刷稀有）',()=>{
    const {w,clock}=arena();const before=w.chests.map(c=>`${c.x},${c.y},${c.tier}`).sort();
    const n=reload(w,clock);expect(n.chests.map(c=>`${c.x},${c.y},${c.tier}`).sort()).toEqual(before);
  });
  test('開兩箱、重新整理、再開：冷卻中的格數不會被新寶箱 id 覆蓋',()=>{
    const {w,clock}=arena();open(w,0);open(w,0);expect(w.chests.length).toBe(CHEST.perMap-2);
    let n=reload(w,clock);expect(n.chests.length).toBe(CHEST.perMap-2);n.monsters.length=0;
    open(n,0);n=reload(n,clock);expect(n.chests.length).toBe(CHEST.perMap-3);
  });
  test('試煉寶箱重新整理後還在',()=>{
    const {w,clock}=arena();w.chests.push({id:999,x:w.chests[0].x+1,y:w.chests[0].y,tier:'trial',elite:'blueJelly'});
    const n=reload(w,clock);expect(n.chests.some(c=>c.tier==='trial'&&c.elite==='blueJelly')).toBe(true);
  });
  test('時之迴響只加速下一次：快、慢交替，不會永久加速',()=>{
    let s=R.createCharacter(R.newGame(),'沙漏',0,0);s=R.gainExp(s,0,9e9).state;for(let i=0;i<9;i++)s=R.learnSkill(s,'basic');s=R.changeJob(s,'mage',{});s.char.jobLv=50;s.char.baseLv=40;s.char.skillPoints=49;
    for(let i=0;i<5;i++)s=R.learnSkill(s,'coldBolt');s=R.addItem(s,'hourglass',1);const e=s.equipment[s.equipment.length-1];e.refine=7;s=R.equip(s,e.id,{inCombat:false,inTown:true} as never);
    const d={...R.derive(s),maxSp:5000};expect(d.castEcho).toBe(true);
    const w=new World(1);w.loadMap('meadow',4,36);w.setStats(d,40);w.setVitals(5000,5000);const m=w.monsters[0];m.hp=m.maxHp=1e9;m.def={...m.def,hp:1e9,aggressive:false};
    const durs:number[]=[];m.x=w.player.x+3;m.y=w.player.y;w.useSkill('coldBolt',m.id,null);
    for(let i=0;i<60*30&&durs.length<4;i++){if(!w.player.cast&&!w.player.pending){m.x=w.player.x+3;m.y=w.player.y;w.useSkill('coldBolt',m.id,null);}
      for(const e of w.step(1/60))if(e.t==='castStart')durs.push(+e.dur.toFixed(2));}
    expect(durs[1]).toBeLessThan(durs[0]);expect(durs[2]).toBeCloseTo(durs[0],1);expect(durs[3]).toBeCloseTo(durs[1],1);
  });
  test('放棄懸賞不會免費重抽；等級差太多才換新委託',()=>{
    let s=R.createCharacter(R.newGame(),'獵人',0,0);s={...s,char:{...s.char,baseLv:15}};s={...s,bounty:X.bountyState(s)};
    const offers=s.bounty!.offers.map(o=>o.monster).join();s=X.acceptBounty(s,0);s=X.abandonBounty(s);
    expect(s.bounty!.offers.map(o=>o.monster).join()).toBe(offers);
    s={...s,char:{...s.char,baseLv:30}};expect(X.bountyState(s).offers.map(o=>o.monster).join()).not.toBe(offers);
  });

  test('冰庫（地圖 id 含數字）的寶箱冷卻也能存檔，重新整理不會全部重生',()=>{
    const clock={t:2_000_000};const w=new World(5,()=>clock.t);w.loadMap('vault1',4,28);w.setStats({...R.derive(R.createCharacter(R.newGame(),'x',0,0)),maxHp:50000},60);w.setVitals(50000,500);w.monsters.length=0;
    for(let i=0;i<4;i++){const c=w.chests[0];w.player.x=c.x;w.player.y=c.y;w.openChest(c.id);run(w,.5);}
    expect(w.chests.length).toBe(0);const cd=w.exportExploreCooldowns(),ch=w.exportChests();
    const n=new World(6,()=>clock.t);n.loadMap('vault1',4,28);n.importExploreCooldowns(cd);n.importChests(ch);expect(n.chests.length).toBe(0);
  });
  test('自動戰鬥：被沒選的 MVP 追擊會撤退；手動對 MVP 施法不會被取消',()=>{
    const {w}=arena();const s=R.createCharacter(R.newGame(),'x',0,0);w.setStats({...R.derive(s),maxHp:50000,maxSp:5000,skillLevels:{fireBolt:5}},60);
    const boss=new World(5);void boss;
    w.loadMap('meadow',4,36);w.setStats({...R.derive(s),maxHp:50000,maxSp:5000,skillLevels:{fireBolt:5}},60);w.setVitals(50000,5000);
    const king=w.monsters.find(m=>m.def.mvp)!;w.monsters=w.monsters.filter(m=>m===king);king.state='chase';king.x=w.player.x+6;king.y=w.player.y;
    w.setAuto(true);const d0=Math.hypot(king.x-w.player.x,king.y-w.player.y);run(w,2);expect(Math.hypot(king.x-w.player.x,king.y-w.player.y)).toBeGreaterThan(d0);
    // manual cast on the MVP marks it as chosen: auto battle no longer retreats from it
    king.x=w.player.x+5;king.y=w.player.y;w.useSkill('fireBolt',king.id,null);run(w,.6);
    const ev=run(w,4);expect(ev.some(e=>e.t==='skill'&&e.skill==='fireBolt')).toBe(true);
  });
  test('有魔物追擊時，自動戰鬥不會跑去開寶箱',()=>{
    const {w}=arena();w.loadMap('meadow',4,36);w.setStats({...R.derive(R.createCharacter(R.newGame(),'x',0,0)),maxHp:50000},60);w.setVitals(50000,500);
    const c=w.chests[0];w.player.x=c.x+3;w.player.y=c.y;const m=w.monsters.find(x=>!x.def.mvp)!;w.monsters=[m];m.state='chase';m.x=w.player.x-2;m.y=w.player.y;m.hp=m.maxHp=1e9;
    w.setAuto(true);run(w,.5);expect(w.player.target?.kind).not.toBe('chest');
  });
  test('舊存檔（懸賞沒有等級紀錄）會換一次新委託',()=>{
    let s=R.createCharacter(R.newGame(),'舊檔',0,0);s={...s,char:{...s.char,baseLv:20}};const old={offers:X.bountyOffers(5,1),active:null,seed:1};s={...s,bounty:old};
    const b=X.bountyState(s);expect(b.lv).toBe(20);expect(b.offers.map(o=>o.monster).join()).not.toBe(old.offers.map(o=>o.monster).join());
  });

  test('寶箱怪：普通寶箱可能是寶箱怪，打倒後留下不佔名額的稀有寶箱',()=>{
    const {w}=arena();const c=w.chests.find(x=>x.tier==='normal')!;(w as unknown as {crng:()=>number}).crng=()=>0;
    w.player.x=c.x;w.player.y=c.y;w.openChest(c.id);const ev=run(w,.3);
    expect(ev.some(e=>e.t==='chest')).toBe(false);const mim=w.monsters.find(m=>m.mimic)!;expect(mim).toBeTruthy();expect(mim.maxHp).toBe(6*60);
    (w as unknown as {crng:()=>number}).crng=Math.random;mim.hp=1;w.setStats({...R.derive(R.createCharacter(R.newGame(),'x',0,0)),maxHp:50000,atk:9999,weaponAtk:9999,hit:9999},60);w.attack(mim.id);run(w,3);
    const bonus=w.chests.find(x=>x.bonus);expect(bonus?.tier).toBe('rare');run(w,5);expect(w.chests.some(x=>x.bonus)).toBe(true);
  });

  test.each(['meadow','forest','cave','ruins','vault1','vault2','jellyHollow','grove'])('每張有寶箱的地圖（%s）重新整理後冷卻都保留',map=>{
    const clock={t:3_000_000};const w=new World(5,()=>clock.t);w.loadMap(map,4,30);w.setStats({...R.derive(R.createCharacter(R.newGame(),'x',0,0)),maxHp:50000},60);w.setVitals(50000,500);w.monsters.length=0;
    const c=w.chests.find(x=>x.tier==='normal'||x.tier==='rare')!;w.player.x=c.x;w.player.y=c.y;(w as unknown as {crng:()=>number}).crng=()=>.99;w.openChest(c.id);run(w,.5);
    const left=w.chests.length;const n=new World(6,()=>clock.t);n.loadMap(map,4,30);n.importExploreCooldowns(w.exportExploreCooldowns());n.importChests(w.exportChests());
    expect(n.chests.length).toBe(left);
  });
  test('寶箱怪強度跟著玩家等級，不會超過地圖',()=>{
    const {w}=arena();w.setStats({...R.derive(R.createCharacter(R.newGame(),'x',0,0)),maxHp:50000},3);w.setVitals(50000,500);
    const c=w.chests.find(x=>x.tier==='normal')!;(w as unknown as {crng:()=>number}).crng=()=>0;w.player.x=c.x;w.player.y=c.y;w.openChest(c.id);run(w,.3);
    const m=w.monsters.find(x=>x.mimic)!;expect(m.def.level).toBe(3);expect(m.maxHp).toBe(180);
  });
});

