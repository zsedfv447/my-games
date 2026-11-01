import {expansionEquipment,expansionShopStock} from './expansion-equipment';
import { craftMaterials, craftGear, signatureRefine, dungeonGear } from './crafting';
import { expeditionMaterials, expeditionGear, expeditionCards, frontierStock } from './expedition-items';
import { ascensionMaterials, ascensionGear, ascensionCards } from './ascension-items';
import { uniqueGear, starfallMaterials } from './starfall';
import {expansionCards} from './expansion-roster';
// Items, equipment, cards and the skill modules cards unlock (GDD Q07: card in worn gear → module).
import type { JobId, Stat, SkillTag } from './jobs';

export type EquipSlot = 'weapon'|'head'|'armor'|'garment'|'shoes'|'accessory';
export const equipSlotNames: Record<EquipSlot,string> = {weapon:'武器',head:'頭飾',armor:'盔甲',garment:'披肩',shoes:'鞋子',accessory:'飾品'};
export const equipSlotOrder: EquipSlot[] = ['head','weapon','armor','garment','shoes','accessory'];
export type WeaponType = 'dagger'|'sword'|'staff'|'bow';
export const weaponTypeNames: Record<WeaponType,string> = {dagger:'短劍',sword:'劍',staff:'杖',bow:'弓'};
export type IconShape = 'potion'|'sword'|'dagger'|'staff'|'bow'|'hat'|'helm'|'crown'|'armor'|'robe'|'cape'|'shoes'|'ring'|'clip'
  |'apple'|'goo'|'feather'|'fang'|'shard'|'leaf'|'card'|'silk'|'cap'|'bark'|'honey'|'stone'|'heart'|'stinger'|'fur'|'chip';
export type Icon = { shape:IconShape; color:string; accent?:string };
/** v4.7 percent-style bonuses granted by refine milestones. */
export type RefineBonus = Partial<Record<'cast'|'aspd'|'crit'|'delay'|'spCost'|'spRegen'|'loop'|'skill'|'matk'|'hp'|'sp'|'mdef',number>>;

export type EquipDef = {
  kind:'equip'; id:string; name:string; slot:EquipSlot; weaponType?:WeaponType;
  atk?:number; matk?:number; def?:number; mdef?:number; hp?:number; sp?:number; stats?:Partial<Record<Stat,number>>;
  /** Build stats in percent: cast time −, attack speed +, crit chance +, after-cast delay −. */
  cast?:number; aspd?:number; crit?:number; delay?:number;
  /** v4.7 build stats in percent: SP cost −, SP regen +, follow-up damage + (burn/detonate/shatter/chain/echo…), skill damage +. */
  spCost?:number; spRegen?:number; loop?:number; skill?:number;
  /** v4.7 signature bonus unlocked at refine +7 (on top of the regular refine milestones). */
  refine7?:RefineBonus; special?:string;
  /** v6.0: a gear mechanic the simulation reads (see data/ascension-items.ts GEAR_FX). */
  fx?:import('./ascension-items').GearFx;
  /** v7.0 唯一裝備 (fixed power, its own quality colour). */
  unique?:boolean;
  jobs:JobId[]|'all'; reqLv:number; price:number; slots:number; desc:string; icon:Icon;
};
export type UseDef = {
  kind:'use'; id:string; name:string; hp?:number; sp?:number; effect?:'return'|'teleport'|'tame';
  /** v4.5 food: regenerates hp/sp per second for dur seconds instead of healing at once. One food at a time. */
  food?:{hp:number;sp:number;dur:number};
  price:number; desc:string; icon:Icon;
};
export type EtcDef = { kind:'etc'; id:string; name:string; price:number; desc:string; icon:Icon };
export type ItemDef = EquipDef|UseDef|EtcDef;

