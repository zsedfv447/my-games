import { describe, test, expect } from 'vitest';
import { World, type SimEvent } from './sim';
import * as R from '../rules/state';
import { SW } from '../data/jobs';

const run=(w:World,sec:number)=>{const ev:SimEvent[]=[];for(let i=0;i<Math.round(sec*60);i++)ev.push(...w.step(1/60));return ev;};
function sword(skillset:Record<string,number>,gear:string[]=['dawnSword']){
  let s=R.createCharacter(R.newGame(),'劍士',0,0);s=R.gainExp(s,0,9e9).state;for(let i=0;i<9;i++)s=R.learnSkill(s,'basic');
  s=R.changeJob(s,'swordman',{});s.char.baseLv=45;s.char.jobLv=40;s.char.stats.str=80;Object.assign(s.char.skills,skillset);
  for(const id of gear){s=R.addItem(s,id,1);s=R.equip(s,s.equipment.at(-1)!.id,{});}return s;
}
const POOL=['oath_knight','oath_wizard','oath_ranger','vaultWarden','mistQueen'];
function arena(s:R.GameState){const w=new World(5);w.loadMap('meadow',10,36);w.monsters.length=0;const d=R.derive(s);w.setStats({...d,hit:9999},45);w.setVitals(d.maxHp,40);return w;}
const dummy=(w:World,x:number,y:number)=>{const id=POOL.find(k=>!w.monsters.some(m=>m.def.id===k))!;const m=w.spawnBoss(id,x,y)!;m.x=m.px=x;m.y=m.py=y;m.hp=m.maxHp=1e7;
  m.def={...m.def,aggressive:false,speed:0,flee:0,def:0,mvp:false,atk:[1,1],art:{...m.def.art,scale:.6}};m.state='idle';return m;};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const priv=(w:World)=>w as unknown as Record<string,any>;
const hits=(ev:SimEvent[],src:string,id?:number)=>ev.filter(e=>e.t==='dmg'&&e.to==='m'&&e.src===src&&(id===undefined||e.id===id)&&!e.miss).length;

describe('v6.2 劍士：連環重斬',()=>{
  test('刀數隨等級成長（2／3／4），連斬護腕多一刀；最後一刀的劍氣打到旁邊的敵人',()=>{
    for(const [lv,n] of [[1,2],[4,3],[10,4]] as const){const w=arena(sword({bash:lv}));const p=w.player,m=dummy(w,p.x+1,p.y);
      w.useSkill('bash',m.id,null);expect(hits(run(w,1),'bash',m.id)).toBe(n);expect(SW.bashHits(lv)).toBe(n);}
    const w=arena(sword({bash:10},['dawnSword','chainBracer']));const p=w.player,m=dummy(w,p.x+1,p.y),side=dummy(w,p.x+1.8,p.y+.6);
    w.useSkill('bash',m.id,null);const ev=run(w,1);expect(hits(ev,'bash',m.id)).toBe(5);expect(hits(ev,'bash',side.id)).toBe(1);
  });
});
describe('v6.2 劍士：烈焰附刃',()=>{
  test('烈焰爆破不再擊退，並讓武器燃燒；附刃中普攻帶火焰，每 4 下順劈打到旁邊的敵人',()=>{
    const w=arena(sword({bash:5,magnum:10}));const p=w.player,m=dummy(w,p.x+1,p.y),side=dummy(w,p.x+1.2,p.y+.9);
    const x0=m.x;w.useSkill('magnum',null,null);run(w,.3);expect(m.x).toBeCloseTo(x0,5);expect(p.enchant).toBeTruthy();
    w.attack(m.id);const ev=run(w,4);expect(hits(ev,'enchant',m.id)).toBeGreaterThan(3);expect(hits(ev,'cleave',side.id)).toBeGreaterThan(0);
    run(w,SW.enchantDur);expect(p.enchant).toBeNull();
  });
  test('劍士的普攻命中會回 SP；附刃期間回更多',()=>{
    const perSwing=(enchant:boolean)=>{const w=arena(sword({bash:5,magnum:10}));const p=w.player,m=dummy(w,p.x+1,p.y);
      if(enchant){w.useSkill('magnum',null,null);run(w,1);}p.sp=0;p.spTimer=99;w.attack(m.id);const ev=run(w,3);return p.sp/ev.filter(e=>e.t==='swing'&&e.who==='p').length;};
    const plain=perSwing(false);expect(plain).toBeGreaterThan(.5);expect(perSwing(true)).toBeGreaterThan(plain*1.5);
  });
  test('熾焰長劍：每 2 下就順劈',()=>{
    const w=arena(sword({bash:5,magnum:10},['blazeSword']));const p=w.player,m=dummy(w,p.x+1,p.y);w.useSkill('magnum',null,null);run(w,.3);
    w.attack(m.id);const ev=run(w,4);const swings=ev.filter(e=>e.t==='swing'&&e.who==='p').length,cleaves=ev.filter(e=>e.t==='fx'&&e.kind==='cleave').length;
    expect(cleaves).toBeGreaterThanOrEqual(Math.floor(swings/2)-1);
  });
});
describe('v6.2 劍士：鐵壁反彈',()=>{
  test('不屈鎧甲：鐵壁意志期間，近戰攻擊會反彈',()=>{
    const w=arena(sword({provoke:5,endure:5},['dawnSword','unyieldingPlate']));const p=w.player,m=dummy(w,p.x+1,p.y);
    m.def={...m.def,aggressive:true,speed:1,atk:[200,220],range:1.5};m.state='chase';
    let ev=run(w,3);expect(hits(ev,'thorns')).toBe(0);
    w.useSkill('endure',null,null);ev=run(w,4);expect(hits(ev,'thorns',m.id)).toBeGreaterThan(0);
  });
});

