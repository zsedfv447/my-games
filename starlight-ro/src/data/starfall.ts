// v7.0 星淵紀元: a Diablo-style endgame on top of the existing game.
// 傳說威能 (aspects any class can use), 唯一裝備, 星光難度, and the challenge modes (深坑／圍城／印記地城／星蝕潮汐).
// Pure data: the simulation reads ASPECT / UNIQUE numbers, the rules read DIFFICULTY and the codex lists.
import type { EquipDef, EtcDef } from './items';

/** 傳說威能: class-agnostic legendary powers. They roll on 傳說 gear, can be salvaged into the 威能圖鑑 and imprinted. */
export type AspectFx='executioner'|'giantSlayer'|'berserk'|'pristine'|'momentum'|'arcLightning'|'searing'|'frostNova'|'vampiric'|'critStorm'
  |'corpseBlast'|'soulHarvest'|'meteorFall'|'echoCast'|'orbitBlades'|'spFlow'|'bastion'|'thornAura'|'phantom'|'secondWind';
/** 唯一裝備 powers: fixed on their item, never salvaged or imprinted. */
export type UniqueFx='u_starfall'|'u_voidHeart'|'u_galaxy'|'u_chrono'|'u_ouroboros'|'u_abyssEye'|'u_madKing'|'u_phoenix';

