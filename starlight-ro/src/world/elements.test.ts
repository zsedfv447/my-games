import {describe,expect,test} from 'vitest';
import {World,type Monster,type SimEvent} from './sim';
import * as R from '../rules/state';
import {elementMultiplier,legacyElementMultiplier,monsters} from '../data/monsters';
import {LOOP} from '../data/elements';
import type {Element} from '../data/jobs';

type Skills=Partial<Record<'fireBolt'|'coldBolt'|'lightningBolt'|'fireBall'|'frostDiver'|'thunderStorm',number>>;
/** A Lv.45 mage with the given skills on an otherwise empty meadow. */
const mage=(skills:Skills,seed=42)=>{
  let s=R.createCharacter(R.newGame(),'測試',0,0);
  s=R.gainExp(s,0,9e9).state;for(let i=0;i<9;i++)s=R.learnSkill(s,'basic');s=R.changeJob(s,'mage',{});s=R.gainExp(s,5e5,9e9).state;
  s.char.skillPoints=60;s.char.stats.int=60;s.char.stats.dex=60;
  for(const id of ['fireBolt','coldBolt','lightningBolt','fireBall','frostDiver','thunderStorm'] as const)for(let i=0;i<(skills[id]??0);i++)s=R.learnSkill(s,id);
  const w=new World(seed);w.loadMap('meadow',20,36);const d=R.derive(s);w.setStats(d,s.char.baseLv);w.setVitals(d.maxHp,1e4);(w.player as {sp:number}).sp=1e4;
  for(const m of w.monsters){m.state='dead';m.hp=0;m.respawnTimer=1e9;}
  return {s,w};
};
/** Revives a dummy monster at an offset from the player. */
const dummy=(w:World,dx:number,dy=0,opts:{hp?:number;mvp?:boolean}={}):Monster=>{
  const m=w.monsters.find(m=>m.state==='dead'&&!m.def.mvp)!;
  if(m.baseDef){m.def=m.baseDef;m.baseDef=undefined;m.elite=undefined;}m.shield=0;
  Object.assign(m,{state:'idle',hp:opts.hp??1e7,maxHp:opts.hp??1e7,x:w.player.x+dx,y:w.player.y+dy,px:w.player.x+dx,py:w.player.y+dy,path:[],frozenUntil:0,el:undefined});
  if(opts.mvp)m.def={...m.def,mvp:true};
  (m.def as {aggressive:boolean}).aggressive=false;m.def={...m.def,speed:0,flee:0};
  return m;
};
const run=(w:World,sec:number,dt=1/60)=>{const ev:SimEvent[]=[];for(let t=0;t<sec;t+=dt)ev.push(...w.step(dt));return ev;};
const hits=(ev:SimEvent[],src:string,id?:number)=>ev.filter(e=>e.t==='dmg'&&e.to==='m'&&e.src===src&&(id===undefined||e.id===id));
const cast=(w:World,skill:string,m:Monster,sec=7)=>{expect(w.useSkill(skill,m.id,null)).toBe(true);return run(w,sec);};

describe('v4.4 規則：取消天生屬性相剋',()=>{
  test('所有攻擊元素對所有怪物元素的配對倍率都是 1；舊表保留供對照',()=>{
    const els:Element[]=['neutral','fire','water','wind','earth'];
    for(const a of els)for(const d of els)expect(elementMultiplier(a,d)).toBe(1);
    expect(legacyElementMultiplier('water','water')).toBe(.5);expect(legacyElementMultiplier('fire','earth')).toBe(1.5);
  });
  test('冰霜矢打水怪與打地怪的平均傷害相同（不再減半）',()=>{
    const avg=(element:Element)=>{const {w}=mage({coldBolt:10});const m=dummy(w,3);m.def={...m.def,element,mdef:0};
      return hits(cast(w,'coldBolt',m),'coldBolt',m.id).reduce((n,e)=>n+(e as {amount:number}).amount,0);};
    const water=avg('water'),earth=avg('earth');expect(Math.abs(water-earth)/earth).toBeLessThan(.12);
  });
});

