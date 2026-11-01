// Mage school comparison (v4.4 element loops). Reproducible: fixed seeds, fixed placements, auto battle.
// Run: npx vite-node tools/mage-balance.ts [--quick] [--json out.json]
// Scenarios: dense packs (3 / 6), every MVP alone, and a 4-minute field run in 星落神殿.
// Every config spends the same 49 job skill points (unused points are reported, not hidden).
import { World, type SimEvent } from '../src/world/sim';
import * as R from '../src/rules/state';
import { writeFileSync } from 'fs';

type Gear='normal'|'zero';
type Cfg={name:string;skills:Record<string,number>;rotation:string[];gear:Gear;awake?:boolean};
const quick=process.argv.includes('--quick');
const jsonOut=process.argv.includes('--json')?process.argv[process.argv.indexOf('--json')+1]:null;
const SEEDS=quick?[11]:[11,23,37];

const base={spRecovery:10};
const cfgs:Cfg[]=[
  {name:'純火（箭＋爆炎球）',skills:{...base,fireBolt:10,fireBall:10},rotation:['fireBall','fireBolt'],gear:'normal'},
  {name:'純火（只連按火焰矢）',skills:{...base,fireBolt:10,fireBall:10},rotation:['fireBolt'],gear:'normal'},
  {name:'純冰（箭＋冰封術）',skills:{...base,coldBolt:10,frostDiver:10},rotation:['frostDiver','coldBolt'],gear:'normal'},
  {name:'純冰（只連按冰霜矢）',skills:{...base,coldBolt:10,frostDiver:10},rotation:['coldBolt'],gear:'normal'},
  {name:'純雷（箭＋雷暴）',skills:{...base,lightningBolt:10,thunderStorm:10},rotation:['thunderStorm','lightningBolt'],gear:'normal'},
  {name:'純雷（只連按雷鳴矢）',skills:{...base,lightningBolt:10,thunderStorm:10},rotation:['lightningBolt'],gear:'normal'},
  {name:'火冰',skills:{...base,fireBolt:10,fireBall:10,coldBolt:10,frostDiver:9},rotation:['fireBall','frostDiver','fireBolt','coldBolt'],gear:'normal'},
  {name:'火雷',skills:{...base,fireBolt:10,fireBall:10,lightningBolt:10,thunderStorm:9},rotation:['fireBall','thunderStorm','fireBolt','lightningBolt'],gear:'normal'},
  {name:'冰雷',skills:{...base,coldBolt:10,frostDiver:10,lightningBolt:10,thunderStorm:9},rotation:['frostDiver','thunderStorm','coldBolt','lightningBolt'],gear:'normal'},
  {name:'純火・零詠唱',skills:{...base,fireBolt:10,fireBall:10},rotation:['fireBall','fireBolt'],gear:'zero'},
  {name:'純冰・零詠唱',skills:{...base,coldBolt:10,frostDiver:10},rotation:['frostDiver','coldBolt'],gear:'zero'},
  {name:'純雷・零詠唱',skills:{...base,lightningBolt:10,thunderStorm:10},rotation:['thunderStorm','lightningBolt'],gear:'zero'},
  {name:'純火・覺醒',skills:{...base,fireBolt:10,fireBall:10},rotation:['fireBall','fireBolt'],gear:'normal',awake:true},
  {name:'純冰・覺醒',skills:{...base,coldBolt:10,frostDiver:10},rotation:['frostDiver','coldBolt'],gear:'normal',awake:true},
  {name:'純雷・覺醒',skills:{...base,lightningBolt:10,thunderStorm:10},rotation:['thunderStorm','lightningBolt'],gear:'normal',awake:true},
];
const order=['fireBolt','coldBolt','lightningBolt','fireBall','frostDiver','thunderStorm','spRecovery'];
function build(c:Cfg){
  let s=R.createCharacter(R.newGame(),'模擬',0,0);s=R.gainExp(s,0,9e9).state;for(let i=0;i<9;i++)s=R.learnSkill(s,'basic');
  s=R.changeJob(s,'mage',{});s.char.baseLv=45;s.char.jobLv=50;s.char.skillPoints=49;
  const st=c.gear==='zero'?{int:60,dex:88,vit:25}:{int:70,dex:55,vit:30};for(const [k,v] of Object.entries(st))s.char.stats[k as 'int']=v;
  for(const id of order)for(let i=0;i<(c.skills[id]??0);i++)s=R.learnSkill(s,id);
  const gear=c.gear==='zero'?['starRod','sorcererRobe','hourglass','sageGlasses','timeCloak']:['woodStaff','mageRobe'];
  for(const id of gear){s=R.addItem(s,id,1);const e=s.equipment[s.equipment.length-1];s=R.equip(s,e.id,{});}
  if(c.awake)s={...s,mastery:Object.fromEntries(['fireBolt','coldBolt','lightningBolt','fireBall','frostDiver','thunderStorm'].map(k=>[k,400]))};
  return s;
}
type Out={time:number;kills:number;sp:number;spPots:number;hpPots:number;deaths:number;dmg:Record<string,number>;triggers:Record<string,number>;peakEvents:number};
const derivedSrc=new Set(['detonate','shatter','shard','chain','rebound','strike','blast']);
function sim(c:Cfg,seed:number,setup:(w:World)=>void,map:string,at:[number,number],limit:number,done:(w:World)=>boolean,respawn=false):Out{
  killed=0;
  const s=build(c),d=R.derive(s);const w=new World(seed);w.eventsEnabled=false;w.loadMap(map,at[0],at[1]);w.setStats(d,45);w.setVitals(d.maxHp,d.maxSp);
  if(!respawn)for(const m of w.monsters){m.state='dead';m.hp=0;m.respawnTimer=1e9;}
  setup(w);w.autoSkills=c.rotation;w.setAuto(true);
  const o:Out={time:limit,kills:0,sp:0,spPots:0,hpPots:0,deaths:0,dmg:{},triggers:{},peakEvents:0};
  const H=1/60;let lastSp=w.player.sp,cd=0;
  for(let t=0;t<limit;t+=H){
    const ev:SimEvent[]=w.step(H);o.peakEvents=Math.max(o.peakEvents,ev.length);
    for(const e of ev){
      if(e.t==='kill'&&(!mvpOnly||e.mvp)){o.kills++;killed++;}
      if(e.t==='death'){o.deaths++;w.respawn();w.setAuto(true);}
      if(e.t==='dmg'&&e.to==='m'){const k=e.src==='burn'?'灼燒':derivedSrc.has(e.src)?'衍生':'原始';o.dmg[k]=(o.dmg[k]??0)+e.amount;if(derivedSrc.has(e.src))o.triggers[e.src]=(o.triggers[e.src]??0)+1;}
      if(e.t==='status'&&(e.kind==='freeze'||e.kind==='mark'))o.triggers[e.kind]=(o.triggers[e.kind]??0)+1;
      if(e.t==='skill')o.triggers['施放:'+e.skill]=(o.triggers['施放:'+e.skill]??0)+1;
    }
    if(w.player.sp<lastSp)o.sp+=lastSp-w.player.sp;lastSp=w.player.sp;
    cd-=H;if(cd<=0&&!w.player.dead){if(w.player.hp<d.maxHp*.4){cd=.8;w.heal(330,0);o.hpPots++;}if(w.player.sp<d.maxSp*.15){cd=.8;w.heal(0,180);o.spPots++;lastSp=w.player.sp;}}
    if(!w.player.auto&&!w.player.dead)w.setAuto(true);
    if(done(w)){o.time=t;break;}
  }
  return o;
}
/** Revive `n` monsters of a kind in a cluster `dist` cells in front of the player. */
function pack(kind:string,n:number,dist=6){
  return (w:World)=>{goal=n;mvpOnly=false;const p=w.player;let k=0;
    for(const m of w.monsters){if(k>=n)break;if(m.def.id!==kind)continue;const a=k/n*Math.PI*2,r=k?0.9:0;
      Object.assign(m,{state:'chase',hp:m.maxHp,x:p.x+dist+Math.cos(a)*r,y:p.y+Math.sin(a)*r,px:p.x+dist,py:p.y,path:[],el:undefined});k++;}
  };
}
function mvp(id:string){
  return (w:World)=>{goal=1;mvpOnly=true;const p=w.player,m=w.monsters.find(x=>x.def.id===id)!;Object.assign(m,{state:'chase',hp:m.maxHp,x:p.x+6,y:p.y,px:p.x+6,py:p.y,path:[],el:undefined,respawnTimer:1e9});w.attack(m.id);}; // v4.8: like a player, click the MVP once so auto battle fights it
}
let goal=0,killed=0,mvpOnly=false;
const allDead=(_w:World)=>killed>=goal;
type Row={cfg:string;scenario:string;casts:string;time:number;kills:number;spPerKill:number;pots:number;deaths:number;share:string;triggers:string;peak:number};
const rows:Row[]=[];
const avg=(xs:number[])=>xs.reduce((a,b)=>a+b,0)/xs.length;
const scenarios:{name:string;run:(c:Cfg,seed:number)=>Out}[]=[
  {name:'3 隻群（神殿守衛）',run:(c,s)=>sim(c,s,pack('templeGolem',3),'ruins',[30,36],60,allDead)},
  {name:'6 隻密集群（風之精靈）',run:(c,s)=>sim(c,s,pack('windWisp',6),'ruins',[30,36],60,allDead)},
  {name:'MVP 果凍國王（水）',run:(c,s)=>sim(c,s,mvp('jellyKing'),'meadow',[40,20],180,allDead)},
  {name:'MVP 古樹守護者（地）',run:(c,s)=>sim(c,s,mvp('forestLord'),'forest',[44,52],180,allDead)},
  {name:'MVP 冰霜巨像（水）',run:(c,s)=>sim(c,s,mvp('iceColossus'),'cave',[40,14],180,allDead)},
  {name:'MVP 星落女神像（無）',run:(c,s)=>sim(c,s,mvp('starIdol'),'ruins',[46,36],240,allDead)},
];
if(!quick)scenarios.push({name:'神殿野外 4 分鐘（每分鐘擊殺）',run:(c,s)=>{goal=1e9;mvpOnly=false;const o=sim(c,s,()=>{},'ruins',[30,36],240,()=>false,true);return {...o,time:240};}});
for(const c of cfgs)for(const sc of scenarios){
  const outs=SEEDS.map(seed=>sc.run(c,seed));
  const tot:Record<string,number>={};for(const o of outs)for(const [k,v] of Object.entries(o.dmg))tot[k]=(tot[k]??0)+v;const sum=Object.values(tot).reduce((a,b)=>a+b,0)||1;
  const trg:Record<string,number>={};for(const o of outs)for(const [k,v] of Object.entries(o.triggers))trg[k]=(trg[k]??0)+v/outs.length;
  const field=sc.name.startsWith('神殿野外');
  const casts=Object.entries(trg).filter(([k])=>k.startsWith('施放')).map(([k,v])=>`${({fireBolt:'火矢',fireBall:'火球',coldBolt:'冰矢',frostDiver:'冰封',lightningBolt:'雷矢',thunderStorm:'雷暴'} as Record<string,string>)[k.slice(3)]??k.slice(3)}${v.toFixed(0)}`).join(',');
  rows.push({cfg:c.name,scenario:sc.name,casts,time:+avg(outs.map(o=>field?o.kills/4:o.time)).toFixed(1),kills:+avg(outs.map(o=>o.kills)).toFixed(1),
    spPerKill:+avg(outs.map(o=>o.sp/Math.max(1,o.kills))).toFixed(0),pots:+avg(outs.map(o=>o.spPots)).toFixed(1),deaths:+avg(outs.map(o=>o.deaths)).toFixed(1),
    share:Object.entries(tot).map(([k,v])=>`${k}${Math.round(v/sum*100)}%`).join(' '),
    triggers:Object.entries(trg).filter(([k])=>!k.startsWith('施放')).map(([k,v])=>`${k}${v.toFixed(0)}`).join(' '),peak:Math.max(...outs.map(o=>o.peakEvents))});
  const r=rows[rows.length-1];
  console.log(`${r.cfg.padEnd(12,'　')}｜${r.scenario.padEnd(14,'　')}｜${field?'擊殺/分':'秒數'} ${String(r.time).padStart(6)}｜殺 ${r.kills}｜放 ${r.casts}｜SP/殺 ${String(r.spPerKill).padStart(4)}｜藍水 ${r.pots}｜死亡 ${r.deaths}｜${r.share}｜${r.triggers}｜事件峰值 ${r.peak}`);
}
if(jsonOut)writeFileSync(jsonOut,JSON.stringify(rows,null,1));