/** Numbers the simulation reads. */
export const ASPECT={
  executioner:{below:.35,amp:.4}, giantSlayer:{amp:.3}, berserk:{amp:.6}, pristine:{above:.8,amp:.25},
  momentum:{per:.04,max:10,dur:8}, arcLightning:{chance:.2,jumps:3,mult:.6,r:4}, searing:{share:.35,dur:3},
  frostNova:{chance:.08,r:2.2,freeze:1.5,mult:.5}, vampiric:{share:.025,cap:.01}, critStorm:{amp:.4,chance:.25,mult:.6},
  corpseBlast:{share:.2,r:2.2}, soulHarvest:{hp:.02,sp:2}, meteorFall:{chance:.2,mult:2.5,r:6},
  echoCast:{chance:.15,delay:.35}, orbitBlades:{dur:6,every:.5,r:1.6,mult:.35}, spFlow:{cost:.85,refund:.1},
  bastion:{chance:.15,cd:6,shield:.15,dur:4}, thornAura:{share:.4}, phantom:{dodge:.12}, secondWind:{hp:.3,cd:90},
} as const;
export const UNIQUE={
  u_starfall:{every:4,meteors:5,mult:1.5,r:2.5}, u_voidHeart:{store:.3,mult:3,r:2.5,every:1}, u_galaxy:{every:.5,r:1.8,mult:.3},
  u_chrono:{kills:15,r:7,freeze:3,amp:.3}, u_ouroboros:{cd:.5,sp:2,hp:.01}, u_abyssEye:{amp:.4,taken:.25},
  u_madKing:{per:.02,max:30,reset:2.5}, u_phoenix:{cd:120,mult:6,r:3},
} as const;
const pct=(n:number)=>`${Math.round(n*100)}%`;
export const ASPECT_TEXT:Record<AspectFx,string>={
  executioner:`對 HP 低於 ${pct(ASPECT.executioner.below)} 的敵人傷害 +${pct(ASPECT.executioner.amp)}。`,
  giantSlayer:`對菁英、MVP、首領傷害 +${pct(ASPECT.giantSlayer.amp)}。`,
  berserk:`自己 HP 越低傷害越高，最多 +${pct(ASPECT.berserk.amp)}。`,
  pristine:`HP 在 ${pct(ASPECT.pristine.above)} 以上時傷害 +${pct(ASPECT.pristine.amp)}。`,
  momentum:`每打倒一隻敵人，${ASPECT.momentum.dur} 秒內傷害 +${pct(ASPECT.momentum.per)}，最多疊 ${ASPECT.momentum.max} 層。`,
  arcLightning:`直接命中時 ${pct(ASPECT.arcLightning.chance)} 機率放出星雷，彈跳 ${ASPECT.arcLightning.jumps} 隻敵人，每次 ${pct(ASPECT.arcLightning.mult)}。`,
  searing:`直接命中讓敵人燃燒，${ASPECT.searing.dur} 秒內再受到 ${pct(ASPECT.searing.share)} 的傷害。`,
  frostNova:`直接命中時 ${pct(ASPECT.frostNova.chance)} 機率爆出霜星，凍結周圍 ${ASPECT.frostNova.r} 格的敵人 ${ASPECT.frostNova.freeze} 秒（MVP 不會被凍）並追加 ${pct(ASPECT.frostNova.mult)}。`,
  vampiric:`造成傷害的 ${(ASPECT.vampiric.share*100).toFixed(1)}% 回復成 HP（每次最多最大 HP ${pct(ASPECT.vampiric.cap)}）。`,
  critStorm:`爆擊傷害 +${pct(ASPECT.critStorm.amp)}；爆擊時 ${pct(ASPECT.critStorm.chance)} 機率再補一擊 ${pct(ASPECT.critStorm.mult)}。`,
  corpseBlast:`敵人倒下時爆炸，對 ${ASPECT.corpseBlast.r} 格內的敵人造成牠最大 HP ${pct(ASPECT.corpseBlast.share)} 的傷害（MVP 不會爆），可以連鎖。`,
  soulHarvest:`每打倒一隻敵人回復最大 HP ${pct(ASPECT.soulHarvest.hp)} 與 ${ASPECT.soulHarvest.sp} SP。`,
  meteorFall:`打倒敵人時 ${pct(ASPECT.meteorFall.chance)} 機率召喚隕星，砸向附近的敵人造成 ${pct(ASPECT.meteorFall.mult)}。`,
  echoCast:`施放攻擊技能時 ${pct(ASPECT.echoCast.chance)} 機率在 ${ASPECT.echoCast.delay} 秒後免費再放一次。`,
  orbitBlades:`施放攻擊技能後 ${ASPECT.orbitBlades.dur} 秒內，星刃環繞身邊，每 ${ASPECT.orbitBlades.every} 秒切割 ${ASPECT.orbitBlades.r} 格內的敵人 ${pct(ASPECT.orbitBlades.mult)}。`,
  spFlow:`技能 SP 消耗 −${pct(1-ASPECT.spFlow.cost)}；施放時 ${pct(ASPECT.spFlow.refund)} 機率退回全部 SP。`,
  bastion:`被打時 ${pct(ASPECT.bastion.chance)} 機率獲得最大 HP ${pct(ASPECT.bastion.shield)} 的護盾 ${ASPECT.bastion.dur} 秒（每 ${ASPECT.bastion.cd} 秒一次）。`,
  thornAura:`被打時把受到傷害的 ${pct(ASPECT.thornAura.share)} 反彈給攻擊者。`,
  phantom:`${pct(ASPECT.phantom.dodge)} 機率完全閃過攻擊。`,
  secondWind:`受到致命傷害時改為留下 ${pct(ASPECT.secondWind.hp)} HP（每 ${ASPECT.secondWind.cd} 秒一次）。`,
};
export const UNIQUE_TEXT:Record<UniqueFx,string>={
  u_starfall:`每施放 ${UNIQUE.u_starfall.every} 次攻擊技能，就在目標周圍降下 ${UNIQUE.u_starfall.meteors} 顆星隕，每顆 ${pct(UNIQUE.u_starfall.mult)}。`,
  u_voidHeart:`受到傷害的 ${pct(UNIQUE.u_voidHeart.store)} 被虛空吸收，每秒以 ${UNIQUE.u_voidHeart.mult} 倍爆發給周圍 ${UNIQUE.u_voidHeart.r} 格的敵人。`,
  u_galaxy:`4 把星刃永遠環繞身邊，每 ${UNIQUE.u_galaxy.every} 秒切割 ${UNIQUE.u_galaxy.r} 格內的敵人 ${pct(UNIQUE.u_galaxy.mult)}。`,
  u_chrono:`每打倒 ${UNIQUE.u_chrono.kills} 隻敵人，時間停止：${UNIQUE.u_chrono.r} 格內的敵人凍結 ${UNIQUE.u_chrono.freeze} 秒（MVP 變慢），期間你的傷害 +${pct(UNIQUE.u_chrono.amp)}。`,
  u_ouroboros:`每打倒一隻敵人，所有技能冷卻 −${UNIQUE.u_ouroboros.cd} 秒並回復 ${UNIQUE.u_ouroboros.sp} SP；每次施放技能回復最大 HP ${pct(UNIQUE.u_ouroboros.hp)}。`,
  u_abyssEye:`所有傷害 +${pct(UNIQUE.u_abyssEye.amp)}，但受到的傷害 +${pct(UNIQUE.u_abyssEye.taken)}。`,
  u_madKing:`每次直接命中傷害 +${pct(UNIQUE.u_madKing.per)}，最多 +${pct(UNIQUE.u_madKing.per*UNIQUE.u_madKing.max)}；${UNIQUE.u_madKing.reset} 秒沒打到東西就歸零。`,
  u_phoenix:`倒下時浴火重生：HP 全滿，並爆出 ${pct(UNIQUE.u_phoenix.mult)} 的火焰（${UNIQUE.u_phoenix.r} 格，每 ${UNIQUE.u_phoenix.cd} 秒一次）。`,
};
export const ASPECT_IDS=Object.keys(ASPECT_TEXT) as AspectFx[];
export const UNIQUE_IDS=Object.keys(UNIQUE_TEXT) as UniqueFx[];
export const ASPECT_NAMES:Record<AspectFx,string>={executioner:'處決者',giantSlayer:'屠巨者',berserk:'狂血',pristine:'無瑕',momentum:'殺戮動能',arcLightning:'星雷鎖鏈',
  searing:'灼星',frostNova:'霜星',vampiric:'血契',critStorm:'鋒暴',corpseBlast:'星骸爆裂',soulHarvest:'魂收割',meteorFall:'隕星',echoCast:'星影重施',
  orbitBlades:'環星刃',spFlow:'星流',bastion:'星壁',thornAura:'棘星',phantom:'幻步',secondWind:'不屈星魂'};

