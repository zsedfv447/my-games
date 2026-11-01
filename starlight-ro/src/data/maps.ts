import {expansionVariants} from './expansion-roster';
// Map metadata. Layouts are generated deterministically from `seed` in world/mapgen.ts.
export type Theme = 'town'|'meadow'|'forest'|'cave'|'ruins';
export type NpcKind = 'job'|'tool'|'gear'|'card'|'service'|'guide'|'refine'|'pet'|'stylist'|'bounty'|'craft';
export type NpcDef = { id:string; name:string; kind:NpcKind; x:number; y:number; look:{hair:string;outfit:string;hat?:string} };
export type WarpDef = { x:number; y:number; to:string; tx:number; ty:number };
export type SpawnDef = { monster:string; count:number; area?:{x:number;y:number;w:number;h:number};
  /** v4.8 dungeon scaling for this spawn group; `elite` adds the 【精英】 prefix. */
  boost?:{hp:number;atk:number;exp:number;elite?:boolean} };
export type MapDef = {
  id:string; name:string; theme:Theme; w:number; h:number; seed:number; levelHint:string;
  /** v5.0 look variant: same terrain generator as `theme`, different sky/fog/light and ground colours. */
  variant?:'frontier'|'swamp'|'lava'|'sky'|'astral'|'forge'|'bell'|'harbor'|'bay';
  spawns:SpawnDef[]; warps:WarpDef[]; npcs:NpcDef[]; start:{x:number;y:number};
};
export const maps: Record<string,MapDef> = {
  town:{id:'town',name:'晨光鎮',theme:'town',w:48,h:48,seed:11,levelHint:'安全區',start:{x:24,y:30},
    spawns:[],
    warps:[{x:46,y:24,to:'meadow',tx:4,ty:36}],
    npcs:[
      {id:'guide',name:'嚮導 莉莉',kind:'guide',x:27,y:30,look:{hair:'#f2c14e',outfit:'#5aa0e0'}},
      {id:'craft',name:'工匠 蘇菲',kind:'craft',x:34,y:27,look:{hair:'#c97a3a',outfit:'#5a6a7a',hat:'#8a5a3a'}},
      {id:'bounty',name:'懸賞官 雷克斯',kind:'bounty',x:22,y:33,look:{hair:'#3a3a3a',outfit:'#8a3a3a',hat:'#d9a441'}},
      {id:'job',name:'轉職官 葛蘭',kind:'job',x:20,y:19,look:{hair:'#6b4a3a',outfit:'#3d4f7a',hat:'#d9a441'}},
      {id:'tool',name:'道具商 波妮',kind:'tool',x:30,y:19,look:{hair:'#e8805a',outfit:'#6fae5a'}},
      {id:'gear',name:'武器防具商 鐵叔',kind:'gear',x:17,y:26,look:{hair:'#8a8a8a',outfit:'#8a5a3a'}},
      {id:'card',name:'卡片研究員 米亞',kind:'card',x:31,y:27,look:{hair:'#b07ad9',outfit:'#3a3550',hat:'#7d5bd6'}},
      {id:'service',name:'星語服務員',kind:'service',x:37,y:24,look:{hair:'#3a2a2a',outfit:'#e85a7a',hat:'#ffffff'}},
      {id:'refine',name:'精煉師 布魯',kind:'refine',x:18,y:30,look:{hair:'#c9c9c9',outfit:'#5a4a3a',hat:'#8a5a3a'}},
      {id:'pet',name:'寵物商人 咪咪',kind:'pet',x:33,y:31,look:{hair:'#ff9ec4',outfit:'#ffd45c'}},
      {id:'stylist',name:'造型師 露娜',kind:'stylist',x:14,y:21,look:{hair:'#b07ad9',outfit:'#3a3a5a',hat:'#ff6b9a'}},
    ]},
  meadow:{id:'meadow',name:'晨光草原',theme:'meadow',w:72,h:72,seed:23,levelHint:'Lv.1～12',start:{x:4,y:36},
    spawns:[
      {monster:'jelly',count:16,area:{x:6,y:6,w:34,h:60}},
      {monster:'worm',count:10,area:{x:14,y:6,w:40,h:60}},
      {monster:'shroom',count:9,area:{x:30,y:6,w:36,h:60}},
      {monster:'chick',count:9,area:{x:40,y:6,w:28,h:60}},
      {monster:'blueJelly',count:7,area:{x:10,y:6,w:36,h:60}},
      {monster:'jellyKing',count:1,area:{x:52,y:6,w:14,h:14}},
    ],
    warps:[{x:1,y:36,to:'town',tx:44,ty:24},{x:70,y:36,to:'forest',tx:4,ty:36}],npcs:[]},
  forest:{id:'forest',name:'翠影森林',theme:'forest',w:72,h:72,seed:37,levelHint:'Lv.10～22',start:{x:4,y:36},
    spawns:[
      {monster:'bee',count:12,area:{x:6,y:6,w:40,h:60}},
      {monster:'wolf',count:12,area:{x:20,y:6,w:46,h:60}},
      {monster:'sapling',count:10,area:{x:30,y:6,w:36,h:60}},
      {monster:'wisp',count:7,area:{x:10,y:6,w:50,h:60}},
      {monster:'fox',count:7,area:{x:30,y:6,w:36,h:44}},
      {monster:'forestLord',count:1,area:{x:50,y:52,w:16,h:14}},
    ],
    warps:[{x:1,y:36,to:'meadow',tx:67,ty:36},{x:70,y:36,to:'cave',tx:4,ty:32}],npcs:[]},
  cave:{id:'cave',name:'寒晶洞窟',theme:'cave',w:64,h:64,seed:53,levelHint:'Lv.18～35',start:{x:4,y:32},
    spawns:[
      {monster:'bat',count:12,area:{x:8,y:6,w:50,h:52}},
      {monster:'bunny',count:10,area:{x:8,y:6,w:50,h:52}},
      {monster:'golem',count:9,area:{x:24,y:6,w:34,h:52}},
      {monster:'iceFox',count:7,area:{x:14,y:6,w:44,h:52}},
      {monster:'clockWisp',count:5,area:{x:20,y:30,w:36,h:28}},
      {monster:'iceColossus',count:1,area:{x:46,y:8,w:12,h:12}},
    ],
    warps:[{x:1,y:32,to:'forest',tx:67,ty:36},{x:62,y:32,to:'ruins',tx:4,ty:36}],npcs:[]},
  ruins:{id:'ruins',name:'星落神殿',theme:'ruins',w:72,h:72,seed:71,levelHint:'Lv.28～45',start:{x:4,y:36},
    spawns:[
      {monster:'windWisp',count:12,area:{x:8,y:6,w:56,h:60}},
      {monster:'shadowBat',count:11,area:{x:14,y:6,w:52,h:60}},
      {monster:'templeGolem',count:10,area:{x:26,y:6,w:40,h:60}},
      {monster:'starIdol',count:1,area:{x:52,y:28,w:14,h:16}},
    ],
    warps:[{x:1,y:36,to:'cave',tx:60,ty:32},{x:70,y:36,to:'frontier',tx:4,ty:24}],npcs:[]},
};
export const savePointDefault = { map:'town', x:24, y:30 };

