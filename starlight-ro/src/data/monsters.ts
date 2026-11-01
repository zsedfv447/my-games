import {createExpansionMonsters} from './expansion-roster';
// Original monster roster. Stats are V (待驗證) starting values for the slice.
// Card drop rates follow GDD v1.1 §7: normal 1/150, MVP 1/6.
import type { Element } from './jobs';

export type MonsterArtKind = 'jelly'|'worm'|'shroom'|'chick'|'wolf'|'bee'|'sapling'|'bat'|'bunny'|'golem'|'wisp'|'fox';
export type MonsterArt = { kind:MonsterArtKind; body:string; accent:string; scale:number; crown?:boolean };
export type MonsterDef = {
  id:string; name:string; level:number; hp:number; atk:[number,number]; def:number; mdef:number;
  flee:number; hit:number; exp:number; jexp:number; aspd:number; speed:number; range:number;
  aggressive:boolean; element:Element; attackType:'physical'|'magic'; attackElement:Element; mvp?:boolean; art:MonsterArt;
  drops:{item:string;rate:number}[]; card:string; cardRate:number; respawn:number;
  /** v6.0 behaviour: bomb (swells and bursts at low HP), shield (guards an ally), charge (telegraphed dash), heal (mends nearby allies). */
  trait?:'bomb'|'shield'|'charge'|'heal';
};
const m = (d:Omit<MonsterDef,'flee'|'hit'|'respawn'|'cardRate'|'attackType'|'attackElement'>&Partial<Pick<MonsterDef,'flee'|'hit'|'respawn'|'cardRate'|'attackType'|'attackElement'>>):MonsterDef => ({
  attackType:'physical',attackElement:'neutral',flee:d.level+10, hit:d.level*2+20, respawn:d.mvp?180:8, cardRate:d.mvp?1/6:1/150, ...d,
});
export const monsters: Record<string,MonsterDef> = {
  jelly:m({id:'jelly',name:'噗噗果凍',level:1,hp:45,atk:[6,9],def:0,mdef:0,exp:4,jexp:4,aspd:1.6,speed:1.6,range:1,aggressive:false,element:'water',
    art:{kind:'jelly',body:'#ff9ec4',accent:'#ffe3ef',scale:1},drops:[{item:'jellyGoo',rate:.5},{item:'apple',rate:.15},{item:'redPotion',rate:.03}],card:'jellyCard'}),
  worm:m({id:'worm',name:'小綠蟲',level:3,hp:70,atk:[9,13],def:2,mdef:0,exp:9,jexp:8,aspd:1.7,speed:1.2,range:1,aggressive:false,element:'earth',
    art:{kind:'worm',body:'#8fd468',accent:'#e8ffb5',scale:1},drops:[{item:'softSilk',rate:.4},{item:'redPotion',rate:.04}],card:'wormCard'}),
  shroom:m({id:'shroom',name:'蘑菇寶寶',level:5,hp:120,atk:[13,18],def:4,mdef:2,exp:18,jexp:15,aspd:1.6,speed:1.4,range:1,aggressive:false,element:'earth',
    art:{kind:'shroom',body:'#e96a5b',accent:'#fff2dc',scale:1},drops:[{item:'sporeCap',rate:.4},{item:'redPotion',rate:.05},{item:'knife',rate:.01}],card:'shroomCard'}),
  chick:m({id:'chick',name:'咕咕雞',level:7,hp:165,atk:[18,24],def:5,mdef:0,exp:30,jexp:25,aspd:1.4,speed:2.4,range:1,aggressive:false,element:'wind',
    art:{kind:'chick',body:'#ffd45c',accent:'#ff9a3d',scale:1},drops:[{item:'feather',rate:.45},{item:'apple',rate:.2},{item:'cap',rate:.01}],card:'chickCard'}),
  jellyKing:m({id:'jellyKing',name:'果凍國王',level:18,hp:5200,atk:[70,110],def:12,mdef:10,exp:2400,jexp:1800,aspd:1.5,speed:1.5,range:1.6,aggressive:true,element:'water',mvp:true,
    art:{kind:'jelly',body:'#ff6fa6',accent:'#ffe3ef',scale:2.6,crown:true},drops:[{item:'royalJelly',rate:.8},{item:'jellyCrown',rate:.2},{item:'bluePotion',rate:.6}],card:'jellyKingCard'}),
  wolf:m({id:'wolf',name:'森林狼仔',level:12,hp:320,atk:[24,32],def:8,mdef:2,exp:80,jexp:65,aspd:1.2,speed:3,range:1,aggressive:true,element:'earth',
    art:{kind:'wolf',body:'#9aa3b5',accent:'#f1efe8',scale:1},drops:[{item:'wolfFang',rate:.45},{item:'redPotion',rate:.08},{item:'leatherBoots',rate:.012}],card:'wolfCard'}),
  bee:m({id:'bee',name:'蜂蜂',level:11,hp:250,atk:[20,27],def:5,mdef:5,exp:68,jexp:56,aspd:1.3,speed:2.8,range:1,aggressive:true,element:'wind',
    art:{kind:'bee',body:'#ffcf3f',accent:'#3b2f2a',scale:1},drops:[{item:'honey',rate:.35},{item:'stinger',rate:.4}],card:'beeCard'}),
  sapling:m({attackType:'magic',attackElement:'earth',id:'sapling',name:'樹苗精',level:14,hp:560,atk:[30,40],def:14,mdef:8,exp:110,jexp:90,aspd:1.8,speed:1.1,range:1,aggressive:false,element:'earth',
    art:{kind:'sapling',body:'#5aa35b',accent:'#a9744c',scale:1.1},drops:[{item:'woodChip',rate:.5},{item:'bluePotion',rate:.04},{item:'woodStaff',rate:.012}],card:'saplingCard'}),
  forestLord:m({id:'forestLord',name:'古樹守護者',level:28,hp:16000,atk:[150,220],def:25,mdef:20,exp:9000,jexp:7000,aspd:1.7,speed:1.2,range:2,aggressive:true,element:'earth',mvp:true,
    art:{kind:'sapling',body:'#3f8d4f',accent:'#8b5a36',scale:2.7,crown:true},drops:[{item:'ancientBark',rate:.8},{item:'elvenBow',rate:.15},{item:'bluePotion',rate:.7}],card:'forestLordCard'}),
  bat:m({attackType:'magic',attackElement:'water',id:'bat',name:'冰晶蝙蝠',level:19,hp:520,atk:[40,52],def:8,mdef:12,exp:180,jexp:150,aspd:1,speed:3.4,range:1,aggressive:true,element:'water',
    art:{kind:'bat',body:'#79b7e6',accent:'#e6f6ff',scale:1},drops:[{item:'iceShard',rate:.45},{item:'bluePotion',rate:.06}],card:'batCard'}),
  bunny:m({id:'bunny',name:'雪球兔',level:21,hp:700,atk:[46,60],def:12,mdef:10,exp:230,jexp:190,aspd:1.3,speed:2.6,range:1,aggressive:false,element:'water',
    art:{kind:'bunny',body:'#f4f8ff',accent:'#ffb3c8',scale:1},drops:[{item:'snowFur',rate:.45},{item:'apple',rate:.3},{item:'furCape',rate:.012}],card:'bunnyCard'}),
  golem:m({id:'golem',name:'岩石魔像',level:24,hp:1250,atk:[64,82],def:28,mdef:5,exp:330,jexp:270,aspd:2,speed:1,range:1.3,aggressive:true,element:'earth',
    art:{kind:'golem',body:'#9a8c7b',accent:'#7fd3ff',scale:1.15},drops:[{item:'stoneCore',rate:.4},{item:'ironHelm',rate:.012}],card:'golemCard'}),
  iceColossus:m({id:'iceColossus',name:'冰霜巨像',level:36,hp:32000,atk:[260,360],def:40,mdef:30,exp:24000,jexp:18000,aspd:1.8,speed:1.1,range:2.2,aggressive:true,element:'water',mvp:true,
    art:{kind:'golem',body:'#8fd0f2',accent:'#ffffff',scale:2.6,crown:true},drops:[{item:'frozenHeart',rate:.8},{item:'starRing',rate:.12},{item:'bluePotion',rate:.8},{item:'hourglass',rate:.08}],card:'iceColossusCard'}),
  // —— v3.0：流派素材與新卡片 ——
  blueJelly:m({id:'blueJelly',name:'藍晶史萊姆',level:4,hp:95,atk:[10,14],def:2,mdef:4,exp:13,jexp:11,aspd:1.6,speed:1.5,range:1,aggressive:false,element:'water',
    art:{kind:'jelly',body:'#7fb8ff',accent:'#e3f1ff',scale:1},drops:[{item:'jellyGoo',rate:.4},{item:'bluePotion',rate:.04}],card:'blueJellyCard'}),
  wisp:m({id:'wisp',name:'林間精靈',level:13,hp:300,atk:[26,34],def:2,mdef:20,exp:95,jexp:80,aspd:1.5,speed:2.2,range:3,aggressive:false,element:'wind',attackType:'magic',attackElement:'wind',
    art:{kind:'wisp',body:'#a8f08a',accent:'#ffffff',scale:1},drops:[{item:'spiritDust',rate:.4},{item:'sageGlasses',rate:.012},{item:'bluePotion',rate:.05}],card:'wispCard'}),
  fox:m({id:'fox',name:'火狐',level:15,hp:420,atk:[30,40],def:8,mdef:6,exp:125,jexp:100,aspd:1.2,speed:3,range:1,aggressive:true,element:'fire',
    art:{kind:'fox',body:'#ff9a4a',accent:'#fff1dc',scale:1},drops:[{item:'foxTail',rate:.4},{item:'hunterCap',rate:.012},{item:'warBand',rate:.01}],card:'foxCard'}),
  iceFox:m({id:'iceFox',name:'霜狐',level:22,hp:820,atk:[54,70],def:14,mdef:10,exp:270,jexp:220,aspd:1.2,speed:3,range:1,aggressive:true,element:'water',
    art:{kind:'fox',body:'#bfe8ff',accent:'#ffffff',scale:1.05},drops:[{item:'snowFur',rate:.3},{item:'clover',rate:.01},{item:'foxTail',rate:.3}],card:'iceFoxCard'}),
  clockWisp:m({id:'clockWisp',name:'時鐘妖精',level:23,hp:700,atk:[50,64],def:6,mdef:30,exp:300,jexp:250,aspd:1.6,speed:2,range:3,aggressive:false,element:'neutral',attackType:'magic',
    art:{kind:'wisp',body:'#ffd45c',accent:'#fff8d8',scale:1},drops:[{item:'spiritDust',rate:.4},{item:'hourglass',rate:.008},{item:'timeCloak',rate:.01}],card:'clockCard'}),
  windWisp:m({id:'windWisp',name:'風之精靈',level:30,hp:1100,atk:[70,90],def:10,mdef:35,exp:500,jexp:420,aspd:1.4,speed:2.4,range:3,aggressive:true,element:'wind',attackType:'magic',attackElement:'wind',
    art:{kind:'wisp',body:'#8fe8f0',accent:'#ffffff',scale:1.1},drops:[{item:'spiritDust',rate:.5},{item:'galeCape',rate:.01},{item:'sorcererRobe',rate:.008}],card:'windCard'}),
  shadowBat:m({id:'shadowBat',name:'暗影蝙蝠',level:31,hp:1050,atk:[80,100],def:12,mdef:15,exp:520,jexp:430,aspd:1,speed:3.4,range:1,aggressive:true,element:'neutral',
    art:{kind:'bat',body:'#5a4a8a',accent:'#c9a3ff',scale:1.1},drops:[{item:'iceShard',rate:.3},{item:'featherBoots',rate:.01},{item:'galeBow',rate:.006}],card:'shadowBatCard'}),
  templeGolem:m({id:'templeGolem',name:'神殿守衛',level:34,hp:2600,atk:[105,130],def:40,mdef:12,exp:680,jexp:560,aspd:1.9,speed:1.1,range:1.4,aggressive:true,element:'earth',
    art:{kind:'golem',body:'#c9b8e0',accent:'#ffd45c',scale:1.2},drops:[{item:'stoneCore',rate:.4},{item:'meteorSword',rate:.006},{item:'starRod',rate:.006}],card:'templeCard'}),
  starIdol:m({id:'starIdol',name:'星落女神像',level:45,hp:60000,atk:[380,480],def:45,mdef:45,exp:60000,jexp:45000,aspd:1.7,speed:1.2,range:2.2,aggressive:true,element:'neutral',mvp:true,
    art:{kind:'golem',body:'#fff1d0',accent:'#ffd45c',scale:2.7,crown:true},drops:[{item:'starRing',rate:.2},{item:'starRod',rate:.15},{item:'hourglass',rate:.12},{item:'meteorSword',rate:.12},{item:'galeBow',rate:.12},{item:'whitePotion',rate:.8}],card:'starIdolCard'}),
};
/**
 * v4.4: innate element pairings no longer change damage. Fire, ice and lightning differ by their
 * combat loops (src/data/elements.ts), not by ×1.5／×0.75／×0.5 against a monster's element.
 * Element tags stay on skills, monsters, cards and gear (元素增幅 still applies). The pre-4.4 table is
 * kept as `legacyElementMultiplier` for reference and tests only — nothing in combat calls it.
 */
