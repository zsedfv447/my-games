// Endgame build comparison: kills per minute in 星落神殿 for each archetype (auto battle, unlimited potions).
// Run: npx vite-node tools/builds-balance.ts
import { World } from '../src/world/sim';
import * as R from '../src/rules/state';

type Plan={name:string;job:'mage'|'swordman'|'archer';stats:Record<string,number>;gear:string[];skills:[string,number][];cards:[string,string,number][]};
const plans:Plan[]=[
  {name:'法師・一般（無詠唱裝）',job:'mage',stats:{int:70,dex:45,vit:30},gear:['woodStaff','mageRobe'],skills:[['fireBolt',10],['lightningBolt',10],['coldBolt',5],['spRecovery',10],['fireBall',5]],cards:[]},
  {name:'法師・零詠唱',job:'mage',stats:{int:60,dex:88,vit:20},gear:['starRod','sorcererRobe','hourglass','sageGlasses','timeCloak'],skills:[['fireBolt',10],['lightningBolt',10],['coldBolt',5],['spRecovery',10],['fireBall',5]],
    cards:[['clockCard','fireBolt',3],['blueJellyCard','fireBolt',3],['windCard','lightningBolt',3]]},
  {name:'劍士・暴擊重斬',job:'swordman',stats:{str:70,luk:50,dex:35,vit:40},gear:['meteorSword','warBand','clover','chainMail'],skills:[['bash',10],['swordMastery',10],['hpRecovery',10],['magnum',5],['provoke',5]],
    cards:[['batCard','bash',3],['foxCard','bash',3],['iceFoxCard','bash',3]]},
  {name:'劍士・一般',job:'swordman',stats:{str:80,dex:40,vit:50,agi:20},gear:['dawnSword','chainMail','ironHelm'],skills:[['bash',10],['swordMastery',10],['hpRecovery',10],['magnum',5],['provoke',5]],cards:[]},
  // v6.2 劍士流派
  {name:'劍士・烈焰附刃',job:'swordman',stats:{str:80,dex:40,vit:50,agi:30},gear:['blazeSword','chainMail','ironHelm'],skills:[['bash',5],['swordMastery',10],['hpRecovery',5],['magnum',10],['provoke',1]],cards:[]},
  {name:'劍士・連斬暴擊',job:'swordman',stats:{str:70,luk:50,dex:35,vit:40},gear:['meteorSword','chainBracer','clover','chainMail'],skills:[['bash',10],['swordMastery',10],['hpRecovery',10],['magnum',5],['provoke',5]],
    cards:[['batCard','bash',3],['foxCard','bash',3],['iceFoxCard','bash',3]]},
  {name:'劍士・鐵壁反彈',job:'swordman',stats:{vit:80,str:60,dex:30},gear:['dawnSword','unyieldingPlate','ironHelm'],skills:[['bash',5],['swordMastery',5],['hpRecovery',10],['magnum',5],['provoke',5],['endure',10]],cards:[]},
  {name:'弓手・疾風連射',job:'archer',stats:{agi:80,dex:80,luk:20},gear:['galeBow','swiftBangle','hunterCap','galeCape','featherBoots'],skills:[['doubleStrafe',10],['owlEye',10],['vulture',10],['concentrate',10],['arrowShower',5]],
    cards:[['shadowBatCard','doubleStrafe',3],['windCard','doubleStrafe',3],['foxCard','doubleStrafe',3]]},
  {name:'弓手・一般',job:'archer',stats:{dex:90,agi:50,vit:30},gear:['compositeBow','adventureSuit'],skills:[['doubleStrafe',10],['owlEye',10],['vulture',10],['concentrate',10],['arrowShower',5]],cards:[]},
];
for(const p of plans){
  let s=R.createCharacter(R.newGame(),'模擬',0,0);s=R.gainExp(s,0,9e9).state;for(let i=0;i<9;i++)s=R.learnSkill(s,'basic');
  s=R.changeJob(s,p.job,{});
  s.char.baseLv=45;s.char.jobLv=40;s.char.skillPoints=60;
  for(const [k,v] of Object.entries(p.stats))s.char.stats[k as 'str']=v;
  for(const [id,lv] of p.skills)for(let i=(s.char.skills[id]??0);i<lv;i++){try{s=R.learnSkill(s,id);}catch{/* prereq */for(const pre of ['fireBolt','lightningBolt','coldBolt','bash','doubleStrafe','owlEye','vulture','provoke','arrowShower'])try{s=R.learnSkill(s,pre);}catch{/**/}}}
  for(const id of p.gear){s=R.addItem(s,id,1);const e=s.equipment[s.equipment.length-1];s=R.equip(s,e.id,{});}
  const slots=Object.values(s.equipped).filter((x):x is string=>!!x);let si=0;
  for(const [card,skill,lv] of p.cards){let r=R.addCard(s,card);s=r.state;const c=s.cards.find(x=>x.id===r.cardId)!;c.level=lv;
    s=R.insertCard(s,r.cardId,slots[si++%slots.length],{});const lo=s.loadouts[skill]??[null,null];const slot=lo[0]?1:0;s=R.configureModule(s,skill,slot,R.resolveModules(s).find(m=>m.cardId===r.cardId)!.moduleId,{});}
  const d=R.derive(s);
  const w=new World(77);w.loadMap('ruins',30,36);w.setStats(d,45);w.setVitals(d.maxHp,d.maxSp);
  w.autoSkills=s.hotbar.filter(h=>h?.type==='skill').map(h=>(h as {id:string}).id);w.setAuto(true);
  let kills=0,deaths=0,cd=0;const H=1/60,MIN=6;
  for(let t=0;t<MIN*60;t+=H){
    for(const e of w.step(H)){if(e.t==='kill'&&!e.mvp)kills++;if(e.t==='death'){deaths++;w.loadMap('ruins',30,36);w.respawn();w.setAuto(true);}}
    cd-=H;if(cd<=0&&w.player.hp<d.maxHp*.4&&!w.player.dead){cd=.8;w.heal(330,0);}
    if(!w.player.auto&&!w.player.dead)w.setAuto(true);
  }
  console.log(`${p.name.padEnd(14,'　')} 每分鐘擊殺 ${(kills/MIN).toFixed(1).padStart(5)}  死亡 ${deaths}  詠唱 ${Math.round(d.castMult*100)}%  爆擊 ${d.crit.toFixed(0)}%  普攻間隔 ${d.attackDelay.toFixed(2)}s`);
}
