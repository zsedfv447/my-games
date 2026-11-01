// Deterministic world simulation for one map: movement on the grid, monster AI, RO-style auto attack,
// cast bars, skills, card modules and loot. Rendering and saving live elsewhere; this only emits events.
import { companionStats, DEFAULT_MODE, type CompanionRole, type CompanionMode } from '../data/adventure';
import { MASTERY_BONUS } from '../data/mastery';
import { LOOP } from '../data/elements';
import { monsters, elementMultiplier, type MonsterDef } from '../data/monsters';
import { skills, K, W, RG, RESOLVE, SW, type Element } from '../data/jobs';
import { maps } from '../data/maps';
import { CHEST, MAP_TIER, TRIALS, SUPPLY_COOLDOWN, type ChestTier } from '../data/explore';
import { landmarks } from '../data/landmarks';
import { habitatOf, HABITAT_SHARE } from '../data/habitats';
import type { Derived } from '../rules/state';
import { buildMap, type MapData } from './mapgen';
import { rollQuality, type Quality } from '../rules/affix';
import { items as itemDefs } from '../data/items';
import { mulberry32 } from './rng';
import { DIFFICULTY, ASPECT, UNIQUE, PIT, HORDE, SIGIL, ECLIPSE, STARFALL_DROPS, BOON_IDS, type DifficultyDef, type BoonId, type SigilAffix } from '../data/starfall';
import type { GearFx } from '../data/ascension-items';
import type { EquipDef } from '../data/items';

export type Vec = { x:number; y:number };
/** v5.1 星光異變: surprise events on field maps. */
export type WorldEventKind='meteor'|'golden'|'invasion'|'eclipse';
/** v7.0 星淵挑戰 running in the arena (星淵深坑／星潮圍城／印記地城). */
export type Challenge=
  |{kind:'pit';tier:number;level:number;until:number;progress:number;bossId:number|null;nextSpawn:number;state:'run'|'won'|'lost'}
  |{kind:'horde';level:number;wave:number;phase:'fight'|'choose'|'boss'|'won'|'lost';until:number;nextSpawn:number;embers:number;boons:BoonId[];offer:BoonId[];phoenixUsed:boolean;stormAt:number;aegisAt:number;bossId:number|null}
  |{kind:'sigil';lv:number;level:number;room:number;affixes:SigilAffix[];bossId:number|null;lavaAt:number;state:'run'|'won'|'lost'};
export type WorldEventState={kind:WorldEventKind;started:number;until:number;nextAt:number;center?:Vec;wave?:number;targetId?:number};
export const WORLD_EVENT={first:[120,240],gap:[180,360],meteor:60,golden:120,invasion:100,waveEvery:22,waves:3};
export const WORLD_EVENT_NAMES:Record<WorldEventKind,{icon:string;name:string}>={meteor:{icon:'🌠',name:'流星雨'},golden:{icon:'✨',name:'黃金魔物'},invasion:{icon:'⚔',name:'魔物大進攻'},eclipse:{icon:'🌑',name:'星蝕潮汐'}};
/** Save keys for chest/supply/trial cooldowns: kind:mapId:number, where mapId must be a real map (ids may have digits or capitals). */
export const validExploreKey=(k:string)=>{const [kind,map,n,...rest]=k.split(':');return !rest.length&&(kind==='chest'||kind==='supply'||kind==='trial')&&!!maps[map]&&/^\d+$/.test(n??'');};
const H = 1/60;
const dist = (a:Vec,b:Vec)=>Math.hypot(a.x-b.x,a.y-b.y);
const clamp=(x:number,a:number,b:number)=>Math.max(a,Math.min(b,x));
/** Re-reads state after a call that may have killed the monster (defeats TS narrowing). */
const isDead=(m:{state:string})=>m.state==='dead';
/** Abyss templates come from monsters that live on some field map (not scripted or event-only ones). */
const maps2has=(id:string)=>Object.values(maps).some(md=>md.spawns.some(sp=>sp.monster===id));

export type Monster = Vec & {
  id:number; def:MonsterDef; px:number; py:number; hp:number; maxHp:number;
  state:'idle'|'chase'|'dead'; home:Vec; area:{x:number;y:number;w:number;h:number};
  path:Vec[]; pathGoal:Vec|null; pathTimer:number; attackTimer:number; wanderTimer:number; respawnTimer:number;
  slowUntil:number; rootUntil:number; frozenUntil:number; stunUntil:number;
  provoke:{until:number;def:number;atk:number}|null; dots:{until:number;tick:number;dmg:number}[];
  facing:number; hitAt:number; attackAt:number; deadAt:number; knock:{vx:number;vy:number;t:number}|null;
  /** MVP special timers; summoned minions vanish instead of respawning. */
  slamTimer:number; summonedOnce:boolean; summoned:boolean;
  /** v4.6: landmark trial key when this monster is a trial elite. */
  trial?:string;
  /** v5.1 星光異變 flags. */
  golden?:boolean; invasion?:boolean;
  /** v4.8+: a chest mimic; beating it drops a rare chest. */
  mimic?:boolean;
  /** Until when this monster fights the companion instead of the player (taunts, being hit by it). */
  aggroAlly?:number;
  /** v4.4 mage element-loop states (combat-only, never saved). */
  el?:ElementState;
  /** v6.0 monster traits: absorb shield from a 鍛爐精靈, bomb fuse, next trait action, busy (winding up) until. */
  shield?:number; bombAt?:number; bombed?:boolean; traitAt?:number; busyUntil?:number;
  /** v6.3 野外菁英: affixes and the plain definition to return to when it respawns. */
  elite?:EliteKind[]; baseDef?:MonsterDef; eliteAt?:number;
  /** v7.0 星蝕潮汐: the definition to restore when the eclipse ends. */
  preEclipse?:MonsterDef;
};
export type EliteKind='swift'|'tough'|'fury'|'split'|'burst'|'vamp'|'shield';
export const ELITE_NAMES:Record<EliteKind,string>={swift:'疾速',tough:'堅韌',fury:'狂暴',split:'分裂',burst:'爆裂',vamp:'吸血',shield:'護盾'};
export const ELITE_DESC:Record<EliteKind,string>={swift:'移動與攻擊都很快',tough:'血量特別多',fury:'攻擊力大增',split:'倒下時分裂成兩隻',burst:'倒下時預告爆炸，快離開',vamp:'打你時會回血',shield:'每 8 秒替自己加護盾'};
export const ELITE_CHANCE=.06;
/** Burn / chill / ice mark / shock / charge on one monster. Times are simulation clock seconds. */
export type ElementState={
  burn:{stacks:number;until:number;next:number;matk:number}|null;
  chill:{stacks:number;until:number}|null;
  mark:{until:number}|null;
  /** Freeze protection: no new freeze before this time; and the cast that already froze it. */
  freezeLock:number; freezeCast:number;
  shockUntil:number; charge:number;
};
const newElementState=():ElementState=>({burn:null,chill:null,mark:null,freezeLock:0,freezeCast:-1,shockUntil:0,charge:0});
export type GroundItem = Vec & { id:number; kind:'item'|'card'; defId:string; count:number; expires:number; mine:boolean;
  /** v6.3 gear quality, decided when it drops (so the ground can glow the right colour). */
  q?:Quality };
export type PlayerTarget = {kind:'monster';id:number}|{kind:'item';id:number}|{kind:'npc';id:string}|{kind:'chest';id:number}|{kind:'landmark';key:string}|null;
/** v4.6 treasure chest lying on a field map. */
export type Chest={id:number;x:number;y:number;tier:ChestTier;elite?:string;
  /** Extra chest (e.g. from a mimic): not part of the per-map chest budget and leaves no cooldown slot. */
  bonus?:boolean};
export type Cast = { skill:string; lv:number; monsterId:number|null; ground:Vec|null; remaining:number; total:number };
export type Player = Vec & {
  px:number; py:number; vx:number; vy:number; hp:number; sp:number; dead:boolean; sitting:boolean;
  path:Vec[]; target:PlayerTarget; attackTimer:number; cast:Cast|null; pending:{skill:string;lv:number;monsterId:number|null;ground:Vec|null}|null;
  afterCastUntil:number; cooldowns:Record<string,number>; facing:number; auto:boolean; attackAt:number;
  endure:{until:number;def:number}|null; concentrate:{until:number;pct:number}|null;
  shields:{amount:number;until:number}[]; regrowth:{until:number;tick:number;pct:number}|null;
  /** v4.5 food regeneration (combat state, not saved). */
  food:{id:string;until:number;tick:number;hp:number;sp:number}|null;
  /** v4.7 時之沙漏 +7「時之迴響」: the next cast within 3 s after a cast is 30% faster. */
  echoUntil:number; echoUsed:boolean; echoRefund:number;
  /** v4.9: one buffered skill press, fired as soon as the current cast / after-cast delay ends. */
  queued:{skill:string;monsterId:number|null;ground:Vec|null}|null;
  hpTimer:number; spTimer:number; lastCombat:number;
  /** v6.0 星誓騎士 戰意 0–5 (last gain time drives the decay) and basic-hit counter. */
  resolve:number; resolveAt:number; basicHits:number;
  /** 騎士訓練: the next first-job melee skill after spending 戰意 is stronger. */
  knightNext:number;
  /** 守誓護壁: counter-attacks while the shield holds. */
  ward:{until:number;lv:number;counterAt:number;shield:{amount:number;until:number};key:number}|null;
  /** 星紋魔導士: 昇華 window, 研習 flow counter (first-job spells) and the last element cast (奧義). */
  ascendUntil:number; ascendLv:number; spellFlow:number; lastElement:Element;
  /** 蒼穹遊俠 獵鷹 internal cooldown. */
  falconAt:number;
  /** v6.2 劍士【烈焰附刃】: burning weapon after 烈焰爆破 (basic hits add fire, every few hits a cleave). */
  enchant:{until:number;lv:number;hits:number;route?:boolean}|null;
  /** 不屈鎧甲 reflect cooldown. */
  thornsAt:number;
  /** v6.5 戰魂 state: 戰技 last attack skill / proc time; 烈焰 empowered basics; 連斬 empowered finisher and SP basic; 磐石 守勢 and hits awaiting the 0.5 s counter; 不屈鎧甲 charges. */
  soulLast:string; soulLastAt:number; soulProcAt:number; flameNext:number; chainEmp:boolean; chainSp:boolean;
  guard:number; guardHits:number; guardAt:number; guardBasic:number; thornsCharges:number;
};
/** v6.0 persistent ground effects: 焰環 / 霜環 / 星樁 / 戰陣. */
export type Zone={id:number;kind:'flame'|'frost'|'totem'|'quake';x:number;y:number;r:number;until:number;next:number;lv:number;castId:number;matk:number;pulses:number;echoCast:number};
export type Trap={id:number;x:number;y:number;until:number;armed:number;lv:number};
export type SimEvent =
  |{t:'dmg';to:'m'|'p'|'a';id?:number;x:number;y:number;amount:number;crit?:boolean;miss?:boolean;element:Element;src:string;absorbed?:number}
  |{t:'heal';x:number;y:number;amount:number;sp?:boolean}
  |{t:'kill';id:number;monster:string;x:number;y:number;exp:number;jexp:number;mvp:boolean}
  |{t:'drop';item:GroundItem}
  |{t:'pickup';item:GroundItem}
  |{t:'castStart';skill:string;lv:number;dur:number}
  |{t:'castEnd';skill:string;ok:boolean}
  |{t:'skill';skill:string;lv:number;from:Vec;to:Vec}
  |{t:'fx';kind:FxKind;x:number;y:number;tx?:number;ty?:number;dur:number;element?:Element;r?:number;shape?:'circle'|'line';angle?:number;length?:number;attackType?:'physical'|'magic';key?:number}
  |{t:'fxEnd';key:number}
  |{t:'abyss';phase:'start'|'clear';floor:number;boss:boolean;exp?:number;zeny?:number}
  |{t:'resolve';n:number}
  |{t:'swing';who:'p'|'m'|'a';id?:number;tx:number;ty:number}
  |{t:'ally';kind:'down'|'up'|'taunt'|'heal'|'bless'|'strafe'|'retreat';x:number;y:number}
  |{t:'dismount'}
  |{t:'status';id:number;kind:'freeze'|'stun'|'root'|'slow'|'provoke'|'mark'|'prey'}
  |{t:'warp';to:string;tx:number;ty:number}
  |{t:'npc';id:string}
  |{t:'death'}
  |{t:'mvpSpawn';monster:string;map:string}
  |{t:'chest';chest:Chest;map:string}
  |{t:'explore';text:string}
  |{t:'trialStart';key:string;name:string}
  |{t:'trialDone';key:string;name:string}
  |{t:'worldEvent';phase:'start'|'success'|'fail';kind:WorldEventKind;text:string;zeny?:number;exp?:number}
  |{t:'challenge';kind:Challenge['kind'];phase:'start'|'room'|'boss'|'wave'|'choose'|'won'|'lost';text:string}
  |{t:'starfall';kind:'secondWind'|'phoenix'|'chrono'|'unique';text:string}
  |{t:'fail';reason:string};
export type FxKind = 'trample'|'cleave'|'enchant'|'wheel'|'dash'|'ward'|'counter'|'rend'|'quake'|'judgment'|'flameZone'|'frostZone'|'totem'|'zoneTick'|'veil'|'ascend'|'arcana'|'snipe'|'pierce'|'trap'|'trapBoom'|'falcon'|'starRain'|'oath'|'meteor'|'warn'|'slam'|'summon'|'orb'|'bolt'|'arrow'|'fireball'|'explode'|'thunder'|'magnum'|'frost'|'heal'|'shield'|'echo'|'pulse'|'chain'|'shatter'|'buff'|'provoke'|'bash'|'arrowRain'|'venom'|'root'|'stun';

type Delayed = { at:number; run:()=>void };
export type Ally = Vec & { role:CompanionRole; px:number; py:number; hp:number; maxHp:number; atk:number; def:number; range:number; aspd:number; speed:number; magic:boolean; heal:number;
  path:Vec[]; pathTimer:number; targetId:number|null; attackTimer:number; skillTimer:number; blessUntil:number; facing:number; attackAt:number; hurtAt:number; dead:boolean; reviveAt:number; level:number;
  /** v4.9 orders and low-HP retreat state. */
  mode:CompanionMode; retreating:boolean };
type HitOpts = { skill:string; mult:number; element:Element; magic:boolean; hitBonus?:number; derived?:boolean; knock?:number; from?:Vec; critBonus?:number };

export class World {
  map!:MapData;
  readonly player:Player;
  monsters:Monster[]=[];
  items:GroundItem[]=[];
  private stats!:Derived;
  private baseLv=1;
  private rng:()=>number;
  /** Companion rolls use their own stream so hiring one never changes monster/drop determinism. */
  private arng:()=>number;
  private serial=1;
  private clock=0;
  private acc=0;
  private events:SimEvent[]=[];
  private delayed:Delayed[]=[];
  private pathBudget=0;
  private manualUntil=0;
  /** Increments per executed skill; element effects dedupe per (cast, effect, target). */
  private castSeq=0;
  /** Skills auto battle may use, in hotbar order (set by main from the hotbar). */
  autoSkills:string[]=[];
  autoStrategy:'balanced'|'aoe'|'conserve'='balanced';
  private autoUsed:Record<string,number>={};
  private warpPending=false;
  private mapItems=new Map<string,GroundItem[]>();
  private mvpDeadlines:Record<string,number>={};
  /** v4.6 chests on the current map, per-map memory, and chest/supply/trial deadlines (sim clock). */
  chests:Chest[]=[];
  private mapChests=new Map<string,Chest[]>();
  private exploreDeadlines:Record<string,number>={};
  private chestSerial=1;private chestCheck=0;private autoChestUntil=0;private autoRetreatAt=0;private retreatNoted=new Set<number>();private manualBossId=-1;
  /** v4.9: the monster the player last attacked or cast on; hotkeys aim here when nothing is hovered. */
  focusId:number|null=null;
  /** v4.9: monster kind the player wants to farm (auto battle prioritises it). */
  huntTarget:string|null=null;private autoChestSkip=new Map<number,number>();private crng:()=>number;
  trial:{key:string;eliteId:number}|null=null;
  /** v5.1 world event in progress on this map (session only). */
  worldEvent:WorldEventState|null=null;eventsEnabled=true;private nextWorldEventAt=0;private erng:()=>number;
  get eventExpMult(){return this.worldEvent?.kind==='meteor'?1.2:1;}
  /** v4.3: the hired mercenary fighting beside the player (null when none is active). */
  ally:Ally|null=null;
  /** v4.3: riding a mount multiplies walking speed; attacking or casting dismounts. */
  riding=false;mountSpeed=1;
  dropMultiplier=1;
  /** v7.0 星淵紀元: difficulty, the running challenge, 星蝕餘燼 held (set by the game) and power/unique states. */
  tier:DifficultyDef=DIFFICULTY[0];challenge:Challenge|null=null;embers=0;
  private sf={momentum:[] as number[],madKing:0,madAt:-9,orbitUntil:0,orbitAt:0,galaxyAt:0,casts:0,chronoKills:0,chronoUntil:0,voidStore:0,voidAt:0,bastionAt:-99,secondWindAt:-999,phoenixAt:-999,echoing:false};
  private tierDefs=new Map<string,MonsterDef>();
  cardMultiplier=1;
  autoLoot=true;
  /** v6.0 ground effects, ranger traps and the marked prey. */
  /** v6.3 星光深淵: the current floor (0 = not in the abyss) and whether it is cleared. */
  abyss:{floor:number;cleared:boolean;boss:boolean}|null=null;
  /** v6.0 story flags from the save (read by the renderer, e.g. the lit 燈塔). */
  flags:Record<string,boolean>={};
  zones:Zone[]=[];traps:Trap[]=[];prey:{id:number;until:number;lv:number}|null=null;private fxKey=1;private preyHuntAt=-9;private tideGuardAt=-99;

  constructor(seed:number,private now:()=>number=()=>Date.now()){
    this.rng=mulberry32(seed);this.arng=mulberry32(seed^0x5eed);this.crng=mulberry32(seed^0xc4e57);this.erng=mulberry32(seed^0xe7e47);
    this.player={x:24.5,y:30.5,px:24.5,py:30.5,vx:0,vy:0,hp:1,sp:1,dead:false,sitting:false,path:[],target:null,attackTimer:0,cast:null,pending:null,
      afterCastUntil:0,cooldowns:{},facing:2,auto:false,attackAt:-9,endure:null,concentrate:null,shields:[],regrowth:null,food:null,echoUntil:0,echoUsed:false,echoRefund:0,queued:null,hpTimer:0,spTimer:0,lastCombat:-99,
      resolve:0,resolveAt:0,basicHits:0,knightNext:0,ward:null,ascendUntil:0,ascendLv:0,spellFlow:0,lastElement:'fire',falconAt:-9,enchant:null,thornsAt:-9,
      soulLast:'',soulLastAt:-9,soulProcAt:-9,flameNext:0,chainEmp:false,chainSp:false,guard:0,guardHits:0,guardAt:0,guardBasic:0,thornsCharges:0};
  }
  get time(){return this.clock;}
  get alpha(){return clamp(this.acc/H,0,1);}
  get derived(){return this.stats;}
  get inTown(){return this.map.def.theme==='town';}
  inCombat():boolean{
    if(this.inTown)return false;
    return this.clock-this.player.lastCombat<4||this.player.auto||this.monsters.some(m=>m.state==='chase')||!!this.player.cast;
  }
  setStats(d:Derived,baseLv:number){
    // v6.5: switching 戰魂 clears the previous soul's states (no carrying one soul's buffs into another).
    if(this.stats&&this.stats.soul!==d.soul){const p=this.player;p.enchant=null;p.flameNext=0;p.chainEmp=false;p.chainSp=false;p.guard=0;p.guardHits=0;p.soulLast='';}
    this.stats=d;this.baseLv=baseLv;
    this.player.hp=Math.min(this.player.hp,d.maxHp);this.player.sp=Math.min(this.player.sp,d.maxSp);
  }
  setVitals(hp:number,sp:number){this.player.hp=clamp(hp,0,this.stats.maxHp);this.player.sp=clamp(sp,0,this.stats.maxSp);this.player.dead=this.player.hp<=0;}

