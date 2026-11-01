import { describe, test, expect } from 'vitest';
import * as R from './state';
import { rollQuality, rollEquip, effectiveDef, affixPool } from './affix';
import { items, type EquipDef } from '../data/items';
import { World, type SimEvent } from '../world/sim';
import { mulberry32 } from '../world/rng';

const run=(w:World,sec:number)=>{const ev:SimEvent[]=[];for(let i=0;i<Math.round(sec*60);i++)ev.push(...w.step(1/60));return ev;};
describe('v6.3 裝備品質與詞綴',()=>{
  test('品質機率：大多是普通，傳說很稀有；首領加成提高好裝備機率',()=>{
    const r=mulberry32(7),n=20000,count=(b:number)=>{const c=[0,0,0,0];for(let i=0;i<n;i++)c[rollQuality(r(),b)]++;return c;};
    const plain=count(1),boss=count(5);
    expect(plain[0]/n).toBeGreaterThan(.6);expect(plain[3]/n).toBeLessThan(.03);expect(boss[3]).toBeGreaterThan(plain[3]*3);expect(boss[2]).toBeGreaterThan(plain[2]*3);
  });
  test('精良 1 條、稀有 2 條、傳說 3 條詞綴＋傳說效果；詞綴不重複、符合部位',()=>{
    const r=mulberry32(3);
    for(const id of ['astralScepter','astralBlade','voyagerRing','skyCloak']){const d=items[id] as EquipDef;
      for(const q of [1,2,3] as const){const roll=rollEquip(id,q,r,'mage');expect(roll.affix).toHaveLength(q);expect(new Set(roll.affix.map(a=>a.k)).size).toBe(q);
        for(const a of roll.affix)expect(affixPool(d)).toContain(a.k);expect(!!roll.legend).toBe(q===3);}}
  });
  test('詞綴真的進入角色能力；存檔驗證通過；賣價較高',()=>{
    let s=R.createCharacter(R.newGame(),'打寶',0,0);s=R.gainExp(s,0,9e9).state;for(let i=0;i<9;i++)s=R.learnSkill(s,'basic');s=R.changeJob(s,'mage',{});s.char.baseLv=80;
    const before=R.derive(s);
    s=R.addItem(s,'voyagerRing',1,{q:3,affix:[{k:'cast',v:6},{k:'int',v:4},{k:'skill',v:7}],legend:'storm'});const e=s.equipment.at(-1)!;
    s=R.equip(s,e.id,{inTown:true});const d=R.derive(s);
    expect(d.castMult).toBeLessThan(before.castMult);expect(d.stats.int).toBe(before.stats.int+4);expect(d.gearFx).toContain('storm');
    expect(effectiveDef(e).cast).toBe(6);expect(R.equipLabel(e)).toContain('傳說');
    expect(()=>R.validateGame(s)).not.toThrow();
    const bad=structuredClone(s);bad.equipment.at(-1)!.affix=[{k:'nope' as 'cast',v:3}];expect(()=>R.validateGame(bad)).toThrow();
    s=R.unequip(s,'accessory',{inTown:true});const z=s.char.zeny;s=R.sellEquip(s,e.id);expect(s.char.zeny-z).toBeGreaterThan(R.sellPrice('voyagerRing')*2);
  });
});
describe('v6.3 野外菁英',()=>{
  const field=()=>{const w=new World(9);w.loadMap('forest',30,36);const d=R.derive(R.createCharacter(R.newGame(),'x',0,0));w.setStats({...d,maxHp:1e6,atk:9999,weaponAtk:9999,hit:9999},40);w.setVitals(1e6,100);return w;};
  test('野外地圖會出現少量菁英；菁英更硬、經驗 ×4、名字帶詞綴',()=>{
    let elites=0,total=0;for(let seed=1;seed<40;seed++){const w=new World(seed);w.loadMap('forest',30,36);total+=w.monsters.length;elites+=w.monsters.filter(m=>m.elite).length;}
    expect(elites/total).toBeGreaterThan(.02);expect(elites/total).toBeLessThan(.12);
    const w=field();const m=w.monsters.find(m=>!m.def.mvp)!;const base=m.def;w.makeElite(m,['tough']);
    expect(m.maxHp).toBe(Math.round(base.hp*2.5*1.8));expect(m.def.exp).toBe(base.exp*4);expect(m.def.name).toContain('堅韌');
    const t=new World(9);t.loadMap('town',24,30);expect(t.monsters.some(m=>m.elite)).toBe(false);
  });
  test('分裂菁英倒下時變成兩隻；爆裂菁英倒下後預告爆炸',()=>{
    const w=field();const p=w.player,m=w.monsters.find(m=>!m.def.mvp)!;w.makeElite(m,['split','burst']);m.x=p.x+1;m.y=p.y;m.hp=1;
    const n=w.monsters.length;w.attack(m.id);const ev=run(w,.6);
    expect(w.monsters.length).toBe(n+2);expect(ev.some(e=>e.t==='fx'&&e.kind==='warn')).toBe(true);
  });
});

