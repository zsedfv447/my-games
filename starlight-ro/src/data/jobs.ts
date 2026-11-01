// Jobs and skill trees. Names are original; the structure follows classic RO:
// Novice → first job at Job Lv.10 with Basic Skill Lv.9, one skill point per job level.
export type JobId = 'novice'|'swordman'|'mage'|'archer'|'knight'|'wizard'|'ranger';
export type Stat = 'str'|'agi'|'vit'|'int'|'dex'|'luk';
export type Element = 'neutral'|'fire'|'water'|'wind'|'earth';
export type SkillTarget = 'enemy'|'ground'|'self'|'passive';
export type SkillTag = 'melee'|'ranged'|'magic'|'single'|'area'|'bolt'|'buff';

export const statNames: Record<Stat,string> = {str:'STR',agi:'AGI',vit:'VIT',int:'INT',dex:'DEX',luk:'LUK'};
export const statHints: Record<Stat,string> = {
  str:'近戰攻擊力', agi:'攻擊速度、迴避', vit:'最大 HP、防禦、HP 回復',
  int:'魔法攻擊力、最大 SP、SP 回復', dex:'命中、遠程攻擊力、縮短詠唱', luk:'爆擊、完全迴避',
};
export const elementNames: Record<Element,string> = {neutral:'無',fire:'火',water:'水',wind:'風',earth:'地'};

export type JobDef = {
  id:JobId; name:string; maxJobLv:number; hpFactor:number; spFactor:number;
  /** Seconds between basic attacks before AGI/DEX. */
  attackDelay:number; weapons:string[]; color:string; desc:string;
};
export const jobs: Record<JobId,JobDef> = {
  novice:{id:'novice',name:'初心者',maxJobLv:10,hpFactor:5,spFactor:1,attackDelay:.9,weapons:['dagger','sword','staff'],color:'#c9a46b',
    desc:'每位冒險者的起點。職業等級 10、基本技能 Lv.9 後即可轉職。'},
  swordman:{id:'swordman',name:'劍士',maxJobLv:70,hpFactor:8,spFactor:2,attackDelay:.72,weapons:['dagger','sword'],color:'#d9534f',
    desc:'站在最前線的近戰職業，HP 高、能以重斬與爆破開路。'},
  mage:{id:'mage',name:'法師',maxJobLv:70,hpFactor:5,spFactor:6,attackDelay:.75,weapons:['dagger','staff'],color:'#7d5bd6',
    desc:'詠唱元素魔法，從遠處以火焰矢與雷暴殲滅魔物。'},
  archer:{id:'archer',name:'弓手',maxJobLv:70,hpFactor:5,spFactor:2,attackDelay:.8,weapons:['bow','dagger'],color:'#3f9e5a',
    desc:'在遠距離連續射擊，以二連矢與箭雨壓制群體。'},
  // v6.0 二轉: the character keeps its first job (gear, passives and old checks unchanged); these add a second track.
  knight:{id:'knight',name:'星誓騎士',maxJobLv:30,hpFactor:8,spFactor:2,attackDelay:.72,weapons:['dagger','sword'],color:'#e8a33a',
    desc:'把近戰的氣勢累積成【戰意】（每得到 1 層回復 4 SP），再以裂星重斬、星落裁決一口氣釋放；也能化為護壁反擊。'},
  wizard:{id:'wizard',name:'星紋魔導士',maxJobLv:30,hpFactor:5,spFactor:6,attackDelay:.75,weapons:['dagger','staff'],color:'#5b7dd6',
    desc:'把火、冰、雷三系研究得更深：火場、冰場、星樁布陣，以星紋奧義收尾。'},
  ranger:{id:'ranger',name:'蒼穹遊俠',maxJobLv:30,hpFactor:5,spFactor:2,attackDelay:.8,weapons:['bow','dagger'],color:'#2fa08a',
    desc:'標記獵物、狙擊、貫穿與陷阱，還有會自己出擊的獵鷹。'},
};
export const firstJobs: JobId[] = ['swordman','mage','archer'];
/** v6.0: each first job's second job. */
export const secondJobOf: Partial<Record<JobId,JobId>> = {swordman:'knight',mage:'wizard',archer:'ranger'};
export const secondJobs: JobId[] = ['knight','wizard','ranger'];
export const JOB2_REQ = {baseLv:60,jobLv:50} as const;

