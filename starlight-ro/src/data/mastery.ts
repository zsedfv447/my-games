// v4.3 Skill mastery & awakening: every active attack skill grows with use. Three tiers raise
// damage and lower SP/cast time; tier III "覺醒" adds a unique evolved effect per skill.
// Stacks with card modules (different multipliers), never replaces them.

export const MASTERY_TIERS=[0,40,150,400] as const;
export const MASTERY_NAMES=['未熟練','熟練 I','熟練 II','覺醒'];
/** Damage multiplier, SP cost multiplier and cast-time multiplier by tier. */
export const MASTERY_BONUS=[
  {dmg:1,sp:1,cast:1},
  {dmg:1.08,sp:.95,cast:1},
  {dmg:1.16,sp:.9,cast:.9},
  {dmg:1.25,sp:.85,cast:.85},
];
/** Skills that grow (active attacks). */
export const awakenings:Record<string,{name:string;desc:string}>={
  bash:{name:'破岩重斬',desc:'30% 機率擊暈 1.5 秒，並以震波波及 1.5 格內的敵人（50% 傷害）。'},
  magnum:{name:'熔岩爆破',desc:'爆破後地面燃燒 3 秒，持續灼燒範圍內敵人。'},
  fireBolt:{name:'爆裂火焰矢',desc:'每一發火焰矢命中後爆炸，波及周圍 1.5 格（40% 傷害）；爆炸本身不疊灼燒。'},
  coldBolt:{name:'凍結冰霜矢',desc:'每一發冰霜矢有 20% 機率凍結目標 1.2 秒（受冰凍保護限制，MVP 免疫）。'},
  lightningBolt:{name:'連鎖雷鳴矢',desc:'附近有其他敵人時，每一發必定連鎖（60% 傷害）；單一目標時維持 30% 回彈。'},
  fireBall:{name:'巨焰流星',desc:'爆炸範圍擴大 40%，並把敵人炸飛。'},
  frostDiver:{name:'絕對零度',desc:'冰凍機率 +25%；對冰凍中或帶寒冰印記的敵人本體傷害 ×1.5（兩者不重複）。'},
  thunderStorm:{name:'天雷降臨',desc:'雷擊次數 +2。'},
  doubleStrafe:{name:'三連矢',desc:'追加第三支箭。'},
  arrowShower:{name:'流星箭雨',desc:'範圍擴大 50%，命中的敵人緩速 3 秒。'},
  chargeArrow:{name:'貫穿震退箭',desc:'箭矢貫穿直線上所有敵人。'},
  // v6.0 二轉
  k_wheel:{name:'流星旋輪',desc:'連斬次數 +1（共 4 次）。'},
  k_charge:{name:'星痕突進',desc:'命中時取得 2 層戰意，並暈眩目標 1 秒（MVP 免疫）。'},
  k_rend:{name:'斷星重斬',desc:'命中後震波波及 1.8 格內的敵人（50% 傷害）。'},
  k_quake:{name:'大地戰陣',desc:'戰陣與初擊範圍 +1 格。'},
  k_judgment:{name:'星落審判',desc:'扇形斬擊變成全方位。'},
  w_flame:{name:'熔核火場',desc:'初擊給 3 層灼燒。'},
  w_frost:{name:'永凍冰場',desc:'冰場持續時間 +2 秒。'},
  w_totem:{name:'雙生星樁',desc:'每次電擊最多 5 隻敵人。'},
  w_arcana:{name:'星紋極意',desc:'奧義範圍 +1 格、傷害 ×1.25。'},
  r_snipe:{name:'穿星貫天',desc:'子彈貫穿目標，打中後方 5 格內的敵人（60% 傷害）。'},
  r_pierce:{name:'颶風貫矢',desc:'貫穿距離 +2 格、寬度增加。'},
  r_barrage:{name:'疾風連射',desc:'箭數 +2（共 7 箭）。'},
  r_trap:{name:'星光陷阱',desc:'最多 3 個陷阱，爆炸範圍 +0.8 格。'},
  r_starRain:{name:'星河傾瀉',desc:'星羽增加到 4 波。'},
};
export const masteryTier=(xp:number)=>xp>=MASTERY_TIERS[3]?3:xp>=MASTERY_TIERS[2]?2:xp>=MASTERY_TIERS[1]?1:0;