  /** Summons, updates (level up) or dismisses the companion. */
  setAlly(role:CompanionRole|null,lv:number,mode?:CompanionMode){
    if(!role){this.ally=null;return;}
    const st=companionStats(role,lv),prev=this.ally?.role===role?this.ally:null,p=this.player;
    const base={x:p.x-.8,y:p.y+.6,px:p.x-.8,py:p.y+.6,path:[],pathTimer:0,targetId:null,attackTimer:0,skillTimer:2,blessUntil:0,facing:2,attackAt:-9,hurtAt:-9,dead:false,reviveAt:0,retreating:false};
    this.ally={...(prev??base),mode:mode??prev?.mode??DEFAULT_MODE[role],role,level:lv,maxHp:st.maxHp,hp:prev?Math.min(prev.hp+(st.maxHp-prev.maxHp),st.maxHp):st.maxHp,atk:st.atk,def:st.def,range:st.range,aspd:st.aspd,speed:st.speed,magic:st.magic,heal:'heal' in st?st.heal??0:0};
  }
  setRiding(on:boolean,speed=1,id:string|null=null){this.riding=on&&!this.player.dead;this.mountSpeed=speed;this.mountId=id;}
  /** Which mount (for 龍騎士 effects). */
  mountId:string|null=null;
  /** v6.2 騎乘戰鬥: a knight keeps riding while fighting. */
  mountedKnight(){return this.riding&&this.stats?.job2==='knight';}
  private dragonRider(){return this.mountedKnight()&&this.mountId==='emberWyvern';}
  private dismount(){if(this.riding&&!this.mountedKnight()){this.riding=false;this.events.push({t:'dismount'});}}
  loadMap(id:string,x:number,y:number){
    if(this.map){this.mapItems.set(this.map.def.id,this.items);this.mapChests.set(this.map.def.id,this.chests);}
    this.trial=null;this.worldEvent=null;this.zones=[];this.traps=[];this.prey=null;this.abyss=null;this.challenge=null;
    this.map=buildMap(id);this.monsters=[];this.items=(this.mapItems.get(id)??[]).filter(i=>i.expires>this.clock);this.delayed=[];this.events=[];this.acc=0;this.warpPending=false;
    const p=this.player,spot=this.map.grid.nearestWalkable(x,y)??{x:Math.floor(x),y:Math.floor(y)};
    Object.assign(p,{x:spot.x+.5,y:spot.y+.5,px:spot.x+.5,py:spot.y+.5,vx:0,vy:0,path:[],target:null,cast:null,pending:null,sitting:false});
    p.auto=p.auto&&!this.inTown;
    if(this.ally){const a=this.ally;Object.assign(a,{x:p.x-.8,y:p.y+.6,px:p.x-.8,py:p.y+.6,path:[],targetId:null});if(!this.map.grid.free(a.x,a.y)){a.x=a.px=p.x;a.y=a.py=p.y;}}
    this.chests=(this.mapChests.get(id)??[]);this.refillChests();
    this.nextWorldEventAt=this.clock+WORLD_EVENT.first[0]+this.erng()*(WORLD_EVENT.first[1]-WORLD_EVENT.first[0]);
    for(const sp of this.map.def.spawns){const hab=habitatOf(id,sp.monster),inHab=hab?Math.ceil(sp.count*HABITAT_SHARE):0;for(let i=0;i<sp.count;i++){
      const area=i<inHab&&hab?{x:Math.max(2,hab.x-hab.r),y:Math.max(2,hab.y-hab.r),w:hab.r*2,h:hab.r*2}:sp.area??{x:2,y:2,w:this.map.w-4,h:this.map.h-4};
      const m=this.spawn(sp.monster,area);if(sp.boost)this.boostMonster(m,sp.boost);else this.maybeElite(m);const remaining=(this.mvpDeadlines[`${id}:${m.def.id}`]??0)-this.clock;if(m.def.mvp&&remaining>0){m.state='dead';m.hp=0;m.respawnTimer=remaining;m.deadAt=this.clock;}}}
  }
  /** Runtime cooldowns pause with the simulation. Save deadlines are Unix ms; offline reload may elapse them. */
  exportMvpCooldowns():Record<string,number>{return Object.fromEntries(Object.entries(this.mvpDeadlines).filter(([,t])=>t>this.clock).map(([k,t])=>[k,Math.round(this.now()+(t-this.clock)*1000)]));}
  importMvpCooldowns(deadlines:Record<string,number>){
    this.mvpDeadlines={};for(const [key,deadline] of Object.entries(deadlines)){const [map,id]=key.split(':');if(!maps[map]?.spawns.some(s=>s.monster===id)||!monsters[id]?.mvp||!Number.isFinite(deadline)||deadline<=this.now())continue;this.mvpDeadlines[key]=this.clock+(deadline-this.now())/1000;}
    if(this.map)for(const m of this.monsters){const remaining=(this.mvpDeadlines[`${this.map.def.id}:${m.def.id}`]??0)-this.clock;if(m.def.mvp&&remaining>0){m.state='dead';m.hp=0;m.respawnTimer=remaining;}}
  }
  // ———————————————————————— v4.6 exploration ————————————————————————
  /** v4.6: chests are saved too, so reloading neither rerolls rare chests nor loses a trial/supply chest. */
  exportChests():Record<string,{x:number;y:number;tier:ChestTier;elite?:string;bonus?:boolean}[]>{
    const all=new Map(this.mapChests);if(this.map)all.set(this.map.def.id,this.chests);
    return Object.fromEntries([...all].map(([m,l])=>[m,l.filter(c=>c.tier!=='eclipse')] as const).filter(([,l])=>l.length).map(([m,l])=>[m,l.map(c=>({x:c.x,y:c.y,tier:c.tier,...(c.elite?{elite:c.elite}:{}),...(c.bonus?{bonus:true}:{})}))]));
  }
  importChests(saved:Record<string,{x:number;y:number;tier:ChestTier;elite?:string;bonus?:boolean}[]>|undefined){
    if(!saved)return;this.mapChests.clear();
    for(const [m,list] of Object.entries(saved)){if(!maps[m]||!Array.isArray(list))continue;
      this.mapChests.set(m,list.filter(c=>Number.isFinite(c.x)&&Number.isFinite(c.y)&&this.chestCellOk(m,c.x,c.y)&&['normal','rare','trial','supply'].includes(c.tier)).slice(0,12).map(c=>({id:this.chestSerial++,x:c.x,y:c.y,tier:c.tier,...(c.elite&&monsters[c.elite]?{elite:c.elite}:{}),...(c.bonus?{bonus:true}:{})})));}
    if(this.map){this.chests=this.mapChests.get(this.map.def.id)??[];this.refillChests();}
  }
  private chestCellOk(map:string,x:number,y:number){const md=map===this.map?.def.id?this.map:buildMap(map);const cx=Math.floor(x),cy=Math.floor(y);return md.grid.walkable(cx,cy)&&!!md.reachable[cy*md.w+cx];}
  exportExploreCooldowns():Record<string,number>{return Object.fromEntries(Object.entries(this.exploreDeadlines).filter(([,t])=>t>this.clock).map(([k,t])=>[k,Math.round(this.now()+(t-this.clock)*1000)]));}
  importExploreCooldowns(deadlines:Record<string,number>){
    this.exploreDeadlines={};for(const [k,d] of Object.entries(deadlines??{}))if(Number.isFinite(d)&&d>this.now()&&validExploreKey(k))this.exploreDeadlines[k]=this.clock+(d-this.now())/1000;
    if(this.map)this.refillChests();
  }
  /** Cell of landmark i on the current map (same rule the renderer uses). */
  landmarkCell(key:string):Vec|null{
    const [map,i]=key.split(':');if(!this.map||map!==this.map.def.id)return null;const lm=landmarks[map]?.[Number(i)];if(!lm)return null;
    const c=this.map.grid.nearestWalkable(lm.x,lm.y,8);return c?{x:c.x+.5,y:c.y+.5}:null;
  }
  /** Remaining cooldown (seconds) of a landmark action; 0 when ready. */
  landmarkCooldown(key:string):number{const lm=this.landmarkDef(key);if(!lm)return 0;const t=this.exploreDeadlines[`${lm.action}:${key}`]??0;return Math.max(0,t-this.clock);}
  private landmarkDef(key:string){const [map,i]=key.split(':');return landmarks[map]?.[Number(i)];}
  openChest(id:number){const p=this.player,c=this.chests.find(c=>c.id===id);if(p.dead||!c)return;this.takeOver();p.sitting=false;p.target={kind:'chest',id};p.pending=null;this.pathTo(c.x,c.y);}
  useLandmark(key:string){const p=this.player,c=this.landmarkCell(key);if(p.dead||!c)return;this.takeOver();p.sitting=false;p.target={kind:'landmark',key};p.pending=null;this.pathTo(c.x,c.y+1);}
  private chestSlotsBusy(map:string){let n=0;for(const [k,t] of Object.entries(this.exploreDeadlines))if(k.startsWith(`chest:${map}:`)){if(t<=this.clock)delete this.exploreDeadlines[k];else n++;}return n;}
  private refillChests(){
    const id=this.map.def.id;if(!(id in MAP_TIER))return;
    const cap=CHEST.perMap-this.chestSlotsBusy(id),field=this.chests.filter(c=>(c.tier==='normal'||c.tier==='rare')&&!c.bonus);
    // Keep the invariant (field chests + cooling slots ≤ perMap) even when cooldowns arrive after the map was built.
    if(field.length>cap){const drop=new Set(field.slice(cap).map(c=>c.id));this.chests=this.chests.filter(c=>!drop.has(c.id));}
    const want=cap-Math.min(field.length,cap);
    for(let i=0;i<want;i++){const at=this.chestSpot();if(!at)break;this.chests.push({id:this.chestSerial++,x:at.x,y:at.y,tier:this.crng()<CHEST.rareChance?'rare':'normal'});}
  }
  private chestSpot():Vec|null{
    const lms=(landmarks[this.map.def.id]??[]).map((_,i)=>this.landmarkCell(`${this.map.def.id}:${i}`)).filter((v):v is Vec=>!!v);
    for(let tries=0;tries<120;tries++){
      const x=2+Math.floor(this.crng()*(this.map.w-4)),y=2+Math.floor(this.crng()*(this.map.h-4));
      if(!this.map.grid.walkable(x,y)||!this.map.reachable[y*this.map.w+x])continue;
      const v={x:x+.5,y:y+.5};
      if(this.map.def.warps.some(w=>Math.hypot(w.x-x,w.y-y)<6)||dist(v,this.player)<6)continue;
      if(this.chests.some(c=>dist(c,v)<CHEST.minGap)||lms.some(l=>dist(l,v)<3))continue;
      return v;
    }
    return null;
  }
  private takeChest(c:Chest){
    if(c.tier==='eclipse'&&this.embers<ECLIPSE.chestCost){this.events.push({t:'fail',reason:`星蝕寶箱需要 ${ECLIPSE.chestCost} 個星蝕餘燼（目前 ${this.embers}）`});return;}
    this.chests=this.chests.filter(x=>x.id!==c.id);
    if((c.tier==='normal'||c.tier==='rare')&&!c.bonus)this.exploreDeadlines[`chest:${this.map.def.id}:${Math.round(this.now())}${c.id}`]=this.clock+CHEST.respawn;
    if(c.tier==='normal'&&this.crng()<CHEST.mimicChance){this.spawnMimic(c);return;}
    this.events.push({t:'chest',chest:c,map:this.map.def.id});
  }
  private spawnMimic(c:Chest){
    // Scales with the player, never above the map: a meadow mimic must stay fair for a meadow-level character.
    const tier=Math.max(2,Math.min(MAP_TIER[this.map.def.id]??10,this.baseLv)),base=monsters.mimic,m=this.spawn('mimic',{x:Math.floor(c.x)-2,y:Math.floor(c.y)-2,w:4,h:4});
    m.def={...base,level:tier,hp:tier*60,atk:[Math.round(tier*1.6),Math.round(tier*2.3)],def:Math.round(tier*.6),mdef:Math.round(tier*.5),exp:tier*tier*3,jexp:tier*tier*2,speed:1.6,respawn:0};
    m.hp=m.maxHp=m.def.hp;m.summoned=true;m.mimic=true;Object.assign(m,{x:c.x,y:c.y,px:c.x,py:c.y,home:{x:c.x,y:c.y},state:'chase'});
    this.events.push({t:'fx',kind:'summon',x:c.x,y:c.y,dur:.6,r:1.5});
    this.events.push({t:'explore',text:'寶箱突然張開大嘴——是寶箱怪！打倒牠會留下稀有寶箱。'});
  }
  private placeNear(m:Monster,cx:number,cy:number,r0:number,r1:number){
    for(let tries=0;tries<60;tries++){const a=this.crng()*Math.PI*2,r=r0+this.crng()*(r1-r0),x=Math.floor(cx+Math.cos(a)*r),y=Math.floor(cy+Math.sin(a)*r);
      if(!this.map.grid.walkable(x,y)||!this.map.reachable[y*this.map.w+x])continue;Object.assign(m,{x:x+.5,y:y+.5,px:x+.5,py:y+.5,home:{x:x+.5,y:y+.5}});return;}
  }
  private landmarkAction(key:string){
    const lm=this.landmarkDef(key),at=this.landmarkCell(key);if(!lm||!at)return;
    const wait=this.landmarkCooldown(key);
    if(wait>0){this.events.push({t:'explore',text:`${lm.name}還需要 ${Math.ceil(wait/60)} 分鐘才能再次使用。`});return;}
    if(lm.action==='supply'){
      const spot=this.map.grid.nearestWalkable(Math.floor(at.x+1.5),Math.floor(at.y+1),3)??{x:Math.floor(at.x),y:Math.floor(at.y)};
      this.chests.push({id:this.chestSerial++,x:spot.x+.5,y:spot.y+.5,tier:'supply'});this.exploreDeadlines[`supply:${key}`]=this.clock+SUPPLY_COOLDOWN;
      this.events.push({t:'explore',text:`在${lm.name}找到了冒險者留下的補給箱！`});return;
    }
    const T=TRIALS[key];if(!T)return;
    if(this.trial){this.events.push({t:'explore',text:'已經有一場試煉正在進行。'});return;}
    const base=monsters[T.elite],area={x:Math.floor(at.x)-6,y:Math.floor(at.y)-6,w:12,h:12};
    const e=this.spawn(T.elite,area);
    e.def={...base,name:`【試煉】${base.name}`,hp:Math.round(base.hp*T.hpMul),atk:[Math.round(base.atk[0]*T.atkMul),Math.round(base.atk[1]*T.atkMul)],exp:base.exp*T.expMul,jexp:base.jexp*T.expMul,
      aggressive:true,cardRate:Math.min(1,base.cardRate*10),respawn:0,art:{...base.art,scale:base.art.scale*1.45}};
    e.hp=e.maxHp=e.def.hp;e.summoned=true;e.trial=key;this.placeNear(e,at.x,at.y,3,5);e.state='chase';
    for(const [mid,n] of T.minions)for(let i=0;i<n;i++){const m=this.spawn(mid,area);m.summoned=true;this.placeNear(m,at.x,at.y,3,6);m.state='chase';}
    this.trial={key,eliteId:e.id};
    this.events.push({t:'fx',kind:'summon',x:at.x,y:at.y,dur:.8,r:3});
    this.events.push({t:'trialStart',key,name:T.title});
  }
  /** v4.8 dungeon scaling: a per-instance stronger copy of the def (id, art and card stay the same). */
  /** v6.3: on field maps a plain monster has a small chance to (re)spawn as a ★菁英. */
  private maybeElite(m:Monster){
    if(m.baseDef){m.def=m.baseDef;m.baseDef=undefined;m.elite=undefined;m.hp=m.maxHp=m.def.hp;}
    if(!(this.map.def.id in MAP_TIER)||m.def.mvp||m.summoned||m.trial||m.def.name.startsWith('【')||m.def.id==='mimic'||this.crng()>=ELITE_CHANCE)return;
    const all=Object.keys(ELITE_NAMES) as EliteKind[],kinds:EliteKind[]=[all[Math.floor(this.crng()*all.length)]];
    if(this.crng()<.35){const rest=all.filter(k=>k!==kinds[0]);kinds.push(rest[Math.floor(this.crng()*rest.length)]);}
    this.makeElite(m,kinds);
  }
  makeElite(m:Monster,kinds:EliteKind[]){
    const d=m.baseDef??m.def,has=(k:EliteKind)=>kinds.includes(k),hp=Math.round(d.hp*2.5*(has('tough')?1.8:1)),atk=has('fury')?1.3:1;
    m.baseDef=d;m.elite=kinds;m.eliteAt=0;
    m.def={...d,name:`★${kinds.map(k=>ELITE_NAMES[k]).join('・')} ${d.name}`,hp,atk:[Math.round(d.atk[0]*atk),Math.round(d.atk[1]*atk)],exp:d.exp*4,jexp:d.jexp*4,aggressive:true,
      speed:d.speed*(has('swift')?1.6:1),aspd:d.aspd*(has('swift')?.7:1),cardRate:Math.min(1,d.cardRate*4),drops:d.drops.map(x=>({...x,rate:Math.min(1,x.rate*3)})),art:{...d.art,scale:d.art.scale*1.3}};
    m.hp=m.maxHp=hp;
  }
  private boostMonster(m:Monster,b:{hp:number;atk:number;exp:number;elite?:boolean}){
    const d=m.def;m.def={...d,name:b.elite?`【精英】${d.name}`:d.name,hp:Math.round(d.hp*b.hp),atk:[Math.round(d.atk[0]*b.atk),Math.round(d.atk[1]*b.atk)],exp:Math.round(d.exp*b.exp),jexp:Math.round(d.jexp*b.exp),
      aggressive:true,cardRate:b.elite?Math.min(1,d.cardRate*5):d.cardRate,art:b.elite?{...d.art,scale:d.art.scale*1.35}:d.art,
      // Harder fights should pay at least as well as the open field: boosted monsters drop more often.
      drops:d.drops.map(x=>({...x,rate:Math.min(1,x.rate*(b.elite?3:1.6))}))};
    m.hp=m.maxHp=m.def.hp;
  }
  // ———————————————————————— v5.1 星光異變 (world events) ————————————————————————
  private endWorldEvent(){this.worldEvent=null;this.nextWorldEventAt=this.clock+WORLD_EVENT.gap[0]+this.erng()*(WORLD_EVENT.gap[1]-WORLD_EVENT.gap[0]);}
  /** Debug / test hook: start an event right now. */
  startWorldEvent(kind:WorldEventKind){if(!(this.map.def.id in MAP_TIER)||this.worldEvent)return false;return this.beginWorldEvent(kind);}
  private beginWorldEvent(kind:WorldEventKind):boolean{
    const p=this.player,now=this.clock;
    if(kind==='eclipse')return this.beginEclipse();
    if(kind==='golden'){
      const pool=this.monsters.filter(m=>m.state!=='dead'&&!m.def.mvp&&!m.summoned&&!m.trial&&m.def===monsters[m.def.id]&&dist(m,p)<32);
      if(!pool.length)return this.beginWorldEvent('meteor');
      const m=pool[Math.floor(this.erng()*pool.length)],d=m.def;
      m.def={...d,name:`【黃金】${d.name}`,hp:d.hp*4,exp:d.exp*5,jexp:d.jexp*5,cardRate:Math.min(1,d.cardRate*10),drops:d.drops.map(x=>({...x,rate:Math.min(1,x.rate*3)})),art:{...d.art,body:'#ffd45c',accent:'#fff6c4',scale:d.art.scale*1.3}};
      m.hp=m.maxHp=m.def.hp;m.golden=true;
      this.worldEvent={kind,started:now,until:now+WORLD_EVENT.golden,nextAt:now,targetId:m.id};
      this.events.push({t:'fx',kind:'summon',x:m.x,y:m.y,dur:.8,r:2});
      this.events.push({t:'worldEvent',phase:'start',kind,text:`${d.name}全身發出金光，變成了黃金魔物！${WORLD_EVENT.golden} 秒內打倒牠！`});return true;}
    if(kind==='invasion'){
      const camp=(landmarks[this.map.def.id]??[]).findIndex(l=>l.action==='supply'),c=camp>=0?this.landmarkCell(`${this.map.def.id}:${camp}`):null;
      // v6.2: the attack comes to you (it used to gather at a camp that could be far away).
      void c;const center={x:p.x,y:p.y};
      this.worldEvent={kind,started:now,until:now+WORLD_EVENT.invasion,nextAt:now+1.5,center,wave:0};
      this.events.push({t:'worldEvent',phase:'start',kind,text:'大批魔物正朝這裡湧來！撐過三波進攻！'});return true;}
    this.worldEvent={kind,started:now,until:now+WORLD_EVENT.meteor,nextAt:now+1};
    this.events.push({t:'worldEvent',phase:'start',kind,text:'天空劃過無數流星！流星會砸傷魔物、留下星屑，期間經驗值 +20%！'});return true;
  }
  private tickWorldEvent(){
    const id=this.map.def.id,p=this.player;if(!(id in MAP_TIER))return;
    const e=this.worldEvent;
    if(!e){if(this.eventsEnabled&&!p.dead&&this.clock>=this.nextWorldEventAt){const r=this.erng();this.beginWorldEvent(this.tier.id>=2&&r<.35?'eclipse':r<.55?'meteor':r<.8?'golden':'invasion');}return;}
    const tier=MAP_TIER[id]??10;
    if(e.kind==='eclipse'){this.tickEclipse(e);return;}
    if(e.kind==='meteor'){
      if(this.clock>=e.until){this.events.push({t:'worldEvent',phase:'success',kind:'meteor',text:'流星雨結束了。'});this.endWorldEvent();return;}
      if(this.clock>=e.nextAt){e.nextAt=this.clock+1.3+this.erng()*.9;
        for(let t=0;t<12;t++){const a=this.erng()*Math.PI*2,r=2+this.erng()*6,x=Math.floor(p.x+Math.cos(a)*r),y=Math.floor(p.y+Math.sin(a)*r);
          if(!this.map.grid.walkable(x,y))continue;const c={x:x+.5,y:y+.5};
          this.events.push({t:'fx',kind:'meteor',x:c.x,y:c.y,dur:.45});
          this.later(.45,()=>{if(!this.worldEvent)return;
            for(const m of this.monsters)if(m.state!=='dead'&&dist(m,c)<=1.8){const amount=Math.max(1,Math.round(m.def.mvp?m.maxHp*.02:m.maxHp*.35+tier*15));
              this.resolveHit(m,{amount,crit:false,miss:false},{skill:'meteorShower',mult:1,element:'neutral',magic:true,derived:true});}
            if(this.erng()<.55){const item:GroundItem={id:this.serial++,kind:'item',defId:'starFragment',count:1,x:c.x,y:c.y,expires:this.clock+60,mine:true};this.items.push(item);this.events.push({t:'drop',item});}});
          break;}}
      return;}
    if(e.kind==='golden'){
      const m=this.monsters.find(x=>x.id===e.targetId);
      if(!m||m.state==='dead'&&!m.golden){if(this.worldEvent===e)this.endWorldEvent();return;}
      if(this.clock>=e.until){m.golden=false;m.def=monsters[m.def.id]?this.tierDef(m.def.id):m.def;m.maxHp=m.def.hp;m.hp=Math.min(m.hp,m.maxHp);
        this.events.push({t:'worldEvent',phase:'fail',kind:'golden',text:'黃金魔物的光芒消失了……下次要快一點！'});this.endWorldEvent();}
      return;}
    // invasion
    const c=e.center!;
    if((e.wave??0)<WORLD_EVENT.waves&&this.clock>=e.nextAt){
      const wave=(e.wave??0)+1;e.wave=wave;e.nextAt=this.clock+WORLD_EVENT.waveEvery;
      const kinds=[...new Set(this.map.def.spawns.filter(s=>!monsters[s.monster].mvp&&s.count>=3).map(s=>s.monster))];
      const at=this.player.dead?c:{x:this.player.x,y:this.player.y};e.center={...at};
      for(let i=0;i<4+wave*2;i++){const k=kinds[Math.floor(this.erng()*kinds.length)];if(!k)break;const m=this.spawn(k,{x:Math.floor(at.x)-8,y:Math.floor(at.y)-8,w:16,h:16});
        m.summoned=true;m.invasion=true;this.placeNear(m,at.x,at.y,7,10);m.state='chase';}
      this.events.push({t:'fx',kind:'summon',x:c.x,y:c.y,dur:.8,r:4});
      this.events.push({t:'worldEvent',phase:'start',kind:'invasion',text:`第 ${wave} 波魔物來襲！`});}
    const alive=this.monsters.some(m=>m.invasion&&m.state!=='dead');
    if((e.wave??0)>=WORLD_EVENT.waves&&!alive){
      this.chests.push({id:this.chestSerial++,x:c.x,y:c.y,tier:'rare',bonus:true});
      this.events.push({t:'worldEvent',phase:'success',kind:'invasion',text:'三波進攻全部擊退！稀有寶箱出現在營地旁！',exp:Math.round(.55*tier*tier*25)});this.endWorldEvent();return;}
    if(this.clock>=e.until){for(const m of this.monsters)if(m.invasion)m.invasion=false;
      this.events.push({t:'worldEvent',phase:'fail',kind:'invasion',text:'魔物大進攻結束了，剩下的魔物四散而去。'});this.endWorldEvent();}
  }
  // ———————————————————————— v6.3 星光深淵 ————————————————————————
  /** Monster level for a floor (floor 1 ≈ Lv.32, +2 per floor); past the strongest templates the stats keep climbing. */
  static abyssLevel(floor:number){return 30+floor*2;}
  /** Builds floor `floor` in the abyss arena: a wave of monsters near that level, or a boss every 5 floors. */
  startAbyssFloor(floor:number){
    if(this.map.def.id!=='abyss')return;
    for(const m of this.monsters)m.state='dead';this.monsters=[];this.items=[];this.zones=[];this.traps=[];
    const p=this.player,st=this.map.def.start,spot=this.map.grid.nearestWalkable(st.x,st.y)!;Object.assign(p,{x:spot.x+.5,y:spot.y+.5,px:spot.x+.5,py:spot.y+.5,path:[],target:null,pending:null});
    const L=World.abyssLevel(floor),boss=floor%5===0;
    const pool=Object.values(monsters).filter(d=>!d.mvp&&!d.id.startsWith('oath_')&&d.id!=='mimic'&&!d.id.startsWith('exp_')&&d.level<=L+2&&d.level>=Math.min(L,82)-10&&maps2has(d.id));
    const list=pool.length?pool:Object.values(monsters).filter(d=>!d.mvp&&d.level>=70&&maps2has(d.id));
    const top=Math.max(0,L-82),hpMul=(1+floor*.02)*(1+top*.06),atkMul=(1+floor*.01)*(1+top*.035),expMul=1+floor*.04;
    const area={x:12,y:6,w:24,h:28};
    const scale=(m:Monster,h:number,a:number,e:number)=>{const d=m.def;m.def={...d,hp:Math.round(d.hp*h),atk:[Math.round(d.atk[0]*a),Math.round(d.atk[1]*a)],def:Math.round(d.def*(1+top*.02)),
      exp:Math.round(d.exp*e),jexp:Math.round(d.jexp*e),aggressive:true,respawn:1e9};m.hp=m.maxHp=m.def.hp;m.summoned=true;};
    if(boss){const bosses=Object.values(monsters).filter(d=>d.mvp&&!d.id.startsWith('oath_')&&d.respawn<86400);
      const b=bosses.sort((x,y)=>Math.abs(x.level-L)-Math.abs(y.level-L))[(floor/5)%2===0?0:Math.min(1,bosses.length-1)];
      const m=this.spawn(b.id,area);scale(m,hpMul*.7,atkMul*.9,expMul*.5);this.placeNear(m,26,20,0,3);m.state='chase';}
    const n=boss?4:Math.min(16,8+Math.floor(floor/3));
    for(let i=0;i<n;i++){const d=list[Math.floor(this.crng()*list.length)];const m=this.spawn(d.id,area);scale(m,hpMul,atkMul,expMul);
      if(this.crng()<.15+floor*.01)this.makeElite(m,[(['swift','tough','fury','vamp','shield','split'] as EliteKind[])[Math.floor(this.crng()*6)]]);
      this.placeNear(m,24,20,2,10);m.state='chase';}
    this.abyss={floor,cleared:false,boss};this.events.push({t:'abyss',phase:'start',floor,boss});
  }
  private tickAbyss(){
    const a=this.abyss;if(!a||a.cleared||this.map.def.id!=='abyss')return;
    if(this.monsters.some(m=>m.state!=='dead'))return;
    a.cleared=true;const c=this.map.grid.nearestWalkable(20,20,6)!;
    this.chests.push({id:this.chestSerial++,x:c.x+.5,y:c.y+.5,tier:a.boss?'trial':'rare',bonus:true});
    const L=World.abyssLevel(a.floor);
    this.events.push({t:'abyss',phase:'clear',floor:a.floor,boss:a.boss,exp:Math.round(.55*L*L*(6+a.floor*.3)),zeny:Math.round(L*L*(a.boss?6:2))});
  }
  /** v6.0: a scripted boss (the 誓約試煉 guardian) placed near a point; it never respawns once beaten. */
  spawnBoss(id:string,x:number,y:number):Monster|null{
    if(!monsters[id]||this.monsters.some(m=>m.def.id===id&&m.state!=='dead'))return null;
    const m=this.spawn(id,{x:Math.floor(x)-2,y:Math.floor(y)-2,w:4,h:4});m.summoned=true;this.placeNear(m,x,y,0,2);m.home={x:m.x,y:m.y};
    this.events.push({t:'fx',kind:'summon',x:m.x,y:m.y,dur:1,r:3});return m;
  }
  private spawn(id:string,area:{x:number;y:number;w:number;h:number}):Monster{
    const def=this.tierActive()?this.tierDef(id):monsters[id];
    const m:Monster={id:this.serial++,def,x:0,y:0,px:0,py:0,hp:def.hp,maxHp:def.hp,state:'idle',home:{x:0,y:0},area,path:[],pathGoal:null,pathTimer:0,
      attackTimer:0,wanderTimer:this.rng()*4,respawnTimer:0,slowUntil:0,rootUntil:0,frozenUntil:0,stunUntil:0,provoke:null,dots:[],facing:2,hitAt:-9,attackAt:-9,deadAt:-9,knock:null,slamTimer:6,summonedOnce:false,summoned:false};
    this.placeMonster(m);this.monsters.push(m);
    return m;
  }
  private placeMonster(m:Monster){
    for(let tries=0;tries<80;tries++){
      const x=Math.floor(m.area.x+this.rng()*m.area.w),y=Math.floor(m.area.y+this.rng()*m.area.h);
      if(!this.map.grid.walkable(x,y)||!this.map.reachable[y*this.map.w+x])continue;
      if(dist({x,y},this.player)<8)continue;
      if(this.map.def.warps.some(w=>Math.hypot(w.x-x,w.y-y)<5))continue;
      Object.assign(m,{x:x+.5,y:y+.5,px:x+.5,py:y+.5,home:{x:x+.5,y:y+.5}});return;
    }
    const s=this.map.def.start;Object.assign(m,{x:s.x+10.5,y:s.y+.5,px:s.x+10.5,py:s.y+.5,home:{x:s.x+10.5,y:s.y+.5}});
  }

  // ———————————————————————— commands from input ————————————————————————
  private takeOver(){this.manualUntil=this.clock+.3;if(this.player.auto)this.player.auto=false;}
  moveTo(x:number,y:number,manual=true){
    const p=this.player;if(p.dead)return;if(manual)this.takeOver();
    p.sitting=false;p.target=null;p.pending=null;p.queued=null;
    if(p.cast){this.cancelCast();}
    this.pathTo(x,y);
  }
  /** v6.4 attack key: the given monster, else the nearest one around you (bosses only if they are already on you). */
  attackNearest(prefer:number|null){
    const p=this.player;if(p.dead||this.inTown)return false;
    const m=(prefer!==null?this.monsters.find(x=>x.id===prefer&&x.state!=='dead'):undefined)
      ??this.monsters.filter(x=>x.state!=='dead'&&dist(x,p)<12&&(!x.def.mvp||x.state==='chase')).sort((a,b)=>dist(a,p)-dist(b,p))[0];
    if(!m)return false;this.attack(m.id);return true;
  }
  attack(monsterId:number){
    const p=this.player,m=this.monsters.find(m=>m.id===monsterId&&m.state!=='dead');if(p.dead||!m)return;
    this.takeOver();p.sitting=false;p.target={kind:'monster',id:monsterId};p.pending=null;this.focusId=monsterId;this.manualBossId=m.def.mvp?m.id:this.manualBossId;
  }
  pickUp(itemId:number){const p=this.player;if(p.dead)return;this.takeOver();p.sitting=false;p.target={kind:'item',id:itemId};p.pending=null;const it=this.items.find(i=>i.id===itemId);if(it)this.pathTo(it.x,it.y);}
  talk(npcId:string){const p=this.player,n=this.map.def.npcs.find(n=>n.id===npcId);if(p.dead||!n)return;this.takeOver();p.sitting=false;p.target={kind:'npc',id:npcId};this.pathTo(n.x+.5,n.y+1.5);}
  toggleSit(){const p=this.player;if(p.dead||p.cast)return;p.sitting=!p.sitting;if(p.sitting){p.path=[];p.target=null;}}
  setAuto(on:boolean){this.player.auto=on&&!this.inTown&&!this.player.dead;if(!on&&this.player.target?.kind==='monster')this.player.target=null;}
  /** Use a skill. Enemy skills need a monster id; ground skills a position. Out of range → walk first (RO). */
  useSkill(skill:string,monsterId:number|null,ground:Vec|null,manual=true):boolean{
    const p=this.player,sk=skills[skill],lv=this.stats.skillLevels[skill]??0;
    if(manual){this.manualUntil=this.clock+.3;const tm=monsterId!==null?this.monsters.find(m=>m.id===monsterId):undefined;if(tm?.def.mvp)this.manualBossId=tm.id;}
    const fail=(reason:string)=>{if(manual)this.events.push({t:'fail',reason});return false;};
    if(p.dead)return fail('無法行動');
    if(!sk||lv<1||sk.target==='passive')return fail('尚未學會這個技能');
    if(sk.mounted&&!this.riding)return fail(`${sk.name}要騎乘時才能使用（按 R 騎上坐騎）`);
    if(monsterId!==null)this.focusId=monsterId;
    // v4.9 input buffer: pressing a skill while still casting / recovering queues it (one slot, newest wins) instead of failing.
    const cd=(p.cooldowns[skill]??0)-this.clock;
    if(manual&&(p.cast||p.pending||this.clock<p.afterCastUntil||(cd>0&&cd<=.8))){
      if(sk.target==='enemy'&&!this.monsters.some(m=>m.id===monsterId&&m.state!=='dead'))return fail('請選擇目標');
      if(sk.target==='ground'&&!ground)return fail('請選擇地點');
      p.queued={skill,monsterId,ground:ground?{...ground}:null};return true;}
    if(p.cast)return fail('正在詠唱中');
    if(cd>0)return fail('技能冷卻中');
    if(this.clock<p.afterCastUntil)return fail('技能延遲中');
    if(p.sp<this.spCost(skill,lv))return fail('SP 不足');
    if(this.inTown&&sk.target!=='self')return fail('城鎮內無法使用攻擊技能');
    if(sk.target==='enemy'){
      const m=this.monsters.find(m=>m.id===monsterId&&m.state!=='dead');if(!m)return fail('請選擇目標');
      p.sitting=false;p.target={kind:'monster',id:m.id};p.pending={skill,lv,monsterId:m.id,ground:null};
    }else if(sk.target==='ground'){
      if(!ground)return fail('請選擇地點');
      p.sitting=false;p.pending={skill,lv,monsterId:null,ground:{...ground}};
    }else{p.sitting=false;p.pending={skill,lv,monsterId:null,ground:null};}
    return true;
  }
  /** v4.9 smart target for hotkeys: current target → last focus → nearest live monster within `range`. */
  skillTarget(range:number):Monster|null{
    const p=this.player,alive=(id:number|null|undefined)=>id!=null?this.monsters.find(m=>m.id===id&&m.state!=='dead')??null:null;
    // Only targets already inside the skill range: a key press must never send the character running across the map.
    const ok=(m:Monster|null)=>!!m&&dist(m,p)<=range+.5;
    const cur=p.target?.kind==='monster'?alive(p.target.id):null;if(ok(cur))return cur;
    const f=alive(this.focusId);if(ok(f))return f;
    // Something chasing you (e.g. while you run away) beats a random bystander.
    let chaser:Monster|null=null,cd=range+.5;for(const m of this.monsters)if(m.state==='chase'&&!m.def.mvp){const d=dist(m,p);if(d<cd){cd=d;chaser=m;}}
    if(chaser)return chaser;
    let best:Monster|null=null,bd=range+.5;for(const m of this.monsters)if(m.state!=='dead'&&!m.def.mvp){const d=dist(m,p);if(d<bd){bd=d;best=m;}}
    return best;
  }
  /** Try to capture a monster as a pet. Lower HP means a better chance; MVPs and summons cannot be captured. */
  tryCapture(monsterId:number):{ok:boolean;monster:string;x:number;y:number}|{error:string}{
    const m=this.monsters.find(m=>m.id===monsterId&&m.state!=='dead');
    if(!m)return {error:'請先指著或攻擊要捕捉的魔物'};
    if(m.def.mvp||m.summoned)return {error:'這隻魔物無法捕捉'};
    if(Math.hypot(m.x-this.player.x,m.y-this.player.y)>6)return {error:'距離太遠了，靠近一點再試'};
    const chance=.2+.6*(1-m.hp/m.maxHp);const ok=this.rng()<chance;
    if(ok){m.state='dead';m.hp=0;m.deadAt=this.clock;m.respawnTimer=m.def.respawn;m.dots=[];m.path=[];
      if(this.player.target?.kind==='monster'&&this.player.target.id===m.id)this.player.target=null;}
    else{m.state='chase';this.player.lastCombat=this.clock;}
    return {ok,monster:m.def.id,x:m.x,y:m.y};
  }
  cancelCast(){const p=this.player;p.queued=null;if(p.cast){if(p.echoUsed){p.echoUntil=Math.max(p.echoUntil,p.echoRefund);p.echoUsed=false;}this.events.push({t:'castEnd',skill:p.cast.skill,ok:false});p.cast=null;}}
  respawn(){const p=this.player;p.dead=false;p.hp=Math.max(1,Math.round(this.stats.maxHp*.5));p.sp=Math.round(this.stats.maxSp*.3);p.shields=[];}
  heal(hp:number,sp:number){
    const p=this.player;if(p.dead)return;
    if(hp){const a=Math.min(hp,this.stats.maxHp-p.hp);p.hp+=a;this.events.push({t:'heal',x:p.x,y:p.y,amount:Math.round(hp)});}
    if(sp){p.sp=Math.min(this.stats.maxSp,p.sp+sp);this.events.push({t:'heal',x:p.x,y:p.y,amount:Math.round(sp),sp:true});}
  }
  /** v4.5: start a food effect, replacing any current one. Returns the replaced food id. */
  eat(id:string,hp:number,sp:number,dur:number):string|null{const p=this.player;if(p.dead)return null;const prev=p.food&&p.food.until>this.clock?p.food.id:null;p.food={id,until:this.clock+dur,tick:1,hp,sp};return prev;}
  teleportRandom(){
    for(let i=0;i<200;i++){const x=Math.floor(2+this.rng()*(this.map.w-4)),y=Math.floor(2+this.rng()*(this.map.h-4));
      if(this.map.grid.walkable(x,y)&&this.map.reachable[y*this.map.w+x]){const p=this.player;Object.assign(p,{x:x+.5,y:y+.5,px:x+.5,py:y+.5,path:[],target:null,pending:null});this.cancelCast();
        for(const m of this.monsters)if(m.state==='chase'){m.state='idle';m.path=[];}return;}}
  }