export type SkillDef = {
  id:string; job:JobId; name:string; maxLv:number; target:SkillTarget; tags:SkillTag[];
  element:Element; range:number; prereq:Record<string,number>;
  sp:(lv:number)=>number; cast:(lv:number)=>number; delay:number; cooldown?:number;
  desc:(lv:number)=>string; icon:string;
  /** v6.0 second-job skills: minimum second-job level to learn. */
  jobReq?:number;
  /** v6.2: only usable while riding (騎士的大嘴鳥／幼龍). */
  mounted?:boolean;
};
const flat=(n:number)=>()=>n;
/** v6.5 劍士戰魂: one rule set at a time (chosen in the skills window, free to switch in town). Unlocked at first-job Job 10/20/25. */
export type SoulId='art'|'flame'|'chain'|'rock';
export const SOULS:Record<SoulId,{name:string;icon:string;color:string;unlock:number;role:string;desc:string;bash:string;magnum:string;endure?:string;basic?:string;
  /** v7.1 二轉戰魂共鳴: the knight version of this soul, and how it changes knight skills. */
  knight:string;k:Partial<Record<string,string>>}>={
  art:{name:'戰技之魂',icon:'⚔️',color:'#e8eef6',unlock:1,role:'短戰、分散的怪、立刻清場',desc:'所有技能維持原樣。用完一招攻擊技能後換另一招，觸發【變招劍氣】；技能 SP −10%。',
    bash:'連環重斬（原樣）',magnum:'烈焰爆破（爆炸＋附刃，原樣）',
    knight:'萬技騎士：變招劍氣也給 1 層戰意。',k:{k_wheel:'換招後施放多轉一圈',k_judgment:'最近 8 秒每用過一種攻擊技能 +15%（最多 +60%）'}},
  flame:{name:'烈焰之魂',icon:'🔥',color:'#ff8a3d',unlock:10,role:'密集怪群持續清怪',desc:'以附刃普攻為主：每 2 下普攻順劈一次（順劈傷害 ×1.25），烈焰爆破上的範圍卡片改在順劈時發動（王者脈動不擊退）。',
    bash:'焰影追斬：小距離貼近目標，快速兩刀，之後 2 次普攻帶強化火焰',magnum:'烈焰附刃：22 秒附刃，施放時只有小範圍火焰',
    knight:'焰誓騎士：附刃中每一下普攻都順劈（只砍目標身旁的敵人）；消耗戰意時，每層讓附刃延長 2 秒。',k:{k_wheel:'焰輪旋斬：火屬性、傷害 ×1.25、範圍 +0.5 格，打中 2 隻以上時發動烈焰爆破上的範圍卡片（不擊退），每次命中帶附刃火焰，打中 2 隻以上的那一圈算一次順劈進度，並讓附刃延長 3 秒',k_charge:'焰痕突進：火屬性，刷新附刃，之後 2 下普攻帶強化火焰'}},
  chain:{name:'連斬之魂',icon:'🗡️',color:'#c9d3ff',unlock:20,role:'打王、單體爆發',desc:'以技能輸出為主：連斬追加殘影、收招更快、命中返還 SP；普攻每下多回 1 SP。目標中途倒下時，剩下的刀會跳到旁邊的敵人。',
    bash:'疾影連斬：最後一刀追加殘影（周圍 1.4 格），收招更快，命中返還 20% SP；目標倒下時剩下的刀會跳到附近敵人',magnum:'斬勢爆破：周圍 2.4 格斬擊，下一次連斬的最後一刀 ×1.5（不附刃）',
    knight:'影刃騎士：斬勢爆破的強化也作用在疾影裂星的最後一刀。',k:{k_rend:'疾影裂星：拆成 3 刀＋每層戰意 1 刀，總傷害 ×1.25，最後殘影斬周圍；目標倒下時剩下的刀會跳刀；吃斬勢爆破的 ×1.5',k_judgment:'只打中一個目標時 ×1.4'}},
  rock:{name:'磐石之魂',icon:'🛡️',color:'#9ad08a',unlock:25,role:'耐打、省藥、被圍攻時反超',desc:'反擊流：鐵壁意志變成磐石架勢，被打（近戰或遠程）每 0.5 秒反擊周圍，挨打越多越痛；反擊依 ATK 與最大 HP 計算。守勢（最多 5 層）每層讓反擊 +10%，不會被用掉，離開戰鬥 6 秒後慢慢消退。普攻 −5%。',
    bash:'撼地斬：最後一擊產生震波、累積守勢，並挑釁周圍 3 格的敵人過來打你',magnum:'震地反擊：立刻對周圍 2.4 格放出一次強力反擊（反擊傷害 ×200%＋每級 30%，吃守勢加成，不消耗守勢）',endure:'磐石架勢：防禦提升，被打時每 0.5 秒反擊周圍並累積守勢（0～5）',
    knight:'磐誓騎士：護壁存在時磐石反擊 +30%。',k:{k_ward:'磐石誓壁：同時進入磐石架勢；反擊光刃改用反擊公式打周圍 2.4 格並累積守勢（自動戰鬥被 3 隻以上圍住就會開）',k_wheel:'挑釁旋斬：打中的敵人都會被挑釁過來打你，並累積守勢',k_quake:'撼岳戰陣：用反擊公式造成傷害（×100%＋每級 20%，吃守勢加成），範圍每層守勢 +0.3 格，不消耗守勢',k_trample:'最後一下踩中時累積 1 層守勢'}},
};
export const SOUL_IDS=Object.keys(SOULS) as SoulId[];
/** v6.2 swordman numbers (first round): 連環重斬 and 烈焰附刃. */
export const SW={
  /** v6.5 戰魂 numbers (tuned with tools/sword-stages.ts). */
  artProc:.8,artCd:2.5,artSp:.9, flameDur:22,flameCast:(lv:number)=>.4+.04*lv,flameEvery:2,flameCleave:1.25,chase:(lv:number)=>(1+.3*lv)*.725,chaseFire:.6,
  chainImage:.8,chainDelay:.8,chainRefund:.2,chainBasic:1,chainR:2.4,chainBreak:(lv:number)=>.8+.1*lv,chainEmp:1.5,chainBasicSp:1,
  /** v7.1 騎士共鳴. */
  kArtJudge:.15,kArtMax:4,kArtWin:8,kFlameWheel:3,kFlameR:.5,kFlameCleave:1,kFlameWheelHit:1.25,kFlameSpend:2,kChainCuts:3,kChainRend:1.25,kChainSolo:1.4,kRockQuake:.5,kRockQuakeR:.3,kRockWard:1.3,kRockQuakeC:(lv:number)=>1+.2*lv,
  rockBasic:.95,rockR:2.4,rockAtk:1.1,rockHp:.012,rockHpCap:.65,rockWave:.8,rockBlast:.6,guardMax:5,guardAmp:.1,guardIdle:6,rockTaunt:3,rockBurst:(lv:number)=>2+.3*lv,heart:1.2,
  bashHits:(lv:number)=>lv>=7?4:lv>=4?3:2, bashPer:(lv:number)=>(1+.3*lv)/(lv>=7?4:lv>=4?3:2), wave:.6,
  enchantDur:15, enchantFire:(lv:number)=>.08+.012*lv, enchantSp:1, cleaveEvery:4, cleave:(lv:number)=>.3+.03*lv, cleaveR:2.3,
};
export const skills: Record<string,SkillDef> = {
  basic:{id:'basic',job:'novice',name:'基本技能',maxLv:9,target:'passive',tags:[],element:'neutral',range:0,prereq:{},
    sp:flat(0),cast:flat(0),delay:0,icon:'basic',
    desc:lv=>`冒險的基本功。Lv.${lv}${lv>=9?'：已可以轉職':'；Lv.9 才能轉職'}。`},
  firstAid:{id:'firstAid',job:'novice',name:'急救',maxLv:1,target:'self',tags:['buff'],element:'neutral',range:0,prereq:{basic:3},
    sp:flat(3),cast:flat(0),delay:.5,icon:'firstAid',desc:()=>'包紮傷口，立刻回復 15 HP。'},
  // —— 劍士 ——
  swordMastery:{id:'swordMastery',job:'swordman',name:'劍術精通',maxLv:10,target:'passive',tags:[],element:'neutral',range:0,prereq:{},
    sp:flat(0),cast:flat(0),delay:0,icon:'swordMastery',desc:lv=>`使用短劍、劍時攻擊力 +${lv*4}。劍士的近戰普攻每命中一次回復 1 SP。`},
  hpRecovery:{id:'hpRecovery',job:'swordman',name:'生命恢復',maxLv:10,target:'passive',tags:[],element:'neutral',range:0,prereq:{},
    sp:flat(0),cast:flat(0),delay:0,icon:'hpRecovery',desc:lv=>`每 10 秒額外回復 ${lv*5} + 最大 HP ${lv*0.2}% 的 HP。`},
  // v6.2 劍士重做：重斬 → 連環多段斬；烈焰爆破 → 爆炸＋烈焰附刃（普攻成為劍士的核心）。ID 與技能點不變。
  bash:{id:'bash',job:'swordman',name:'重斬',maxLv:10,target:'enemy',tags:['melee','single'],element:'neutral',range:1.6,prereq:{},
    sp:lv=>lv<=5?8:14,cast:flat(0),delay:.35,icon:'bash',desc:lv=>`連環重斬：瞬間連砍 ${SW.bashHits(lv)} 刀，每刀 ${Math.round(SW.bashPer(lv)*100)}%（共 ${Math.round(SW.bashPer(lv)*SW.bashHits(lv)*100)}%），命中率 +${lv*5}%；最後一刀揮出劍氣，波及目標身旁的敵人（${Math.round(SW.bashPer(lv)*SW.wave*100)}%）。烈焰附刃中每一刀都帶火焰。（戰魂會改變這招）`},
  magnum:{id:'magnum',job:'swordman',name:'烈焰爆破',maxLv:10,target:'self',tags:['melee','area'],element:'fire',range:0,prereq:{bash:5},
    sp:flat(20),cast:flat(0),delay:.8,cooldown:6,icon:'magnum',desc:lv=>`以自身為中心爆炸，對 2 格內敵人造成 ${100+20*lv}% 火屬性傷害，並讓武器燃燒 ${SW.enchantDur} 秒【烈焰附刃】：普攻追加 ${Math.round(SW.enchantFire(lv)*100)}% 火焰傷害、命中回復 ${SW.enchantSp} SP，每第 ${SW.cleaveEvery} 下揮出扇形火焰順劈（${Math.round(SW.cleave(lv)*100)}%）。（戰魂會改變這招，詳見技能視窗）`},
  provoke:{id:'provoke',job:'swordman',name:'挑撥',maxLv:10,target:'enemy',tags:['single'],element:'neutral',range:6,prereq:{},
    sp:lv=>3+lv,cast:flat(0),delay:.3,icon:'provoke',desc:lv=>`激怒魔物 30 秒：防禦 -${5+lv*5}%，攻擊 +${2+lv*3}%。`},
  endure:{id:'endure',job:'swordman',name:'鐵壁意志',maxLv:10,target:'self',tags:['buff'],element:'neutral',range:0,prereq:{provoke:5},
    sp:flat(10),cast:flat(0),delay:.3,cooldown:10,icon:'endure',desc:lv=>`${7+lv*3} 秒內防禦 +${lv*2}，受傷時不中斷動作。`},
  // —— 法師 ——
  spRecovery:{id:'spRecovery',job:'mage',name:'魔力恢復',maxLv:10,target:'passive',tags:[],element:'neutral',range:0,prereq:{},
    sp:flat(0),cast:flat(0),delay:0,icon:'spRecovery',desc:lv=>`每 10 秒額外回復 ${lv*3} + 最大 SP ${lv*0.2}% 的 SP。`},
  fireBolt:{id:'fireBolt',job:'mage',name:'火焰矢',maxLv:10,target:'enemy',tags:['magic','bolt','single'],element:'fire',range:9,prereq:{},
    sp:lv=>10+lv*2,cast:lv=>.5*lv,delay:.5,icon:'fireBolt',desc:lv=>`召喚 ${lv} 支火焰矢，每支 100% 魔法傷害並疊 1 層【灼燒】（每層每秒 6% MATK，4 秒，最多 5 層）。用爆炎球引爆。`},
  coldBolt:{id:'coldBolt',job:'mage',name:'冰霜矢',maxLv:10,target:'enemy',tags:['magic','bolt','single'],element:'water',range:9,prereq:{},
    sp:lv=>10+lv*2,cast:lv=>.5*lv,delay:.5,icon:'coldBolt',desc:lv=>`召喚 ${lv} 支冰霜矢，每支 100% 魔法傷害並疊 1 層【寒氣】（每層緩速 8%）。滿 5 層化為【寒冰印記】（6 秒），並冰凍普通魔物 1.5 秒；MVP 不會被凍，但印記照樣成立。`},
  lightningBolt:{id:'lightningBolt',job:'mage',name:'雷鳴矢',maxLv:10,target:'enemy',tags:['magic','bolt','single'],element:'wind',range:9,prereq:{},
    sp:lv=>10+lv*2,cast:lv=>.5*lv,delay:.5,icon:'lightningBolt',desc:lv=>`召喚 ${lv} 道雷擊，每道 100% 魔法傷害並使目標【感電】4 秒；每 4 次命中追加一記 120% 落雷。每道 30% 機率連鎖到附近敵人（60%），沒有其他敵人時改為回彈原目標（50%）。`},
  fireBall:{id:'fireBall',job:'mage',name:'爆炎球',maxLv:10,target:'enemy',tags:['magic','area'],element:'fire',range:9,prereq:{fireBolt:4},
    sp:flat(25),cast:lv=>lv<=5?1.5:1,delay:.8,icon:'fireBall',desc:lv=>`擲出火球，在目標周圍 2 格爆炸，造成 ${70+10*lv}% 傷害。【引爆】命中前已有的灼燒：每層追加 25% MATK，並把 2 層灼燒擴散給附近最多 3 個敵人。`},
  frostDiver:{id:'frostDiver',job:'mage',name:'冰封術',maxLv:10,target:'enemy',tags:['magic','single'],element:'water',range:9,prereq:{coldBolt:5},
    sp:lv=>25-lv,cast:flat(.8),delay:1,icon:'frostDiver',desc:lv=>`造成 ${110+10*lv}% 傷害，${35+3*lv}% 機率冰凍 ${lv*1.5} 秒。目標帶【寒冰印記】時觸發【碎冰】：消耗印記，追加 150% MATK，並射出 2 枚冰片（各 50%）；沒有印記時改為疊 3 層寒氣。`},
  thunderStorm:{id:'thunderStorm',job:'mage',name:'雷暴',maxLv:10,target:'ground',tags:['magic','area'],element:'wind',range:9,prereq:{lightningBolt:4},
    sp:lv=>24+lv*5,cast:lv=>lv,delay:1,icon:'thunderStorm',desc:lv=>`在地面 5×5 範圍降下 ${lv} 次雷擊，每次 80% 傷害；打到【感電】中的敵人時傷害 +20%。`},
  // —— 弓手 ——
  owlEye:{id:'owlEye',job:'archer',name:'鷹眼專注',maxLv:10,target:'passive',tags:[],element:'neutral',range:0,prereq:{},
    sp:flat(0),cast:flat(0),delay:0,icon:'owlEye',desc:lv=>`DEX +${lv}。`},
  vulture:{id:'vulture',job:'archer',name:'遠射',maxLv:10,target:'passive',tags:[],element:'neutral',range:0,prereq:{owlEye:3},
    sp:flat(0),cast:flat(0),delay:0,icon:'vulture',desc:lv=>`弓的射程 +${lv*0.5} 格，命中 +${lv}。`},
  doubleStrafe:{id:'doubleStrafe',job:'archer',name:'二連矢',maxLv:10,target:'enemy',tags:['ranged','single'],element:'neutral',range:9,prereq:{},
    sp:flat(12),cast:flat(0),delay:.45,icon:'doubleStrafe',desc:lv=>`連續射出 2 箭，每箭造成 ${100+10*lv}% 傷害。`},
  arrowShower:{id:'arrowShower',job:'archer',name:'箭雨',maxLv:10,target:'ground',tags:['ranged','area'],element:'neutral',range:9,prereq:{doubleStrafe:5},
    sp:flat(15),cast:flat(0),delay:.8,icon:'arrowShower',desc:lv=>`箭雨落在 3×3 範圍，造成 ${80+5*lv}% 傷害並擊退。`},
  concentrate:{id:'concentrate',job:'archer',name:'專注凝神',maxLv:10,target:'self',tags:['buff'],element:'neutral',range:0,prereq:{vulture:1},
    sp:lv=>20+lv*5,cast:flat(0),delay:.3,cooldown:5,icon:'concentrate',desc:lv=>`${40+lv*20} 秒內 AGI 與 DEX +${2+lv}%。`},
  chargeArrow:{id:'chargeArrow',job:'archer',name:'震退箭',maxLv:1,target:'enemy',tags:['ranged','single'],element:'neutral',range:9,prereq:{arrowShower:5},
    sp:flat(15),cast:flat(.5),delay:1,icon:'chargeArrow',desc:()=>'造成 150% 傷害並擊退目標 5 格。'},
};
export const skillsOf = (job:JobId) => Object.values(skills).filter(s=>s.job===job);
/** Skills a job can use: its own plus everything learned as a Novice (and the second job's, once changed). */
export const usableJobs = (job:JobId,job2?:JobId|null):JobId[] => job==='novice'?['novice']:job2?['novice',job,job2]:['novice',job];