describe('v6.3 星光深淵',()=>{
  test('每層產生一波魔物；第 5 層是首領層；清光後出現寶箱並發出突破事件',()=>{
    const w=new World(4);w.loadMap('abyss',6,20);const d=R.derive(R.createCharacter(R.newGame(),'x',0,0));w.setStats({...d,maxHp:1e7,atk:99999,weaponAtk:99999,hit:9999,range:30},80);w.setVitals(1e7,100);
    w.startAbyssFloor(1);expect(w.monsters.length).toBeGreaterThanOrEqual(8);expect(w.abyss).toMatchObject({floor:1,cleared:false,boss:false});
    for(const m of w.monsters)m.hp=1;let ev:SimEvent[]=[];for(let i=0;i<40&&!w.abyss!.cleared;i++){const m=w.monsters.find(x=>x.state!=='dead');if(m)w.attack(m.id);ev=ev.concat(run(w,.5));}
    expect(w.abyss!.cleared).toBe(true);expect(ev.some(e=>e.t==='abyss'&&e.phase==='clear'&&e.floor===1)).toBe(true);expect(w.chests.length).toBe(1);
    w.startAbyssFloor(5);expect(w.monsters.some(m=>m.def.mvp)).toBe(true);
    w.startAbyssFloor(40);const deep=w.monsters.find(m=>!m.def.mvp)!;expect(deep.def.level).toBeGreaterThanOrEqual(70);
  });
  test('最高紀錄寫進存檔',()=>{
    let s=R.createCharacter(R.newGame(),'x',0,0);let r=R.clearAbyssFloor(s,3,100,100);expect(r.record).toBe(true);s=r.state;expect(s.abyss?.best).toBe(3);
    r=R.clearAbyssFloor(s,2,100,100);expect(r.record).toBe(false);expect(r.state.abyss?.best).toBe(3);expect(()=>R.validateGame(r.state)).not.toThrow();
  });
});

describe('v6.3 星光天賦',()=>{
  const lv=(n:number)=>{let s=R.createCharacter(R.newGame(),'x',0,0);s=R.gainExp(s,0,9e9).state;for(let i=0;i<9;i++)s=R.learnSkill(s,'basic');s=R.changeJob(s,'swordman',{});s.char.baseLv=n;return s;};
  test('Lv.40 起每級 1 點，深淵每 5 層 1 點；點數用完就不能再點',()=>{
    let s=lv(39);expect(R.talentPoints(s)).toBe(0);expect(R.talentBlock(s,'hpPct')).toContain('沒有星點');
    s=lv(45);s.abyss={best:12};expect(R.talentPoints(s)).toBe(6+2);
    for(let i=0;i<5;i++)s=R.learnTalent(s,'hpPct');expect(R.talentBlock(s,'hpPct')).toBe('已達最高等級');
    const base=R.derive(lv(45)).maxHp;expect(R.derive(s).maxHp/base).toBeCloseTo(1.2,1);
    expect(()=>R.validateGame(s)).not.toThrow();
  });
  test('星座投入 15 點才開放頂點天賦；城鎮可重新分配',()=>{
    let s=lv(80);for(const k of ['atkPct','crit','skill'] as const)for(let i=0;i<5;i++)s=R.learnTalent(s,k);
    expect(R.talentBlock(s,'starburst')).toBeNull();s=R.learnTalent(s,'starburst');expect(R.derive(s).talentFx).toContain('starburst');
    expect(R.talentBlock(s,'aegis')).toContain('15');
    s=R.resetTalents(s,{inTown:true});expect(R.talentSpent(s)).toBe(0);
  });
  test('星爆：打倒魔物會炸傷旁邊的魔物',()=>{
    const s=lv(80);for(const k of ['atkPct','crit','skill'] as const)for(let i=0;i<5;i++)Object.assign(s,R.learnTalent(s,k));
    let t=lv(80);for(const k of ['atkPct','crit','skill'] as const)for(let i=0;i<5;i++)t=R.learnTalent(t,k);t=R.learnTalent(t,'starburst');void s;
    const w=new World(3);w.loadMap('forest',30,36);w.setStats({...R.derive(t),atk:99999,weaponAtk:99999,hit:9999},80);w.setVitals(1e5,100);
    const live=w.monsters.filter(m=>!m.def.mvp).slice(0,2);const [a,b]=live;a.x=w.player.x+1;a.y=w.player.y;b.x=a.x+1;b.y=a.y;b.hp=b.maxHp;
    w.attack(a.id);const ev=run(w,1);expect(ev.some(e=>e.t==='dmg'&&e.src==='starburst'&&e.id===b.id)).toBe(true);
  });
});
