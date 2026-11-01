// v4.6 exploration content: treasure chests, landmark trials (hidden elites) and repeatable bounties.
// All numbers are first-round values. Keys are stable strings so saves stay valid when content is appended.
export type ChestTier='normal'|'rare'|'trial'|'supply'|'eclipse';
/** Chest tiers that roll the regular loot table (the 星蝕寶箱 has its own reward). */
export type LootTier=Exclude<ChestTier,'eclipse'>;
/** Field maps get this many chests at once; an opened chest reappears elsewhere after `respawn` seconds. */
export const CHEST={perMap:4,respawn:180,rareChance:.12,minGap:8,mimicChance:.06};
/** Reward scale per map (roughly the middle of its level band). */
export const MAP_TIER:Record<string,number>={meadow:6,forest:16,cave:26,ruins:38,vault1:34,vault2:40,jellyHollow:12,grove:21,mistMarsh:50,emberRift:57,skyGarden:63,starCitadel:72,
  forge1:66,forge2:73,bell1:75,bell2:80,bellBay:85};
export const CHEST_POOLS:Record<string,{use:string[];food:string[]}>={
  meadow:{use:['redPotion','apple','teleportLeaf'],food:['dawnBread','starJuice']},
  forest:{use:['orangePotion','honey','teleportLeaf'],food:['dawnBread','starJuice','shroomSoup']},
  cave:{use:['orangePotion','whitePotion','bluePotion'],food:['shroomSoup','starJuice','herbTea']},
  ruins:{use:['whitePotion','bluePotion','returnFeather'],food:['herbTea','adventBento','shroomSoup']},
  mistMarsh:{use:['whitePotion','bluePotion','returnFeather'],food:['herbTea','adventBento']},
  emberRift:{use:['whitePotion','bluePotion','returnFeather'],food:['herbTea','adventBento']},
  skyGarden:{use:['whitePotion','bluePotion','returnFeather'],food:['herbTea','adventBento']},
  starCitadel:{use:['whitePotion','bluePotion','returnFeather'],food:['herbTea','adventBento']},
  jellyHollow:{use:['redPotion','orangePotion','teleportLeaf'],food:['dawnBread','starJuice']},
  grove:{use:['orangePotion','honey','bluePotion'],food:['shroomSoup','starJuice','dawnBread']},
  vault1:{use:['whitePotion','bluePotion','returnFeather'],food:['herbTea','adventBento']},
  vault2:{use:['whitePotion','bluePotion','returnFeather'],food:['herbTea','adventBento']},
  forge1:{use:['whitePotion','bluePotion'],food:['herbTea','adventBento']},forge2:{use:['whitePotion','bluePotion'],food:['herbTea','adventBento']},
  bell1:{use:['whitePotion','bluePotion'],food:['herbTea','adventBento']},bell2:{use:['whitePotion','bluePotion'],food:['herbTea','adventBento']},
  bellBay:{use:['whitePotion','bluePotion','returnFeather'],food:['herbTea','adventBento']},
};
/** v6.0 二轉 dungeon gates on existing landmarks: open once the character has its second job. */
export const JOB2_GATES:Record<string,{map:string;x:number;y:number;name:string;desc:string}>={
  'emberRift:1':{map:'forge1',x:4,y:30,name:'黑曜鍛爐',desc:'祭壇後方的熔岩退開，露出一座仍在運轉的古代鍛爐（建議 Lv.62～78，兩層地下城，BOSS「熔爐總監」，必掉星紋核心）。'},
  'skyGarden:1':{map:'bell1',x:4,y:30,name:'逆風鐘塔',desc:'鐘聲倒著響起，雲上浮現一座逆著風旋轉的高塔（建議 Lv.70～84，兩層地下城，BOSS「星鐘調律者」，必掉星紋核心）。'},
  'starCitadel:0':{map:'harbor',x:6,y:24,name:'夜航港',desc:'營地後方停著一艘星光小船。船夫說：「星界之外，還有一條熄滅的星燈航路。」（新篇章，建議 Lv.78 以上）'},
};
export type TrialDef={elite:string;minions:[string,number][];hpMul:number;atkMul:number;expMul:number;title:string;cooldown:number};
/** Landmark trials: a stronger "hidden boss" version of a local monster plus a few minions. Keyed by map:landmarkIndex. */
export const TRIALS:Record<string,TrialDef>={
  'meadow:1':{elite:'blueJelly',minions:[['jelly',4]],hpMul:14,atkMul:2.2,expMul:12,title:'晨露石環的試煉',cooldown:600},
  'forest:1':{elite:'sapling',minions:[['wolf',3]],hpMul:9,atkMul:1.7,expMul:9,title:'古樹誓約的試煉',cooldown:600},
  'cave:1':{elite:'golem',minions:[['bat',2]],hpMul:8,atkMul:1.4,expMul:8,title:'霜光封印的試煉',cooldown:600},
  'mistMarsh:1':{elite:'bogSapling',minions:[['mistBee',2]],hpMul:6,atkMul:1.25,expMul:6,title:'霧語石柱的試煉',cooldown:600},
  'emberRift:1':{elite:'magmaGolem',minions:[['flameBat',2]],hpMul:6,atkMul:1.25,expMul:6,title:'熔核祭壇的試煉',cooldown:600},
  'skyGarden:1':{elite:'angelShroom',minions:[['stormChick',2]],hpMul:6,atkMul:1.25,expMul:6,title:'天穹鐘塔的試煉',cooldown:600},
  'starCitadel:1':{elite:'astralGuard',minions:[['voidBat',2]],hpMul:6,atkMul:1.25,expMul:6,title:'王座之門的試煉',cooldown:600},
  'ruins:1':{elite:'templeGolem',minions:[['windWisp',2]],hpMul:7,atkMul:1.25,expMul:7,title:'星語祭壇的試煉',cooldown:600},
};
/** Camp supply: a small chest next to the camp, once per cooldown. */
export const SUPPLY_COOLDOWN=600;
/** Repeatable bounties from 懸賞官. */
export const BOUNTY={offers:3,minCount:15,maxCount:30,levelBelow:8,levelAbove:3};
/** v4.8 hidden areas opened by clearing a landmark trial once. Keyed by the trial landmark. */
export const SECRET_AREAS:Record<string,{map:string;x:number;y:number;name:string;desc:string}>={
  'meadow:1':{map:'jellyHollow',x:4,y:22,name:'果凍秘窟',desc:'石環中央的地面塌陷，露出一條通往地底的果凍隧道（建議 Lv.8～16）。強化果凍、【精英】與寶箱。'},
  'forest:1':{map:'grove',x:4,y:26,name:'翠影秘林',desc:'誓約石旁的藤蔓讓開了一條小徑，通往森林最深處（建議 Lv.16～26）。強化狼群、狐狸、【精英】與寶箱。'},
  'cave:1':{map:'vault1',x:4,y:28,name:'封印冰庫',desc:'封印碑後方的裂縫已經打開，寒氣從深處湧出（建議 Lv.32 以上，兩層地下城）。強化魔物、【精英】與 BOSS「冰庫看守者」，掉落永凍王冠與冰庫看守者卡。'},
};