export const baseLevelCap = 90; // v6.0 星燈航路 (v5.0: 80)
// v5.0: steeper past Lv.45 so the new region is a real journey (unchanged below 45).
export const baseExpNeed = (lv:number) => Math.round((10 + 6*lv**2)*(1+Math.max(0,lv-45)*.12));
export const jobExpNeed = (job:JobId,jl:number) => job==='novice'?Math.round(8+4*jl**1.6):Math.round((20+9*jl**2)*(1+Math.max(0,jl-50)*.15));
/** v6.0 second-job EXP (Job 1→30 ≈ 3M; Lv.70 monsters give ~2.2k job EXP each). */
export const job2ExpNeed = (jl:number) => Math.round(20000+280*jl**2);
export const JOB2_MAX = 30;
export const statPointsAtLevel = (lv:number) => 3 + Math.floor(lv/5);
/** RO-style rising cost: raising a stat from s to s+1 costs 2 + floor((s-1)/10). */
export const statRaiseCost = (s:number) => 2 + Math.floor((s-1)/10);
export const startingStatPoints = 30;

// ═══════════ v6.0 二轉技能（Lv.1～5；初版數值） ═══════════
const L5=(a:number,b:number)=>(lv:number)=>a+(b-a)*(lv-1)/4;
const pc=(x:number)=>`${Math.round(x*100)}%`;
/** 星誓騎士 戰意. */
export const RESOLVE={max:5,decayAfter:8,decayEvery:2,basicHits:3,sp:4};
export const K={
  wheel:{hit:L5(.7,1.05),r:2.5},charge:{mult:L5(2,3.2),reach:6},ward:{base:L5(.06,.1),per:.03,dur:8,counter:L5(1,2)},
  rend:{mult:L5(3,4.6),per:L5(.35,.55)},quake:{mult:L5(1.2,2),tick:L5(.25,.45),dur:5,r:3},training:{hp:L5(.04,.2),next:L5(.08,.2)},
  judgment:{mult:L5(5,8),per:.6,r:4.2},
  /** v6.2 騎乘戰鬥: mounted knights keep fighting on their bird; trample is mount-only. */
  mount:{atk:.05,range:.6},trample:{mult:L5(.9,1.4),r:4,stomps:3,dragon:1.25},
};
export const W={
  flame:{mult:L5(1.2,1.8),tick:L5(.3,.5),dur:6,r:2.5,det:L5(.07,.15)},frost:{mult:L5(1.2,1.8),tick:L5(.35,.6),dur:4,r:2.5},
  totem:{mult:L5(.9,1.5),echo:L5(.5,1),dur:6,r:3},veil:{sp:L5(.5,.9),dur:6},ascend:{dur:L5(6,10),strike:L5(.3,.6)},
  study:{sp:L5(.03,.15),cut:L5(.1,.3),matk:L5(2,10)},arcana:{fire:L5(5,8.5),ice:L5(4.4,7.2),bolt:L5(1,1.6),r:3},
};
export const RG={
  mark:{dmg:L5(.08,.16),dur:12},snipe:{mult:L5(4.2,6.2),marked:L5(.6,1)},pierce:{mult:L5(2.6,4.1),len:7},barrage:{mult:L5(.8,1.2),n:5},
  trap:{mult:L5(2.2,3.4),max:2,dur:12,r:2},falcon:{aspd:L5(2,10),chance:L5(.1,.3),mult:L5(1,1.8),sp:4},starRain:{mult:L5(1.4,2.35),r:2.5},
};
Object.assign(skills,{
  // —— 星誓騎士 ——
  k_wheel:{id:'k_wheel',job:'knight',name:'星輪旋斬',maxLv:5,target:'self',tags:['melee','area'],element:'neutral',range:0,prereq:{},jobReq:1,
    sp:flat(12),cast:flat(0),delay:.5,cooldown:3,icon:'k_wheel',desc:lv=>`以自身為中心連斬 3 次，每次對 ${K.wheel.r} 格內敵人造成 ${pc(K.wheel.hit(lv))} 傷害。命中取得 1 層【戰意】，打中 3 隻以上取得 2 層。`},
  k_charge:{id:'k_charge',job:'knight',name:'破陣突進',maxLv:5,target:'enemy',tags:['melee','area'],element:'neutral',range:K.charge.reach,prereq:{k_wheel:1},jobReq:3,
    sp:flat(12),cast:flat(0),delay:.35,cooldown:7,icon:'k_charge',desc:lv=>`衝向 ${K.charge.reach} 格內的目標，沿途敵人與目標受到 ${pc(K.charge.mult(lv))} 傷害並取得戰意。不能穿牆。`},
  k_ward:{id:'k_ward',job:'knight',name:'守誓護壁',maxLv:5,target:'self',tags:['buff'],element:'neutral',range:0,prereq:{k_wheel:2},jobReq:6,
    sp:flat(16),cast:flat(0),delay:.25,cooldown:15,icon:'k_ward',desc:lv=>`消耗全部戰意，展開 ${K.ward.dur} 秒護盾：最大 HP ${pc(K.ward.base(lv))}，每層戰意再加 3%。護盾存在時被攻擊會反擊光刃 ${pc(K.ward.counter(lv))}（每秒最多一次）。`},
  k_rend:{id:'k_rend',job:'knight',name:'裂星重斬',maxLv:5,target:'enemy',tags:['melee','single'],element:'neutral',range:1.8,prereq:{k_wheel:1},jobReq:5,
    sp:flat(18),cast:flat(0),delay:.55,cooldown:5,icon:'k_rend',desc:lv=>`單體 ${pc(K.rend.mult(lv))} 傷害，消耗全部戰意，每層再加 ${pc(K.rend.per(lv))}（滿 5 層共 ${pc(K.rend.mult(lv)+5*K.rend.per(lv))}）。`},
  k_quake:{id:'k_quake',job:'knight',name:'震地戰陣',maxLv:5,target:'self',tags:['melee','area'],element:'earth',range:0,prereq:{k_wheel:3},jobReq:10,
    sp:flat(18),cast:flat(.3),delay:.45,cooldown:12,icon:'k_quake',desc:lv=>`重擊地面造成 ${pc(K.quake.mult(lv))} 傷害，留下 ${K.quake.dur} 秒戰陣：每秒 ${pc(K.quake.tick(lv))} 傷害並緩速。同時只有一個戰陣。`},
  k_trample:{id:'k_trample',job:'knight',name:'大嘴鳥踐踏',maxLv:5,target:'enemy',tags:['melee','area'],element:'neutral',range:3.5,prereq:{k_charge:1},jobReq:8,mounted:true,
    sp:flat(16),cast:flat(0),delay:.5,cooldown:6,icon:'k_trample',desc:lv=>`騎乘時才能使用。坐騎朝目標方向連踩 ${K.trample.stomps} 下，每下對前方扇形 ${K.trample.r} 格內敵人造成 ${pc(K.trample.mult(lv))} 傷害。騎著熔岩幼龍時化為【龍息】：火屬性、傷害 ×${K.trample.dragon}。`},
  k_training:{id:'k_training',job:'knight',name:'騎士訓練',maxLv:5,target:'passive',tags:[],element:'neutral',range:0,prereq:{},jobReq:1,
    sp:flat(0),cast:flat(0),delay:0,icon:'k_training',desc:lv=>`最大 HP +${pc(K.training.hp(lv))}。（星誓騎士天生會騎乘戰鬥：騎著坐騎也能攻擊，攻擊力 +5%、普攻距離 +0.6 格。）消耗戰意後 6 秒內，下一個一轉近戰技能（重斬、烈焰爆破）傷害 +${pc(K.training.next(lv))}。`},
  k_judgment:{id:'k_judgment',job:'knight',name:'星落裁決',maxLv:5,target:'enemy',tags:['melee','area'],element:'neutral',range:2.5,prereq:{k_rend:3},jobReq:20,
    sp:flat(36),cast:flat(.4),delay:.8,cooldown:18,icon:'k_judgment',desc:lv=>`奧義。朝目標方向揮出星光扇形斬（${K.judgment.r} 格）造成 ${pc(K.judgment.mult(lv))} 傷害，消耗全部戰意，每層再加 60%。`},
  // —— 星紋魔導士 ——
  w_flame:{id:'w_flame',job:'wizard',name:'焰環熔域',maxLv:5,target:'ground',tags:['magic','area'],element:'fire',range:9,prereq:{fireBolt:4},jobReq:1,
    sp:flat(24),cast:flat(1),delay:.5,cooldown:10,icon:'w_flame',desc:lv=>`${W.flame.dur} 秒火場（半徑 ${W.flame.r}）：初擊 ${pc(W.flame.mult(lv))} 並給 2 層【灼燒】，之後每秒 ${pc(W.flame.tick(lv))}。火場內的爆炎球引爆時，每層灼燒再加 ${pc(W.flame.det(lv))}。`},
  w_frost:{id:'w_frost',job:'wizard',name:'霜環囚域',maxLv:5,target:'ground',tags:['magic','area'],element:'water',range:9,prereq:{coldBolt:5},jobReq:1,
    sp:flat(24),cast:flat(1.1),delay:.5,cooldown:11,icon:'w_frost',desc:lv=>`${W.frost.dur} 秒冰場：初擊 ${pc(W.frost.mult(lv))} 並給 2 層【寒氣】，之後每秒 ${pc(W.frost.tick(lv))} 再加 1 層。滿層照樣形成寒冰印記（MVP 也會）。`},
  w_totem:{id:'w_totem',job:'wizard',name:'導雷星樁',maxLv:5,target:'ground',tags:['magic','area'],element:'wind',range:9,prereq:{lightningBolt:4},jobReq:1,
    sp:flat(26),cast:flat(.8),delay:.4,cooldown:10,icon:'w_totem',desc:lv=>`立起 ${W.totem.dur} 秒星樁：第 0／2／4 秒各電擊最多 3 隻敵人 ${pc(W.totem.mult(lv))} 並【感電】。雷鳴矢在星樁範圍內落雷時，星樁追擊 ${pc(W.totem.echo(lv))}（每次施法一次）。`},
  w_veil:{id:'w_veil',job:'wizard',name:'星紋護幕',maxLv:5,target:'self',tags:['buff'],element:'neutral',range:0,prereq:{},jobReq:5,
    sp:flat(20),cast:flat(0),delay:.2,cooldown:14,icon:'w_veil',desc:lv=>`${W.veil.dur} 秒護盾，吸收量＝最大 SP 的 ${pc(W.veil.sp(lv))}。`},
  w_ascend:{id:'w_ascend',job:'wizard',name:'星紋昇華',maxLv:5,target:'self',tags:['buff'],element:'neutral',range:0,prereq:{},jobReq:15,
    sp:flat(60),cast:flat(.3),delay:.4,cooldown:30,icon:'w_ascend',desc:lv=>`${W.ascend.dur(lv)} 秒內：爆炎球引爆後保留 2 層灼燒；碎冰沒有其他目標時冰片改打主目標；每次雷鳴矢的第一次落雷 +${pc(W.ascend.strike(lv))}。`},
  w_study:{id:'w_study',job:'wizard',name:'星紋研習',maxLv:5,target:'passive',tags:[],element:'neutral',range:0,prereq:{},jobReq:1,
    sp:flat(0),cast:flat(0),delay:0,icon:'w_study',desc:lv=>`最大 SP +${pc(W.study.sp(lv))}、魔法攻擊 +${W.study.matk(lv)}%。每施放 3 次一轉法術，下一個二轉技能 SP −${pc(W.study.cut(lv))}。`},
  w_arcana:{id:'w_arcana',job:'wizard',name:'星紋奧義',maxLv:5,target:'enemy',tags:['magic','area'],element:'neutral',range:9,prereq:{},jobReq:20,
    sp:flat(48),cast:flat(1.5),delay:1,cooldown:15,icon:'w_arcana',desc:lv=>`奧義，依最後使用的元素變化——火：${pc(W.arcana.fire(lv))} 大爆炸並引爆全部灼燒；冰：範圍內全部化為寒冰印記後碎冰（${pc(W.arcana.ice(lv))}）；雷：6 道落雷分給附近敵人，每道 ${pc(W.arcana.bolt(lv))}。`},
  // —— 蒼穹遊俠 ——
  r_mark:{id:'r_mark',job:'ranger',name:'獵者標記',maxLv:5,target:'enemy',tags:['single'],element:'neutral',range:11,prereq:{},jobReq:1,
    sp:flat(6),cast:flat(0),delay:.15,cooldown:1,icon:'r_mark',desc:lv=>`把目標標成【獵物】${RG.mark.dur} 秒：你的遠程傷害對牠 +${pc(RG.mark.dmg(lv))}。同時只有一個獵物。`},
  r_snipe:{id:'r_snipe',job:'ranger',name:'穿星狙擊',maxLv:5,target:'enemy',tags:['ranged','single'],element:'neutral',range:11,prereq:{r_mark:1},jobReq:3,
    sp:flat(16),cast:flat(.8),delay:.45,cooldown:6,icon:'r_snipe',desc:lv=>`單體 ${pc(RG.snipe.mult(lv))}；打獵物再加 ${pc(RG.snipe.marked(lv))}。`},
  r_pierce:{id:'r_pierce',job:'ranger',name:'破風貫矢',maxLv:5,target:'enemy',tags:['ranged','area'],element:'wind',range:9,prereq:{doubleStrafe:5},jobReq:5,
    sp:flat(16),cast:flat(0),delay:.45,cooldown:6,icon:'r_pierce',desc:lv=>`朝目標射出貫穿 ${RG.pierce.len} 格的風矢，直線上每隻敵人受到 ${pc(RG.pierce.mult(lv))} 傷害。`},
  r_barrage:{id:'r_barrage',job:'ranger',name:'追風連射',maxLv:5,target:'enemy',tags:['ranged','single'],element:'neutral',range:9,prereq:{doubleStrafe:5},jobReq:8,
    sp:flat(18),cast:flat(0),delay:.35,cooldown:5,icon:'r_barrage',desc:lv=>`連射 ${RG.barrage.n} 箭，每箭 ${pc(RG.barrage.mult(lv))}。目標倒下時，剩下的箭自動轉向射程內的下一個敵人。`},
  r_trap:{id:'r_trap',job:'ranger',name:'束光陷阱',maxLv:5,target:'ground',tags:['ranged','area'],element:'neutral',range:9,prereq:{arrowShower:5},jobReq:10,
    sp:flat(14),cast:flat(.3),delay:.3,cooldown:4,icon:'r_trap',desc:lv=>`放置陷阱（最多 ${RG.trap.max} 個，${RG.trap.dur} 秒）。敵人踩到時爆炸，對 ${RG.trap.r} 格內造成 ${pc(RG.trap.mult(lv))} 並緩速 40%。放在王腳下也會觸發。`},
  r_falcon:{id:'r_falcon',job:'ranger',name:'鷹眼協獵',maxLv:5,target:'passive',tags:[],element:'neutral',range:0,prereq:{},jobReq:1,
    sp:flat(0),cast:flat(0),delay:0,icon:'r_falcon',desc:lv=>`攻速 +${RG.falcon.aspd(lv)}%。普攻與遠程技能命中時 ${pc(RG.falcon.chance(lv))} 機率讓獵鷹俯衝 ${pc(RG.falcon.mult(lv))} 並回復 4 SP（每 0.8 秒最多一次）。`},
  r_starRain:{id:'r_starRain',job:'ranger',name:'天羽星雨',maxLv:5,target:'ground',tags:['ranged','area'],element:'neutral',range:9,prereq:{r_pierce:3},jobReq:20,
    sp:flat(40),cast:flat(.6),delay:.8,cooldown:20,icon:'r_starRain',desc:lv=>`奧義。在 5×5 範圍降下三波星羽，每波 ${pc(RG.starRain.mult(lv))}；只有一個敵人時，三波全部集中打牠並再加 30%。`},
} satisfies Record<string,SkillDef>);
