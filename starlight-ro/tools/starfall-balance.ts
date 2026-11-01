// v7.0 星淵挑戰 sanity: lab second-job characters (auto battle, potions at <40% HP) in 深坑／圍城／印記地城 at each difficulty.
// Run: npx vite-node tools/starfall-balance.ts
import { World, type SimEvent } from '../src/world/sim';
import * as R from '../src/rules/state';
import { labJob2State } from '../src/rules/lab';
import type { GearFx } from '../src/data/ascension-items';
import { affixPool, affixValue } from '../src/rules/affix';
import { items, type EquipDef } from '../src/data/items';
/** A realistic endgame character: 41 star points spent and every worn piece 傳說 with three good affixes. */
function geared(s0:R.GameState,kind:string):R.GameState{
  const s=structuredClone(s0),magic=kind==='wizard';
  s.talents={[magic?'matkPct':'atkPct']:5,crit:5,skill:5,aspd:5,starburst:1,hpPct:5,defs:5,spCost:5,cast:5} as R.GameState['talents'];
  for(const id of Object.values(s.equipped)){if(!id)continue;const e=s.equipment.find(x=>x.id===id)!,d=items[e.defId] as EquipDef;
    const pref=(magic?['matk','cast','int','skill','dex']:['atk','crit','aspd','skill','str','dex']) as string[];
    const pool=affixPool(d).sort((a,b)=>(pref.indexOf(b)>=0?1:0)-(pref.indexOf(a)>=0?1:0)).slice(0,3);
    e.q=3;e.affix=pool.map(k=>({k,v:affixValue(k,d,.75)}));}
  return s;
}

type Spec=Parameters<World['startChallenge']>[0];
function trial(kind:'knight'|'wizard'|'ranger',lv:number,tier:number,spec:Spec,fx:GearFx[]=[],seed=3,gear=true){
  const s0=labJob2State(kind,{lv})!,s=gear?geared(s0,kind):s0,d=R.derive(s),w=new World(seed);w.eventsEnabled=false;w.setTier(tier);w.loadMap('abyss',6,20);
  w.setStats({...d,gearFx:[...d.gearFx,...fx]},lv);w.setVitals(d.maxHp,d.maxSp);w.autoSkills=s.hotbar.filter(h=>h?.type==='skill').map(h=>h!.id);w.setAuto(true);w.startChallenge(spec);
  let pots=0,deaths=0,t=0;const limit=spec.kind==='horde'?600:420;
  for(let i=0;i<limit*60;i++){const ev:SimEvent[]=w.step(1/60);t=i/60;
    for(const e of ev)if(e.t==='death')deaths++;
    const c=w.challenge!;if(c.kind==='horde'&&c.phase==='choose')w.hordeChoose(c.offer.find(b=>b!=='greed'&&b!=='swarm')??c.offer[0]);
    if(c.kind==='horde'?c.phase==='won'||c.phase==='lost':c.state!=='run')break;
    if(w.player.dead)break;if(w.player.hp<d.maxHp*.4&&i%48===0){w.heal(Math.round(d.maxHp*.15),0);pots++;}if(!w.player.auto)w.setAuto(true);}
  const c=w.challenge!;const res=c.kind==='horde'?`${c.phase} 波${c.wave} 星焰${Math.floor(c.embers)}`:c.kind==='pit'?`${c.state} 進度${Math.round(c.progress/60*100)}%`:`${c.state} 房${c.room}`;
  return `${res}　${Math.round(t)}秒　藥${pots}${deaths?'　陣亡':''}`;
}
const tiers:[number,string][]=[[1,'普通'],[2,'噩夢'],[3,'煉獄'],[4,'星滅']];
for(const job of ['knight','wizard','ranger'] as const){console.log(`\n【${job} Lv.80】`);
  for(const [t,n] of tiers){console.log(`  ${n}：深坑10 ${trial(job,80,t,{kind:'pit',tier:10})}｜深坑25 ${trial(job,80,t,{kind:'pit',tier:25})}`);
    console.log(`        圍城 ${trial(job,80,t,{kind:'horde'})}｜印記10 ${trial(job,80,t,{kind:'sigil',lv:10,affixes:['frenzy','bounty']})}`);}}
console.log('\n【knight Lv.80 煉獄 + 威能組合】');
for(const [label,fx] of [['無',[]],['處決+屠巨+殺戮',['executioner','giantSlayer','momentum']],['星骸+隕星+魂收割',['corpseBlast','meteorFall','soulHarvest']],['群星披風+狂王+深淵之眼',['u_galaxy','u_madKing','u_abyssEye']]] as [string,GearFx[]][])
  console.log(`  ${label}：深坑25 ${trial('knight',80,3,{kind:'pit',tier:25},fx)}｜圍城 ${trial('knight',80,3,{kind:'horde'},fx)}`);
