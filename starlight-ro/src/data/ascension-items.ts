// v6.0 二轉・星燈航路 items: second-job weapons (each one changes how a skill plays), build gear, materials.
// Appended ids only. Numbers are first-round values.
import type { EquipDef, EtcDef } from './items';
import type { Recipe } from './crafting';
import { ASPECT_TEXT, UNIQUE_TEXT, type AspectFx, type UniqueFx } from './starfall';

/** Gear mechanics read by the simulation (Derived.gearFx). */
export type GearFx=AspectFx|UniqueFx|'stoneheart'|'infernal'|'thornsPlus'|'blaze'|'chain4'|'thorns'|'breaker'|'bulwark'|'gale'|'ember'|'mirror'|'storm'|'farsight'|'cyclone'|'binding'|'shieldUp'|'zoneTime'|'preyTime';
export const GEAR_FX:Record<GearFx,string>={
  ...ASPECT_TEXT,...UNIQUE_TEXT,
  blaze:'烈焰附刃中，有 15% 機率連砍兩下；順劈改成每 2 下一次（烈焰之魂本來就是每 2 下）。戰技之魂、烈焰之魂都能用。',
  stoneheart:'鐵壁意志（磐石架勢）期間，你正在打的魔物就算沒打你，每 0.5 秒也會被反擊一次（反擊傷害 120%，吃不屈鎧甲、荊棘徽章加成）。任何戰魂都有效。',
  infernal:'包含熾焰長劍的效果；另外順劈範圍 +0.6 格，順劈時主目標多受一次 40% 火焰傷害。',
  thornsPlus:'反擊傷害 ×1.3；每次反擊回復造成傷害 10% 的 HP（最多最大 HP 3%）。',
  chain4:'連環重斬、焰影追斬、撼地斬都多砍 1 刀。',
  thorns:'施放鐵壁意志後，接下來被打的 3 次會反擊攻擊者；磐石之魂下改為反擊傷害 ×1.3。',
  breaker:'裂星重斬／星落裁決消耗 3 層以上戰意時，再追加一道 80% 的橫向震波。',
  bulwark:'守誓護壁的護盾 +25%，反擊光刃會同時打中攻擊者附近最多 3 隻敵人。',
  gale:'取得戰意時有 25% 機率多取得 1 層。',
  ember:'帶灼燒的敵人倒下時，把 2 層灼燒傳給附近最多 3 隻敵人。',
  mirror:'碎冰的追加傷害 ×1.4。',
  storm:'雷鳴矢每 3 次命中就落雷（原本 4 次）。',
  farsight:'穿星狙擊打中獵物時必定爆擊。',
  cyclone:'追風連射 +2 箭。',
  binding:'束光陷阱上限 +1、持續 30 秒，但每個陷阱傷害 ×0.9。',
  shieldUp:'自己技能產生的護盾 +10%。',
  zoneTime:'火場、冰場、星樁、戰陣持續時間 +1 秒。',
  preyTime:'獵物標記持續時間 +4 秒。',
};
export const ascensionMaterials:EtcDef[]=[
  {kind:'etc',id:'oathCore',name:'星紋核心',price:1500,desc:'二轉地下城的首領身上一定找得到的核心。工匠用它打造流派武器。',icon:{shape:'shard',color:'#ffd45c'}},
  {kind:'etc',id:'forgeSand',name:'鍛晶砂',price:700,desc:'黑曜鍛爐裡燒出來的晶砂。',icon:{shape:'stone',color:'#ff8a3d'}},
  {kind:'etc',id:'bellSilk',name:'鐘羽絲',price:760,desc:'逆風鐘塔的鈴翼蜂吐出的絲，會發出細細的鈴聲。',icon:{shape:'fur',color:'#e8f4ff'}},
  {kind:'etc',id:'tideGlass',name:'潮音玻璃',price:900,desc:'貝露灣的海浪磨成的玻璃，貼在耳邊能聽見歌聲。',icon:{shape:'shard',color:'#7fd7ff'}},
  {kind:'etc',id:'lampWick',name:'星燈燈芯',price:200,desc:'燈殼蝙蝠翅膀上掛著的燈芯。燈塔技師芮比正在收集。',icon:{shape:'leaf',color:'#ffe27a'}},
];
const g=(d:Omit<EquipDef,'kind'|'slots'>&{slots?:number}):EquipDef=>({kind:'equip',slots:1,...d});
export const ascensionGear:EquipDef[]=[
  // v6.2 劍士流派裝（一轉就能用）：附刃順劈／連斬／鐵壁反彈
  g({id:'blazeSword',name:'熾焰長劍',slot:'weapon',weaponType:'sword',atk:108,fx:'blaze',jobs:['swordman'],reqLv:36,price:30000,refine7:{aspd:4},desc:'劍身一直在燃燒。烈焰之魂愛用的劍。',icon:{shape:'sword',color:'#ff7a3d',accent:'#ffd45c'}}),
  g({id:'chainBracer',name:'連斬護腕',slot:'accessory',stats:{str:2},crit:3,sp:60,fx:'chain4',jobs:['swordman'],reqLv:30,price:20000,desc:'手腕一扭，多砍一刀。',icon:{shape:'ring',color:'#c9d3dd',accent:'#d9534f'}}),
  g({id:'thornBadge',name:'荊棘徽章',slot:'accessory',hp:250,stats:{vit:3},fx:'thornsPlus',jobs:['swordman'],reqLv:40,price:30000,desc:'磐石之魂愛用的徽章，反擊也能回血。',icon:{shape:'ring',color:'#5a8a4a',accent:'#d9534f'}}),
  g({id:'unyieldingPlate',name:'不屈鎧甲',slot:'armor',def:9,hp:220,fx:'thorns',jobs:['swordman'],reqLv:34,price:25000,desc:'鐵壁一派的鎧甲，敵人打得越兇自己越痛。',icon:{shape:'armor',color:'#8a8a9a',accent:'#d9534f'}}),
  g({id:'stoneGreatsword',name:'磐岩大劍',slot:'weapon',weaponType:'sword',atk:118,hp:150,fx:'stoneheart',jobs:['swordman'],reqLv:40,price:32000,slots:1,desc:'沉得像一塊岩壁。磐石之魂愛用的單挑武器。',icon:{shape:'sword',color:'#8a8070',accent:'#9ad08a'}}),
  g({id:'quakeBlade',name:'撼岳巨劍',slot:'weapon',weaponType:'sword',atk:172,hp:300,fx:'stoneheart',jobs:['swordman'],reqLv:62,price:100000,slots:2,refine7:{hp:400},desc:'熔岩魔像的核心鍛成的巨劍，越挨打越穩。',icon:{shape:'sword',color:'#6a5a4a',accent:'#ff8a3a'}}),
  g({id:'infernoBlade',name:'煉獄大劍',slot:'weapon',weaponType:'sword',atk:176,crit:4,fx:'infernal',jobs:['swordman'],reqLv:62,price:100000,slots:2,refine7:{aspd:4},special:'熔岩巨像體內鍛出的大劍。',desc:'熔岩巨像體內鍛出的大劍，順劈又寬又燙。',icon:{shape:'sword',color:'#c03a10',accent:'#ffb050'}}),
  // 轉職儀式送的武器（Lv.60）：沒打到好武器時的保底，不會比星界裝強。
  g({id:'oathSword',name:'曙光誓劍',slot:'weapon',weaponType:'sword',atk:150,hp:100,jobs:['knight'],reqLv:60,price:30000,desc:'轉職儀式上，轉職官葛蘭親手交給你的劍。',icon:{shape:'sword',color:'#ffe9a8',accent:'#e8a33a'}}),
  g({id:'starlitStaff',name:'星紋學杖',slot:'weapon',weaponType:'staff',atk:30,matk:58,cast:5,jobs:['wizard'],reqLv:60,price:30000,desc:'刻著星紋的學徒法杖。',icon:{shape:'staff',color:'#5b7dd6',accent:'#ffe9a8'}}),
  g({id:'skywardBow',name:'巡星短弓',slot:'weapon',weaponType:'bow',atk:135,stats:{dex:2},delay:4,jobs:['ranger'],reqLv:60,price:30000,desc:'遊俠的第一把弓。',icon:{shape:'bow',color:'#2fa08a',accent:'#ffe9a8'}}),
  // 流派武器（Lv.75）：基礎數值刻意不一定比星界裝高，換來改變打法的效果。
  g({id:'dawnbreaker',name:'曙光破城劍',slot:'weapon',weaponType:'sword',atk:195,delay:4,fx:'breaker',jobs:['knight'],reqLv:75,price:120000,desc:'破城一派的劍。',icon:{shape:'sword',color:'#ffd45c',accent:'#ff7a3d'}}),
  g({id:'bulwarkSword',name:'磐星守誓劍',slot:'weapon',weaponType:'sword',atk:182,hp:250,fx:'bulwark',jobs:['knight'],reqLv:75,price:120000,desc:'守誓一派的劍。',icon:{shape:'sword',color:'#9fd5ff',accent:'#ffd45c'}}),
  g({id:'galeSaber',name:'巡風軍刀',slot:'weapon',weaponType:'sword',atk:178,aspd:12,fx:'gale',jobs:['knight'],reqLv:75,price:120000,desc:'快攻一派的軍刀。',icon:{shape:'sword',color:'#8fe8f0',accent:'#ffffff'}}),
  g({id:'emberRingStaff',name:'燼環權杖',slot:'weapon',weaponType:'staff',atk:36,matk:72,sp:60,fx:'ember',jobs:['wizard'],reqLv:75,price:120000,desc:'火焰會沿著倒下的敵人蔓延。',icon:{shape:'staff',color:'#ff7a3d',accent:'#ffd45c'}}),
  g({id:'mirrorSnowStaff',name:'鏡雪晶杖',slot:'weapon',weaponType:'staff',atk:36,matk:70,spRegen:20,fx:'mirror',jobs:['wizard'],reqLv:75,price:120000,desc:'碎冰時像鏡子一樣炸開。',icon:{shape:'staff',color:'#cff0ff',accent:'#7fd0ff'}}),
  g({id:'stormRingStaff',name:'引雷導環杖',slot:'weapon',weaponType:'staff',atk:36,matk:68,cast:8,fx:'storm',jobs:['wizard'],reqLv:75,price:120000,desc:'杖頂的導環會把雷引下來。',icon:{shape:'staff',color:'#ffe27a',accent:'#5b7dd6'}}),
  g({id:'farsightBow',name:'遠望獵弓',slot:'weapon',weaponType:'bow',atk:182,stats:{dex:3},cast:6,fx:'farsight',jobs:['ranger'],reqLv:75,price:120000,desc:'狙擊一派的長弓。',icon:{shape:'bow',color:'#c9a46b',accent:'#ffd45c'}}),
  g({id:'cycloneBow',name:'回風連弓',slot:'weapon',weaponType:'bow',atk:174,aspd:10,fx:'cyclone',jobs:['ranger'],reqLv:75,price:120000,desc:'連射一派的弓。',icon:{shape:'bow',color:'#8fe8f0',accent:'#2fa08a'}}),
  g({id:'bindingBow',name:'縛星獵弓',slot:'weapon',weaponType:'bow',atk:170,sp:80,fx:'binding',jobs:['ranger'],reqLv:75,price:120000,desc:'陷阱一派的弓。',icon:{shape:'bow',color:'#c9a3ff',accent:'#ffd45c'}}),
  // 配裝（Lv.80～86）
  g({id:'ironFeatherCape',name:'鐵羽披肩',slot:'garment',def:5,mdef:6,hp:180,fx:'shieldUp',jobs:'all',reqLv:80,price:70000,desc:'羽毛裡織著鐵線。',icon:{shape:'cape',color:'#a8b4c0',accent:'#ffd45c'}}),
  g({id:'steadyBoots',name:'穩步戰靴',slot:'shoes',def:6,hp:150,delay:5,jobs:'all',reqLv:80,price:70000,desc:'踩得穩，收招也快。',icon:{shape:'shoes',color:'#8a6a4a',accent:'#ffd45c'}}),
  g({id:'emberRobe',name:'餘燼法袍',slot:'armor',def:5,mdef:16,sp:100,spCost:5,cast:4,jobs:['mage'],reqLv:84,price:90000,desc:'衣角還留著火場的餘溫。',icon:{shape:'robe',color:'#8a2a2a',accent:'#ffb04a'}}),
  g({id:'starCirclet',name:'聚星頭環',slot:'head',def:4,mdef:8,cast:5,fx:'zoneTime',jobs:'all',reqLv:84,price:90000,desc:'讓布下的陣維持得更久。',icon:{shape:'crown',color:'#5b7dd6',accent:'#ffe9a8'}}),
  g({id:'galeVest',name:'巡風輕衣',slot:'armor',def:7,hp:180,aspd:5,jobs:['swordman','archer'],reqLv:84,price:90000,desc:'輕到像沒穿一樣。',icon:{shape:'armor',color:'#8fe8f0',accent:'#ffffff'}}),
  g({id:'huntRing',name:'逐星指環',slot:'accessory',sp:80,skill:4,fx:'preyTime',jobs:'all',reqLv:86,price:100000,desc:'獵人代代相傳的指環。',icon:{shape:'ring',color:'#2fa08a',accent:'#ffd45c'}}),
];
/** 前線工匠 諾亞: style weapons are craftable so bad luck never blocks a build. */
export const ascensionRecipes:Recipe[]=[
  {id:'r_blazeSword',out:'blazeSword',count:1,kind:'gear',mats:{trialSigil:4,foxTail:10,stoneCore:4},zeny:30000},
  {id:'r_chainBracer',out:'chainBracer',count:1,kind:'gear',mats:{trialSigil:3,wolfFang:10,softSilk:8},zeny:20000},
  {id:'r_thornBadge',out:'thornBadge',count:1,kind:'gear',mats:{trialSigil:5,stoneCore:8,woodChip:12},zeny:35000},
  {id:'r_stoneGreatsword',out:'stoneGreatsword',count:1,kind:'gear',mats:{trialSigil:5,stoneCore:10,wolfFang:8},zeny:32000},
  {id:'r_quakeBlade',out:'quakeBlade',count:1,kind:'gear',mats:{trialSigil:6,magmaCore:8,stoneCore:12},zeny:90000},
  {id:'r_unyieldingPlate',out:'unyieldingPlate',count:1,kind:'gear',mats:{trialSigil:4,stoneCore:6,wolfFang:6},zeny:25000},
  ...['dawnbreaker','bulwarkSword','galeSaber'].map(out=>({id:`r_${out}`,out,count:1,kind:'gear' as const,mats:{oathCore:6,forgeSand:12,magmaCore:4},zeny:80000})),
  ...['emberRingStaff','mirrorSnowStaff','stormRingStaff'].map(out=>({id:`r_${out}`,out,count:1,kind:'gear' as const,mats:{oathCore:6,bellSilk:12,cloudFluff:4},zeny:80000})),
  ...['farsightBow','cycloneBow','bindingBow'].map(out=>({id:`r_${out}`,out,count:1,kind:'gear' as const,mats:{oathCore:6,forgeSand:6,bellSilk:6,astralShard:3},zeny:80000})),
  {id:'r_ironFeatherCape',out:'ironFeatherCape',count:1,kind:'gear',mats:{oathCore:3,forgeSand:10,trialSigil:4},zeny:50000},
  {id:'r_starCirclet',out:'starCirclet',count:1,kind:'gear',mats:{oathCore:3,bellSilk:10,trialSigil:4},zeny:60000},
  {id:'r_huntRing',out:'huntRing',count:1,kind:'gear',mats:{oathCore:3,tideGlass:10,trialSigil:4},zeny:70000},
];
/** v6.0 cards: each new module pushes one second-job style. [id,name,monster,module,maxLevel] */
export const ascensionCards:[string,string,string,string,number][]=[
  ['cinderJellyCard','煤芯果凍卡','cinderJelly','emberEcho',5],['ashBatCard','灰羽蝙蝠卡','ashBat','preyHunt',5],['shellGolemCard','熔殼魔像卡','shellGolem','starBlade',5],
  ['forgeWispCard','鍛爐精靈卡','forgeWisp','tideGuard',5],['forgeMasterCard','熔爐總監卡','forgeMaster','starBlade',3],
  ['beatSpriteCard','斷拍妖精卡','beatSprite','thunderReturn',5],['galeChickCard','逆風雛鳥卡','galeChick','keen',5],['bellBeeCard','鈴翼蜂卡','bellBee','preyHunt',5],
  ['cogGolemCard','齒輪魔像卡','cogGolem','pierce',5],['bellTunerCard','星鐘調律者卡','bellTuner','thunderReturn',3],
  ['bubbleJellyCard','潮泡果凍卡','bubbleJelly','tideGuard',5],['lampBatCard','燈殼蝙蝠卡','lampBat','split',5],['saltWormCard','海鹽幼蟲卡','saltWorm','frostLinger',5],
  ['tideWispCard','浪歌精靈卡','tideWisp','quickCast',5],['tideQueenCard','潮歌貝后卡','tideQueen','frostLinger',3],
];
