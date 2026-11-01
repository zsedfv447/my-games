// Authoritative character state and every rule that changes it. Pure functions: each command
// returns a new state or throws an Error whose message is shown to the player.
import { jobs, skills, firstJobs, usableJobs, baseLevelCap, baseExpNeed, jobExpNeed, statPointsAtLevel, statRaiseCost,
  startingStatPoints, SOULS, type SoulId, secondJobOf, secondJobs, JOB2_REQ, JOB2_MAX, job2ExpNeed, K, W, RG, type JobId, type Stat } from '../data/jobs';
import { items, cards, modules, moduleCoefficient, upgradeCost, type EquipSlot, type EquipDef } from '../data/items';
import { maps, savePointDefault } from '../data/maps';
import { pets, petBonusScale, INTIMACY_MAX, type PetBonus } from '../data/pets';
import { costumes } from '../data/costumes';
import { mounts, companions, type CompanionRole } from '../data/adventure';
import { awakenings, masteryTier, MASTERY_TIERS } from '../data/mastery';
import { bountyKill } from './explore';
import { refineBonus } from './refine-traits';
import { effectiveDef, validAffix, QUALITY, type Affix, type Quality, type Roll } from './affix';
import { GEAR_FX, type GearFx } from '../data/ascension-items';
import { talents as TALENTS, talentPointsFor, CAPSTONE_COST, type TalentKey, type TalentTree } from '../data/talents';
import { monsters } from '../data/monsters';
import { buildMap, type MapData } from '../world/mapgen';
import { villageFootprint } from '../world/village-layout';
import { quests, challenges, isChallenge, type QuestDef } from '../data/quests';
import { validateStarfall } from './starfall';

export type CardLoc = {kind:'bag'}|{kind:'equip';equipId:string;slot:number};
export type CardInst = { id:string; defId:string; level:number; loc:CardLoc; locked:boolean };
export type EquipInst = { id:string; defId:string; refine?:number; locked?:boolean;
  /** v6.3 品質 (0 普通／1 精良／2 稀有／3 傳說), its random affixes and a legendary build effect. */
  q?:Quality; affix?:Affix[]; legend?:GearFx;
  /** v7.0 淬鍊: which affix has been rerolled and how many times. */
  ench?:{idx:number;n:number} };
export type EquipBuyback = { equip:EquipInst; price:number };
export type ChallengeHistory = { completed:string[]; counts:Record<string,number> };
export type Hotkey = {type:'skill';id:string}|{type:'item';id:string};
export type Place = { map:string; x:number; y:number };
export type Character = {
  name:string; hair:number; hairColor:number; job:JobId;
  baseLv:number; baseExp:number; jobLv:number; jobExp:number;
  stats:Record<Stat,number>; statPoints:number; skillPoints:number; skills:Record<string,number>;
  zeny:number; hp:number; sp:number;
  /** v6.0 二轉: second job, its own level/EXP and skill points. The first job (`job`) keeps growing to Job 70. */
  job2?:JobId|null; job2Lv?:number; job2Exp?:number; skillPoints2?:number;
  /** v6.5 劍士戰魂. */
  soul?:SoulId;
};
/** v6.0 二轉 quest: 1 = hunting (kills on Lv.45+ maps), 2 = trial open, 3 = trial beaten (ceremony ready). */
export type Ascension = { stage:0|1|2|3; kills:number };
export const ASCENSION={kills:30,minMonsterLv:45} as const;
export const OATH_MAP='oathGround';
export type GameState = {
  version:2; revision:number; created:boolean; seq:number;
  char:Character;
  equipped:Record<EquipSlot,string|null>;
  equipment:EquipInst[];
  items:Record<string,number>;
  cards:CardInst[];
  loadouts:Record<string,(string|null)[]>;
  hotbar:(Hotkey|null)[];
  position:Place; savePoint:Place;
  mvpKills:Record<string,number>;
  /** Migration marker makes legacy refunds/quest-history conversion exactly once. */
  migrations?:{rules22:true};
  buyback?:EquipBuyback[];
  challenges?:ChallengeHistory;
  mvpCooldowns?:Record<string,number>;
  /** Index into the quest chain and kills counted since that quest became active. */
  quest:{index:number;count:number};
  /** Captured pets (one per kind) and the one following you. */
  pets?:{id:string;intimacy:number}[]; activePet?:string|null;
  /** Cosmetic costumes: owned ids and what is worn. Purely visual. */
  costumes?:{owned:string[];head:string|null;back:string|null};
  /** v4.3: owned mounts and the one you ride when you press R. */
  mounts?:{owned:string[];active:string|null};
  /** v4.3: hired mercenaries and the one fighting beside you. */
  mercs?:{hired:CompanionRole[];active:CompanionRole|null;modes?:Partial<Record<CompanionRole,'guard'|'assist'|'support'>>};
  /** v4.3: skill mastery — successful casts per skill (drives tiers and awakening). */
  mastery?:Record<string,number>;
  /** v4.6 exploration: chest/trial/bounty records, the bounty board, and chest/trial cooldown deadlines (Unix ms). */
  explore?:import('./explore').ExploreRecord;
  bounty?:import('./explore').BountyState;
  exploreCooldowns?:Record<string,number>;
  exploreChests?:Record<string,{x:number;y:number;tier:import('../data/explore').ChestTier;elite?:string;bonus?:boolean}[]>;
  ascension?:Ascension;
  /** v6.3 星光深淵: best floor cleared. */
  abyss?:{best:number};
  /** v7.0 星淵紀元: difficulty, 威能圖鑑 and challenge records. */
  starfall?:import('./starfall').StarfallState;
  /** v6.3 星光天賦 ranks. */
  talents?:Partial<Record<TalentKey,number>>;
  /** v6.0 星燈航路 story flags (lighthouse etc.). */
  flags?:Record<string,boolean>;
};
export const statKeys:Stat[] = ['str','agi','vit','int','dex','luk'];
export const hairColors = ['#5a3b2e','#f2c14e','#d9534f','#4b7fe0','#3f9e5a','#e8e8f0','#ff9ec4','#2b2b38'];
export const HOTBAR_SIZE = 9;

export function newGame():GameState {
  return {
    version:2,revision:0,created:false,seq:0,migrations:{rules22:true},buyback:[],challenges:{completed:[],counts:{}},mvpCooldowns:{},
    char:{name:'',hair:0,hairColor:0,job:'novice',baseLv:1,baseExp:0,jobLv:1,jobExp:0,
      stats:{str:1,agi:1,vit:1,int:1,dex:1,luk:1},statPoints:startingStatPoints,skillPoints:0,skills:{},zeny:200,hp:1,sp:1},
    equipped:{weapon:null,head:null,armor:null,garment:null,shoes:null,accessory:null},
    equipment:[],items:{redPotion:5,apple:5,teleportLeaf:2},cards:[],
    loadouts:{},hotbar:Array(HOTBAR_SIZE).fill(null),
    position:{...savePointDefault},savePoint:{...savePointDefault},mvpKills:{},quest:{index:0,count:0},
    pets:[],activePet:null,costumes:{owned:[],head:null,back:null},mounts:{owned:[],active:null},mercs:{hired:[],active:null,modes:{}},mastery:{},
  };
}
const clone=<T>(x:T):T=>structuredClone(x);
const fail=(msg:string):never=>{throw new Error(msg);};
const nextId=(s:GameState,prefix:string)=>{
  if(!Number.isSafeInteger(s.seq)||s.seq<0||s.seq>=Number.MAX_SAFE_INTEGER-1)fail('物品流水號已達安全上限');
  return `${prefix}${++s.seq}`;
};