  step(dt:number):SimEvent[]{
    if(this.warpPending)return [];
    // Hidden/background time is intentionally dropped by the caller; never replay a large catch-up.
    this.acc+=clamp(dt,0,.1);
    while(this.acc>=H){this.acc-=H;this.tick();if(this.warpPending){this.acc=0;break;}}
    const out=this.events;this.events=[];return out;
  }
  private pathTo(x:number,y:number){
    const p=this.player,cells=this.map.grid.findPath(p.x,p.y,x,y);
    p.path=cells?this.map.grid.smoothPath(p.x,p.y,cells,x,y):[];
  }

  // ———————————————————————— simulation ————————————————————————
  private tick(){
    this.clock+=H;this.pathBudget=12;
    const p=this.player;p.px=p.x;p.py=p.y;
    for(const m of this.monsters){m.px=m.x;m.py=m.y;}
    if(this.ally){this.ally.px=this.ally.x;this.ally.py=this.ally.y;}
    const due=this.delayed.filter(d=>d.at<=this.clock);this.delayed=this.delayed.filter(d=>d.at>this.clock);
    for(const d of due)d.run();
    if(!p.dead){this.autoBattle();this.playerAct();this.playerMove();this.walkOverPickup();this.regen();this.checkWarps();if(this.warpPending)return;}
    p.vx=(p.x-p.px)/H;p.vy=(p.y-p.py)/H;
    this.allyAct();
    this.monstersAct();
    this.items=this.items.filter(i=>i.expires>this.clock);
    if((this.chestCheck-=H)<=0){this.chestCheck=2;this.refillChests();}
    this.tickWorldEvent();
    this.tickSecondJob();this.tickSoul();this.tickAbyss();this.tickStarfall();this.tickChallenge();
    p.shields=p.shields.filter(s=>s.until>this.clock&&s.amount>0);
    if(p.endure&&p.endure.until<this.clock)p.endure=null;
    if(p.concentrate&&p.concentrate.until<this.clock)p.concentrate=null;
    if(p.food){if(p.food.until<=this.clock||p.dead)p.food=null;else if((p.food.tick-=H)<=0){p.food.tick+=1;if(p.food.hp)p.hp=Math.min(this.stats.maxHp,p.hp+p.food.hp);if(p.food.sp)p.sp=Math.min(this.stats.maxSp,p.sp+p.food.sp);}}
    if(p.regrowth){if(p.regrowth.until<this.clock)p.regrowth=null;else if((p.regrowth.tick-=H)<=0){p.regrowth.tick+=1;this.heal(this.stats.maxHp*p.regrowth.pct,0);}}
  }
  private conc(){return this.player.concentrate?1+this.player.concentrate.pct:1;}
  private hitStat(){return this.stats.hit+(this.conc()-1)*this.stats.stats.dex;}
  private fleeStat(){return this.stats.flee+(this.conc()-1)*this.stats.stats.agi;}
  private attackDelay(){return Math.max(.28,this.stats.attackDelay*(1-(this.conc()-1)*this.stats.stats.agi*.004));}

  private autoBattle(){
    const p=this.player;if(!p.auto||this.inTown||this.clock<this.manualUntil)return;
    // An MVP the player did not click is chasing: auto battle backs off instead of trading hits (MVPs are slower than you).
    const arena=!!this.abyss||!!this.challenge;// 星光深淵／星淵挑戰: the boss is the goal — auto battle fights it.
    const boss=arena?undefined:this.monsters.find(m=>m.def.mvp&&m.state==='chase'&&m.id!==this.manualBossId&&!m.def.id.startsWith('oath_')&&dist(m,p)<16);
    if(boss&&p.cast&&dist(boss,p)<11)this.cancelCast();
    if(p.cast||p.pending)return;
    const cur=p.target?.kind==='monster'?this.monsters.find(m=>m.id===(p.target as {id:number}).id&&m.state!=='dead'):undefined;
    if(boss){if(!this.retreatNoted.has(boss.id)){this.retreatNoted.add(boss.id);this.events.push({t:'explore',text:`${boss.def.name}正在追你！自動戰鬥會先撤退——想挑戰就點牠一下，之後自動戰鬥會繼續打牠。`});}
      if(this.clock>=this.autoRetreatAt){this.autoRetreatAt=this.clock+.6;
        // Best of 8 directions: a reachable cell ~10 tiles out, as far from the boss as possible (map edges block straight-back retreats).
        let best:Vec|null=null,score=-1;
        for(let k=0;k<8;k++){const a=k/8*Math.PI*2,c=this.map.grid.nearestWalkable(Math.floor(p.x+Math.cos(a)*10),Math.floor(p.y+Math.sin(a)*10),3);
          if(!c||!this.map.reachable[c.y*this.map.w+c.x])continue;const v={x:c.x+.5,y:c.y+.5},sc=dist(v,boss)-dist(v,p)*.2;if(sc>score){score=sc;best=v;}}
        if(best){p.target=null;this.pathTo(best.x,best.y);}}return;}
    if(cur){this.autoCast(cur);return;}
    const loot=this.items.find(i=>dist(i,p)<6&&i.mine);
    if(loot){p.target={kind:'item',id:loot.id};this.pathTo(loot.x,loot.y);return;}
    // v4.6: auto battle also opens chests close by when nothing is chasing the player.
    // Fighting always wins over looting: any chaser, or 8 s without arriving, drops the chest (skipped for 30 s).
    const threatened=this.monsters.some(m=>m.state==='chase'&&dist(m,p)<9);
    if(p.target?.kind==='chest'){const id=(p.target as {id:number}).id;
      if(this.chests.some(c=>c.id===id)&&!threatened&&this.clock<this.autoChestUntil)return;
      this.autoChestSkip.set(id,this.clock+30);p.target=null;p.path=[];}
    const bosses=this.monsters.filter(m=>m.def.mvp&&m.state!=='dead');
    const chest=threatened?undefined:this.chests.find(c=>dist(c,p)<8&&(this.autoChestSkip.get(c.id)??0)<this.clock&&!bosses.some(b=>dist(b,c)<12));
    if(chest){p.target={kind:'chest',id:chest.id};this.autoChestUntil=this.clock+8;this.pathTo(chest.x,chest.y);return;}
    // Auto battle never picks fights it cannot win: no MVPs and nothing far above your level, unless it is already chasing you.
    const mvps=this.monsters.filter(m=>m.def.mvp&&m.state==='idle');
    const fair=(m:Monster)=>arena||(m.state==='chase'&&(!m.def.mvp||m.id===this.manualBossId||m.def.id.startsWith('oath_')))||(!m.def.mvp&&m.def.level<=this.baseLv+6&&!mvps.some(b=>dist(b,m)<9));
    const cands=this.monsters.filter(m=>m.state!=='dead'&&fair(m)&&dist(m,p)<35&&this.map.reachable[Math.floor(m.y)*this.map.w+Math.floor(m.x)]).sort((a,b)=>dist(a,p)-dist(b,p));
    let near:Monster|undefined=cands[0];
    // v4.9 hunt target: farm one kind of monster. Fight back if something is on you; otherwise only the target,
    // and when none are around, head for its habitat instead of wandering into other monsters.
    if(this.huntTarget){
      const threat=cands.find(m=>m.state==='chase'&&dist(m,p)<6),prey=cands.find(m=>m.def.id===this.huntTarget);
      near=threat??prey;
      if(!near){const hab=habitatOf(this.map.def.id,this.huntTarget);
        if(hab&&dist(p,hab)>hab.r*.5&&!p.path.length){const c=this.map.grid.nearestWalkable(hab.x,hab.y,6);if(c)this.pathTo(c.x+.5,c.y+.5);}
        near=cands.find(m=>dist(m,p)<5);}
    }
    if(near)p.target={kind:'monster',id:near.id};
  }
  /** Auto-battle value of a mage loop step on this target (0 = neutral). Reads live states, never elements. */
  private loopScore(id:string,m:Monster,live:Monster[]):number{
    const e=m.el,now=this.clock,lv=(k:string)=>this.stats.skillLevels[k]??0;
    const burn=e?.burn&&e.burn.until>now?e.burn.stacks:0,mark=!!e?.mark&&e.mark.until>now,shocked=(e?.shockUntil??0)>now;
    switch(id){
      case 'fireBall':{const near=live.filter(n=>n!==m&&(n.el?.burn?.stacks??0)>0&&dist(n,m)<=2.2).length;return burn>=3?1.4+near*.3:near>=2?.5:0;}
      case 'fireBolt':return lv('fireBall')>0&&burn>=3?-.4:0;
      case 'frostDiver':return mark?1.6:0;
      case 'coldBolt':return mark&&lv('frostDiver')>0?-.5:0;
      case 'thunderStorm':{const sh=live.filter(n=>(n.el?.shockUntil??0)>now&&Math.abs(n.x-m.x)<=2.5&&Math.abs(n.y-m.y)<=2.5).length;return sh>=2?.8:shocked&&m.def.mvp?.3:0;}
      case 'lightningBolt':return shocked?0:.1;
      // v6.0 二轉: spend 戰意 when it is high, open with fields on bosses, cash the 奧義 whenever ready.
      case 'bash':return this.stats.job2==='knight'&&this.player.resolve>=4?-.5:0;
      case 'k_rend':return this.player.resolve>=3?.8+this.player.resolve*.15:-.3;
      case 'k_judgment':return this.player.resolve>=3?1.2:m.def.mvp?.5:0;
      case 'k_charge':return dist(m,this.player)>3?.6:0;
      // Fields are worth it even on one target (damage over time, marks, shock), more so on bosses.
      case 'w_flame':case 'w_frost':case 'w_totem':return m.def.mvp?.9:.5;
      case 'w_arcana':return 1;
      case 'r_snipe':return this.prey?.id===m.id?.5:0;
      case 'r_trap':return m.def.mvp?.5:0;
      case 'r_starRain':return m.def.mvp?.3:0;
    }
    return 0;
  }
  /** Score only usable skills, then try each candidate. Rotation pressure prevents hotbar-order starvation. */
  private autoCast(target:Monster){
    const p=this.player;if(this.clock<p.afterCastUntil)return;
    // Small SP pools (swordmen/archers) keep a smaller absolute reserve so their skills still come out.
    const share=this.stats.maxSp*(this.autoStrategy==='conserve'?.45:.25),reserve=this.stats.maxSp<400?Math.min(share,this.autoStrategy==='conserve'?90:40):share;
    const live=this.monsters.filter(m=>m.state!=='dead');
    const candidates:{id:string;target:Monster;score:number}[]=[];
    for(const id of [...new Set(this.autoSkills)]){
      const sk=skills[id],lv=this.stats.skillLevels[id]??0;
      if(!sk||lv<1||sk.target==='passive'||(p.cooldowns[id]??0)>this.clock||p.sp-this.spCost(id,lv)<reserve||(sk.mounted&&!this.riding))continue;
      // 烈焰附刃 first: when the blade is about to go out, keep enough SP to re-light it (磐石之魂: keep it for 震地爆破 once 守勢 is up).
      const ml=this.stats.skillLevels.magnum??0;
      if(ml&&id!=='magnum'&&(((this.soul()==='art'||this.soul()==='flame')&&(!p.enchant||p.enchant.until<this.clock+2))||(this.soul()==='chain'&&!p.chainEmp&&id==='bash'&&live.filter(m=>dist(m,p)<=1.8).length>=2))&&p.sp-this.spCost(id,lv)<reserve+this.spCost('magnum',ml))continue;
      let chosen=target,score=0;
      // 急救 heals a flat 15: only worth it (and worth its SP) while the HP pool is still small.
      if(id==='firstAid'){if(p.hp>this.stats.maxHp*.5||this.stats.maxHp>500)continue;score=150;}
      else if(id==='endure'){if(p.endure&&p.endure.until>this.clock+.5)continue;if(!live.some(m=>m.state==='chase'&&dist(m,p)<5))continue;score=110;}
      else if(id==='concentrate'){if(p.concentrate&&p.concentrate.until>this.clock+.5)continue;score=110;}
      else if(id==='magnum'){
        const hits=live.filter(m=>dist(m,p)<=2.2);
        const soul=this.soul();
        if(soul==='flame'){if(p.enchant&&p.enchant.until>this.clock+3)continue;if(!live.some(m=>m.state==='chase'||dist(m,p)<6))continue;candidates.push({id,target,score:130});continue;}
        if(soul==='chain'&&p.chainEmp)continue;
        if(!hits.length)continue;
        // Keep 烈焰附刃 burning: re-light it when it is out or about to run out.
        score=35+hits.length*20+(this.soul()!=='chain'&&this.soul()!=='rock'&&(!p.enchant||p.enchant.until<this.clock+1.5)?60:0)+(this.soul()==='rock'?40:0);
      }else if(id==='k_wheel'||id==='k_quake'){
        const hits=live.filter(m=>dist(m,p)<=(id==='k_wheel'?K.wheel.r:K.quake.r));if(!hits.length)continue;
        if(id==='k_quake'&&hits.length<2&&!hits.some(m=>m.def.mvp))continue;
        score=(id==='k_quake'?40:36)+hits.length*20;
      }else if(id==='k_ward'||id==='w_veil'){
        if(p.shields.some(s=>s.amount>0&&s.until>this.clock+1))continue;
        if(!live.some(m=>m.state==='chase'&&dist(m,p)<5))continue;
        // 護壁 is for danger (low HP or a boss on you); otherwise 戰意 goes into 裂星重斬 / 星落裁決.
        if(id==='k_ward'&&p.hp>this.stats.maxHp*(this.soul()==='rock'?.85:.6)&&!(this.soul()==='rock'&&live.filter(m=>m.state==='chase'&&dist(m,p)<3).length>=3))continue;
        if(id==='w_veil'&&p.hp>this.stats.maxHp*.75)continue;
        score=105;
      }else if(id==='w_ascend'){
        if(!(target.def.mvp||live.filter(m=>dist(m,target)<4).length>=3))continue;score=95;
      }else if(id==='r_mark'){
        if(this.prey&&this.prey.id===target.id&&this.prey.until>this.clock+2)continue;
        if(dist(target,p)>sk.range)continue;
        // Only worth a mark on something that takes a while: bosses and tough targets.
        if(!(target.def.mvp||target.hp>(this.stats.atk+this.stats.weaponAtk)*30))continue;
        score=120;
      }else{
        if(id==='k_charge'&&dist(target,p)<3)continue;
        const range=sk.range+(sk.tags.includes('ranged')?(this.stats.skillLevels.vulture??0)*.5:0)+this.mountReach(sk);
        if(id==='frostDiver'&&live.some(m=>m.el?.mark&&m.el.mark.until>this.clock&&dist(m,p)<=range)){
          // v4.4 碎冰: any target with a 寒冰印記 (MVPs included) — prefer the current target.
          const marked=live.filter(m=>m.el?.mark&&m.el.mark.until>this.clock&&dist(m,p)<=range);
          chosen=marked.find(m=>m.id===target.id)??marked[0];score=0;
        }else if(id==='thunderStorm'&&(this.stats.skillLevels.lightningBolt??0)>0&&!live.some(m=>(m.el?.shockUntil??0)>this.clock&&dist(m,p)<=range+2.5)){
          continue;// lightning loop: shock targets with bolts first, then cash in with the storm
        }else if(id==='frostDiver'||id==='provoke'||id==='chargeArrow'){
          const valid=live.filter(m=>dist(m,p)<=range&&!m.def.mvp&&m.frozenUntil<=this.clock&&m.rootUntil<=this.clock&&m.stunUntil<=this.clock&&(id!=='provoke'||!m.provoke));
          chosen=valid.find(m=>m.id===target.id)??valid[0];if(!chosen)continue;
          if(id==='chargeArrow'&&dist(chosen,p)>3)continue;
          if(id==='provoke'&&!(chosen.def.mvp||chosen.maxHp>(this.stats.atk+this.stats.weaponAtk)*12))continue;
          score=id==='provoke'?22:45;
        }
        if(dist(chosen,p)>range+.05)continue;
        const advantage=1+this.loopScore(id,chosen,live);
        const r=id==='arrowShower'?1.6:2.5;
        const count=sk.tags.includes('area')?live.filter(m=>Math.abs(m.x-chosen.x)<=r&&Math.abs(m.y-chosen.y)<=r).length:1;
        // Area skills on a single target only when the element loop makes it worth it (detonation, shocked boss).
        if(sk.tags.includes('area')&&count<2&&this.autoStrategy!=='aoe'&&this.loopScore(id,chosen,live)<=0)continue;
        score+=30*advantage+(count-1)*(this.autoStrategy==='aoe'?40:22);
        if(this.autoStrategy==='conserve')score-=this.spCost(id,lv)*.5;
      }
      const last=this.autoUsed[id];if(last!==undefined)score-=Math.max(0,35-(this.clock-last)*4);
      candidates.push({id,target:chosen,score});
    }
    candidates.sort((a,b)=>b.score-a.score);
    for(const c of candidates){const sk=skills[c.id];if(this.useSkill(c.id,sk.target==='enemy'?c.target.id:null,sk.target==='ground'?{x:c.target.x,y:c.target.y}:null,false)){this.autoUsed[c.id]=this.clock;return;}}
  }
  private playerAct(){
    const p=this.player;
    if(p.queued&&!p.cast&&!p.pending&&this.clock>=p.afterCastUntil&&(p.cooldowns[p.queued.skill]??0)<=this.clock){
      const q=p.queued;p.queued=null;this.useSkill(q.skill,q.monsterId,q.ground,false);}
    if(p.cast){
      p.cast.remaining-=H;
      const m=p.cast.monsterId!==null?this.monsters.find(m=>m.id===p.cast!.monsterId&&m.state!=='dead'):null;
      if(p.cast.monsterId!==null&&!m){this.cancelCast();return;}
      if(m)p.facing=this.faceTo(p,m);
      if(p.cast.remaining<=0){const c=p.cast;p.cast=null;this.events.push({t:'castEnd',skill:c.skill,ok:true});this.execute(c.skill,c.lv,c.monsterId,c.ground);}
      return;
    }
    if(p.pending){
      const sk=skills[p.pending.skill],pend=p.pending;
      let anchor:Vec|null=null;
      if(sk.target==='enemy'){const m=this.monsters.find(m=>m.id===pend.monsterId&&m.state!=='dead');if(!m){p.pending=null;return;}anchor=m;}
      else if(sk.target==='ground')anchor=pend.ground;
      const range=sk.target==='enemy'&&sk.tags.includes('melee')?Math.max(1.6,sk.range)+this.mountReach(sk):sk.range+(sk.tags.includes('ranged')?(this.stats.skillLevels.vulture??0)*.5:0);
      if(anchor&&dist(p,anchor)>range){this.chase(anchor,range);return;}
      p.path=[];p.pending=null;
      if(this.clock<p.afterCastUntil)return;
      if(p.sp<this.spCost(pend.skill,pend.lv)){this.events.push({t:'fail',reason:'SP 不足'});return;}
      if(anchor)p.facing=this.faceTo(p,anchor);
      this.dismount();
      const castTime=this.castTime(pend.skill,pend.lv);
      p.echoUsed=this.stats.castEcho&&p.echoUntil>this.clock&&skills[pend.skill].cast(pend.lv)>0;if(p.echoUsed){p.echoRefund=p.echoUntil;p.echoUntil=0;}
      if(castTime>.05){p.cast={skill:pend.skill,lv:pend.lv,monsterId:pend.monsterId,ground:pend.ground,remaining:castTime,total:castTime};this.events.push({t:'castStart',skill:pend.skill,lv:pend.lv,dur:castTime});}
      else this.execute(pend.skill,pend.lv,pend.monsterId,pend.ground);
      return;
    }
    const t=p.target;if(!t)return;
    if(t.kind==='monster'){
      const m=this.monsters.find(m=>m.id===t.id&&m.state!=='dead');if(!m){p.target=null;p.path=[];return;}
      if(this.inTown){p.target=null;return;}
      const range=this.stats.range+(this.mountedKnight()&&!this.stats.ranged?K.mount.range:0);
      if(dist(p,m)>range+.05){this.chase(m,range);return;}
      p.path=[];p.facing=this.faceTo(p,m);
      if(this.clock>=p.attackTimer&&this.clock>=p.afterCastUntil){p.attackTimer=this.clock+this.attackDelay();this.basicAttack(m);}
    }else if(t.kind==='item'){
      const it=this.items.find(i=>i.id===t.id);if(!it){p.target=null;return;}
      if(dist(p,it)<.9){this.collect(it);p.target=null;p.path=[];}
      else if(!p.path.length)this.pathTo(it.x,it.y);
    }else if(t.kind==='chest'){
      const c=this.chests.find(c=>c.id===t.id);if(!c){p.target=null;return;}
      if(dist(p,c)<1.4){p.path=[];p.target=null;p.facing=this.faceTo(p,c);this.takeChest(c);}
      else if(!p.path.length)this.pathTo(c.x,c.y);
    }else if(t.kind==='landmark'){
      const c=this.landmarkCell(t.key);if(!c){p.target=null;return;}
      if(dist(p,c)<2.6){p.path=[];p.target=null;p.facing=this.faceTo(p,c);this.landmarkAction(t.key);}
      else if(!p.path.length)this.pathTo(c.x,c.y+1);
    }else if(t.kind==='npc'){
      const n=this.map.def.npcs.find(n=>n.id===t.id);if(!n){p.target=null;return;}
      if(dist(p,{x:n.x+.5,y:n.y+.5})<2.3){p.path=[];p.target=null;p.facing=this.faceTo(p,{x:n.x+.5,y:n.y+.5});this.events.push({t:'npc',id:n.id});}
      else if(!p.path.length)this.pathTo(n.x+.5,n.y+1.5);
    }
  }
  /** Walk toward a moving anchor, re-pathing only when the anchor drifts or the path runs out. */
  private chase(anchor:Vec,range:number){
    const p=this.player;
    const goal=(p as Player&{chaseGoal?:Vec}).chaseGoal;
    if(!p.path.length||!goal||dist(goal,anchor)>.8){
      const cells=this.map.grid.findPath(p.x,p.y,anchor.x,anchor.y);
      p.path=cells?this.map.grid.smoothPath(p.x,p.y,cells):[];
      (p as Player&{chaseGoal?:Vec}).chaseGoal={x:anchor.x,y:anchor.y};
      // Stop just inside range rather than on top of the target.
      while(p.path.length>1&&dist(p.path[p.path.length-2],anchor)<range*.9)p.path.pop();
    }
  }
  /** v6.2: walking over your own drops picks them up (clicking tiny items was fiddly). */
  private walkOverPickup(){const p=this.player;if(p.dead)return;for(const it of this.items)if(it.mine&&dist(it,p)<.95){this.collect(it);return;}}
  private collect(it:GroundItem){this.items=this.items.filter(i=>i.id!==it.id);this.events.push({t:'pickup',item:it});}
  private playerMove(){
    const p=this.player;if(p.sitting||p.cast||!p.path.length)return;
    let budget=this.stats.moveSpeed*(this.riding?this.mountSpeed:1)*(this.boon('haste')?1.25:1)*H;
    while(budget>0&&p.path.length){
      const wp=p.path[0],d=dist(p,wp);
      if(d<=budget){p.x=wp.x;p.y=wp.y;p.path.shift();budget-=d;}
      else{p.x+=(wp.x-p.x)/d*budget;p.y+=(wp.y-p.y)/d*budget;budget=0;p.facing=this.faceTo(p,wp);}
    }
  }
  private regen(){
    const p=this.player,mult=p.sitting?2:1;
    if((p.hpTimer-=H*mult)<=0){p.hpTimer=6;if(p.hp<this.stats.maxHp)p.hp=Math.min(this.stats.maxHp,p.hp+Math.round(this.stats.hpRegen));}
    if((p.spTimer-=H*mult)<=0){p.spTimer=8;if(p.sp<this.stats.maxSp)p.sp=Math.min(this.stats.maxSp,p.sp+Math.round(this.stats.spRegen));}
    if(this.inTown){p.hp=Math.min(this.stats.maxHp,p.hp+this.stats.maxHp*.02*H*6);p.sp=Math.min(this.stats.maxSp,p.sp+this.stats.maxSp*.02*H*6);}
  }
  private checkWarps(){
    const p=this.player;
    for(const w of this.map.def.warps)if(Math.hypot(p.x-(w.x+.5),p.y-(w.y+.5))<.9){p.path=[];p.target=null;p.auto=false;this.warpPending=true;this.events.push({t:'warp',to:w.to,tx:w.tx,ty:w.ty});return;}
  }
  faceTo(a:Vec,b:Vec){const ang=Math.atan2(b.y-a.y,b.x-a.x);return (Math.round(ang/(Math.PI/4))+8)%8;}

