import { describe, test, expect } from 'vitest';
import { World, type SimEvent, type Monster } from './sim';
import * as R from '../rules/state';
import * as SF from '../rules/starfall';
import { labJob2State } from '../rules/lab';
import { monsters } from '../data/monsters';
import { rollEquip } from '../rules/affix';
import { PIT, HORDE, SIGIL, ECLIPSE, ASPECT_IDS, UNIQUE_IDS, type AspectFx } from '../data/starfall';
import type { GearFx } from '../data/ascension-items';

const run=(w:World,sec:number)=>{const ev:SimEvent[]=[];for(let i=0;i<Math.round(sec*60);i++)ev.push(...w.step(1/60));return ev;};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const priv=(w:World)=>w as unknown as Record<string,any>;
const knight=()=>labJob2State('knight',{lv:80})!;
function world(map:string,x:number,y:number,fx:GearFx[]=[],tier=1){
  const s=knight(),d=R.derive(s),w=new World(7);w.eventsEnabled=false;w.setTier(tier);w.loadMap(map,x,y);w.setStats({...d,gearFx:[...d.gearFx,...fx]},80);w.setVitals(d.maxHp,d.maxSp);return w;
}
const dmg=(ev:SimEvent[],src:string)=>ev.filter(e=>e.t==='dmg'&&e.to==='m'&&e.src===src&&!e.miss);
const kill=(w:World,m:Monster)=>priv(w).kill(m,{skill:'attack',mult:1,element:'neutral',magic:false},1);
const near=(w:World,m:Monster,dx:number,dy:number)=>{m.x=m.px=w.player.x+dx;m.y=m.py=w.player.y+dy;m.def={...m.def,speed:0,aggressive:false,atk:[1,1]};return m;};

describe('v7.0 星光難度',()=>{
  test('煉獄難度：野外魔物 HP ×3、攻擊 ×1.5、經驗 ×2.6；城鎮不受影響',()=>{
    const w=world('meadow',10,36,[],3),m=w.monsters.find(x=>!x.def.mvp&&!x.elite)!,base=monsters[m.def.id];
    expect(m.maxHp).toBe(Math.round(base.hp*3));expect(m.def.atk[1]).toBe(Math.round(base.atk[1]*1.5));expect(m.def.exp).toBe(Math.round(base.exp*2.6));
    const t=world('town',24,30,[],3);for(const n of t.monsters)expect(n.maxHp).toBe(monsters[n.def.id].hp);
  });
  test('難度要達成條件才能切換，而且只能在城鎮',()=>{
    let s=knight();expect(()=>SF.setDifficulty(s,2,{inTown:true})).toThrow();
    s={...s,abyss:{best:10}};expect(()=>SF.setDifficulty(s,2,{inTown:false})).toThrow();
    s=SF.setDifficulty(s,2,{inTown:true});expect(SF.tierOf(s).name).toBe('噩夢');expect(()=>SF.setDifficulty(s,3,{inTown:true})).toThrow();
    s={...s,starfall:{...SF.starfallOf(s),pitBest:10}};s=SF.setDifficulty(s,3,{inTown:true});expect(SF.tierOf(s).id).toBe(3);
    expect(()=>R.validateGame(JSON.parse(JSON.stringify(s)))).not.toThrow();
  });
  test('噩夢以上：菁英會掉星淵印記；煉獄以上會掉唯一裝備',()=>{
    const w=world('meadow',10,36,[],3),m=near(w,w.monsters.find(x=>!x.def.mvp)!,1,0);w.makeElite(m,['tough']);
    priv(w).crng=()=>0;w.autoLoot=false;kill(w,m);const ev=run(w,.1);
    const drops=ev.filter((e):e is Extract<SimEvent,{t:'drop'}>=>e.t==='drop').map(e=>e.item);
    expect(drops.some(i=>i.defId==='starSigil')).toBe(true);expect(drops.some(i=>i.q===4)).toBe(true);
  });
});