// ———————————————————————————— derived numbers ————————————————————————————
export type Derived = {
  stats:Record<Stat,number>; maxHp:number; maxSp:number; atk:number; weaponAtk:number; matkMin:number; matkMax:number;
  def:number; vitDef:number; mdef:number; hit:number; flee:number; perfectDodge:number; crit:number;
  attackDelay:number; castMult:number; delayMult:number; gearCast:number; gearAspd:number; range:number; ranged:boolean; weaponType:string|null; moveSpeed:number;
  hpRegen:number; spRegen:number; skillLevels:Record<string,number>;
  skillModules:Record<string,{moduleId:string;coef:number;level:number;cardId:string}[]>;
  /** Mastery tier (0–3) per skill. */
  mastery:Record<string,number>;
  /** v4.7 build multipliers from gear traits and refine milestones. */
  spCostMult:number; derivedMult:number; skillMult:number; castEcho:boolean;
  /** v6.2 first job (the swordman's SP-on-hit). */
  job:JobId;
  /** v6.5 劍士戰魂 (null for other classes). */
  soul:SoulId|null;
  /** v6.0 second job (drives 戰意 / 獵印 / 星紋 mechanics in the simulation). */
  job2:JobId|null;
  /** v6.3 星光天賦: shield bonus and capstones the simulation reads. */
  shieldBonus:number; talentFx:TalentKey[];
  /** v6.0 gear mechanics from worn equipment. */
  gearFx:import('../data/ascension-items').GearFx[];
};
export function equippedDefs(s:GameState):EquipDef[] {
  return Object.values(s.equipped).filter((id):id is string=>!!id).map(id=>effectiveDef(s.equipment.find(e=>e.id===id)!));
}
export function derive(s:GameState):Derived {
  const c=s.char,job=jobs[c.job],gear=equippedDefs(s);
  const stats={...c.stats};
  for(const g of gear)for(const [k,v] of Object.entries(g.stats??{}))stats[k as Stat]+=v!;
  const petOwned=s.activePet?s.pets?.find(p=>p.id===s.activePet):undefined,pb:PetBonus=petOwned?pets[petOwned.id].bonus:{},ps=petOwned?petBonusScale(petOwned.intimacy):0;
  for(const [k,v] of Object.entries(pb.stats??{}))stats[k as Stat]+=Math.round(v!*ps);
  stats.dex+=c.skills.owlEye??0;
  const weapon=gear.find(g=>g.slot==='weapon');
  const weaponType=weapon?.weaponType??null,ranged=weaponType==='bow';
  const sum=(k:'atk'|'matk'|'def'|'mdef'|'hp'|'sp')=>gear.reduce((a,g)=>a+(g[k]??0),0);
  const refineOf=(slot:EquipSlot)=>{const id=s.equipped[slot];return id?s.equipment.find(e=>e.id===id)?.refine??0:0;};
  const armorRefine=(['head','armor','garment','shoes'] as EquipSlot[]).reduce((a,k)=>a+refineOf(k),0);
  const statusAtk=ranged?stats.dex+Math.floor(stats.dex/10)**2+Math.floor(stats.str/5)+Math.floor(stats.luk/5)
    :stats.str+Math.floor(stats.str/10)**2+Math.floor(stats.dex/5)+Math.floor(stats.luk/5);
  const mastery=(weaponType==='sword'||weaponType==='dagger')?(c.skills.swordMastery??0)*4:0;
  const lv=c.baseLv;
  // v4.7: refine milestones grow each piece's trait; signature +7 bonuses stack on top.
  const rb:Record<string,number>={};
  for(const [slot,id] of Object.entries(s.equipped)){if(!id)continue;const inst=s.equipment.find(e=>e.id===id);if(!inst)continue;
    for(const [k,v] of Object.entries(refineBonus(items[inst.defId] as EquipDef,inst.refine??0)))rb[k]=(rb[k]??0)+(v??0);void slot;}
  // v6.0: a second job adds 5% HP/SP; 騎士訓練 / 星紋研習 add more.
  const j2=c.job2?1.05:1,kt=c.skills.k_training&&c.job2==='knight'?1+K.training.hp(c.skills.k_training):1,ws=c.skills.w_study&&c.job2==='wizard'?1+W.study.sp(c.skills.w_study):1;
  const T=(k:TalentKey)=>(s.talents?.[k]??0)*TALENTS[k].per;
  const maxHp=Math.round(((40+lv*job.hpFactor*2.2+lv*lv*job.hpFactor*.04)*(1+stats.vit*.01)+sum('hp')+(rb.hp??0))*(1+(pb.hpPct??0)*ps/100)*j2*kt*(1+T('hpPct')/100));
  const maxSp=Math.round(((10+lv*job.spFactor*.9)*(1+stats.int*.01)+sum('sp')+(rb.sp??0))*(1+(pb.spPct??0)*ps/100)*j2*ws);
  const build=(k:'cast'|'aspd'|'crit'|'delay'|'spCost'|'spRegen'|'loop'|'skill')=>gear.reduce((a,g)=>a+(g[k]??0),0)+(rb[k]??0);
  const falcon=c.job2==='ranger'&&c.skills.r_falcon?RG.falcon.aspd(c.skills.r_falcon):0;
  const gearCast=build('cast'),gearAspd=build('aspd')+falcon+T('aspd'),gearCrit=build('crit')+T('crit'),gearDelay=build('delay');
  const matkBonus=1+(sum('matk')+(rb.matk??0)+(weaponType==='staff'?refineOf('weapon')*3:0)+(c.job2==='wizard'&&c.skills.w_study?W.study.matk(c.skills.w_study):0)+T('matkPct'))/100;
  const weaponFactor=weaponType==='dagger'?.9:weaponType==='staff'?1.1:1;
  const skillLevels:Record<string,number>={};
  for(const [id,l] of Object.entries(c.skills))if(l>0&&usableJobs(c.job,c.job2).includes(skills[id].job))skillLevels[id]=l;
  return {
    stats,maxHp,maxSp,atk:Math.round((statusAtk+Math.round((pb.atk??0)*ps))*(1+T('atkPct')/100)),weaponAtk:Math.round(((weapon?.atk??0)+mastery+refineOf('weapon')*3)*(1+T('atkPct')/100)),
    matkMin:Math.round((stats.int+Math.floor(stats.int/7)**2)*matkBonus),matkMax:Math.round((stats.int+Math.floor(stats.int/5)**2)*matkBonus),
    def:sum('def')+armorRefine+Math.round((pb.def??0)*ps)+T('defs'),vitDef:Math.floor(stats.vit/2),mdef:T('defs')+sum('mdef')+(rb.mdef??0)+Math.floor(stats.int/2),
    hit:lv+stats.dex+(c.skills.vulture??0),flee:lv+stats.agi+Math.round((pb.flee??0)*ps),perfectDodge:1+stats.luk/10,crit:1+stats.luk*.3+(pb.crit??0)*ps+gearCrit,
    attackDelay:Math.max(.28,job.attackDelay*weaponFactor*(1-stats.agi*.004-stats.dex*.001)*(1-Math.min(40,gearAspd)/100)),
    // Zero cast is a real goal: DEX and cast gear add up (RO style), so DEX ~90 plus a full cast set reaches 0.
    castMult:Math.max(0,(1-stats.dex/150-Math.min(45,gearCast)/100)*(1-T('cast')/100)),delayMult:Math.max(.5,1-gearDelay/100),gearCast,gearAspd,
    range:ranged?9+(c.skills.vulture??0)*.5:weaponType==='staff'?6:1.45,ranged,weaponType,moveSpeed:5*(1+T('move')/100),
    hpRegen:(1+maxHp/200+stats.vit/5+(c.skills.hpRecovery??0)*(5+maxHp*.002)*.6)*(1+T('regen')/100),
    spRegen:((1+maxSp/100+stats.int/6)*2+(c.skills.spRecovery??0)*(3+maxSp*.002)*.8)*(1+build('spRegen')/100)*(1+T('regen')/100),
    spCostMult:Math.max(.5,(1-build('spCost')/100)*(1-T('spCost')/100)),derivedMult:1+build('loop')/100,skillMult:1+(build('skill')+T('skill'))/100,
    shieldBonus:T('shieldPct')/100,talentFx:(['starburst','aegis','echo'] as TalentKey[]).filter(k=>(s.talents?.[k]??0)>0),
    castEcho:Object.entries(s.equipped).some(([,id])=>{const e=id?s.equipment.find(x=>x.id===id):null;return !!e&&e.defId==='hourglass'&&(e.refine??0)>=7;}),
    skillLevels,skillModules:compileModules(s,skillLevels),job:c.job,soul:c.job==='swordman'?(c.soul??'art'):null,job2:c.job2??null,gearFx:gear.flatMap(g=>[g.fx,(g as {extraFx?:GearFx}).extraFx].filter((f):f is GearFx=>!!f)),
    mastery:Object.fromEntries(Object.entries(s.mastery??{}).map(([k,v])=>[k,masteryTier(v)])),
  };
}

// ———————————————————————————— cards and modules (GDD Q07–Q11) ————————————————————————————
export type ModuleSource = { moduleId:string; cardId:string; level:number; equipId:string };
/** Highest-level card per module among cards inside currently worn equipment; same-name cards never stack. */
export function resolveModules(s:GameState):ModuleSource[] {
  const worn=new Set(Object.values(s.equipped).filter(Boolean));
  const found=new Map<string,ModuleSource>();
  for(const c of [...s.cards].sort((a,b)=>a.id.localeCompare(b.id))){
    if(c.loc.kind!=='equip'||!worn.has(c.loc.equipId))continue;
    const moduleId=cards[c.defId].moduleId,prev=found.get(moduleId);
    if(!prev||c.level>prev.level)found.set(moduleId,{moduleId,cardId:c.id,level:c.level,equipId:c.loc.equipId});
  }
  return [...found.values()];
}
function compileModules(s:GameState,levels:Record<string,number>){
  const active=new Map(resolveModules(s).map(m=>[m.moduleId,m]));
  const out:Derived['skillModules']={};
  for(const skillId of Object.keys(levels)){
    out[skillId]=[];
    for(const m of s.loadouts[skillId]??[]){
      const src=m?active.get(m):undefined;if(!src||!moduleFits(skillId,src.moduleId))continue;
      const card=s.cards.find(c=>c.id===src.cardId)!;
      out[skillId].push({moduleId:src.moduleId,level:src.level,coef:moduleCoefficient(card.defId,src.level),cardId:src.cardId});
    }
  }
  return out;
}
/** Cast-triggered effects also work on non-damaging skills; every other current module requires damage. */
export function moduleInactiveReason(skillId:string,moduleId:string):string|null {
  const sk=skills[skillId],mod=modules[moduleId];
  if(!sk||!mod)return '未知技能或模組';
  if(sk.target==='passive')return '被動技能無法安裝模組';
  const damages=sk.tags.some(t=>t==='melee'||t==='ranged'||t==='magic');
  const utility=moduleId==='feather'||moduleId==='regrowth'||moduleId==='spSaver'||moduleId==='delayCut';
  if(!utility&&!damages)return '此模組需要技能造成傷害，狀態技能不會觸發';
  if(moduleId==='quickCast'&&sk.cast(sk.maxLv)<=0)return '這個技能沒有詠唱時間';
  if(moduleId==='amplify'&&sk.element==='neutral')return '只對有屬性的技能有效';
  // v6.0 modules that hook one specific mechanic.
  if(moduleId==='emberEcho'&&!['fireBall','w_arcana'].includes(skillId))return '只對會引爆灼燒的技能有效（爆炎球、星紋奧義）';
  if(moduleId==='frostLinger'&&!['coldBolt','frostDiver','w_frost'].includes(skillId))return '只對會形成寒冰印記的技能有效';
  if(moduleId==='thunderReturn'&&skillId!=='lightningBolt')return '只對雷鳴矢有效';
  if(!mod.tags.some(t=>sk.tags.includes(t)))return '模組不適用於此技能';
  return null;
}
export const moduleFits=(skillId:string,moduleId:string)=>moduleInactiveReason(skillId,moduleId)===null;
export const moduleSkills=(skillId:string)=>!!skills[skillId]&&Object.keys(modules).some(m=>moduleFits(skillId,m));
export const safeMaterials=(s:GameState,main:CardInst)=>s.cards.filter(c=>c.id!==main.id&&c.defId===main.defId&&c.level===1&&c.loc.kind==='bag'&&!c.locked);

