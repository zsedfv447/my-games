// v4.6 exploration rules: chest loot, exploration records and repeatable bounties. Pure functions on GameState.
import { rollQuality, rollEquip, type Quality } from './affix';
import { maps } from '../data/maps';
import { monsters } from '../data/monsters';
import { items, cards } from '../data/items';
import { CHEST_POOLS, MAP_TIER, BOUNTY, TRIALS, type ChestTier, type LootTier } from '../data/explore';
import { addItem, addCard, gainExp, type GameState, type ExpResult } from './state';

export type ChestLoot={zeny:number;items:Record<string,number>;card:string|null};
export type ExploreRecord={chests:Record<LootTier,number>;trials:Record<string,number>;bounties:number;found:string[]};
export const emptyExplore=():ExploreRecord=>({chests:{normal:0,rare:0,trial:0,supply:0},trials:{},bounties:0,found:[]});

const localMonsters=(map:string)=>[...new Set((maps[map]?.spawns??[]).map(s=>s.monster))].filter(id=>monsters[id]&&!monsters[id].mvp);
const pick=<T,>(list:T[],r:()=>number)=>list[Math.floor(r()*list.length)%list.length];

/** Rolls the contents of a chest. `r` is any 0..1 random source (Math.random in game, seeded in tests). */
export function rollChest(map:string,tier:LootTier,r:()=>number,eliteId?:string):ChestLoot{
  const lv=MAP_TIER[map]??6,pool=CHEST_POOLS[map]??CHEST_POOLS.meadow,local=localMonsters(map),out:ChestLoot={zeny:0,items:{},card:null};
  const add=(id:string,n:number)=>{if(items[id])out.items[id]=(out.items[id]??0)+n;};
  const drops=(kind:'etc'|'equip')=>local.flatMap(id=>monsters[id].drops.map(d=>d.item)).filter(id=>items[id]?.kind===kind);
  const zMul={normal:1,supply:.6,rare:4,trial:6}[tier];
  out.zeny=Math.round(lv*(14+r()*10)*zMul);
  if(tier==='supply'){add(pick(pool.food,r),2);add(pick(pool.use,r),2);return out;}
  add(pick(pool.use,r),tier==='normal'?1:tier==='rare'?2:3);
  if(r()<(tier==='normal'?.5:1))add(pick(pool.food,r),tier==='trial'?3:1+Math.floor(r()*2));
  const mats=drops('etc');if(mats.length&&r()<.6)add(pick(mats,r),1+Math.floor(r()*3));
  const equips=eliteId?monsters[eliteId].drops.map(d=>d.item).filter(id=>items[id]?.kind==='equip'):[];
  const gear=equips.length?equips:drops('equip');
  if(gear.length&&r()<(tier==='trial'?1:tier==='rare'?.35:.03))add(pick(gear,r),1);
  if(tier==='trial')add('trialSigil',2+Math.floor(r()*2));
  const cardFrom=eliteId?[eliteId]:local;const cardChance=tier==='trial'?.25:tier==='rare'?.06:0;
  if(cardChance&&r()<cardChance){const c=monsters[pick(cardFrom,r)].card;if(c&&cards[c])out.card=c;}
  return out;
}
/** v6.3: gear from a chest rolls a quality too — trial chests never give plain gear, rare chests roll better. */
export function openChest(s0:GameState,loot:ChestLoot,tier:LootTier,r:()=>number=Math.random):GameState{
  let s:GameState={...s0,char:{...s0.char,zeny:s0.char.zeny+loot.zeny}};
  const bonus={normal:1.5,supply:1,rare:3,trial:4}[tier];
  for(const [id,n] of Object.entries(loot.items)){
    if(items[id]?.kind!=='equip'){s=addItem(s,id,n);continue;}
    for(let i=0;i<n;i++){const q=Math.max(tier==='trial'?1:0,rollQuality(r(),bonus)) as Quality;s=addItem(s,id,1,rollEquip(id,q,r,s.char.job));}}
  if(loot.card)s=addCard(s,loot.card).state;
  const ex=structuredClone(s.explore??emptyExplore());ex.chests[tier]=(ex.chests[tier]??0)+1;
  return {...s,explore:ex};
}
export function noteTrial(s0:GameState,key:string):GameState{
  const ex=structuredClone(s0.explore??emptyExplore());ex.trials[key]=(ex.trials[key]??0)+1;return {...s0,explore:ex};
}
/** First visit to a landmark is recorded for the adventure log. */
export function noteFound(s0:GameState,key:string):GameState{
  if(s0.explore?.found.includes(key))return s0;const ex=structuredClone(s0.explore??emptyExplore());ex.found.push(key);return {...s0,explore:ex};
}
export const trialKeys=Object.keys(TRIALS);

