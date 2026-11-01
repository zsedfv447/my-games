// v5.0 星界遠征 items: region materials, the Lv.50–75 gear tier and the new monster cards. Appended ids only.
import type { EquipDef, EtcDef } from './items';
export const expeditionMaterials:EtcDef[]=[
  {kind:'etc',id:'bogMoss',name:'沼澤苔',price:300,desc:'霧語沼澤的濕苔，帶著淡淡的霧氣。',icon:{shape:'leaf',color:'#6a8a4a'}},
  {kind:'etc',id:'magmaCore',name:'熔岩核',price:380,desc:'仍在發燙的熔岩結晶。',icon:{shape:'stone',color:'#ff6a2a'}},
  {kind:'etc',id:'cloudFluff',name:'雲絮',price:440,desc:'輕得幾乎抓不住的雲朵碎片。',icon:{shape:'fur',color:'#f4f8ff'}},
  {kind:'etc',id:'starFragment',name:'星屑',price:600,desc:'流星雨留下的星屑，閃著微光。可以賣個好價錢。',icon:{shape:'shard',color:'#ffe27a'}},
  {kind:'etc',id:'astralShard',name:'星界碎片',price:600,desc:'星界城塞的牆上剝落的星光。',icon:{shape:'shard',color:'#c9a3ff'}},
];
const g=(d:Omit<EquipDef,'kind'|'slots'>&{slots?:number}):EquipDef=>({kind:'equip',slots:1,...d});
export const expeditionGear:EquipDef[]=[
  // 前線商店（Lv.50）
  g({id:'frostStarStaff',name:'霜星法杖',slot:'weapon',weaponType:'staff',atk:30,matk:55,cast:6,jobs:['mage'],reqLv:50,price:60000,desc:'前哨工坊的標準法杖。',icon:{shape:'staff',color:'#9fd5ff',accent:'#ffd45c'}}),
  g({id:'mithrilSword',name:'秘銀長劍',slot:'weapon',weaponType:'sword',atk:140,crit:5,jobs:['swordman'],reqLv:50,price:60000,desc:'輕而鋒利的秘銀劍。',icon:{shape:'sword',color:'#dfe8f0',accent:'#9fd5ff'}}),
  g({id:'stormBow',name:'風暴長弓',slot:'weapon',weaponType:'bow',atk:125,aspd:6,jobs:['archer'],reqLv:50,price:60000,desc:'弓弦帶著風聲。',icon:{shape:'bow',color:'#8ab8e8',accent:'#ffffff'}}),
  g({id:'expeditionPlate',name:'遠征鎧甲',slot:'armor',def:9,hp:300,jobs:['swordman','archer'],reqLv:50,price:45000,desc:'前線士兵的鎧甲。',icon:{shape:'armor',color:'#a8b4c0',accent:'#ffd45c'}}),
  g({id:'starweaveRobe',name:'星紋長袍',slot:'armor',def:5,mdef:18,sp:150,cast:4,jobs:['mage'],reqLv:50,price:45000,desc:'織入星紋的長袍。',icon:{shape:'robe',color:'#3a3a8a',accent:'#ffd45c'}}),
  g({id:'rangerLeather',name:'獵手皮甲',slot:'armor',def:7,hp:150,aspd:4,jobs:['archer'],reqLv:52,price:45000,desc:'輕巧的皮甲。',icon:{shape:'armor',color:'#8a6a4a'}}),
  g({id:'voyagerRing',name:'遠征者戒指',slot:'accessory',hp:250,sp:80,spRegen:15,jobs:'all',reqLv:55,price:50000,desc:'遠征隊員的護身戒指。',icon:{shape:'ring',color:'#c9a46b',accent:'#9fd5ff'}}),
  // 掉落 / MVP（Lv.58–75）
  g({id:'magmaBoots',name:'熔岩靴',slot:'shoes',def:5,hp:200,delay:6,jobs:'all',reqLv:58,price:40000,desc:'踩過熔岩也不會燙。',icon:{shape:'shoes',color:'#c03a2a',accent:'#ffb050'}}),
  g({id:'skyCloak',name:'天空披風',slot:'garment',def:4,mdef:8,delay:6,spCost:4,jobs:'all',reqLv:60,price:45000,desc:'像雲一樣輕的披風。',icon:{shape:'cape',color:'#bfe4ff',accent:'#ffffff'}}),
  g({id:'magmaBlade',name:'熔岩大劍',slot:'weapon',weaponType:'sword',atk:170,aspd:6,skill:4,jobs:['swordman'],reqLv:62,price:90000,refine7:{aspd:4},desc:'劍身流著熔岩。',icon:{shape:'sword',color:'#ff6a2a',accent:'#ffd080'}}),
  g({id:'skyStaff',name:'天穹法杖',slot:'weapon',weaponType:'staff',atk:36,matk:68,cast:8,loop:8,jobs:['mage'],reqLv:62,price:90000,refine7:{cast:3},desc:'杖頂飄著一朵小雲。',icon:{shape:'staff',color:'#bfe4ff',accent:'#ffffff'}}),
  g({id:'skyBow',name:'天穹長弓',slot:'weapon',weaponType:'bow',atk:155,delay:8,crit:6,jobs:['archer'],reqLv:62,price:90000,refine7:{delay:4},desc:'射出的箭像流星。',icon:{shape:'bow',color:'#bfe4ff',accent:'#ffd45c'}}),
  g({id:'astralCirclet',name:'星界頭環',slot:'head',def:4,mdef:12,cast:6,skill:5,jobs:'all',reqLv:68,price:80000,desc:'星界守衛額上的頭環。',icon:{shape:'crown',color:'#c9a3ff',accent:'#ffd45c'}}),
  g({id:'astralScepter',name:'星界權杖',slot:'weapon',weaponType:'staff',atk:44,matk:85,cast:10,skill:8,jobs:['mage'],reqLv:74,price:150000,slots:2,refine7:{skill:4},special:'星界君主的權杖。',desc:'星界君主的權杖。',icon:{shape:'staff',color:'#1a1040',accent:'#ffd45c'}}),
  g({id:'astralBlade',name:'星界之刃',slot:'weapon',weaponType:'sword',atk:210,crit:10,skill:6,jobs:['swordman'],reqLv:74,price:150000,slots:2,refine7:{crit:4},special:'星界君主的佩劍。',desc:'星界君主的佩劍。',icon:{shape:'sword',color:'#c9a3ff',accent:'#ffd45c'}}),
  g({id:'astralBow',name:'星界弓',slot:'weapon',weaponType:'bow',atk:190,aspd:10,skill:6,jobs:['archer'],reqLv:74,price:150000,slots:2,refine7:{aspd:4},special:'星界君主的長弓。',desc:'星界君主的長弓。',icon:{shape:'bow',color:'#8a7ae8',accent:'#ffd45c'}}),
  g({id:'astralRing',name:'星界指環',slot:'accessory',skill:8,loop:8,cast:5,hp:200,jobs:'all',reqLv:72,price:150000,refine7:{skill:4},special:'星界君主的指環。',desc:'戴上後能聽見星星的聲音。',icon:{shape:'ring',color:'#c9a3ff',accent:'#ffd45c'}}),
];
export const frontierStock=['frostStarStaff','mithrilSword','stormBow','expeditionPlate','starweaveRobe','rangerLeather','voyagerRing','whitePotion','bluePotion','herbTea','adventBento','returnFeather'];
/** Cards: module picked to suit each monster; bosses (maxLevel 3) carry the strongest modules. */
export const expeditionCards:[string,string,string,string,number][]=[
  ['marshJellyCard','沼澤泥怪卡','marshJelly','venom',5],['mistBeeCard','毒霧蜂卡','mistBee','fatal',5],['bogSaplingCard','枯木妖卡','bogSapling','regrowth',5],['bogWolfCard','沼澤狼卡','bogWolf','chain',5],['mistQueenCard','霧之女王卡','mistQueen','delayCut',3],
  ['magmaJellyCard','熔岩果凍卡','magmaJelly','spSaver',5],['flameBatCard','火焰蝙蝠卡','flameBat','keen',5],['magmaGolemCard','熔岩魔像卡','magmaGolem','quake',5],['blazeFoxCard','烈焰狐卡','blazeFox','amplify',5],['lavaColossusCard','熔岩巨像卡','lavaColossus','echo',3],
  ['cloudBunnyCard','雲朵兔卡','cloudBunny','feather',5],['stormChickCard','風暴雛鷹卡','stormChick','delayCut',5],['angelShroomCard','天使菇卡','angelShroom','leech',5],['skyWispCard','天空精靈卡','skyWisp','quickCast',5],['skyKingCard','天空之王卡','skyKing','starfall',3],
  ['astralGuardCard','星界守衛卡','astralGuard','pierce',5],['voidBatCard','虛空蝙蝠卡','voidBat','keen',5],['starFoxCard','星塵狐卡','starFox','fatal',5],['astralWispCard','星界精靈卡','astralWisp','manaRefund',5],['astralLordCard','星界君主卡','astralLord','quickCast',3],
];
