import {maps,type WarpDef} from './data/maps';
import {monsters} from './data/monsters';
import type {QuestDef} from './data/quests';
export type Destination={map:string;x:number;y:number;name:string;npc?:string;monster?:string};
export function nextWarp(from:string,to:string):WarpDef|null{
  if(from===to||!maps[from]||!maps[to])return null;
  const queue:{map:string;first:WarpDef|null}[]=[{map:from,first:null}],seen=new Set([from]);
  for(let i=0;i<queue.length;i++)for(const warp of maps[queue[i].map].warps){
    if(seen.has(warp.to))continue;const first=queue[i].first??warp;
    if(warp.to===to)return first;seen.add(warp.to);queue.push({map:warp.to,first});
  }
  return null;
}
export function questDestination(q:QuestDef):Destination|null{
  if(q.goal.kind==='job'){const n=maps.town.npcs.find(n=>n.id==='job')!;return {map:'town',x:n.x+.5,y:n.y+.5,name:n.name,npc:n.id};}
  const goal=q.goal;
  const monster=goal.kind==='kill'?goal.monster:goal.kind==='collect'?Object.values(monsters).find(m=>m.drops.some(d=>d.item===goal.item))?.id:undefined;
  if(!monster)return null;
  for(const map of Object.values(maps)){const spawn=map.spawns.find(s=>s.monster===monster);if(!spawn)continue;
    return {map:map.id,x:spawn.area?spawn.area.x+spawn.area.w/2:map.w/2,y:spawn.area?spawn.area.y+spawn.area.h/2:map.h/2,name:monsters[monster].name,monster};}
  return null;
}
