// v6.3 星光深淵: how deep does each Lv.80 二轉 build get (auto battle, potion under 45% HP, 3 min per floor max)?
// Run: npx vite-node tools/abyss-balance.ts
import { World } from '../src/world/sim';
import * as R from '../src/rules/state';
import { labJob2State } from '../src/rules/lab';
for(const kind of ['knight','wizard','ranger']){
  const s=labJob2State(kind,{lv:80})!,d=R.derive(s);const w=new World(31);w.eventsEnabled=false;w.loadMap('abyss',6,20);w.setStats(d,80);w.setVitals(d.maxHp,d.maxSp);
  w.autoSkills=s.hotbar.filter(h=>h?.type==='skill').map(h=>h!.id);if(kind==='knight')w.setRiding(true,1.45,'pecoPeco');
  let floor=1,pots=0,times:number[]=[];
  for(;floor<80;floor++){w.startAbyssFloor(floor);w.setAuto(true);let t=0,dead=false;
    for(;t<180*60&&!w.abyss!.cleared;t++){for(const e of w.step(1/60))if(e.t==='death')dead=true;if(dead)break;
      if(w.player.hp<d.maxHp*.45&&t%40===0){w.heal(Math.round(d.maxHp*.18),0);pots++;}if(!w.player.auto)w.setAuto(true);}
    if(dead||!w.abyss!.cleared)break;times.push(t/60);w.setVitals(d.maxHp,d.maxSp);}
  console.log(`${kind.padEnd(7)} 到達第 ${floor} 層（Lv.${World.abyssLevel(floor)}）用藥 ${pots}　每層秒數：${times.filter((_,i)=>i%5===4||i===times.length-1).map(x=>x.toFixed(0)).join(' ')}`);
}
