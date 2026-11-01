// v4.3 adventure companions: mounts you ride, mercenaries who fight beside you, and emotes.

/** Mounts: giant jelly steeds. Riding is faster on the road; attacking or casting dismounts. */
export type MountDef={id:string;name:string;price:number;minLv:number;body:string;accent:string;wings?:boolean;crown?:boolean;speed:number;desc:string;unlock?:string;
  /** v6.2: model shape (default the jelly steed), its size, how to get it, and knight-only mounts (騎乘戰鬥). */
  kind?:'jelly'|'chick'|'bat'; scale?:number; horns?:boolean; hint?:string; knightOnly?:boolean};
export const mounts:Record<string,MountDef>=Object.fromEntries(([
  {id:'poring',name:'波利坐騎',price:3000,minLv:8,body:'#ff9ec4',accent:'#ffe3ef',speed:1.45,desc:'軟綿綿、一蹦一跳的粉紅大果凍。冒險者的第一隻坐騎。'},
  {id:'drops',name:'橙晶波利坐騎',price:9000,minLv:18,body:'#ffb05a',accent:'#fff1d6',speed:1.5,desc:'橙色果凍會在陽光下發亮，跑起來更輕快。'},
  {id:'marin',name:'冰晶波利坐騎',price:18000,minLv:28,body:'#8fd0ff',accent:'#e8f6ff',speed:1.55,desc:'寒晶洞窟的冰果凍，走過的地方會冒出冰霧。'},
  {id:'angeling',name:'天使波利坐騎',price:0,minLv:1,body:'#fff6d8',accent:'#ffd45c',wings:true,crown:true,speed:1.6,desc:'只有擊敗果凍國王的勇者才會被牠認可。頭頂光環、背上有翅膀。',unlock:'jellyKing'},
  // v6.2 騎士坐騎：騎著也能攻擊（騎乘戰鬥）
  {id:'pecoPeco',name:'星光大嘴鳥',price:0,minLv:60,body:'#ffd45c',accent:'#ff9a3d',kind:'chick',scale:1.55,speed:1.45,knightOnly:true,unlock:'job:knight',hint:'成為星誓騎士時，在轉職儀式上取得',
    desc:'騎士的招牌坐騎。星誓騎士騎在牠背上也能揮劍、放技能，還能使出大嘴鳥踐踏。'},
  {id:'emberWyvern',name:'熔岩幼龍',price:0,minLv:70,body:'#9a1c10',accent:'#3a0c08',kind:'bat',scale:1.8,wings:false,horns:true,speed:1.7,knightOnly:true,unlock:'forgeMaster',hint:'星誓騎士擊敗黑曜鍛爐的熔爐總監後取得',
    desc:'熔爐深處孵出的幼龍。騎著牠的星誓騎士就是「龍騎士」：踐踏化為龍息，附刃順劈更大。'},
] as MountDef[]).map(m=>[m.id,m]));

/** Mercenaries: hired once at the 傭兵團長, one fights with you at a time and grows with your level. */
export type CompanionRole='guard'|'priest'|'hunter';
/** v4.9 mercenary orders: 守護 (front line, taunts), 協助 (hits your target), 支援 (stays behind you, never attacks). */
export type CompanionMode='guard'|'assist'|'support';
export const COMPANION_MODES:Record<CompanionMode,{name:string;icon:string;desc:string}>={
  guard:{name:'守護',icon:'🛡',desc:'擋在你和魔物之間，先打衝向你的魔物；劍士會用挑釁把怪拉走。'},
  assist:{name:'協助',icon:'⚔',desc:'攻擊你正在打的魔物。'},
  support:{name:'支援',icon:'✚',desc:'躲在你身後、完全不攻擊，不會拉到仇恨；祭司專心補血與祝福。'},
};
export const DEFAULT_MODE:Record<CompanionRole,CompanionMode>={guard:'guard',priest:'support',hunter:'assist'};
export type CompanionDef={id:CompanionRole;name:string;title:string;price:number;minLv:number;job:string;weapon:'sword'|'staff'|'bow';
  /** Preferred avatars (the first one the player is not wearing is used). */
  avatars:string[];hair:string;desc:string;skill:string};
export const companions:Record<CompanionRole,CompanionDef>={
  guard:{id:'guard',name:'雷恩',title:'鐵壁劍士',price:1500,minLv:5,job:'swordman',weapon:'sword',avatars:['base_m','hair_m','fumiriya'],hair:'#c8d0e0',
    desc:'站在最前面替你擋刀。每隔幾秒用「挑釁怒吼」把附近的魔物引到自己身上。',skill:'挑釁怒吼：吸引 4 格內的魔物攻擊雷恩'},
  priest:{id:'priest',name:'艾琳',title:'見習祭司',price:2200,minLv:8,job:'priest',weapon:'staff',avatars:['base_f','hair_f','shino'],hair:'#f2e2a8',
    desc:'跟在你身後，HP 下降時施放治癒術，戰鬥中偶爾為你祝福。',skill:'治癒術／祝福：補血並短暫提高攻擊'},
  hunter:{id:'hunter',name:'希爾',title:'森林獵人',price:1800,minLv:6,job:'archer',weapon:'bow',avatars:['shino','hair_f','base_f'],hair:'#7fd0a0',
    desc:'在遠處射擊你正在攻擊的魔物，冷卻好時會放出「二連矢」。',skill:'二連矢：兩倍傷害的連續射擊'},
};
/** Companion combat stats at a given base level (kept well below a geared player of the same level). */
export function companionStats(role:CompanionRole,lv:number){
  const L=Math.max(1,lv);
  switch(role){
    case 'guard':return {maxHp:Math.round(90+L*30),atk:Math.round(10+L*2.6),def:22+Math.min(30,L*.5),range:1.5,aspd:1.25,speed:4.6,magic:false};
    case 'priest':return {maxHp:Math.round(60+L*17),atk:Math.round(7+L*1.6),def:10+Math.min(20,L*.3),range:5,aspd:1.7,speed:4.6,magic:true,heal:Math.round(25+L*7)};
    case 'hunter':return {maxHp:Math.round(65+L*19),atk:Math.round(9+L*2.3),def:12+Math.min(20,L*.3),range:6,aspd:1.15,speed:4.6,magic:false};
  }
}

/** Emotes: purely visual motion-captured clips (stop when you move). */
export type EmoteDef={id:string;name:string;clip:string;loop:boolean;icon:string};
export const emotes:EmoteDef[]=[
  {id:'dance',name:'跳舞',clip:'Dance_Loop',loop:true,icon:'♪'},
  {id:'yes',name:'點頭',clip:'Yes',loop:false,icon:'○'},
  {id:'no',name:'搖頭',clip:'Idle_No_Loop',loop:true,icon:'×'},
  {id:'fold',name:'抱胸',clip:'Idle_FoldArms_Loop',loop:true,icon:'▣'},
  {id:'talk',name:'聊天',clip:'Idle_Talking_Loop',loop:true,icon:'…'},
  {id:'eat',name:'吃東西',clip:'Consume',loop:false,icon:'◎'},
  {id:'roll',name:'翻滾',clip:'Roll',loop:false,icon:'↻'},
  {id:'ninja',name:'帥氣站姿',clip:'NinjaJump_Idle_Loop',loop:true,icon:'★'},
];