const all:'all'='all';
const eq=(d:Omit<EquipDef,'kind'>):EquipDef=>({kind:'equip',...d});
const use=(d:Omit<UseDef,'kind'>):UseDef=>({kind:'use',...d});
const etc=(id:string,name:string,price:number,shape:IconShape,color:string,desc:string):EtcDef=>({kind:'etc',id,name,price,desc,icon:{shape,color}});

export const items: Record<string,ItemDef> = Object.fromEntries([
  // weapons
  eq({id:'knife',name:'新手短劍',slot:'weapon',weaponType:'dagger',atk:17,jobs:all,reqLv:1,price:50,slots:1,desc:'每位冒險者的第一把武器。',icon:{shape:'dagger',color:'#c9d3dd'}}),
  eq({id:'cutter',name:'銳利短劍',slot:'weapon',weaponType:'dagger',atk:32,jobs:all,reqLv:10,price:1200,slots:1,desc:'輕巧好用的短劍。',icon:{shape:'dagger',color:'#e0e8f0',accent:'#d9a441'}}),
  eq({id:'sword',name:'騎士長劍',slot:'weapon',weaponType:'sword',atk:48,jobs:['swordman'],reqLv:12,price:2400,slots:1,desc:'劍士的標準長劍。',icon:{shape:'sword',color:'#dfe7ef'}}),
  eq({id:'dawnSword',name:'晨光劍',slot:'weapon',weaponType:'sword',atk:82,stats:{str:2},jobs:['swordman'],reqLv:24,price:9000,slots:2,desc:'刀身映著晨光的名劍。',icon:{shape:'sword',color:'#ffe9a8',accent:'#f2a93b'}}),
  eq({id:'rod',name:'見習魔杖',slot:'weapon',weaponType:'staff',atk:15,matk:15,stats:{int:1},jobs:['novice','mage'],reqLv:1,price:150,slots:1,desc:'魔法學院發給新生的木杖。',icon:{shape:'staff',color:'#a8734a',accent:'#9fd5ff'}}),
  eq({id:'woodStaff',name:'樹靈法杖',slot:'weapon',weaponType:'staff',atk:25,matk:30,stats:{int:2},jobs:['mage'],reqLv:14,price:5000,slots:1,desc:'寄宿著樹靈的法杖。',icon:{shape:'staff',color:'#6b8f3a',accent:'#b9f28a'}}),
  eq({id:'bow',name:'獵人弓',slot:'weapon',weaponType:'bow',atk:30,jobs:['archer'],reqLv:1,price:600,slots:1,desc:'結實的木製長弓。',icon:{shape:'bow',color:'#a9744c'}}),
  eq({id:'compositeBow',name:'複合弓',slot:'weapon',weaponType:'bow',atk:58,stats:{dex:1},jobs:['archer'],reqLv:18,price:4800,slots:1,desc:'以獸角強化的複合弓。',icon:{shape:'bow',color:'#7f5634',accent:'#e9d7a8'}}),
  eq({id:'elvenBow',name:'精靈長弓',slot:'weapon',weaponType:'bow',atk:96,stats:{dex:3,agi:1},jobs:['archer'],reqLv:28,price:12000,slots:2,desc:'古樹守護者守護的長弓。',icon:{shape:'bow',color:'#5aa35b',accent:'#fff3a8'}}),
  // head
  eq({id:'cap',name:'冒險小帽',slot:'head',def:2,jobs:all,reqLv:1,price:400,slots:1,desc:'可愛的布帽。',icon:{shape:'hat',color:'#d9534f'}}),
  eq({id:'jellyCrown',name:'果凍王冠',slot:'head',def:4,stats:{int:1,luk:2},jobs:all,reqLv:10,price:6000,slots:1,desc:'軟軟彈彈的王冠。',icon:{shape:'crown',color:'#ff9ec4',accent:'#ffd45c'}}),
  eq({id:'ironHelm',name:'鐵盔',slot:'head',def:7,hp:60,jobs:['swordman','archer'],reqLv:20,price:5500,slots:1,desc:'厚實的鐵製頭盔。',icon:{shape:'helm',color:'#a9b4c2'}}),
  // armor
  eq({id:'cottonShirt',name:'棉質襯衫',slot:'armor',def:2,jobs:all,reqLv:1,price:80,slots:1,desc:'輕便的棉衣。',icon:{shape:'armor',color:'#f1efe8'}}),
  eq({id:'adventureSuit',name:'冒險者服',slot:'armor',def:5,jobs:all,reqLv:5,price:900,slots:1,desc:'耐磨的冒險裝。',icon:{shape:'armor',color:'#8fae6a'}}),
  eq({id:'chainMail',name:'鎖鍊甲',slot:'armor',def:10,hp:120,jobs:['swordman'],reqLv:18,price:6500,slots:1,desc:'劍士喜愛的鎖子甲。',icon:{shape:'armor',color:'#a9b4c2',accent:'#6c7a89'}}),
  eq({id:'mageRobe',name:'星紋法袍',slot:'armor',def:4,mdef:10,sp:40,stats:{int:1},jobs:['mage'],reqLv:12,price:4200,slots:1,desc:'繡著星紋的法袍。',icon:{shape:'robe',color:'#7d5bd6',accent:'#ffe9a8'}}),
  // garment / shoes / accessory
  eq({id:'cape',name:'旅行斗篷',slot:'garment',def:1,jobs:all,reqLv:1,price:300,slots:1,desc:'擋風遮雨的斗篷。',icon:{shape:'cape',color:'#6b8fd6'}}),
  eq({id:'furCape',name:'雪兔毛披肩',slot:'garment',def:3,stats:{agi:1},jobs:all,reqLv:18,price:4000,slots:1,desc:'暖呼呼的毛披肩。',icon:{shape:'cape',color:'#f4f8ff',accent:'#ffb3c8'}}),
  eq({id:'sandals',name:'草編涼鞋',slot:'shoes',def:1,jobs:all,reqLv:1,price:200,slots:1,desc:'簡單的涼鞋。',icon:{shape:'shoes',color:'#c9a46b'}}),
  eq({id:'leatherBoots',name:'皮革長靴',slot:'shoes',def:3,hp:40,jobs:all,reqLv:12,price:3200,slots:1,desc:'結實的長靴。',icon:{shape:'shoes',color:'#7f5634'}}),
  eq({id:'luckyClip',name:'幸運髮夾',slot:'accessory',sp:10,stats:{luk:1},jobs:all,reqLv:1,price:1500,slots:1,desc:'據說會帶來好運的髮夾。',icon:{shape:'clip',color:'#ff9ec4'}}),
  eq({id:'starRing',name:'星辰戒指',slot:'accessory',stats:{str:2,int:2,dex:2},jobs:all,reqLv:30,price:15000,slots:1,desc:'閃爍星光的戒指。',icon:{shape:'ring',color:'#ffd45c',accent:'#9fd5ff'}}),
  // —— v3.0 流派裝備 ——
  eq({id:'mageEarring',name:'魔導耳環',slot:'accessory',sp:20,stats:{int:1},cast:8,jobs:['mage'],reqLv:15,price:6000,slots:1,desc:'刻著詠唱符文的耳環。',icon:{shape:'ring',color:'#9fd5ff',accent:'#7d5bd6'}}),
  eq({id:'hourglass',name:'時之沙漏',slot:'accessory',sp:30,cast:15,jobs:['mage'],reqLv:25,price:30000,slots:1,desc:'時鐘妖精守護的沙漏，讓咒語跑得更快。',icon:{shape:'ring',color:'#ffd45c',accent:'#ffffff'}}),
  eq({id:'swiftBangle',name:'迅捷手環',slot:'accessory',stats:{agi:1},aspd:8,jobs:'all',reqLv:15,price:6000,slots:1,desc:'戴上後出手更俐落。',icon:{shape:'ring',color:'#7fe0b0',accent:'#ffffff'}}),
  eq({id:'clover',name:'四葉幸運草',slot:'accessory',stats:{luk:2},crit:6,jobs:'all',reqLv:15,price:7000,slots:1,desc:'霜狐偶爾叼著的幸運草。',icon:{shape:'leaf',color:'#6fcf6f'}}),
  eq({id:'guardRing',name:'守護戒指',slot:'accessory',def:3,hp:120,jobs:'all',reqLv:20,price:8000,slots:1,desc:'給前線冒險者的護身戒指。',icon:{shape:'ring',color:'#c9b8a0',accent:'#d9534f'}}),
  eq({id:'sageGlasses',name:'賢者眼鏡',slot:'head',def:1,stats:{dex:2},cast:6,jobs:['mage','archer'],reqLv:18,price:9000,slots:1,desc:'林間精靈收藏的圓眼鏡。',icon:{shape:'clip',color:'#c9a46b'}}),
  eq({id:'hunterCap',name:'獵人帽',slot:'head',def:2,stats:{dex:1},aspd:5,jobs:['archer'],reqLv:18,price:9000,slots:1,desc:'插著羽毛的獵人帽。',icon:{shape:'hat',color:'#4f9a5a'}}),
  eq({id:'warBand',name:'戰士頭巾',slot:'head',def:2,stats:{str:2},crit:6,jobs:['swordman'],reqLv:18,price:8000,slots:1,desc:'綁上它就會鬥志高昂。',icon:{shape:'hat',color:'#c8443e'}}),
  eq({id:'timeCloak',name:'時光斗篷',slot:'garment',def:2,mdef:4,cast:6,jobs:'all',reqLv:26,price:14000,slots:1,desc:'衣襬上的星砂緩緩流動。',icon:{shape:'cape',color:'#3a3a8a',accent:'#ffd45c'}}),
  eq({id:'galeCape',name:'疾風披風',slot:'garment',def:2,stats:{agi:1},aspd:6,jobs:'all',reqLv:26,price:14000,slots:1,desc:'風之精靈的羽衣。',icon:{shape:'cape',color:'#8fe8f0',accent:'#ffffff'}}),
  eq({id:'featherBoots',name:'輕羽靴',slot:'shoes',def:2,stats:{agi:2},delay:8,jobs:'all',reqLv:26,price:14000,slots:1,desc:'穿上後技能收招更快。',icon:{shape:'shoes',color:'#e9e4ff'}}),
  eq({id:'sorcererRobe',name:'秘術長袍',slot:'armor',def:4,mdef:12,sp:80,stats:{int:2},cast:5,jobs:['mage'],reqLv:30,price:20000,slots:1,desc:'秘術師的長袍。',icon:{shape:'robe',color:'#2f2a6a',accent:'#9fd5ff'}}),
  eq({id:'starRod',name:'星辰法杖',slot:'weapon',weaponType:'staff',atk:30,matk:45,stats:{int:3},cast:10,jobs:['mage'],reqLv:32,price:40000,slots:2,desc:'杖頂鑲著墜落的星星。',icon:{shape:'staff',color:'#3a3a8a',accent:'#ffd45c'}}),
  eq({id:'galeBow',name:'疾風弓',slot:'weapon',weaponType:'bow',atk:88,stats:{dex:2},aspd:10,jobs:['archer'],reqLv:32,price:40000,slots:2,desc:'拉弦時會颳起一陣風。',icon:{shape:'bow',color:'#8fe8f0',accent:'#ffffff'}}),
  eq({id:'meteorSword',name:'流星劍',slot:'weapon',weaponType:'sword',atk:115,stats:{str:2},crit:12,jobs:['swordman'],reqLv:32,price:40000,slots:2,desc:'劍身拖著星光的長劍。',icon:{shape:'sword',color:'#fff1b8',accent:'#7d5bd6'}}),
  // consumables
  use({id:'redPotion',name:'紅色藥水',hp:45,price:50,desc:'回復 45 HP。',icon:{shape:'potion',color:'#e8524a'}}),
  use({id:'orangePotion',name:'橙色藥水',hp:110,price:200,desc:'回復 110 HP。',icon:{shape:'potion',color:'#f39a3a'}}),
  use({id:'whitePotion',name:'白色藥水',hp:330,price:1200,desc:'回復 330 HP。',icon:{shape:'potion',color:'#f4f4f4'}}),
  use({id:'bluePotion',name:'藍色藥水',sp:60,price:500,desc:'回復 60 SP。',icon:{shape:'potion',color:'#4b7fe0'}}),
  use({id:'apple',name:'蘋果',hp:16,price:15,desc:'香甜的蘋果，回復 16 HP。',icon:{shape:'apple',color:'#e8524a'}}),
  use({id:'honey',name:'蜂蜜',hp:70,sp:20,price:250,desc:'回復 70 HP 與 20 SP。',icon:{shape:'honey',color:'#ffbe3b'}}),
  // v4.5 food: slow, cheap regeneration (one food effect at a time; a new meal replaces the old one)
  use({id:'dawnBread',name:'晨光麵包',food:{hp:4,sp:0,dur:60},price:40,desc:'剛出爐的麵包。60 秒內每秒回復 4 HP（共 240）。',icon:{shape:'chip',color:'#e8b46a',accent:'#fff1c8'}}),
  use({id:'shroomSoup',name:'蘑菇濃湯',food:{hp:10,sp:0,dur:90},price:300,desc:'暖呼呼的濃湯。90 秒內每秒回復 10 HP（共 900）。',icon:{shape:'cap',color:'#c98a5a',accent:'#fff1c8'}}),
  use({id:'starJuice',name:'星光果汁',food:{hp:0,sp:2,dur:90},price:250,desc:'冰涼的果汁。90 秒內每秒回復 2 SP（共 180），比藍色藥水便宜很多。',icon:{shape:'potion',color:'#9fd5ff',accent:'#ffd45c'}}),
  use({id:'herbTea',name:'薰衣草花茶',food:{hp:0,sp:4,dur:120},price:800,desc:'讓魔力慢慢充盈的花茶。120 秒內每秒回復 4 SP（共 480）。',icon:{shape:'potion',color:'#b38cff',accent:'#ffffff'}}),
  use({id:'adventBento',name:'冒險便當',food:{hp:8,sp:3,dur:150},price:1500,desc:'飯糰、炸蝦和玉子燒。150 秒內每秒回復 8 HP 與 3 SP（共 1200 HP、450 SP）。',icon:{shape:'chip',color:'#ff9f6a',accent:'#ffffff'}}),
  use({id:'returnFeather',name:'回城羽毛',effect:'return',price:300,desc:'立刻回到記錄點。',icon:{shape:'feather',color:'#9fd5ff'}}),
  use({id:'teleportLeaf',name:'瞬移葉',effect:'teleport',price:60,desc:'隨機傳送到同一張地圖的某處。',icon:{shape:'leaf',color:'#6fcf6f'}}),
  use({id:'tameCrystal',name:'星光誘捕器',effect:'tame',price:800,desc:'對著可捕捉的魔物使用（滑鼠指著或正在攻擊的目標）。魔物血量越低越容易成功。MVP 無法捕捉。',icon:{shape:'shard',color:'#ff9ec4',accent:'#ffffff'}}),
  // loot
  etc('jellyGoo','果凍黏液',4,'goo','#ff9ec4','噗噗果凍掉落的黏液。'),
  etc('softSilk','柔軟絲線',9,'silk','#e8ffb5','小綠蟲吐出的絲。'),
  etc('sporeCap','孢子菇傘',14,'cap','#e96a5b','還帶著孢子的菇傘。'),
  etc('feather','雞羽毛',20,'feather','#ffd45c','蓬鬆的羽毛。'),
  etc('royalJelly','皇家果凍',600,'goo','#ffd45c','果凍國王的珍藏。'),
  etc('wolfFang','狼牙',38,'fang','#f1efe8','森林狼仔的牙。'),
  etc('stinger','蜂針',32,'stinger','#3b2f2a','還有點刺痛。'),
  etc('woodChip','木屑',45,'chip','#a9744c','樹苗精身上的木片。'),
  etc('ancientBark','古樹皮',1500,'bark','#8b5a36','古樹守護者的樹皮。'),
  etc('iceShard','冰晶碎片',70,'shard','#9fd5ff','冰涼的晶體。'),
  etc('snowFur','雪兔毛',80,'fur','#f4f8ff','柔軟的白毛。'),
  etc('stoneCore','石核',120,'stone','#9a8c7b','魔像的動力核心。'),
  etc('frozenHeart','冰霜之心',4000,'heart','#8fd0f2','冰霜巨像的心臟。'),
  etc('foxTail','狐狸尾巴',90,'fur','#ff9a4a','蓬鬆的狐狸尾巴。'),
  etc('spiritDust','精靈粉塵',110,'shard','#d8ffb0','閃閃發光的粉塵。'),
].map(d=>[d.id,d]));