// ———————————— bounties ————————————
export type Bounty={monster:string;count:number;progress:number;zeny:number;exp:number;jexp:number;items:Record<string,number>};
export type BountyState={offers:Bounty[];active:Bounty|null;seed:number;lv?:number};
const seeded=(seed:number)=>{let x=seed>>>0||1;return ()=>{x=(x*1664525+1013904223)>>>0;return x/4294967296;};};
const mapOf=(mid:string)=>Object.entries(maps).find(([,m])=>m.spawns.some(s=>s.monster===mid))?.[0];
export function bountyOffers(baseLv:number,seed:number):Bounty[]{
  const r=seeded(seed*7919+baseLv);
  let pool=Object.values(monsters).filter(m=>!m.mvp&&!m.id.startsWith('exp_')&&mapOf(m.id)&&m.level>=baseLv-BOUNTY.levelBelow&&m.level<=baseLv+BOUNTY.levelAbove);
  if(pool.length<BOUNTY.offers)pool=Object.values(monsters).filter(m=>!m.mvp&&!m.id.startsWith('exp_')&&mapOf(m.id)).sort((a,b)=>Math.abs(a.level-baseLv)-Math.abs(b.level-baseLv)).slice(0,6);
  const out:Bounty[]=[];const used=new Set<string>();
  for(let i=0;i<40&&out.length<BOUNTY.offers;i++){const m=pick(pool,r);if(used.has(m.id))continue;used.add(m.id);
    const count=BOUNTY.minCount+5*Math.floor(r()*((BOUNTY.maxCount-BOUNTY.minCount)/5+1));
    const pool2=CHEST_POOLS[mapOf(m.id)!]??CHEST_POOLS.meadow;
    out.push({monster:m.id,count,progress:0,zeny:Math.round(m.level*count*4),exp:Math.round(m.exp*count*.5),jexp:Math.round(m.jexp*count*.5),items:{[pick(pool2.food,r)]:2,...(m.level>=10?{trialSigil:1}:{})}});}
  return out;
}
export function bountyState(s:GameState):BountyState{
  const b=s.bounty??{offers:bountyOffers(s.char.baseLv,1),active:null,seed:1,lv:s.char.baseLv};
  // Offers follow the player: regenerate when they have outgrown the board by more than 5 levels.
  if(!b.active&&(b.lv===undefined&&s.bounty!==undefined||Math.abs(s.char.baseLv-(b.lv??s.char.baseLv))>5))return {...b,offers:bountyOffers(s.char.baseLv,b.seed+1),seed:b.seed+1,lv:s.char.baseLv};
  return b;
}
export function acceptBounty(s0:GameState,i:number):GameState{
  const b=bountyState(s0);if(b.active)throw new Error('已經有進行中的懸賞');const o=b.offers[i];if(!o)throw new Error('懸賞不存在');
  return {...s0,bounty:{...b,active:{...o,progress:0}}};
}
export function abandonBounty(s0:GameState):GameState{
  const b=bountyState(s0);if(!b.active)return s0;
  return {...s0,bounty:{...b,active:null}}; // the board keeps the same offers: abandoning is not a free reroll
}
export function bountyKill(s0:GameState,monster:string):GameState{
  const b=s0.bounty;if(!b?.active||b.active.monster!==monster||b.active.progress>=b.active.count)return s0;
  return {...s0,bounty:{...b,active:{...b.active,progress:b.active.progress+1}}};
}
export function completeBounty(s0:GameState):ExpResult&{bounty:Bounty}{
  const b=bountyState(s0),a=b.active;if(!a)throw new Error('沒有進行中的懸賞');if(a.progress<a.count)throw new Error('懸賞還沒完成');
  let s:GameState={...s0,char:{...s0.char,zeny:s0.char.zeny+a.zeny}};
  for(const [id,n] of Object.entries(a.items))s=addItem(s,id,n);
  const seed=b.seed+1,ex=structuredClone(s.explore??emptyExplore());ex.bounties++;
  s={...s,explore:ex,bounty:{offers:bountyOffers(s.char.baseLv,seed),active:null,seed,lv:s.char.baseLv}};
  const r=gainExp(s,a.exp,a.jexp);return {...r,bounty:a};
}
export const bountyWhere=(mid:string)=>maps[mapOf(mid)??'']?.name??'';

/** v6.3 星光深淵 chest: gear near the floor's level, never plain; boss floors roll much better and give 星紋核心. */
export function rollAbyssChest(floor:number,boss:boolean,r:()=>number,level:number):ChestLoot{
  const L=Math.min(90,30+floor*2,level+5),out:ChestLoot={zeny:Math.round(L*L*(boss?3:1.2)),items:{},card:null};
  out.items[boss?'whitePotion':'bluePotion']=boss?5:2;
  if(boss&&floor>=20)out.items.oathCore=1+Math.floor(floor/20);
  return out;
}
export function abyssGear(floor:number,boss:boolean,r:()=>number,level:number):string[]{
  const L=Math.min(90,30+floor*2,level+5);
  const pool=Object.values(items).filter(d=>d.kind==='equip'&&d.reqLv<=L&&d.reqLv>=L-18&&d.price>0).map(d=>d.id);
  const n=boss?2:r()<.6?1:0,out:string[]=[];for(let i=0;i<n&&pool.length;i++)out.push(pool[Math.floor(r()*pool.length)]);return out;
}