describe('v7.0 傳說威能與唯一裝備',()=>{
  test('傷害類威能：處決者、屠巨者、狂血、無瑕、殺戮動能、深淵之眼都乘在傷害上',()=>{
    const w=world('meadow',10,36,['executioner','giantSlayer','pristine']),m=w.monsters[0],amp=(c=false)=>priv(w).ampFor(m,c) as number;
    expect(amp()).toBeCloseTo(1.25,5);m.hp=m.maxHp*.2;expect(amp()).toBeCloseTo(1.25*1.4,5);m.elite=['tough'];expect(amp()).toBeCloseTo(1.25*1.4*1.3,5);
    const b=world('meadow',10,36,['berserk','u_abyssEye']);b.player.hp=1;expect(priv(b).ampFor(b.monsters[0],false)).toBeGreaterThan(1.4*1.55);
    const mo=world('meadow',10,36,['momentum']);for(let i=0;i<12;i++)kill(mo,mo.monsters[i]);expect(priv(mo).ampFor(mo.monsters[20],false)).toBeCloseTo(1.4,5);
  });
  test('星骸爆裂：敵人倒下時炸傷旁邊的敵人',()=>{
    const w=world('meadow',10,36,['corpseBlast']),[a,b]=w.monsters.filter(m=>!m.def.mvp);near(w,a,1,0);near(w,b,1.5,.5);
    kill(w,a);expect(dmg(run(w,.3),'corpseBlast').some(e=>e.t==='dmg'&&e.id===b.id)).toBe(true);
  });
  test('星影重施：攻擊技能會免費再放一次；環星刃在施放後切割身邊的敵人',()=>{
    const w=world('meadow',10,36,['echoCast','orbitBlades']),m=near(w,w.monsters.find(x=>!x.def.mvp)!,1,0);m.hp=m.maxHp=1e7;
    priv(w).rng=()=>0;w.player.sp=999;w.useSkill('bash',m.id,null);const ev=run(w,2);
    expect(ev.filter(e=>e.t==='skill'&&e.skill==='bash').length).toBe(2);expect(dmg(ev,'orbitBlades').length).toBeGreaterThan(1);
  });
  test('不屈星魂與鳳凰羽衣：致命傷害時留下來；群星披風一直切割；虛空之心把受到的傷害爆發出去',()=>{
    const w=world('meadow',10,36,['secondWind']),m=near(w,w.monsters[0],1,0);w.player.hp=10;priv(w).damagePlayer(1e6,'x','neutral',m);
    expect(w.player.dead).toBe(false);expect(w.player.hp).toBe(Math.round(priv(w).stats.maxHp*.3));
    const f=world('meadow',10,36,['u_phoenix']),fm=near(f,f.monsters[0],1,0);f.player.hp=10;priv(f).damagePlayer(1e6,'x','neutral',fm);expect(f.player.hp).toBe(priv(f).stats.maxHp);
    const g=world('meadow',10,36,['u_galaxy']),gm=near(g,g.monsters[0],1,0);gm.hp=gm.maxHp=1e7;expect(dmg(run(g,2),'u_galaxy').length).toBeGreaterThan(2);
    const v=world('meadow',10,36,['u_voidHeart']),vm=near(v,v.monsters[0],1,0);vm.hp=vm.maxHp=1e7;priv(v).damagePlayer(2000,'x','neutral',vm);expect(dmg(run(v,1.2),'u_voidHeart').length).toBe(1);
  });
  test('唯一裝備：固定品質「唯一」並帶 3 條強詞綴，效果寫在裝備上',()=>{
    for(const id of ['u_starfallCrown','u_phoenixRobe']){const r=rollEquip(id,0,()=>.5);expect(r.q).toBe(4);expect(r.affix.length).toBe(3);expect(r.legend).toBeUndefined();}
    expect(UNIQUE_IDS.length).toBe(8);expect(ASPECT_IDS.length).toBe(20);
  });
});

