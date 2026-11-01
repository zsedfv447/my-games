// Map landmarks (moved from render/art so the simulation can use them). Index order is part of save keys: append only.
export type Landmark={x:number;y:number;name:string;kind:'camp'|'ruin'|'shrine'|'lighthouse';text:string;
  /** v4.6: camps hand out a supply chest; ruins/shrines start a trial against a hidden elite. */
  action?:'supply'|'trial'};
export const landmarks:Record<string,Landmark[]>={
  meadow:[{x:18,y:34,name:'風鈴旅人營地',kind:'camp',text:'旅行者留下的風鈴在微風中輕響。沿著大道往東，便是翠影森林。'},{x:47,y:43,name:'晨露石環',kind:'ruin',text:'石環上刻著果凍王冠的圖案。草原東北方，偶爾傳來沉重的彈跳聲。'}],
  forest:[{x:14,y:34,name:'巡林者舊營地',kind:'camp',text:'蜂蜜的香氣與松木味交織。森林狼仔會追逐闖入領地的旅人。'},{x:47,y:50,name:'古樹誓約石',kind:'shrine',text:'樹根環繞著古老的約定：尊重森林，也勇於面對守護者的試煉。'}],
  cave:[{x:15,y:30,name:'寒晶觀測站',kind:'camp',text:'前人留下紀錄：發亮的冰晶會聚集魔力，魔法防禦能減輕冰晶魔物的攻擊。'},{x:44,y:20,name:'霜光封印碑',kind:'shrine',text:'巨像的正面重擊會留下筆直裂痕。觀察預警方向，往側面移動。'}],
};
// v4.6: 星落神殿 had no landmarks; appended (never reorder the lists above).
landmarks.ruins=[
  {x:14,y:42,name:'朝聖者休息處',kind:'camp',text:'褪色的布幔下堆著前人留下的補給。神殿深處的星光，會回應願意冒險的人。'},
  {x:40,y:52,name:'星語祭壇',kind:'shrine',text:'祭壇上的星紋微微脈動。據說觸碰它的人，會被神殿的守護者考驗。'},
];
for(const list of Object.values(landmarks))for(const l of list)l.action??=l.kind==='camp'?'supply':'trial';
export const landmarkKey=(map:string,i:number)=>`${map}:${i}`;
// v5.0 星界遠征 landmarks (camp = supply, shrine = trial).
landmarks.mistMarsh=[{x:16,y:40,name:'沼澤觀測哨',kind:'camp',text:'遠征隊在這裡記錄霧的濃淡。霧越濃，女王越近。',action:'supply'},{x:44,y:20,name:'霧語石柱',kind:'shrine',text:'石柱上的符文在霧中發光，似乎在等待挑戰者。',action:'trial'}];
landmarks.emberRift=[{x:14,y:28,name:'耐熱補給站',kind:'camp',text:'一箱箱耐熱藥水堆在岩壁旁。',action:'supply'},{x:40,y:18,name:'熔核祭壇',kind:'shrine',text:'祭壇中央的熔岩脈動著，像一顆心臟。',action:'trial'}];
landmarks.skyGarden=[{x:16,y:44,name:'雲端驛站',kind:'camp',text:'旅人們在雲上歇腳，交換天空花園的傳聞。',action:'supply'},{x:46,y:22,name:'天穹鐘塔',kind:'shrine',text:'鐘聲響起時，天空的守護者會現身。',action:'trial'}];
landmarks.starCitadel=[{x:14,y:42,name:'星界前線營',kind:'camp',text:'最後的營地。再往前，就是星界君主的王座。',action:'supply'},{x:40,y:52,name:'星辰王座之門',kind:'shrine',text:'門上刻著歷代挑戰者的名字。',action:'trial'}];

// v6.0 星燈航路 (append only).
landmarks.bellBay=[{x:14,y:40,name:'潮聲營地',kind:'camp',text:'漁夫們在這裡晾網，聊著燈塔熄滅之後再也沒有回來的船。',action:'supply'},
  {x:58,y:52,name:'貝露燈塔',kind:'lighthouse',text:'白色的燈塔安靜地站在海角。燈室裡的星燈熄滅了，燈芯只剩下一截灰燼。'}];
landmarks.harbor=[{x:40,y:40,name:'夜航港燈台',kind:'lighthouse',text:'港口的小燈台和貝露燈塔是一對。海角的燈亮起時，這裡的燈也會跟著亮。'}];
