// v6.0 new areas: second-job characters (Job 30 builds) farm each new map and fight its boss.
// Run: npx vite-node tools/world6-balance.ts [minutes]
import { World } from '../src/world/sim';
import * as R from '../src/rules/state';
import { labJob2State } from '../src/rules/lab';
import { monsters } from '../src/data/monsters';
import { items } from '../src/data/items';
const MIN=Number(process.argv[2]??3);
const areas:[string,number,[number,number],string][]=[['forge1',66,[6,30],'forgeMaster'],['bell1',75,[6,30],'bellTuner'],['bellBay',85,[6,36],'tideQueen']];
const bossMap:Record<string,string>={forgeMaster:'forge2',bellTuner:'bell2',tideQueen:'bellBay'};
for(const [map,lv,at,bossId] of areas)for(const kind of ['knight','wizard','ranger']){
  let kills=0,deaths=0,pots=0,exp=0,zeny=0;
  for(const seed of [11,23]){const s=labJob2State(kind,{lv})!,d=R.derive(s);const w=new World(seed);w.eventsEnabled=false;w.loadMap(map,at[0],at[1]);w.setStats(d,lv);w.setVitals(d.maxHp,d.maxSp);
    w.monsters=w.monsters.filter(m=>!m.def.mvp);w.autoSkills=s.hotbar.filter(h=>h?.type==='skill').map(h=>h!.id);if(kind==='knight')w.setRiding(true,1.45,'pecoPeco');w.setAuto(true);
    for(let i=0;i<MIN*3600;i++){for(const e of w.step(1/60)){if(e.t==='kill'){kills++;exp+=e.exp;}if(e.t==='death'){deaths++;w.respawn();}if(e.t==='pickup'&&e.item.kind==='item')zeny+=(items[e.item.defId]?.price??0)/2*e.item.count;}
      if(!w.player.dead&&w.player.hp<d.maxHp*.4&&i%48===0){w.heal(Math.round(d.maxHp*.18),0);pots++;}if(!w.player.auto&&!w.player.dead)w.setAuto(true);}}
  // boss
  let bt=0,bd=0,bp=0,wins=0;
  for(const seed of [11,23]){const s=labJob2State(kind,{lv:lv+4})!,d=R.derive(s);const w=new World(seed);w.eventsEnabled=false;w.loadMap(bossMap[bossId],20,26);w.setStats(d,lv+4);w.setVitals(d.maxHp,d.maxSp);
    w.monsters=w.monsters.filter(m=>m.def.id===bossId);const b=w.monsters[0];const c=w.map.grid.nearestWalkable(Math.floor(b.x)-4,Math.floor(b.y),6)!;w.player.x=w.player.px=c.x+.5;w.player.y=w.player.py=c.y+.5;
    w.autoSkills=s.hotbar.filter(h=>h?.type==='skill').map(h=>h!.id);if(kind==='knight')w.setRiding(true,1.45,'pecoPeco');w.attack(b.id);w.setAuto(true);
    let t=0;for(;t<300*60;t++){for(const e of w.step(1/60))if(e.t==='death'){bd++;w.respawn();w.player.x=c.x+.5;w.player.y=c.y+.5;}
      if(b.state==='dead'){wins++;break;}if(!w.player.dead&&w.player.hp<d.maxHp*.45&&t%40===0){w.heal(Math.round(d.maxHp*.18),0);bp++;}if(!w.player.auto&&!w.player.dead){w.attack(b.id);w.setAuto(true);}}
    bt+=t/60;}
  console.log(`${map.padEnd(8)} Lv${lv} ${kind.padEnd(7)} 擊殺/分 ${(kills/2/MIN).toFixed(1).padStart(5)} 死${(deaths/2).toFixed(1)} 藥${(pots/2).toFixed(0).padStart(3)} 經驗/分 ${Math.round(exp/2/MIN).toLocaleString().padStart(8)} 掉落/分 ${Math.round(zeny/2/MIN).toLocaleString().padStart(6)}z ｜ ${monsters[bossId].name} ${(bt/2).toFixed(0)}秒 死${(bd/2).toFixed(1)} 藥${(bp/2).toFixed(0)}${wins<2?` (${wins}/2勝)`:''}`);
}