// ———————————————————————————— commands ————————————————————————————
export type Ctx = { inCombat?:boolean; inTown?:boolean };
const combatGuard=(ctx:Ctx,what:string)=>{if(ctx.inCombat)fail(`戰鬥中不能${what}，離開戰鬥 4 秒後再試。`);};

export function createCharacter(s0:GameState,name:string,hair:number,hairColor:number):GameState {
  const s=clone(s0);const n=name.trim();
  if(s.created)fail('角色已建立');
  if(n.length<1||n.length>12)fail('名字需要 1～12 個字');
  if(!Number.isInteger(hair)||hair<0||hair>5||!Number.isInteger(hairColor)||hairColor<0||hairColor>=hairColors.length)fail('外觀選項無效');
  s.char.name=n;s.char.hair=hair;s.char.hairColor=hairColor;s.created=true;
  const knife=nextId(s,'e'),shirt=nextId(s,'e');
  s.equipment.push({id:knife,defId:'knife'},{id:shirt,defId:'cottonShirt'});
  s.equipped.weapon=knife;s.equipped.armor=shirt;
  s.hotbar[0]={type:'item',id:'redPotion'};s.hotbar[1]={type:'item',id:'apple'};
  const d=derive(s);s.char.hp=d.maxHp;s.char.sp=d.maxSp;
  return bump(s);
}
const bump=(s:GameState)=>{s.revision++;return s;};

