// v4.7 精煉深化: every piece of gear has a "trait" (its defining build stat). Refining to +3 / +5 / +7 grows that trait,
// so a cast-time accessory refines into more cast reduction and a bow into more attack speed — not just bigger numbers.
// Signature items add their own +7 bonus (EquipDef.refine7). Regular per-level ATK/DEF from refining is unchanged.
import type { EquipDef, RefineBonus } from '../data/items';
export type TraitKey=keyof RefineBonus;
export const TRAIT_NAMES:Record<TraitKey,string>={cast:'詠唱縮短',aspd:'攻擊速度',crit:'爆擊率',delay:'技能延遲縮短',spCost:'SP 消耗降低',spRegen:'SP 自然回復',loop:'追加傷害',skill:'技能傷害',matk:'魔法攻擊',hp:'最大 HP',sp:'最大 SP',mdef:'魔法防禦'};
/** Milestone gains at +3, +5, +7 (cumulative). Percent for everything except hp/sp/mdef (flat). */
export const TRAIT_STEPS:Record<TraitKey,[number,number,number]>={cast:[2,2,3],aspd:[2,2,3],crit:[2,2,3],delay:[3,3,4],spCost:[2,3,4],spRegen:[5,5,10],loop:[3,3,5],skill:[2,2,3],matk:[2,2,3],hp:[30,30,60],sp:[15,15,30],mdef:[2,2,3]};
export function traitOf(d:EquipDef):TraitKey{
  for(const k of ['cast','delay','aspd','crit','spCost','spRegen','loop','skill'] as const)if(d[k])return k;
  if(d.slot==='weapon')return d.weaponType==='staff'?'matk':d.weaponType==='bow'?'aspd':'crit';
  return d.slot==='armor'||d.slot==='shoes'?'hp':d.slot==='garment'?'mdef':'sp';
}
export const pctTrait=(k:TraitKey)=>k!=='hp'&&k!=='sp'&&k!=='mdef';
export function refineBonus(d:EquipDef,refine:number):RefineBonus{
  const k=traitOf(d),steps=TRAIT_STEPS[k];let v=0;
  if(refine>=3)v+=steps[0];if(refine>=5)v+=steps[1];if(refine>=7)v+=steps[2];
  const out:RefineBonus=v?{[k]:v}:{};
  if(refine>=7&&d.refine7)for(const [kk,vv] of Object.entries(d.refine7))out[kk as TraitKey]=(out[kk as TraitKey]??0)+(vv??0);
  return out;
}
export function bonusText(b:RefineBonus){return Object.entries(b).filter(([,v])=>v).map(([k,v])=>`${TRAIT_NAMES[k as TraitKey]} ${k==='cast'||k==='delay'||k==='spCost'?'−':'+'}${v}${pctTrait(k as TraitKey)?'%':''}`).join('、');}
