// v4.9 棲息地: on field maps each regular monster lives mostly in its own area, so "where do I farm X?" has an answer.
// Weaker monsters live nearer the entrance (west), stronger ones deeper (east). 75% of a group spawns in its habitat,
// the rest stays scattered so the map never feels empty. Derived from map data — no hand-placed coordinates to maintain.
import { maps } from './maps';
import { monsters } from './monsters';
export type Habitat={x:number;y:number;r:number};
export const HABITAT_SHARE=.75;
const FIELD=['meadow','forest','cave','ruins','mistMarsh','emberRift','skyGarden','starCitadel'];
export const HABITATS:Record<string,Record<string,Habitat>>={};
for(const id of FIELD){const m=maps[id];if(!m)continue;
  const groups=m.spawns.filter(s=>s.count>=3&&!monsters[s.monster].mvp).sort((a,b)=>monsters[a.monster].level-monsters[b.monster].level);
  const n=groups.length,out:Record<string,Habitat>={},r=Math.round(Math.min(m.w,m.h)*.16);
  // Keep every habitat clear of the MVP lair, so farming a regular monster never drags the boss in.
  const lair=m.spawns.find(sp=>monsters[sp.monster].mvp)?.area,lc=lair?{x:lair.x+lair.w/2,y:lair.y+lair.h/2}:null,safe=r+16;
  const far=(x:number,y:number)=>!lc||Math.hypot(x-lc.x,y-lc.y)>=safe;
  groups.forEach((g,k)=>{let x=Math.round(m.w*(.2+.62*(n>1?k/(n-1):.5)));const rows=[k%2?.68:.34,k%2?.34:.68].map(f=>Math.round(m.h*f));
    let y=rows.find(yy=>far(x,yy))??rows[0];
    for(let step=0;step<10&&!far(x,y);step++)x+=lc&&lc.x>m.w/2?-4:4; // slide toward the map centre, away from the lair
    out[g.monster]={x:Math.max(r+2,Math.min(m.w-r-2,x)),y,r};});
  HABITATS[id]=out;}
export const habitatOf=(map:string,monster:string):Habitat|undefined=>HABITATS[map]?.[monster];
/** Where to hunt a monster: the field map (lowest level first) whose habitat holds it. */
export function huntSpot(monster:string):{map:string;h:Habitat}|null{
  for(const id of FIELD){const h=habitatOf(id,monster);if(h)return {map:id,h};}
  return null;
}
