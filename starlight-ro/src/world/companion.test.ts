import {describe,expect,test} from 'vitest';
import {World,type SimEvent} from './sim';
import * as R from '../rules/state';
import {companions,companionStats,mounts} from '../data/adventure';

const setup=(map='meadow')=>{
  let s=R.createCharacter(R.newGame(),'測試',0,0);s=R.gainExp(s,5e5,0).state;
  const w=new World(42);w.loadMap(map,map==='town'?24:4,map==='town'?30:36);const d=R.derive(s);w.setStats(d,s.char.baseLv);w.setVitals(d.maxHp,d.maxSp);
  return {s,w};
};
const run=(w:World,sec:number)=>{const ev=[];for(let i=0;i<sec*60;i++)ev.push(...w.step(1/60));return ev;};

describe('傭兵與坐騎',()=>{
  test('雇用、切換與存檔驗證',()=>{
    let s=R.createCharacter(R.newGame(),'測試',0,0);
    expect(()=>R.hireCompanion(s,'priest')).toThrow(/Lv/);
    s=R.gainExp(s,5e5,0).state;s.char.zeny=10000;
    s=R.hireCompanion(s,'guard');expect(s.mercs).toMatchObject({hired:['guard'],active:'guard'});expect(s.char.zeny).toBe(10000-companions.guard.price);
    s=R.hireCompanion(s,'guard');expect(s.char.zeny).toBe(10000-companions.guard.price);
    s=R.setCompanion(s,null);expect(s.mercs!.active).toBeNull();
    expect(()=>R.setCompanion(s,'hunter')).toThrow();
    expect(()=>R.validateGame({...s,mercs:{hired:['guard'],active:'hunter'}})).toThrow();
  });
  test('坐騎購買、解鎖與驗證',()=>{
    let s=R.createCharacter(R.newGame(),'測試',0,0);s=R.gainExp(s,5e5,0).state;s.char.zeny=5000;
    s=R.buyMount(s,'poring');expect(s.mounts).toEqual({owned:['poring'],active:'poring'});
    expect(()=>R.buyMount(s,'angeling')).toThrow();
    const u=R.unlockMount(s,'angeling');expect(u.isNew).toBe(true);expect(u.state.mounts!.owned).toContain('angeling');
    expect(()=>R.validateGame({...s,mounts:{owned:['nope'],active:null}})).toThrow();
    expect(Object.keys(mounts).length).toBeGreaterThanOrEqual(4);
  });
  test('騎乘加速，攻擊時自動下坐騎',()=>{
    const {w}=setup();const start={x:w.player.x,y:w.player.y};
    w.moveTo(start.x+12,start.y);run(w,1);const walked=Math.hypot(w.player.x-start.x,w.player.y-start.y);
    const b=setup().w;b.setRiding(true,1.45);b.moveTo(start.x+12,start.y);run(b,1);const rode=Math.hypot(b.player.x-start.x,b.player.y-start.y);
    expect(rode).toBeGreaterThan(walked*1.3);
    const m=b.monsters.find(m=>m.def.id==='jelly')!;b.attack(m.id);const ev=run(b,15);
    expect(b.riding).toBe(false);expect(ev.some(e=>e.t==='dismount')).toBe(true);
  });
  test('劍士傭兵跟隨、協助攻擊並嘲諷魔物',()=>{
    const {w}=setup();w.setAlly('guard',20);
    const m=w.monsters.find(m=>m.def.id==='jelly')!;w.attack(m.id);const ev=run(w,30);
    expect(ev.some(e=>e.t==='dmg'&&e.src==='ally')).toBe(true);
    expect(ev.some(e=>e.t==='swing'&&e.who==='a')).toBe(true);
    const a=w.ally!;expect(Math.hypot(a.x-w.player.x,a.y-w.player.y)).toBeLessThan(8);
    expect(w.map.grid.free(a.x,a.y)).toBe(true);
  });
  test('祭司在主角受傷時補血',()=>{
    const {w}=setup();w.setAlly('priest',20);run(w,1);
    w.setVitals(Math.round(w.derived.maxHp*.3),w.derived.maxSp);
    const m=w.monsters.find(m=>m.def.id==='jelly')!;w.attack(m.id);
    const ev=run(w,8);expect(ev.some(e=>e.t==='ally'&&e.kind==='heal')).toBe(true);
  });
  test('傭兵倒下後會在主角身邊復活',()=>{
    const {w}=setup();w.setAlly('hunter',10);const a=w.ally!;a.hp=1;a.speed=0; // cornered: it cannot run away
    const m=w.monsters.find(m=>m.state!=='dead')!;m.hp=m.maxHp=1e6;m.aggroAlly=1e9;m.state='chase';m.x=a.x+.5;m.y=a.y;
    // v4.9 mercs retreat at low HP; keep the monster forcibly locked on so the knock-down still happens.
    const ev:SimEvent[]=[];for(let i=0;i<30*60;i++){m.aggroAlly=1e9;if((m.state as string)!=='dead')m.state='chase';ev.push(...w.step(1/60));}expect(ev.some(e=>e.t==='ally'&&e.kind==='down')).toBe(true);expect(ev.some(e=>e.t==='ally'&&e.kind==='up')).toBe(true);
  });
  test('傭兵數值隨等級成長，輸出維持在輔助程度',()=>{
    for(const r of ['guard','priest','hunter'] as const){const lo=companionStats(r,5),hi=companionStats(r,40);expect(hi.maxHp).toBeGreaterThan(lo.maxHp);expect(hi.atk).toBeGreaterThan(lo.atk);
      // Base damage per second at Lv.40 stays under ~100 — a geared Lv.40 player deals several times that.
      expect(hi.atk/hi.aspd).toBeLessThan(100);}
  });
  test('雇用傭兵不改變魔物與掉落的亂數序列',()=>{
    const a=setup().w,b=setup().w;b.setAlly('guard',1);b.ally!.x=b.ally!.px=2;b.ally!.y=b.ally!.py=2;
    for(let i=0;i<300;i++){a.step(1/60);b.step(1/60);}
    expect(b.monsters.map(m=>[m.x.toFixed(3),m.y.toFixed(3)])).toEqual(a.monsters.map(m=>[m.x.toFixed(3),m.y.toFixed(3)]));
  });
});
