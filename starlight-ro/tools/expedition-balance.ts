// v5.0 星界遠征 balance check: a mage of the map's level (stats/gear of that tier) farms 4 minutes with auto battle,
// drinking a white potion under 40% HP. Reports kills/min, deaths, potions — compare with 星落神殿 at Lv.45 (~12/min, 0 deaths).
import { World } from '../src/world/sim';
import * as R from '../src/rules/state';
const ctx={inCombat:false,inTown:true} as unknown as R.Ctx;
function mage(lv:number,gear:string[]){
  let s=R.createCharacter(R.newGame(),'遠征',0,0);s=R.gainExp(s,0,9e9).state;for(let i=0;i<9;i++)s=R.learnSkill(s,'basic');
  s=R.changeJob(s,'mage',{});s.char.baseLv=lv;s.char.jobLv=70;s.char.skillPoints=69;
  // stat budget grows with level like a real character: INT-heavy, then DEX, some VIT
  const pts=Math.round(lv*4.6);s.char.stats.int=Math.min(99,30+Math.round(pts*.45));s.char.stats.dex=Math.min(99,20+Math.round(pts*.33));s.char.stats.vit=Math.min(99,10+Math.round(pts*.2));
  for(const id of ['fireBolt','fireBall','spRecovery','coldBolt','frostDiver'])for(let i=0;i<10;i++)try{s=R.learnSkill(s,id);}catch{break;}
  for(const id of gear){s=R.addItem(s,id,1);const e=s.equipment[s.equipment.length-1];try{s=R.equip(s,e.id,ctx);}catch{/* level */}}
  return s;
}
const runs:[string,number,string[],[number,number]][]=[
  ['ruins',45,['woodStaff','mageRobe'],[30,36]],
  ['mistMarsh',50,['frostStarStaff','starweaveRobe'],[20,36]],
  ['emberRift',57,['frostStarStaff','starweaveRobe','voyagerRing'],[20,32]],
  ['skyGarden',63,['skyStaff','starweaveRobe','voyagerRing','skyCloak'],[20,36]],
  ['starCitadel',72,['skyStaff','starweaveRobe','astralRing','skyCloak','astralCirclet'],[20,36]],
];
for(const [map,lv,gear,at] of runs){let kills=0,deaths=0,pots=0;
  for(const seed of [11,23,37]){const s=mage(lv,gear),d=R.derive(s);const w=new World(seed);w.eventsEnabled=false;w.loadMap(map,at[0],at[1]);w.setStats(d,lv);w.setVitals(d.maxHp,d.maxSp);
    w.autoSkills=['fireBall','fireBolt','frostDiver','coldBolt'];w.setAuto(true);
    for(let i=0;i<240*60;i++){for(const e of w.step(1/60)){if(e.t==='kill'&&!e.mvp)kills++;if(e.t==='death'){deaths++;w.respawn();}}
      if(!w.player.dead&&w.player.hp<d.maxHp*.4&&i%48===0){w.heal(330,0);pots++;}if(!w.player.auto&&!w.player.dead)w.setAuto(true);}}
  console.log(`${map.padEnd(12)} Lv${lv}  擊殺/分 ${(kills/12).toFixed(1).padStart(5)}  死亡 ${(deaths/3).toFixed(1)}  白水/場 ${(pots/3).toFixed(0)}`);
}