export function allocateStat(s0:GameState,stat:Stat):GameState {
  const s=clone(s0);if(!statKeys.includes(stat))fail('未知素質');
  const cur=s.char.stats[stat];if(cur>=99)fail('素質已達上限 99');
  const cost=statRaiseCost(cur);if(s.char.statPoints<cost)fail(`需要 ${cost} 點素質點`);
  s.char.stats[stat]++;s.char.statPoints-=cost;return bump(s);
}
export function resetStats(s0:GameState,ctx:Ctx):GameState {
  const s=clone(s0);if(!ctx.inTown)fail('只有在城鎮才能重置素質');
  let refund=0;for(const k of statKeys){for(let v=1;v<s.char.stats[k];v++)refund+=statRaiseCost(v);s.char.stats[k]=1;}
  s.char.statPoints+=refund;return bump(s);
}
export function canLearn(s:GameState,id:string):string|null {
  const sk=skills[id];if(!sk)return '未知技能';
  if(!usableJobs(s.char.job,s.char.job2).includes(sk.job))return secondJobs.includes(sk.job)?'需要先完成二轉':'職業不符';
  if(sk.job==='novice'&&s.char.job!=='novice')return '轉職後無法再學習初心者技能';
  const lv=s.char.skills[id]??0;if(lv>=sk.maxLv)return '已達最高等級';
  if(sk.jobReq&&(s.char.job2Lv??0)<sk.jobReq)return `需要二轉 Job Lv.${sk.jobReq}`;
  for(const [p,need] of Object.entries(sk.prereq))if((s.char.skills[p]??0)<need)return `需要 ${skills[p].name} Lv.${need}`;
  if(secondJobs.includes(sk.job)){if((s.char.skillPoints2??0)<1)return '沒有二轉技能點';}
  else if(id!=='firstAid'&&s.char.skillPoints<1)return '沒有技能點';
  return null;
}
/** The basic3 reward is free and cannot be missed by changing jobs. Assigned shortcuts are never replaced. */
function grantFirstAid(s:GameState):void {
  if((s.char.skills.basic??0)<3||(s.char.skills.firstAid??0)>0)return;
  s.char.skills.firstAid=1;
  if(record(s.loadouts)&&!s.loadouts.firstAid)s.loadouts.firstAid=[null,null];
  if(Array.isArray(s.hotbar)&&!s.hotbar.some(h=>h?.type==='skill'&&h.id==='firstAid')){
    const free=s.hotbar.findIndex(h=>h===null);if(free>=0)s.hotbar[free]={type:'skill',id:'firstAid'};
  }
}
export function learnSkill(s0:GameState,id:string):GameState {
  const s=clone(s0);const why=canLearn(s,id);if(why)fail(why);
  s.char.skills[id]=(s.char.skills[id]??0)+1;
  if(secondJobs.includes(skills[id].job))s.char.skillPoints2=(s.char.skillPoints2??0)-1;else if(id!=='firstAid')s.char.skillPoints--;
  if(id==='basic')grantFirstAid(s);
  if(!s.loadouts[id]&&moduleSkills(id))s.loadouts[id]=[null,null];
  // A newly learned active skill goes straight onto the first free hotbar slot.
  if(s.char.skills[id]===1&&skills[id].target!=='passive'&&!s.hotbar.some(h=>h?.type==='skill'&&h.id===id)){
    const free=s.hotbar.findIndex(h=>!h);if(free>=0)s.hotbar[free]={type:'skill',id};
  }
  return bump(s);
}
export function jobChangeReady(s:GameState):string|null {
  if(s.char.job!=='novice')return '你已經轉職了';
  if(s.char.jobLv<10)return '職業等級需要達到 10';
  if((s.char.skills.basic??0)<9)return '基本技能需要學到 Lv.9';
  return null;
}
export function changeJob(s0:GameState,job:JobId,ctx:Ctx):GameState {
  const s=clone(s0);const why=jobChangeReady(s);if(why)fail(why);
  if(!firstJobs.includes(job))fail('無法轉職為這個職業');
  combatGuard(ctx,'轉職');
  s.char.job=job;s.char.jobLv=1;s.char.jobExp=0;
  // Leftover novice skill points carry over, as in RO.
  for(const slot of Object.keys(s.equipped) as EquipSlot[]){
    const id=s.equipped[slot];if(id&&!canWear(s,items[s.equipment.find(e=>e.id===id)!.defId] as EquipDef))s.equipped[slot]=null;
  }
  const starter=job==='mage'?'rod':job==='archer'?'bow':null;
  if(starter){const id=nextId(s,'e');s.equipment.push({id,defId:starter});s.equipped.weapon=id;}
  const d=derive(s);s.char.hp=d.maxHp;s.char.sp=d.maxSp;
  return bump(s);
}
// ———————————————————————————— v6.5 劍士戰魂 ————————————————————————————
export const soulUnlocked=(s:GameState,id:SoulId)=>s.char.job==='swordman'&&(!!s.char.job2||s.char.jobLv>=SOULS[id].unlock);
export function setSoul(s0:GameState,id:SoulId,ctx:Ctx):GameState{
  if(s0.char.job!=='swordman')fail('只有劍士系才有戰魂');if(!SOULS[id])fail('未知的戰魂');
  if(!soulUnlocked(s0,id))fail(`一轉 Job ${SOULS[id].unlock} 解鎖`);if(!ctx.inTown)fail('只有在城鎮才能切換戰魂');
  const s=clone(s0);s.char.soul=id;return bump(s);
}
// ———————————————————————————— v6.3 星光天賦 ————————————————————————————
export const talentSpent=(s:GameState)=>Object.values(s.talents??{}).reduce((a,b)=>a+(b??0),0);
export const talentPoints=(s:GameState)=>talentPointsFor(s.char.baseLv,s.abyss?.best??0);
export const treeSpent=(s:GameState,tree:TalentTree)=>Object.entries(s.talents??{}).filter(([k])=>TALENTS[k as TalentKey].tree===tree&&!TALENTS[k as TalentKey].capstone).reduce((a,[,v])=>a+(v??0),0);
export function talentBlock(s:GameState,id:TalentKey):string|null{
  const t=TALENTS[id];if(!t)return '未知的天賦';if((s.talents?.[id]??0)>=t.max)return '已達最高等級';
  if(talentSpent(s)>=talentPoints(s))return '沒有星點（Base Lv.40 以後每級 1 點，深淵每 5 層 1 點）';
  if(t.capstone&&treeSpent(s,t.tree)<CAPSTONE_COST)return `需要在這個星座投入 ${CAPSTONE_COST} 點`;
  return null;
}
export function learnTalent(s0:GameState,id:TalentKey):GameState{const why=talentBlock(s0,id);if(why)fail(why);const s=clone(s0);s.talents={...(s.talents??{}),[id]:(s.talents?.[id]??0)+1};return bump(s);}
export function resetTalents(s0:GameState,ctx:Ctx):GameState{if(!ctx.inTown)fail('只有在城鎮才能重新分配天賦');const s=clone(s0);s.talents={};return bump(s);}
// ———————————————————————————— v6.3 星光深淵 ————————————————————————————
export function clearAbyssFloor(s0:GameState,floor:number,exp:number,zeny:number):ExpResult & {record:boolean}{
  const s=clone(s0),best=s.abyss?.best??0,record=floor>best;s.abyss={best:Math.max(best,floor)};s.char.zeny+=zeny;
  const r=gainExp(s,exp,Math.round(exp*.7));return {...r,record};
}
// ———————————————————————————— v6.0 二轉 ————————————————————————————
export function ascensionReady(s:GameState):string|null {
  const c=s.char;
  if(c.job2)return '你已經完成二轉了';
  if(!secondJobOf[c.job])return '需要先完成一轉';
  if(c.baseLv<JOB2_REQ.baseLv)return `需要 Base Lv.${JOB2_REQ.baseLv}`;
  if(c.jobLv<JOB2_REQ.jobLv)return `需要 Job Lv.${JOB2_REQ.jobLv}`;
  return null;
}
export const ascensionOf=(s:GameState):Ascension=>s.ascension??{stage:0,kills:0};
export function acceptAscension(s0:GameState):GameState {
  const why=ascensionReady(s0);if(why)fail(why);if(ascensionOf(s0).stage!==0)fail('已經接下二轉委託');
  const s=clone(s0);s.ascension={stage:1,kills:0};return bump(s);
}
/** Turn in the hunt: opens the 誓約試煉場. */
export function reportAscensionHunt(s0:GameState):GameState {
  const a=ascensionOf(s0);if(a.stage!==1)fail('目前沒有要回報的委託');if(a.kills<ASCENSION.kills)fail(`還需要打倒 ${ASCENSION.kills-a.kills} 隻魔物`);
  const s=clone(s0);s.ascension={stage:2,kills:a.kills};return bump(s);
}
/** The ceremony: becomes the second job, Job 1 with its first skill point, plus a job weapon. */
export function changeJob2(s0:GameState,ctx:Ctx):GameState {
  const why=ascensionReady(s0);if(why)fail(why);if(ascensionOf(s0).stage!==3)fail('還沒有通過誓約試煉');
  combatGuard(ctx,'轉職');
  const s=clone(s0),c=s.char,job2=secondJobOf[c.job]!;
  c.job2=job2;c.job2Lv=1;c.job2Exp=0;c.skillPoints2=1;s.ascension={stage:3,kills:ASCENSION.kills};
  const weapon=job2==='knight'?'oathSword':job2==='wizard'?'starlitStaff':'skywardBow';
  if(items[weapon])s.equipment.push({id:nextId(s,'e'),defId:weapon});
  const d=derive(s);c.hp=d.maxHp;c.sp=d.maxSp;
  return bump(s);
}
/** Free re-spec of second-job skills in a town (mastery is kept). */
export function resetSkills2(s0:GameState,ctx:Ctx):GameState {
  if(!ctx.inTown)fail('只有在城鎮才能重新分配二轉技能');
  const s=clone(s0),c=s.char;if(!c.job2)fail('還沒有二轉');
  let refund=0;
  for(const [id,l] of Object.entries(c.skills))if(secondJobs.includes(skills[id].job)){refund+=l;delete c.skills[id];delete s.loadouts[id];
    s.hotbar=s.hotbar.map(h=>h?.type==='skill'&&h.id===id?null:h);}
  c.skillPoints2=(c.skillPoints2??0)+refund;return bump(s);
}
export type ExpResult = { state:GameState; baseUps:number; jobUps:number };
export function gainExp(s0:GameState,base:number,job:number):ExpResult {
  const s=clone(s0);const c=s.char;let baseUps=0,jobUps=0;
  if(c.baseLv<baseLevelCap){c.baseExp+=Math.max(0,Math.floor(base));
    while(c.baseLv<baseLevelCap&&c.baseExp>=baseExpNeed(c.baseLv)){c.baseExp-=baseExpNeed(c.baseLv);c.baseLv++;c.statPoints+=statPointsAtLevel(c.baseLv);baseUps++;}
    if(c.baseLv>=baseLevelCap)c.baseExp=0;}
  const cap=jobs[c.job].maxJobLv;
  if(c.jobLv<cap){c.jobExp+=Math.max(0,Math.floor(job));
    while(c.jobLv<cap&&c.jobExp>=jobExpNeed(c.job,c.jobLv)){c.jobExp-=jobExpNeed(c.job,c.jobLv);c.jobLv++;c.skillPoints++;jobUps++;}
    if(c.jobLv>=cap)c.jobExp=0;}
  // v6.0 一轉進修: after the second job change the same job EXP also feeds the second track (each track once).
  if(c.job2){c.job2Lv??=1;c.job2Exp??=0;c.skillPoints2??=0;
    if(c.job2Lv<JOB2_MAX){c.job2Exp+=Math.max(0,Math.floor(job));
      while(c.job2Lv<JOB2_MAX&&c.job2Exp>=job2ExpNeed(c.job2Lv)){c.job2Exp-=job2ExpNeed(c.job2Lv);c.job2Lv++;c.skillPoints2++;jobUps++;}
      if(c.job2Lv>=JOB2_MAX)c.job2Exp=0;}}
  if(baseUps||jobUps){const d=derive(s);c.hp=d.maxHp;c.sp=d.maxSp;}
  if(baseUps||jobUps)bump(s);
  return {state:s,baseUps,jobUps};
}
/** GDD §7: no loss below Base Lv.10; from Lv.10 lose 2% of this level's requirement. Never de-levels or drops items. */
export function applyDeath(s0:GameState,noPenalty=false):GameState {
  const s=clone(s0);const c=s.char;
  if(c.baseLv>=10&&!noPenalty)c.baseExp=Math.max(0,c.baseExp-Math.floor(baseExpNeed(c.baseLv)*.02));
  c.hp=1;c.sp=0;s.position={...s.savePoint};return bump(s);
}
export function addItem(s0:GameState,id:string,count=1,roll?:Roll):GameState {
  const s=clone(s0);const def=items[id];if(!def)fail('未知物品');
  if(def.kind==='equip'){for(let i=0;i<count;i++)s.equipment.push({id:nextId(s,'e'),defId:id,...(roll&&roll.q>0?{q:roll.q,affix:roll.affix,...(roll.legend?{legend:roll.legend}:{})}:{})});}
  else s.items[id]=(s.items[id]??0)+count;
  return bump(s);
}
export function addCard(s0:GameState,defId:string):{state:GameState;cardId:string} {
  const s=clone(s0);if(!cards[defId])fail('未知卡片');
  const id=nextId(s,'c');s.cards.push({id,defId,level:1,loc:{kind:'bag'},locked:false});
  return {state:bump(s),cardId:id};
}
export function addZeny(s0:GameState,amount:number):GameState{const s=clone(s0);s.char.zeny=Math.max(0,s.char.zeny+Math.floor(amount));return bump(s);}
export function consumeItem(s0:GameState,id:string):GameState {
  const s=clone(s0);if((s.items[id]??0)<1)fail('沒有這個物品');
  s.items[id]--;if(!s.items[id])delete s.items[id];return bump(s);
}
/** First-job gear stays wearable after the second job change; second-job gear needs that job. */
export const jobFits=(s:GameState,def:EquipDef)=>def.jobs==='all'||def.jobs.includes(s.char.job)||(!!s.char.job2&&def.jobs.includes(s.char.job2));
export function canWear(s:GameState,def:EquipDef):boolean {
  return jobFits(s,def)&&s.char.baseLv>=def.reqLv;
}
export function equip(s0:GameState,equipId:string,ctx:Ctx):GameState {
  const s=clone(s0);combatGuard(ctx,'更換裝備');
  const inst=s.equipment.find(e=>e.id===equipId);if(!inst)fail('裝備不存在');
  const def=items[inst!.defId] as EquipDef;
  if(!jobFits(s,def))fail(`${jobs[s.char.job2??s.char.job].name}無法裝備這個物品`);
  if(s.char.baseLv<def.reqLv)fail(`需要基本等級 ${def.reqLv}`);
  s.equipped[def.slot]=equipId;return bump(s);
}
export function unequip(s0:GameState,slot:EquipSlot,ctx:Ctx):GameState {
  const s=clone(s0);combatGuard(ctx,'更換裝備');if(!s.equipped[slot])fail('這個位置沒有裝備');
  s.equipped[slot]=null;return bump(s);
}
/** Q09: inserting, removing and moving a card is free and lossless; out of combat only (GDD 6.4). */
export function insertCard(s0:GameState,cardId:string,equipId:string,ctx:Ctx):GameState {
  const s=clone(s0);combatGuard(ctx,'插拔卡片');
  const c=s.cards.find(x=>x.id===cardId);if(!c)fail('卡片不存在');
  const inst=s.equipment.find(e=>e.id===equipId);if(!inst)fail('裝備不存在');
  const def=items[inst!.defId] as EquipDef;
  const used=new Set(s.cards.filter(x=>x.id!==cardId&&x.loc.kind==='equip'&&x.loc.equipId===equipId).map(x=>(x.loc as {slot:number}).slot));
  const slot=Array.from({length:def.slots},(_,i)=>i).find(i=>!used.has(i));
  if(slot===undefined)fail(def.slots?'這件裝備的卡槽已滿':'這件裝備沒有卡槽');
  c!.loc={kind:'equip',equipId,slot:slot!};return bump(s);
}
export function removeCard(s0:GameState,cardId:string,ctx:Ctx):GameState {
  const s=clone(s0);combatGuard(ctx,'插拔卡片');
  const c=s.cards.find(x=>x.id===cardId);if(!c)fail('卡片不存在');c!.loc={kind:'bag'};return bump(s);
}
export function toggleCardLock(s0:GameState,cardId:string):GameState {
  const s=clone(s0);const c=s.cards.find(x=>x.id===cardId);if(!c)fail('卡片不存在');c!.locked=!c!.locked;return bump(s);
}
/** Q10/Q11: upgrade one card instance with same-name, unprotected Lv.1 bag cards. Always succeeds. */
export function upgradeCard(s0:GameState,cardId:string,materialIds:string[],ctx:Ctx):GameState {
  const s=clone(s0);combatGuard(ctx,'升級卡片');
  const main=s.cards.find(x=>x.id===cardId);if(!main)fail('卡片不存在');
  const max=cards[main!.defId].maxLevel;if(main!.level>=max)fail(`已達最高 Lv.${max}`);
  const need=upgradeCost(main!.level);
  if(materialIds.length!==need||new Set(materialIds).size!==need)fail(`需要 ${need} 張同名 Lv.1 卡`);
  const safe=new Set(safeMaterials(s,main!).map(c=>c.id));
  if(materialIds.some(id=>!safe.has(id)))fail('素材必須是背包中、未鎖定、同名的 Lv.1 卡');
  s.cards=s.cards.filter(c=>!materialIds.includes(c.id));main!.level++;return bump(s);
}
export function configureModule(s0:GameState,skillId:string,slot:number,moduleId:string|null,ctx:Ctx):GameState {
  const s=clone(s0);combatGuard(ctx,'調整技能模組');
  if(!(s.char.skills[skillId]>0)||!moduleSkills(skillId))fail('這個技能無法安裝模組');
  if(slot!==0&&slot!==1)fail('模組槽不存在');
  if(moduleId!==null){
    if(!modules[moduleId])fail('未知模組');
    {const why=moduleInactiveReason(skillId,moduleId);if(why)fail(`「${modules[moduleId].name}」不適用於${skills[skillId].name}：${why}`);}
    if((s.loadouts[skillId]??[]).some((m,i)=>i!==slot&&m===moduleId))fail('同一技能不能重複安裝相同模組');
  }
  s.loadouts[skillId]=s.loadouts[skillId]??[null,null];s.loadouts[skillId][slot]=moduleId;return bump(s);
}
export function buy(s0:GameState,itemId:string,qty:number):GameState {
  const s=clone(s0);const def=items[itemId];if(!def)fail('未知物品');
  if(!Number.isInteger(qty)||qty<1||qty>99)fail('數量無效');
  const cost=def.price*qty;if(s.char.zeny<cost)fail(`Zeny 不足，需要 ${cost.toLocaleString()} z`);
  s.char.zeny-=cost;
  if(def.kind==='equip')for(let i=0;i<qty;i++)s.equipment.push({id:nextId(s,'e'),defId:itemId});
  else s.items[itemId]=(s.items[itemId]??0)+qty;
  return bump(s);
}
export const sellPrice=(itemId:string)=>Math.floor(items[itemId].price/2);
export function sellItem(s0:GameState,itemId:string,qty:number):GameState {
  const s=clone(s0);const have=s.items[itemId]??0;
  if(!Number.isInteger(qty)||qty<1||qty>have)fail('數量無效');
  s.items[itemId]-=qty;if(!s.items[itemId])delete s.items[itemId];
  s.char.zeny+=sellPrice(itemId)*qty;
  return bump(s);
}
export function sellEquip(s0:GameState,equipId:string):GameState {
  const s=clone(s0);const inst=s.equipment.find(e=>e.id===equipId);if(!inst)fail('裝備不存在');
  if(inst!.locked)fail('裝備已鎖定');
  if(Object.values(s.equipped).includes(equipId))fail('請先卸下裝備');
  // Cards inside come back to the bag for free (Q09) instead of being sold with the gear.
  for(const c of s.cards)if(c.loc.kind==='equip'&&c.loc.equipId===equipId)c.loc={kind:'bag'};
  const price=Math.round(sellPrice(inst!.defId)*(1+(inst!.q??0)*.8));
  s.buyback=[{equip:clone(inst!),price},...(s.buyback??[])].slice(0,10);
  s.equipment=s.equipment.filter(e=>e.id!==equipId);s.char.zeny+=price;return bump(s);
}
export function toggleEquipLock(s0:GameState,equipId:string):GameState {
  const s=clone(s0),inst=s.equipment.find(e=>e.id===equipId);if(!inst)fail('裝備不存在');
  inst!.locked=!inst!.locked;return bump(s);
}
/** Cards were returned on sale. Recovery buys only the original, exact equipment instance. */
export function buybackEquip(s0:GameState,equipId:string):GameState {
  const s=clone(s0),entry=s.buyback?.find(b=>b.equip.id===equipId);if(!entry)fail('回購紀錄不存在');
  if(s.equipment.some(e=>e.id===equipId))fail('裝備識別重複');
  if(s.char.zeny<entry!.price)fail(`Zeny 不足，需要 ${entry!.price.toLocaleString()} z`);
  s.char.zeny-=entry!.price;s.equipment.push(clone(entry!.equip));s.buyback=s.buyback!.filter(b=>b.equip.id!==equipId);
  return bump(s);
}
export function sellCard(s0:GameState,cardId:string):GameState {
  const s=clone(s0);const c=s.cards.find(x=>x.id===cardId);if(!c)fail('卡片不存在');
  if(c!.loc.kind!=='bag')fail('請先把卡片從裝備拔出');if(c!.locked)fail('卡片已鎖定');
  if(c!.level>1)fail('升級過的卡片不能販售');
  s.cards=s.cards.filter(x=>x.id!==cardId);s.char.zeny+=500;
  return bump(s);
}
export function setHotkey(s0:GameState,slot:number,key:Hotkey|null):GameState {
  const s=clone(s0);if(!Number.isInteger(slot)||slot<0||slot>=HOTBAR_SIZE)fail('快捷欄位置無效');
  if(key?.type==='skill'){const sk=skills[key.id];if(!sk||!(s.char.skills[key.id]>0)||sk.target==='passive')fail('只能放已學會的主動技能');}
  if(key?.type==='item'&&items[key.id]?.kind!=='use')fail('只能放消耗品');
  s.hotbar=s.hotbar.map(h=>h&&key&&h.type===key.type&&h.id===key.id?null:h);
  s.hotbar[slot]=key;return bump(s);
}
/** v4.5: drag one hotbar slot onto another to swap them (an empty target just moves it). */
export function swapHotkeys(s0:GameState,a:number,b:number):GameState {
  const s=clone(s0);if(![a,b].every(i=>Number.isInteger(i)&&i>=0&&i<HOTBAR_SIZE))fail('快捷欄位置無效');
  if(a===b)return s0;const t=s.hotbar[a];s.hotbar[a]=s.hotbar[b];s.hotbar[b]=t;return bump(s);
}
export function setSavePoint(s0:GameState,place:Place):GameState{const s=clone(s0);s.savePoint={...place};return bump(s);}
export function recordVitals(s0:GameState,place:Place,hp:number,sp:number):GameState {
  const s=clone(s0);s.position={...place};s.char.hp=Math.max(0,Math.round(hp));s.char.sp=Math.max(0,Math.round(sp));return s;
}
export function recordMvp(s0:GameState,id:string):GameState{const s=clone(s0);s.mvpKills[id]=(s.mvpKills[id]??0)+1;return bump(s);}