export type ModuleDef = { id:string; name:string; tags:SkillTag[]; desc:(coef:number)=>string };
const pct=(x:number)=>`${Math.round(x)}%`;
/** Each card unlocks one module; Lv.1 already gives the full mechanic, levels only scale one number (GDD 6.2). */
export const modules: Record<string,ModuleDef> = {
  leech:{id:'leech',name:'黏黏吸取',tags:['single'],desc:c=>`命中時回復造成傷害 ${pct(4*c)} 的 HP。`},
  snare:{id:'snare',name:'黏絲纏繞',tags:['single','area'],desc:c=>`命中使敵人緩速 40%，持續 ${(1.5*c).toFixed(2)} 秒。`},
  echo:{id:'echo',name:'孢子回響',tags:['area'],desc:c=>`範圍命中 0.4 秒後原地再回響一次，${pct(40*c)} 傷害。`},
  feather:{id:'feather',name:'羽毛護盾',tags:['single','area','buff'],desc:c=>`施放時獲得 ${Math.round(12*c)} + 基本等級×1.5 的護盾，持續 6 秒。`},
  chain:{id:'chain',name:'群狼連擊',tags:['single'],desc:c=>`命中後連到 3 格內另一隻敵人，造成 ${pct(50*c)} 傷害。`},
  venom:{id:'venom',name:'蜂針劇毒',tags:['single','area'],desc:c=>`命中附加中毒 3 秒，每秒造成命中傷害的 ${pct(24*c)}。`},
  root:{id:'root',name:'盤根束縛',tags:['area'],desc:c=>`範圍命中使敵人無法移動 ${(1*c).toFixed(2)} 秒。`},
  keen:{id:'keen',name:'冰晶銳眼',tags:['single'],desc:c=>`這個技能的爆擊率 +${pct(15*c)}。`},
  frostbite:{id:'frostbite',name:'雪寒凍結',tags:['bolt','single'],desc:c=>`命中有 ${pct(20*c)} 機率冰凍敵人 1.5 秒。`},
  quake:{id:'quake',name:'震地之力',tags:['melee','area'],desc:c=>`命中有 ${pct(25*c)} 機率暈眩敵人 1 秒。`},
  pulse:{id:'pulse',name:'王者脈動',tags:['area'],desc:c=>`範圍命中 0.5 秒後擴散脈動，擊退並造成 ${pct(30*c)} 傷害。`},
  regrowth:{id:'regrowth',name:'森之息',tags:['single','area','buff'],desc:c=>`施放後 4 秒內每秒回復最大 HP 的 ${(2*c).toFixed(1)}%。`},
  shatter:{id:'shatter',name:'碎冰核心',tags:['single','area','bolt'],desc:c=>`以此技能擊倒敵人時碎裂，對周圍 2 格造成 ${pct(50*c)} 傷害。`},
  // —— v3.0 流派模組 ——
  quickCast:{id:'quickCast',name:'時晶詠唱',tags:['magic','ranged'],desc:c=>`這個技能的詠唱時間 −${pct(20*c)}。`},
  spSaver:{id:'spSaver',name:'魔力節約',tags:['single','area','buff'],desc:c=>`這個技能消耗的 SP −${pct(20*c)}。`},
  delayCut:{id:'delayCut',name:'迅捷收招',tags:['single','area','buff'],desc:c=>`這個技能的施放後延遲 −${pct(25*c)}。`},
  fatal:{id:'fatal',name:'致命一擊',tags:['single'],desc:c=>`這個技能爆擊時，傷害再 +${pct(30*c)}。`},
  pierce:{id:'pierce',name:'破甲',tags:['melee','ranged'],desc:c=>`這個技能無視目標 ${pct(30*c)} 的防禦。`},
  manaRefund:{id:'manaRefund',name:'魔力湧現',tags:['magic'],desc:c=>`以此技能擊倒敵人時，返還 ${pct(30*c)} 的 SP 消耗。`},
  split:{id:'split',name:'分裂箭',tags:['ranged'],desc:c=>`命中後再射出一支分裂箭，造成 ${pct(45*c)} 傷害。`},
  amplify:{id:'amplify',name:'元素增幅',tags:['magic','melee','ranged'],desc:c=>`屬性技能（火、水、風、地）傷害 +${pct(15*c)}。`},
  starfall:{id:'starfall',name:'星落',tags:['single','area'],desc:c=>`命中時有 ${pct(12*c)} 機率召喚流星，再造成 150% 傷害。`},
};
export type CardDef = { id:string; name:string; monster:string; moduleId:string; maxLevel:number };
const card=(id:string,name:string,monster:string,moduleId:string,maxLevel=5):CardDef=>({id,name,monster,moduleId,maxLevel});
export const cards: Record<string,CardDef> = Object.fromEntries([
  card('jellyCard','噗噗果凍卡','jelly','leech'),
  card('wormCard','小綠蟲卡','worm','snare'),
  card('shroomCard','蘑菇寶寶卡','shroom','echo'),
  card('chickCard','咕咕雞卡','chick','feather'),
  card('wolfCard','森林狼仔卡','wolf','chain'),
  card('beeCard','蜂蜂卡','bee','venom'),
  card('saplingCard','樹苗精卡','sapling','root'),
  card('batCard','冰晶蝙蝠卡','bat','keen'),
  card('bunnyCard','雪球兔卡','bunny','frostbite'),
  card('golemCard','岩石魔像卡','golem','quake'),
  card('jellyKingCard','果凍國王卡','jellyKing','pulse',3),
  card('forestLordCard','古樹守護者卡','forestLord','regrowth',3),
  card('iceColossusCard','冰霜巨像卡','iceColossus','shatter',3),
  card('blueJellyCard','藍晶史萊姆卡','blueJelly','spSaver'),
  card('wispCard','林間精靈卡','wisp','manaRefund'),
  card('foxCard','火狐卡','fox','fatal'),
  card('iceFoxCard','霜狐卡','iceFox','pierce'),
  card('clockCard','時鐘妖精卡','clockWisp','quickCast'),
  card('windCard','風之精靈卡','windWisp','delayCut'),
  card('shadowBatCard','暗影蝙蝠卡','shadowBat','split'),
  card('templeCard','神殿守衛卡','templeGolem','amplify'),
  card('starIdolCard','星落女神像卡','starIdol','starfall',3),
].map(c=>[c.id,c]));
/** GDD 6.2 budget: normal cards +7/+14/+22/+30%, MVP (three-step) cards +14/+30%. */
export function moduleCoefficient(cardId:string, level:number):number {
  const table = cards[cardId]?.maxLevel===3 ? [1,1.14,1.30] : [1,1.07,1.14,1.22,1.30];
  return table[Math.max(0,Math.min(table.length-1,level-1))];
}
/** GDD 6.1: Lv.n → n+1 consumes n same-name Lv.1 cards. */
export const upgradeCost = (level:number) => level;
export const shopStock = {
  tool:['redPotion','orangePotion','whitePotion','bluePotion','dawnBread','shroomSoup','starJuice','herbTea','adventBento','returnFeather','teleportLeaf','tameCrystal'],
  gear:['knife','rod','bow','cutter','sword','dawnSword','woodStaff','compositeBow','cap','ironHelm','cottonShirt','adventureSuit','mageRobe','chainMail','cape','sandals','mageEarring','swiftBangle','clover','guardRing','warBand'],
};