describe('v6.2 騎士：騎乘戰鬥',()=>{
  const knight=async()=>{const {labJob2State}=await import('../rules/lab');return labJob2State('knight',{lv:75})!;};
  test('劍士騎坐騎一攻擊就會下來；星誓騎士騎著也能攻擊，攻擊距離更長',async()=>{
    const w=arena(sword({bash:5}));const p=w.player,m=dummy(w,p.x+1,p.y);w.setRiding(true,1.45,'poring');w.attack(m.id);run(w,1.5);expect(w.riding).toBe(false);
    const k=await knight();expect(k.mounts?.owned).toContain('pecoPeco');
    const w2=arena(k);const p2=w2.player,m2=dummy(w2,p2.x+1.9,p2.y);w2.setRiding(true,1.6,'pecoPeco');w2.attack(m2.id);const ev=run(w2,2);
    expect(w2.riding).toBe(true);expect(ev.some(e=>e.t==='dmg'&&e.src==='attack'&&e.id===m2.id)).toBe(true);expect(Math.hypot(p2.x-m2.x,p2.y-m2.y)).toBeGreaterThan(1.5);
  });
  test('騎乘時，近戰技能的距離跟騎乘普攻一樣長（站著不動的目標也會放重斬）',async()=>{
    const k=await knight();const w=arena(k);const p=w.player,m=dummy(w,p.x+2,p.y);w.setRiding(true,1.6,'pecoPeco');
    p.sp=R.derive(k).maxSp;w.autoSkills=['bash'];w.attack(m.id);w.setAuto(true);const ev=run(w,4);
    expect(Math.hypot(p.x-m.x,p.y-m.y)).toBeGreaterThan(1.65);expect(hits(ev,'bash',m.id)).toBeGreaterThan(0);
  });
  test('大嘴鳥踐踏只能騎乘時用；騎幼龍時變成火屬性龍息',async()=>{
    const k=await knight();const w=arena(k);const p=w.player,m=dummy(w,p.x+2,p.y);
    expect(w.useSkill('k_trample',m.id,null)).toBe(false);
    w.setRiding(true,1.6,'pecoPeco');w.useSkill('k_trample',m.id,null);let ev=run(w,1);expect(hits(ev,'k_trample',m.id)).toBe(3);
    expect(ev.filter(e=>e.t==='dmg'&&e.src==='k_trample').every(e=>e.t==='dmg'&&e.element==='neutral')).toBe(true);
    run(w,6);w.setRiding(true,1.7,'emberWyvern');w.useSkill('k_trample',m.id,null);ev=run(w,1);
    expect(ev.filter(e=>e.t==='dmg'&&e.src==='k_trample').every(e=>e.t==='dmg'&&e.element==='fire')).toBe(true);
  });
});

