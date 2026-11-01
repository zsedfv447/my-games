import { cards, items, modules, shopStock, equipSlotNames, weaponTypeNames, moduleCoefficient } from './data/items';
import { jobs, skills, elementNames } from './data/jobs';
import { maps } from './data/maps';
import { monsters } from './data/monsters';
import { quests } from './data/quests';
import { recipes } from './data/crafting';
import { CHEST_POOLS } from './data/explore';
import { moduleFits, type GameState } from './rules/state';

export type CollectionKind='card'|'equip'|'monster';
export type CollectionSource={kind:'drop'|'shop'|'quest'|'craft'|'chest';label:string;mapIds:string[];monsterId?:string;rate?:number};
export type CollectionEntry={kind:CollectionKind;id:string;name:string;detail:string;description:string;ownership:string;owned:boolean;jobs:string[];mapIds:string[];sources:CollectionSource[];compatible:string[];search:string};
export type CollectionQuery={kind?:CollectionKind;text?:string;job?:string;map?:string;ownership?:'all'|'owned'|'missing'};
const monsterMaps=(id:string)=>Object.values(maps).filter(m=>m.spawns.some(sp=>sp.monster===id));

/** Sources come from gameplay tables, never the item's sale value or description. */
export function collectionSources(kind:CollectionKind,id:string):CollectionSource[]{
  const sources:CollectionSource[]=[];
  for(const m of Object.values(monsters)){
    const rate=kind==='card'?(m.card===id?m.cardRate:undefined):m.drops.find(d=>d.item===id)?.rate;
    if(rate===undefined)continue;
    const locations=monsterMaps(m.id);
    sources.push({kind:'drop',monsterId:m.id,rate,mapIds:locations.map(d=>d.id),label:`${m.name} Lv.${m.level} · ${locations.map(d=>d.name).join('、')||'目前未配置出沒地圖'} · 基礎掉率 ${+(rate*100).toFixed(3)}%`});
  }
  if(kind==='equip'){
    for(const [stock,ids] of Object.entries(shopStock))if(ids.includes(id)){
      const locations=Object.values(maps).filter(m=>m.npcs.some(n=>n.kind===stock));
      sources.push({kind:'shop',mapIds:locations.map(m=>m.id),label:`商店：${locations.flatMap(m=>m.npcs.filter(n=>n.kind===stock).map(n=>`${m.name}・${n.name}`)).join('、')||'尚未配置商人'} · ${items[id].price.toLocaleString()} z`});
    }
    for(const q of quests)if(q.reward.items?.[id])sources.push({kind:'quest',mapIds:[],label:`委託獎勵：${q.title} ×${q.reward.items[id]}`});
    // v4.6–v4.8 sources: crafting/cooking at 工匠 蘇菲, field chests, trial chests and bounties.
    for(const r of recipes)if(r.out===id)sources.push({kind:'craft',mapIds:['town'],label:`工匠打造：晨光鎮・工匠 蘇菲（${Object.entries(r.mats).map(([m,n])=>`${items[m]?.name??m}×${n}`).join('、')}、${r.zeny.toLocaleString()} z）`});
    const chestMaps=Object.entries(CHEST_POOLS).filter(([,p])=>p.use.includes(id)||p.food.includes(id)).map(([m])=>m).filter(m=>maps[m]);
    if(chestMaps.length)sources.push({kind:'chest',mapIds:chestMaps,label:`野外寶箱：${chestMaps.map(m=>maps[m].name).join('、')}`});
    if(id==='trialSigil')sources.push({kind:'chest',mapIds:[],label:'試煉寶箱（地標試煉）、Lv.10 以上的懸賞、寶箱怪'});
  }
  return sources;
}

