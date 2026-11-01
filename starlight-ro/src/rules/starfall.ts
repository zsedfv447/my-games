// v7.0 星淵紀元 rules: 星光難度, the 威能圖鑑 (salvage → learn, imprint), 淬鍊 and challenge records/rewards.
// Pure functions like rules/state.ts: each returns a new state or throws a message for the player.
import type { GameState, Ctx, EquipInst } from './state';
import { items, type EquipDef } from '../data/items';
import { affixPool, affixValue, rollEquip, rollQuality, type Affix, type Quality, type Roll } from './affix';
import { ASPECT_IDS, ASPECT_NAMES, DIFFICULTY, type AspectFx, type DifficultyDef } from '../data/starfall';

export type StarfallState={tier:1|2|3|4;codex:AspectFx[];pitBest:number;hordeBest:number;sigilLv:number;sigilClears:number};
export const emptyStarfall=():StarfallState=>({tier:1,codex:[],pitBest:0,hordeBest:0,sigilLv:1,sigilClears:0});
export const starfallOf=(s:GameState):StarfallState=>({...emptyStarfall(),...(s.starfall??{})});
export const tierOf=(s:GameState)=>DIFFICULTY[(s.starfall?.tier??1)-1];

const fail=(msg:string):never=>{throw new Error(msg);};
const next=(s0:GameState,f:(s:GameState,sf:StarfallState)=>void)=>{const s=structuredClone(s0);const sf=starfallOf(s);f(s,sf);s.starfall=sf;s.revision++;return s;};
const record=(v:unknown):v is Record<string,unknown>=>typeof v==='object'&&v!==null&&!Array.isArray(v);
const int=(v:unknown,min=0,max=1e6)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max;
export function validateStarfall(v:unknown){
  if(!record(v)||![1,2,3,4].includes(v.tier as number)||!Array.isArray(v.codex)||v.codex.some(f=>!ASPECT_IDS.includes(f as AspectFx))||new Set(v.codex).size!==v.codex.length
    ||!int(v.pitBest)||!int(v.hordeBest)||!int(v.sigilLv,1)||!int(v.sigilClears))fail('星淵紀元資料無效');
}

// ———————————————————————— 星光難度 ————————————————————————
export function difficultyBlock(s:GameState,d:DifficultyDef):string|null{
  const sf=starfallOf(s),lv=s.char.baseLv,abyss=s.abyss?.best??0;
  if(d.id===2&&!(lv>=45&&abyss>=10))return `需要 ${d.need}`;
  if(d.id===3&&!(lv>=60&&(sf.pitBest>=10||sf.sigilLv>=8)))return `需要 ${d.need}`;
  if(d.id===4&&!(lv>=75&&(sf.pitBest>=25||sf.hordeBest>=8)))return `需要 ${d.need}`;
  return null;
}
export function setDifficulty(s0:GameState,id:number,ctx:Ctx):GameState{
  const d=DIFFICULTY.find(x=>x.id===id)??fail('未知的難度');if(!ctx.inTown)fail('只有在城鎮才能切換星光難度');
  const why=difficultyBlock(s0,d);if(why)fail(why);
  return next(s0,(_,sf)=>{sf.tier=d.id;});
}