export function elementMultiplier(_attack:Element, _defend:Element):number { return 1; }
export function legacyElementMultiplier(attack:Element, defend:Element):number {
  const strong:Record<string,Element> = {fire:'earth',water:'fire',wind:'water',earth:'wind'};
  if (attack==='neutral'||defend==='neutral') return 1;
  if (strong[attack]===defend) return 1.5;
  if (strong[defend]===attack) return .75;
  if (attack===defend) return .5;
  return 1;
}

Object.assign(monsters,createExpansionMonsters(monsters));

// v4.7: 星落女神像 drops the crafting material for 星落頭冠.
monsters.starIdol.drops.push({item:'starShard',rate:.8});
// v4.8 封印冰庫 boss (dungeon MVP: repeatable on the MVP timer, slams and summons like other MVPs).
monsters.vaultWarden=m({id:'vaultWarden',name:'冰庫看守者',level:42,hp:52000,atk:[300,420],def:46,mdef:36,exp:42000,jexp:32000,aspd:1.7,speed:1.2,range:2.4,aggressive:true,element:'water',mvp:true,respawn:600,
  art:{kind:'golem',body:'#5a7fd0',accent:'#e4f6ff',scale:2.9,crown:true},drops:[{item:'frozenHeart',rate:1},{item:'vaultCrown',rate:.25},{item:'starShard',rate:.3},{item:'whitePotion',rate:.8}],card:'vaultWardenCard'});
