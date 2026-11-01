// v6.5 劍士戰魂 × 成長階段: each soul with stage-appropriate stats, skills, refined gear and guide cards, with and without its signature gear.
// Single target vs a passive dummy and vs one that hits back (counters/potions); MIX=1 prints single-target sources; SOUL=art forces a soul.
// Measures single-target DPS on a tough dummy (30 s), field kills/min (auto battle, 3 min × 2 seeds) and potions.
// Run: npx vite-node tools/sword-stages.ts
import { World } from '../src/world/sim';
import * as R from '../src/rules/state';
import { labJob2State } from '../src/rules/lab';
import { monsters } from '../src/data/monsters';
import { maps } from '../src/data/maps';
import { items, type EquipDef } from '../src/data/items';

type Build='戰技'|'烈焰'|'連斬'|'磐石';
const SOUL:Record<Build,'art'|'flame'|'chain'|'rock'>={戰技:'art',烈焰:'flame',連斬:'chain',磐石:'rock'};
const STATS:Record<Build,Record<string,number>>={戰技:{str:.45,dex:.25,vit:.2,agi:.1},烈焰:{str:.45,agi:.25,vit:.2,dex:.1},連斬:{str:.35,luk:.35,dex:.15,vit:.15},磐石:{vit:.45,str:.35,dex:.2}};
const SKILLS:Record<Build,[string,number][]>={
  戰技:[['bash',10],['swordMastery',10],['magnum',5],['hpRecovery',10],['provoke',5],['endure',5]],
  烈焰:[['bash',5],['magnum',10],['swordMastery',10],['hpRecovery',10],['provoke',5],['endure',5]],
  連斬:[['bash',10],['swordMastery',10],['magnum',5],['hpRecovery',10],['provoke',5],['endure',5]],
  磐石:[['bash',5],['provoke',5],['endure',5],['magnum',5],['swordMastery',10],['endure',10],['hpRecovery',10]]};
const CARDS:Record<Build,[string,string][]>={戰技:[['jellyCard','bash']],烈焰:[['shroomCard','magnum'],['golemCard','magnum']],連斬:[['batCard','bash'],['foxCard','bash'],['iceFoxCard','bash']],磐石:[['jellyCard','bash']]};
// Plain gear per stage, and each soul's signature pieces (replacing the same slot).
type Stage={lv:number;job:number;map:string;at:[number,number];refine:number;base:string[];sig:Record<Build,string[][]>};
const STAGES:Stage[]=[
  {lv:30,job:30,map:'cave',at:[30,32],refine:4,base:['dawnSword','chainMail','warBand','guardRing'],sig:{戰技:[],烈焰:[['galeEdge']],連斬:[['chainBracer']],磐石:[['ironHelm']]}},
  {lv:45,job:45,map:'ruins',at:[30,36],refine:5,base:['meteorSword','chainMail','warBand','guardRing'],sig:{戰技:[['blazeSword']],烈焰:[['blazeSword']],連斬:[['chainBracer']],磐石:[['unyieldingPlate','thornBadge'],['stoneGreatsword'],['stoneGreatsword','unyieldingPlate','thornBadge']]}},
  {lv:60,job:55,map:'emberRift',at:[20,32],refine:6,base:['mithrilSword','expeditionPlate','warBand','voyagerRing'],sig:{戰技:[['blazeSword']],烈焰:[['blazeSword']],連斬:[['chainBracer']],磐石:[['unyieldingPlate','thornBadge'],['stoneGreatsword'],['stoneGreatsword','unyieldingPlate','thornBadge']]}},
  {lv:72,job:65,map:'starCitadel',at:[20,36],refine:7,base:['magmaBlade','expeditionPlate','astralCirclet','voyagerRing','skyCloak','magmaBoots'],sig:{戰技:[['infernoBlade']],烈焰:[['infernoBlade']],連斬:[['chainBracer']],磐石:[['unyieldingPlate','thornBadge'],['quakeBlade'],['quakeBlade','unyieldingPlate','thornBadge']]}},
];
const slotOf=(id:string)=>(items[id] as EquipDef).slot;
function gearFor(st:Stage,set:string[]){const list=[...st.base];
  for(const id of set){const i=list.findIndex(x=>slotOf(x)===slotOf(id));if(i>=0)list[i]=id;else list.push(id);}return list;}