// Replace ordinary spawn slots with biome variants. Total population per map is unchanged.
const populationReductions:Record<string,number[]>={meadow:[2,2,2,2,2],forest:[2,2,2,2,2],cave:[2,2,2,2,2],ruins:[4,3,3]};
for(const [mapId,reductions] of Object.entries(populationReductions)){
  const map=maps[mapId];
  reductions.forEach((n,i)=>{map.spawns[i].count-=n;});
  expansionVariants.filter(v=>v.map===mapId).forEach((v,i)=>map.spawns.push({monster:v.id,count:1,
    area:{x:12+(i%5)*9,y:i<5?12:42,w:8,h:10}}));
}

// v4.8 封印冰庫: a two-floor dungeon behind the 霜光封印碑 (opens after clearing its trial). Appended maps only.
const V=(hp:number,atk:number,exp:number,elite=false)=>({hp,atk,exp,elite});
maps.vault1={id:'vault1',name:'封印冰庫・外廊',theme:'cave',w:56,h:56,seed:97,levelHint:'Lv.32～40・地下城',start:{x:4,y:28},
  spawns:[
    {monster:'iceFox',count:8,area:{x:8,y:4,w:44,h:48},boost:V(1.8,1.35,2)},
    {monster:'exp_glacierFox',count:5,area:{x:14,y:4,w:38,h:48},boost:V(1.6,1.3,1.8)},
    {monster:'golem',count:6,area:{x:16,y:4,w:36,h:48},boost:V(1.6,1.3,1.8)},
    {monster:'exp_echoBat',count:6,area:{x:8,y:4,w:44,h:48},boost:V(1.6,1.3,1.8)},
    {monster:'golem',count:2,area:{x:30,y:10,w:20,h:36},boost:V(6,1.6,6,true)},
    {monster:'iceFox',count:2,area:{x:24,y:10,w:24,h:36},boost:V(6,1.6,6,true)},
  ],
  warps:[{x:1,y:28,to:'cave',tx:44,ty:22},{x:54,y:28,to:'vault2',tx:4,ty:24}],npcs:[]};