  // ———————————————————————— damage ————————————————————————
  private physical(m:Monster,mult:number,element:Element,hitBonus=0,critBonus=0,extra={critMult:1.4,pierce:0}):{amount:number;crit:boolean;miss:boolean}{
    const d=this.stats,crit=this.rng()*100<d.crit+critBonus;
    if(!crit){const chance=clamp(80+this.hitStat()-m.def.flee+hitBonus,5,100);if(this.rng()*100>=chance)return {amount:0,crit:false,miss:true};}
    const def=m.def.def*(m.provoke?1-m.provoke.def:1)*(1-extra.pierce);
    const raw=(d.atk+d.weaponAtk*(.8+this.rng()*.25))*mult*elementMultiplier(element,m.def.element)*(this.mountedKnight()?1+K.mount.atk:1);
    const amount=Math.max(1,Math.round(crit?raw*extra.critMult:raw*(100-def)/100));
    return {amount,crit,miss:false};
  }
  private magical(m:Monster,mult:number,element:Element,critBonus=0,extra={critMult:1.4,pierce:0}){
    const d=this.stats,matk=d.matkMin+this.rng()*(d.matkMax-d.matkMin),crit=critBonus>0&&this.rng()*100<critBonus;
    return {amount:Math.max(1,Math.round(matk*mult*elementMultiplier(element,m.def.element)*(100-m.def.mdef*(1-extra.pierce))/100*(crit?extra.critMult:1))),crit,miss:false};
  }
  private basicAttack(m:Monster){
    this.dismount();const p=this.player;p.attackAt=this.clock;this.events.push({t:'swing',who:'p',tx:m.x,ty:m.y});
    const element:Element='neutral';
    if(this.stats.ranged){
      const travel=dist(p,m)/14;this.events.push({t:'fx',kind:'arrow',x:p.x,y:p.y,tx:m.x,ty:m.y,dur:travel});
      this.later(travel,()=>{if(m.state==='dead')return;const pm=this.preyMult(m);if(this.resolveHit(m,this.physical(m,pm,element),{skill:'attack',mult:pm,element,magic:false})>0)this.falcon(m);});
    }else if(this.stats.weaponType==='staff'){
      // Staff basics always use MATK, including point-blank attacks.
      const travel=dist(p,m)/12;this.events.push({t:'fx',kind:'orb',x:p.x,y:p.y,tx:m.x,ty:m.y,dur:travel});
      this.later(travel,()=>{if(m.state==='dead')return;this.resolveHit(m,this.magical(m,1,element),{skill:'attack',mult:1,element,magic:true});});
    }else{const sm=this.soul()==='rock'?SW.rockBasic:1;if(this.resolveHit(m,this.physical(m,sm,element),{skill:'attack',mult:sm,element,magic:false})>0){
      // v6.2 劍士: every landed melee swing restores 1 SP, so the sword — not the SP bar — sets the pace.
      if(this.stats.job==='swordman')p.sp=Math.min(this.stats.maxSp,p.sp+1);
      // v6.5 連斬之魂 回氣: the swing right after a 連斬 restores extra SP.
      // v6.5 連斬之魂 斬勢: no blade fire, but every landed swing restores a little more SP (the combo is the engine).
      if(this.soul()==='chain')p.sp=Math.min(this.stats.maxSp,p.sp+SW.chainBasic);
      if(p.chainSp){p.chainSp=false;p.sp=Math.min(this.stats.maxSp,p.sp+SW.chainBasicSp);}
      // v6.5 烈焰之魂 焰影追斬: the next two swings carry a strong flame.
      if(p.flameNext>0&&m.state!=='dead'){p.flameNext--;const mult=SW.chaseFire*(this.stats.derivedMult??1);this.resolveHit(m,this.physical(m,mult,'fire',30),{skill:'enchant',mult,element:'fire',magic:false,derived:true});}
      this.enchantHit(m,false);
      // 熾焰長劍: while the blade burns, sometimes it cuts twice.
      if(this.blazing()&&p.enchant&&p.enchant.until>this.clock&&this.rng()<.15)this.later(.12,()=>{if(m.state==='dead')return;this.events.push({t:'swing',who:'p',tx:m.x,ty:m.y});
        if(this.resolveHit(m,this.physical(m,.7,'neutral'),{skill:'attack',mult:.7,element:'neutral',magic:false})>0)this.enchantHit(m,false);});
      // 磐石之魂: even when nothing hits you, every 4th swing builds 1 守勢 (slower than being hit).
      if(this.soul()==='rock'&&++p.guardBasic>=4){p.guardBasic=0;this.addGuard(1);}
      // 戰意: every 3rd landed melee basic attack.
      if(this.stats.job2==='knight'&&++p.basicHits>=RESOLVE.basicHits){p.basicHits=0;this.gainResolve(1);}}}
  }
  private resolveHit(m:Monster,r:{amount:number;crit:boolean;miss:boolean},o:HitOpts){
    const p=this.player;p.lastCombat=this.clock;
    if(m.state==='dead')return 0;
    // v7.0 傳說威能／唯一／挑戰祝福: one multiplier on everything the player deals.
    if(!r.miss){const amp=this.ampFor(m,r.crit);if(amp!==1)r={...r,amount:Math.max(1,Math.round(r.amount*amp))};}
    this.events.push({t:'dmg',to:'m',id:m.id,x:m.x,y:m.y,amount:r.amount,crit:r.crit,miss:r.miss,element:o.element,src:o.skill});
    if(m.state!=='chase'){m.state='chase';m.path=[];}
    if(r.miss)return 0;
    if(!o.derived)this.starfallHit(m,r.amount,r.crit);
    if(m.shield&&m.shield>0){const a=Math.min(m.shield,r.amount);m.shield-=a;r={...r,amount:r.amount-a};if(r.amount<=0)return 0;}
    m.hp-=r.amount;m.hitAt=this.clock;
    if(o.knock&&m.def.mvp!==true){const from=o.from??p,d=dist(from,m)||1;m.knock={vx:(m.x-from.x)/d*o.knock/.2,vy:(m.y-from.y)/d*o.knock/.2,t:.2};}
    if(m.hp<=0)this.kill(m,o,r.amount);
    return r.amount;
  }
  private kill(m:Monster,o:HitOpts,lastHit:number){
    // Scripted bosses (summoned, e.g. the 誓約試煉 guardian) have no map spawn, so they never get a saved respawn timer.
    if(m.def.mvp&&!m.summoned)this.mvpDeadlines[`${this.map.def.id}:${m.def.id}`]=this.clock+m.def.respawn;
    if(m.id===this.manualBossId)this.manualBossId=-1;
    // Restore the plain monster only after this kill's EXP/drops (read below) used the golden stats.
    if(m.golden){const tier=MAP_TIER[this.map.def.id]??10,zeny=Math.round(tier*tier*12),base=monsters[m.def.id]?this.tierDef(m.def.id):undefined;m.golden=false;if(base)this.later(.01,()=>{m.def=base;m.maxHp=base.hp;});
      this.chests.push({id:this.chestSerial++,x:m.x,y:m.y,tier:'rare',bonus:true});this.events.push({t:'fx',kind:'summon',x:m.x,y:m.y,dur:.8,r:2.5});
      this.events.push({t:'worldEvent',phase:'success',kind:'golden',text:'黃金魔物被打倒了！金幣噴了一地，還留下稀有寶箱！',zeny});this.endWorldEvent();}
    if(m.mimic){const spot=this.map.grid.nearestWalkable(Math.floor(m.x),Math.floor(m.y),3)??{x:Math.floor(m.x),y:Math.floor(m.y)};this.chests.push({id:this.chestSerial++,x:spot.x+.5,y:spot.y+.5,tier:'rare',bonus:true});}
    if(m.trial){const key=m.trial,T=TRIALS[key],at=this.landmarkCell(key)??{x:m.x,y:m.y};this.exploreDeadlines[`trial:${key}`]=this.clock+(T?.cooldown??600);this.trial=null;
      const spot=this.map.grid.nearestWalkable(Math.floor(at.x),Math.floor(at.y+1.5),3)??{x:Math.floor(m.x),y:Math.floor(m.y)};
      this.chests.push({id:this.chestSerial++,x:spot.x+.5,y:spot.y+.5,tier:'trial',elite:T?.elite});
      this.events.push({t:'trialDone',key,name:T?.title??'試煉'});}
    // v6.3 星光天賦「星爆」: a fallen (non-MVP) monster bursts into starlight; chain kills keep bursting.
    if(this.talent('starburst')&&!m.def.mvp){const at={x:m.x,y:m.y},amount=Math.max(1,Math.round(m.maxHp*.15));
      this.later(.12,()=>{this.events.push({t:'fx',kind:'pulse',x:at.x,y:at.y,dur:.4,r:2});
        for(const n of this.monsters)if(n!==m&&n.state!=='dead'&&!n.def.mvp&&dist(n,at)<=2)this.resolveHit(n,{amount,crit:false,miss:false},{skill:'starburst',mult:.15,element:'neutral',magic:true,derived:true});});}
    // v6.0 燼環權杖: a burning monster that falls passes 2 burn stacks to up to 3 neighbours.
    const burn=m.el?.burn;if(burn&&burn.until>this.clock&&burn.stacks>0&&this.fx('ember')){const at={x:m.x,y:m.y};
      for(const n of this.monsters.filter(n=>n!==m&&n.state!=='dead'&&dist(n,at)<=2.5).sort((a,b)=>dist(a,at)-dist(b,at)).slice(0,3)){
        this.events.push({t:'fx',kind:'chain',x:at.x,y:at.y,tx:n.x,ty:n.y,dur:.25,element:'fire'});this.addBurn(n,2,burn.matk);}}
    this.starfallKill(m);
    m.state='dead';m.hp=0;m.deadAt=this.clock;m.respawnTimer=m.def.respawn;m.dots=[];m.path=[];
    if(m.elite?.includes('split')&&m.baseDef){const base=m.baseDef;
      for(let i=0;i<2;i++){const c=this.spawn(base.id,m.area);c.def={...base,name:`分裂的${base.name}`,hp:Math.round(base.hp*.6),exp:Math.round(base.exp*.5),jexp:Math.round(base.jexp*.5),art:{...base.art,scale:base.art.scale*.75},aggressive:true};
        c.hp=c.maxHp=c.def.hp;c.summoned=true;this.placeNear(c,m.x,m.y,.5,1.5);c.state='chase';}
      this.events.push({t:'fx',kind:'summon',x:m.x,y:m.y,dur:.6,r:1.5});}
    if(m.elite?.includes('burst')){const at={x:m.x,y:m.y},dmg=m.def.atk[1]*1.4;this.events.push({t:'fx',kind:'warn',x:at.x,y:at.y,dur:1,shape:'circle',r:2.2,element:'fire',attackType:'physical'});
      this.later(1,()=>{this.events.push({t:'fx',kind:'explode',x:at.x,y:at.y,dur:.45,r:2.2,element:'fire'});if(!this.player.dead&&dist(this.player,at)<=2.2)this.damagePlayer(dmg,m.def.id,'fire',m);});}
    this.events.push({t:'kill',id:m.id,monster:m.def.id,x:m.x,y:m.y,exp:m.def.exp,jexp:m.def.jexp,mvp:!!m.def.mvp});
    const refund=!o.derived&&skills[o.skill]?this.moduleOf(o.skill,'manaRefund'):null;
    if(refund){const lv=this.stats.skillLevels[o.skill]??1,back=Math.round(this.spCost(o.skill,lv)*.3*refund.coef);this.player.sp=Math.min(this.stats.maxSp,this.player.sp+back);this.events.push({t:'heal',x:this.player.x,y:this.player.y,amount:back,sp:true});}
    const p=this.player;if(p.target?.kind==='monster'&&p.target.id===m.id)p.target=null;
    // Drops scatter around the corpse; the card roll uses its own rate (GDD §7).
    const drops:{kind:'item'|'card';defId:string;count?:number}[]=[];
    for(const d of m.def.drops)if(this.rng()<Math.min(1,d.rate*this.dropMultiplier))drops.push({kind:'item',defId:d.item});
    if(this.rng()<Math.min(1,m.def.cardRate*this.cardMultiplier))drops.push({kind:'card',defId:m.def.card});
    this.starfallDrops(m,drops);
    drops.forEach((d,i)=>{
      const a=i*2.4+this.rng(),r=i?.6+this.rng()*.5:.2;
      let x=m.x+Math.cos(a)*r,y=m.y+Math.sin(a)*r;if(!this.map.grid.free(x,y)){x=m.x;y=m.y;}
      // MVPs, elites and golden monsters roll much better gear (separate RNG: combat stays reproducible).
      const qBonus=m.def.mvp?5:m.golden?4:m.elite?.length||m.def.name.startsWith('【')?3:1;
      const q=d.kind==='item'&&itemDefs[d.defId]?.kind==='equip'?((itemDefs[d.defId] as EquipDef).unique?4 as Quality:rollQuality(this.crng(),qBonus*this.tier.quality)):undefined;
      const item:GroundItem={id:this.serial++,kind:d.kind,defId:d.defId,count:d.count??1,x,y,expires:this.clock+(d.kind==='card'?300:q?240:90),mine:true,...(q?{q}:{})};
      this.items.push(item);this.events.push({t:'drop',item});
      if(this.autoLoot)this.later(.35,()=>{if(this.items.includes(item)&&!this.player.dead)this.collect(item);});
    });
    // Module: shatter — the killing blow of a carrying skill bursts on nearby enemies.
    const shatter=!o.derived&&this.moduleOf(o.skill,'shatter');
    if(shatter){
      this.events.push({t:'fx',kind:'shatter',x:m.x,y:m.y,dur:.4,r:2});
      for(const n of this.monsters)if(n!==m&&n.state!=='dead'&&dist(n,m)<=2)this.resolveHit(n,{amount:Math.max(1,Math.round(lastHit*.5*shatter.coef)),crit:false,miss:false},{...o,derived:true});
    }
  }
  private hurtPlayer(m:Monster){
    const p=this.player;if(p.dead||this.inTown)return;
    p.lastCombat=this.clock;m.attackAt=this.clock;
    this.events.push({t:'swing',who:'m',id:m.id,tx:p.x,ty:p.y});
    const magic=m.def.attackType==='magic',element=m.def.attackElement;
    if(magic)this.events.push({t:'fx',kind:'orb',x:m.x,y:m.y,tx:p.x,ty:p.y,dur:.25,element,attackType:'magic'});
    const hitChance=clamp(80+m.def.hit-this.fleeStat(),5,95);
    if(!magic&&(this.rng()*100>=hitChance||this.rng()*100<this.stats.perfectDodge)){this.events.push({t:'dmg',to:'p',x:p.x,y:p.y,amount:0,miss:true,element,src:m.def.id});return;}
    const [lo,hi]=m.def.atk,atk=(lo+this.rng()*(hi-lo))*(m.provoke?1+m.provoke.atk:1);
    this.damagePlayer(atk,m.def.id,element,m,magic);
  }
  private damagePlayer(atk:number,src:string,element:Element,_from:Monster,magic=false):number{
    const p=this.player;if(p.dead||this.inTown)return 0;p.lastCombat=this.clock;
    // v7.0 幻步: sometimes the blow simply misses; 深淵之眼 makes every blow hurt more.
    if(this.fx('phantom')&&this.rng()<ASPECT.phantom.dodge){this.events.push({t:'dmg',to:'p',x:p.x,y:p.y,amount:0,miss:true,element,src});return 0;}
    if(this.fx('u_abyssEye'))atk*=1+UNIQUE.u_abyssEye.taken;
    const def=Math.min(90,Math.max(0,magic?this.stats.mdef:this.stats.def+(p.endure?.def??0)));
    let dmg=Math.max(1,Math.round(atk*(100-def)/100-(magic?0:this.stats.vitDef))),absorbed=0;
    for(const s of p.shields){const a=Math.min(s.amount,dmg);s.amount-=a;dmg-=a;absorbed+=a;if(!dmg)break;}
    p.hp-=dmg;p.sitting=false;
    this.events.push({t:'dmg',to:'p',x:p.x,y:p.y,amount:dmg,element,src,absorbed});
    if(this.talent('aegis')&&p.hp>0&&p.hp<this.stats.maxHp*.3&&this.clock-this.aegisAt>=60){this.aegisAt=this.clock;p.shields.push({amount:Math.round(this.stats.maxHp*.25*this.shieldMult()),until:this.clock+8});
      this.events.push({t:'fx',kind:'ward',x:p.x,y:p.y,dur:2,r:1.3},{t:'explore',text:'✦ 星之護佑！'});}
    if(_from?.elite?.includes('vamp')&&_from.state!=='dead')_from.hp=Math.min(_from.maxHp,_from.hp+Math.round(dmg*.5));
    this.starfallHurt(dmg,_from);
    // v6.5 磐石之魂: under 磐石架勢 every direct hit (melee or ranged) is stored and answered by the 0.5 s counter (see tickSecondJob).
    if(_from&&_from.state!=='dead'){
      if(this.soul()==='rock'&&p.endure&&p.endure.until>this.clock)p.guardHits++;
      // 不屈鎧甲 (any soul): after 鐵壁意志, the next 3 hits taken are answered on the attacker.
      else if(p.thornsCharges>0&&this.fx('thorns')){p.thornsCharges--;const m=_from,amount=this.counterAmount(m)*(this.fx('thornsPlus')?1.3:1);
        this.events.push({t:'fx',kind:'counter',x:p.x,y:p.y,tx:m.x,ty:m.y,dur:.15});
        const done=this.resolveHit(m,{amount,crit:false,miss:false},{skill:'thorns',mult:1,element:'neutral',magic:false,derived:true});this.thornsHeal(done);}}
    // v6.0 守誓護壁: while the ward holds, a struck knight answers with a light blade (once per second, derived).
    const w=p.ward;if(w&&w.until>this.clock&&w.shield.amount>0&&_from&&_from.state!=='dead'&&this.clock-w.counterAt>=1){
      w.counterAt=this.clock;const m=_from,mult=K.ward.counter(w.lv)*(this.stats.derivedMult??1);
      this.events.push({t:'fx',kind:'counter',x:p.x,y:p.y,tx:m.x,ty:m.y,dur:.2});
      // 磐星守誓劍: the blade also cuts up to 3 enemies around the attacker.
      const rock=this.soul()==='rock',victims=rock?this.inRadius(p,SW.rockR):this.fx('bulwark')?[m,...this.inRadius(m,1.8).filter(n=>n!==m).slice(0,3)]:[m];if(rock)this.addGuard(1);
      this.later(.12,()=>{for(const v of victims)if(v.state!=='dead')this.resolveHit(v,rock?{amount:Math.round(this.counterAmount(v)*mult),crit:false,miss:false}:this.physical(v,mult,'neutral',40),{skill:rock?'thorns':'k_ward',mult,element:'neutral',magic:false,derived:true});});}
    if(p.hp<=0)this.starfallLethal();
    if(p.hp<=0){p.hp=0;p.dead=true;p.cast=null;p.pending=null;p.path=[];p.target=null;p.auto=false;this.events.push({t:'death'});this.challengeDeath();
      for(const n of this.monsters)if(n.state==='chase'){n.state='idle';n.path=[];}}
    return dmg;
  }

  // ———————————————————————— companion (v4.3) ————————————————————————
  /** Mercenary AI: follow the player, assist their target, defend them, and use a role skill. */
  private allyAct(){
    const a=this.ally,p=this.player;if(!a)return;
    if(a.dead){if(this.clock>=a.reviveAt&&!p.dead){a.dead=false;a.hp=Math.round(a.maxHp*.5);a.x=a.px=p.x-.6;a.y=a.py=p.y+.6;a.path=[];this.events.push({t:'ally',kind:'up',x:a.x,y:a.y});}return;}
    const live=(id:number|null)=>id===null?undefined:this.monsters.find(m=>m.id===id&&m.state!=='dead');
    // Out of combat it slowly recovers.
    if(this.clock-Math.max(p.lastCombat,a.attackAt,a.hurtAt)>4&&a.hp<a.maxHp)a.hp=Math.min(a.maxHp,a.hp+a.maxHp*.03*H);
    const dp=dist(a,p);
    if(dp>14||this.inTown&&dp>8){const spot=this.map.grid.nearestWalkable(p.x-.6,p.y+.6);if(spot){a.x=a.px=spot.x+.5;a.y=a.py=spot.y+.5;a.path=[];}}
    // v4.9 low-HP retreat: under 35% the merc falls back behind you and monsters lose interest; it re-engages at 60%.
    if(!a.retreating&&a.hp<a.maxHp*.35&&this.clock-a.hurtAt<3){a.retreating=true;for(const m of this.monsters)if((m.aggroAlly??0)>this.clock)m.aggroAlly=0;this.events.push({t:'ally',kind:'retreat',x:a.x,y:a.y});}
    else if(a.retreating&&a.hp>=a.maxHp*.6)a.retreating=false;
    let target:Monster|undefined;
    const chasers=()=>this.monsters.filter(m=>m.state==='chase'&&dist(m,p)<7).sort((x,y)=>dist(x,p)-dist(y,p));
    if(!this.inTown&&!p.dead&&!a.retreating&&a.mode!=='support'){
      const pt=p.target?.kind==='monster'?live(p.target.id):undefined;
      // 守護: whatever is coming at you first; 協助: your target first.
      target=a.mode==='guard'?(chasers()[0]??pt??live(a.targetId)):(pt??live(a.targetId)??chasers().sort((x,y)=>dist(x,a)-dist(y,a))[0]);
      if(target&&dist(target,p)>12)target=undefined;
    }
    a.targetId=target?.id??null;
    // Role skills.
    if((a.skillTimer-=H)<=0&&!this.inTown&&!p.dead){
      if(a.role==='priest'&&p.hp<this.stats.maxHp*.65&&dp<7){
        const amt=Math.round(a.heal+this.stats.maxHp*.06);p.hp=Math.min(this.stats.maxHp,p.hp+amt);a.skillTimer=4.5;a.attackAt=this.clock;
        this.events.push({t:'heal',x:p.x,y:p.y,amount:amt},{t:'ally',kind:'heal',x:p.x,y:p.y});
      }else if(a.role==='priest'&&a.hp<a.maxHp*.5){
        const amt=Math.round(a.heal*1.2);a.hp=Math.min(a.maxHp,a.hp+amt);a.skillTimer=4.5;a.attackAt=this.clock;
        this.events.push({t:'heal',x:a.x,y:a.y,amount:amt},{t:'ally',kind:'heal',x:a.x,y:a.y});
      }else if(a.role==='priest'&&(target||(p.target?.kind==='monster'&&a.mode==='support'))&&this.clock>a.blessUntil){a.blessUntil=this.clock+20;a.skillTimer=6;this.events.push({t:'ally',kind:'bless',x:p.x,y:p.y});}
      else if(a.role==='guard'&&target){
        let n=0;for(const m of this.monsters)if(m.state!=='dead'&&!m.def.mvp&&dist(m,a)<4){m.aggroAlly=this.clock+6;if(m.state!=='chase'){m.state='chase';m.path=[];}n++;}
        if(n){a.skillTimer=8;this.events.push({t:'ally',kind:'taunt',x:a.x,y:a.y});}else a.skillTimer=1;
      }else if(a.role==='hunter'&&target&&dist(a,target)<=a.range){
        a.skillTimer=6;a.attackAt=this.clock;this.events.push({t:'ally',kind:'strafe',x:a.x,y:a.y},{t:'swing',who:'a',tx:target.x,ty:target.y});
        const t=target;for(const k of [0,.15]){this.events.push({t:'fx',kind:'arrow',x:a.x,y:a.y,tx:t.x,ty:t.y,dur:dist(a,t)/14+k});this.later(dist(a,t)/14+k,()=>this.allyHit(t,1));}
      }else a.skillTimer=.5;
    }
    // Movement: approach the target to range, otherwise trail the player.
    let goal:Vec|null=null,stop=0;
    if(target&&!(a.role==='priest'&&dp>5)){goal=target;stop=a.range;}
    else if(a.mode==='support'||a.retreating){
      // Stand ~2.5 tiles behind you, on the side away from the nearest threat.
      const th=chasers()[0];let bx=p.x-1.8,by=p.y+1.8;
      if(th){const dx=p.x-th.x,dy=p.y-th.y,l=Math.hypot(dx,dy)||1;bx=p.x+dx/l*2.5;by=p.y+dy/l*2.5;}
      const c=this.map.grid.nearestWalkable(Math.floor(bx),Math.floor(by),3);goal=c?{x:c.x+.5,y:c.y+.5}:p;stop=.6;
    }
    else{goal=p;stop=a.role==='priest'?2.4:1.6;}
    const dg=dist(a,goal);
    if(target&&goal===target&&dg<=a.range+.05){
      a.path=[];a.facing=this.faceTo(a,target);
      if(this.clock>=a.attackTimer){a.attackTimer=this.clock+a.aspd;a.attackAt=this.clock;this.events.push({t:'swing',who:'a',tx:target.x,ty:target.y});
        const t=target;
        if(a.role==='hunter'){const tr=dist(a,t)/14;this.events.push({t:'fx',kind:'arrow',x:a.x,y:a.y,tx:t.x,ty:t.y,dur:tr});this.later(tr,()=>this.allyHit(t,1));}
        else if(a.magic){const tr=dist(a,t)/12;this.events.push({t:'fx',kind:'orb',x:a.x,y:a.y,tx:t.x,ty:t.y,dur:tr,element:'holy' as Element});this.later(tr,()=>this.allyHit(t,1));}
        else this.allyHit(t,1);}
      return;
    }
    if(dg>stop){
      if((a.pathTimer-=H)<=0||!a.path.length){a.pathTimer=.4;if(this.pathBudget>0){this.pathBudget--;const cells=this.map.grid.findPath(a.x,a.y,goal.x,goal.y,1200);a.path=cells?this.map.grid.smoothPath(a.x,a.y,cells):[];}}
      let budget=a.speed*(this.riding&&!target?this.mountSpeed:1)*(dg>6?1.35:1)*H;
      while(budget>0&&a.path.length){const wp=a.path[0],d=dist(a,wp);if(dist(a,goal)<=stop){a.path=[];break;}
        if(d<=budget){a.x=wp.x;a.y=wp.y;a.path.shift();budget-=d;}else{a.x+=(wp.x-a.x)/d*budget;a.y+=(wp.y-a.y)/d*budget;budget=0;a.facing=this.faceTo(a,wp);}}
    }else a.path=[];
    // Don't stand inside the player.
    if(dist(a,p)<.6){const dx=a.x-p.x||.1,dy=a.y-p.y,d=Math.hypot(dx,dy)||1,nx=a.x+dx/d*.02,ny=a.y+dy/d*.02;if(this.map.grid.free(nx,ny)){a.x=nx;a.y=ny;}}
  }
  private allyHit(m:Monster,mult:number){
    const a=this.ally;if(!a||a.dead||m.state==='dead')return;
    const bless=this.clock<a.blessUntil?1.15:1;
    const def=a.magic?m.def.mdef:m.def.def;
    const amount=Math.max(1,Math.round(a.atk*(.9+this.arng()*.2)*mult*bless*(100-def)/100));
    this.events.push({t:'dmg',to:'m',id:m.id,x:m.x,y:m.y,amount,element:'neutral',src:'ally'});
    if(m.state!=='chase'){m.state='chase';m.path=[];}
    if((m.aggroAlly??0)<this.clock&&this.clock-this.player.lastCombat>2)m.aggroAlly=this.clock+4;
    m.hp-=amount;m.hitAt=this.clock;
    if(m.hp<=0)this.kill(m,{skill:'ally',mult,element:'neutral',magic:a.magic,derived:true},amount);
  }
  private hurtAlly(m:Monster){
    const a=this.ally;if(!a||a.dead)return;m.attackAt=this.clock;a.hurtAt=this.clock;
    this.events.push({t:'swing',who:'m',id:m.id,tx:a.x,ty:a.y});
    const magic=m.def.attackType==='magic',element=m.def.attackElement;
    if(magic)this.events.push({t:'fx',kind:'orb',x:m.x,y:m.y,tx:a.x,ty:a.y,dur:.25,element,attackType:'magic'});
    if(!magic&&this.arng()<.12){this.events.push({t:'dmg',to:'a',x:a.x,y:a.y,amount:0,miss:true,element,src:m.def.id});return;}
    const [lo,hi]=m.def.atk,dmg=Math.max(1,Math.round((lo+this.arng()*(hi-lo))*(100-Math.min(80,a.def))/100));
    a.hp-=dmg;this.events.push({t:'dmg',to:'a',x:a.x,y:a.y,amount:dmg,element,src:m.def.id});
    if(a.hp<=0){a.hp=0;a.dead=true;a.reviveAt=this.clock+20;a.path=[];this.events.push({t:'ally',kind:'down',x:a.x,y:a.y});
      for(const n of this.monsters)if(n.aggroAlly&&n.aggroAlly>this.clock)n.aggroAlly=0;}
  }
  private later(sec:number,run:()=>void){this.delayed.push({at:this.clock+sec,run});}
  private moduleOf(skill:string,moduleId:string){return this.stats.skillModules[skill]?.find(x=>x.moduleId===moduleId)??null;}
  /** SP cost after the 魔力節約 module. */
  spCost(skill:string,lv:number){const sk=skills[skill],m=this.moduleOf(skill,'spSaver');
    // v6.0 星紋研習「術式回流」: after 3 first-job spells the next second-job skill is cheaper (same 50% floor).
    const artSp=this.stats.soul==='art'&&sk.job==='swordman'?SW.artSp:1;
    const st=this.stats.skillLevels?.w_study??0,flow=st&&sk.job==='wizard'&&this.player.spellFlow>=3?1-W.study.cut(st):1;
    return Math.max(1,Math.round(sk.sp(lv)*Math.max(.5,(1-(m?.2*m.coef:0))*this.masteryOf(skill).sp*(this.stats.spCostMult??1)*flow*artSp)*this.starfallSpMult()));}
  /** Mastery bonuses for a skill (tier from the save, see data/mastery.ts). */
  masteryOf(skill:string){return MASTERY_BONUS[this.stats.mastery?.[skill]??0]??MASTERY_BONUS[0];}
  private awakened(skill:string){return (this.stats.mastery?.[skill]??0)>=3;}
  /** Cast time after DEX/gear (castMult) and the 時晶詠唱 module. */
  castTime(skill:string,lv:number){const m=this.moduleOf(skill,'quickCast');return skills[skill].cast(lv)*this.stats.castMult*(1-(m?.2*m.coef:0))*this.masteryOf(skill).cast*(this.stats.castEcho&&this.player.echoUntil>this.clock?.7:1);}

