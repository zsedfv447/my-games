// v4.4 法師三系試玩場: ?lab=fire|ice|lightning|fireIce|fireLightning|iceLightning[&gear=zero][&awake=1]
// Builds a throwaway Lv45 mage (49 skill points, same stats/gear for every school) that is never saved.
import * as R from './state';
import type {GameState} from './state';
const base={spRecovery:10,firstAid:0} as Record<string,number>;
export const LAB_BUILDS:Record<string,{name:string;skills:Record<string,number>}>={
  fire:{name:'純火',skills:{...base,fireBolt:10,fireBall:10}},
  ice:{name:'純冰',skills:{...base,coldBolt:10,frostDiver:10}},
  lightning:{name:'純雷',skills:{...base,lightningBolt:10,thunderStorm:10}},
  fireIce:{name:'火冰',skills:{...base,fireBolt:10,fireBall:10,coldBolt:10,frostDiver:9}},
  fireLightning:{name:'火雷',skills:{...base,fireBolt:10,fireBall:10,lightningBolt:10,thunderStorm:9}},
  iceLightning:{name:'冰雷',skills:{...base,coldBolt:10,frostDiver:10,lightningBolt:10,thunderStorm:9}},
};
const order=['fireBolt','coldBolt','lightningBolt','fireBall','frostDiver','thunderStorm','spRecovery'];
export function labState(kind:string,opt:{zero?:boolean;awake?:boolean;lv?:number}={}):GameState|null{
  const lv=Math.max(45,Math.min(80,Math.round(opt.lv??45))),hi=lv>45; // v5.0: &lv=50..80 → expedition-tier test character at 曙光前哨
  const b=LAB_BUILDS[kind];if(!b)return null;
  let s=R.createCharacter(R.newGame(),`試玩・${b.name}`,0,0);s=R.gainExp(s,0,9e9).state;for(let i=0;i<9;i++)s=R.learnSkill(s,'basic');
  s=R.changeJob(s,'mage',{});s.char.baseLv=lv;s.char.jobLv=hi?70:50;s.char.skillPoints=hi?69:49;
  const pts=Math.round(lv*4.6),st=hi?{int:Math.min(99,30+Math.round(pts*.45)),dex:Math.min(99,20+Math.round(pts*.33)),vit:Math.min(99,10+Math.round(pts*.2))}:opt.zero?{int:60,dex:88,vit:25}:{int:70,dex:55,vit:30};for(const [k,v] of Object.entries(st))s.char.stats[k as 'int']=v;
  for(const id of order)for(let i=0;i<(b.skills[id]??0);i++)s=R.learnSkill(s,id);
  const gear=hi?(lv>=74?['astralScepter','starweaveRobe','astralRing','skyCloak','astralCirclet','magmaBoots']:lv>=62?['skyStaff','starweaveRobe','voyagerRing','skyCloak','magmaBoots']:['frostStarStaff','starweaveRobe','voyagerRing']):opt.zero?['starRod','sorcererRobe','hourglass','sageGlasses','timeCloak']:['woodStaff','mageRobe'];
  for(const id of gear){s=R.addItem(s,id,1);const e=s.equipment[s.equipment.length-1];s=R.equip(s,e.id,{});}
  s=R.addItem(s,'redPotion',30);s=R.addItem(s,'bluePotion',30);for(const f of ['dawnBread','starJuice','herbTea','adventBento'])s=R.addItem(s,f,10);
  // v4.6–v4.8 sandbox: enough money, sigils and materials to try crafting, refining and the 封印冰庫 right away.
  const mats:Record<string,number>={trialSigil:20,starShard:1,frozenHeart:2,ancientBark:2,royalJelly:2,foxTail:12,spiritDust:12,woodChip:12,iceShard:12,stoneCore:6,softSilk:15,feather:15,snowFur:8,wolfFang:12,apple:10,jellyGoo:4,sporeCap:4,honey:3};
  for(const [id,n] of Object.entries(mats))s=R.addItem(s,id,n);
  s.char.zeny=300000;s={...s,explore:{chests:{normal:0,rare:0,trial:0,supply:0},trials:{'meadow:1':1,'forest:1':1,'cave:1':1},bounties:0,found:[]}};
  if(opt.awake)s={...s,mastery:Object.fromEntries(order.slice(0,6).map(k=>[k,400]))};
  const learned=order.slice(0,6).filter(id=>(b.skills[id]??0)>0);
  s={...s,hotbar:s.hotbar.map((h,i)=>i<learned.length?{type:'skill',id:learned[i]}:i===learned.length?{type:'item',id:'redPotion'}:i===learned.length+1?{type:'item',id:'bluePotion'}:null) as GameState['hotbar'],
    position:hi?{map:'frontier',x:24,y:28}:{map:'ruins',x:30,y:36},savePoint:hi?{map:'frontier',x:37.5,y:26}:{map:'ruins',x:30,y:36}};
  const d=R.derive(s);s.char.hp=d.maxHp;s.char.sp=d.maxSp;
  return s;
}