// v4.8+ 寶箱怪: a normal chest is sometimes a mimic. Stats are rescaled per map when it appears (see World.takeChest).
monsters.mimic=m({id:'mimic',name:'寶箱怪',level:10,hp:600,atk:[30,45],def:10,mdef:10,exp:200,jexp:150,aspd:1.4,speed:2.2,range:1.2,aggressive:true,element:'neutral',
  art:{kind:'golem',body:'#9a6a3e',accent:'#ffe27a',scale:.9},drops:[{item:'trialSigil',rate:.5}],card:'mimicCard',cardRate:1/40});

// ═══════════ v5.0 星界遠征 (Lv.45–82) ═══════════
// Stats follow the same curve as the original late game (Lv.30 ≈ 1.1k HP / 500 EXP): HP ≈ 1.2·lv² by role, EXP ≈ 0.55·lv².
type Role='normal'|'sturdy'|'swift';
const ROLE:Record<Role,{hp:number;atk:number;def:number;mdef:number;spd:number;aspd:number}>={
  normal:{hp:1.25,atk:1,def:.5,mdef:.8,spd:2.2,aspd:1.4},sturdy:{hp:2.1,atk:1.2,def:1.1,mdef:.4,spd:1.1,aspd:1.9},swift:{hp:.85,atk:1.05,def:.3,mdef:.5,spd:3.2,aspd:1.1}};
