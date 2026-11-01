// v6.3 裝備品質與隨機詞綴: the same sword can drop plain, 精良 (1 affix), 稀有 (2) or 傳說 (3 + a build effect).
// Affixes only use stats the game already sums (derive() reads the merged definition), so every system keeps working.
import { items, type EquipDef } from '../data/items';
import { GEAR_FX, type GearFx } from '../data/ascension-items';
import type { JobId } from '../data/jobs';
import { ASPECT_IDS } from '../data/starfall';

export type AffixKey='atk'|'matk'|'def'|'mdef'|'hp'|'sp'|'cast'|'aspd'|'crit'|'delay'|'spCost'|'spRegen'|'loop'|'skill'|'str'|'agi'|'vit'|'int'|'dex'|'luk';
export type Affix={k:AffixKey;v:number};
export type Quality=0|1|2|3|4;
export const QUALITY:{name:string;color:string}[]=[{name:'',color:'#e8eef6'},{name:'精良',color:'#5fb0ff'},{name:'稀有',color:'#ffd23f'},{name:'傳說',color:'#ff8a3d'},{name:'唯一',color:'#e0b25a'}];
export const AFFIX_KEYS:AffixKey[]=['atk','matk','def','mdef','hp','sp','cast','aspd','crit','delay','spCost','spRegen','loop','skill','str','agi','vit','int','dex','luk'];
const STAT_KEYS=['str','agi','vit','int','dex','luk'] as const;
export const affixText=(a:Affix)=>({atk:`ATK +${a.v}`,matk:`MATK +${a.v}%`,def:`DEF +${a.v}`,mdef:`MDEF +${a.v}`,hp:`HP +${a.v}`,sp:`SP +${a.v}`,cast:`詠唱 −${a.v}%`,aspd:`攻速 +${a.v}%`,
  crit:`爆擊 +${a.v}%`,delay:`技能延遲 −${a.v}%`,spCost:`SP 消耗 −${a.v}%`,spRegen:`SP 回復 +${a.v}%`,loop:`追加傷害 +${a.v}%`,skill:`技能傷害 +${a.v}%`,
  str:`STR +${a.v}`,agi:`AGI +${a.v}`,vit:`VIT +${a.v}`,int:`INT +${a.v}`,dex:`DEX +${a.v}`,luk:`LUK +${a.v}`} as Record<AffixKey,string>)[a.k];

/** Which affixes make sense on a piece (weapons get offense, armor defense, accessories a bit of everything). */
export function affixPool(d:EquipDef):AffixKey[]{
  const stats=[...STAT_KEYS] as AffixKey[];
  if(d.slot==='weapon')return d.weaponType==='staff'?['matk','cast','skill','loop','spCost','int','dex','crit']:['atk','crit','aspd','skill','loop','delay',...stats];
  if(d.slot==='armor')return ['def','mdef','hp','sp','spRegen','vit','int','str','dex'];
  if(d.slot==='accessory')return ['hp','sp','cast','aspd','crit','delay','spCost','spRegen','loop','skill',...stats];
  return ['def','mdef','hp','sp','cast','delay','aspd','spCost',...stats];
}
/** r in [0,1): higher r → better roll. Scales gently with the item's level so late gear rolls bigger numbers. */
export function affixValue(k:AffixKey,d:EquipDef,r:number):number{
  const L=Math.max(1,d.reqLv),v=(a:number,b:number)=>Math.max(1,Math.round(a+(b-a)*r));
  switch(k){
    case 'atk':return v(L*.25,L*.6);case 'matk':return v(3+L*.03,6+L*.08);case 'def':return v(1+L*.04,2+L*.09);case 'mdef':return v(2+L*.06,3+L*.14);
    case 'hp':return v(L*2,L*5);case 'sp':return v(L*.6,L*1.6);case 'cast':return v(2+L/40,5+L/25);case 'aspd':return v(2+L/40,6+L/20);
    case 'crit':return v(2+L/50,5+L/25);case 'delay':return v(2+L/40,6+L/20);case 'spCost':return v(2,5+L/40);case 'spRegen':return v(5,15+L/8);
    case 'loop':return v(4,10+L/10);case 'skill':return v(2+L/40,6+L/20);default:return v(1+L/40,3+L/18);
  }
}
/** Legendary effects by class family (an 'all' piece follows whoever finds it). */
const LEGEND_POOL:Record<string,GearFx[]>={swordman:['blaze','chain4','thorns','stoneheart','breaker','bulwark','gale','shieldUp'],mage:['ember','mirror','storm','zoneTime','shieldUp'],
  archer:['farsight','cyclone','binding','preyTime','shieldUp'],novice:['shieldUp']};