maps.vault2={id:'vault2',name:'封印冰庫・深處',theme:'cave',w:48,h:48,seed:131,levelHint:'Lv.36～45・地下城 BOSS',start:{x:4,y:24},
  spawns:[
    {monster:'exp_glacierFox',count:6,area:{x:8,y:4,w:30,h:40},boost:V(2,1.45,2.2)},
    {monster:'exp_hailBunny',count:6,area:{x:8,y:4,w:30,h:40},boost:V(2,1.45,2.2)},
    {monster:'exp_quartzGolem',count:5,area:{x:12,y:4,w:26,h:40},boost:V(1.9,1.4,2.1)},
    {monster:'exp_quartzGolem',count:2,area:{x:20,y:8,w:16,h:32},boost:V(6,1.7,6,true)},
    {monster:'exp_glacierFox',count:1,area:{x:20,y:8,w:16,h:32},boost:V(6,1.7,6,true)},
    {monster:'vaultWarden',count:1,area:{x:34,y:16,w:10,h:16}},
  ],
  warps:[{x:1,y:24,to:'vault1',tx:52,ty:28}],npcs:[]};

// v4.8+ hidden side areas behind the meadow/forest trial landmarks (open after clearing that trial once).
maps.jellyHollow={id:'jellyHollow',name:'果凍秘窟',theme:'meadow',w:44,h:44,seed:211,levelHint:'Lv.8～16・秘境',start:{x:4,y:22},
  spawns:[
    {monster:'jelly',count:8,area:{x:8,y:4,w:32,h:36},boost:V(2.2,1.6,2.4)},
    {monster:'blueJelly',count:7,area:{x:8,y:4,w:32,h:36},boost:V(2,1.5,2.2)},
    {monster:'exp_mintJelly',count:5,area:{x:12,y:4,w:28,h:36},boost:V(1.6,1.3,1.8)},
    {monster:'exp_amberJelly',count:4,area:{x:12,y:4,w:28,h:36},boost:V(1.8,1.4,2)},
    {monster:'exp_mintJelly',count:2,area:{x:22,y:8,w:16,h:28},boost:V(6,1.7,6,true)},
  ],
  warps:[{x:1,y:22,to:'meadow',tx:47,ty:45}],npcs:[]};
maps.grove={id:'grove',name:'翠影秘林',theme:'forest',w:52,h:52,seed:223,levelHint:'Lv.16～26・秘境',start:{x:4,y:26},
  spawns:[
    {monster:'wolf',count:8,area:{x:8,y:4,w:40,h:44},boost:V(1.8,1.4,2)},
    {monster:'exp_duskWolf',count:5,area:{x:10,y:4,w:38,h:44},boost:V(1.6,1.35,1.8)},
    {monster:'fox',count:6,area:{x:10,y:4,w:38,h:44},boost:V(1.7,1.35,1.9)},
    {monster:'exp_cedarSapling',count:5,area:{x:14,y:4,w:34,h:44},boost:V(1.6,1.3,1.8)},
    {monster:'exp_duskWisp',count:4,area:{x:14,y:4,w:34,h:44},boost:V(1.6,1.3,1.8)},
    {monster:'exp_cedarSapling',count:2,area:{x:26,y:10,w:20,h:32},boost:V(6,1.6,6,true)},
    {monster:'exp_duskWolf',count:1,area:{x:26,y:10,w:20,h:32},boost:V(6,1.6,6,true)},
  ],
  warps:[{x:1,y:26,to:'forest',tx:47,ty:52}],npcs:[]};

