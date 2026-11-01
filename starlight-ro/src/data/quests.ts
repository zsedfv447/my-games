// Quest chain given by 嚮導 莉莉. One quest is active at a time; kill counts start when it becomes active.
export type QuestGoal =
  | {kind:'kill';monster:string;count:number}
  | {kind:'collect';item:string;count:number}
  | {kind:'job'}
  | {kind:'level';level:number};
export type QuestDef = {
  id:string; title:string; text:string; goal:QuestGoal;
  reward:{exp:number;jexp:number;zeny:number;items?:Record<string,number>};
};
export const quests:QuestDef[] = [
  {id:'jelly10',title:'果凍大掃除',text:'晨光草原的噗噗果凍越來越多了，幫忙打倒 10 隻吧！',goal:{kind:'kill',monster:'jelly',count:10},
    reward:{exp:60,jexp:40,zeny:300,items:{redPotion:10,dawnBread:5}}},
  {id:'goo',title:'果凍黏液收集',text:'道具商波妮想用果凍黏液做藥水，帶 8 個果凍黏液回來。',goal:{kind:'collect',item:'jellyGoo',count:8},
    reward:{exp:90,jexp:60,zeny:400,items:{cap:1,dawnBread:5,starJuice:3}}},
  {id:'worm12',title:'菜園保衛戰',text:'小綠蟲在啃農家的菜，打倒 12 隻小綠蟲。',goal:{kind:'kill',monster:'worm',count:12},
    reward:{exp:180,jexp:120,zeny:500,items:{redPotion:10,sandals:1,starJuice:3}}},
  {id:'job',title:'踏上職業之路',text:'把職業等級練到 10、基本技能學到 Lv.9，然後去找轉職官葛蘭轉職。',goal:{kind:'job'},
    reward:{exp:400,jexp:200,zeny:1500,items:{adventureSuit:1,orangePotion:5,dawnBread:5,starJuice:5}}},
  {id:'chick15',title:'咕咕雞騷動',text:'咕咕雞闖進了草原深處，打倒 15 隻咕咕雞。',goal:{kind:'kill',monster:'chick',count:15},
    reward:{exp:900,jexp:600,zeny:1200,items:{cape:1,shroomSoup:3,starJuice:5}}},
  {id:'jellyKing',title:'果凍國王討伐',text:'草原東北方住著果凍國王。等級夠了再去挑戰牠，牠會放範圍大招也會叫小弟！',goal:{kind:'kill',monster:'jellyKing',count:1},
    reward:{exp:3000,jexp:2000,zeny:4000,items:{orangePotion:15,bluePotion:3,adventBento:2,herbTea:3}}},
  {id:'wolf20',title:'森林的狼群',text:'翠影森林的森林狼仔會主動攻擊旅人，打倒 20 隻。',goal:{kind:'kill',monster:'wolf',count:20},
    reward:{exp:4000,jexp:3000,zeny:3000,items:{leatherBoots:1,shroomSoup:5,herbTea:3}}},
  {id:'honey',title:'香甜蜂蜜',text:'收集 6 罐蜂蜂掉落的蜂蜜，給鎮上的孩子們。',goal:{kind:'collect',item:'honey',count:6},
    reward:{exp:5000,jexp:3500,zeny:3500,items:{bluePotion:5,herbTea:5}}},
  {id:'forestLord',title:'古樹的試煉',text:'森林東南方的古樹守護者正在等待挑戰者。',goal:{kind:'kill',monster:'forestLord',count:1},
    reward:{exp:12000,jexp:9000,zeny:9000,items:{whitePotion:10,adventBento:3}}},
  {id:'bat25',title:'冰洞的蝙蝠',text:'寒晶洞窟的冰晶蝙蝠群擋住了去路，打倒 25 隻。',goal:{kind:'kill',monster:'bat',count:25},
    reward:{exp:15000,jexp:11000,zeny:8000,items:{furCape:1,herbTea:5,shroomSoup:5}}},
  {id:'iceColossus',title:'冰霜巨像',text:'洞窟深處的冰霜巨像是最強的魔物。打倒牠，成為晨光鎮的英雄！',goal:{kind:'kill',monster:'iceColossus',count:1},
    reward:{exp:40000,jexp:30000,zeny:30000,items:{whitePotion:20,adventBento:5}}},
  // v3.0: appended only, so stored quest indexes stay valid.
  {id:'windWisp20',title:'神殿的風',text:'寒晶洞窟東邊的星落神殿被風之精靈佔據了。打倒 20 隻風之精靈。',goal:{kind:'kill',monster:'windWisp',count:20},
    reward:{exp:30000,jexp:24000,zeny:15000,items:{whitePotion:10,timeCloak:1,herbTea:8}}},
  {id:'templeGolem15',title:'沉睡的守衛',text:'神殿守衛只會攻擊靠近的人。打倒 15 隻，取得通往神殿深處的許可。',goal:{kind:'kill',monster:'templeGolem',count:15},
    reward:{exp:45000,jexp:36000,zeny:20000,items:{whitePotion:15,herbTea:8,adventBento:3}}},
  {id:'starIdol',title:'星落女神像',text:'神殿深處的女神像會降下星光。這是目前最強的挑戰，打倒她吧！',goal:{kind:'kill',monster:'starIdol',count:1},
    reward:{exp:90000,jexp:70000,zeny:60000,items:{whitePotion:30,adventBento:10}}},
  // ═══ v5.0 星界遠征 (appended only — stored quest indexes stay valid) ═══
  {id:'frontier',title:'通往曙光前哨',text:'星落神殿東邊的道路通往遠征隊的據點「曙光前哨」。把基本等級練到 46，去見遠征隊長艾德。',goal:{kind:'level',level:46},
    reward:{exp:40000,jexp:30000,zeny:20000,items:{herbTea:10,adventBento:5}}},
  {id:'marshJelly20',title:'沼澤的泥怪',text:'霧語沼澤的沼澤泥怪擋住了遠征隊的補給路線，打倒 20 隻。',goal:{kind:'kill',monster:'marshJelly',count:20},
    reward:{exp:80000,jexp:60000,zeny:25000,items:{whitePotion:15}}},
  {id:'bogMoss',title:'霧中的苔',text:'遠征隊的藥師需要沼澤苔來調製解霧藥，帶 12 份回來。',goal:{kind:'collect',item:'bogMoss',count:12},
    reward:{exp:100000,jexp:75000,zeny:30000,items:{voyagerRing:1}}},
  {id:'mistQueen',title:'霧之女王',text:'沼澤深處的霧之女王正是濃霧的源頭。打倒她，讓遠征隊繼續前進！',goal:{kind:'kill',monster:'mistQueen',count:1},
    reward:{exp:150000,jexp:110000,zeny:60000,items:{whitePotion:20,starShard:1}}},
  {id:'magmaGolem15',title:'裂谷的守門者',text:'熔岩裂谷的熔岩魔像會攻擊所有靠近的人，打倒 15 隻。',goal:{kind:'kill',monster:'magmaGolem',count:15},
    reward:{exp:180000,jexp:130000,zeny:40000,items:{magmaBoots:1}}},
  {id:'blazeFox20',title:'火焰狐群',text:'烈焰狐在裂谷裡四處縱火，打倒 20 隻。',goal:{kind:'kill',monster:'blazeFox',count:20},
    reward:{exp:220000,jexp:160000,zeny:45000,items:{whitePotion:20,herbTea:10}}},
  {id:'lavaColossus',title:'熔岩巨像',text:'裂谷最深處沉睡著熔岩巨像。牠一醒來，整座裂谷都會燃燒。',goal:{kind:'kill',monster:'lavaColossus',count:1},
    reward:{exp:320000,jexp:240000,zeny:90000,items:{whitePotion:25,starShard:1}}},
  {id:'cloudFluff',title:'雲上的禮物',text:'天空花園的雲絮能做成最輕的布料，帶 15 份回來。',goal:{kind:'collect',item:'cloudFluff',count:15},
    reward:{exp:300000,jexp:220000,zeny:60000,items:{skyCloak:1}}},
  {id:'skyWisp20',title:'天空的精靈',text:'天空精靈會襲擊過路的旅人，打倒 20 隻。',goal:{kind:'kill',monster:'skyWisp',count:20},
    reward:{exp:380000,jexp:280000,zeny:70000,items:{whitePotion:25,adventBento:10}}},
  {id:'skyKing',title:'天空之王',text:'天空花園的主人——天空之王，正在雲端的巢裡等待挑戰者。',goal:{kind:'kill',monster:'skyKing',count:1},
    reward:{exp:550000,jexp:400000,zeny:120000,items:{whitePotion:30,starShard:2}}},
  {id:'astralGuard20',title:'星界的守衛',text:'星界城塞的大門由星界守衛把守，打倒 20 隻。',goal:{kind:'kill',monster:'astralGuard',count:20},
    reward:{exp:600000,jexp:450000,zeny:90000,items:{astralCirclet:1}}},
  {id:'astralWisp25',title:'星光的迴廊',text:'城塞迴廊裡的星界精靈守護著通往王座的路，打倒 25 隻。',goal:{kind:'kill',monster:'astralWisp',count:25},
    reward:{exp:800000,jexp:600000,zeny:110000,items:{whitePotion:30,herbTea:15}}},
  {id:'astralLord',title:'星界君主',text:'星界君主就在王座上。這是星光冒險最後、也是最強的挑戰。',goal:{kind:'kill',monster:'astralLord',count:1},
    reward:{exp:1200000,jexp:900000,zeny:250000,items:{astralRing:1,starShard:3}}},
  {id:'lv80',title:'星光的傳說',text:'把基本等級練到 80，成為晨光鎮流傳的星光傳說。',goal:{kind:'level',level:80},
    reward:{exp:0,jexp:0,zeny:500000,items:{adventBento:20,whitePotion:50}}},
  // v6.0 二轉・星燈航路（append only）
  {id:'forgeMaster',title:'熔爐總監',text:'二轉之後，熔岩裂谷的熔核祭壇通往黑曜鍛爐。鍛爐核心的熔爐總監會揮出三道熱槌——從側面閃開！',goal:{kind:'kill',monster:'forgeMaster',count:1},
    reward:{exp:900000,jexp:700000,zeny:150000,items:{oathCore:2,whitePotion:30}}},
  {id:'bellTuner',title:'星鐘調律者',text:'天空花園的天穹鐘塔後方，逆風鐘塔正在倒轉。冠層的星鐘調律者會連續敲下三記鐘雷。',goal:{kind:'kill',monster:'bellTuner',count:1},
    reward:{exp:1300000,jexp:950000,zeny:180000,items:{oathCore:2,whitePotion:30}}},
  {id:'lampWick12',title:'熄滅的星燈',text:'夜航港的燈塔技師芮比需要新的燈芯。從星界城塞的前線營搭船到夜航港，再到貝露灣收集 12 份燈殼蝙蝠的星燈燈芯。',goal:{kind:'collect',item:'lampWick',count:12},
    reward:{exp:1500000,jexp:1000000,zeny:120000,items:{tideGlass:10,adventBento:10}}},
  {id:'bubbleJelly25',title:'潮聲的守護',text:'修好燈塔之前，先清掉擋住海角小路的潮泡果凍，打倒 25 隻。',goal:{kind:'kill',monster:'bubbleJelly',count:25},
    reward:{exp:1800000,jexp:1200000,zeny:140000,items:{whitePotion:40,herbTea:15}}},
  {id:'tideQueen',title:'潮歌貝后',text:'貝露灣北邊的潮歌貝后讓燈塔一直無法點亮。打倒她，讓星燈重新照亮航路！',goal:{kind:'kill',monster:'tideQueen',count:1},
    reward:{exp:2600000,jexp:1800000,zeny:300000,items:{oathCore:3,huntRing:1}}},
  {id:'lv90',title:'星燈航路的英雄',text:'把基本等級練到 90。夜航港的燈，會為你一直亮著。',goal:{kind:'level',level:90},
    reward:{exp:0,jexp:0,zeny:800000,items:{oathCore:6,whitePotion:60}}},
];

/** Keep the original array order forever: old saves store its numeric index. */
export const challengeIds = ['jellyKing','forestLord','iceColossus','starIdol','mistQueen','lavaColossus','skyKing','astralLord','forgeMaster','bellTuner','tideQueen'] as const;
export const isChallenge = (q:QuestDef|undefined):boolean => !!q&&challengeIds.some(id=>id===q.id);
export const challenges = quests.filter(isChallenge);
