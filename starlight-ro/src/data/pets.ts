// Pets: captured with a 星光誘捕器 on a weakened monster. They follow you and grant a small bonus
// that reaches full strength once intimacy is 親密 (250+). Intimacy grows by fighting together.
import type { Stat } from './jobs';
export type PetBonus={stats?:Partial<Record<Stat,number>>;atk?:number;def?:number;flee?:number;crit?:number;hpPct?:number;spPct?:number};
export type PetDef={id:string;name:string;monster:string;bonus:PetBonus;label:string;desc:string};
export const pets:Record<string,PetDef>=Object.fromEntries(([
  {id:'jelly',name:'噗噗',monster:'jelly',bonus:{hpPct:5},label:'最大 HP +5%',desc:'軟綿綿的果凍，會一蹦一蹦地跟著你。'},
  {id:'worm',name:'小綠',monster:'worm',bonus:{def:3},label:'防禦 +3',desc:'慢吞吞但很可靠的小毛蟲。'},
  {id:'shroom',name:'菇菇',monster:'shroom',bonus:{stats:{vit:2}},label:'VIT +2',desc:'頭上的蘑菇傘會跟著搖晃。'},
  {id:'chick',name:'啾啾',monster:'chick',bonus:{stats:{agi:2}},label:'AGI +2',desc:'走路很快、愛啄地上的東西。'},
  {id:'wolf',name:'小狼',monster:'wolf',bonus:{atk:8},label:'攻擊 +8',desc:'忠誠的森林狼仔，會守在你身邊。'},
  {id:'bee',name:'嗡嗡',monster:'bee',bonus:{crit:3},label:'爆擊 +3%',desc:'嗡嗡嗡地繞著你飛。'},
  {id:'bunny',name:'雪球',monster:'bunny',bonus:{spPct:6},label:'最大 SP +6%',desc:'白白圓圓的雪兔，耳朵很長。'},
  {id:'bat',name:'冰冰',monster:'bat',bonus:{flee:6},label:'迴避 +6',desc:'冰涼的小蝙蝠，夜晚特別有精神。'},
  {id:'wisp',name:'光光',monster:'wisp',bonus:{stats:{int:2}},label:'INT +2',desc:'飄來飄去的小精靈，法師最好的夥伴。'},
  {id:'fox',name:'焰焰',monster:'fox',bonus:{stats:{dex:2}},label:'DEX +2',desc:'尾巴熱呼呼的小火狐。'},
] as PetDef[]).map(p=>[p.id,p]));
export const petByMonster=(monster:string)=>Object.values(pets).find(p=>p.monster===monster)??null;
export const INTIMATE=250, INTIMACY_MAX=1000;
/** Bonus multiplier: half until 親密, full after. */
export const petBonusScale=(intimacy:number)=>intimacy>=INTIMATE?1:.5;
export const intimacyLabel=(n:number)=>n>=750?'摯愛':n>=INTIMATE?'親密':n>=100?'熟悉':'陌生';
export const TAME_ITEM='tameCrystal';