function swordman(b:Build,st:Stage,set:string[]){
  let s=R.createCharacter(R.newGame(),b,0,0);s=R.gainExp(s,0,9e9).state;for(let i=0;i<9;i++)s=R.learnSkill(s,'basic');s=R.changeJob(s,'swordman',{});
  s.char.baseLv=st.lv;s.char.jobLv=st.job;s.char.skillPoints=st.job-1;s=R.setSoul(s,(process.env.SOUL as typeof SOUL[Build])??SOUL[b],{inTown:true});
  const pts=Math.round(st.lv*4.6);for(const [k,w] of Object.entries(STATS[b]))s.char.stats[k as 'str']=Math.min(99,10+Math.round(pts*w));
  for(let pass=0;pass<4;pass++)for(const [id,lv] of SKILLS[b])while((s.char.skills[id]??0)<lv&&!R.canLearn(s,id))s=R.learnSkill(s,id);
  // Leftover points go into the rest of the build's skills, in its priority order (then anything else).
  for(const [id] of [...SKILLS[b],['firstAid',1]] as [string,number][])for(let k=0;k<10&&s.char.skillPoints>0&&!R.canLearn(s,id);k++)s=R.learnSkill(s,id);
  const gear=gearFor(st,set);for(const id of gear){s=R.addItem(s,id,1);const e=s.equipment.at(-1)!;if(slotOf(id)==='weapon')e.refine=st.refine;try{s=R.equip(s,e.id,{});}catch{/* level */}}
  return withCards(s,CARDS[b]);
}
function withCards(s:R.GameState,list:[string,string][]){
  const slots=Object.values(s.equipped).filter((x):x is string=>!!x);let si=0;
  for(const [card,skill] of list){const r=R.addCard(s,card);s=r.state;const c=s.cards.find(x=>x.id===r.cardId)!;c.level=3;
    for(let t=0;t<slots.length;t++){try{s=R.insertCard(s,r.cardId,slots[(si+t)%slots.length],{});si+=t+1;break;}catch{/* no free slot */}}
    const lo=s.loadouts[skill]??[null,null];const mod=R.resolveModules(s).find(m=>m.cardId===r.cardId);if(mod)try{s=R.configureModule(s,skill,lo[0]?1:0,mod.moduleId,{});}catch{/* full */}}
  return s;
}
// 磐石之魂 lives on 鐵壁意志: a rock player keeps it on the bar.
const bar=(s:R.GameState)=>{const b=s.hotbar.filter(h=>h?.type==='skill').map(h=>h!.id).filter(id=>id!=='firstAid');if(R.derive(s).soul==='rock'&&(s.char.skills.endure??0)>0&&!b.includes('endure'))b.push('endure');return b;};
function measure(s:R.GameState,lv:number,map:string,at:[number,number],ride=false){
  const d=R.derive(s);
  const tough=[...new Set(maps[map].spawns.map(x=>x.monster))].map(id=>monsters[id]).filter(m=>!m.mvp).sort((a,b)=>b.def-a.def)[0];
  // Single target: the map's toughest regular monster as an immortal dummy, passive (pure output) or hitting back (counters, potions).
  const single=(fights:boolean)=>{const w1=new World(5);w1.eventsEnabled=false;w1.loadMap(map,at[0],at[1]);w1.monsters=[];w1.setStats(d,lv);w1.setVitals(d.maxHp,d.maxSp);if(ride)w1.setRiding(true,1.45,'pecoPeco');
    const dm=w1.spawnBoss(tough.id,at[0]+1.2,at[1])!;dm.x=dm.px=at[0]+1.2;dm.y=dm.py=at[1];dm.def={...dm.def,mvp:false,aggressive:fights,speed:fights?1:0,flee:0,range:fights?Math.max(1.5,dm.def.range??1):.2,...(fights?{}:{atk:[1,1] as [number,number]})};dm.hp=dm.maxHp=1e8;if(fights)dm.state='chase';
    w1.player.x=at[0];w1.player.y=at[1];w1.autoSkills=bar(s);w1.attack(dm.id);w1.setAuto(true);let pots=0;
    let dmg=0;const sm:Record<string,number>={};for(let i=0;i<30*60;i++){for(const e of w1.step(1/60)){if(e.t==='dmg'&&e.to==='m'){dmg+=e.amount;sm[e.src]=(sm[e.src]??0)+e.amount;}if(e.t==='death')w1.respawn();}
      if(w1.player.hp<d.maxHp*.4&&i%48===0){w1.heal(Math.round(d.maxHp*.15),0);pots++;}if(!w1.player.auto)w1.setAuto(true);if(w1.player.target==null)w1.attack(dm.id);}
    if(process.env.MIX)console.log(`    [${fights?'受擊':'單體'}] `+Object.entries(sm).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${k}${Math.round(v/30)}`).join(' '));
    return {dps:Math.round(dmg/30),pots};};
  const calm=single(false),hit=single(true);
  // Field farming (respawns shortened so the map never runs dry).
  let kills=0,pots=0,deaths=0;const src:Record<string,number>={};
  for(const seed of [11,23,37,51]){const w=new World(seed);w.eventsEnabled=false;w.loadMap(map,at[0],at[1]);w.setStats(d,lv);w.setVitals(d.maxHp,d.maxSp);if(ride)w.setRiding(true,1.45,'pecoPeco');
    w.autoSkills=bar(s);w.setAuto(true);
    for(let i=0;i<180*60;i++){for(const e of w.step(1/60)){if(e.t==='dmg'&&e.to==='m'){const k=({attack:'普攻',enchant:'火焰',cleave:'順劈',bash:'重斬',magnum:'爆破',thorns:'反擊',starburst:'星爆'} as Record<string,string>)[e.src]??(e.src.startsWith('k_')?'二轉技能':'其他');src[k]=(src[k]??0)+e.amount;}if(e.t==='kill'&&!e.mvp)kills++;if(e.t==='death'){deaths++;w.respawn();}}
      if(i%60===0)for(const m of w.monsters)if(m.state==='dead'&&!m.def.mvp&&m.respawnTimer>3)m.respawnTimer=3;
      if(!w.player.dead&&w.player.hp<d.maxHp*.4&&i%48===0){w.heal(Math.round(d.maxHp*.15),0);pots++;}if(!w.player.auto&&!w.player.dead)w.setAuto(true);}}
  const tot=Object.values(src).reduce((a,b)=>a+b,0)||1;
  return {dps:calm.dps,hdps:hit.dps,hpots:hit.pots,kpm:kills/12,pots:pots/4,deaths:deaths/4,hp:d.maxHp,crit:Math.round(d.crit),mix:Object.entries(src).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${k}${Math.round(v/tot*100)}%`).join(' ')};
}
/** 星淵深坑 tier 20 (Lv.70 swarm around you): seconds to fill the progress bar — a dense-pack clear test. */
function pitFill(s:R.GameState,lv:number,ride=false){const d=R.derive(s),w=new World(9);w.eventsEnabled=false;w.loadMap('abyss',6,20);w.setStats(d,lv);w.setVitals(d.maxHp,d.maxSp);if(ride)w.setRiding(true,1.45,'pecoPeco');
  w.autoSkills=bar(s);w.setAuto(true);w.startChallenge({kind:'pit',tier:20});let t=0;
  for(let i=0;i<300*60;i++){w.step(1/60);t=i/60;const c=w.challenge!;if(c.kind==='pit'&&c.bossId!==null)break;if(w.player.dead)return '陣亡';if(w.player.hp<d.maxHp*.4&&i%48===0)w.heal(Math.round(d.maxHp*.15),0);if(!w.player.auto)w.setAuto(true);}
  return `${Math.round(t)}秒`;}
