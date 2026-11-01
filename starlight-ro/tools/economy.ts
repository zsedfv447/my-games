// v4.8 economy check: average zeny value of chests / bounties vs. plain monster loot, per map.
// Run: npx vite-node tools/economy.ts   (pure data — no simulation clock; uses rollChest and the drop tables)
import { rollChest } from '../src/rules/explore';
import { bountyOffers } from '../src/rules/explore';
import { maps } from '../src/data/maps';
import { monsters } from '../src/data/monsters';
import { items } from '../src/data/items';
import { MAP_TIER } from '../src/data/explore';
const sell=(id:string)=>Math.floor((items[id]?.price??0)/2);
const value=(l:{zeny:number;items:Record<string,number>})=>l.zeny+Object.entries(l.items).reduce((a,[id,n])=>a+sell(id)*n,0);
const avg=(f:()=>number,n=4000)=>{let t=0;for(let i=0;i<n;i++)t+=f();return t/n;};
const KILLS_PER_MIN=11; // v4.8 balance tool: mage field run ≈ 11–13 kills/min
console.log('地圖｜每殺平均掉落價值｜每分鐘打怪收入｜普通箱｜稀有箱｜試煉箱｜懸賞每分鐘（含打怪）');
for(const [id,tier] of Object.entries(MAP_TIER)){
  const spawns=maps[id].spawns.filter(s=>!monsters[s.monster].mvp),mons=[...new Set(spawns.map(s=>s.monster))];
  const perKill=spawns.reduce((a,sp)=>a+sp.count*monsters[sp.monster].drops.reduce((b,d)=>b+Math.min(1,d.rate*(sp.boost?(sp.boost.elite?3:1.6):1))*sell(d.item),0),0)/spawns.reduce((a,sp)=>a+sp.count,0);
  const n=avg(()=>value(rollChest(id,'normal',Math.random))),r=avg(()=>value(rollChest(id,'rare',Math.random))),t=avg(()=>value(rollChest(id,'trial',Math.random,mons[0])));
  const offers=bountyOffers(tier,7),b=offers.reduce((a,o)=>a+o.zeny/(o.count/KILLS_PER_MIN),0)/offers.length;
  console.log(`${maps[id].name}｜${perKill.toFixed(0)}｜${(perKill*KILLS_PER_MIN).toFixed(0)}｜${n.toFixed(0)}｜${r.toFixed(0)}｜${t.toFixed(0)}｜+${b.toFixed(0)}`);
}