// ———————————————————————————— pets and costumes ————————————————————————————
export function tamePet(s0:GameState,petId:string):{state:GameState;isNew:boolean} {
  const s=clone(s0);if(!own(pets,petId))fail('這種魔物無法成為寵物');
  s.pets=s.pets??[];const had=s.pets.find(p=>p.id===petId);
  if(had)had.intimacy=Math.min(INTIMACY_MAX,had.intimacy+50);else s.pets.push({id:petId,intimacy:0});
  if(!s.activePet)s.activePet=petId;
  return {state:bump(s),isNew:!had};
}
export function setActivePet(s0:GameState,petId:string|null):GameState {
  const s=clone(s0);if(petId!==null&&!s.pets?.some(p=>p.id===petId))fail('還沒有這隻寵物');
  s.activePet=petId;return bump(s);
}
/** Fighting together slowly raises intimacy with the active pet. */
export function petKill(s0:GameState):GameState {
  if(!s0.activePet)return s0;const s=clone(s0);const p=s.pets?.find(x=>x.id===s.activePet);
  if(p)p.intimacy=Math.min(INTIMACY_MAX,p.intimacy+1);return s;
}
const wardrobe=(s:GameState)=>{s.costumes=s.costumes??{owned:[],head:null,back:null};return s.costumes;};
export function buyCostume(s0:GameState,id:string):GameState {
  const s=clone(s0),def=costumes[id];if(!def)fail('未知的外觀');if(def.unlock)fail('這個外觀只能透過挑戰取得');
  const w=wardrobe(s);if(w.owned.includes(id))fail('已經擁有這個外觀');
  if(s.char.zeny<def.price)fail(`Zeny 不足，需要 ${def.price.toLocaleString()} z`);
  s.char.zeny-=def.price;w.owned.push(id);w[def.slot]=id;return bump(s);
}
export function unlockCostume(s0:GameState,id:string):{state:GameState;isNew:boolean} {
  const s=clone(s0),w=wardrobe(s);if(!costumes[id])fail('未知的外觀');if(w.owned.includes(id))return {state:s0,isNew:false};
  w.owned.push(id);return {state:bump(s),isNew:true};
}
export function wearCostume(s0:GameState,slot:'head'|'back',id:string|null):GameState {
  const s=clone(s0),w=wardrobe(s);
  if(id!==null){const def=costumes[id];if(!def||!w.owned.includes(id))fail('還沒有這個外觀');if(def.slot!==slot)fail('外觀部位不符');}
  w[slot]=id;return bump(s);
}

