// Deterministic map layouts. Ground codes and props are presentation hints; `blocked` is the rule.
import { maps, type MapDef } from '../data/maps';
import { Grid } from './grid';
import { mulberry32 } from './rng';
import {villageSites as planVillageSites,villageFootprint,type VillageSite} from './village-layout';

export const G = { grass:0, grass2:1, path:2, stone:3, water:4, flowers:5, caveFloor:6, ice:7, darkGrass:8, sand:9 } as const;
export type PropKind = 'pillar'|'tree'|'pine'|'bigTree'|'bush'|'rock'|'flower'|'house'|'fountain'|'lamp'|'crystal'|'stalagmite'
  |'mushroom'|'stall'|'fence'|'tuft'|'log'|'caveWall'|'sign';
export type Prop = { kind:PropKind; x:number; y:number; v:number; w?:number; h?:number };
export type MapData = { def:MapDef; w:number; h:number; ground:Uint8Array; blocked:Uint8Array; props:Prop[]; grid:Grid; reachable:Uint8Array; villageSites:VillageSite[] };

const blocking: Partial<Record<PropKind,boolean>> = {pillar:true,tree:true,pine:true,bigTree:true,rock:true,house:true,fountain:true,lamp:true,crystal:true,stalagmite:true,stall:true,fence:true,caveWall:true,log:true,sign:true};