  // ———————————————————————— skills ————————————————————————
  private execute(skill:string,lv:number,monsterId:number|null,ground:Vec|null){
    const p=this.player,sk=skills[skill],d=this.stats;
    const cost=this.spCost(skill,lv);if(p.sp<cost){this.events.push({t:'fail',reason:'SP 不足'});return;}
    const dc=this.moduleOf(skill,'delayCut');
    p.sp-=cost;p.afterCastUntil=this.clock+sk.delay*Math.max(.5,d.castMult+.2)*d.delayMult*(1-(dc?.25*dc.coef:0))*(this.boon('haste')?.8:1);
    if(sk.cooldown)p.cooldowns[skill]=this.clock+sk.cooldown;
    // v6.3 星光天賦「流星迴響」: sometimes a cast is free and leaves no cooldown.
    if(this.talent('echo')&&this.crng()<.12){p.sp=Math.min(d.maxSp,p.sp+cost);delete p.cooldowns[skill];this.events.push({t:'fx',kind:'echo',x:p.x,y:p.y,dur:.4,r:1.2});}
    p.attackTimer=Math.max(p.attackTimer,this.clock+.25);p.attackAt=this.clock;
    const target=monsterId!==null?this.monsters.find(m=>m.id===monsterId&&m.state!=='dead')??null:null;
    this.events.push({t:'skill',skill,lv,from:{x:p.x,y:p.y},to:target?{x:target.x,y:target.y}:ground??{x:p.x,y:p.y}});
    if(target||ground)p.lastCombat=this.clock;
    this.starfallCast(skill,lv,cost,monsterId,ground,target);
    // On-cast modules.
    const feather=this.moduleOf(skill,'feather');
    if(feather){p.shields.push({amount:Math.round((12*feather.coef+this.baseLv*1.5)*this.shieldMult()),until:this.clock+6});this.events.push({t:'fx',kind:'shield',x:p.x,y:p.y,dur:.6});}
    const regrowth=this.moduleOf(skill,'regrowth');
    if(regrowth)p.regrowth={until:this.clock+4,tick:1,pct:.02*regrowth.coef};
    const keen=this.moduleOf(skill,'keen'),critBonus=keen?15*keen.coef:0;
    const fatal=this.moduleOf(skill,'fatal'),pierce=this.moduleOf(skill,'pierce'),amp=this.moduleOf(skill,'amplify');
    const extra={critMult:1.4+(fatal?.3*fatal.coef:0),pierce:pierce?.3*pierce.coef:0};
    const mastery=this.masteryOf(skill),awake=this.awakened(skill),castId=++this.castSeq;
    if(this.stats.castEcho&&sk.cast(lv)>0){if(!p.echoUsed)p.echoUntil=this.clock+3;p.echoUsed=false;}
    // v6.0: 騎士訓練 empowers the next first-job melee skill after 戰意 was spent (one cast).
    const kn=(skill==='bash'||skill==='magnum')&&p.knightNext>this.clock?1+K.training.next(d.skillLevels.k_training??1):1;if(kn>1)p.knightNext=0;
    // 星紋研習 flow: count first-job spells; a second-job wizard skill spends a full flow.
    if(sk.job==='mage'&&sk.tags.includes('magic'))p.spellFlow=Math.min(3,p.spellFlow+1);else if(sk.job==='wizard'&&p.spellFlow>=3&&d.skillLevels.w_study)p.spellFlow=0;
    if(sk.tags.includes('magic')&&sk.element!=='neutral')p.lastElement=sk.element;
    const ranged=sk.tags.includes('ranged'),ascend=p.ascendUntil>this.clock;
    const hit=(m:Monster,mult0:number,o:Partial<HitOpts>&{element:Element;magic:boolean})=>{
      const mult=mult0*(amp&&o.element!=='neutral'?1+.15*amp.coef:1)*mastery.dmg*(o.derived?this.stats.derivedMult??1:(this.stats.skillMult??1)*kn)*(ranged?this.preyMult(m):1);
      const r=o.magic?this.magical(m,mult,o.element,critBonus,extra):this.physical(m,mult,o.element,o.hitBonus??0,critBonus,extra);
      const dealt=this.resolveHit(m,r,{skill,mult,...o});
      if(dealt>0&&!o.derived){this.onHitModules(skill,m,dealt,!!sk.tags.includes('area'));if(ranged)this.falcon(m);}
      return dealt;
    };
    // 戰技之魂 變招 also counts the knight's attack skills.
    if(sk.job==='knight'&&sk.tags.includes('melee'))this.artSwitch(skill,target??ground??p,hit);
    switch(skill){
      case 'firstAid':this.heal(15,0);break;
      case 'bash':if(target){const soul=this.soul();this.artSwitch(skill,target,hit);
        // v6.5 烈焰之魂 焰影追斬: close a short gap (never through walls), two quick cuts, then two burning swings.
        if(soul==='flame'){const dd=dist(p,target);if(dd>1.3){const ux=(target.x-p.x)/dd,uy=(target.y-p.y)/dd;let reach=0;
            for(let t=.2;t<=Math.min(1.6,dd-1);t+=.2){if(!this.map.grid.free(p.x+ux*t,p.y+uy*t))break;reach=t;}
            if(reach>0){const from={x:p.x,y:p.y};this.events.push({t:'fx',kind:'dash',x:from.x,y:from.y,tx:from.x+ux*reach,ty:from.y+uy*reach,dur:.12});p.x+=ux*reach;p.y+=uy*reach;p.path=[];}}
          const n=2+(this.fx('chain4')?1:0),per=SW.chase(lv)/2;let landed=false;
          for(let i=0;i<n;i++)this.later(i*.08,()=>{if(target.state==='dead'||p.dead)return;
            this.events.push({t:'fx',kind:'bash',x:target.x,y:target.y,dur:.25,r:i===n-1?1:0});
            if(hit(target,per,{element:'fire',magic:false,hitBonus:lv*5})>0){if(!landed){landed=true;this.gainResolve(1);}this.enchantHit(target,true);}
            if(i===n-1)p.flameNext=2;});
          break;}
        // v6.2 連環重斬: quick multi-hit (each cut is a real hit for cards); the last cut sends a sword wave.
        const n=SW.bashHits(lv)+(this.fx('chain4')?1:0),per=SW.bashPer(lv),emp=soul==='chain'&&p.chainEmp?SW.chainEmp:1;let landed=false;
        if(emp>1)p.chainEmp=false;
        // 連斬之魂: a tighter recovery.
        if(soul==='chain')p.afterCastUntil=this.clock+(p.afterCastUntil-this.clock)*SW.chainDelay;
        // 連斬之魂: when the target falls mid-combo, the remaining cuts jump to the nearest enemy.
        let cur=target;
        for(let i=0;i<n;i++)this.later(i*.09,()=>{if(p.dead)return;
          if(cur.state==='dead'){const nx=soul==='chain'?this.inRadius(cur,2.5).sort((a,b)=>dist(a,cur)-dist(b,cur))[0]:undefined;if(!nx)return;
            this.events.push({t:'fx',kind:'dash',x:cur.x,y:cur.y,tx:nx.x,ty:nx.y,dur:.08});cur=nx;}
          const last=i===n-1;
          this.events.push({t:'fx',kind:'bash',x:cur.x,y:cur.y,dur:.3,r:last?1:0});
          const dealt=hit(cur,per*(last?emp:1),{element:'neutral',magic:false,hitBonus:lv*5});
          if(dealt>0){if(!landed){landed=true;this.gainResolve(1);}this.enchantHit(cur,true);}
          if(!last)return;
          const at={x:cur.x,y:cur.y};this.events.push({t:'fx',kind:'cleave',x:p.x,y:p.y,tx:at.x,ty:at.y,dur:.35,r:2});
          // 連斬之魂 疾影連斬: an afterimage cut, part of the SP back (once per cast) and a 回氣 swing.
          if(soul==='chain'){this.events.push({t:'fx',kind:'bash',x:at.x+.3,y:at.y-.3,dur:.3,r:1});for(const m of this.inRadius(at,1.4))hit(m,SW.chainImage,{element:'neutral',magic:false,derived:true});
            if(landed){p.sp=Math.min(d.maxSp,p.sp+Math.round(cost*SW.chainRefund));p.chainSp=true;}}
          // 磐石之魂 撼地斬: the last blow sends a shockwave and builds 守勢.
          if(soul==='rock'){this.events.push({t:'fx',kind:'quake',x:at.x,y:at.y,dur:.4,r:1.8});
            for(const m of this.inRadius(at,1.8))hit(m,per*SW.rockWave,{element:'neutral',magic:false,derived:true});this.addGuard(1);this.taunt(p,SW.rockTaunt);}
          for(const m of this.inRadius(at,1.7))if(m!==cur)hit(m,per*SW.wave,{element:'neutral',magic:false,derived:true});
          // 覺醒「破岩重斬」: stun chance and a shockwave on the last cut.
          if(awake&&dealt>0){if(!cur.def.mvp&&!isDead(cur)&&this.rng()<.3){cur.stunUntil=this.clock+1.5;cur.path=[];this.events.push({t:'status',id:cur.id,kind:'stun'});}
            this.events.push({t:'fx',kind:'pulse',x:at.x,y:at.y,dur:.4,r:1.5});
            for(const m of this.monsters)if(m!==cur&&m.state!=='dead'&&dist(m,at)<=1.5)hit(m,per*n*.5,{element:'neutral',magic:false,derived:true});}});}
        break;
      case 'magnum':{const soul=this.soul();this.artSwitch(skill,p,hit);
        // v6.5 烈焰之魂 烈焰附刃: a small flame burst, then a long blade whose cards fire on every cleave (no knockback).
        if(soul==='flame'){const hs=this.inRadius(p,1.8);this.events.push({t:'fx',kind:'explode',x:p.x,y:p.y,dur:.35,r:1.8,element:'fire'});
          for(const m of hs)hit(m,SW.flameCast(lv),{element:'fire',magic:false});if(hs.length)this.gainResolve(1);
          p.enchant={until:this.clock+SW.flameDur,lv,hits:p.enchant?.hits??0,route:true};this.events.push({t:'fx',kind:'enchant',x:p.x,y:p.y,dur:.6});break;}
        // 連斬之魂 斬勢爆破: a quick physical slash around you that empowers the next 連斬 finisher (no blade fire).
        if(soul==='chain'){const hs=this.inRadius(p,SW.chainR);this.events.push({t:'fx',kind:'judgment',x:p.x,y:p.y,dur:.4,r:SW.chainR,angle:0,length:360});
          for(const m of hs)hit(m,SW.chainBreak(lv),{element:'neutral',magic:false});if(hs.length)this.gainResolve(1);p.chainEmp=true;
          this.areaModules(skill,p,SW.chainR,(m,mult)=>hit(m,mult,{element:'neutral',magic:false,derived:true}),SW.chainBreak(lv),hs.length>0);break;}
        // 磐石之魂 震地爆破: spend 守勢 for a bigger ground slam (no blade fire).
        // 磐石之魂 震地反擊: an instant counter burst (counter formula, 守勢 included, nothing spent).
        if(soul==='rock'){const hs=this.inRadius(p,SW.rockR),cm=SW.rockBurst(lv)*(this.fx('thorns')?1.3:1)*(this.fx('thornsPlus')?1.3:1);let total=0;this.events.push({t:'fx',kind:'quake',x:p.x,y:p.y,dur:.5,r:SW.rockR});
          for(const m of hs)total+=this.resolveHit(m,{amount:Math.round(this.counterAmount(m)*cm),crit:false,miss:false},{skill:'thorns',mult:cm,element:'neutral',magic:false});
          this.thornsHeal(total);if(hs.length){this.gainResolve(1);this.addGuard(1);}
          this.areaModules(skill,p,SW.rockR,(m,mm)=>{if(m.state!=='dead')this.resolveHit(m,{amount:Math.round(this.counterAmount(m)*mm),crit:false,miss:false},{skill:'thorns',mult:mm,element:'neutral',magic:false,derived:true});},cm,hs.length>0);break;}
        this.events.push({t:'fx',kind:'magnum',x:p.x,y:p.y,dur:.5,r:2});
        const hits=this.monsters.filter(m=>m.state!=='dead'&&dist(m,p)<=2.2);
        // v6.2: no knockback (melee kept chasing what it had just blown away); the weapon catches fire instead.
        for(const m of hits)hit(m,1+.2*lv,{element:'fire',magic:false});
        if(hits.length)this.gainResolve(1);
        p.enchant={until:this.clock+SW.enchantDur,lv,hits:p.enchant?.hits??0};this.events.push({t:'fx',kind:'enchant',x:p.x,y:p.y,dur:.6});
        // 覺醒「熔岩爆破」: the ground keeps burning.
        if(awake){const burn=Math.max(1,Math.round(d.atk*.1));for(const m of hits)if(m.state!=='dead')m.dots.push({until:this.clock+3,tick:.25,dmg:burn});
          this.events.push({t:'fx',kind:'explode',x:p.x,y:p.y,dur:.8,r:2.2,element:'fire'});}
        this.areaModules(skill,p,2.2,(m,mult)=>hit(m,mult,{element:'fire',magic:false,derived:true}),1+.2*lv,hits.length>0);
        break;}
      case 'provoke':if(target){target.provoke={until:this.clock+30,def:.05+lv*.05,atk:.02+lv*.03};target.state='chase';
        this.events.push({t:'fx',kind:'provoke',x:target.x,y:target.y,dur:.8});this.events.push({t:'status',id:target.id,kind:'provoke'});}break;
      case 'endure':p.endure={until:this.clock+7+lv*3,def:lv*2};if(this.fx('thorns'))p.thornsCharges=3;this.events.push({t:'fx',kind:'buff',x:p.x,y:p.y,dur:.8});break;
      case 'concentrate':p.concentrate={until:this.clock+40+lv*20,pct:(2+lv)/100};this.events.push({t:'fx',kind:'buff',x:p.x,y:p.y,dur:.8});break;
      case 'fireBolt':case 'coldBolt':case 'lightningBolt':
        if(target){const element=sk.element,burnMatk=this.matkSnapshot((amp?1+.15*amp.coef:1)*mastery.dmg);let firstStrike=true;
          for(let i=0;i<lv;i++){const delay=.12+i*.17;
            this.events.push({t:'fx',kind:skill==='lightningBolt'?'thunder':'bolt',x:target.x,y:target.y,dur:delay,element});
            this.later(delay,()=>{if(target.state==='dead')return;const dealt=hit(target,1,{element,magic:true});if(dealt<=0)return;
              if(skill==='fireBolt'){
                // 灼燒 +1 per effective bolt. Awakened explosion is derived damage and never adds burn.
                this.addBurn(target,1,burnMatk);
                if(awake){this.events.push({t:'fx',kind:'explode',x:target.x,y:target.y,dur:.3,r:1.5,element:'fire'});
                  for(const m of this.monsters)if(m!==target&&m.state!=='dead'&&dist(m,target)<=1.5)hit(m,.4,{element,magic:true,derived:true,skill:'blast'});}
              }else if(skill==='coldBolt'){
                // 寒氣 +1; awakened 20% freeze still obeys MVP immunity and freeze protection.
                this.addChill(target,1,castId,skill);
                if(awake&&this.rng()<.2)this.tryFreeze(target,1.2);
              }else{
                // 感電 refresh + Charge (primary bolts only) → 落雷 every 4; one chain or rebound per bolt.
                const e=this.es(target);e.shockUntil=this.clock+LOOP.shock.duration;e.charge++;
                const need=LOOP.charge.need-(this.fx('storm')?1:0);
                if(e.charge>=need){e.charge-=need;this.events.push({t:'fx',kind:'thunder',x:target.x,y:target.y,dur:.05,element});
                  // v6.0 星紋昇華: the first 落雷 of each cast is stronger; 導雷星樁 echoes one strike per cast.
                  hit(target,LOOP.charge.strikeMult*(ascend&&firstStrike?1+W.ascend.strike(p.ascendLv):1),{element,magic:true,derived:true,skill:'strike'});firstStrike=false;
                  const tr=this.moduleOf(skill,'thunderReturn');if(tr&&!isDead(target)){this.events.push({t:'fx',kind:'chain',x:target.x,y:target.y-1.5,tx:target.x,ty:target.y,dur:.15,element});hit(target,.4*tr.coef,{element,magic:true,derived:true,skill:'strike'});}
                  const tz=this.zones.find(z=>z.kind==='totem'&&z.echoCast!==castId&&dist(z,target)<=z.r);
                  if(tz&&!isDead(target)){tz.echoCast=castId;this.events.push({t:'fx',kind:'chain',x:tz.x,y:tz.y,tx:target.x,ty:target.y,dur:.2,element});
                    hit(target,W.totem.echo(tz.lv),{element,magic:true,derived:true,skill:'totem'});}}
                if(isDead(target))return;
                const next=this.monsters.filter(m=>m!==target&&m.state!=='dead'&&dist(m,target)<=LOOP.chain.range).sort((x,y)=>dist(x,target)-dist(y,target)||x.id-y.id)[0];
                const chance=awake&&next?1:LOOP.chain.chance;
                if(this.rng()<chance){
                  if(next){this.events.push({t:'fx',kind:'chain',x:target.x,y:target.y,tx:next.x,ty:next.y,dur:.2,element});hit(next,LOOP.chain.mult,{element,magic:true,derived:true,skill:'chain'});}
                  else{this.events.push({t:'fx',kind:'bolt',x:target.x,y:target.y,dur:.12,element});hit(target,LOOP.chain.rebound,{element,magic:true,derived:true,skill:'rebound'});}
                }
              }});}}
        break;
      case 'fireBall':if(target){const travel=dist(p,target)/11+.05,center={x:target.x,y:target.y},spreadMatk=this.matkSnapshot((amp?1+.15*amp.coef:1)*mastery.dmg);
        this.events.push({t:'fx',kind:'fireball',x:p.x,y:p.y,tx:target.x,ty:target.y,dur:travel,element:'fire'});
        this.later(travel,()=>{const c=target.state!=='dead'?{x:target.x,y:target.y}:center;this.events.push({t:'fx',kind:'explode',x:c.x,y:c.y,dur:.45,r:2,element:'fire'});
          const R2=awake?3.1:2.2;if(awake)this.events.push({t:'fx',kind:'explode',x:c.x,y:c.y,dur:.6,r:R2,element:'fire'});
          const hits=this.monsters.filter(m=>m.state!=='dead'&&dist(m,c)<=R2);
          // Snapshot burn BEFORE the body hits so a lethal body hit still detonates and spreads.
          const burning=hits.map(m=>({m,stacks:m.el?.burn&&m.el.burn.until>this.clock?m.el.burn.stacks:0,at:{x:m.x,y:m.y}})).filter(b=>b.stacks>0);
          for(const m of hits)hit(m,.7+.1*lv,{element:'fire',magic:true,...(awake?{knock:1.5,from:c}:{})});
          // 引爆: once per target per cast; the remaining DoT is discarded; spread does not chain this cast.
          const spreadTo=new Set<Monster>();
          for(const b of burning){
            // v6.0 星紋昇華 keeps up to 2 stacks after the detonation; 焰環熔域 adds to detonations inside it.
            if(b.m.el){if(ascend&&b.m.el.burn)b.m.el.burn.stacks=Math.min(2,b.stacks);else b.m.el.burn=null;}
            const fz=this.zones.find(z=>z.kind==='flame'&&dist(z,b.at)<=z.r+.3);
            this.events.push({t:'fx',kind:'explode',x:b.at.x,y:b.at.y,dur:.35,r:1.2,element:'fire'});
            if(b.m.state!=='dead')hit(b.m,(LOOP.detonate.perStack+(fz?W.flame.det(fz.lv):0))*b.stacks,{element:'fire',magic:true,derived:true,skill:'detonate'});
            const ee=this.moduleOf(skill,'emberEcho');if(ee&&b.m.state!=='dead')this.later(.2,()=>{if(b.m.state==='dead')return;this.events.push({t:'fx',kind:'explode',x:b.m.x,y:b.m.y,dur:.25,r:.8,element:'fire'});hit(b.m,.5*ee.coef,{element:'fire',magic:true,derived:true,skill:'detonate'});});
            const near=this.monsters.filter(n=>n!==b.m&&n.state!=='dead'&&!burning.some(x=>x.m===n)&&dist(n,b.at)<=LOOP.detonate.spreadRange)
              .sort((x,y)=>dist(x,b.at)-dist(y,b.at)||x.id-y.id).slice(0,LOOP.detonate.spreadMax);
            for(const n of near){spreadTo.add(n);this.events.push({t:'fx',kind:'chain',x:b.at.x,y:b.at.y,tx:n.x,ty:n.y,dur:.25,element:'fire'});}
          }
          for(const n of spreadTo)this.addBurn(n,LOOP.detonate.spreadStacks,spreadMatk);
          this.areaModules(skill,c,2.2,(m,mult)=>hit(m,mult,{element:'fire',magic:true,derived:true}),.7+.1*lv,hits.length>0);});}
        break;
      case 'frostDiver':if(target){this.events.push({t:'fx',kind:'frost',x:p.x,y:p.y,tx:target.x,ty:target.y,dur:.3,element:'water'});
        this.later(.3,()=>{if(target.state==='dead')return;
          // Snapshot: a mark created by this very hit can't be consumed by it.
          const e=this.es(target),hadMark=!!e.mark&&e.mark.until>this.clock,wasFrozen=target.frozenUntil>this.clock;
          const dealt=hit(target,(1.1+.1*lv)*(awake&&(wasFrozen||hadMark)?1.5:1),{element:'water',magic:true});
          if(hadMark){
            // 碎冰: consume the mark, bonus on the main target, ice shards to other enemies.
            e.mark=null;this.events.push({t:'fx',kind:'shatter',x:target.x,y:target.y,dur:.45,r:1.2});
            const at={x:target.x,y:target.y};
            if(!isDead(target))hit(target,LOOP.shatter.bonus*(this.fx('mirror')?1.4:1),{element:'water',magic:true,derived:true,skill:'shatter'});
            const shards=this.monsters.filter(m=>m!==target&&m.state!=='dead'&&dist(m,at)<=LOOP.shatter.shardRange).sort((x,y)=>dist(x,at)-dist(y,at)||x.id-y.id).slice(0,LOOP.shatter.shards);
            for(const m of shards){this.events.push({t:'fx',kind:'frost',x:at.x,y:at.y,tx:m.x,ty:m.y,dur:.2,element:'water'});hit(m,LOOP.shatter.shardMult,{element:'water',magic:true,derived:true,skill:'shard'});}
            // v6.0 星紋昇華: with nobody else around the shards strike the main target.
            if(!shards.length&&ascend)for(let k=0;k<LOOP.shatter.shards;k++)if(!isDead(target)){this.events.push({t:'fx',kind:'frost',x:at.x+.8,y:at.y-.8,tx:at.x,ty:at.y,dur:.2,element:'water'});hit(target,LOOP.shatter.shardMult,{element:'water',magic:true,derived:true,skill:'shard'});}
          }else if(!isDead(target))this.addChill(target,LOOP.frostDiverChill,castId,skill);
          if(dealt>0&&this.rng()*100<35+3*lv+(awake?25:0))this.tryFreeze(target,lv*1.5);});}
        break;
      case 'thunderStorm':if(ground){const c={...ground};
        for(let i=0;i<lv+(awake?2:0);i++)this.later(.1+i*.22,()=>{this.events.push({t:'fx',kind:'thunder',x:c.x+(this.rng()-.5)*3,y:c.y+(this.rng()-.5)*3,dur:.05,element:'wind'});
          const hits=this.monsters.filter(m=>m.state!=='dead'&&Math.abs(m.x-c.x)<=2.5&&Math.abs(m.y-c.y)<=2.5);
          // +20% against targets that are 感電 at strike time; storm adds no Charge and no chains.
          for(const m of hits)hit(m,.8*((m.el?.shockUntil??0)>this.clock?1+LOOP.storm.shockedBonus:1),{element:'wind',magic:true});
          if(i===0)this.areaModules(skill,c,2.5,(m,mult)=>hit(m,mult,{element:'wind',magic:true,derived:true}),.8,hits.length>0);});}
        break;
      case 'doubleStrafe':if(target){for(let i=0;i<(awake?3:2);i++){const delay=dist(p,target)/16+i*.12;
        this.events.push({t:'fx',kind:'arrow',x:p.x,y:p.y,tx:target.x,ty:target.y,dur:delay});
        this.later(delay,()=>{if(target.state!=='dead')hit(target,1+.1*lv,{element:'neutral',magic:false});});}}
        break;
      case 'arrowShower':if(ground){const c={...ground},R2=awake?2.4:1.6;this.events.push({t:'fx',kind:'arrowRain',x:c.x,y:c.y,dur:.4,r:awake?2.25:1.5});
        this.later(.35,()=>{const hits=this.monsters.filter(m=>m.state!=='dead'&&Math.abs(m.x-c.x)<=R2&&Math.abs(m.y-c.y)<=R2);
          for(const m of hits){hit(m,.8+.05*lv,{element:'neutral',magic:false,knock:2,from:c});if(awake&&m.state!=='dead'){m.slowUntil=this.clock+3;this.events.push({t:'status',id:m.id,kind:'slow'});}}
          this.areaModules(skill,c,1.6,(m,mult)=>hit(m,mult,{element:'neutral',magic:false,derived:true}),.8+.05*lv,hits.length>0);});}
        break;
      case 'chargeArrow':if(target){const delay=dist(p,target)/18;this.events.push({t:'fx',kind:'arrow',x:p.x,y:p.y,tx:target.x,ty:target.y,dur:delay});
        const from={x:p.x,y:p.y};
        this.later(delay,()=>{if(target.state!=='dead')hit(target,1.5,{element:'neutral',magic:false,knock:5,from});
          // 覺醒「貫穿震退箭」: everything on the line (and 3 cells past the target) is struck too.
          if(awake){const dx=target.x-from.x,dy=target.y-from.y,L=Math.hypot(dx,dy)||1,ux=dx/L,uy=dy/L;
            for(const m of this.monsters){if(m===target||m.state==='dead')continue;const t=(m.x-from.x)*ux+(m.y-from.y)*uy,off=Math.abs((m.x-from.x)*uy-(m.y-from.y)*ux);
              if(t>0&&t<L+3&&off<.7)hit(m,1.2,{element:'neutral',magic:false,knock:3,from,derived:true});}}});}
        break;
      // ═══════════ v6.0 星誓騎士 ═══════════
      case 'k_wheel':{const soul=this.soul(),flame=soul==='flame',el:Element=flame?'fire':'neutral',wr=K.wheel.r+(flame?SW.kFlameR:0),spins=(awake?4:3)+(this.artVaried(skill)?1:0),struck=new Set<number>();
        this.events.push({t:'fx',kind:'wheel',x:p.x,y:p.y,dur:.16*spins+.2,r:wr,...(flame?{element:'fire' as Element}:{})});
        // 焰誓騎士 焰輪旋斬: the burning blade keeps burning longer.
        if(flame&&p.enchant&&p.enchant.until>this.clock)p.enchant.until=Math.min(this.clock+SW.flameDur,p.enchant.until+SW.kFlameWheel);
        for(let i=0;i<spins;i++)this.later(i*.16,()=>{if(p.dead)return;const hits=this.inRadius(p,wr);
          let first:Monster|null=null;for(const m of hits)if(hit(m,K.wheel.hit(lv)*(flame?SW.kFlameWheelHit:1),{element:el,magic:false})>0){struck.add(m.id);if(flame){first??=m;this.enchantHit(m,true);}}
          // 焰輪旋斬: every spin that lands also counts toward the blade's cleave (cards on 烈焰爆破 fire there).
          if(first&&first.state!=='dead'&&struck.size>=2)this.enchantHit(first,false);
          // ...and the cards on 烈焰爆破 burst from the first spin (no knockback).
          if(flame&&i===0&&hits.length>=2)this.areaModules('magnum',p,wr,(m,mm)=>hit(m,mm,{element:'fire',magic:false,derived:true}),K.wheel.hit(lv),true,true);
          if(i===0&&soul==='rock'&&hits.length){this.taunt(p,wr+.5);this.addGuard(1);}
          if(i===0){this.gainResolve(struck.size>=3?2:struck.size?1:0);this.areaModules(skill,p,K.wheel.r,(m,mult)=>hit(m,mult,{element:'neutral',magic:false,derived:true}),K.wheel.hit(lv),hits.length>0);}});
        break;}
      case 'k_charge':if(target){const from={x:p.x,y:p.y},dx=target.x-p.x,dy=target.y-p.y,L=Math.hypot(dx,dy)||1,ux=dx/L,uy=dy/L;
        // Walk the line in small steps: stop at walls, and just in front of the target. Never through terrain.
        let reach=0;for(let t=.25;t<=Math.max(0,L-.9);t+=.25){if(!this.map.grid.free(from.x+ux*t,from.y+uy*t))break;reach=t;}
        const to={x:from.x+ux*reach,y:from.y+uy*reach};p.path=[];
        this.events.push({t:'fx',kind:'dash',x:from.x,y:from.y,tx:to.x,ty:to.y,dur:.22});
        for(let i=1;i<=4;i++)this.later(i*.05,()=>{if(p.dead)return;p.x=from.x+(to.x-from.x)*i/4;p.y=from.y+(to.y-from.y)*i/4;});
        this.later(.22,()=>{if(p.dead)return;let any=false;
          for(const m of this.monsters){if(m.state==='dead')continue;const t=(m.x-from.x)*ux+(m.y-from.y)*uy,off=Math.abs((m.x-from.x)*uy-(m.y-from.y)*ux);
            if(m===target||(t>-.3&&t<reach+1.3&&off<1))if(hit(m,K.charge.mult(lv)*(this.mountedKnight()?1.2:1),{element:this.soul()==='flame'?'fire':'neutral',magic:false,knock:m===target?0:1.2,from:p})>0)any=true;}
          if(any)this.gainResolve(awake?2:1);
          // 焰誓騎士 焰痕突進: a fresh blade and two burning swings.
          if(any&&this.soul()==='flame'){p.flameNext=2;if(p.enchant)p.enchant.until=Math.max(p.enchant.until,this.clock+SW.flameDur);}
          if(awake&&!isDead(target)&&!target.def.mvp){target.stunUntil=this.clock+1;target.path=[];this.events.push({t:'status',id:target.id,kind:'stun'});}
          this.areaModules(skill,p,1.6,(m,mult)=>hit(m,mult,{element:'neutral',magic:false,derived:true}),K.charge.mult(lv),any);});}
        break;
      case 'k_ward':{const n=this.spendResolve(),sh={amount:Math.round(d.maxHp*(K.ward.base(lv)+K.ward.per*n)*this.shieldMult()*(this.fx('bulwark')?1.25:1)),until:this.clock+K.ward.dur};
        if(p.ward)this.events.push({t:'fxEnd',key:p.ward.key});
        p.shields.push(sh);const key=this.fxKey++;p.ward={until:sh.until,lv,counterAt:-9,shield:sh,key};
        // 磐誓騎士 磐石誓壁: the oath also raises 磐石架勢.
        if(this.soul()==='rock'){const el=d.skillLevels.endure??0;if(!p.endure||p.endure.until<sh.until)p.endure={until:sh.until,def:Math.max(p.endure?.def??0,el*2,6)};}
        this.events.push({t:'fx',kind:'ward',x:p.x,y:p.y,dur:K.ward.dur,r:1.2,key});break;}
      case 'k_rend':if(target&&this.soul()==='chain'){
        // 影刃騎士 疾影裂星: the great cut becomes a combo (cards on every cut); the finisher takes 斬勢爆破's ×1.5 and leaves an afterimage.
        const n=this.spendResolve(),cuts=SW.kChainCuts+n,per=(K.rend.mult(lv)+K.rend.per(lv)*n)*SW.kChainRend/cuts,emp=p.chainEmp?SW.chainEmp:1;if(emp>1)p.chainEmp=false;
        let cur=target,landed=false;
        for(let i=0;i<cuts;i++)this.later(i*.07,()=>{if(p.dead)return;
          if(cur.state==='dead'){const nx=this.inRadius(cur,2.5).sort((a,b)=>dist(a,cur)-dist(b,cur))[0];if(!nx)return;this.events.push({t:'fx',kind:'dash',x:cur.x,y:cur.y,tx:nx.x,ty:nx.y,dur:.08});cur=nx;}
          const last=i===cuts-1;this.events.push({t:'fx',kind:last?'rend':'bash',x:cur.x,y:cur.y,dur:last?.5:.25,r:last?n:0});
          if(hit(cur,per*(last?emp:1),{element:'neutral',magic:false,hitBonus:25})>0&&!landed){landed=true;this.gainResolve(1);}
          if(last){const at={x:cur.x,y:cur.y};for(const m of this.inRadius(at,1.4))hit(m,SW.chainImage,{element:'neutral',magic:false,derived:true});if(n>=3)this.breakerWave(cur,hit);}});
        break;}
      if(target){const n=this.spendResolve();this.events.push({t:'fx',kind:'rend',x:target.x,y:target.y,dur:.55,r:n});
        const dealt=hit(target,K.rend.mult(lv)+K.rend.per(lv)*n,{element:'neutral',magic:false,hitBonus:25});
        if(dealt>0)this.gainResolve(1);
        if(dealt>0&&n>=3)this.breakerWave(target,hit);
        // 覺醒「斷星重斬」: a shockwave around the target.
        if(awake&&dealt>0){this.events.push({t:'fx',kind:'pulse',x:target.x,y:target.y,dur:.4,r:1.8});
          for(const m of this.inRadius(target,1.8))if(m!==target)hit(m,(K.rend.mult(lv)+K.rend.per(lv)*n)*.5,{element:'neutral',magic:false,derived:true});}}
        break;
      case 'k_quake':{const rockQ=this.soul()==='rock',g=rockQ?p.guard:0;
        // 磐誓騎士 撼岳戰陣: a counter-powered slam; 守勢 widens it (nothing spent).
        const r=K.quake.r+(awake?1:0)+g*SW.kRockQuakeR,qm=K.quake.mult(lv),hits=this.inRadius(p,r);this.events.push({t:'fx',kind:'quake',x:p.x,y:p.y,dur:.5,r});
        if(rockQ){const cm=SW.kRockQuakeC(lv);for(const m of hits)this.resolveHit(m,{amount:Math.round(this.counterAmount(m)*cm),crit:false,miss:false},{skill:'thorns',mult:cm,element:'earth',magic:false});}
        else for(const m of hits)hit(m,qm,{element:'earth',magic:false});
        if(hits.length)this.gainResolve(1);
        this.addZone('quake',p,r,K.quake.dur,lv,castId);
        this.areaModules(skill,p,r,(m,mult)=>hit(m,mult,{element:'earth',magic:false,derived:true}),K.quake.mult(lv),hits.length>0);break;}
      case 'k_judgment':if(target){const n=this.spendResolve(),a=Math.atan2(target.y-p.y,target.x-p.x),R2=K.judgment.r;
        this.events.push({t:'fx',kind:'judgment',x:p.x,y:p.y,dur:.7,r:R2,angle:a,length:awake?360:120});
        const inFan=(m:Monster)=>{const dd=dist(m,p);if(dd>R2)return false;if(awake||dd<.6)return true;let da=Math.abs(Math.atan2(m.y-p.y,m.x-p.x)-a);if(da>Math.PI)da=Math.PI*2-da;return da<=Math.PI/3;};
        this.later(.15,()=>{const hits=this.monsters.filter(m=>m.state!=='dead'&&(m===target||inFan(m)));
          // 戰技騎士: every different attack skill used lately adds power; 影刃騎士: a duel strike hits harder.
          const artN=this.soul()==='art'?Math.min(SW.kArtMax,Object.values(this.artUsed).filter(t=>this.clock-t<=SW.kArtWin).length):0;
          const jm=(K.judgment.mult(lv)+K.judgment.per*n)*(1+SW.kArtJudge*artN)*(this.soul()==='chain'&&hits.length===1?SW.kChainSolo:1);
          for(const m of hits)hit(m,jm,{element:'neutral',magic:false,hitBonus:30,knock:m.def.mvp?0:1.5,from:p});
          if(hits.length&&n>=3)this.breakerWave(target,hit);
          this.areaModules(skill,target,2.2,(m,mult)=>hit(m,mult,{element:'neutral',magic:false,derived:true}),K.judgment.mult(lv),hits.length>0);});}
        break;
      case 'k_trample':if(target){const a=Math.atan2(target.y-p.y,target.x-p.x),dragon=this.dragonRider(),el:Element=dragon?'fire':'neutral',mult=K.trample.mult(lv)*(dragon?K.trample.dragon:1);
        const inCone=(m:Monster)=>{const dd=dist(m,p);if(dd>K.trample.r)return false;if(dd<.8)return true;let da=Math.abs(Math.atan2(m.y-p.y,m.x-p.x)-a);if(da>Math.PI)da=Math.PI*2-da;return da<=.9;};
        let any=false;
        for(let i=0;i<K.trample.stomps;i++)this.later(i*.2,()=>{if(p.dead)return;this.events.push({t:'fx',kind:'trample',x:p.x,y:p.y,dur:.4,r:K.trample.r,angle:a,element:el,length:i});
          const hits=this.monsters.filter(m=>m.state!=='dead'&&(m===target||inCone(m)));
          for(const m of hits)if(hit(m,mult,{element:el,magic:false})>0)any=true;
          if(i===0)this.areaModules(skill,p,K.trample.r*.7,(m,mm)=>hit(m,mm,{element:el,magic:false,derived:true}),mult,hits.length>0);
          if(i===K.trample.stomps-1&&any){this.gainResolve(1);if(this.soul()==='rock')this.addGuard(1);}});}
        break;
      // ═══════════ v6.0 星紋魔導士 ═══════════
      case 'w_flame':if(ground){const z=this.addZone('flame',ground,W.flame.r,W.flame.dur,lv,castId);z.matk=this.matkSnapshot((amp?1+.15*amp.coef:1)*mastery.dmg);
        const hits=this.inRadius(z,z.r);for(const m of hits){hit(m,W.flame.mult(lv),{element:'fire',magic:true});this.addBurn(m,awake?3:2,z.matk);}
        this.areaModules(skill,z,z.r,(m,mult)=>hit(m,mult,{element:'fire',magic:true,derived:true}),W.flame.mult(lv),hits.length>0);}
        break;
      case 'w_frost':if(ground){const z=this.addZone('frost',ground,W.frost.r,W.frost.dur+(awake?2:0),lv,castId);
        const hits=this.inRadius(z,z.r);for(const m of hits)if(hit(m,W.frost.mult(lv),{element:'water',magic:true})>0)this.addChill(m,2,castId,skill);
        this.areaModules(skill,z,z.r,(m,mult)=>hit(m,mult,{element:'water',magic:true,derived:true}),W.frost.mult(lv),hits.length>0);}
        break;
      case 'w_totem':if(ground){const z=this.addZone('totem',ground,W.totem.r,W.totem.dur,lv,castId);z.next=this.clock+2;z.pulses=awake?5:3;this.totemPulse(z,true);}
        break;
      case 'w_veil':{const sh={amount:Math.round(d.maxSp*W.veil.sp(lv)*this.shieldMult()),until:this.clock+W.veil.dur};p.shields.push(sh);
        this.events.push({t:'fx',kind:'veil',x:p.x,y:p.y,dur:W.veil.dur,r:1.1,key:this.fxKey++});break;}
      case 'w_ascend':p.ascendUntil=this.clock+W.ascend.dur(lv);p.ascendLv=lv;this.events.push({t:'fx',kind:'ascend',x:p.x,y:p.y,dur:1.2});break;
      case 'w_arcana':if(target){const el=p.lastElement,R2=W.arcana.r+(awake?1:0),c={x:target.x,y:target.y},boost=awake?1.25:1;
        this.events.push({t:'fx',kind:'arcana',x:c.x,y:c.y,dur:1,r:R2,element:el});
        this.later(.35,()=>{const hits=this.inRadius(target.state!=='dead'?target:c,R2);
          if(el==='fire'){const burning=hits.map(m=>({m,stacks:m.el?.burn&&m.el.burn.until>this.clock?m.el.burn.stacks:0}));
            for(const m of hits)hit(m,W.arcana.fire(lv)*boost,{element:'fire',magic:true});
            for(const b of burning)if(b.stacks>0&&!isDead(b.m)){if(b.m.el)b.m.el.burn=ascend?{...b.m.el.burn!,stacks:Math.min(2,b.stacks)}:null;
              this.events.push({t:'fx',kind:'explode',x:b.m.x,y:b.m.y,dur:.35,r:1.2,element:'fire'});hit(b.m,LOOP.detonate.perStack*2*b.stacks,{element:'fire',magic:true,derived:true,skill:'detonate'});
              const ee=this.moduleOf(skill,'emberEcho');if(ee&&!isDead(b.m))hit(b.m,.5*ee.coef,{element:'fire',magic:true,derived:true,skill:'detonate'});}
          }else if(el==='water'){
            for(const m of hits){hit(m,W.arcana.ice(lv)*boost,{element:'water',magic:true});if(isDead(m))continue;
              const e=this.es(m);e.chill=null;e.mark=null;this.events.push({t:'fx',kind:'shatter',x:m.x,y:m.y,dur:.45,r:1.2});hit(m,LOOP.shatter.bonus*(this.fx('mirror')?1.4:1),{element:'water',magic:true,derived:true,skill:'shatter'});}
          }else{const list=hits.sort((a2,b2)=>(a2===target?-1:b2===target?1:dist(a2,c)-dist(b2,c)));
            for(let k=0;k<6&&list.length;k++){const m=list[k%list.length];this.later(k*.12,()=>{if(isDead(m))return;this.events.push({t:'fx',kind:'thunder',x:m.x,y:m.y,dur:.05,element:'wind'});
              hit(m,W.arcana.bolt(lv)*boost,{element:'wind',magic:true});if(!isDead(m))this.es(m).shockUntil=this.clock+LOOP.shock.duration;});}}
          this.areaModules(skill,c,R2,(m,mult)=>hit(m,mult,{element:el,magic:true,derived:true}),1,hits.length>0);});}
        break;
      // ═══════════ v6.0 蒼穹遊俠 ═══════════
      case 'r_mark':if(target){this.prey={id:target.id,until:this.clock+RG.mark.dur+(this.fx('preyTime')?4:0),lv};this.events.push({t:'status',id:target.id,kind:'prey'});}
        break;
      case 'r_snipe':if(target){const delay=dist(p,target)/32+.02,from={x:p.x,y:p.y};this.events.push({t:'fx',kind:'snipe',x:p.x,y:p.y,tx:target.x,ty:target.y,dur:delay});
        this.later(delay,()=>{if(target.state==='dead')return;const marked=this.prey?.id===target.id&&this.prey.until>this.clock;
          hit(target,RG.snipe.mult(lv)+(marked?RG.snipe.marked(lv):0),{element:'neutral',magic:false,hitBonus:40,critBonus:marked&&this.fx('farsight')?1000:10});
          // 覺醒「穿星貫天」: the shot keeps going through everything behind the target.
          if(awake){const dx=target.x-from.x,dy=target.y-from.y,L=Math.hypot(dx,dy)||1,ux=dx/L,uy=dy/L;
            for(const m of this.monsters){if(m===target||m.state==='dead')continue;const t=(m.x-from.x)*ux+(m.y-from.y)*uy,off=Math.abs((m.x-from.x)*uy-(m.y-from.y)*ux);
              if(t>L&&t<L+5&&off<.8)hit(m,RG.snipe.mult(lv)*.6,{element:'neutral',magic:false,derived:true});}}});}
        break;
      case 'r_pierce':if(target){const from={x:p.x,y:p.y},dx=target.x-p.x,dy=target.y-p.y,L0=Math.hypot(dx,dy)||1,ux=dx/L0,uy=dy/L0,len=RG.pierce.len+(awake?2:0),wid=awake?1.3:.85;
        this.events.push({t:'fx',kind:'pierce',x:from.x,y:from.y,tx:from.x+ux*len,ty:from.y+uy*len,dur:.3,r:wid});
        const line=this.monsters.filter(m=>{if(m.state==='dead')return false;const t=(m.x-from.x)*ux+(m.y-from.y)*uy,off=Math.abs((m.x-from.x)*uy-(m.y-from.y)*ux);return m===target||(t>0&&t<len&&off<wid);});
        for(const m of line){const t=Math.max(.05,((m.x-from.x)*ux+(m.y-from.y)*uy)/28);this.later(t,()=>{if(m.state!=='dead')hit(m,RG.pierce.mult(lv),{element:'wind',magic:false,hitBonus:20});});}
        this.later(.3,()=>this.areaModules(skill,target,1.6,(m,mult)=>hit(m,mult,{element:'wind',magic:false,derived:true}),RG.pierce.mult(lv),line.length>0));}
        break;
      case 'r_barrage':if(target){let cur:Monster=target;const n=RG.barrage.n+(awake?2:0)+(this.fx('cyclone')?2:0),reach=sk.range+(d.skillLevels.vulture??0)*.5+.5;
        for(let i=0;i<n;i++)this.later(.06+i*.1,()=>{if(p.dead)return;
          if(cur.state==='dead'){const next=this.monsters.filter(m=>m.state!=='dead'&&dist(m,p)<=reach).sort((a2,b2)=>dist(a2,cur)-dist(b2,cur))[0];if(!next)return;cur=next;}
          const m=cur,tr=dist(p,m)/22;this.events.push({t:'fx',kind:'arrow',x:p.x,y:p.y,tx:m.x,ty:m.y,dur:tr});
          this.later(tr,()=>{if(m.state!=='dead')hit(m,RG.barrage.mult(lv),{element:'neutral',magic:false});});});}
        break;
      case 'r_trap':if(ground){const bind=this.fx('binding'),max=RG.trap.max+(awake?1:0)+(bind?1:0);while(this.traps.length>=max){const old=this.traps.shift()!;this.events.push({t:'fxEnd',key:old.id});}
        const c=this.map.grid.free(ground.x,ground.y)?{...ground}:{x:p.x,y:p.y},dur=bind?30:RG.trap.dur,t:Trap={id:this.fxKey++,x:c.x,y:c.y,until:this.clock+dur,armed:this.clock+.4,lv};this.traps.push(t);
        this.events.push({t:'fx',kind:'trap',x:t.x,y:t.y,dur,r:1,key:t.id});}
        break;
      case 'r_starRain':if(ground){const c={...ground},R2=RG.starRain.r,waves=awake?4:3;this.events.push({t:'fx',kind:'starRain',x:c.x,y:c.y,dur:.35+waves*.3,r:R2});
        for(let i=0;i<waves;i++)this.later(.35+i*.3,()=>{const hits=this.monsters.filter(m=>m.state!=='dead'&&Math.abs(m.x-c.x)<=R2&&Math.abs(m.y-c.y)<=R2);
          this.events.push({t:'fx',kind:'arrowRain',x:c.x,y:c.y,dur:.3,r:R2});
          for(const m of hits)hit(m,RG.starRain.mult(lv)*(hits.length===1?1.3:1),{element:'neutral',magic:false});
          if(i===0)this.areaModules(skill,c,R2,(m,mult)=>hit(m,mult,{element:'neutral',magic:false,derived:true}),RG.starRain.mult(lv),hits.length>0);});}
        break;
    }
  }