// ———————————————————————————— mounts and mercenaries (v4.3) ————————————————————————————
const stable=(s:GameState)=>{s.mounts=s.mounts??{owned:[],active:null};return s.mounts;};
export function buyMount(s0:GameState,id:string):GameState {
  const s=clone(s0),def=mounts[id];if(!def)fail('未知的坐騎');if(def.unlock)fail('這隻坐騎只能透過擊敗強敵取得');
  const m=stable(s);if(m.owned.includes(id))fail('已經擁有這隻坐騎');
  if(s.char.baseLv<def.minLv)fail(`需要 Base Lv.${def.minLv}`);
  if(s.char.zeny<def.price)fail(`Zeny 不足，需要 ${def.price.toLocaleString()} z`);
  s.char.zeny-=def.price;m.owned.push(id);m.active=id;return bump(s);
}
export function unlockMount(s0:GameState,id:string):{state:GameState;isNew:boolean} {
  const s=clone(s0),m=stable(s);if(!mounts[id])fail('未知的坐騎');if(m.owned.includes(id))return {state:s0,isNew:false};
  m.owned.push(id);if(!m.active)m.active=id;return {state:bump(s),isNew:true};
}
export function setMount(s0:GameState,id:string|null):GameState {
  const s=clone(s0),m=stable(s);if(id!==null&&!m.owned.includes(id))fail('還沒有這隻坐騎');m.active=id;return bump(s);
}
const barracks=(s:GameState)=>{s.mercs=s.mercs??{hired:[],active:null};return s.mercs;};
export function hireCompanion(s0:GameState,id:CompanionRole):GameState {
  const s=clone(s0),def=companions[id];if(!def)fail('未知的傭兵');const m=barracks(s);
  if(m.hired.includes(id)){m.active=id;return bump(s);}
  if(s.char.baseLv<def.minLv)fail(`需要 Base Lv.${def.minLv}`);
  if(s.char.zeny<def.price)fail(`Zeny 不足，需要 ${def.price.toLocaleString()} z`);
  s.char.zeny-=def.price;m.hired.push(id);m.active=id;return bump(s);
}
export function setCompanionMode(s0:GameState,id:CompanionRole,mode:'guard'|'assist'|'support'):GameState {
  const s=clone(s0),m=barracks(s);if(!m.hired.includes(id))fail('還沒有雇用這位傭兵');
  if(!['guard','assist','support'].includes(mode))fail('未知的指令');m.modes={...(m.modes??{}),[id]:mode};return bump(s);
}
export function setCompanion(s0:GameState,id:CompanionRole|null):GameState {
  const s=clone(s0),m=barracks(s);if(id!==null&&!m.hired.includes(id))fail('還沒有雇用這位傭兵');m.active=id;return bump(s);
}

/** One successful cast of a growing skill; reports a tier-up so the UI can celebrate. */
export function gainMastery(s0:GameState,skill:string):{state:GameState;tierUp:number|null} {
  if(!awakenings[skill])return {state:s0,tierUp:null};
  const s=clone(s0);s.mastery=s.mastery??{};const before=s.mastery[skill]??0,after=Math.min(MASTERY_TIERS[3]*10,before+1);s.mastery[skill]=after;
  const t0=masteryTier(before),t1=masteryTier(after);return {state:s,tierUp:t1>t0?t1:null};
}

// ———————————————————————————— quests ————————————————————————————
export type QuestStatus = { def:QuestDef; done:boolean; progress:string; current:number; need:number };
export type ChallengeStatus = QuestStatus & {completed:boolean;unlocked:boolean};
const nextNormalQuest=(index:number)=>{while(index<quests.length&&isChallenge(quests[index]))index++;return index;};
function statusFor(s:GameState,def:QuestDef,count:number):QuestStatus {
  const g=def.goal;
  if(g.kind==='kill')return {def,done:count>=g.count,progress:`${Math.min(count,g.count)}/${g.count}`,current:count,need:g.count};
  if(g.kind==='collect'){const n=s.items[g.item]??0;return {def,done:n>=g.count,progress:`${Math.min(n,g.count)}/${g.count}`,current:n,need:g.count};}
  if(g.kind==='job'){const ok=s.char.job!=='novice';return {def,done:ok,progress:ok?'已轉職':'尚未轉職',current:ok?1:0,need:1};}
  return {def,done:s.char.baseLv>=g.level,progress:`Lv.${s.char.baseLv}/${g.level}`,current:s.char.baseLv,need:g.level};
}
export function questStatus(s:GameState):QuestStatus|null {
  const index=nextNormalQuest(s.quest.index),def=quests[index];if(!def)return null;
  return statusFor(s,def,index===s.quest.index?s.quest.count:0);
}
export function challengeStatuses(s:GameState):ChallengeStatus[] {
  return challenges.map(def=>{
    const completed=s.challenges?.completed.includes(def.id)??false,unlocked=s.quest.index>=quests.indexOf(def);
    const st=statusFor(s,def,s.challenges?.counts[def.id]??0);
    return {...st,done:completed||st.done,completed,unlocked};
  });
}
export function noteKill(s0:GameState,monster:string):GameState {
  s0=bountyKill(s0,monster);
  const asc=s0.ascension;
  if(asc&&asc.stage===1&&asc.kills<ASCENSION.kills&&(monsters[monster]?.level??0)>=ASCENSION.minMonsterLv)s0={...s0,ascension:{stage:1,kills:asc.kills+1}};
  if(asc&&asc.stage===2&&monster.startsWith('oath_'))s0={...s0,ascension:{stage:3,kills:asc.kills}};
  const def=quests[nextNormalQuest(s0.quest.index)],normal=def?.goal.kind==='kill'&&def.goal.monster===monster;
  const challenge=challengeStatuses(s0).find(st=>st.unlocked&&!st.completed&&st.def.goal.kind==='kill'&&st.def.goal.monster===monster);
  if(!normal&&!challenge)return s0;
  const s=clone(s0);
  if(normal)s.quest.count++;
  if(challenge){s.challenges??={completed:[],counts:{}};s.challenges.counts[challenge.def.id]=(s.challenges.counts[challenge.def.id]??0)+1;}
  return s;
}
function questReward(s0:GameState,def:QuestDef):ExpResult & {def:QuestDef} {
  let s=s0;s.char.zeny+=def.reward.zeny;
  for(const [id,n] of Object.entries(def.reward.items??{}))s=addItem(s,id,n);
  const r=gainExp(s,def.reward.exp,def.reward.jexp);return {...r,state:bump(r.state),def};
}
export function completeQuest(s0:GameState):ExpResult & {def:QuestDef} {
  const st=questStatus(s0);if(!st)fail('所有任務都完成了');if(!st!.done)fail('任務還沒完成');
  const s=clone(s0),def=st!.def;
  if(def.goal.kind==='collect'){s.items[def.goal.item]-=def.goal.count;if(!s.items[def.goal.item])delete s.items[def.goal.item];}
  s.quest={index:nextNormalQuest(quests.indexOf(def)+1),count:0};
  // v6.0 星燈航路: lighting the 貝露燈塔 changes 夜航港 for good.
  if(def.id==='lampWick12')s.flags={...(s.flags??{}),lighthouse:true};
  return questReward(s,def);
}
export function completeChallenge(s0:GameState,id:string):ExpResult & {def:QuestDef} {
  const st=challengeStatuses(s0).find(q=>q.def.id===id);if(!st)fail('挑戰不存在');
  if(st!.completed)fail('挑戰獎勵已領取');if(!st!.unlocked||!st!.done)fail('挑戰尚未完成');
  const s=clone(s0);s.challenges??={completed:[],counts:{}};s.challenges.completed.push(id);
  return questReward(s,st!.def);
}