export function rollQuality(r:number,bonus=1):Quality{
  if(r<.015*bonus)return 3;if(r<.08*bonus)return 2;if(r<.32*Math.min(bonus,2))return 1;return 0;
}
export type Roll={q:Quality;affix:Affix[];legend?:GearFx};
export function rollEquip(defId:string,q:Quality,r:()=>number,family:JobId='novice'):Roll{
  const d=items[defId] as EquipDef;if(!d||d.kind!=='equip')return {q:0,affix:[]};
  // 唯一: always its own grade with three strong affixes; the power lives on the item.
  if(d.unique){const pool=affixPool(d),affix:Affix[]=[];for(let i=0;i<3&&pool.length;i++){const k=pool.splice(Math.floor(r()*pool.length),1)[0];affix.push({k,v:affixValue(k,d,.6+r()*.399)});}return {q:4,affix};}
  if(q<=0)return {q:0,affix:[]};
  const pool=affixPool(d).filter(k=>!(k==='atk'&&d.weaponType==='staff')),affix:Affix[]=[];
  // A higher grade also rolls a little higher on average.
  for(let i=0;i<q&&pool.length;i++){const k=pool.splice(Math.floor(r()*pool.length),1)[0];affix.push({k,v:affixValue(k,d,Math.min(.999,r()*(.7+.15*q)))});}
  if(q<3)return {q,affix};
  const fam=d.jobs==='all'?family:(d.jobs.find(j=>LEGEND_POOL[j])??family);
  // v7.0: half the time the legendary power is a class-agnostic 傳說威能.
  const list=(r()<.5?ASPECT_IDS:(LEGEND_POOL[fam]??LEGEND_POOL.novice)).filter(f=>f!==d.fx);
  return {q,affix,legend:list[Math.floor(r()*list.length)]};
}
/** The definition derive() should see: base stats + affixes, plus a legendary effect. */
export function effectiveDef(inst:{defId:string;affix?:Affix[];legend?:GearFx}):EquipDef & {extraFx?:GearFx}{
  const d=items[inst.defId] as EquipDef;if(!inst.affix?.length&&!inst.legend)return d;
  const out:EquipDef & {extraFx?:GearFx}={...d,stats:{...(d.stats??{})}};
  for(const a of inst.affix??[]){if((STAT_KEYS as readonly string[]).includes(a.k)){const k=a.k as typeof STAT_KEYS[number];out.stats![k]=(out.stats![k]??0)+a.v;}
    else{const k=a.k as Exclude<AffixKey,typeof STAT_KEYS[number]>;(out as Record<string,unknown>)[k]=((d as Record<string,unknown>)[k] as number??0)+a.v;}}
  if(inst.legend)out.extraFx=inst.legend;
  return out;
}
export const legendText=(f:GearFx)=>GEAR_FX[f];
export const validAffix=(a:unknown):a is Affix=>!!a&&typeof a==='object'&&AFFIX_KEYS.includes((a as Affix).k)&&Number.isInteger((a as Affix).v)&&(a as Affix).v>0&&(a as Affix).v<10000;
