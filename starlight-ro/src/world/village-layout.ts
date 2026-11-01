import type {MapDef} from '../data/maps';
import type {Prop} from './mapgen';
import {Grid} from './grid';

export type VillageSite={x:number;z:number;variant:number};
export type VillageLayoutInput={def:MapDef;w:number;h:number;ground:Uint8Array;blocked:Uint8Array;props:readonly Prop[]};

/** Conservative footprint includes the banner at x+1.1 and its rotated base, not just the centre. */
export function villageFootprint(site:Pick<VillageSite,'x'|'z'>){
  const cells:{x:number;z:number}[]=[];
  for(let z=Math.floor(site.z-1.5);z<Math.ceil(site.z+1.5);z++)
    for(let x=Math.floor(site.x-1.5);x<Math.ceil(site.x+1.5);x++)cells.push({x,z});
  return cells;
}

/** Pure deterministic layout; no RNG calls or writes to map input. Grass codes are mapgen's 0/1/5. */
export function villageSites(input:VillageLayoutInput):VillageSite[]{
  const {def,w,h,ground,props}=input;if(def.theme!=='town')return [];
  const occupied=input.blocked.slice(),sites:VillageSite[]=[];
  const safe=(x:number,z:number)=>{
    if(x<=3||z<=3||x>=w-3||z>=h-3)return false;
    if(def.npcs.some(n=>Math.hypot(x-n.x-.5,z-n.y-.5)<=3)||def.warps.some(p=>Math.hypot(x-p.x-.5,z-p.y-.5)<=4)||Math.hypot(x-def.start.x,z-def.start.y)<=3)return false;
    return villageFootprint({x,z}).every(c=>c.x>=0&&c.z>=0&&c.x<w&&c.z<h&&!occupied[c.z*w+c.x]&&[0,1,5].includes(ground[c.z*w+c.x]));
  };
  for(const [i,house] of props.filter(p=>p.kind==='house').entries()){
    const candidates=[[house.x+(house.w??5)/2+1.8,house.y+1],[house.x-(house.w??5)/2-1.8,house.y-1],[house.x+1,house.y-(house.h??5)/2-1.8]];
    for(const [x,z] of candidates){
      if(!safe(x,z))continue;
      const site={x,z,variant:i%3},cells=villageFootprint(site);
      for(const c of cells)occupied[c.z*w+c.x]=1;
      const reachable=new Grid(w,h,occupied).flood(def.start.x,def.start.y);
      const targets=[def.start,...def.npcs,...def.warps];
      if(targets.every(p=>reachable[p.y*w+p.x])){sites.push(site);break;}
      for(const c of cells)occupied[c.z*w+c.x]=0;
    }
  }
  return sites;
}