/** Player stats cap at 99 so their damage plateaus past ~Lv.60; toughness grows slower there too (EXP still uses the real level). */
const eff=(lv:number)=>lv<=50?lv:50+(lv-50)*.55;
/** v6.0: physical DEF of Lv.45+ monsters was a 40–60% cut that left swordmen/archers at half a mage's pace; mages (MDEF) are unchanged. */
const PDEF=.55;
const ex=(id:string,name:string,level:number,role:Role,kind:MonsterArtKind,body:string,accent:string,scale:number,aggressive:boolean,element:Element,drops:{item:string;rate:number}[],range=1.2)=>{
  const r=ROLE[role],L=eff(level);
  return m({id,name,level,hp:Math.round(1.2*L*L*r.hp),atk:[Math.round(2.4*L*r.atk),Math.round(3.1*L*r.atk)],def:Math.round(L*r.def*PDEF),mdef:Math.round(L*r.mdef*.7),
    exp:Math.round(.55*level*level),jexp:Math.round(.45*level*level),aspd:r.aspd,speed:r.spd,range,aggressive,element,art:{kind,body,accent,scale},drops,card:`${id}Card`});
};
const boss=(id:string,name:string,level:number,kind:MonsterArtKind,body:string,accent:string,scale:number,element:Element,drops:{item:string;rate:number}[])=>
  m({id,name,level,hp:Math.round(29.6*eff(level)**2),atk:[Math.round(8.4*eff(level)),Math.round(10.7*eff(level))],def:Math.round(eff(level)*.75),mdef:Math.round(eff(level)*1.05),exp:Math.round(29.6*level*level),jexp:Math.round(22*level*level),
    aspd:1.7,speed:1.2,range:2.3,aggressive:true,element,mvp:true,art:{kind,body,accent,scale,crown:true},drops,card:`${id}Card`});