describe('v7.0 星淵工坊',()=>{
  const withGear=(q:0|1|2|3,legend?:AspectFx)=>{let s=knight();s=R.addItem(s,'mithrilSword',1,{q,affix:(q?[{k:'atk',v:10},{k:'crit',v:3},{k:'str',v:2}].slice(0,q):[]) as NonNullable<R.EquipInst['affix']>,...(legend?{legend}:{})});
    s.items.starDust=200;s.char.zeny=1e7;return {s,id:s.equipment.at(-1)!.id};};
  test('分解傳說裝備：得到星塵並把威能記進圖鑑；穿著或鎖定的不能分解',()=>{
    const {s,id}=withGear(3,'vampiric'),r=SF.salvage(s,id);expect(r.learned).toBe('vampiric');expect(SF.starfallOf(r.state).codex).toContain('vampiric');
    expect(r.state.items.starDust).toBe(200+12);expect(r.state.equipment.some(e=>e.id===id)).toBe(false);
    const worn=Object.values(s.equipped).find(Boolean)!;expect(()=>SF.salvage(s,worn)).toThrow();
  });
  test('烙印：稀有裝備烙印圖鑑裡的威能後變成傳說並多一條詞綴；淬鍊只能重擲同一條',()=>{
    let {s,id}=withGear(2);expect(()=>SF.imprint(s,id,'vampiric',()=>.3)).toThrow();
    s={...s,starfall:{...SF.starfallOf(s),codex:['vampiric']}};s=SF.imprint(s,id,'vampiric',()=>.3);
    const e=s.equipment.find(x=>x.id===id)!;expect(e.q).toBe(3);expect(e.legend).toBe('vampiric');expect(e.affix!.length).toBe(3);
    const r=SF.enchant(s,id,1,()=>.9);expect(r.state.equipment.find(x=>x.id===id)!.ench).toEqual({idx:1,n:1});
    expect(()=>SF.enchant(r.state,id,0,()=>.9)).toThrow();expect(()=>SF.enchant(r.state,id,1,()=>.9)).not.toThrow();
    expect(()=>R.validateGame(JSON.parse(JSON.stringify(r.state)))).not.toThrow();
  });
});