const u=(d:Omit<EquipDef,'kind'|'slots'|'jobs'|'price'>&{slots?:number}):EquipDef=>({kind:'equip',slots:1,jobs:'all',price:0,unique:true,...d});
/** 唯一裝備: only from 煉獄／星滅 elites, bosses and challenge chests. price 0 keeps them out of shops and random chest pools. */
export const uniqueGear:EquipDef[]=[
  u({id:'u_starfallCrown',name:'星隕之冠',slot:'head',def:6,mdef:10,skill:8,fx:'u_starfall',reqLv:60,desc:'王冠上的星辰會回應施法者的呼喚。',icon:{shape:'crown',color:'#ffe27a',accent:'#7d5bd6'}}),
  u({id:'u_voidHeart',name:'虛空之心',slot:'armor',def:12,hp:600,fx:'u_voidHeart',reqLv:62,desc:'胸口是一道看不見底的裂縫。',icon:{shape:'armor',color:'#3a2a5a',accent:'#c9a3ff'}}),
  u({id:'u_galaxyCloak',name:'群星披風',slot:'garment',def:5,mdef:6,aspd:6,fx:'u_galaxy',reqLv:60,desc:'披風裡包著一整片會旋轉的星空。',icon:{shape:'cape',color:'#2a3a7a',accent:'#ffe27a'}}),
  u({id:'u_chronoBoots',name:'時之流靴',slot:'shoes',def:4,delay:8,stats:{agi:4},fx:'u_chrono',reqLv:64,desc:'每一步都踩在時間的縫上。',icon:{shape:'shoes',color:'#c9d3dd',accent:'#7fd3ff'}}),
  u({id:'u_ouroboros',name:'銜尾之環',slot:'accessory',sp:120,spRegen:20,fx:'u_ouroboros',reqLv:62,desc:'沒有開始也沒有結束的環。',icon:{shape:'ring',color:'#4a8a5a',accent:'#ffd45c'}}),
  u({id:'u_abyssEye',name:'深淵之眼',slot:'accessory',crit:8,stats:{luk:5},fx:'u_abyssEye',reqLv:66,desc:'看得越深，深淵也越看著你。',icon:{shape:'ring',color:'#5a1a3a',accent:'#ff4a6a'}}),
  u({id:'u_madKingCrown',name:'狂王之冕',slot:'head',def:5,stats:{str:4,int:4,dex:4},fx:'u_madKing',reqLv:68,desc:'戴上它的王，最後都停不下來。',icon:{shape:'crown',color:'#a02a2a',accent:'#ffd45c'}}),
  u({id:'u_phoenixRobe',name:'鳳凰羽衣',slot:'armor',def:9,mdef:12,hp:400,fx:'u_phoenix',reqLv:70,desc:'燃燒殆盡之後，才是開始。',icon:{shape:'robe',color:'#ff7a3d',accent:'#ffe27a'}}),
];
export const starfallMaterials:EtcDef[]=[
  {kind:'etc',id:'starDust',name:'星塵',price:50,desc:'分解裝備得到的星塵。星淵工坊用它烙印威能、淬鍊詞綴。',icon:{shape:'shard',color:'#c9a3ff'}},
  {kind:'etc',id:'starSigil',name:'星淵印記',price:0,desc:'噩夢以上難度的菁英與首領掉落。交給星淵通訊員，開啟一場印記地城。',icon:{shape:'card',color:'#7d5bd6'}},
  {kind:'etc',id:'eclipseEmber',name:'星蝕餘燼',price:0,desc:'星蝕潮汐中打倒魔物掉落。40 個可以打開一個星蝕寶箱。',icon:{shape:'stone',color:'#ff4a6a'}},
];