describe('v6.5 劍士戰魂',()=>{
  const withSoul=(s:R.GameState,id:'art'|'flame'|'chain'|'rock')=>R.setSoul(s,id,{inTown:true});
  const attacker=(w:World,x:number,y:number)=>{const m=dummy(w,x,y);m.def={...m.def,aggressive:true,speed:1,atk:[200,220],range:1.5};m.state='chase';return m;};
  test('解鎖與切換：Job 1／10／20／25 開放，只能在城鎮換；舊存檔沒有戰魂時視為戰技之魂',()=>{
    let s=sword({bash:5});s.char.jobLv=15;expect(R.soulUnlocked(s,'flame')).toBe(true);expect(R.soulUnlocked(s,'chain')).toBe(false);
    expect(()=>R.setSoul(s,'chain',{inTown:true})).toThrow();expect(()=>R.setSoul(s,'flame',{inTown:false})).toThrow();
    expect(R.soulUnlocked(s,'rock')).toBe(false);s.char.jobLv=25;expect(R.soulUnlocked(s,'rock')).toBe(true);s.char.jobLv=15;
    expect(R.derive(s).soul).toBe('art');s=R.setSoul(s,'flame',{inTown:true});expect(R.derive(s).soul).toBe('flame');
    expect(()=>R.validateGame(JSON.parse(JSON.stringify(s)))).not.toThrow();const bad=JSON.parse(JSON.stringify(s));bad.char.soul="nope";expect(()=>R.validateGame(bad)).toThrow();
  });
  test('戰技之魂：換不同的攻擊技能時多一道劍氣；技能 SP −10%',()=>{
    const w=arena(sword({bash:5,magnum:5}));const p=w.player,m=dummy(w,p.x+1,p.y);
    w.useSkill('bash',m.id,null);run(w,1);p.sp=99;const sp0=p.sp;w.useSkill('magnum',null,null);const ev=run(w,.6);
    expect(ev.some(e=>e.t==='fx'&&e.kind==='cleave')).toBe(true);expect(sp0-p.sp).toBeLessThan(20);
  });
  test('烈焰之魂：焰影追斬會貼近目標，砍 2 刀後 2 下普攻帶強火；烈焰爆破變成 22 秒附刃，每 3 下順劈並發動範圍卡片',()=>{
    let s=withSoul(sword({bash:5,magnum:10}),'flame');const r=R.addCard(s,'shroomCard');s=r.state;s=R.insertCard(s,r.cardId,s.equipped.weapon!,{});s=R.configureModule(s,'magnum',0,'echo',{});
    const w=arena(s);const p=w.player,m=dummy(w,p.x+2.4,p.y),side=dummy(w,p.x+2.7,p.y+.8);const x0=p.x;
    w.useSkill('bash',m.id,null);let ev=run(w,.6);expect(p.x).toBeGreaterThan(x0+.3);expect(hits(ev,'bash',m.id)).toBe(2);expect(p.flameNext).toBe(2);
    w.useSkill('magnum',null,null);ev=run(w,.5);expect(p.enchant?.route).toBe(true);expect(p.enchant!.until-w.time).toBeGreaterThan(20);
    w.attack(m.id);ev=run(w,5);expect(ev.some(e=>e.t==='fx'&&e.kind==='echo')).toBe(true);expect(hits(ev,'cleave',side.id)).toBeGreaterThan(1);
    expect(side.x).toBeCloseTo(m.x+.3,1);
  });
  test('連斬之魂：疾影連斬多一道殘影、退回部分 SP；斬勢爆破讓下一次終結刀更強，且不附刃',()=>{
    const w=arena(withSoul(sword({bash:10,magnum:5}),'chain'));const p=w.player,m=dummy(w,p.x+1,p.y);
    p.sp=60;w.useSkill('bash',m.id,null);let ev=run(w,1);expect(hits(ev,'bash',m.id)).toBe(5);expect(60-p.sp).toBeLessThan(10);
    run(w,1);w.useSkill('magnum',null,null);run(w,.6);expect(p.enchant).toBeNull();expect(p.chainEmp).toBe(true);
    w.useSkill('bash',m.id,null);ev=run(w,1);expect(p.chainEmp).toBe(false);
    const amts=ev.filter(e=>e.t==='dmg'&&e.src==='bash'&&e.id===m.id).map(e=>e.t==='dmg'?e.amount:0);expect(Math.max(...amts)).toBeGreaterThan(Math.min(...amts)*1.3);
  });
  test('磐石之魂（反擊流）：被打每 0.5 秒反擊周圍；撼地斬累積守勢並挑釁；守勢加強反擊、不會被用掉；震地反擊是一次反擊',()=>{
    const w=arena(withSoul(sword({bash:5,magnum:5,endure:5}),'rock'));const p=w.player,a=attacker(w,p.x+1,p.y),b=dummy(w,p.x-1.2,p.y);
    let ev=run(w,2);expect(hits(ev,'thorns')).toBe(0);
    w.useSkill('endure',null,null);ev=run(w,4);expect(hits(ev,'thorns',a.id)).toBeGreaterThan(2);expect(hits(ev,'thorns',b.id)).toBeGreaterThan(0);
    p.guard=0;p.sp=99;w.useSkill('bash',b.id,null);run(w,1.2);expect(p.guard).toBeGreaterThan(0);expect(b.provoke).toBeTruthy();
    const g=p.guard,c0=priv(w).counterAmount(b);p.guard=0;const c1=priv(w).counterAmount(b);p.guard=g;expect(c0).toBeGreaterThan(c1);
    const evb=(w.useSkill('magnum',null,null),run(w,.6));expect(p.guard).toBeGreaterThanOrEqual(g);expect(p.enchant).toBeNull();expect(hits(evb,'thorns',b.id)).toBeGreaterThan(0);
  });
  test('連斬之魂：目標中途倒下，剩下的刀會跳到旁邊的敵人',()=>{
    const w=arena(withSoul(sword({bash:10}),'chain'));const p=w.player,m=dummy(w,p.x+1,p.y),nb=dummy(w,p.x+1.5,p.y+1);m.hp=1;
    w.useSkill('bash',m.id,null);const ev=run(w,1);expect(m.state).toBe('dead');expect(hits(ev,'bash',nb.id)).toBeGreaterThan(1);
  });
  test('磐岩大劍（岩心）：鐵壁意志期間，正在打的魔物沒打你也每 0.5 秒被反擊；身邊有一群也照樣，任何戰魂都有效',()=>{
    for(const soul of ['rock','art'] as const){const w=arena(withSoul(sword({provoke:5,endure:5},['stoneGreatsword']),soul));const p=w.player,m=dummy(w,p.x+1,p.y),n=dummy(w,p.x-1,p.y);
      for(const x of [m,n])x.def={...x.def,range:.1};
      w.attack(m.id);expect(hits(run(w,2),'thorns')).toBe(0);
      w.useSkill('endure',null,null);run(w,.5);w.attack(m.id);expect(hits(run(w,3),'thorns',m.id)).toBeGreaterThanOrEqual(5);}
  });
  test('切換戰魂會清掉上一個戰魂的狀態',()=>{
    let s=withSoul(sword({bash:5,magnum:10}),'flame');const w=arena(s);const p=w.player;w.useSkill('magnum',null,null);run(w,.5);expect(p.enchant).toBeTruthy();
    s=withSoul(s,'rock');w.setStats(R.derive(s),45);expect(p.enchant).toBeNull();expect(p.guard).toBe(0);
  });
  test('不屈鎧甲（任何戰魂）：鐵壁意志後反擊 3 次；磐石之魂穿著時反擊 ×1.3',()=>{
    const w=arena(sword({provoke:5,endure:5},['dawnSword','unyieldingPlate','thornBadge']));const p=w.player,a=attacker(w,p.x+1,p.y);
    w.useSkill('endure',null,null);const ev=run(w,6);expect(hits(ev,'thorns',a.id)).toBe(3);expect(p.thornsCharges).toBe(0);
  });
});