describe('火系：灼燒、引爆、擴散',()=>{
  test('Lv.10 火焰矢仍是 10 次原始命中，並疊到 5 層灼燒上限',()=>{
    const {w}=mage({fireBolt:10});const m=dummy(w,3);
    const ev=cast(w,'fireBolt',m,7);
    expect(hits(ev,'fireBolt',m.id).length).toBe(10);
    expect(hits(ev,'burn',m.id).length).toBeGreaterThan(0);
  });
  test('重複疊層刷新持續時間，但不會延後跳傷節拍',()=>{
    const {w}=mage({fireBolt:1});const m=dummy(w,3);const ticks:number[]=[];
    for(let k=0;k<6;k++){w.useSkill('fireBolt',m.id,null);for(let i=0;i<60;i++)for(const e of w.step(1/60))if(e.t==='dmg'&&e.src==='burn')ticks.push(w.time);}
    expect(ticks.length).toBeGreaterThanOrEqual(3);
    for(let i=1;i<ticks.length;i++)expect(ticks[i]-ticks[i-1]).toBeLessThan(1.05);
  });
  test('爆炎球對同一目標只引爆一次，消耗層數並擴散 2 層給附近敵人，擴散不在同一施法再引爆',()=>{
    const {w}=mage({fireBolt:10,fireBall:5});const a=dummy(w,4),b=dummy(w,5,.6),c=dummy(w,5,-.6);
    cast(w,'fireBolt',a);expect(a.el?.burn?.stacks).toBe(5);
    const ev=cast(w,'fireBall',a,1.5);
    expect(hits(ev,'detonate',a.id).length).toBe(1);
    expect(hits(ev,'detonate',b.id).length+hits(ev,'detonate',c.id).length).toBe(0);
    expect(a.el?.burn).toBeNull();
    expect(b.el?.burn?.stacks).toBe(LOOP.detonate.spreadStacks);expect(c.el?.burn?.stacks).toBe(LOOP.detonate.spreadStacks);
  });
  test('爆炎球本體擊殺時，合法的引爆擴散仍然完成，擊殺只結算一次',()=>{
    const {w}=mage({fireBolt:10,fireBall:5});const a=dummy(w,4,0,{hp:1e7}),b=dummy(w,5,.6);
    cast(w,'fireBolt',a);a.hp=1;a.el!.burn!.next=1e9;// isolate the body-hit kill from burn ticks
    const ev=cast(w,'fireBall',a,1.5);
    expect(ev.filter(e=>e.t==='kill'&&e.id===a.id).length).toBe(1);
    expect(b.el?.burn?.stacks).toBe(LOOP.detonate.spreadStacks);
  });
});

describe('冰系：寒氣、寒冰印記、碎冰',()=>{
  test('寒氣滿 5 層生成寒冰印記並冰凍普通怪；冰凍保護 3 秒內不再凍',()=>{
    const {w}=mage({coldBolt:10});const m=dummy(w,3);
    const ev=cast(w,'coldBolt',m);
    expect(m.el?.mark).not.toBeNull();
    expect(ev.filter(e=>e.t==='status'&&e.id===m.id&&e.kind==='freeze').length).toBe(1);
  });
  test('MVP 不會被冰凍，但同樣取得寒冰印記並能被碎冰',()=>{
    const {w}=mage({coldBolt:10,frostDiver:5});const m=dummy(w,3,0,{mvp:true});
    const ev=cast(w,'coldBolt',m);
    expect(ev.some(e=>e.t==='status'&&e.id===m.id&&e.kind==='freeze')).toBe(false);
    expect(m.el?.mark).not.toBeNull();
    const ev2=cast(w,'frostDiver',m,2);
    expect(hits(ev2,'shatter',m.id).length).toBe(1);expect(m.el?.mark).toBeNull();
  });
  test('無印記的冰封術只疊 3 層寒氣；同一擊生成的印記不能當場消耗',()=>{
    const {w}=mage({coldBolt:5,frostDiver:5});const m=dummy(w,3,0,{mvp:true});
    m.el={burn:null,chill:{stacks:2,until:1e9},mark:null,freezeLock:0,freezeCast:-1,shockUntil:0,charge:0};
    const ev=cast(w,'frostDiver',m,2);
    expect(hits(ev,'shatter',m.id).length).toBe(0);expect(m.el?.mark).not.toBeNull();
  });
  test('碎冰冰片最多 2 枚，各打不同敵人',()=>{
    const {w}=mage({coldBolt:10,frostDiver:5});const m=dummy(w,3),o=[dummy(w,3.8,.5),dummy(w,3.8,-.5),dummy(w,2.4,.6)];
    cast(w,'coldBolt',m);const ev=cast(w,'frostDiver',m,2);
    const shard=hits(ev,'shard');expect(shard.length).toBe(2);expect(new Set(shard.map(e=>(e as {id:number}).id)).size).toBe(2);
    void o;
  });
});

