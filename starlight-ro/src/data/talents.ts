// v6.3 星光天賦: long-term growth. 1 star point per Base level from Lv.40 and per 5 星光深淵 floors.
// Three constellations; each has four ranked nodes and a capstone that needs 15 points spent in that constellation.
export type TalentTree='war'|'guard'|'swift';
export type TalentKey='atkPct'|'matkPct'|'crit'|'skill'|'hpPct'|'defs'|'shieldPct'|'regen'|'cast'|'aspd'|'spCost'|'move'|'starburst'|'aegis'|'echo';
export type TalentDef={id:TalentKey;tree:TalentTree;name:string;max:number;per:number;desc:(rank:number)=>string;capstone?:boolean};
export const TALENT_TREES:Record<TalentTree,{name:string;icon:string;color:string}>={
  war:{name:'戰鬥之星',icon:'⚔️',color:'#ff7a5a'},guard:{name:'守護之星',icon:'🛡️',color:'#5fb0ff'},swift:{name:'迅捷之星',icon:'✨',color:'#ffd23f'}};
export const CAPSTONE_COST=15;
export const talents:Record<TalentKey,TalentDef>={
  atkPct:{id:'atkPct',tree:'war',name:'力量星痕',max:5,per:3,desc:r=>`物理攻擊 +${r*3}%`},
  matkPct:{id:'matkPct',tree:'war',name:'魔力星痕',max:5,per:3,desc:r=>`魔法攻擊 +${r*3}%`},
  crit:{id:'crit',tree:'war',name:'鋒芒星痕',max:5,per:2,desc:r=>`爆擊 +${r*2}%`},
  skill:{id:'skill',tree:'war',name:'技藝星痕',max:5,per:2,desc:r=>`技能傷害 +${r*2}%`},
  starburst:{id:'starburst',tree:'war',name:'星爆',max:1,per:1,capstone:true,desc:()=>'打倒魔物時炸出星光，對 2 格內其他敵人造成牠最大 HP 15% 的傷害（MVP 不會被這樣打）。連鎖擊殺會繼續引爆。'},
  hpPct:{id:'hpPct',tree:'guard',name:'生命星痕',max:5,per:4,desc:r=>`最大 HP +${r*4}%`},
  defs:{id:'defs',tree:'guard',name:'堅盾星痕',max:5,per:2,desc:r=>`DEF +${r*2}、MDEF +${r*2}`},
  shieldPct:{id:'shieldPct',tree:'guard',name:'庇護星痕',max:5,per:5,desc:r=>`自己產生的護盾 +${r*5}%`},
  regen:{id:'regen',tree:'guard',name:'復甦星痕',max:5,per:15,desc:r=>`HP／SP 自然回復 +${r*15}%`},
  aegis:{id:'aegis',tree:'guard',name:'星之護佑',max:1,per:1,capstone:true,desc:()=>'HP 低於 30% 時，立刻獲得最大 HP 25% 的護盾（每 60 秒一次）。'},
  cast:{id:'cast',tree:'swift',name:'詠星痕',max:5,per:2,desc:r=>`詠唱 −${r*2}%（和裝備分開計算）`},
  aspd:{id:'aspd',tree:'swift',name:'疾風星痕',max:5,per:2,desc:r=>`攻擊速度 +${r*2}%`},
  spCost:{id:'spCost',tree:'swift',name:'節律星痕',max:5,per:2,desc:r=>`SP 消耗 −${r*2}%`},
  move:{id:'move',tree:'swift',name:'流星步',max:5,per:3,desc:r=>`移動速度 +${r*3}%`},
  echo:{id:'echo',tree:'swift',name:'流星迴響',max:1,per:1,capstone:true,desc:()=>'施放技能時有 12% 機率不消耗 SP、也不進入冷卻。'},
};
export const talentPointsFor=(baseLv:number,abyssBest:number)=>Math.max(0,baseLv-39)+Math.floor(abyssBest/5);