/** 星光難度 (world tier). Applies to field maps and every challenge; changed in town at the 星淵通訊員. */
export type DifficultyDef={id:1|2|3|4;name:string;color:string;hp:number;atk:number;exp:number;drop:number;quality:number;unique:number;sigil:number;need:string};
export const DIFFICULTY:DifficultyDef[]=[
  {id:1,name:'普通',color:'#e8eef6',hp:1,atk:1,exp:1,drop:1,quality:1,unique:0,sigil:0,need:''},
  {id:2,name:'噩夢',color:'#c9a3ff',hp:1.8,atk:1.25,exp:1.7,drop:1.3,quality:2,unique:0,sigil:1,need:'Base Lv.45，星光深淵到第 10 層'},
  {id:3,name:'煉獄',color:'#ff7a3d',hp:3,atk:1.5,exp:2.6,drop:1.6,quality:3,unique:1,sigil:1.5,need:'Base Lv.60，星淵深坑第 10 階或印記地城等級 8'},
  {id:4,name:'星滅',color:'#ff4a6a',hp:5,atk:1.85,exp:3.6,drop:2,quality:4,unique:2.5,sigil:2,need:'Base Lv.75，星淵深坑第 25 階或星潮圍城撐過 8 波'},
];
/** Drop chances at a tier (multiplied by DIFFICULTY.unique / .sigil). */
export const STARFALL_DROPS={unique:{normal:.0006,elite:.02,boss:.12},sigil:{normal:.003,elite:.08,boss:.35}};