export function buildMap(id:string):MapData {
  const def=maps[id];if(!def)throw new Error(`未知地圖 ${id}`);
  const {w,h}=def,rnd=mulberry32(def.seed);
  const ground=new Uint8Array(w*h),blocked=new Uint8Array(w*h),props:Prop[]=[];
  const idx=(x:number,y:number)=>y*w+x,inside=(x:number,y:number)=>x>=0&&y>=0&&x<w&&y<h;
  const keepClear=new Uint8Array(w*h);
  const clearAround=(cx:number,cy:number,r:number)=>{for(let y=cy-r;y<=cy+r;y++)for(let x=cx-r;x<=cx+r;x++)if(inside(x,y))keepClear[idx(x,y)]=1;};
  const place=(p:Prop)=>{
    const cw=p.w??1,ch=p.h??1,x0=Math.floor(p.x-cw/2+.001),y0=Math.floor(p.y-ch/2+.001);
    for(let y=y0;y<y0+ch;y++)for(let x=x0;x<x0+cw;x++){if(!inside(x,y)||keepClear[idx(x,y)]||blocked[idx(x,y)])return false;}
    props.push(p);
    if(blocking[p.kind])for(let y=y0;y<y0+ch;y++)for(let x=x0;x<x0+cw;x++)blocked[idx(x,y)]=1;
    return true;
  };
  const decor=(kind:PropKind,x:number,y:number)=>{if(inside(Math.floor(x),Math.floor(y))&&!blocked[idx(Math.floor(x),Math.floor(y))])props.push({kind,x,y,v:Math.floor(rnd()*4)});};

  // Warps, NPCs and the start point must stay open.
  for(const wp of def.warps){clearAround(wp.x,wp.y,2);}
  for(const n of def.npcs)clearAround(n.x,n.y,1);
  clearAround(def.start.x,def.start.y,2);

  const theme=def.theme;
  const base=theme==='cave'?G.caveFloor:theme==='forest'?G.darkGrass:G.grass;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const n=Math.sin(x*.31+def.seed)*Math.cos(y*.27-def.seed)+Math.sin((x+y)*.13);
    ground[idx(x,y)]=theme==='cave'?(n>1.1?G.ice:base):theme==='ruins'?(n>.95?G.stone:n<-1.2?G.flowers:base):(n>1.05?G.grass2:n<-1.25&&theme==='meadow'?G.flowers:base);
  }

  // Roads: a gently winding path linking every warp through the map centre.
  const road=(ax:number,ay:number,bx:number,by:number,code:number,width=1)=>{
    const steps=Math.ceil(Math.hypot(bx-ax,by-ay)*2),phase=rnd()*6;
    for(let i=0;i<=steps;i++){
      const t=i/steps,wob=Math.sin(t*Math.PI*2+phase)*Math.min(4,steps/12)*Math.sin(t*Math.PI);
      const nx=-(by-ay),ny=bx-ax,len=Math.hypot(nx,ny)||1;
      const x=Math.round(ax+(bx-ax)*t+nx/len*wob),y=Math.round(ay+(by-ay)*t+ny/len*wob);
      for(let dy=-width;dy<=width;dy++)for(let dx=-width;dx<=width;dx++)if(inside(x+dx,y+dy)){ground[idx(x+dx,y+dy)]=code;keepClear[idx(x+dx,y+dy)]=1;}
    }
  };

  if(theme==='town'){
    const cx=24,cy=24;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const d=Math.hypot(x+.5-cx,y+.5-cy);
      if(d<8.5)ground[idx(x,y)]=G.stone;
      if((Math.abs(y+.5-cy)<2.2&&x>cx)||(Math.abs(x+.5-cx)<2.2)||(Math.abs(y+.5-cy)<2.2&&x<cx))ground[idx(x,y)]=G.stone;
      if(d<8.5||Math.abs(y+.5-cy)<2.2||Math.abs(x+.5-cx)<2.2)keepClear[idx(x,y)]=1;
    }
    // Fountain in the plaza centre is placed before keepClear applies.
    props.push({kind:'fountain',x:cx,y:cy,v:0,w:3,h:3});
    for(let y=cy-1;y<=cy+1;y++)for(let x=cx-1;x<=cx+1;x++)blocked[idx(x,y)]=1;
    // Lamps around the plaza rim.
    for(let i=0;i<8;i++){const a=i/8*Math.PI*2+Math.PI/8,x=Math.floor(cx+Math.cos(a)*7.6),y=Math.floor(cy+Math.sin(a)*7.6);
      props.push({kind:'lamp',x:x+.5,y:y+.5,v:0});blocked[idx(x,y)]=1;}
    const houses=[{x:9,y:9,w:7,h:6,v:0},{x:38,y:9,w:7,h:6,v:1},{x:9,y:38,w:7,h:6,v:2},{x:38,y:38,w:7,h:6,v:3},{x:16,y:8,w:5,h:5,v:2},{x:32,y:40,w:5,h:5,v:1}];
    for(const hs of houses){
      // House centres sit off the roads; their footprint is solid.
      const p:Prop={kind:'house',x:hs.x+.5,y:hs.y+.5,v:hs.v,w:hs.w,h:hs.h};
      const x0=Math.floor(p.x-hs.w/2+.001),y0=Math.floor(p.y-hs.h/2+.001);
      let ok=true;for(let y=y0;y<y0+hs.h;y++)for(let x=x0;x<x0+hs.w;x++)if(!inside(x,y)||keepClear[idx(x,y)])ok=false;
      if(ok){props.push(p);for(let y=y0;y<y0+hs.h;y++)for(let x=x0;x<x0+hs.w;x++)blocked[idx(x,y)]=1;}
    }
    place({kind:'stall',x:33.5,y:17.5,v:0,w:2,h:1});place({kind:'stall',x:14.5,y:28.5,v:1,w:2,h:1});
    place({kind:'sign',x:42.5,y:21.5,v:0});
  }else{
    for(let i=0;i<def.warps.length;i++)for(let j=i+1;j<def.warps.length;j++){
      const a=def.warps[i],b=def.warps[j];road(a.x,a.y,Math.floor(w/2),Math.floor(h/2),theme==='cave'?G.sand:theme==='ruins'?G.stone:G.path);road(Math.floor(w/2),Math.floor(h/2),b.x,b.y,theme==='cave'?G.sand:theme==='ruins'?G.stone:G.path);
    }
    if(def.warps.length===1){const a=def.warps[0];road(a.x,a.y,Math.floor(w/2),Math.floor(h/2),theme==='cave'?G.sand:theme==='ruins'?G.stone:G.path);}
  }

  // Border: two-deep ring of trees (or rock wall in caves), with openings at warps.
  const borderKind:PropKind=theme==='cave'?'caveWall':theme==='forest'?'pine':theme==='ruins'?'pillar':'tree';
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const edge=Math.min(x,y,w-1-x,h-1-y);
    if(edge<=1&&!keepClear[idx(x,y)]){
      if((x+y)%2===0||edge===0)props.push({kind:borderKind,x:x+.5+(rnd()-.5)*.3,y:y+.5+(rnd()-.5)*.3,v:Math.floor(rnd()*4)});
      blocked[idx(x,y)]=1;
    }
  }
  // Warp openings must not be walled; warps sit on the edge cell itself.
  for(const wp of def.warps)for(let dy=-1;dy<=1;dy++){const x=wp.x,y=wp.y+dy;if(inside(x,y))blocked[idx(x,y)]=0;}

  if(theme!=='town'){
    // Ponds (meadow) or ice pools (cave).
    const pools=theme==='meadow'?3:theme==='cave'?2:2;
    for(let i=0;i<pools;i++){
      const px=8+rnd()*(w-16),py=8+rnd()*(h-16),r=2.2+rnd()*2.5;
      for(let y=Math.floor(py-r-1);y<=py+r+1;y++)for(let x=Math.floor(px-r-1);x<=px+r+1;x++){
        if(!inside(x,y)||keepClear[idx(x,y)])continue;
        const d=Math.hypot((x+.5-px)/1.25,y+.5-py);
        if(d<r){ground[idx(x,y)]=G.water;blocked[idx(x,y)]=1;}
        else if(d<r+1&&ground[idx(x,y)]!==G.water&&theme==='meadow')ground[idx(x,y)]=G.sand;
      }
    }
    // Obstacle clusters.
    const clusters=theme==='forest'?34:theme==='cave'?24:22;
    for(let c=0;c<clusters;c++){
      const cx=4+rnd()*(w-8),cy=4+rnd()*(h-8),n=2+Math.floor(rnd()*(theme==='forest'?7:5));
      for(let k=0;k<n;k++){
        const x=Math.floor(cx+(rnd()-.5)*5)+.5,y=Math.floor(cy+(rnd()-.5)*5)+.5,roll=rnd();
        let kind:PropKind;
        if(theme==='meadow')kind=roll<.55?'tree':roll<.75?'bush':roll<.9?'rock':'log';
        else if(theme==='forest')kind=roll<.45?'pine':roll<.65?'tree':roll<.8?'bigTree':roll<.9?'bush':'rock';
        else if(theme==='ruins')kind=roll<.45?'pillar':roll<.65?'rock':roll<.85?'crystal':'tree';
        else kind=roll<.45?'stalagmite':roll<.75?'crystal':'rock';
        if(kind==='bush'){decor('bush',x,y);continue;}
        place(kind==='bigTree'?{kind,x:x+.5,y:y+.5,v:Math.floor(rnd()*3),w:2,h:2}:{kind,x,y,v:Math.floor(rnd()*4)});
      }
    }
    // Non-blocking decoration.
    const decoCount=Math.floor(w*h*(theme==='cave'?.03:.06));
    for(let i=0;i<decoCount;i++){
      const x=1+rnd()*(w-2),y=1+rnd()*(h-2),roll=rnd();
      const kind:PropKind=theme==='cave'?(roll<.6?'tuft':'crystal'):theme==='forest'?(roll<.4?'mushroom':roll<.75?'tuft':'flower'):(roll<.5?'tuft':'flower');
      if(kind==='crystal'&&theme==='cave'){props.push({kind:'tuft',x,y,v:3});continue;}
      decor(kind,x,y);
    }
  }else{
    for(let i=0;i<70;i++){const x=1+rnd()*(w-2),y=1+rnd()*(h-2);if(ground[idx(Math.floor(x),Math.floor(y))]===G.grass)decor(rnd()<.5?'flower':'tuft',x,y);}
    for(let i=0;i<16;i++){const x=Math.floor(3+rnd()*(w-6))+.5,y=Math.floor(3+rnd()*(h-6))+.5;place({kind:rnd()<.7?'tree':'bush',x,y,v:Math.floor(rnd()*4)});}
  }

  // Shared visual/physics layout: no RNG calls, and only the town receives new obstacles.
  const villageSites=planVillageSites({def,w,h,ground,blocked,props});
  for(const site of villageSites)for(const cell of villageFootprint(site))blocked[idx(cell.x,cell.z)]=1;
  const grid=new Grid(w,h,blocked);
  // Guarantee every warp is reachable from the start: carve straight corridors if needed.
  let reachable=grid.flood(def.start.x,def.start.y);
  for(const wp of def.warps){
    if(reachable[idx(wp.x,wp.y)])continue;
    const carve=(cx:number,cy:number)=>{for(const [ox,oy] of [[0,0],[1,0],[0,1]]){const x=cx+ox,y=cy+oy;if(!inside(x,y))continue;blocked[idx(x,y)]=0;if(ground[idx(x,y)]===G.water)ground[idx(x,y)]=G.path;}};
    let x=def.start.x,y=def.start.y;carve(x,y);
    while(x!==wp.x||y!==wp.y){if(y!==wp.y)y+=Math.sign(wp.y-y);else x+=Math.sign(wp.x-x);carve(x,y);}
    reachable=grid.flood(def.start.x,def.start.y);
  }
  // Drop blocking props whose cells were carved open.
  const kept=props.filter(p=>{
    if(!blocking[p.kind])return true;
    const cw=p.w??1,ch=p.h??1,x0=Math.floor(p.x-cw/2+.001),y0=Math.floor(p.y-ch/2+.001);
    for(let y=y0;y<y0+ch;y++)for(let x=x0;x<x0+cw;x++)if(inside(x,y)&&blocked[idx(x,y)])return true;
    return false;
  });
  // Decorations never sit on water.
  const finalProps=kept.filter(p=>blocking[p.kind]||ground[idx(Math.min(w-1,Math.floor(p.x)),Math.min(h-1,Math.floor(p.y)))]!==G.water);
  return {def,w,h,ground,blocked,props:finalProps,grid,reachable,villageSites};
}