// ═══════════ v5.0 星界遠征: 曙光前哨 → 霧語沼澤 → 熔岩裂谷 → 天空花園 → 星界城塞 ═══════════
const N=(id:string,name:string,kind:NpcKind,x:number,y:number,hair:string,outfit:string,hat?:string):NpcDef=>({id,name,kind,x,y,look:{hair,outfit,...(hat?{hat}:{})}});
maps.frontier={id:'frontier',name:'曙光前哨',theme:'town',variant:'frontier',w:48,h:48,seed:283,levelHint:'安全區・遠征據點',start:{x:6,y:24},
  spawns:[],
  warps:[{x:1,y:24,to:'ruins',tx:67,ty:36},{x:46,y:24,to:'mistMarsh',tx:4,ty:36}],
  npcs:[N('fguide','遠征隊長 艾德','guide',27,30,'#c97a3a','#5a6a7a','#8a5a3a'),N('fservice','前哨通訊員','service',37,24,'#3a2a2a','#e85a7a','#ffffff'),
    N('ftool','補給官 米拉','tool',30,19,'#e8805a','#6fae5a'),N('fgear','軍械師 葛瑞','gear',17,26,'#8a8a8a','#3a4a5a','#d9a441'),
    N('fbounty','前線懸賞官 凱','bounty',22,33,'#3a3a3a','#4a3a8a','#d9a441'),N('fcraft','前線工匠 諾亞','craft',34,27,'#c9c9c9','#5a4a3a','#8a5a3a')]};
maps.mistMarsh={id:'mistMarsh',name:'霧語沼澤',theme:'forest',variant:'swamp',w:72,h:72,seed:307,levelHint:'Lv.45～55',start:{x:4,y:36},
  spawns:[{monster:'marshJelly',count:14,area:{x:6,y:6,w:60,h:60}},{monster:'mistBee',count:10,area:{x:6,y:6,w:60,h:60}},{monster:'bogSapling',count:9,area:{x:6,y:6,w:60,h:60}},
    {monster:'bogWolf',count:9,area:{x:6,y:6,w:60,h:60}},{monster:'mistQueen',count:1,area:{x:52,y:6,w:14,h:14}}],
  warps:[{x:1,y:36,to:'frontier',tx:44,ty:24},{x:70,y:36,to:'emberRift',tx:4,ty:32}],npcs:[]};
maps.emberRift={id:'emberRift',name:'熔岩裂谷',theme:'cave',variant:'lava',w:64,h:64,seed:331,levelHint:'Lv.52～62',start:{x:4,y:32},
  spawns:[{monster:'magmaJelly',count:12,area:{x:6,y:4,w:54,h:56}},{monster:'flameBat',count:10,area:{x:6,y:4,w:54,h:56}},{monster:'magmaGolem',count:8,area:{x:6,y:4,w:54,h:56}},
    {monster:'blazeFox',count:8,area:{x:6,y:4,w:54,h:56}},{monster:'lavaColossus',count:1,area:{x:46,y:46,w:14,h:14}}],
  warps:[{x:1,y:32,to:'mistMarsh',tx:67,ty:36},{x:62,y:32,to:'skyGarden',tx:4,ty:36}],npcs:[]};
maps.skyGarden={id:'skyGarden',name:'天空花園',theme:'meadow',variant:'sky',w:72,h:72,seed:347,levelHint:'Lv.58～68',start:{x:4,y:36},
  spawns:[{monster:'cloudBunny',count:14,area:{x:6,y:6,w:60,h:60}},{monster:'stormChick',count:10,area:{x:6,y:6,w:60,h:60}},{monster:'angelShroom',count:9,area:{x:6,y:6,w:60,h:60}},
    {monster:'skyWisp',count:9,area:{x:6,y:6,w:60,h:60}},{monster:'skyKing',count:1,area:{x:52,y:52,w:14,h:14}}],
  warps:[{x:1,y:36,to:'emberRift',tx:60,ty:32},{x:70,y:36,to:'starCitadel',tx:4,ty:36}],npcs:[]};