/** 星淵深坑: a timed ladder. Fill the bar by killing, then beat the guardian before time runs out. */
export const PIT={time:300,need:60,elite:4,alive:9,every:.7,level:(tier:number)=>30+tier*2};
/** 星潮圍城: survive waves; between waves pick one of three boons. 星焰 turns into the reward at the end. */
export const HORDE={waves:8,waveTime:40,spawnEvery:(wave:number)=>Math.max(.7,2.2-wave*.18),cap:(wave:number)=>5+wave*2,perEmber:20,level:(baseLv:number,wave:number)=>Math.max(32,baseLv-14)+Math.round(wave*1.5)};
export type BoonId='fury'|'leech'|'flow'|'nova'|'aegis'|'storm'|'greed'|'swarm'|'phoenix'|'slow'|'giant'|'haste';
export const BOONS:Record<BoonId,{name:string;icon:string;desc:string;risk?:boolean}>={
  fury:{name:'星火之怒',icon:'🔥',desc:'傷害 +25%（可疊加）。'},
  leech:{name:'吸血之月',icon:'🌙',desc:'造成傷害的 4% 回復成 HP。'},
  flow:{name:'星流',icon:'💧',desc:'技能 SP 消耗 −30%，SP 回復加倍。'},
  nova:{name:'爆裂星骸',icon:'💥',desc:'敵人倒下時爆炸，造成牠最大 HP 25% 的範圍傷害。'},
  aegis:{name:'星盾',icon:'🛡️',desc:'每 10 秒獲得最大 HP 20% 的護盾。'},
  storm:{name:'雷暴',icon:'⚡',desc:'每 1.5 秒落雷打中附近一隻敵人 200%。'},
  greed:{name:'貪婪',icon:'💰',desc:'星焰 ×1.5，但敵人 HP +30%。',risk:true},
  swarm:{name:'狂潮',icon:'🌊',desc:'敵人數量 +50%，星焰 ×2。',risk:true},
  phoenix:{name:'不死鳥',icon:'🪶',desc:'這場圍城中倒下一次會立刻復活。'},
  slow:{name:'時緩',icon:'⏳',desc:'敵人移動與攻擊變慢 25%。'},
  giant:{name:'巨人殺手',icon:'🗡️',desc:'對菁英與首領傷害 +50%。'},
  haste:{name:'疾風',icon:'💨',desc:'移動速度 +25%，技能延遲 −20%。'},
};
export const BOON_IDS=Object.keys(BOONS) as BoonId[];
/** 星淵印記地城: 3 rooms then a guardian; each run rolls modifiers. Clearing raises the sigil level and teaches a 威能. */
export const SIGIL={rooms:3,level:(lv:number)=>32+lv*2,roomSize:(room:number)=>10+room*3};
export type SigilAffix='lava'|'frenzy'|'armored'|'vamp'|'deathburst'|'swift'|'bounty'|'treasure'|'blessing';
export const SIGIL_AFFIXES:Record<SigilAffix,{name:string;desc:string;good?:boolean}>={
  lava:{name:'熔岩地面',desc:'每 5 秒你腳下會冒出熔岩，快走開。'},
  frenzy:{name:'狂熱',desc:'魔物攻擊力 +30%。'},
  armored:{name:'堅甲',desc:'魔物 HP +40%。'},
  vamp:{name:'吸血之月',desc:'魔物打中你會回血。'},
  deathburst:{name:'亡語爆裂',desc:'魔物倒下時預告爆炸。'},
  swift:{name:'疾行',desc:'魔物移動速度 +40%。'},
  bounty:{name:'豐收',desc:'經驗值 +50%。',good:true},
  treasure:{name:'寶藏',desc:'通關寶箱多一件傳說裝備。',good:true},
  blessing:{name:'星光祝福',desc:'你的傷害 +20%。',good:true},
};
export const SIGIL_BAD:SigilAffix[]=['lava','frenzy','armored','vamp','deathburst','swift'];
export const SIGIL_GOOD:SigilAffix[]=['bounty','treasure','blessing'];
/** 星蝕潮汐: a field world event on 噩夢 and above. */
export const ECLIPSE={dur:150,hp:1.4,atk:1.2,emberChance:.6,eliteEmbers:5,chests:2,chestCost:40};