// ———————————————————————————— refining ————————————————————————————
export const REFINE_MAX=7;
export function refineInfo(inst:EquipInst):{next:number;cost:number;rate:number}|null {
  const lv=inst.refine??0;if(lv>=REFINE_MAX)return null;const next=lv+1,def=items[inst.defId] as EquipDef;
  return {next,cost:Math.round((def.slot==='weapon'?300:200)*next*next),rate:next<=4?1:next===5?.8:next===6?.6:.4};
}
/** Refining never breaks or downgrades gear; a failure only spends the zeny. `roll` is in [0,1). */
export function refine(s0:GameState,equipId:string,roll:number,ctx:Ctx):{state:GameState;success:boolean} {
  const s=clone(s0);combatGuard(ctx,'精煉');
  const inst=s.equipment.find(e=>e.id===equipId);if(!inst)fail('裝備不存在');
  const info=refineInfo(inst!);if(!info)fail(`已經精煉到 +${REFINE_MAX}`);
  if(s.char.zeny<info!.cost)fail(`Zeny 不足，需要 ${info!.cost.toLocaleString()} z`);
  s.char.zeny-=info!.cost;const success=roll<info!.rate;if(success)inst!.refine=info!.next;
  return {state:bump(s),success};
}
export const equipLabel=(inst:EquipInst)=>`${inst.q?`${QUALITY[inst.q].name}・`:''}${inst.refine?`+${inst.refine} `:''}${items[inst.defId].name}`;
const record=(v:unknown):v is Record<string,any>=>typeof v==='object'&&v!==null&&!Array.isArray(v);
const integer=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max;
const own=(obj:object,key:string)=>Object.prototype.hasOwnProperty.call(obj,key);
const layouts=new Map<string,MapData>();
function layout(id:string):MapData {let m=layouts.get(id);if(!m){m=buildMap(id);layouts.set(id,m);}return m;}
function playable(p:Place):boolean {
  if(!record(p)||typeof p.map!=='string'||!own(maps,p.map)||!Number.isFinite(p.x)||!Number.isFinite(p.y))return false;
  const m=layout(p.map),x=Math.floor(p.x),y=Math.floor(p.y);
  return x>=0&&y>=0&&x<m.w&&y<m.h&&!!m.reachable[y*m.w+x];
}
function maxInstanceSeq(s:GameState):number {
  let max=0;
  for(const e of [...s.equipment,...(s.buyback??[]).map(b=>b.equip),...s.cards]){
    if(!record(e)||typeof e.id!=='string'||!/^([ec])[1-9]\d*$/.test(e.id))fail('物品識別無效');
    const n=Number(e.id.slice(1));if(!integer(n,1,Number.MAX_SAFE_INTEGER-1))fail('物品識別超出範圍');max=Math.max(max,n);
  }
  return max;
}
/** Copies only supported legacy defaults. Never drops an existing skill, card or gear instance. */
export function normalizeGame(v:unknown):unknown {
  if(!record(v)||v.version!==2)return v;
  const s=clone(v) as GameState,legacy=s.migrations===undefined;
  if(s.quest===undefined)s.quest={index:0,count:0};
  if(s.buyback===undefined)s.buyback=[];
  if(s.mvpCooldowns===undefined)s.mvpCooldowns={};
  if(s.pets===undefined)s.pets=[];
  if(s.activePet===undefined)s.activePet=null;
  if(s.costumes===undefined)s.costumes={owned:[],head:null,back:null};
  if(s.mounts===undefined)s.mounts={owned:[],active:null};
  if(s.mercs===undefined)s.mercs={hired:[],active:null};
  if(s.mastery===undefined)s.mastery={};
  if(s.challenges===undefined){
    s.challenges={completed:[],counts:{}};
    if(legacy&&record(s.quest)&&integer(s.quest.index,0,quests.length)&&integer(s.quest.count)){
      for(const def of challenges){const index=quests.indexOf(def);
        if(s.quest.index>index)s.challenges.completed.push(def.id);
        else if(s.quest.index===index)s.challenges.counts[def.id]=s.quest.count;
      }
    }
  }
  // v4.1 adds solid village props to previously empty grass. Move only old positions inside
  // those new footprints; all inventory, cards, progression and malformed-location checks stay intact.
  for(const key of ['position','savePoint'] as const){const p=s[key];
    if(!record(p)||p.map!=='town'||!Number.isFinite(p.x)||!Number.isFinite(p.y))continue;
    const m=layout('town'),x=Math.floor(p.x),y=Math.floor(p.y);
    if(!m.villageSites.some(site=>villageFootprint(site).some(c=>c.x===x&&c.z===y)))continue;
    const near=m.grid.nearestWalkable(x,y,5),next=near?{map:'town',x:near.x+.5,y:near.y+.5}:null;
    s[key]=next&&playable(next)?next:{map:'town',...maps.town.start};
  }
  if(legacy){
    if(s.seq===undefined)s.seq=0;
    if(integer(s.seq)&&Array.isArray(s.equipment)&&Array.isArray(s.cards)&&Array.isArray(s.buyback))s.seq=Math.max(s.seq,maxInstanceSeq(s));
    for(const key of ['position','savePoint'] as const){const p=s[key];
      // Only finite locations on a known map can be repaired; malformed input stays invalid.
      if(record(p)&&typeof p.map==='string'&&own(maps,p.map)&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&!playable(p))s[key]={map:p.map,...maps[p.map].start};
    }
    if(record(s.char)&&record(s.char.skills)){
      // Decide the refund from the untouched legacy skill list before granting the new free reward.
      if(s.char.skills.firstAid===1&&integer(s.char.skillPoints,0,Number.MAX_SAFE_INTEGER-1))s.char.skillPoints++;
      if(integer(s.char.skills.basic,3,9))grantFirstAid(s);
    }
    s.migrations={rules22:true};
    if(record(s.quest)&&integer(s.quest.index,0,quests.length)&&isChallenge(quests[s.quest.index]))s.quest={index:nextNormalQuest(s.quest.index),count:0};
  }
  return s;
}