  // ———————————————————————— v7.0 星淵紀元 ————————————————————————
  setTier(id:number){const d=DIFFICULTY.find(x=>x.id===id)??DIFFICULTY[0];if(d!==this.tier){this.tier=d;this.tierDefs.clear();}}
  /** Difficulty applies on field maps and in the arena (星光深淵 and the challenges), never in town. */
  private tierActive(){return !!this.map&&(this.map.def.id in MAP_TIER||this.map.def.id==='abyss');}
  private tierDef(id:string):MonsterDef{
    const base=monsters[id],t=this.tier;if(t.id===1||!base)return base;
    let d=this.tierDefs.get(id);
    if(!d){d={...base,hp:Math.round(base.hp*t.hp),atk:[Math.round(base.atk[0]*t.atk),Math.round(base.atk[1]*t.atk)],exp:Math.round(base.exp*t.exp),jexp:Math.round(base.jexp*t.exp),
      drops:base.drops.map(x=>({...x,rate:Math.min(1,x.rate*t.drop)}))};this.tierDefs.set(id,d);}
    return d;
  }
  private boon(b:BoonId){const c=this.challenge;return c?.kind==='horde'&&c.boons.includes(b);}
  private sigilHas(a:SigilAffix){const c=this.challenge;return c?.kind==='sigil'&&c.state==='run'&&c.affixes.includes(a);}
  private starfallSpMult(){return (this.fx('spFlow')?ASPECT.spFlow.cost:1)*(this.boon('flow')?.7:1);}
  /** A flat "how hard you hit" number for effects that are not tied to one swing (meteors, blades, storms). */
  private power(){const d=this.stats;return Math.max(d.atk+d.weaponAtk,(d.matkMin+d.matkMax)/2);}
  private starHit(m:Monster,mult:number,src:string,element:Element='neutral'){
    if(m.state==='dead')return 0;const magic=this.stats.weaponType==='staff',def=Math.min(90,magic?m.def.mdef:m.def.def);
    const amount=Math.max(1,Math.round(this.power()*mult*(this.stats.derivedMult??1)*(100-def)/100*elementMultiplier(element,m.def.element)));
    return this.resolveHit(m,{amount,crit:false,miss:false},{skill:src,mult,element,magic,derived:true});
  }
  private ampFor(m:Monster,crit:boolean){
    const p=this.player,hp=p.hp/Math.max(1,this.stats.maxHp),big=!!m.def.mvp||!!m.elite?.length;let a=1;
    if(this.fx('executioner')&&m.hp<m.maxHp*ASPECT.executioner.below)a*=1+ASPECT.executioner.amp;
    if(this.fx('giantSlayer')&&big)a*=1+ASPECT.giantSlayer.amp;
    if(this.fx('berserk'))a*=1+ASPECT.berserk.amp*Math.max(0,1-hp);
    if(this.fx('pristine')&&hp>=ASPECT.pristine.above)a*=1+ASPECT.pristine.amp;
    if(this.fx('momentum'))a*=1+ASPECT.momentum.per*this.sf.momentum.filter(t=>t>this.clock).length;
    if(this.fx('critStorm')&&crit)a*=1+ASPECT.critStorm.amp;
    if(this.fx('u_abyssEye'))a*=1+UNIQUE.u_abyssEye.amp;
    if(this.fx('u_madKing'))a*=1+UNIQUE.u_madKing.per*this.sf.madKing;
    if(this.sf.chronoUntil>this.clock)a*=1+UNIQUE.u_chrono.amp;
    const c=this.challenge;
    if(c?.kind==='horde'){a*=1+.25*c.boons.filter(b=>b==='fury').length;if(big&&c.boons.includes('giant'))a*=1.5;}
    if(this.sigilHas('blessing'))a*=1.2;
    return a;
  }
  /** On a direct (non-derived) hit. Damage procs land a moment later so they never re-enter this hit. */
  private starfallHit(m:Monster,dealt:number,crit:boolean){
    const p=this.player,max=this.stats.maxHp;
    if(this.fx('u_madKing')){this.sf.madKing=Math.min(UNIQUE.u_madKing.max,this.sf.madKing+1);this.sf.madAt=this.clock;}
    if(this.fx('vampiric')){const h=Math.min(dealt*ASPECT.vampiric.share,max*ASPECT.vampiric.cap);if(h>=1)p.hp=Math.min(max,p.hp+h);}
    if(this.boon('leech'))p.hp=Math.min(max,p.hp+dealt*.04);
    if(this.fx('searing')){const A=ASPECT.searing,per=dealt*A.share/(A.dur*4),d=m.dots.find(x=>x.until>this.clock);
      if(d){d.until=this.clock+A.dur;d.dmg=Math.max(d.dmg,per);}else m.dots.push({until:this.clock+A.dur,tick:.25,dmg:per});}
    if(this.fx('arcLightning')&&this.rng()<ASPECT.arcLightning.chance){const A=ASPECT.arcLightning;
      this.later(.05,()=>{let from:Vec={x:m.x,y:m.y};const hit=new Set<Monster>([m]);
        for(let j=0;j<A.jumps;j++){const n=this.monsters.filter(x=>x.state!=='dead'&&!hit.has(x)&&dist(x,from)<=A.r).sort((a,b)=>dist(a,from)-dist(b,from))[0];if(!n)break;
          hit.add(n);this.events.push({t:'fx',kind:'chain',x:from.x,y:from.y,tx:n.x,ty:n.y,dur:.25,element:'wind'});
          this.resolveHit(n,{amount:Math.max(1,Math.round(dealt*A.mult)),crit:false,miss:false},{skill:'arcLightning',mult:A.mult,element:'wind',magic:true,derived:true});from={x:n.x,y:n.y};}});}
    if(this.fx('frostNova')&&this.rng()<ASPECT.frostNova.chance){const A=ASPECT.frostNova,at={x:m.x,y:m.y};
      this.events.push({t:'fx',kind:'frost',x:at.x,y:at.y,dur:.5,r:A.r});
      this.later(.05,()=>{for(const n of this.inRadius(at,A.r)){if(!n.def.mvp){n.frozenUntil=this.clock+A.freeze;n.path=[];this.events.push({t:'status',id:n.id,kind:'freeze'});}
        this.resolveHit(n,{amount:Math.max(1,Math.round(dealt*A.mult)),crit:false,miss:false},{skill:'frostNova',mult:A.mult,element:'water',magic:true,derived:true});}});}
    if(this.fx('critStorm')&&crit&&this.rng()<ASPECT.critStorm.chance)this.later(.1,()=>{if(m.state==='dead')return;this.events.push({t:'swing',who:'p',tx:m.x,ty:m.y});
      this.resolveHit(m,{amount:Math.max(1,Math.round(dealt*ASPECT.critStorm.mult)),crit:true,miss:false},{skill:'critStorm',mult:ASPECT.critStorm.mult,element:'neutral',magic:false,derived:true});});
  }
  /** Extra drops on 噩夢 and above: 星淵印記, 唯一裝備 (煉獄+) and 星蝕餘燼 during an eclipse. */
  private starfallDrops(m:Monster,drops:{kind:'item'|'card';defId:string;count?:number}[]){
    if(!this.tierActive())return;const t=this.tier,kind=m.def.mvp?'boss':m.elite?.length?'elite':'normal';
    if(t.sigil>0&&this.crng()<STARFALL_DROPS.sigil[kind]*t.sigil)drops.push({kind:'item',defId:'starSigil'});
    if(t.unique>0&&this.crng()<STARFALL_DROPS.unique[kind]*t.unique){
      const pool=Object.values(itemDefs).filter(d=>d.kind==='equip'&&(d as EquipDef).unique&&(d as EquipDef).reqLv<=Math.max(60,this.baseLv+5));
      if(pool.length)drops.push({kind:'item',defId:pool[Math.floor(this.crng()*pool.length)].id});}
    if(this.worldEvent?.kind==='eclipse'&&this.crng()<ECLIPSE.emberChance)drops.push({kind:'item',defId:'eclipseEmber',count:m.elite?.length||m.def.mvp?ECLIPSE.eliteEmbers:1});
  }
  private starfallKill(m:Monster){
    const p=this.player,at={x:m.x,y:m.y};
    if(this.fx('momentum')){const A=ASPECT.momentum;this.sf.momentum=[...this.sf.momentum.filter(t=>t>this.clock),this.clock+A.dur].slice(-A.max);}
    if(this.fx('soulHarvest')&&!p.dead){p.hp=Math.min(this.stats.maxHp,p.hp+this.stats.maxHp*ASPECT.soulHarvest.hp);p.sp=Math.min(this.stats.maxSp,p.sp+ASPECT.soulHarvest.sp);}
    const blast=(share:number,r:number,src:string)=>{const amount=Math.max(1,Math.round(m.maxHp*share));
      this.later(.12,()=>{this.events.push({t:'fx',kind:'explode',x:at.x,y:at.y,dur:.4,r});
        for(const n of this.inRadius(at,r))if(n!==m)this.resolveHit(n,{amount:n.def.mvp?Math.round(amount*.3):amount,crit:false,miss:false},{skill:src,mult:share,element:'neutral',magic:true,derived:true});});};
    if(this.fx('corpseBlast')&&!m.def.mvp)blast(ASPECT.corpseBlast.share,ASPECT.corpseBlast.r,'corpseBlast');
    if(this.boon('nova')&&!m.def.mvp)blast(.25,2.2,'nova');
    if(this.fx('meteorFall')&&this.rng()<ASPECT.meteorFall.chance){const n=this.inRadius(at,ASPECT.meteorFall.r).filter(x=>x!==m)[0];
      if(n){const c={x:n.x,y:n.y};this.events.push({t:'fx',kind:'meteor',x:c.x,y:c.y,dur:.45});
        this.later(.45,()=>{for(const x of this.inRadius(c,1.4))this.starHit(x,ASPECT.meteorFall.mult,'meteorFall','fire');});}}
    if(this.fx('u_ouroboros')){const U=UNIQUE.u_ouroboros;for(const k of Object.keys(p.cooldowns))p.cooldowns[k]-=U.cd;p.sp=Math.min(this.stats.maxSp,p.sp+U.sp);}
    if(this.fx('u_chrono')&&++this.sf.chronoKills>=UNIQUE.u_chrono.kills){const U=UNIQUE.u_chrono;this.sf.chronoKills=0;this.sf.chronoUntil=this.clock+U.freeze;
      this.events.push({t:'fx',kind:'frost',x:p.x,y:p.y,dur:.8,r:U.r},{t:'starfall',kind:'chrono',text:'⏳ 時間停止！'});
      for(const n of this.inRadius(p,U.r)){if(n.def.mvp)n.slowUntil=this.clock+U.freeze;else{n.frozenUntil=this.clock+U.freeze;n.path=[];}}}
    this.challengeKill(m);
  }
  private starfallCast(skill:string,lv:number,cost:number,monsterId:number|null,ground:Vec|null,target:Monster|null){
    const sk=skills[skill],p=this.player;if(!sk.tags.some(t=>t==='melee'||t==='ranged'||t==='magic'))return;
    if(this.fx('spFlow')&&this.rng()<ASPECT.spFlow.refund){p.sp=Math.min(this.stats.maxSp,p.sp+cost);this.events.push({t:'fx',kind:'echo',x:p.x,y:p.y,dur:.4,r:1});}
    if(this.fx('u_ouroboros'))p.hp=Math.min(this.stats.maxHp,p.hp+this.stats.maxHp*UNIQUE.u_ouroboros.hp);
    if(this.fx('orbitBlades'))this.sf.orbitUntil=this.clock+ASPECT.orbitBlades.dur;
    if(this.fx('u_starfall')&&++this.sf.casts>=UNIQUE.u_starfall.every){const U=UNIQUE.u_starfall,c=target?{x:target.x,y:target.y}:ground??{x:p.x,y:p.y};this.sf.casts=0;
      for(let i=0;i<U.meteors;i++){const a=this.crng()*Math.PI*2,r=this.crng()*U.r,hitAt={x:c.x+Math.cos(a)*r,y:c.y+Math.sin(a)*r};
        this.later(.15*i,()=>{this.events.push({t:'fx',kind:'meteor',x:hitAt.x,y:hitAt.y,dur:.45});this.later(.45,()=>{for(const n of this.inRadius(hitAt,1.3))this.starHit(n,U.mult,'u_starfall','fire');});});}}
    // 星影重施: the same skill again for free (never echoes an echo; keeps your own delay and cooldowns).
    if(this.fx('echoCast')&&!this.sf.echoing&&this.rng()<ASPECT.echoCast.chance)this.later(ASPECT.echoCast.delay,()=>{
      if(p.dead)return;const keep={after:p.afterCastUntil,cd:{...p.cooldowns}};this.sf.echoing=true;p.sp+=cost;
      try{this.events.push({t:'fx',kind:'echo',x:p.x,y:p.y,dur:.5,r:1.4});this.execute(skill,lv,monsterId,ground);}finally{this.sf.echoing=false;p.afterCastUntil=keep.after;p.cooldowns=keep.cd;}});
  }
  private starfallHurt(dmg:number,from:Monster|undefined){
    const p=this.player,max=this.stats.maxHp;
    if(this.fx('u_voidHeart'))this.sf.voidStore+=dmg*UNIQUE.u_voidHeart.store;
    if(this.fx('thornAura')&&from&&from.state!=='dead'&&dmg>0){const m=from;this.later(.05,()=>this.resolveHit(m,{amount:Math.max(1,Math.round(dmg*ASPECT.thornAura.share)),crit:false,miss:false},{skill:'thornAura',mult:ASPECT.thornAura.share,element:'neutral',magic:false,derived:true}));}
    if(this.fx('bastion')&&this.clock-this.sf.bastionAt>=ASPECT.bastion.cd&&this.rng()<ASPECT.bastion.chance){this.sf.bastionAt=this.clock;
      p.shields.push({amount:Math.round(max*ASPECT.bastion.shield*this.shieldMult()),until:this.clock+ASPECT.bastion.dur});this.events.push({t:'fx',kind:'ward',x:p.x,y:p.y,dur:1,r:1.2});}
    if(this.sigilHas('vamp')&&from&&from.state!=='dead')from.hp=Math.min(from.maxHp,from.hp+Math.round(dmg*.5));
  }
  /** Lethal damage: 不屈星魂, 鳳凰羽衣 and the 不死鳥 boon each get a chance to keep you standing. */
  private starfallLethal(){
    const p=this.player,max=this.stats.maxHp,c=this.challenge;
    if(this.fx('secondWind')&&this.clock-this.sf.secondWindAt>=ASPECT.secondWind.cd){this.sf.secondWindAt=this.clock;p.hp=Math.round(max*ASPECT.secondWind.hp);
      this.events.push({t:'fx',kind:'ward',x:p.x,y:p.y,dur:1.2,r:1.4},{t:'starfall',kind:'secondWind',text:'✦ 不屈星魂！'});return;}
    if(this.fx('u_phoenix')&&this.clock-this.sf.phoenixAt>=UNIQUE.u_phoenix.cd){const U=UNIQUE.u_phoenix;this.sf.phoenixAt=this.clock;p.hp=max;
      this.events.push({t:'fx',kind:'explode',x:p.x,y:p.y,dur:.8,r:U.r,element:'fire'},{t:'starfall',kind:'phoenix',text:'🔥 鳳凰浴火重生！'});
      for(const n of this.inRadius(p,U.r))this.starHit(n,U.mult,'u_phoenix','fire');return;}
    if(c?.kind==='horde'&&c.boons.includes('phoenix')&&!c.phoenixUsed){c.phoenixUsed=true;p.hp=Math.round(max*.5);
      this.events.push({t:'fx',kind:'ward',x:p.x,y:p.y,dur:1.2,r:1.4},{t:'starfall',kind:'phoenix',text:'🪶 不死鳥：復活了！'});}
  }
  private tickStarfall(){
    const p=this.player;if(p.dead)return;
    if(this.sf.madKing&&this.clock-this.sf.madAt>UNIQUE.u_madKing.reset)this.sf.madKing=0;
    if(this.fx('orbitBlades')&&this.sf.orbitUntil>this.clock&&this.clock>=this.sf.orbitAt){const A=ASPECT.orbitBlades;this.sf.orbitAt=this.clock+A.every;
      const hs=this.inRadius(p,A.r);if(hs.length){this.events.push({t:'fx',kind:'wheel',x:p.x,y:p.y,dur:.3,r:A.r});for(const m of hs)this.starHit(m,A.mult,'orbitBlades');}}
    if(this.fx('u_galaxy')&&this.clock>=this.sf.galaxyAt){const U=UNIQUE.u_galaxy;this.sf.galaxyAt=this.clock+U.every;
      const hs=this.inRadius(p,U.r);if(hs.length){this.events.push({t:'fx',kind:'wheel',x:p.x,y:p.y,dur:.3,r:U.r});for(const m of hs)this.starHit(m,U.mult,'u_galaxy');}}
    if(this.fx('u_voidHeart')&&this.clock>=this.sf.voidAt){const U=UNIQUE.u_voidHeart;this.sf.voidAt=this.clock+U.every;
      if(this.sf.voidStore>=1){const amount=Math.round(this.sf.voidStore*U.mult),hs=this.inRadius(p,U.r);this.sf.voidStore=0;
        if(hs.length){this.events.push({t:'fx',kind:'explode',x:p.x,y:p.y,dur:.4,r:U.r});for(const m of hs)this.resolveHit(m,{amount,crit:false,miss:false},{skill:'u_voidHeart',mult:U.mult,element:'neutral',magic:true,derived:true});}}}
  }