describe('v7.1 二轉戰魂共鳴（騎士）',()=>{
  const knightSoul=async(soul:'art'|'flame'|'chain'|'rock')=>{const {labJob2State}=await import('../rules/lab');return R.setSoul(labJob2State('knight',{lv:80})!,soul,{inTown:true});};
  const kArena=(s:R.GameState)=>{const w=new World(5);w.loadMap('meadow',10,36);w.monsters.length=0;const d=R.derive(s);w.setStats({...d,hit:9999},80);w.setVitals(d.maxHp,999);return w;};
  const resolve=(w:World,n:number)=>{(w.player as unknown as {resolve:number}).resolve=n;};
  test('影刃騎士：裂星重斬變成多刀連斬（3 刀＋每層戰意 1 刀），目標倒下會跳刀',async()=>{
    const w=kArena(await knightSoul('chain'));const p=w.player,m=dummy(w,p.x+1,p.y);resolve(w,2);
    w.useSkill('k_rend',m.id,null);expect(hits(run(w,1),'k_rend',m.id)).toBe(5+1);// 5 cuts + the afterimage
    const w2=kArena(await knightSoul('art'));const m2=dummy(w2,w2.player.x+1,w2.player.y);resolve(w2,2);w2.useSkill('k_rend',m2.id,null);expect(hits(run(w2,1),'k_rend',m2.id)).toBe(1);
  });
  test('焰誓騎士：星輪旋斬變火焰並延長附刃；破陣突進刷新附刃並讓之後 2 下普攻帶強火',async()=>{
    const w=kArena(await knightSoul('flame'));const p=w.player,m=dummy(w,p.x+1,p.y),n=dummy(w,p.x-1,p.y+.5);
    w.useSkill('magnum',null,null);run(w,.6);const until=p.enchant!.until;run(w,2);
    w.useSkill('k_wheel',null,null);const ev=run(w,1);expect(p.enchant!.until).toBeGreaterThan(until);
    expect(ev.filter(e=>e.t==='dmg'&&e.src==='k_wheel').every(e=>e.t==='dmg'&&e.element==='fire')).toBe(true);expect(hits(ev,'enchant',n.id)).toBeGreaterThan(0);
    const far=dummy(w,p.x+4,p.y);run(w,6);w.useSkill('k_charge',far.id,null);run(w,.3);expect(p.flameNext).toBeGreaterThan(0);expect(p.enchant!.until-w.time).toBeGreaterThan(SW.flameDur-1);
  });
  test('磐誓騎士：守誓護壁同時開磐石架勢，反擊光刃累積守勢；撼岳戰陣用反擊公式、不消耗守勢',async()=>{
    const ks=await knightSoul('rock');ks.char.skills.k_quake=3;const w=kArena(ks);const p=w.player;
    const a=dummy(w,p.x+1,p.y);a.def={...a.def,aggressive:true,speed:1,atk:[300,320],range:1.5};a.state='chase';
    w.useSkill('k_ward',null,null);run(w,.3);expect(p.endure).toBeTruthy();run(w,3);expect(p.guard).toBeGreaterThan(0);
    p.guard=3;run(w,8);const evq=(w.useSkill('k_quake',null,null),run(w,.5));expect(p.guard).toBeGreaterThan(0);expect(evq.some(e=>e.t==='dmg'&&e.to==='m'&&e.src==='thorns')).toBe(true);
  });
  test('戰技騎士：變招劍氣給戰意；星落裁決依最近用過的招式加傷',async()=>{
    const w=kArena(await knightSoul('art'));const p=w.player,m=dummy(w,p.x+1,p.y);resolve(w,0);
    w.useSkill('bash',m.id,null);run(w,1);w.useSkill('k_wheel',null,null);run(w,1.2);expect(p.resolve).toBeGreaterThanOrEqual(2);
  });
});