// ———————————————————————— 星淵工坊 ————————————————————————
/** 星塵 from salvaging a piece, by grade (plain → 唯一). */
export const DUST=[1,3,6,12,30];
export function salvageBlock(s:GameState,e:EquipInst|undefined):string|null{
  if(!e)return '裝備不存在';if(e.locked)return '裝備已鎖定';if(Object.values(s.equipped).includes(e.id))return '請先卸下裝備';return null;
}
/** Breaks a piece into 星塵; a 傳說威能 on it is learned into the 威能圖鑑. Cards inside return to the bag. */
export function salvage(s0:GameState,equipId:string):{state:GameState;dust:number;learned:AspectFx|null}{
  const e=s0.equipment.find(x=>x.id===equipId),why=salvageBlock(s0,e);if(why)fail(why);
  let learned:AspectFx|null=null;const dust=DUST[e!.q??0]+(e!.refine??0);
  const state=next(s0,(s,sf)=>{
    for(const c of s.cards)if(c.loc.kind==='equip'&&c.loc.equipId===equipId)c.loc={kind:'bag'};
    s.equipment=s.equipment.filter(x=>x.id!==equipId);s.items.starDust=(s.items.starDust??0)+dust;
    const f=e!.legend as AspectFx|undefined;if(f&&ASPECT_IDS.includes(f)&&!sf.codex.includes(f)){sf.codex.push(f);learned=f;}
  });
  return {state,dust,learned};
}
/** Salvage every unlocked, unworn piece at or below a grade (keeps 唯一 and anything locked). */
export function salvageAll(s0:GameState,maxQ:Quality):{state:GameState;dust:number;learned:AspectFx[];count:number}{
  let s=s0,dust=0,count=0;const learned:AspectFx[]=[];
  for(const e of s0.equipment){if((e.q??0)>maxQ||(e.q??0)>=4||salvageBlock(s,e))continue;const r=salvage(s,e.id);s=r.state;dust+=r.dust;count++;if(r.learned)learned.push(r.learned);}
  return {state:s,dust,learned,count};
}
export const imprintCost=(d:EquipDef)=>({zeny:20000+d.reqLv*600,dust:12});
export function imprintBlock(s:GameState,e:EquipInst|undefined,fx:AspectFx):string|null{
  if(!e)return '裝備不存在';const d=items[e.defId] as EquipDef;
  if(d.unique)return '唯一裝備的力量無法改寫';if((e.q??0)<2)return '只能烙印在稀有或傳說裝備上';
  if(!starfallOf(s).codex.includes(fx))return `威能圖鑑裡還沒有「${ASPECT_NAMES[fx]}」`;
  const c=imprintCost(d);if(s.char.zeny<c.zeny)return `Zeny 不足（需要 ${c.zeny.toLocaleString()}）`;if((s.items.starDust??0)<c.dust)return `星塵不足（需要 ${c.dust}）`;
  return null;
}
/** Writes a learned 威能 onto a 稀有／傳說 piece; a 稀有 piece becomes 傳說 and gains its third affix. */
export function imprint(s0:GameState,equipId:string,fx:AspectFx,r:()=>number):GameState{
  const e0=s0.equipment.find(x=>x.id===equipId),why=imprintBlock(s0,e0,fx);if(why)fail(why);
  return next(s0,s=>{const e=s.equipment.find(x=>x.id===equipId)!,d=items[e.defId] as EquipDef,c=imprintCost(d);
    s.char.zeny-=c.zeny;s.items.starDust-=c.dust;if(!s.items.starDust)delete s.items.starDust;
    if((e.q??0)<3){const have=new Set((e.affix??[]).map(a=>a.k)),pool=affixPool(d).filter(k=>!have.has(k));
      if(pool.length){const k=pool[Math.floor(r()*pool.length)];e.affix=[...(e.affix??[]),{k,v:affixValue(k,d,r())}];}e.q=3;}
    e.legend=fx;});
}
/** 淬鍊: reroll one affix. After the first time only that same affix can be rerolled; each try costs more. */
export const enchantCost=(e:EquipInst)=>{const d=items[e.defId] as EquipDef,n=e.ench?.n??0;return {zeny:Math.round((5000+d.reqLv*200)*(1+n*.5)),dust:3+n};};
export function enchantBlock(s:GameState,e:EquipInst|undefined,idx:number):string|null{
  if(!e)return '裝備不存在';if(!e.affix?.[idx])return '沒有這條詞綴';if((items[e.defId] as EquipDef).unique)return '唯一裝備無法淬鍊';
  if(e.ench&&e.ench.idx!==idx)return '這件裝備只能繼續淬鍊同一條詞綴';
  const c=enchantCost(e);if(s.char.zeny<c.zeny)return `Zeny 不足（需要 ${c.zeny.toLocaleString()}）`;if((s.items.starDust??0)<c.dust)return `星塵不足（需要 ${c.dust}）`;
  return null;
}
export function enchant(s0:GameState,equipId:string,idx:number,r:()=>number):{state:GameState;affix:Affix}{
  const e0=s0.equipment.find(x=>x.id===equipId),why=enchantBlock(s0,e0,idx);if(why)fail(why);let out:Affix|null=null;
  const state=next(s0,s=>{const e=s.equipment.find(x=>x.id===equipId)!,d=items[e.defId] as EquipDef,c=enchantCost(e);
    s.char.zeny-=c.zeny;s.items.starDust-=c.dust;if(!s.items.starDust)delete s.items.starDust;
    const others=new Set(e.affix!.filter((_,i)=>i!==idx).map(a=>a.k)),pool=affixPool(d).filter(k=>!others.has(k));
    const k=pool[Math.floor(r()*pool.length)];out={k,v:affixValue(k,d,Math.min(.999,r()*(.7+.15*(e.q??1))))};
    e.affix=e.affix!.map((a,i)=>i===idx?out!:a);e.ench={idx,n:(e.ench?.n??0)+1};});
  return {state,affix:out!};
}