  // ———— 星淵挑戰 (all in the abyss arena) ————
  private readonly arenaCenter={x:24,y:20};
  private arenaScale(m:Monster,L:number,o:{hp?:number;atk?:number;exp?:number}={}){
    const top=Math.max(0,L-82),gap=Math.max(0,L-m.def.level),d=m.def;
    const hp=(1+gap*.05)*(1+top*.06)*(o.hp??1),atk=(1+gap*.025)*(1+top*.035)*(o.atk??1),e=(1+gap*.05)*(o.exp??1);
    m.def={...d,hp:Math.round(d.hp*hp),atk:[Math.round(d.atk[0]*atk),Math.round(d.atk[1]*atk)],def:Math.round(d.def*(1+top*.02)),exp:Math.round(d.exp*e),jexp:Math.round(d.jexp*e),aggressive:true,respawn:1e9};
    m.hp=m.maxHp=m.def.hp;m.summoned=true;
  }
  /** Mode modifiers on a fresh challenge monster (印記 affixes, 圍城 boons). */
  private modeTweak(m:Monster){
    const c=this.challenge,d=m.def;let hp=1,atk=1,speed=1,aspd=1,exp=1;
    if(c?.kind==='sigil'){if(c.affixes.includes('armored'))hp*=1.4;if(c.affixes.includes('frenzy'))atk*=1.3;if(c.affixes.includes('swift'))speed*=1.4;if(c.affixes.includes('bounty'))exp*=1.5;}
    if(c?.kind==='horde'){if(c.boons.includes('greed'))hp*=1.3;if(c.boons.includes('slow')){speed*=.75;aspd*=1.33;}}
    if(hp===1&&atk===1&&speed===1&&aspd===1&&exp===1)return;
    m.def={...d,hp:Math.round(d.hp*hp),atk:[Math.round(d.atk[0]*atk),Math.round(d.atk[1]*atk)],speed:d.speed*speed,aspd:d.aspd*aspd,exp:Math.round(d.exp*exp),jexp:Math.round(d.jexp*exp)};m.hp=m.maxHp=m.def.hp;
  }
  private arenaSpawn(L:number,near:Vec,r0:number,r1:number,elite:number):Monster|null{
    const pool=Object.values(monsters).filter(d=>!d.mvp&&!d.id.startsWith('oath_')&&d.id!=='mimic'&&!d.id.startsWith('exp_')&&d.level<=L+2&&d.level>=Math.min(L,82)-10&&maps2has(d.id));
    const list=pool.length?pool:Object.values(monsters).filter(d=>!d.mvp&&d.level>=70&&maps2has(d.id));const d=list[Math.floor(this.crng()*list.length)];if(!d)return null;
    const m=this.spawn(d.id,{x:6,y:4,w:36,h:32});this.arenaScale(m,L);
    if(this.crng()<elite)this.makeElite(m,[(['swift','tough','fury','vamp','shield','split','burst'] as EliteKind[])[Math.floor(this.crng()*7)]]);
    this.modeTweak(m);this.placeNear(m,near.x,near.y,r0,r1);m.state='chase';return m;
  }
  private arenaBoss(L:number,near:Vec):Monster{
    const bosses=Object.values(monsters).filter(d=>d.mvp&&!d.id.startsWith('oath_')&&d.respawn<86400).sort((x,y)=>Math.abs(x.level-L)-Math.abs(y.level-L));
    const b=bosses[Math.floor(this.crng()*Math.min(3,bosses.length))],m=this.spawn(b.id,{x:6,y:4,w:36,h:32});
    this.arenaScale(m,L,{hp:.8,atk:.9});this.modeTweak(m);this.placeNear(m,near.x,near.y,2,4);m.state='chase';
    this.events.push({t:'fx',kind:'summon',x:m.x,y:m.y,dur:1,r:3});return m;
  }
  private resetArena(){
    for(const m of this.monsters)m.state='dead';this.monsters=[];this.items=[];this.zones=[];this.traps=[];this.chests=[];this.abyss=null;
    const p=this.player,st=this.map.def.start,spot=this.map.grid.nearestWalkable(st.x,st.y)!;Object.assign(p,{x:spot.x+.5,y:spot.y+.5,px:spot.x+.5,py:spot.y+.5,path:[],target:null,pending:null});
  }
  /** Starts a challenge in the arena (call right after the abyss map loads). */
  startChallenge(spec:{kind:'pit';tier:number}|{kind:'horde'}|{kind:'sigil';lv:number;affixes:SigilAffix[]}){
    if(this.map.def.id!=='abyss')return;this.resetArena();const now=this.clock;
    if(spec.kind==='pit'){this.challenge={kind:'pit',tier:spec.tier,level:PIT.level(spec.tier),until:now+PIT.time,progress:0,bossId:null,nextSpawn:now+1,state:'run'};
      this.events.push({t:'challenge',kind:'pit',phase:'start',text:`星淵深坑 第 ${spec.tier} 階：${PIT.time/60} 分鐘內打滿進度，再打倒守衛！`});return;}
    if(spec.kind==='horde'){this.challenge={kind:'horde',level:Math.max(32,this.baseLv-14),wave:1,phase:'fight',until:now+HORDE.waveTime,nextSpawn:now+1,embers:0,boons:[],offer:[],phoenixUsed:false,stormAt:0,aegisAt:0,bossId:null};
      this.events.push({t:'challenge',kind:'horde',phase:'start',text:`星潮圍城：撐過 ${HORDE.waves} 波！每波之間選一個祝福。`});return;}
    this.challenge={kind:'sigil',lv:spec.lv,level:SIGIL.level(spec.lv),room:1,affixes:spec.affixes,bossId:null,lavaAt:now+5,state:'run'};this.sigilRoom();
    this.events.push({t:'challenge',kind:'sigil',phase:'start',text:`印記地城 等級 ${spec.lv}：清空 ${SIGIL.rooms} 個房間，再打倒守護者！`});
  }
  private sigilRoom(){const c=this.challenge;if(c?.kind!=='sigil')return;for(let i=0;i<SIGIL.roomSize(c.room);i++)this.arenaSpawn(c.level,this.arenaCenter,2,11,.2);}
  /** 星潮圍城: take one of the offered boons and start the next wave. */
  hordeChoose(b:BoonId){const c=this.challenge;if(c?.kind!=='horde'||c.phase!=='choose'||!c.offer.includes(b))return false;
    c.boons.push(b);c.offer=[];c.wave++;c.phase='fight';c.until=this.clock+HORDE.waveTime;c.nextSpawn=this.clock+1;
    this.events.push({t:'challenge',kind:'horde',phase:'wave',text:`第 ${c.wave} 波！`});return true;}
  leaveChallenge(){this.challenge=null;}
  private challengeEnd(won:boolean,text:string){const c=this.challenge;if(!c)return;
    if(c.kind==='horde')c.phase=won?'won':'lost';else c.state=won?'won':'lost';
    if(won)for(const m of this.monsters)if(m.state!=='dead'){m.state='dead';m.hp=0;}
    this.events.push({t:'challenge',kind:c.kind,phase:won?'won':'lost',text});}
  private challengeDeath(){const c=this.challenge;if(!c)return;const run=c.kind==='horde'?c.phase==='fight'||c.phase==='boss':c.state==='run';
    if(run)this.challengeEnd(false,c.kind==='horde'?`圍城在第 ${c.wave} 波結束了。`:'挑戰失敗了。');}
  private challengeKill(m:Monster){
    const c=this.challenge;if(!c)return;
    if(c.kind==='pit'&&c.state==='run'){
      if(m.id===c.bossId){const left=Math.max(0,Math.round(c.until-this.clock));this.challengeEnd(true,`星淵深坑 第 ${c.tier} 階通過！剩 ${left} 秒。`);return;}
      if(c.bossId===null){c.progress=Math.min(PIT.need,c.progress+(m.elite?.length?PIT.elite:1));
        if(c.progress>=PIT.need){c.bossId=this.arenaBoss(c.level+2,this.player).id;this.events.push({t:'challenge',kind:'pit',phase:'boss',text:'深坑守衛出現了！'});}}}
    if(c.kind==='horde'){
      if(c.phase==='boss'&&m.id===c.bossId){this.challengeEnd(true,`星潮圍城完成！收集了 ${Math.floor(c.embers)} 星焰。`);return;}
      c.embers+=(m.elite?.length||m.def.mvp?5:1)*(c.boons.includes('greed')?1.5:1)*(c.boons.includes('swarm')?2:1);}
    if(c.kind==='sigil'&&c.state==='run'){
      if(m.id===c.bossId){this.challengeEnd(true,`印記地城 等級 ${c.lv} 通關！`);return;}
      if(c.affixes.includes('deathburst')&&!m.def.mvp){const at={x:m.x,y:m.y},dmg=m.def.atk[1]*1.2;this.events.push({t:'fx',kind:'warn',x:at.x,y:at.y,dur:1,shape:'circle',r:1.8,element:'fire',attackType:'physical'});
        this.later(1,()=>{this.events.push({t:'fx',kind:'explode',x:at.x,y:at.y,dur:.4,r:1.8,element:'fire'});if(!this.player.dead&&dist(this.player,at)<=1.8)this.damagePlayer(dmg,'deathburst','fire',m);});}}
  }
  private tickChallenge(){
    const c=this.challenge,p=this.player;if(!c||this.map.def.id!=='abyss'||p.dead)return;
    const live=this.monsters.filter(m=>m.state!=='dead');
    if(c.kind==='pit'){if(c.state!=='run')return;
      if(this.clock>=c.until){this.challengeEnd(false,`時間到！星淵深坑第 ${c.tier} 階失敗。`);return;}
      if(c.bossId===null&&live.length<PIT.alive&&this.clock>=c.nextSpawn){c.nextSpawn=this.clock+PIT.every;this.arenaSpawn(c.level,p,5,9,.12+c.tier*.004);}
      return;}
    if(c.kind==='horde'){
      if(c.phase==='fight'){
        if(c.boons.includes('storm')&&this.clock>=c.stormAt){c.stormAt=this.clock+1.5;const n=this.inRadius(p,7);const m=n[Math.floor(this.rng()*n.length)];
          if(m){this.events.push({t:'fx',kind:'thunder',x:m.x,y:m.y,dur:.4,r:1});this.starHit(m,2,'storm','wind');}}
        if(c.boons.includes('aegis')&&this.clock>=c.aegisAt){c.aegisAt=this.clock+10;p.shields.push({amount:Math.round(this.stats.maxHp*.2*this.shieldMult()),until:this.clock+10});this.events.push({t:'fx',kind:'shield',x:p.x,y:p.y,dur:.6});}
        if(this.clock>=c.until){for(const m of live){m.state='dead';m.hp=0;this.events.push({t:'fx',kind:'summon',x:m.x,y:m.y,dur:.4,r:.8});}
          if(c.wave>=HORDE.waves){c.phase='boss';c.bossId=this.arenaBoss(c.level+c.wave+3,p).id;this.events.push({t:'challenge',kind:'horde',phase:'boss',text:'星潮之主降臨了！打倒牠就完成圍城！'});}
          else{c.phase='choose';// Only 星火之怒 stacks; every other boon is offered once.
            const pool=BOON_IDS.filter(b=>b==='fury'||!c.boons.includes(b)),offer:BoonId[]=[];
            while(offer.length<3&&pool.length)offer.push(pool.splice(Math.floor(this.crng()*pool.length),1)[0]);c.offer=offer;
            this.events.push({t:'challenge',kind:'horde',phase:'choose',text:`第 ${c.wave} 波撐過了！選一個祝福。`});}
          return;}
        const swarm=c.boons.includes('swarm'),cap=Math.round(HORDE.cap(c.wave)*(swarm?1.5:1));
        if(live.length<cap&&this.clock>=c.nextSpawn){c.nextSpawn=this.clock+HORDE.spawnEvery(c.wave)*(swarm?.67:1);this.arenaSpawn(c.level+Math.round(c.wave*1.5),p,6,9,.06+c.wave*.02);}}
      return;}
    if(c.state!=='run')return;
    if(c.affixes.includes('lava')&&this.clock>=c.lavaAt){c.lavaAt=this.clock+5;const at={x:p.x,y:p.y};
      this.events.push({t:'fx',kind:'warn',x:at.x,y:at.y,dur:1.2,shape:'circle',r:1.6,element:'fire',attackType:'magic'});
      this.later(1.2,()=>{this.events.push({t:'fx',kind:'explode',x:at.x,y:at.y,dur:.5,r:1.6,element:'fire'});if(!this.player.dead&&dist(this.player,at)<=1.6)this.damagePlayer(this.stats.maxHp*.22,'lava','fire',undefined as unknown as Monster,true);});}
    if(!live.length){
      if(c.room<SIGIL.rooms){c.room++;this.sigilRoom();this.events.push({t:'challenge',kind:'sigil',phase:'room',text:`第 ${c.room} 個房間！`});}
      else if(c.bossId===null){c.bossId=this.arenaBoss(c.level+3,this.arenaCenter).id;this.events.push({t:'challenge',kind:'sigil',phase:'boss',text:'印記守護者出現了！'});}}
  }
  // ———— 星蝕潮汐 ————
  private beginEclipse():boolean{
    if(this.tier.id<2)return false;const now=this.clock;
    for(const m of this.monsters){if(m.state==='dead'||m.def.mvp||m.summoned||m.trial||m.preEclipse)continue;const d=m.def;m.preEclipse=d;
      m.def={...d,name:`【星蝕】${d.name}`,hp:Math.round(d.hp*ECLIPSE.hp),atk:[Math.round(d.atk[0]*ECLIPSE.atk),Math.round(d.atk[1]*ECLIPSE.atk)],art:{...d.art,body:'#5a1a3a',accent:'#ff4a6a'}};
      m.maxHp=m.def.hp;m.hp=Math.round(m.hp*ECLIPSE.hp);}
    for(let i=0;i<ECLIPSE.chests;i++){const v=this.chestSpot();if(v)this.chests.push({id:this.chestSerial++,x:v.x,y:v.y,tier:'eclipse',bonus:true});}
    this.worldEvent={kind:'eclipse',started:now,until:now+ECLIPSE.dur,nextAt:now};
    this.events.push({t:'worldEvent',phase:'start',kind:'eclipse',text:`星蝕降臨！魔物變強並掉落星蝕餘燼，收集 ${ECLIPSE.chestCost} 個打開地圖上的星蝕寶箱！`});return true;
  }
  private tickEclipse(e:WorldEventState){
    if(this.clock<e.until)return;
    for(const m of this.monsters)if(m.preEclipse){const d=m.preEclipse;m.preEclipse=undefined;m.def=d;m.maxHp=d.hp;m.hp=Math.min(m.hp,m.maxHp);}
    this.chests=this.chests.filter(c=>c.tier!=='eclipse');
    this.events.push({t:'worldEvent',phase:'success',kind:'eclipse',text:'星蝕退去了，沒打開的星蝕寶箱也跟著消失。'});this.endWorldEvent();
  }
  // ———————————————————————— v6.5 劍士戰魂 ————————————————————————
  private soul(){return this.stats?.soul??null;}
  /** v7.1 戰技騎士: the attack skill used before this one, and when each attack skill was last used. */
  private artPrev={skill:'',at:-9};private artUsed:Record<string,number>={};
  private artVaried(skill:string){return this.soul()==='art'&&!!this.artPrev.skill&&this.artPrev.skill!==skill&&this.clock-this.artPrev.at<4;}
  private guardSeen=-9;private guardDecayAt=0;
  private addGuard(n:number){const p=this.player;p.guard=Math.min(SW.guardMax,p.guard+n);this.guardSeen=this.clock;}
  /** Counter damage: 0.9·ATK plus max-HP (capped at 0.65·ATK so pure HP never wins alone), after the target's DEF. */
  private counterAmount(m:Monster){const d=this.stats,atk=d.atk+d.weaponAtk,raw=SW.rockAtk*atk+Math.min(SW.rockHp*d.maxHp,SW.rockHpCap*atk);
    // v7.2 反擊流: each 守勢 makes every counter stronger.
    const g=this.soul()==='rock'?1+SW.guardAmp*this.player.guard:1;
    return Math.max(1,Math.round(raw*g*(d.derivedMult??1)*(100-m.def.def)/100));}
  /** 反擊流: pull enemies onto you so they keep feeding the counter. */
  private taunt(c:Vec,r:number){for(const m of this.inRadius(c,r)){if(m.def.mvp)continue;m.state='chase';m.path=[];m.aggroAlly=0;m.provoke={until:this.clock+8,def:.1,atk:0};}}
  /** 荊棘徽章: heal 10% of a counter event's damage, at most 3% max HP per event. */
  private thornsHeal(total:number){if(!this.fx('thornsPlus')||total<=0)return;const p=this.player,h=Math.min(Math.round(total*.1),Math.round(this.stats.maxHp*.03));
    if(h>0){p.hp=Math.min(this.stats.maxHp,p.hp+h);this.events.push({t:'heal',x:p.x,y:p.y,amount:h});}}
  private tickSoul(){
    const p=this.player;
    // 守勢 fades slowly once the fighting stops (1 stack every 2 s after 6 s without gaining any).
    if(p.guard>0&&this.clock-this.guardSeen>SW.guardIdle&&this.clock>=this.guardDecayAt){p.guard--;this.guardDecayAt=this.clock+2;}
    if(p.dead||this.clock<p.guardAt)return;
    if(this.soul()!=='rock'||p.guardHits<=0){this.heartCounter();return;}
    // 磐石之魂 counter: one burst per 0.5 s; more hits taken in that window → a stronger burst (up to 3 stacks).
    const n=Math.min(3,p.guardHits);p.guardHits=0;p.guardAt=this.clock+.5;
    const w=p.ward,warded=!!w&&w.until>this.clock&&w.shield.amount>0;
    const strength=(1+.5*(n-1))*(this.fx('thorns')?1.3:1)*(this.fx('thornsPlus')?1.3:1)*(warded?SW.kRockWard:1);let total=0;
    this.events.push({t:'fx',kind:'pulse',x:p.x,y:p.y,dur:.35,r:SW.rockR});
    for(const m of this.inRadius(p,SW.rockR))total+=this.resolveHit(m,{amount:Math.round(this.counterAmount(m)*strength),crit:false,miss:false},{skill:'thorns',mult:strength,element:'neutral',magic:false,derived:true});
    this.thornsHeal(total);this.addGuard(1);if(total>0)this.gainResolve(1);
  }
  /** 岩心 (磐岩大劍／撼岳巨劍): during 鐵壁意志 (any soul), the monster you are fighting is answered every 0.5 s even when it is not hitting you. */
  private heartCounter(){
    const p=this.player,t=p.target;if(!this.fx('stoneheart')||!p.endure||p.endure.until<=this.clock||t?.kind!=='monster')return;
    const m=this.monsters.find(x=>x.id===t.id&&x.state!=='dead');if(!m||dist(m,p)>SW.rockR)return;
    p.guardAt=this.clock+.5;const strength=SW.heart*(this.fx('thorns')?1.3:1)*(this.fx('thornsPlus')?1.3:1);
    this.events.push({t:'fx',kind:'counter',x:p.x,y:p.y,tx:m.x,ty:m.y,dur:.15});
    this.thornsHeal(this.resolveHit(m,{amount:Math.round(this.counterAmount(m)*strength),crit:false,miss:false},{skill:'thorns',mult:strength,element:'neutral',magic:false,derived:true}));
  }
  /** 戰技之魂 變招: a different attack skill right after another sends a sword wave (shared 2.5 s cooldown). */
  private artSwitch(skill:string,at:Vec,hit:(m:Monster,mult:number,o:Partial<HitOpts>&{element:Element;magic:boolean})=>number){
    const p=this.player;if(this.soul()!=='art')return;
    this.artPrev={skill:p.soulLast,at:p.soulLastAt};this.artUsed[skill]=this.clock;
    if(p.soulLast&&p.soulLast!==skill&&this.clock-p.soulLastAt<4&&this.clock>=p.soulProcAt){p.soulProcAt=this.clock+SW.artCd;const c={x:at.x,y:at.y};this.gainResolve(1);
      this.events.push({t:'fx',kind:'cleave',x:p.x,y:p.y,tx:c.x,ty:c.y,dur:.35,r:2});
      this.later(.1,()=>{for(const m of this.inRadius(c,1.8))hit(m,SW.artProc,{element:'neutral',magic:false,derived:true});});}
    p.soulLast=skill;p.soulLastAt=this.clock;
  }
  // ———————————————————————— v6.2 劍士 ————————————————————————
  /** 烈焰附刃: a landed melee hit adds fire (derived), restores a little SP; every few basic hits a fan cleave. */
  private enchantHit(m:Monster,fromSkill:boolean){
    const p=this.player,e=p.enchant;if(!e||e.until<=this.clock||p.dead||this.stats.ranged||this.stats.weaponType==='staff')return;
    if(m.state!=='dead'){const mult=SW.enchantFire(e.lv)*(this.stats.derivedMult??1);this.resolveHit(m,this.physical(m,mult,'fire',30),{skill:'enchant',mult,element:'fire',magic:false,derived:true});}
    if(fromSkill)return;
    p.sp=Math.min(this.stats.maxSp,p.sp+SW.enchantSp);
    // 焰誓騎士: every swing cleaves.
    if(++e.hits<(e.route&&this.stats.job2==='knight'?1:this.blazing()?2:e.route?SW.flameEvery:SW.cleaveEvery))return;e.hits=0;
    // 煉獄大劍: a wider cleave and an extra flame on the main target.
    if(this.fx('infernal')&&m.state!=='dead'){const mm=.4*(this.stats.derivedMult??1);this.resolveHit(m,this.physical(m,mm,'fire',30),{skill:'cleave',mult:mm,element:'fire',magic:false,derived:true});}
    const a=Math.atan2(m.y-p.y,m.x-p.x),R2=SW.cleaveR+(this.fx('infernal')?.6:0)+(this.dragonRider()?.6:0),mult=SW.cleave(e.lv)*(e.route?SW.flameCleave*(this.stats.job2==='knight'?SW.kFlameCleave:1):1)*(this.stats.derivedMult??1);
    this.events.push({t:'fx',kind:'cleave',x:p.x,y:p.y,tx:m.x,ty:m.y,dur:.35,r:R2,element:'fire'});
    // 焰誓騎士 cleaves every swing, but only the enemies around the target (a pack tool, not extra single-target damage).
    const sideOnly=!!e.route&&this.stats.job2==='knight';
    for(const n of this.monsters){if(n.state==='dead'||(sideOnly&&n===m))continue;const d=dist(n,p);if(d>R2)continue;let da=Math.abs(Math.atan2(n.y-p.y,n.x-p.x)-a);if(da>Math.PI)da=Math.PI*2-da;
      if(n===m||da<=Math.PI/3||d<.7)this.resolveHit(n,this.physical(n,mult,'fire',30),{skill:'cleave',mult,element:'fire',magic:false,derived:true});}
    // 烈焰之魂: the cards on 烈焰爆破 (孢子回響、王者脈動…) trigger from the cleave; 王者脈動 does not knock back here.
    if(e.route){const c={x:p.x+Math.cos(a)*1.2,y:p.y+Math.sin(a)*1.2};
      this.areaModules('magnum',c,R2*.8,(n,mm)=>{if(n.state!=='dead')this.resolveHit(n,this.physical(n,mm*(this.stats.derivedMult??1),'fire',30),{skill:'cleave',mult:mm,element:'fire',magic:false,derived:true});},mult,true,true);}
  }

  // ———————————————————————— v6.0 二轉 mechanics ————————————————————————
  /** 曙光破城劍: a big 戰意 spend sends a sideways shockwave (80%, derived). */
  private breakerWave(c:Vec,hit:(m:Monster,mult:number,o:Partial<HitOpts>&{element:Element;magic:boolean})=>number){
    if(!this.fx('breaker'))return;const at={x:c.x,y:c.y};this.events.push({t:'fx',kind:'pulse',x:at.x,y:at.y,dur:.45,r:2.4});
    this.later(.1,()=>{for(const m of this.inRadius(at,2.4))hit(m,.8,{element:'neutral',magic:false,derived:true});});
  }
  private fx(k:import('../data/ascension-items').GearFx){return !!this.stats.gearFx?.includes(k);}
  /** 煉獄大劍 is the upgrade of 熾焰長劍: it keeps the blaze behavior. */
  /** v6.5: a mounted knight's melee skills reach as far as its mounted basic attack (they used to stop short of it). */
  private mountReach(sk:{target:string;tags:string[]}){return sk.target==='enemy'&&sk.tags.includes('melee')&&this.mountedKnight()&&!this.stats.ranged?K.mount.range:0;}
  private blazing(){return this.fx('blaze')||this.fx('infernal');}
  /** 鐵羽披肩: shields from your own skills +10%. */
  private shieldMult(){return (this.fx('shieldUp')?1.1:1)*(1+(this.stats.shieldBonus??0));}
  private talent(k:'starburst'|'aegis'|'echo'){return !!this.stats.talentFx?.includes(k);}
  private aegisAt=-999;
  private inRadius(c:Vec,r:number){return this.monsters.filter(m=>m.state!=='dead'&&dist(m,c)<=r);}
  /** 戰意 (knights only). */
  private gainResolve(n:number){const p=this.player;if(this.stats.job2!=='knight'||n<=0)return;const before=p.resolve;
    if(this.fx('gale')&&this.rng()<.25)n++;p.resolve=Math.min(RESOLVE.max,p.resolve+n);p.resolveAt=this.clock;
    // Each stack gained also restores a little SP: knights live on 戰意, not on a big SP pool.
    // Each stack earned restores a little SP (even at the cap): knights live on 戰意, not on a big SP pool.
    p.sp=Math.min(this.stats.maxSp,p.sp+n*RESOLVE.sp);p.resolveAt=this.clock;
    if(p.resolve!==before)this.events.push({t:'resolve',n:p.resolve});}
  private spendResolve():number{const p=this.player,n=p.resolve;if(n>0){p.resolve=0;this.events.push({t:'resolve',n:0});}
    if(n>0&&this.soul()==='flame'&&p.enchant&&p.enchant.until>this.clock)p.enchant.until=Math.min(this.clock+SW.flameDur,p.enchant.until+SW.kFlameSpend*n);if(n>0&&this.stats.skillLevels.k_training)p.knightNext=this.clock+6;return n;}
  /** 獵物 bonus for the player's ranged damage. */
  private preyMult(m:Monster){const pr=this.prey;return pr&&pr.id===m.id&&pr.until>this.clock?1+RG.mark.dmg(pr.lv):1;}
  /** 鷹眼協獵: a falcon dive on a ranged hit (internal cooldown 0.8 s, derived damage). */
  private falcon(m:Monster){
    const lv=this.stats.skillLevels.r_falcon??0,p=this.player;
    if(!lv||this.stats.job2!=='ranger'||m.state==='dead'||this.clock-p.falconAt<.8||this.rng()>=RG.falcon.chance(lv))return;
    p.falconAt=this.clock;this.events.push({t:'fx',kind:'falcon',x:p.x,y:p.y,tx:m.x,ty:m.y,dur:.32});
    this.later(.32,()=>{if(m.state==='dead')return;const mult=RG.falcon.mult(lv)*(this.stats.derivedMult??1)*this.preyMult(m);
      if(this.resolveHit(m,this.physical(m,mult,'neutral',40),{skill:'falcon',mult,element:'neutral',magic:false,derived:true})>0)p.sp=Math.min(this.stats.maxSp,p.sp+RG.falcon.sp);});
  }
  /** One zone per kind: a new cast replaces the old one (its end bonus never fires). */
  private addZone(kind:Zone['kind'],c:Vec,r:number,dur:number,lv:number,castId:number):Zone{
    for(const z of this.zones)if(z.kind===kind)this.events.push({t:'fxEnd',key:z.id});
    this.zones=this.zones.filter(z=>z.kind!==kind);
    if(this.fx('zoneTime'))dur+=1;
    const z:Zone={id:this.fxKey++,kind,x:c.x,y:c.y,r,until:this.clock+dur,next:this.clock+1,lv,castId,matk:0,pulses:0,echoCast:-1};this.zones.push(z);
    const fx={flame:'flameZone',frost:'frostZone',totem:'totem',quake:'quake'}[kind] as FxKind;
    this.events.push({t:'fx',kind:fx,x:z.x,y:z.y,dur,r,key:z.id});
    return z;
  }
  private zoneHit(skill:string,m:Monster,mult0:number,element:Element,magic:boolean){
    const mult=mult0*this.masteryOf(skill).dmg*(this.stats.derivedMult??1);
    return this.resolveHit(m,magic?this.magical(m,mult,element):this.physical(m,mult,element,30),{skill,mult,element,magic,derived:true});
  }
  private totemPulse(z:Zone,first=false){
    const hits=this.inRadius(z,z.r).sort((a,b)=>dist(a,z)-dist(b,z)||a.id-b.id).slice(0,z.pulses||3);
    for(const m of hits){this.events.push({t:'fx',kind:'chain',x:z.x,y:z.y,tx:m.x,ty:m.y,dur:.25,element:'wind'});
      // The first pulse is the cast itself (modules may trigger); later pulses are derived.
      const dealt=first?this.skillHit('w_totem',m,W.totem.mult(z.lv),'wind',true):this.zoneHit('w_totem',m,W.totem.mult(z.lv),'wind',true);
      if(dealt>0&&!isDead(m))this.es(m).shockUntil=this.clock+LOOP.shock.duration;}
  }
  /** A cast-like hit outside execute (traps, first totem pulse): same multipliers and on-hit modules. */
  private skillHit(skill:string,m:Monster,mult0:number,element:Element,magic:boolean){
    const amp=this.moduleOf(skill,'amplify'),keen=this.moduleOf(skill,'keen'),fatal=this.moduleOf(skill,'fatal'),pierce=this.moduleOf(skill,'pierce');
    const extra={critMult:1.4+(fatal?.3*fatal.coef:0),pierce:pierce?.3*pierce.coef:0},critBonus=keen?15*keen.coef:0,ranged=skills[skill].tags.includes('ranged');
    const mult=mult0*(amp&&element!=='neutral'?1+.15*amp.coef:1)*this.masteryOf(skill).dmg*(this.stats.skillMult??1)*(ranged?this.preyMult(m):1);
    const dealt=this.resolveHit(m,magic?this.magical(m,mult,element,critBonus,extra):this.physical(m,mult,element,30,critBonus,extra),{skill,mult,element,magic});
    if(dealt>0){this.onHitModules(skill,m,dealt,true);if(ranged)this.falcon(m);}
    return dealt;
  }
  private tickSecondJob(){
    const p=this.player,now=this.clock;
    if(p.resolve>0&&now-p.resolveAt>RESOLVE.decayAfter){p.resolve--;p.resolveAt=now-RESOLVE.decayAfter+RESOLVE.decayEvery;this.events.push({t:'resolve',n:p.resolve});}
    if(p.enchant&&(p.enchant.until<=now||p.dead))p.enchant=null;
    if(p.ward&&(p.ward.until<=now||p.ward.shield.amount<=0||p.dead)){this.events.push({t:'fxEnd',key:p.ward.key});p.ward=null;}
    if(this.prey&&(this.prey.until<=now||!this.monsters.some(m=>m.id===this.prey!.id&&m.state!=='dead')))this.prey=null;
    if(!this.zones.length&&!this.traps.length)return;
    for(const z of this.zones){
      if(now<z.next||now>z.until+.01)continue;
      if(z.kind==='totem'){z.next+=2;this.totemPulse(z);continue;}
      z.next+=1;const hits=this.inRadius(z,z.r);if(hits.length)this.events.push({t:'fx',kind:'zoneTick',x:z.x,y:z.y,dur:.4,r:z.r,element:z.kind==='flame'?'fire':z.kind==='frost'?'water':'earth'});
      for(const m of hits){
        if(z.kind==='flame'){this.zoneHit('w_flame',m,W.flame.tick(z.lv),'fire',true);if(!isDead(m)&&(m.el?.burn?.stacks??0)<2)this.addBurn(m,1,z.matk);}
        else if(z.kind==='frost'){if(this.zoneHit('w_frost',m,W.frost.tick(z.lv),'water',true)>0)this.addChill(m,1,z.castId,'w_frost');}
        else{if(this.zoneHit('k_quake',m,K.quake.tick(z.lv),'earth',false)>0&&!isDead(m)){m.slowUntil=Math.max(m.slowUntil,now+1.2);}}
      }
    }
    this.zones=this.zones.filter(z=>{if(z.until<=now){this.events.push({t:'fxEnd',key:z.id});return false;}return true;});
    for(const t of this.traps){if(now<t.armed||t.until<=now)continue;
      const victim=this.monsters.find(m=>m.state!=='dead'&&dist(m,t)<=1.1+(m.def.mvp?m.def.art.scale*.3:0));
      if(!victim)continue;t.until=0;const R2=RG.trap.r+(this.awakened('r_trap')?.8:0),hits=this.inRadius(t,R2);
      this.events.push({t:'fxEnd',key:t.id},{t:'fx',kind:'trapBoom',x:t.x,y:t.y,dur:.5,r:R2});
      for(const m of hits)if(this.skillHit('r_trap',m,RG.trap.mult(t.lv)*(this.fx('binding')?.9:1),'neutral',false)>0&&!isDead(m)){m.slowUntil=Math.max(m.slowUntil,now+3);this.events.push({t:'status',id:m.id,kind:'slow'});}
      this.areaModules('r_trap',t,R2,(m,mult)=>this.zoneHit('r_trap',m,mult,'neutral',false),RG.trap.mult(t.lv),hits.length>0);
    }
    this.traps=this.traps.filter(t=>{if(t.until<=now&&t.until>0)this.events.push({t:'fxEnd',key:t.id});return t.until>now;});
  }