Object.assign(monsters,{
  // 霧語沼澤 Lv.45–55
  marshJelly:ex('marshJelly','沼澤泥怪',46,'normal','jelly','#6a8a4a','#c8d8a0',1.25,false,'earth',[{item:'bogMoss',rate:.45},{item:'herbTea',rate:.05},{item:'voyagerRing',rate:.006}]),
  mistBee:ex('mistBee','毒霧蜂',48,'swift','bee','#8aa860','#3a4a2a',1.15,true,'wind',[{item:'bogMoss',rate:.3},{item:'stinger',rate:.3},{item:'stormBow',rate:.005}]),
  bogSapling:ex('bogSapling','枯木妖',50,'sturdy','sapling','#5a4a3a','#8aa860',1.4,false,'earth',[{item:'bogMoss',rate:.4},{item:'woodChip',rate:.4},{item:'expeditionPlate',rate:.006}]),
  bogWolf:ex('bogWolf','沼澤狼',52,'normal','wolf','#4a5a3a','#c8d8a0',1.25,true,'earth',[{item:'wolfFang',rate:.4},{item:'bogMoss',rate:.3},{item:'mithrilSword',rate:.005}]),
  mistQueen:boss('mistQueen','霧之女王',58,'wisp','#3a6a4a','#d0ffd8',2.5,'water',[{item:'bogMoss',rate:1},{item:'starweaveRobe',rate:.15},{item:'skyCloak',rate:.12},{item:'whitePotion',rate:.8}]),
  // 熔岩裂谷 Lv.52–62
  magmaJelly:ex('magmaJelly','熔岩果凍',53,'normal','jelly','#e05a2a','#ffd080',1.25,false,'fire',[{item:'magmaCore',rate:.4},{item:'orangePotion',rate:.08}]),
  flameBat:ex('flameBat','火焰蝙蝠',55,'swift','bat','#c03a2a','#ffb050',1.15,true,'fire',[{item:'magmaCore',rate:.3},{item:'magmaBoots',rate:.006}]),
  magmaGolem:ex('magmaGolem','熔岩魔像',58,'sturdy','golem','#7a3a2a','#ff8a3a',1.35,true,'fire',[{item:'magmaCore',rate:.45},{item:'stoneCore',rate:.4},{item:'magmaBlade',rate:.005}]),
  blazeFox:ex('blazeFox','烈焰狐',60,'normal','fox','#ff6a2a','#fff0a0',1.2,true,'fire',[{item:'foxTail',rate:.4},{item:'magmaCore',rate:.3},{item:'rangerLeather',rate:.006}]),
  lavaColossus:boss('lavaColossus','熔岩巨像',65,'golem','#5a1a10','#ff7a2a',3,'fire',[{item:'magmaCore',rate:1},{item:'magmaBlade',rate:.15},{item:'magmaBoots',rate:.15},{item:'frozenHeart',rate:.4},{item:'whitePotion',rate:.8}]),
  // 天空花園 Lv.58–68
  cloudBunny:ex('cloudBunny','雲朵兔',59,'normal','bunny','#f4f8ff','#9fd0ff',1.25,false,'wind',[{item:'cloudFluff',rate:.45},{item:'snowFur',rate:.3}]),
  stormChick:ex('stormChick','風暴雛鷹',61,'swift','chick','#8ab8e8','#ffffff',1.3,true,'wind',[{item:'cloudFluff',rate:.3},{item:'feather',rate:.5},{item:'skyBow',rate:.005}]),
  angelShroom:ex('angelShroom','天使菇',63,'sturdy','shroom','#ffffff','#ffd8f0',1.35,false,'neutral',[{item:'cloudFluff',rate:.4},{item:'skyCloak',rate:.006}]),
  skyWisp:ex('skyWisp','天空精靈',65,'normal','wisp','#bfe4ff','#ffffff',1.2,true,'wind',[{item:'cloudFluff',rate:.35},{item:'spiritDust',rate:.4},{item:'skyStaff',rate:.005}],3),
  skyKing:boss('skyKing','天空之王',72,'chick','#f0f8ff','#ffd45c',2.9,'wind',[{item:'cloudFluff',rate:1},{item:'skyStaff',rate:.15},{item:'skyBow',rate:.15},{item:'starShard',rate:.4},{item:'whitePotion',rate:.8}]),
  // 星界城塞 Lv.65–82
  astralGuard:ex('astralGuard','星界守衛',68,'sturdy','golem','#4a3a8a','#c9a3ff',1.35,true,'neutral',[{item:'astralShard',rate:.35},{item:'stoneCore',rate:.4},{item:'astralCirclet',rate:.005}]),
  voidBat:ex('voidBat','虛空蝙蝠',70,'swift','bat','#2a1a4a','#c9a3ff',1.15,true,'neutral',[{item:'astralShard',rate:.3}]),
  starFox:ex('starFox','星塵狐',73,'normal','fox','#8a7ae8','#fff6c4',1.2,false,'neutral',[{item:'astralShard',rate:.35},{item:'foxTail',rate:.3}]),
  astralWisp:ex('astralWisp','星界精靈',76,'normal','wisp','#c9a3ff','#ffffff',1.25,true,'wind',[{item:'astralShard',rate:.4},{item:'spiritDust',rate:.4}],3),
  astralLord:boss('astralLord','星界君主',82,'golem','#1a1040','#ffd45c',3.3,'neutral',[{item:'astralShard',rate:1},{item:'astralScepter',rate:.12},{item:'astralBlade',rate:.12},{item:'astralBow',rate:.12},{item:'astralRing',rate:.15},{item:'starShard',rate:.5}]),
});