/** 升階: 普通 → 精良 → 稀有, one new affix each step (稀有 → 傳說 is 烙印). Keeps refine, cards and the item's own effect. */
export const upgradeCost=(e:EquipInst)=>{const d=items[e.defId] as EquipDef,q=e.q??0;return q===0?{zeny:10000+d.reqLv*200,dust:5}:{zeny:30000+d.reqLv*500,dust:15};};
export function upgradeBlock(s:GameState,e:EquipInst|undefined):string|null{
  if(!e)return '裝備不存在';if((items[e.defId] as EquipDef).unique)return '唯一裝備無法升階';if((e.q??0)>=2)return '稀有以上請用「烙印威能」升成傳說';
  const c=upgradeCost(e);if(s.char.zeny<c.zeny)return `Zeny 不足（需要 ${c.zeny.toLocaleString()}）`;if((s.items.starDust??0)<c.dust)return `星塵不足（需要 ${c.dust}）`;return null;
}
export function upgrade(s0:GameState,equipId:string,r:()=>number):GameState{
  const e0=s0.equipment.find(x=>x.id===equipId),why=upgradeBlock(s0,e0);if(why)fail(why);
  return next(s0,s=>{const e=s.equipment.find(x=>x.id===equipId)!,d=items[e.defId] as EquipDef,c=upgradeCost(e);
    s.char.zeny-=c.zeny;s.items.starDust-=c.dust;if(!s.items.starDust)delete s.items.starDust;
    const have=new Set((e.affix??[]).map(a=>a.k)),pool=affixPool(d).filter(k=>!have.has(k));
    if(pool.length){const k=pool[Math.floor(r()*pool.length)];e.affix=[...(e.affix??[]),{k,v:affixValue(k,d,Math.min(.999,.3+r()*.7))}];}
    e.q=((e.q??0)+1) as Quality;});
}
// ———————————————————————— challenges ————————————————————————
export function recordPit(s0:GameState,tier:number):{state:GameState;record:boolean}{
  const record=tier>starfallOf(s0).pitBest;return {state:next(s0,(_,sf)=>{sf.pitBest=Math.max(sf.pitBest,tier);}),record};
}
export function recordHorde(s0:GameState,waves:number):{state:GameState;record:boolean}{
  const record=waves>starfallOf(s0).hordeBest;return {state:next(s0,(_,sf)=>{sf.hordeBest=Math.max(sf.hordeBest,waves);}),record};
}
/** A cleared 印記地城 raises the sigil level and teaches one 威能 you do not know yet. */
export function clearSigil(s0:GameState,r:()=>number):{state:GameState;learned:AspectFx|null}{
  let learned:AspectFx|null=null;
  const state=next(s0,(_,sf)=>{sf.sigilLv=Math.min(100,sf.sigilLv+1);sf.sigilClears++;
    const unknown=ASPECT_IDS.filter(f=>!sf.codex.includes(f));if(unknown.length){learned=unknown[Math.floor(r()*unknown.length)];sf.codex.push(learned);}});
  return {state,learned};
}
export function useSigil(s0:GameState,ctx:Ctx):GameState{
  if(!ctx.inTown)fail('在城鎮的星淵通訊員那裡使用印記');if((s0.items.starSigil??0)<1)fail('沒有星淵印記（噩夢以上難度的菁英與首領會掉）');
  const s=structuredClone(s0);s.items.starSigil--;if(!s.items.starSigil)delete s.items.starSigil;s.revision++;return s;
}
/** Gear for a challenge chest: pieces near `level`, at least `minQ`, with a 唯一 chance on 煉獄／星滅. */
export function challengeGear(level:number,n:number,minQ:Quality,bonus:number,uniqueChance:number,r:()=>number,job:Parameters<typeof rollEquip>[3]):{id:string;roll:Roll}[]{
  const L=Math.min(90,level);
  const pool=Object.values(items).filter((d):d is EquipDef=>d.kind==='equip'&&!d.unique&&d.price>0&&d.reqLv<=L&&d.reqLv>=L-18).map(d=>d.id);
  const uniques=Object.values(items).filter((d):d is EquipDef=>d.kind==='equip'&&!!d.unique&&d.reqLv<=Math.max(60,L+4)).map(d=>d.id);
  const out:{id:string;roll:Roll}[]=[];
  for(let i=0;i<n&&pool.length;i++){
    if(uniques.length&&r()<uniqueChance){const id=uniques[Math.floor(r()*uniques.length)];out.push({id,roll:rollEquip(id,4,r,job)});continue;}
    const id=pool[Math.floor(r()*pool.length)],q=Math.max(minQ,rollQuality(r(),bonus)) as Quality;out.push({id,roll:rollEquip(id,q,r,job)});}
  return out;
}