const row=(label:string,r:ReturnType<typeof measure>)=>console.log(`  ${label.padEnd(9,'　')} 單體 ${String(r.dps).padStart(5)}　受擊單體 ${String(r.hdps).padStart(5)}(藥${r.hpots})　清怪 ${r.kpm.toFixed(1).padStart(5)}/分　藥 ${String(r.pots).padStart(4)}　死 ${r.deaths}　HP ${r.hp}\n      ${r.mix}`);
const only=process.argv[2];
for(const st of STAGES){if(only&&only!==String(st.lv))continue;console.log(`\n【Lv.${st.lv} 一轉劍士・${maps[st.map].name}・武器 +${st.refine}】`);
  for(const b of Object.keys(STATS) as Build[])for(const set of [[],...st.sig[b]]){
    const s=swordman(b,st,set),eq=set.filter(id=>Object.values(s.equipped).some(x=>s.equipment.find(e=>e.id===x)?.defId===id)).map(id=>items[id].name).join('+');
    if(set.length&&!eq)continue;row(`${b}${eq?'+'+eq:''}`,measure(s,st.lv,st.map,st.at));}}
if(only&&only!=='knight')process.exit(0);
// 二轉騎士 Lv.80 on the 大嘴鳥 with the Lv.75 style weapons (+7).
console.log('\n【Lv.80 二轉騎士（騎大嘴鳥）・星界城塞・武器 +7】');
const KB:[string,'art'|'flame'|'chain'|'rock',string,string[]][]=[['戰技・煉獄大劍','art','infernoBlade',[]],['烈焰・煉獄大劍','flame','infernoBlade',[]],['連斬・曙光破城劍','chain','dawnbreaker',['chainBracer']],
  ['磐石・守誓劍','rock','bulwarkSword',['unyieldingPlate','thornBadge']],['戰技・巡風軍刀','art','galeSaber',[]]];
for(const [label,soul,weapon,extra] of KB){let s=labJob2State('knight',{lv:80})!;s=R.setSoul(s,soul,{inTown:true});
  for(const id of [weapon,...extra]){s=R.addItem(s,id,1);const e=s.equipment.at(-1)!;if(id===weapon)e.refine=7;s=R.equip(s,e.id,{});}
  // Same guide cards as the first-job soul.
  s=withCards(s,CARDS[(Object.keys(SOUL) as Build[]).find(b=>SOUL[b]===soul)!]);
  row(label,measure(s,80,'starCitadel',[20,36],true));console.log(`      深坑 20 階填滿進度：${pitFill(s,80,true)}`);}