/** Full schema and cross-reference validation before a snapshot can become authoritative. */
export function validateGame(v:unknown):asserts v is GameState {
  const s=v as GameState;
  if(!record(s)||s.version!==2||!record(s.char)||!Array.isArray(s.cards)||!Array.isArray(s.equipment)||!record(s.equipped)||!record(s.items)||!record(s.loadouts)||!record(s.mvpKills))fail('存檔格式不支援');
  if(!integer(s.revision)||typeof s.created!=='boolean'||!integer(s.seq,0,Number.MAX_SAFE_INTEGER-1))fail('存檔計數資料無效');
  const c=s.char;
  if(typeof c.job!=='string'||!own(jobs,c.job)||secondJobs.includes(c.job))fail('職業資料無效');
  if(c.job2!==undefined&&c.job2!==null&&(c.job2!==secondJobOf[c.job]||!integer(c.job2Lv,1,JOB2_MAX)||!integer(c.job2Exp)||!integer(c.skillPoints2)))fail('二轉資料無效');
  if(c.soul!==undefined&&(!own(SOULS,c.soul)||c.job!=='swordman'))fail('戰魂資料無效');
  if(s.ascension!==undefined&&(!record(s.ascension)||![0,1,2,3].includes(s.ascension.stage)||!integer(s.ascension.kills,0,1e6)))fail('二轉委託資料無效');
  if(s.talents!==undefined){if(!record(s.talents))fail('天賦資料無效');for(const [k,v] of Object.entries(s.talents))if(!own(TALENTS,k)||!integer(v,0,TALENTS[k as TalentKey].max))fail('天賦資料無效');}
  if(s.abyss!==undefined&&(!record(s.abyss)||!integer(s.abyss.best,0,100000)))fail('深淵紀錄無效');
  if(s.starfall!==undefined)validateStarfall(s.starfall);
  if(s.flags!==undefined&&(!record(s.flags)||Object.values(s.flags).some(v=>typeof v!=='boolean')))fail('劇情旗標無效');
  if(typeof c.name!=='string'||(s.created&&(c.name.trim().length<1||c.name.length>12))||!integer(c.hair,0,10)||!integer(c.hairColor,0,hairColors.length-1))fail('角色資料無效');
  if(!integer(c.baseLv,1,baseLevelCap)||!integer(c.jobLv,1,jobs[c.job].maxJobLv)||!integer(c.baseExp)||!integer(c.jobExp)||!integer(c.zeny)||!integer(c.statPoints)||!integer(c.skillPoints))fail('成長資料無效');
  if(!integer(c.hp)||!integer(c.sp))fail('HP／SP 資料無效');
  if(!record(c.stats)||Object.keys(c.stats).length!==statKeys.length)fail('素質資料無效');
  for(const k of statKeys)if(!integer(c.stats[k],1,99))fail('素質資料無效');
  if(!record(c.skills))fail('技能資料無效');
  for(const [id,level] of Object.entries(c.skills))if(!own(skills,id)||!integer(level,0,skills[id].maxLv)||!usableJobs(c.job,c.job2).includes(skills[id].job))fail('技能資料無效');
  if(s.migrations!==undefined&&(!record(s.migrations)||s.migrations.rules22!==true))fail('升級記錄無效');
  if(s.buyback!==undefined&&(!Array.isArray(s.buyback)||s.buyback.length>10))fail('回購資料無效');
  const eqIds=new Set<string>(),allIds=new Set<string>();
  function checkEquip(e:EquipInst,owned:boolean){
    if(!record(e)||typeof e.id!=='string'||!/^e[1-9]\d*$/.test(e.id)||allIds.has(e.id)||!own(items,e.defId)||items[e.defId].kind!=='equip')fail('裝備資料無效');
    if(e.refine!==undefined&&!integer(e.refine,0,REFINE_MAX))fail('精煉資料無效');
    if(e.locked!==undefined&&typeof e.locked!=='boolean')fail('裝備鎖定資料無效');
    if(e.q!==undefined&&![0,1,2,3,4].includes(e.q))fail('裝備品質資料無效');
    if(e.affix!==undefined&&(!Array.isArray(e.affix)||e.affix.length>4||!e.affix.every(validAffix)))fail('裝備詞綴資料無效');
    if(e.legend!==undefined&&!own(GEAR_FX,e.legend))fail('傳說效果資料無效');
    if(e.ench!==undefined&&(!record(e.ench)||!integer(e.ench.idx,0,3)||!integer(e.ench.n,1,10000)))fail('淬鍊資料無效');
    allIds.add(e.id);if(owned)eqIds.add(e.id);
  }
  for(const e of s.equipment)checkEquip(e,true);
  for(const b of s.buyback??[]){if(!record(b)||!integer(b.price))fail('回購資料無效');checkEquip(b.equip,false);}
  const slots:EquipSlot[]=['weapon','head','armor','garment','shoes','accessory'];
  if(Object.keys(s.equipped).length!==slots.length)fail('裝備欄位無效');
  for(const slot of slots){const id=s.equipped[slot];
    if(id===null)continue;if(typeof id!=='string'||!eqIds.has(id))fail('穿戴中的裝備不存在');
    const def=items[s.equipment.find(e=>e.id===id)!.defId] as EquipDef;
    if(def.slot!==slot||!canWear(s,def))fail('穿戴中的裝備不適用');
  }
  const usedSlots=new Set<string>();
  for(const c of s.cards){
    if(!record(c)||typeof c.id!=='string'||!/^c[1-9]\d*$/.test(c.id)||allIds.has(c.id)||!own(cards,c.defId)||!integer(c.level,1,cards[c.defId].maxLevel)||typeof c.locked!=='boolean'||!record(c.loc))fail('卡片資料無效');
    allIds.add(c.id);
    if(c.loc.kind==='equip'){
      const loc=c.loc,inst=s.equipment.find(e=>e.id===loc.equipId),key=`${loc.equipId}:${loc.slot}`;
      if(!inst||!integer(c.loc.slot,0,(items[inst.defId] as EquipDef).slots-1)||usedSlots.has(key))fail('卡片位置無效');
      usedSlots.add(key);
    }else if(c.loc.kind!=='bag')fail('卡片位置無效');
  }
  if(s.seq<maxInstanceSeq(s))fail('物品流水號落後');
  for(const [id,n] of Object.entries(s.items))if(!own(items,id)||items[id].kind==='equip'||!integer(n,1))fail('物品資料無效');
  if(!Array.isArray(s.hotbar)||s.hotbar.length!==HOTBAR_SIZE)fail('快捷欄資料無效');
  const hotkeys=new Set<string>();
  for(const h of s.hotbar){if(h===null)continue;
    if(!record(h)||typeof h.id!=='string'||(h.type!=='skill'&&h.type!=='item'))fail('快捷欄資料無效');
    if(h.type==='skill'&&(!own(skills,h.id)||!(c.skills[h.id]>0)||skills[h.id].target==='passive'))fail('快捷技能資料無效');
    if(h.type==='item'&&(!own(items,h.id)||items[h.id].kind!=='use'))fail('快捷物品資料無效');
    const key=`${h.type}:${h.id}`;if(hotkeys.has(key))fail('快捷欄重複');hotkeys.add(key);
  }
  for(const [id,loadout] of Object.entries(s.loadouts)){
    if(!own(skills,id)||!(c.skills[id]>0)||!Array.isArray(loadout)||loadout.length!==2)fail('模組配置無效');
    for(const m of loadout)if(m!==null&&(typeof m!=='string'||!own(modules,m)))fail('模組配置無效');
    if(loadout[0]!==null&&loadout[0]===loadout[1])fail('模組配置重複');
    // Valid but ineffective legacy combinations stay stored. compileModules excludes them.
  }
  if(!playable(s.position)||!playable(s.savePoint))fail('角色位置無法通行');
  for(const [id,n] of Object.entries(s.mvpKills))if(!own(monsters,id)||!monsters[id].mvp||!integer(n))fail('MVP 計數資料無效');
  if(!record(s.quest)||!integer(s.quest.index,0,quests.length)||!integer(s.quest.count))fail('任務資料無效');
  if(s.challenges!==undefined){const h=s.challenges;
    if(!record(h)||!Array.isArray(h.completed)||!record(h.counts)||new Set(h.completed).size!==h.completed.length)fail('挑戰記錄無效');
    for(const id of h.completed)if(typeof id!=='string'||!challenges.some(q=>q.id===id))fail('挑戰記錄無效');
    for(const [id,n] of Object.entries(h.counts))if(!challenges.some(q=>q.id===id)||!integer(n))fail('挑戰計數無效');
  }
  if(s.pets!==undefined){
    if(!Array.isArray(s.pets)||new Set(s.pets.map(p=>p?.id)).size!==s.pets.length)fail('寵物資料無效');
    for(const p of s.pets)if(!record(p)||typeof p.id!=='string'||!own(pets,p.id)||!integer(p.intimacy,0,INTIMACY_MAX))fail('寵物資料無效');
  }
  if(s.activePet!==undefined&&s.activePet!==null&&!s.pets?.some(p=>p.id===s.activePet))fail('出戰寵物無效');
  if(s.costumes!==undefined){const w=s.costumes;
    if(!record(w)||!Array.isArray(w.owned)||new Set(w.owned).size!==w.owned.length||w.owned.some(id=>typeof id!=='string'||!own(costumes,id)))fail('外觀資料無效');
    for(const slot of ['head','back'] as const){const id=w[slot];if(id!==null&&(typeof id!=='string'||!w.owned.includes(id)||costumes[id].slot!==slot))fail('外觀穿戴資料無效');}
  }
  if(s.mounts!==undefined){const m=s.mounts;
    if(!record(m)||!Array.isArray(m.owned)||new Set(m.owned).size!==m.owned.length||m.owned.some(id=>typeof id!=='string'||!own(mounts,id)))fail('坐騎資料無效');
    if(m.active!==null&&(typeof m.active!=='string'||!m.owned.includes(m.active)))fail('坐騎資料無效');}
  if(s.mercs!==undefined){const m=s.mercs;
    if(m.modes!==undefined&&(!record(m.modes)||Object.entries(m.modes).some(([k,v])=>!own(companions,k)||!['guard','assist','support'].includes(v as string))))fail('傭兵資料無效');
    if(!record(m)||!Array.isArray(m.hired)||new Set(m.hired).size!==m.hired.length||m.hired.some(id=>typeof id!=='string'||!own(companions,id)))fail('傭兵資料無效');
    if(m.active!==null&&(typeof m.active!=='string'||!m.hired.includes(m.active)))fail('傭兵資料無效');}
  if(s.mastery!==undefined){if(!record(s.mastery))fail('熟練度資料無效');
    for(const [k,v] of Object.entries(s.mastery))if(!own(awakenings,k)||!integer(v,0,1e7))fail('熟練度資料無效');}
  if(s.explore!==undefined){const e=s.explore;if(!record(e)||!record(e.chests)||!record(e.trials)||!integer(e.bounties,0,1e9)||!Array.isArray(e.found))fail('探索紀錄無效');}
  if(s.bounty!==undefined){const b=s.bounty;if(!record(b)||!Array.isArray(b.offers)||!integer(b.seed,0,1e12)||(b.active!==null&&(!record(b.active)||!own(monsters,b.active.monster)))||b.offers.some(o=>!record(o)||!own(monsters,o.monster)))fail('懸賞資料無效');}
  if(s.exploreChests!==undefined){if(!record(s.exploreChests)||Object.values(s.exploreChests).some(l=>!Array.isArray(l)))fail('寶箱資料無效');}
  if(s.exploreCooldowns!==undefined){if(!record(s.exploreCooldowns)||Object.values(s.exploreCooldowns).some(v=>typeof v!=='number'||!Number.isFinite(v)))fail('探索冷卻資料無效');}
  if(s.mvpCooldowns!==undefined){
    if(!record(s.mvpCooldowns))fail('MVP 重生資料無效');
    for(const [key,deadline] of Object.entries(s.mvpCooldowns)){
      const [map,id,...extra]=key.split(':');
      if(extra.length||!own(maps,map)||!own(monsters,id)||!monsters[id].mvp||!maps[map].spawns.some(sp=>sp.monster===id)||typeof deadline!=='number'||!Number.isFinite(deadline)||deadline<0||deadline>Number.MAX_SAFE_INTEGER)fail('MVP 重生資料無效');
    }
  }
}