maps.starCitadel={id:'starCitadel',name:'星界城塞',theme:'ruins',variant:'astral',w:72,h:72,seed:373,levelHint:'Lv.65～82・終局',start:{x:4,y:36},
  spawns:[{monster:'astralGuard',count:10,area:{x:6,y:6,w:60,h:60}},{monster:'voidBat',count:10,area:{x:6,y:6,w:60,h:60}},{monster:'starFox',count:9,area:{x:6,y:6,w:60,h:60}},
    {monster:'astralWisp',count:9,area:{x:6,y:6,w:60,h:60}},{monster:'astralLord',count:1,area:{x:52,y:28,w:14,h:16}}],
  warps:[{x:1,y:36,to:'skyGarden',tx:67,ty:36}],npcs:[]};

// ═══════════ v6.0 二轉：誓約試煉場（由遠征隊長艾德開啟；守護者在進場時出現） ═══════════
maps.oathGround={id:'oathGround',name:'誓約試煉場',theme:'ruins',variant:'astral',w:36,h:36,seed:409,levelHint:'二轉試煉',start:{x:5,y:18},
  spawns:[],warps:[{x:1,y:18,to:'frontier',tx:6,ty:24}],npcs:[]};

// ═══════════ v6.0 二轉支線地下城（從地標進入，需要二轉）與星燈航路 ═══════════
maps.forge1={id:'forge1',name:'黑曜鍛爐・外環',theme:'cave',variant:'forge',w:60,h:60,seed:431,levelHint:'Lv.62～70・二轉地下城',start:{x:4,y:30},
  spawns:[{monster:'cinderJelly',count:10,area:{x:8,y:4,w:48,h:52},boost:V(1.15,1.1,1.25)},{monster:'ashBat',count:8,area:{x:8,y:4,w:48,h:52},boost:V(1.15,1.1,1.25)},
    {monster:'shellGolem',count:7,area:{x:14,y:4,w:42,h:52},boost:V(1.15,1.1,1.25)},{monster:'forgeWisp',count:6,area:{x:14,y:4,w:42,h:52},boost:V(1.15,1.1,1.25)},
    {monster:'shellGolem',count:2,area:{x:30,y:12,w:22,h:36},boost:V(5,1.5,5,true)}],
  warps:[{x:1,y:30,to:'emberRift',tx:40,ty:21},{x:58,y:30,to:'forge2',tx:4,ty:26}],npcs:[]};
maps.forge2={id:'forge2',name:'黑曜鍛爐・核心',theme:'cave',variant:'forge',w:52,h:52,seed:443,levelHint:'Lv.68～78・地下城 BOSS',start:{x:4,y:26},
  spawns:[{monster:'cinderJelly',count:6,area:{x:8,y:4,w:30,h:44},boost:V(1.4,1.2,1.5)},{monster:'shellGolem',count:6,area:{x:8,y:4,w:30,h:44},boost:V(1.4,1.2,1.5)},
    {monster:'forgeWisp',count:6,area:{x:10,y:4,w:28,h:44},boost:V(1.4,1.2,1.5)},{monster:'ashBat',count:5,area:{x:8,y:4,w:30,h:44},boost:V(1.4,1.2,1.5)},
    {monster:'forgeWisp',count:2,area:{x:20,y:10,w:16,h:30},boost:V(5,1.5,5,true)},{monster:'forgeMaster',count:1,area:{x:38,y:18,w:10,h:16}}],
  warps:[{x:1,y:26,to:'forge1',tx:56,ty:30}],npcs:[]};
