// v4.7 crafting rules: spend materials + zeny for signature gear or cooked food.
import { recipes, type Recipe } from '../data/crafting';
import { items } from '../data/items';
import { addItem, type GameState } from './state';
import { rollEquip, rollQuality, type Quality } from './affix';
export const recipeById=(id:string)=>recipes.find(r=>r.id===id);
export function missingFor(s:GameState,r:Recipe):string[]{
  const out=Object.entries(r.mats).filter(([id,n])=>(s.items[id]??0)<n).map(([id,n])=>`${items[id]?.name??id} ${s.items[id]??0}/${n}`);
  if(s.char.zeny<r.zeny)out.push(`Zeny ${s.char.zeny}/${r.zeny}`);return out;
}
/** v7.0: crafted gear is never plain — at least 精良, with a chance of 稀有／傳說 (pass `r` to roll; without it the piece is 精良 with low rolls). */
export function craft(s0:GameState,id:string,rand:()=>number=()=>0):GameState{
  const r=recipeById(id);if(!r)throw new Error('沒有這個配方');
  const miss=missingFor(s0,r);if(miss.length)throw new Error(`材料不足：${miss.join('、')}`);
  const s:GameState={...s0,items:{...s0.items},char:{...s0.char,zeny:s0.char.zeny-r.zeny}};
  for(const [m,n] of Object.entries(r.mats)){s.items[m]-=n;if(!s.items[m])delete s.items[m];}
  if(items[r.out]?.kind!=='equip')return addItem(s,r.out,r.count);
  let out=s;for(let i=0;i<r.count;i++){const q=Math.max(1,rollQuality(rand(),3)) as Quality;out=addItem(out,r.out,1,rollEquip(r.out,q,rand,s.char.job));}
  return out;
}