describe('v7.0 打造與升階',()=>{
  test('打造的裝備至少是精良；升階：普通→精良→稀有，每階多一條詞綴，精煉與特效保留，之後可以烙印成傳說',async()=>{
    const C=await import('../rules/craft');let s=knight();s.items={...s.items,trialSigil:10,foxTail:20,stoneCore:10};s.char.zeny=1e7;
    s=C.craft(s,'r_blazeSword',()=>.99);const made=s.equipment.at(-1)!;expect(made.defId).toBe('blazeSword');expect(made.q).toBe(1);expect(made.affix!.length).toBe(1);
    s=R.addItem(s,'blazeSword',1);const id=s.equipment.at(-1)!.id;s.equipment.at(-1)!.refine=5;s.items.starDust=100;
    s=SF.upgrade(s,id,()=>.4);let e=s.equipment.find(x=>x.id===id)!;expect(e.q).toBe(1);expect(e.affix!.length).toBe(1);
    s=SF.upgrade(s,id,()=>.4);e=s.equipment.find(x=>x.id===id)!;expect(e.q).toBe(2);expect(e.affix!.length).toBe(2);expect(e.refine).toBe(5);
    expect(()=>SF.upgrade(s,id,()=>.4)).toThrow();
    s={...s,starfall:{...SF.starfallOf(s),codex:['momentum']}};s=SF.imprint(s,id,'momentum',()=>.4);e=s.equipment.find(x=>x.id===id)!;
    expect(e.q).toBe(3);expect(e.legend).toBe('momentum');expect(R.derive(s).gearFx).toEqual(expect.not.arrayContaining(['x']));
    expect(()=>R.validateGame(JSON.parse(JSON.stringify(s)))).not.toThrow();
  });
});
describe('v7.0 星淵挑戰',()=>{
  const arena=(fx:GearFx[]=[])=>{const w=world('abyss',6,20,fx);return w;};
  const events=(ev:SimEvent[])=>ev.filter((e):e is Extract<SimEvent,{t:'challenge'}>=>e.t==='challenge');
  test('星淵深坑：打滿進度出現守衛，打倒守衛就通過；時間到就失敗',()=>{
    const w=arena();w.startChallenge({kind:'pit',tier:3});let ev=run(w,5);expect(events(ev)[0]?.phase).toBe('start');
    const c=w.challenge!;expect(c.kind).toBe('pit');if(c.kind!=='pit')return;expect(w.monsters.filter(m=>m.state!=='dead').length).toBeGreaterThan(3);
    c.progress=PIT.need-1;kill(w,w.monsters.find(m=>m.state!=='dead'&&!m.elite)!);expect(c.bossId).not.toBeNull();
    kill(w,w.monsters.find(m=>m.id===c.bossId)!);ev=run(w,.1);expect(c.state).toBe('won');
    const l=arena();l.startChallenge({kind:'pit',tier:1});const lc=l.challenge!;if(lc.kind==='pit')lc.until=priv(l).clock+.1;expect(events(run(l,.5)).some(e=>e.phase==='lost')).toBe(true);
  });
  test('星潮圍城：一波結束選祝福，最後一波後首領出現，打倒就完成；祝福會生效',()=>{
    const w=arena();w.startChallenge({kind:'horde'});run(w,4);const c=w.challenge!;if(c.kind!=='horde')throw new Error();
    expect(w.monsters.some(m=>m.state!=='dead')).toBe(true);kill(w,w.monsters.find(m=>m.state!=='dead')!);expect(c.embers).toBeGreaterThan(0);
    c.until=priv(w).clock;const ev=run(w,.2);expect(c.phase).toBe('choose');expect(c.offer.length).toBe(3);expect(events(ev).some(e=>e.phase==='choose')).toBe(true);
    c.offer=['fury','giant','slow'];expect(w.hordeChoose('fury')).toBe(true);expect(c.wave).toBe(2);expect(priv(w).ampFor(w.monsters[0]??{def:{},hp:1,maxHp:1},false)).toBeCloseTo(1.25,5);
    c.wave=HORDE.waves;c.until=priv(w).clock;run(w,.2);expect(c.phase).toBe('boss');kill(w,w.monsters.find(m=>m.id===c.bossId)!);run(w,.1);expect(c.phase).toBe('won');
  });
  test('印記地城：清完房間出現守護者；倒下就失敗',()=>{
    const w=arena();w.startChallenge({kind:'sigil',lv:3,affixes:['armored','blessing']});const c=w.challenge!;if(c.kind!=='sigil')throw new Error();
    expect(w.monsters.filter(m=>m.state!=='dead').length).toBe(SIGIL.roomSize(1));
    for(let r=0;r<SIGIL.rooms;r++){for(const m of w.monsters.filter(m=>m.state!=='dead'))kill(w,m);run(w,.1);}
    expect(c.bossId).not.toBeNull();kill(w,w.monsters.find(m=>m.id===c.bossId)!);run(w,.1);expect(c.state).toBe('won');
    const d=arena();d.startChallenge({kind:'sigil',lv:1,affixes:['lava']});d.player.hp=1;priv(d).damagePlayer(1e6,'x','neutral',d.monsters.find(m=>m.state!=='dead'));
    expect(d.challenge!.kind==='sigil'&&d.challenge!.state).toBe('lost');
  });
  test('通關印記地城：等級 +1 並學會一個新的威能',()=>{
    const s=knight(),r=SF.clearSigil(s,()=>0);expect(SF.starfallOf(r.state).sigilLv).toBe(2);expect(r.learned).toBe(ASPECT_IDS[0]);
    expect(()=>SF.useSigil(s,{inTown:true})).toThrow();expect(SF.useSigil({...s,items:{...s.items,starSigil:1}},{inTown:true}).items.starSigil).toBeUndefined();
  });
  test('星蝕潮汐（噩夢以上）：魔物變強、出現星蝕寶箱，餘燼不夠打不開；結束後恢復',()=>{
    const w=world('meadow',10,36,[],2),m=w.monsters.find(x=>!x.def.mvp&&x.state!=='dead')!,hp=m.maxHp;
    expect(w.startWorldEvent('eclipse')).toBe(true);expect(m.def.name.startsWith('【星蝕】')).toBe(true);expect(m.maxHp).toBe(Math.round(hp*1.4));
    const chests=w.chests.filter(c=>c.tier==='eclipse');expect(chests.length).toBe(ECLIPSE.chests);
    priv(w).takeChest(chests[0]);expect(w.chests).toContain(chests[0]);
    w.embers=ECLIPSE.chestCost;priv(w).takeChest(chests[0]);expect(w.chests).not.toContain(chests[0]);
    w.worldEvent!.until=priv(w).clock;run(w,.1);expect(m.maxHp).toBe(hp);expect(w.chests.some(c=>c.tier==='eclipse')).toBe(false);
    const n=world('meadow',10,36,[],1);expect(n.startWorldEvent('eclipse')).toBe(false);
  });
});