// v6.0 二轉試玩: ?lab=knight|wizard|ranger[&lv=60..90][&pre=1]. pre=1 → a first-job character ready to start the 二轉 quest.
const JOB2_LAB:Record<string,{first:'swordman'|'mage'|'archer';name:string;stats:Record<string,number>;skills1:Record<string,number>;skills2:Record<string,number>;bar:string[];gear:string[];bag:string[]}>={
  knight:{first:'swordman',name:'星誓騎士',stats:{str:92,agi:60,vit:70,dex:50,luk:20},
    skills1:{swordMastery:10,hpRecovery:10,bash:10,magnum:10,provoke:5,endure:5},skills2:{k_wheel:5,k_training:5,k_rend:5,k_charge:1,k_trample:5,k_ward:4,k_judgment:5},
    bar:['magnum','bash','k_wheel','k_rend','k_charge','k_trample','k_judgment','k_ward'],gear:['oathSword','expeditionPlate','voyagerRing','skyCloak','magmaBoots'],bag:['dawnbreaker','bulwarkSword','galeSaber']},
  wizard:{first:'mage',name:'星紋魔導士',stats:{int:95,dex:85,vit:40,agi:10},
    skills1:{spRecovery:10,fireBolt:10,coldBolt:10,lightningBolt:10,fireBall:10,frostDiver:10,thunderStorm:9},skills2:{w_flame:5,w_frost:5,w_totem:5,w_study:5,w_veil:2,w_ascend:3,w_arcana:5},
    bar:['fireBolt','fireBall','w_flame','coldBolt','frostDiver','w_frost','lightningBolt','w_arcana'],gear:['starlitStaff','starweaveRobe','voyagerRing','skyCloak','magmaBoots'],bag:['emberRingStaff','mirrorSnowStaff','stormRingStaff']},
  ranger:{first:'archer',name:'蒼穹遊俠',stats:{dex:99,agi:72,vit:40,luk:30,str:20},
    skills1:{owlEye:10,vulture:10,doubleStrafe:10,arrowShower:10,concentrate:10,chargeArrow:1},skills2:{r_mark:3,r_falcon:5,r_snipe:5,r_pierce:5,r_barrage:5,r_trap:3,r_starRain:4},
    bar:['r_mark','r_snipe','r_barrage','r_pierce','r_trap','r_starRain','doubleStrafe'],gear:['skywardBow','rangerLeather','voyagerRing','skyCloak','magmaBoots'],bag:['farsightBow','cycloneBow','bindingBow']},
};
export const LAB_JOB2=Object.keys(JOB2_LAB);
export function labJob2State(kind:string,opt:{lv?:number;pre?:boolean}={}):GameState|null{
  const b=JOB2_LAB[kind];if(!b)return null;const lv=Math.max(60,Math.min(90,Math.round(opt.lv??72)));
  let s=R.createCharacter(R.newGame(),`試玩・${b.name}`,0,0);s=R.gainExp(s,0,9e9).state;for(let i=0;i<9;i++)s=R.learnSkill(s,'basic');
  s=R.changeJob(s,b.first,{});s.char.baseLv=lv;s.char.jobLv=opt.pre?50:70;s.char.skillPoints=opt.pre?49:69;
  for(const [k,v] of Object.entries(b.stats))s.char.stats[k as 'int']=v;
  const order1=Object.keys(b.skills1).sort((x,y)=>Object.keys(b.skills1).indexOf(x)-Object.keys(b.skills1).indexOf(y));
  // Learn prerequisites first: retry the list until nothing more can be learned.
  for(let pass=0;pass<4;pass++)for(const id of order1)while((s.char.skills[id]??0)<b.skills1[id]&&!R.canLearn(s,id))s=R.learnSkill(s,id);
  if(!opt.pre){s={...s,ascension:{stage:3,kills:30}};s=R.changeJob2(s,{});s.char.job2Lv=30;s.char.skillPoints2=30;
    for(let pass=0;pass<4;pass++)for(const id of Object.keys(b.skills2))while((s.char.skills[id]??0)<b.skills2[id]&&!R.canLearn(s,id))s=R.learnSkill(s,id);}
  const gear=opt.pre?b.gear.slice(1):b.gear;
  for(const id of gear){if(!s.equipment.some(e=>e.defId===id))s=R.addItem(s,id,1);const e=s.equipment.find(x=>x.defId===id)!;s=R.equip(s,e.id,{});}
  if(opt.pre){const w=b.first==='mage'?'skyStaff':b.first==='archer'?'skyBow':'magmaBlade';s=R.addItem(s,w,1);s=R.equip(s,s.equipment.at(-1)!.id,{});}
  else{for(const id of b.bag)s=R.addItem(s,id,1);
    // Lv.75+: wear the first style weapon, like a real character at that point.
    if(lv>=75){const e=s.equipment.find(x=>x.defId===b.bag[0])!;s=R.equip(s,e.id,{});}}
  s=R.addItem(s,'whitePotion',40);s=R.addItem(s,'bluePotion',20);for(const f of ['herbTea','adventBento'])s=R.addItem(s,f,10);
  for(const [id,n] of Object.entries({oathCore:12,forgeSand:24,bellSilk:24,tideGlass:12,magmaCore:8,cloudFluff:8,astralShard:6,trialSigil:20}))s=R.addItem(s,id,n);
  s.char.zeny=500000;
  if(kind==='knight'&&!opt.pre)s={...s,mounts:{owned:['pecoPeco','emberWyvern'],active:'pecoPeco'}};
  const bar=opt.pre?Object.keys(b.skills1).filter(id=>(s.char.skills[id]??0)>0&&!['swordMastery','hpRecovery','owlEye','vulture','spRecovery'].includes(id)).slice(0,7):b.bar;
  s={...s,hotbar:[...bar.map(id=>({type:'skill',id})),{type:'item',id:'whitePotion'},{type:'item',id:'bluePotion'}].slice(0,9).concat(Array(9).fill(null)).slice(0,9) as GameState['hotbar'],
    position:{map:'frontier',x:24,y:28},savePoint:{map:'frontier',x:37.5,y:26}};
  const d=R.derive(s);s.char.hp=d.maxHp;s.char.sp=d.maxSp;
  return s;
}