/** Read-only view model. It never changes inventory, unlocks, or individual card levels. */
export function buildCollection(state:GameState):CollectionEntry[]{
  const result:CollectionEntry[]=[];
  const push=(entry:Omit<CollectionEntry,'search'>)=>result.push({...entry,search:[entry.id,entry.name,entry.detail,entry.description,entry.ownership,...entry.compatible,...entry.sources.map(s=>s.label),...entry.jobs.map(j=>jobs[j as keyof typeof jobs]?.name??j)].join(' ').toLocaleLowerCase()});
  for(const d of Object.values(cards)){
    const owned=state.cards.filter(c=>c.defId===d.id),mod=modules[d.moduleId],sources=collectionSources('card',d.id);
    const compatible=Object.values(skills).filter(sk=>moduleFits(sk.id,d.moduleId));
    const levels=new Map<number,number>();for(const c of owned)levels.set(c.level,(levels.get(c.level)??0)+1);
    const worn=owned.filter(c=>c.loc.kind==='equip'&&Object.values(state.equipped).includes(c.loc.equipId)).length;
    push({kind:'card',id:d.id,name:d.name,detail:`${mod.name} · 每張最高 Lv.${d.maxLevel}`,description:`Lv.1：${mod.desc(moduleCoefficient(d.id,1))}`,owned:owned.length>0,
      ownership:owned.length?`持有 ${owned.length} 張 · ${[...levels].sort((a,b)=>b[0]-a[0]).map(([lv,n])=>`Lv.${lv} ×${n}`).join('、')}${worn?` · ${worn} 張插在穿著裝備`:''}`:'尚未取得',
      jobs:[...new Set(compatible.map(sk=>sk.job))],mapIds:[...new Set(sources.flatMap(s=>s.mapIds))],sources,compatible:compatible.map(sk=>`${jobs[sk.job].name}・${sk.name}`)});
  }
  for(const d of Object.values(items))if(d.kind==='equip'){
    const owned=state.equipment.filter(e=>e.defId===d.id),worn=owned.filter(e=>Object.values(state.equipped).includes(e.id)).length,sources=collectionSources('equip',d.id);
    const stats=[d.atk?`ATK +${d.atk}`:'',d.matk?`MATK +${d.matk}`:'',d.def?`DEF +${d.def}`:'',d.mdef?`MDEF +${d.mdef}`:'',d.hp?`HP +${d.hp}`:'',d.sp?`SP +${d.sp}`:'',d.cast?`詠唱 −${d.cast}%`:'',d.aspd?`攻速 +${d.aspd}%`:'',d.crit?`爆擊 +${d.crit}%`:'',d.delay?`延遲 −${d.delay}%`:'',...Object.entries(d.stats??{}).map(([k,v])=>`${k.toUpperCase()} +${v}`)].filter(Boolean).join(' · ');
    push({kind:'equip',id:d.id,name:d.name,detail:`${equipSlotNames[d.slot]}${d.weaponType?`・${weaponTypeNames[d.weaponType]}`:''} · 需求 Lv.${d.reqLv} · 卡槽 ${d.slots}`,description:`${d.desc}${stats?' '+stats:''}`,
      ownership:owned.length?`持有 ${owned.length} 件${worn?` · ${worn} 件穿著中`:''}`:'尚未取得',owned:owned.length>0,jobs:d.jobs==='all'?Object.keys(jobs):d.jobs,mapIds:[...new Set(sources.flatMap(s=>s.mapIds))],sources,compatible:[]});
  }
  for(const d of Object.values(monsters)){
    const locations=monsterMaps(d.id),kills=state.mvpKills[d.id]??0;
    push({kind:'monster',id:d.id,name:d.name,detail:`Lv.${d.level} · ${elementNames[d.element]}屬性${d.mvp?' · MVP':''}`,description:`HP ${d.hp.toLocaleString()} · ATK ${d.atk.join('～')} · DEF ${d.def} · MDEF ${d.mdef} · ${d.aggressive?'主動攻擊':'被動魔物'}`,
      ownership:d.mvp?`已討伐 ${kills} 次`:'一般魔物未記錄累計討伐',owned:kills>0,jobs:Object.keys(jobs),mapIds:locations.map(m=>m.id),sources:[],compatible:[...d.drops.map(x=>`${items[x.item]?.name??x.item}（基礎 ${(x.rate*100).toFixed(2)}%）`),`${cards[d.card]?.name??d.card}（基礎 ${(d.cardRate*100).toFixed(3)}%）`]});
  }
  return result;
}

export function filterCollection(entries:CollectionEntry[],query:CollectionQuery){
  const words=(query.text??'').trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return entries.filter(e=>(!query.kind||e.kind===query.kind)&&(!query.job||e.jobs.includes(query.job))&&(!query.map||e.mapIds.includes(query.map))&&
    (query.ownership!=='owned'||e.owned)&&(query.ownership!=='missing'||!e.owned)&&words.every(word=>e.search.includes(word)));
}
export function paginateCollection<T>(entries:T[],requested:number,size=12){
  const pageSize=Number.isFinite(size)?Math.max(1,Math.min(24,Math.floor(size))):12;
  const pageCount=Math.max(1,Math.ceil(entries.length/pageSize)),page=Math.max(0,Math.min(pageCount-1,Number.isFinite(requested)?Math.floor(requested):0));
  return {entries:entries.slice(page*pageSize,(page+1)*pageSize),page,pageCount,total:entries.length};
}