maps.bell1={id:'bell1',name:'逆風鐘塔・迴廊',theme:'ruins',variant:'bell',w:60,h:60,seed:457,levelHint:'Lv.70～80・二轉地下城',start:{x:4,y:30},
  spawns:[{monster:'beatSprite',count:9,area:{x:8,y:4,w:48,h:52},boost:V(1.15,1.1,1.25)},{monster:'galeChick',count:8,area:{x:8,y:4,w:48,h:52},boost:V(1.15,1.1,1.25)},
    {monster:'bellBee',count:8,area:{x:12,y:4,w:44,h:52},boost:V(1.15,1.1,1.25)},{monster:'cogGolem',count:6,area:{x:14,y:4,w:42,h:52},boost:V(1.15,1.1,1.25)},
    {monster:'cogGolem',count:2,area:{x:30,y:12,w:22,h:36},boost:V(5,1.5,5,true)}],
  warps:[{x:1,y:30,to:'skyGarden',tx:46,ty:25},{x:58,y:30,to:'bell2',tx:4,ty:26}],npcs:[]};
maps.bell2={id:'bell2',name:'逆風鐘塔・冠層',theme:'ruins',variant:'bell',w:52,h:52,seed:463,levelHint:'Lv.76～84・地下城 BOSS',start:{x:4,y:26},
  spawns:[{monster:'beatSprite',count:6,area:{x:8,y:4,w:30,h:44},boost:V(1.4,1.2,1.5)},{monster:'galeChick',count:5,area:{x:8,y:4,w:30,h:44},boost:V(1.4,1.2,1.5)},
    {monster:'bellBee',count:6,area:{x:10,y:4,w:28,h:44},boost:V(1.4,1.2,1.5)},{monster:'cogGolem',count:5,area:{x:10,y:4,w:28,h:44},boost:V(1.4,1.2,1.5)},
    {monster:'bellBee',count:2,area:{x:20,y:10,w:16,h:30},boost:V(5,1.5,5,true)},{monster:'bellTuner',count:1,area:{x:38,y:18,w:10,h:16}}],
  warps:[{x:1,y:26,to:'bell1',tx:56,ty:30}],npcs:[]};
maps.harbor={id:'harbor',name:'夜航港',theme:'town',variant:'harbor',w:48,h:48,seed:479,levelHint:'安全區・星燈航路',start:{x:6,y:24},
  spawns:[],warps:[{x:1,y:24,to:'starCitadel',tx:14,ty:40},{x:46,y:24,to:'bellBay',tx:4,ty:36}],
  npcs:[N('hguide','燈塔技師 芮比','guide',27,30,'#ff9a5a','#3a5a8a','#ffd45c'),N('hservice','港口通訊員','service',37,24,'#3a2a2a','#5ab0e0','#ffffff'),
    N('htool','港口雜貨 小貝','tool',30,19,'#7fd7ff','#e8805a'),N('hgear','船匠 米洛','gear',17,26,'#5a4a3a','#2a3a5a','#e8e8f0'),
    N('hcraft','鐘匠 安伯','craft',34,27,'#e8e8e8','#7a5a3a','#5a3a2a'),N('hbounty','港口懸賞官 娜塔','bounty',22,33,'#2a2a3a','#2fa08a','#d9a441')]};
maps.bellBay={id:'bellBay',name:'貝露灣',theme:'meadow',variant:'bay',w:72,h:72,seed:491,levelHint:'Lv.80～90',start:{x:4,y:36},
  spawns:[{monster:'bubbleJelly',count:14,area:{x:6,y:6,w:60,h:60}},{monster:'lampBat',count:10,area:{x:6,y:6,w:60,h:60}},{monster:'saltWorm',count:9,area:{x:6,y:6,w:60,h:60}},
    {monster:'tideWisp',count:9,area:{x:6,y:6,w:60,h:60}},{monster:'tideQueen',count:1,area:{x:52,y:6,w:14,h:14}}],
  warps:[{x:1,y:36,to:'harbor',tx:44,ty:24}],npcs:[]};

// ═══════════ v6.3 星光深淵：無限樓層挑戰（魔物由程式依樓層產生） ═══════════
maps.abyss={id:'abyss',name:'星光深淵',theme:'ruins',variant:'astral',w:40,h:40,seed:509,levelHint:'無限樓層挑戰',start:{x:6,y:20},
  spawns:[],warps:[],npcs:[]};