// ═══════════ v6.0 二轉：誓約試煉的守護者（每個職業一位；不會重生、不掉卡） ═══════════
const oath=(id:string,name:string,kind:MonsterArtKind,body:string,accent:string,o:Partial<MonsterDef>)=>m({id,name,level:62,hp:42000,atk:[330,430],def:40,mdef:34,exp:60000,jexp:45000,aspd:1.6,speed:1.6,range:2,aggressive:true,
  element:'neutral',mvp:true,respawn:86400,art:{kind,body,accent,scale:2.4,crown:true},drops:[{item:'trialSigil',rate:1},{item:'whitePotion',rate:1}],card:'mimicCard',cardRate:0,...o});
Object.assign(monsters,{
  oath_knight:oath('oath_knight','誓約守護者・岩盾','golem','#6a7a9a','#ffd45c',{hp:52000,def:52,atk:[360,460],speed:1.3}),
  oath_wizard:oath('oath_wizard','誓約守護者・星紋','wisp','#5b7dd6','#ffe9a8',{hp:38000,mdef:20,range:5,attackType:'magic',attackElement:'neutral',speed:1.5}),
  oath_ranger:oath('oath_ranger','誓約守護者・疾風','fox','#2fa08a','#fff6c4',{hp:40000,flee:120,speed:3,aspd:1.1,atk:[300,400]}),
});