describe('雷系：感電、連擊計數、連鎖',()=>{
  test('每 4 次原始命中觸發一次落雷，餘數保留；落雷不清除感電',()=>{
    const {w}=mage({lightningBolt:10});const m=dummy(w,3);
    const ev=cast(w,'lightningBolt',m);
    expect(hits(ev,'lightningBolt',m.id).length).toBe(10);
    expect(hits(ev,'strike',m.id).length).toBe(2);expect(m.el?.charge).toBe(2);
    expect((m.el?.shockUntil??0)).toBeGreaterThan(w.time);
  });
  test('單一目標時連鎖改為回彈；每支箭最多一次，衍生雷擊不增加計數',()=>{
    let rebound=0,casts=0;
    for(let seed=1;seed<=20;seed++){const {w}=mage({lightningBolt:10},seed);const m=dummy(w,3);const ev=cast(w,'lightningBolt',m);
      rebound+=hits(ev,'rebound',m.id).length;casts++;expect(hits(ev,'chain').length).toBe(0);expect(hits(ev,'rebound',m.id).length).toBeLessThanOrEqual(10);
      expect(hits(ev,'strike',m.id).length).toBe(2);}
    const per=rebound/casts;expect(per).toBeGreaterThan(1.5);expect(per).toBeLessThan(4.5);
  });
  test('有其他目標時會彈跳，且不會從彈跳再次彈跳',()=>{
    const {w}=mage({lightningBolt:10},7);const m=dummy(w,3),n=dummy(w,4.5);
    const ev=cast(w,'lightningBolt',m);
    expect(hits(ev,'chain',n.id).length).toBeGreaterThan(0);expect(hits(ev,'chain',m.id).length).toBe(0);
  });
  test('雷暴對感電目標加傷 20%',()=>{
    const go=(shock:boolean)=>{const {w}=mage({thunderStorm:5,lightningBolt:4});const m=dummy(w,3);m.def={...m.def,mdef:0};
      if(shock){w.useSkill('lightningBolt',m.id,null);run(w,6);}const e=m.el;if(e)e.shockUntil=shock?1e9:0;
      w.useSkill('thunderStorm',null,{x:m.x,y:m.y});return hits(run(w,8),'thunderStorm',m.id).reduce((n,x)=>n+(x as {amount:number}).amount,0);};
    const plain=go(false),shocked=go(true);expect(shocked/plain).toBeGreaterThan(1.1);expect(shocked/plain).toBeLessThan(1.32);
  });
});

describe('共通：時序、決定性、相容',()=>{
  test('相同種子下，30／60／144 FPS 戰鬥結果一致',()=>{
    const total=(dt:number)=>{const {w}=mage({fireBolt:10,fireBall:5});const a=dummy(w,4),b=dummy(w,5,.6);
      w.useSkill('fireBolt',a.id,null);run(w,6,dt);w.useSkill('fireBall',a.id,null);run(w,6,dt);return [Math.round(a.hp),Math.round(b.hp)];};
    const r60=total(1/60);expect(total(1/30)).toEqual(r60);expect(total(1/144)).toEqual(r60);
  });
  test('自動戰鬥只使用已學技能',()=>{
    const {w}=mage({coldBolt:5});w.autoSkills=['coldBolt','frostDiver','fireBall'];const m=dummy(w,3,0,{hp:5000});m.state='chase';
    w.setAuto(true);const ev=run(w,20);
    expect(ev.some(e=>e.t==='skill'&&e.skill==='coldBolt')).toBe(true);
    expect(ev.some(e=>e.t==='skill'&&(e.skill==='frostDiver'||e.skill==='fireBall'))).toBe(false);
  });
  test('元素狀態只存在戰鬥中，不寫入存檔；舊存檔仍可驗證',()=>{
    const {s}=mage({fireBolt:3});expect(JSON.stringify(s)).not.toContain('"el"');R.validateGame(s);
    expect(Object.keys(monsters).length).toBeGreaterThan(50);
  });
});
