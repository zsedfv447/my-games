// v6.0 二轉 balance: the same character farms with first-job skills only vs. its second-job build (auto battle,
// white potion under 40% HP). Run: npx vite-node tools/job2-balance.ts [minutes]
import { World } from '../src/world/sim';
import * as R from '../src/rules/state';
import { labJob2State } from '../src/rules/lab';
import { skills, secondJobs } from '../src/data/jobs';
const MIN=Number(process.argv[2]??3);
function build(kind:string,lv:number,second:boolean){
  let s=labJob2State(kind,{lv})!;
  if(!second){s=structuredClone(s);s.char.job2=null;for(const id of Object.keys(s.char.skills))if(secondJobs.includes(skills[id].job))delete s.char.skills[id];
    const w=s.equipment.find(e=>['oathSword','starlitStaff','skywardBow'].includes(e.defId))!;void w;}
  return s;
}
const first:Record<string,string[]>={knight:['bash','magnum','provoke','endure'],wizard:['fireBolt','fireBall','coldBolt','frostDiver','lightningBolt','thunderStorm'],ranger:['doubleStrafe','arrowShower','concentrate','chargeArrow']};
function farm(kind:string,lv:number,map:string,at:[number,number],second:boolean){let kills=0,deaths=0,pots=0,sp0=0;
  for(const seed of [11,23,37]){const s=build(kind,lv,second),d=R.derive(s);const w=new World(seed);w.eventsEnabled=false;w.loadMap(map,at[0],at[1]);w.setStats(d,lv);w.setVitals(d.maxHp,d.maxSp);
    w.autoSkills=second?s.hotbar.filter(h=>h?.type==='skill').map(h=>h!.id):first[kind];if(second&&kind==='knight')w.setRiding(true,1.45,'pecoPeco');w.setAuto(true);
    for(let i=0;i<MIN*60*60;i++){for(const e of w.step(1/60)){if(e.t==='kill'&&!e.mvp)kills++;if(e.t==='death'){deaths++;w.respawn();}}
      if(!w.player.dead&&w.player.hp<d.maxHp*.4&&i%48===0){w.heal(330,0);pots++;}if(w.player.sp<5)sp0++;if(!w.player.auto&&!w.player.dead)w.setAuto(true);}}
  return {kpm:kills/3/MIN,deaths:deaths/3,pots:pots/3,spEmpty:sp0/3/60};
}
const runs:[string,number,[number,number]][]=[['emberRift',62,[20,32]],['starCitadel',72,[20,36]],['starCitadel',80,[20,36]]];
for(const kind of ['knight','wizard','ranger'])for(const [map,lv,at] of runs){
  const a=farm(kind,lv,map,at,false),b=farm(kind,lv,map,at,true);
  console.log(`${kind.padEnd(7)} ${map.padEnd(12)} Lv${lv}  一轉 ${a.kpm.toFixed(1).padStart(5)}/分 死${a.deaths.toFixed(1)} 藥${a.pots.toFixed(0).padStart(3)}  →  二轉 ${b.kpm.toFixed(1).padStart(5)}/分 死${b.deaths.toFixed(1)} 藥${b.pots.toFixed(0).padStart(3)} 沒魔${b.spEmpty.toFixed(0)}秒  ×${(b.kpm/Math.max(.1,a.kpm)).toFixed(2)}`);
}

// Boss check: 星界君主 (Lv.82 MVP) solo with potions, auto battle after clicking it.
function boss(kind:string,lv:number,second:boolean){let time=0,deaths=0,pots=0,wins=0;
  for(const seed of [11,23,37]){const s=build(kind,lv,second),d=R.derive(s);const w=new World(seed);w.eventsEnabled=false;w.loadMap('starCitadel',58,36);w.setStats(d,lv);w.setVitals(d.maxHp,d.maxSp);
    w.monsters=w.monsters.filter(m=>m.def.mvp);const b=w.monsters[0];b.x=b.px=60;b.y=b.py=36;w.player.x=w.player.px=55;w.player.y=w.player.py=36;
    w.autoSkills=second?s.hotbar.filter(h=>h?.type==='skill').map(h=>h!.id):first[kind];if(second&&kind==='knight')w.setRiding(true,1.45,'pecoPeco');w.attack(b.id);w.setAuto(true);
    let t=0;for(;t<300*60;t++){for(const e of w.step(1/60)){if(e.t==='death'){deaths++;w.respawn();w.player.x=55;w.player.y=36;}}
      if(b.state==='dead'){wins++;break;}if(!w.player.dead&&w.player.hp<d.maxHp*.45&&t%40===0){w.heal(Math.round(d.maxHp*.18),0);pots++;}
      if(!w.player.auto&&!w.player.dead){w.attack(b.id);w.setAuto(true);}}
    time+=t/60;}
  return `${(time/3).toFixed(0).padStart(3)}秒 死${(deaths/3).toFixed(1)} 藥${(pots/3).toFixed(0).padStart(3)}${wins<3?` (${wins}/3 勝)`:''}`;
}
for(const kind of ['knight','wizard','ranger'])console.log(`${kind.padEnd(7)} 星界君主 Lv75  一轉 ${boss(kind,75,false)}  →  二轉 ${boss(kind,75,true)}`);