// ═══════════ v6.0 二轉地下城與星燈航路（Lv.62～90） ═══════════
type Trait=NonNullable<MonsterDef['trait']>;
const tr=(d:MonsterDef,trait:Trait):MonsterDef=>({...d,trait});
Object.assign(monsters,{
  // 黑曜鍛爐 Lv.62～78
  cinderJelly:tr(ex('cinderJelly','煤芯果凍',63,'normal','jelly','#3a2a2a','#ff7a2a',1.3,false,'fire',[{item:'forgeSand',rate:.45},{item:'whitePotion',rate:.04}]),'bomb'),
  ashBat:tr(ex('ashBat','灰羽蝙蝠',65,'swift','bat','#5a5050','#ffb050',1.2,true,'fire',[{item:'forgeSand',rate:.3},{item:'magmaCore',rate:.15}]),'charge'),
  shellGolem:ex('shellGolem','熔殼魔像',68,'sturdy','golem','#4a2a1a','#ff8a3a',1.45,true,'fire',[{item:'forgeSand',rate:.4},{item:'magmaCore',rate:.2},{item:'galeSaber',rate:.004}]),
  forgeWisp:tr(ex('forgeWisp','鍛爐精靈',70,'normal','wisp','#ff9a4a','#fff0c0',1.2,true,'fire',[{item:'forgeSand',rate:.35},{item:'emberRingStaff',rate:.004}]),'shield'),
  forgeMaster:boss('forgeMaster','熔爐總監',76,'golem','#2a1a14','#ffb050',3.2,'fire',[{item:'oathCore',rate:1},{item:'forgeSand',rate:1},{item:'dawnbreaker',rate:.06},{item:'bulwarkSword',rate:.06},{item:'emberRingStaff',rate:.06},{item:'bindingBow',rate:.06},{item:'ironFeatherCape',rate:.1},{item:'whitePotion',rate:.8}]),
  // 逆風鐘塔 Lv.70～84
  beatSprite:{...ex('beatSprite','斷拍妖精',74,'normal','wisp','#e8d8ff','#ffd45c',1.15,true,'wind',[{item:'bellSilk',rate:.35},{item:'stormRingStaff',rate:.004}],5),attackType:'magic' as const,attackElement:'wind' as const},
  galeChick:tr(ex('galeChick','逆風雛鳥',76,'swift','chick','#c8e8ff','#ffd45c',1.3,true,'wind',[{item:'bellSilk',rate:.3},{item:'cloudFluff',rate:.2},{item:'cycloneBow',rate:.004}]),'charge'),
  bellBee:ex('bellBee','鈴翼蜂',78,'swift','bee','#ffe9a8','#8a6a3a',1.2,true,'wind',[{item:'bellSilk',rate:.45},{item:'farsightBow',rate:.004}]),
  cogGolem:tr(ex('cogGolem','齒輪魔像',80,'sturdy','golem','#b8a070','#5a4a3a',1.4,false,'neutral',[{item:'bellSilk',rate:.3},{item:'astralShard',rate:.15},{item:'mirrorSnowStaff',rate:.004}]),'shield'),
  bellTuner:boss('bellTuner','星鐘調律者',84,'wisp','#fff0c0','#5b7dd6',2.8,'wind',[{item:'oathCore',rate:1},{item:'bellSilk',rate:1},{item:'galeSaber',rate:.06},{item:'mirrorSnowStaff',rate:.06},{item:'stormRingStaff',rate:.06},{item:'farsightBow',rate:.06},{item:'cycloneBow',rate:.06},{item:'starCirclet',rate:.1},{item:'whitePotion',rate:.8}]),
  // 貝露灣 Lv.80～90（星燈航路）
  bubbleJelly:tr(ex('bubbleJelly','潮泡果凍',81,'normal','jelly','#9fe8f0','#ffffff',1.3,false,'water',[{item:'tideGlass',rate:.4},{item:'bluePotion',rate:.06}]),'heal'),
  lampBat:ex('lampBat','燈殼蝙蝠',83,'swift','bat','#3a4a7a','#ffe27a',1.2,true,'neutral',[{item:'lampWick',rate:.5},{item:'tideGlass',rate:.2}]),
  saltWorm:tr(ex('saltWorm','海鹽幼蟲',85,'sturdy','worm','#f0f0e8','#7fd7ff',1.4,false,'water',[{item:'tideGlass',rate:.4},{item:'steadyBoots',rate:.004}]),'bomb'),
  tideWisp:{...ex('tideWisp','浪歌精靈',87,'normal','wisp','#7fd7ff','#ffffff',1.25,true,'water',[{item:'tideGlass',rate:.35},{item:'huntRing',rate:.004}],5),attackType:'magic' as const,attackElement:'water' as const},
  tideQueen:boss('tideQueen','潮歌貝后',90,'jelly','#ffb8d8','#7fd7ff',3.4,'water',[{item:'oathCore',rate:1},{item:'tideGlass',rate:1},{item:'huntRing',rate:.12},{item:'steadyBoots',rate:.12},{item:'emberRobe',rate:.1},{item:'galeVest',rate:.1},{item:'whitePotion',rate:.8}]),
});
// v6.2: 熔岩巨像 also drops the late 烈焰附刃 sword.
monsters.lavaColossus.drops.push({item:'infernoBlade',rate:.1});
monsters.magmaGolem.drops.push({item:'quakeBlade',rate:.006});