// Content additions retain every original definition and id.
for(const def of expansionEquipment)items[def.id]=def;
// v4.7 crafting content and signature refine bonuses (appended ids only).
for(const def of [...craftMaterials,...craftGear,...dungeonGear])items[def.id]=def;
// v5.0 星界遠征
for(const def of [...expeditionMaterials,...expeditionGear])items[def.id]=def;
for(const def of [...ascensionMaterials,...ascensionGear])items[def.id]=def;
// v7.0 星淵紀元
for(const def of [...starfallMaterials,...uniqueGear])items[def.id]=def;
// v6.0 modules: one per second-job play style.
Object.assign(modules,{
  starBlade:{id:'starBlade',name:'星誓殘光',tags:['melee','area'],desc:(c:number)=>`範圍近戰打中 2 隻以上時，追加一道 ${pct(40*c)} 的震波（每次施放一次）。`},
  preyHunt:{id:'preyHunt',name:'獵印追擊',tags:['ranged','single'],desc:(c:number)=>`命中【獵物】時追加一箭 ${pct(45*c)}（每 0.5 秒最多一次）。`},
  emberEcho:{id:'emberEcho',name:'星火殘響',tags:['magic','area'],desc:(c:number)=>`引爆灼燒時，每個目標再炸出 ${pct(50*c)} 的小火星（爆炎球、星紋奧義）。`},
  frostLinger:{id:'frostLinger',name:'霜晶延印',tags:['magic'],desc:(c:number)=>`這招形成的寒冰印記多持續 ${(1.5*c).toFixed(1)} 秒（冰霜矢、冰封術、霜環囚域）。`},
  thunderReturn:{id:'thunderReturn',name:'落雷折返',tags:['magic','bolt'],desc:(c:number)=>`雷鳴矢每次落雷，再折返一道 ${pct(40*c)} 的雷擊。`},
  tideGuard:{id:'tideGuard',name:'潮音庇護',tags:['single','area'],desc:(c:number)=>`命中時獲得最大 HP ${(2.5*c).toFixed(1)}% 的護盾 4 秒（每 8 秒一次）。`},
} satisfies Record<string,ModuleDef>);
for(const [id,name,monster,moduleId,max] of ascensionCards)cards[id]=card(id,name,monster,moduleId,max);
for(const [id,name,monster,moduleId,max] of expeditionCards)cards[id]=card(id,name,monster,moduleId,max);
(shopStock as Record<string,string[]>).frontier=frontierStock;
for(const [id,r] of Object.entries(signatureRefine)){const d=items[id] as EquipDef|undefined;if(d?.kind==='equip'){d.refine7=r.bonus;if(r.special)d.special=r.special;}}
for(const def of expansionCards)cards[def.id]=def;
cards.mimicCard=card('mimicCard','寶箱怪卡','mimic','manaRefund');
cards.vaultWardenCard=card('vaultWardenCard','冰庫看守者卡','vaultWarden','quickCast',3);
shopStock.gear.push(...expansionShopStock);