  // ———————————————————————— mage element loops (v4.4) ————————————————————————
  private es(m:Monster){return m.el??=newElementState();}
  /** Expires states and runs burn ticks on a fixed 1 s beat. Returns true if the burn killed it. */
  private tickElements(m:Monster):boolean{
    const e=m.el!,now=this.clock;
    if(e.chill&&e.chill.until<=now)e.chill=null;
    if(e.mark&&e.mark.until<=now)e.mark=null;
    const b=e.burn;if(!b)return false;
    if(now>=b.next&&b.next<=b.until){
      b.next+=LOOP.burn.tick;
      const amount=Math.max(1,Math.round(b.matk*LOOP.burn.perStackPerSec*b.stacks*(100-m.def.mdef)/100));
      m.hp-=amount;m.hitAt=now;this.events.push({t:'dmg',to:'m',id:m.id,x:m.x,y:m.y,amount,element:'fire',src:'burn'});
      if(m.hp<=0){this.kill(m,{skill:'burn',mult:0,element:'fire',magic:true,derived:true},amount);return true;}
    }
    if(b.until<=now)e.burn=null;
    return false;
  }
  /** Average MATK snapshot used by damage-over-time (amplify applied once here). */
  private matkSnapshot(ampMult:number){return (this.stats.matkMin+this.stats.matkMax)/2*ampMult*(this.stats.derivedMult??1);}
  /** 灼燒: adds stacks, refreshes duration, keeps the tick beat running. */
  private addBurn(m:Monster,stacks:number,matk:number){
    if(isDead(m))return;const e=this.es(m),now=this.clock;
    if(!e.burn)e.burn={stacks:0,until:0,next:now+LOOP.burn.tick,matk};
    e.burn.stacks=Math.min(LOOP.burn.maxStacks,e.burn.stacks+stacks);e.burn.until=now+LOOP.burn.duration;e.burn.matk=Math.max(e.burn.matk,matk);
  }
  /** Freeze with protection window; MVPs are immune to control (their loops still work). */
  private tryFreeze(m:Monster,dur:number):boolean{
    if(m.def.mvp||isDead(m))return false;const e=this.es(m);if(this.clock<e.freezeLock)return false;
    m.frozenUntil=Math.max(m.frozenUntil,this.clock+dur);e.freezeLock=this.clock+LOOP.freeze.lockout;m.path=[];
    this.events.push({t:'status',id:m.id,kind:'freeze'});return true;
  }
  /** 寒氣: at 5 stacks they become a 寒冰印記 (consumed), with at most one natural freeze per cast. */
  private addChill(m:Monster,stacks:number,castId:number,skill?:string){
    if(isDead(m))return;const e=this.es(m),now=this.clock;
    const cur=e.chill&&e.chill.until>now?e.chill.stacks:0,total=cur+stacks;
    if(total>=LOOP.chill.maxStacks){
      const fl=skill?this.moduleOf(skill,'frostLinger'):null;
      e.chill=null;e.mark={until:now+LOOP.mark.duration+(fl?1.5*fl.coef:0)};this.events.push({t:'status',id:m.id,kind:'mark'});
      if(e.freezeCast!==castId){e.freezeCast=castId;this.tryFreeze(m,LOOP.freeze.duration);}
    }else e.chill={stacks:total,until:now+LOOP.chill.duration};
  }
  /** Single-target style on-hit modules. Derived hits never trigger these again (no A→B→A loops). */
  private onHitModules(skill:string,m:Monster,dealt:number,isArea:boolean){
    const p=this.player,mods=this.stats.skillModules[skill]??[];
    for(const mod of mods){
      switch(mod.moduleId){
        case 'leech':if(!isArea){const a=Math.round(dealt*.04*mod.coef);if(a>0)this.heal(a,0);}break;
        case 'split':if(!isArea&&m.state!=='dead'){const amount=Math.max(1,Math.round(dealt*.45*mod.coef)),delay=dist(p,m)/18+.1;
          this.events.push({t:'fx',kind:'arrow',x:p.x,y:p.y,tx:m.x,ty:m.y,dur:delay});
          this.later(delay,()=>{if(m.state!=='dead')this.resolveHit(m,{amount,crit:false,miss:false},{skill,mult:.45,element:'neutral',magic:false,derived:true});});}break;
        case 'starfall':if(this.rng()<.12*mod.coef){const amount=Math.max(1,Math.round(dealt*1.5)),c={x:m.x,y:m.y};
          // v5.0: a real meteor streaks down (renderer draws trail + impact); damage lands with it.
          this.events.push({t:'fx',kind:'meteor',x:c.x,y:c.y,dur:.45});
          this.later(.45,()=>{if(m.state!=='dead')this.resolveHit(m,{amount,crit:false,miss:false},{skill,mult:1.5,element:'neutral',magic:true,derived:true});});}break;
        case 'snare':m.slowUntil=this.clock+1.5*mod.coef;this.events.push({t:'status',id:m.id,kind:'slow'});break;
        case 'venom':if(m.state!=='dead'){const per=dealt*.24*mod.coef/4;m.dots=m.dots.filter(d=>d.until>this.clock);
          if(m.dots.length)m.dots[0]={until:this.clock+3,tick:m.dots[0].tick,dmg:Math.max(m.dots[0].dmg,per)};else m.dots.push({until:this.clock+3,tick:.25,dmg:per});
          this.events.push({t:'fx',kind:'venom',x:m.x,y:m.y,dur:.5});}break;
        case 'root':if(isArea&&!m.def.mvp){m.rootUntil=this.clock+mod.coef;this.events.push({t:'status',id:m.id,kind:'root'});}break;
        case 'frostbite':if(!m.def.mvp&&m.state!=='dead'&&this.rng()<.2*mod.coef)this.tryFreeze(m,1.5);break;
        case 'quake':if(!m.def.mvp&&m.state!=='dead'&&this.rng()<.25*mod.coef){m.stunUntil=this.clock+1;this.events.push({t:'status',id:m.id,kind:'stun'});}break;
        case 'preyHunt':if(this.prey?.id===m.id&&this.clock-this.preyHuntAt>=.5&&m.state!=='dead'){this.preyHuntAt=this.clock;const amount=Math.max(1,Math.round(dealt*.45*mod.coef)),delay=dist(p,m)/20+.08;
          this.events.push({t:'fx',kind:'arrow',x:p.x,y:p.y,tx:m.x,ty:m.y,dur:delay});
          this.later(delay,()=>{if(m.state!=='dead')this.resolveHit(m,{amount,crit:false,miss:false},{skill,mult:.45,element:'neutral',magic:false,derived:true});});}break;
        case 'tideGuard':if(this.clock-this.tideGuardAt>=8){this.tideGuardAt=this.clock;p.shields.push({amount:Math.round(this.stats.maxHp*.025*mod.coef*this.shieldMult()),until:this.clock+4});
          this.events.push({t:'fx',kind:'shield',x:p.x,y:p.y,dur:.6});}break;
        case 'chain':if(!isArea){const next=this.monsters.filter(n=>n!==m&&n.state!=='dead'&&dist(n,m)<=3).sort((a,b)=>dist(a,m)-dist(b,m))[0];
          if(next){this.events.push({t:'fx',kind:'chain',x:m.x,y:m.y,tx:next.x,ty:next.y,dur:.25});
            this.resolveHit(next,{amount:Math.max(1,Math.round(dealt*.5*mod.coef)),crit:false,miss:false},{skill,mult:.5,element:'neutral',magic:false,derived:true});}}break;
      }
    }
    void p;
  }
  /** Area modules: echo and pulse replay the area once; they are derived and never chain further. */
  private areaModules(skill:string,c:Vec,r:number,hit:(m:Monster,mult:number)=>void,mult:number,any:boolean,noKnock=false){
    if(!any)return;
    const echo=this.moduleOf(skill,'echo'),pulse=this.moduleOf(skill,'pulse'),blade=this.moduleOf(skill,'starBlade');
    // v6.0 星誓殘光: a melee area cast that catches 2+ enemies sends one shockwave.
    if(blade&&this.inRadius(c,r).length>=2)this.later(.15,()=>{this.events.push({t:'fx',kind:'pulse',x:c.x,y:c.y,dur:.4,r:r*1.1});
      for(const m of this.inRadius(c,r*1.1))hit(m,mult*.4*blade.coef);});
    if(echo)this.later(.4,()=>{this.events.push({t:'fx',kind:'echo',x:c.x,y:c.y,dur:.45,r});
      for(const m of this.monsters)if(m.state!=='dead'&&dist(m,c)<=r)hit(m,mult*.4*echo.coef);});
    if(pulse)this.later(.5,()=>{const pr=r*1.4;this.events.push({t:'fx',kind:'pulse',x:c.x,y:c.y,dur:.5,r:pr});
      for(const m of this.monsters)if(m.state!=='dead'&&dist(m,c)<=pr){hit(m,mult*.3*pulse.coef);
        if(!noKnock&&!isDead(m)&&!m.def.mvp){const d=dist(c,m)||1;m.knock={vx:(m.x-c.x)/d*1.5/.2,vy:(m.y-c.y)/d*1.5/.2,t:.2};}}});
  }

  /** MVP moves: a telegraphed slam on the player's spot (step out to dodge) and one summon at half HP. No invulnerability (Q02). */
  private mvpSpecials(m:Monster,dp:number){
    if((m.slamTimer-=H)<=0&&dp<9){
      m.slamTimer=8;
      if(m.def.id==='iceColossus'){
        const origin={x:m.x,y:m.y},angle=Math.atan2(this.player.y-m.y,this.player.x-m.x),length=6,r=1.25,warn=1.3;
        const shape={shape:'line' as const,angle,length,r,element:'water' as Element,attackType:'physical' as const};
        this.events.push({t:'fx',kind:'warn',...origin,dur:warn,...shape});
        this.later(warn,()=>{if(m.state==='dead')return;this.events.push({t:'fx',kind:'slam',...origin,dur:.5,...shape});
          const dx=this.player.x-origin.x,dy=this.player.y-origin.y,along=dx*Math.cos(angle)+dy*Math.sin(angle),side=-dx*Math.sin(angle)+dy*Math.cos(angle);
          if(along>=0&&along<=length&&Math.abs(side)<=r)this.damagePlayer(m.def.atk[1]*1.8,m.def.id,'water',m);});
      }else if(m.def.id==='forgeMaster'){
        // 熔爐總監: a three-line hammer fan toward you — step sideways out of all three.
        const origin={x:m.x,y:m.y},a0=Math.atan2(this.player.y-m.y,this.player.x-m.x),length=6.5,r=.9,warn=1.3;
        for(const da of [-.5,0,.5])this.events.push({t:'fx',kind:'warn',...origin,dur:warn,shape:'line',angle:a0+da,length,r,element:'fire',attackType:'physical'});
        this.later(warn,()=>{if(m.state==='dead')return;let hitP=false;
          for(const da of [-.5,0,.5]){const angle=a0+da;this.events.push({t:'fx',kind:'slam',...origin,dur:.5,shape:'line',angle,length,r,attackType:'physical'});
            const dx=this.player.x-origin.x,dy=this.player.y-origin.y,along=dx*Math.cos(angle)+dy*Math.sin(angle),side=-dx*Math.sin(angle)+dy*Math.cos(angle);
            if(along>=0&&along<=length&&Math.abs(side)<=r)hitP=true;}
          if(hitP&&!this.player.dead)this.damagePlayer(m.def.atk[1]*1.5,m.def.id,'fire',m);});
      }else if(m.def.id==='bellTuner'){
        // 星鐘調律者: three bell strikes in a row across your position, one after another.
        const c={x:this.player.x,y:this.player.y},a=this.rng()*Math.PI,r=1.5,warn=1.4;
        [-2.6,0,2.6].forEach((o,i)=>{const center={x:c.x+Math.cos(a)*o,y:c.y+Math.sin(a)*o},shape={shape:'circle' as const,r,element:'wind' as Element,attackType:'magic' as const};
          this.events.push({t:'fx',kind:'warn',...center,dur:warn+i*.3,...shape});
          this.later(warn+i*.3,()=>{if(m.state==='dead')return;this.events.push({t:'fx',kind:'thunder',x:center.x,y:center.y,dur:.05,element:'wind'},{t:'fx',kind:'slam',...center,dur:.4,...shape});
            if(!this.player.dead&&dist(this.player,center)<=r)this.damagePlayer(m.def.atk[1]*1.2,m.def.id,'wind',m,true);});});
      }else if(m.def.id==='tideQueen'){
        // 潮歌貝后: a song wave all around her — get out of the ring (or tank it).
        const c={x:m.x,y:m.y},r=3.6,warn=1.7,shape={shape:'circle' as const,r,element:'water' as Element,attackType:'magic' as const};
        this.events.push({t:'fx',kind:'warn',...c,dur:warn,...shape});
        this.later(warn,()=>{if(m.state==='dead')return;this.events.push({t:'fx',kind:'slam',...c,dur:.5,...shape},{t:'fx',kind:'pulse',x:c.x,y:c.y,dur:.6,r:r});
          if(!this.player.dead&&dist(this.player,c)<=r)this.damagePlayer(m.def.atk[1]*1.4,m.def.id,'water',m,true);});
      }else if(m.def.id==='starIdol'){
        // 星落: five meteors around the player; each circle is telegraphed and can be dodged.
        const c={x:this.player.x,y:this.player.y},r=1.4,warn=1.6;
        const centers=[c,...[0,1,2,3].map(i=>{const a=i/4*Math.PI*2+this.rng()*.6,d=2+this.rng()*1.2;return {x:c.x+Math.cos(a)*d,y:c.y+Math.sin(a)*d};})];
        centers.forEach((center,i)=>{const shape={shape:'circle' as const,r,element:'neutral' as Element,attackType:'magic' as const};
          this.events.push({t:'fx',kind:'warn',...center,dur:warn+i*.15,...shape});
          this.later(warn+i*.15,()=>{if(m.state==='dead')return;this.events.push({t:'fx',kind:'bolt',x:center.x,y:center.y,dur:.05,element:'wind'});this.events.push({t:'fx',kind:'slam',...center,dur:.5,...shape});
            if(!this.player.dead&&dist(this.player,center)<=r)this.damagePlayer(m.def.atk[1]*1.1,m.def.id,'neutral',m,true);});});
      }else{
        const c={x:this.player.x,y:this.player.y},tree=m.def.id==='forestLord',r=tree?1.35:2.2,warn=tree?1.5:1.3;
        const centers=tree?[c,{x:c.x+2.6,y:c.y},{x:c.x-1.3,y:c.y+2.25}]:[c];
        for(const center of centers){const shape={shape:'circle' as const,r,element:(tree?'earth':'water') as Element,attackType:(tree?'magic':'physical') as 'magic'|'physical'};
          this.events.push({t:'fx',kind:'warn',...center,dur:warn,...shape});
          this.later(warn,()=>{if(m.state==='dead')return;
            if(!tree&&this.map.grid.free(c.x,c.y)){m.x=c.x;m.y=c.y;m.px=c.x;m.py=c.y;m.path=[];}
            this.events.push({t:'fx',kind:'slam',...center,dur:.5,...shape});
            if(!this.player.dead&&dist(this.player,center)<=r)this.damagePlayer(m.def.atk[1]*(tree?1.25:1.6),m.def.id,shape.element,m,tree);});}
      }
    }
    if(!m.summonedOnce&&m.hp<m.maxHp*.5){
      m.summonedOnce=true;
      const kind:Record<string,string>={jellyKing:'jelly',forestLord:'bee',iceColossus:'bat',starIdol:'windWisp',vaultWarden:'iceFox',mistQueen:'mistBee',lavaColossus:'flameBat',skyKing:'stormChick',astralLord:'voidBat',forgeMaster:'cinderJelly',bellTuner:'beatSprite',tideQueen:'bubbleJelly'};const minion=kind[m.def.id];if(!minion)return;
      this.events.push({t:'fx',kind:'summon',x:m.x,y:m.y,dur:.8,r:2.5});
      for(let i=0;i<4;i++){
        const a=i/4*Math.PI*2,x=m.x+Math.cos(a)*1.8,y=m.y+Math.sin(a)*1.8;if(!this.map.grid.free(x,y))continue;
        const n=this.spawn(minion,m.area);Object.assign(n,{x,y,px:x,py:y,home:{x,y},state:'chase',summoned:true});
      }
    }
  }
  /** v6.0 monster behaviours. Returns true while the monster is busy winding up (it does not move or attack). */
  private monsterTrait(m:Monster,dp:number):boolean{
    const now=this.clock,p=this.player;
    if((m.busyUntil??0)>now)return true;
    switch(m.def.trait){
      case 'bomb':
        if(!m.bombed&&m.hp<m.maxHp*.3){m.bombed=true;m.bombAt=now+1.3;m.busyUntil=now+1.3;m.path=[];
          this.events.push({t:'fx',kind:'warn',x:m.x,y:m.y,dur:1.3,shape:'circle',r:1.8,element:'fire',attackType:'physical'});
          this.later(1.3,()=>{if(m.state==='dead')return;this.events.push({t:'fx',kind:'explode',x:m.x,y:m.y,dur:.45,r:1.8,element:'fire'});
            if(!p.dead&&dist(p,m)<=1.8)this.damagePlayer(m.def.atk[1]*1.6,m.def.id,m.def.element,m);});return true;}
        return false;
      case 'shield':{
        if((m.traitAt??0)>now)return false;m.traitAt=now+6;
        const ally=this.monsters.filter(n=>n!==m&&n.state!=='dead'&&dist(n,m)<5).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0];
        if(ally){ally.shield=Math.max(ally.shield??0,Math.round(ally.maxHp*.15));this.events.push({t:'fx',kind:'shield',x:ally.x,y:ally.y,dur:.6},{t:'fx',kind:'chain',x:m.x,y:m.y,tx:ally.x,ty:ally.y,dur:.3,element:'fire'});}
        return false;}
      case 'heal':{
        if((m.traitAt??0)>now)return false;m.traitAt=now+6;
        const hurt=this.monsters.filter(n=>n.state!=='dead'&&n.hp<n.maxHp&&dist(n,m)<4);
        if(hurt.length){this.events.push({t:'fx',kind:'heal',x:m.x,y:m.y,dur:.6});for(const n of hurt){const a=Math.round(n.maxHp*(n.def.mvp?.004:.08));n.hp=Math.min(n.maxHp,n.hp+a);}}
        return false;}
      case 'charge':{
        if((m.traitAt??0)>now||dp<2.5||dp>7||m.rootUntil>now)return false;m.traitAt=now+7;
        const from={x:m.x,y:m.y},a=Math.atan2(p.y-m.y,p.x-m.x),len=Math.min(dp+1.2,7.5),warn=.8;
        m.busyUntil=now+warn+.2;m.path=[];
        this.events.push({t:'fx',kind:'warn',x:from.x,y:from.y,dur:warn,shape:'line',angle:a,length:len,r:.8,element:m.def.attackElement,attackType:'physical'});
        this.later(warn,()=>{if(m.state==='dead')return;let reach=0;for(let t=.25;t<=len;t+=.25){if(!this.map.grid.free(from.x+Math.cos(a)*t,from.y+Math.sin(a)*t))break;reach=t;}
          m.x=from.x+Math.cos(a)*reach;m.y=from.y+Math.sin(a)*reach;
          this.events.push({t:'fx',kind:'slam',x:from.x,y:from.y,dur:.4,shape:'line',angle:a,length:reach,r:.8,attackType:'physical'});
          const dx=p.x-from.x,dy=p.y-from.y,along=dx*Math.cos(a)+dy*Math.sin(a),side=-dx*Math.sin(a)+dy*Math.cos(a);
          if(!p.dead&&along>=0&&along<=reach+.5&&Math.abs(side)<=.9)this.damagePlayer(m.def.atk[1]*1.3,m.def.id,m.def.attackElement,m);});
        return true;}
    }
    return false;
  }
  // ———————————————————————— monsters ————————————————————————
  private monstersAct(){
    const p=this.player,grid=this.map.grid;
    for(const m of this.monsters){
      if(m.state==='dead'){
        if(m.summoned){continue;}
        if((m.respawnTimer-=H)<=0){Object.assign(m,{hp:m.maxHp,state:'idle',path:[],dots:[],provoke:null,slowUntil:0,rootUntil:0,frozenUntil:0,stunUntil:0,knock:null,slamTimer:6,summonedOnce:false,el:undefined,shield:0,bombAt:0,bombed:false,traitAt:0,busyUntil:0});this.maybeElite(m);this.placeMonster(m);if(m.def.mvp)delete this.mvpDeadlines[`${this.map.def.id}:${m.def.id}`];if(m.def.mvp)this.events.push({t:'mvpSpawn',monster:m.def.id,map:this.map.def.name});}
        continue;
      }
      // Poison ticks are not hits: they never trigger modules.
      for(const d of m.dots){if(d.until<this.clock)continue;if((d.tick-=H)<=0){d.tick+=.25;
        const amount=Math.max(1,Math.round(d.dmg));m.hp-=amount;this.events.push({t:'dmg',to:'m',id:m.id,x:m.x,y:m.y,amount,element:'neutral',src:'venom'});
        if(m.hp<=0){this.kill(m,{skill:'venom',mult:0,element:'neutral',magic:false,derived:true},amount);break;}}}
      if(isDead(m))continue;
      if(m.el&&this.tickElements(m))continue;
      if(m.provoke&&m.provoke.until<this.clock)m.provoke=null;
      if(m.knock){const k=m.knock,nx=m.x+k.vx*H,ny=m.y+k.vy*H;if(grid.free(nx,ny)){m.x=nx;m.y=ny;}k.t-=H;if(k.t<=0)m.knock=null;continue;}
      if(m.frozenUntil>this.clock||m.stunUntil>this.clock)continue;
      const playerHere=!p.dead&&!this.inTown;
      const dp=dist(m,p);
      // Companion aggro: taunted or hit by the mercenary, the monster fights it instead.
      const ally=this.ally&&!this.ally.dead&&!this.inTown&&(m.aggroAlly??0)>this.clock?this.ally:null;
      const foe:Vec=ally??p,df=ally?dist(m,ally):dp;
      if(m.state==='idle'&&playerHere&&m.def.aggressive&&dp<(m.def.mvp?7:5.5))m.state='chase';
      if(m.state==='chase'&&(!playerHere||(dp>15&&!m.invasion))&&!ally){m.state='idle';m.path=[];m.wanderTimer=1+this.rng()*2;}
      let goal:Vec|null=null;
      if(m.state==='chase'&&m.def.mvp&&playerHere)this.mvpSpecials(m,dp);
      if(m.def.trait&&m.state==='chase'&&playerHere&&this.monsterTrait(m,dp))continue;
      if(m.elite?.includes('shield')&&m.state==='chase'&&(m.eliteAt??0)<=this.clock){m.eliteAt=this.clock+8;m.shield=Math.max(m.shield??0,Math.round(m.maxHp*.2));this.events.push({t:'fx',kind:'shield',x:m.x,y:m.y,dur:.6});}
      if(m.state==='chase'){
        if(df<=m.def.range+.15){m.path=[];m.facing=this.faceTo(m,foe);
          if(this.clock>=m.attackTimer){m.attackTimer=this.clock+m.def.aspd;if(ally)this.hurtAlly(m);else this.hurtPlayer(m);}
          continue;}
        if(m.attackTimer<this.clock+.3)m.attackTimer=this.clock+.3;
        goal=foe;
      }else if((m.wanderTimer-=H)<=0){
        m.wanderTimer=3+this.rng()*5;
        const tx=clamp(m.home.x+(this.rng()-.5)*8,1,this.map.w-2),ty=clamp(m.home.y+(this.rng()-.5)*8,1,this.map.h-2);
        if(grid.free(tx,ty)){m.pathGoal={x:tx,y:ty};const cells=grid.findPath(m.x,m.y,tx,ty,600);m.path=cells?grid.smoothPath(m.x,m.y,cells):[];}
      }
      if(goal){
        m.pathTimer-=H;
        if((m.pathTimer<=0||!m.path.length)&&this.pathBudget>0){
          this.pathBudget--;m.pathTimer=.45;
          const cells=grid.findPath(m.x,m.y,goal.x,goal.y,1500);m.path=cells?grid.smoothPath(m.x,m.y,cells):[];
        }
      }
      if(m.rootUntil>this.clock||!m.path.length)continue;
      const chill=m.el?.chill&&m.el.chill.until>this.clock?m.el.chill.stacks:0;
      let budget=m.def.speed*(m.state==='idle'?.6:1)*(m.slowUntil>this.clock?.6:1)*(1-LOOP.chill.slowPerStack*chill)*H;
      while(budget>0&&m.path.length){
        const wp=m.path[0],d=dist(m,wp);
        if(goal&&dist(m,goal)<=m.def.range){m.path=[];break;}
        if(d<=budget){m.x=wp.x;m.y=wp.y;m.path.shift();budget-=d;}
        else{m.x+=(wp.x-m.x)/d*budget;m.y+=(wp.y-m.y)/d*budget;budget=0;m.facing=this.faceTo(m,wp);}
      }
    }
    this.monsters=this.monsters.filter(m=>!(m.summoned&&m.state==='dead'&&this.clock-m.deadAt>1));
    // Gentle separation so a pack reads as several monsters instead of one sprite.
    const live=this.monsters.filter(m=>m.state!=='dead');
    for(let i=0;i<live.length;i++)for(let j=i+1;j<live.length;j++){
      const a=live[i],b=live[j],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy),min=.55*(a.def.art.scale+b.def.art.scale)/2;
      if(d>0&&d<min){const push=(min-d)/2*.5,ux=dx/d,uy=dy/d;
        if(grid.free(a.x-ux*push,a.y-uy*push)){a.x-=ux*push;a.y-=uy*push;}
        if(grid.free(b.x+ux*push,b.y+uy*push)){b.x+=ux*push;b.y+=uy*push;}}
    }
  }
}
export const mapName=(id:string)=>maps[id]?.name??id;
