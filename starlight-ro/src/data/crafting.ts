// v4.7 crafting: signature gear with build traits, food cooking, and the materials that feed them.
// Appended content only (new ids); existing items keep their ids and stats. Numbers are first-round values.
import type { EquipDef, EtcDef } from './items';

export const craftMaterials:EtcDef[]=[
  {kind:'etc',id:'trialSigil',name:'試煉徽記',price:300,desc:'完成地標試煉或懸賞得到的徽記，工匠用它打造招牌裝備。',icon:{shape:'shard',color:'#c9a3ff'}},
  {kind:'etc',id:'starShard',name:'星輝碎片',price:5000,desc:'星落女神像身上剝落的星光結晶。',icon:{shape:'shard',color:'#ffe27a'}},
];
const g=(d:Omit<EquipDef,'kind'|'slots'|'icon'>&{slots?:number;icon:EquipDef['icon']}):EquipDef=>({kind:'equip',slots:1,...d});
/** Craft-only signature gear: each one bends a build in a direction (speed, sustain, follow-up damage). */
export const craftGear:EquipDef[]=[
  g({id:'windWhisperRod',name:'風語法杖',slot:'weapon',weaponType:'staff',atk:20,matk:30,cast:8,spCost:5,jobs:['mage'],reqLv:26,price:12000,refine7:{cast:3},desc:'杖身刻著風的低語。詠唱更快、也更省魔。',icon:{shape:'staff',color:'#8fe8f0',accent:'#ffffff'}}),
  g({id:'emberScepter',name:'熾焰權杖',slot:'weapon',weaponType:'staff',atk:24,matk:38,loop:15,jobs:['mage'],reqLv:32,price:25000,refine7:{loop:10},desc:'灼燒、引爆、碎冰、連鎖等追加傷害 +15%。',icon:{shape:'staff',color:'#ff7a3d',accent:'#ffd45c'}}),
  g({id:'frostCodexStaff',name:'寒晶法杖',slot:'weapon',weaponType:'staff',atk:22,matk:36,spRegen:20,loop:8,jobs:['mage'],reqLv:32,price:25000,refine7:{spRegen:15},desc:'寒氣讓魔力沉靜，SP 回復更快。',icon:{shape:'staff',color:'#9fd5ff',accent:'#ffffff'}}),
  g({id:'stormRing',name:'雷鳴指環',slot:'accessory',cast:6,loop:8,jobs:['mage'],reqLv:28,price:15000,refine7:{loop:6},desc:'指環裡封著一道不肯散去的閃電。',icon:{shape:'ring',color:'#ffe27a',accent:'#7d5bd6'}}),
  g({id:'thriftCloak',name:'節魔斗篷',slot:'garment',def:2,mdef:3,spCost:8,jobs:'all',reqLv:22,price:6000,refine7:{spCost:4},desc:'技能 SP 消耗降低。',icon:{shape:'cape',color:'#4b7fe0',accent:'#d8ffb0'}}),
  g({id:'meditationRobe',name:'冥想長袍',slot:'armor',def:3,mdef:10,sp:60,spRegen:25,jobs:['mage'],reqLv:26,price:12000,refine7:{spRegen:15},desc:'穿著它，魔力會自然湧回。',icon:{shape:'robe',color:'#e9e4ff',accent:'#7d5bd6'}}),
  g({id:'galeEdge',name:'疾風之刃',slot:'weapon',weaponType:'sword',atk:92,aspd:8,crit:5,jobs:['swordman'],reqLv:28,price:15000,refine7:{aspd:4},desc:'輕盈的劍，揮得更快。',icon:{shape:'sword',color:'#8fe8f0',accent:'#ffffff'}}),
  g({id:'falconBow',name:'獵鷹長弓',slot:'weapon',weaponType:'bow',atk:82,delay:10,crit:6,jobs:['archer'],reqLv:28,price:15000,refine7:{delay:5},desc:'技能收招更快的長弓。',icon:{shape:'bow',color:'#c9a46b',accent:'#ffffff'}}),
  g({id:'recoveryBoots',name:'收招之靴',slot:'shoes',def:2,delay:10,jobs:'all',reqLv:24,price:8000,refine7:{delay:4},desc:'技能施放後延遲 −10%。',icon:{shape:'shoes',color:'#7fd7ff'}}),
  g({id:'trialBadge',name:'試煉者徽章',slot:'accessory',hp:80,skill:6,jobs:'all',reqLv:20,price:10000,refine7:{skill:4},desc:'通過試煉的證明。技能傷害 +6%。',icon:{shape:'ring',color:'#c9a3ff',accent:'#ffd45c'}}),
  g({id:'heartwoodPendant',name:'古樹之心墜飾',slot:'accessory',hp:150,spRegen:15,skill:4,jobs:'all',reqLv:30,price:30000,refine7:{spRegen:10},desc:'古樹守護者的祝福。生命、魔力回復與技能傷害兼具。',icon:{shape:'ring',color:'#6fcf6f',accent:'#8b5a36'}}),
  g({id:'starfallDiadem',name:'星落頭冠',slot:'head',def:3,mdef:8,cast:5,skill:6,loop:6,jobs:'all',reqLv:40,price:60000,refine7:{skill:4},desc:'星落女神像的星輝凝成的頭冠。',icon:{shape:'crown',color:'#ffe27a',accent:'#7fd7ff'}}),
];
/** v4.8 dungeon boss gear (drop only). */
export const dungeonGear:EquipDef[]=[
  g({id:'vaultCrown',name:'永凍王冠',slot:'head',def:4,mdef:10,hp:100,cast:4,spCost:5,jobs:'all',reqLv:36,price:40000,refine7:{cast:3},special:'封印冰庫的看守者所戴的王冠。',desc:'詠唱 −4%、SP 消耗 −5%。只會從冰庫看守者身上掉落。',icon:{shape:'crown',color:'#9fd5ff',accent:'#ffffff'}}),
];
/** Existing signature items get a +7 bonus that deepens what they already do. */
export const signatureRefine:Record<string,{bonus:EquipDef['refine7'];special?:string}>={
  hourglass:{bonus:{cast:3},special:'時之迴響：施放技能後 3 秒內，下一次詠唱再快 30%。'},
  starRod:{bonus:{loop:6}},sorcererRobe:{bonus:{spCost:5}},timeCloak:{bonus:{delay:4}},meteorSword:{bonus:{crit:4}},
  galeBow:{bonus:{aspd:4}},featherBoots:{bonus:{delay:4}},galeCape:{bonus:{aspd:3}},mageEarring:{bonus:{cast:2}},sageGlasses:{bonus:{cast:2}},
  clover:{bonus:{crit:3}},guardRing:{bonus:{hp:100}},warBand:{bonus:{crit:3}},
};
export type Recipe={id:string;out:string;count:number;kind:'gear'|'food';mats:Record<string,number>;zeny:number};
export const recipes:Recipe[]=[
  {id:'r_windWhisperRod',out:'windWhisperRod',count:1,kind:'gear',mats:{spiritDust:8,woodChip:10,trialSigil:2},zeny:12000},
  {id:'r_emberScepter',out:'emberScepter',count:1,kind:'gear',mats:{foxTail:10,ancientBark:1,trialSigil:3},zeny:25000},
  {id:'r_frostCodexStaff',out:'frostCodexStaff',count:1,kind:'gear',mats:{iceShard:12,frozenHeart:1,trialSigil:3},zeny:25000},
  {id:'r_stormRing',out:'stormRing',count:1,kind:'gear',mats:{spiritDust:6,stoneCore:4,trialSigil:2},zeny:15000},
  {id:'r_thriftCloak',out:'thriftCloak',count:1,kind:'gear',mats:{softSilk:15,feather:10,trialSigil:1},zeny:6000},
  {id:'r_meditationRobe',out:'meditationRobe',count:1,kind:'gear',mats:{snowFur:8,softSilk:10,trialSigil:2},zeny:12000},
  {id:'r_galeEdge',out:'galeEdge',count:1,kind:'gear',mats:{wolfFang:12,stoneCore:4,trialSigil:2},zeny:15000},
  {id:'r_falconBow',out:'falconBow',count:1,kind:'gear',mats:{feather:15,woodChip:10,trialSigil:2},zeny:15000},
  {id:'r_recoveryBoots',out:'recoveryBoots',count:1,kind:'gear',mats:{foxTail:6,snowFur:4,trialSigil:1},zeny:8000},
  {id:'r_trialBadge',out:'trialBadge',count:1,kind:'gear',mats:{trialSigil:5},zeny:10000},
  {id:'r_heartwoodPendant',out:'heartwoodPendant',count:1,kind:'gear',mats:{ancientBark:2,royalJelly:2,trialSigil:4},zeny:30000},
  {id:'r_starfallDiadem',out:'starfallDiadem',count:1,kind:'gear',mats:{starShard:1,frozenHeart:1,trialSigil:6},zeny:60000},
  // cooking: turns everyday drops into the v4.5 foods
  {id:'c_dawnBread',out:'dawnBread',count:3,kind:'food',mats:{apple:3,jellyGoo:2},zeny:20},
  {id:'c_shroomSoup',out:'shroomSoup',count:2,kind:'food',mats:{sporeCap:4,apple:1},zeny:280},
  {id:'c_starJuice',out:'starJuice',count:2,kind:'food',mats:{apple:2,spiritDust:1},zeny:190},
  {id:'c_herbTea',out:'herbTea',count:2,kind:'food',mats:{spiritDust:3,honey:1},zeny:520},
  {id:'c_adventBento',out:'adventBento',count:1,kind:'food',mats:{apple:2,feather:4,honey:1},zeny:620},
];
// v6.0 二轉 style weapons and build gear (前線工匠 諾亞).
import { ascensionRecipes } from './ascension-items';
recipes.push(...ascensionRecipes);
