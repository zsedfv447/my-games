// Procedural, tileable PBR-ish textures (albedo + normal map) painted per pixel at startup:
// cobblestone, roof tiles, stone bricks, plaster, planks, grass, foliage and bark.
import * as THREE from 'three';

export type TexSet={map:THREE.Texture;normal:THREE.Texture};
const cache=new Map<string,TexSet>();

function hash(x:number,y:number,s:number){let h=(x*374761393+y*668265263+s*982451653)|0;h=(h^(h>>>13))*1274126177|0;return((h^(h>>>16))>>>0)/4294967295;}
/** Tileable value noise with period p. */
function vnoise(x:number,y:number,p:number,s:number){
  const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi,u=xf*xf*(3-2*xf),v=yf*yf*(3-2*yf);
  const w=(a:number)=>((a%p)+p)%p;
  const a=hash(w(xi),w(yi),s),b=hash(w(xi+1),w(yi),s),c=hash(w(xi),w(yi+1),s),d=hash(w(xi+1),w(yi+1),s);
  return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v;
}
function fbm(x:number,y:number,p:number,s:number,oct=4){let a=0,amp=.5,f=1;for(let i=0;i<oct;i++){a+=vnoise(x*f,y*f,p*f,s+i*17)*amp;amp*=.5;f*=2;}return a;}
const clamp=(v:number,a=0,b=1)=>v<a?a:v>b?b:v;
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
// DataTexture below is explicitly sRGB: write display-space bytes, not Three's linear values.
function rgb(hex:string){const c=new THREE.Color(hex).convertLinearToSRGB();return[c.r*255,c.g*255,c.b*255] as const;}

/** Runs `px` for every pixel; it returns [r,g,b,height]. Produces albedo + normal textures (repeat 1; meshes carry world-unit UVs). */
function generate(key:string,size:number,px:(x:number,y:number)=>[number,number,number,number],strength=2):TexSet{
  const hit=cache.get(key);if(hit)return hit;
  const col=new Uint8ClampedArray(size*size*4),h=new Float32Array(size*size);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){const [r,g,b,hh]=px(x,y);const i=y*size+x;col[i*4]=r;col[i*4+1]=g;col[i*4+2]=b;col[i*4+3]=255;h[i]=hh;}
  const nrm=new Uint8ClampedArray(size*size*4);
  const H=(x:number,y:number)=>h[((y+size)%size)*size+((x+size)%size)];
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const dx=(H(x+1,y)-H(x-1,y))*strength,dy=(H(x,y+1)-H(x,y-1))*strength;
    const l=Math.hypot(dx,dy,1),i=(y*size+x)*4;nrm[i]=(-dx/l*.5+.5)*255;nrm[i+1]=(dy/l*.5+.5)*255;nrm[i+2]=(1/l*.5+.5)*255;nrm[i+3]=255;
  }
  const mk=(data:Uint8ClampedArray,srgb:boolean)=>{const t=new THREE.DataTexture(new Uint8Array(data.buffer as ArrayBuffer),size,size,THREE.RGBAFormat);t.wrapS=t.wrapT=THREE.RepeatWrapping;
    t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;t.anisotropy=8;if(srgb)t.colorSpace=THREE.SRGBColorSpace;t.needsUpdate=true;return t;};
  const set={map:mk(col,true),normal:mk(nrm,false)};cache.set(key,set);return set;
}

/** Voronoi cells on a wrapped jittered grid: nearest distance, edge distance and cell id. */
function voronoi(x:number,y:number,cells:number,size:number,seed:number,jitter=.8){
  const fx=x/size*cells,fy=y/size*cells,cx=Math.floor(fx),cy=Math.floor(fy);
  let d1=9,d2=9,id=0;
  for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++){
    const gx=cx+i,gy=cy+j,wx=((gx%cells)+cells)%cells,wy=((gy%cells)+cells)%cells;
    const px=gx+.5+(hash(wx,wy,seed)-.5)*jitter,py=gy+.5+(hash(wx,wy,seed+1)-.5)*jitter;
    const d=Math.hypot(fx-px,fy-py);if(d<d1){d2=d1;d1=d;id=hash(wx,wy,seed+2);}else if(d<d2)d2=d;
  }
  return {d1,edge:d2-d1,id};
}

/** Rounded cobblestones in warm greys with dark mortar (town plazas and roads). */
export function cobble(tint='#c9c0b0'):TexSet{
  const base=rgb(tint),S=256;
  return generate(`cobble:${tint}`,S,(x,y)=>{
    const v=voronoi(x,y,7,S,11,.75),n=fbm(x/S*8,y/S*8,8,3);
    const stone=clamp(v.edge*6.5),dome=Math.sqrt(clamp(v.edge*3))*.9;
    const shade=.78+v.id*.32+(n-.5)*.25,mortar=1-stone;
    const r=mix(base[0]*shade,82,mortar*.85),g=mix(base[1]*shade,74,mortar*.85),b=mix(base[2]*shade,66,mortar*.85);
    return [r,g,b,dome+n*.15];
  },3);
}
/** Large flagstones (castle squares). */
export function flagstone(tint='#d8d0c2'):TexSet{
  const base=rgb(tint),S=256;
  return generate(`flag:${tint}`,S,(x,y)=>{
    const row=Math.floor(y/64),off=row%2?32:0,bx=Math.floor((x+off)/64)%4,lx=(x+off)%64,ly=y%64;
    const edge=Math.min(lx,63-lx,ly,63-ly),seam=clamp(edge/3),id=hash(bx,row,5),n=fbm(x/S*6,y/S*6,6,9);
    const shade=(.85+id*.18+(n-.5)*.22)*mix(.55,1,seam);
    return [base[0]*shade,base[1]*shade,base[2]*shade,seam*.8+n*.2];
  },2.5);
}
/** Lush grass with blade strokes and colour patches; tiles seamlessly. */
export function grass(tint='#7dbb55'):TexSet{
  const base=rgb(tint),S=256;
  return generate(`grass:${tint}`,S,(x,y)=>{
    const n=fbm(x/S*4,y/S*4,4,21),blades=fbm(x/S*48,y/S*12,48,7,2),fine=vnoise(x/S*96,y/S*96,96,4);
    const k=.78+n*.32+(blades-.5)*.35+(fine-.5)*.12;
    const warm=clamp((n-.55)*3);
    return [base[0]*k+warm*24,base[1]*k+warm*10,base[2]*k-warm*10,blades*.7+fine*.3];
  },1.6);
}
/** Packed dirt / sand path. */
export function dirt(tint='#cfae7c'):TexSet{
  const base=rgb(tint),S=256;
  return generate(`dirt:${tint}`,S,(x,y)=>{
    const n=fbm(x/S*6,y/S*6,6,31),peb=voronoi(x,y,22,S,41,.9),p=clamp(1-peb.d1*3)*(peb.id>.7?1:0);
    const k=.82+n*.3-p*.15+(vnoise(x/S*80,y/S*80,80,2)-.5)*.1;
    return [base[0]*k,base[1]*k,base[2]*k,n*.6+p*.5];
  },2);
}
/** Overlapping clay roof tiles in rows. */
export function roofTiles(tint:string):TexSet{
  const base=rgb(tint),S=128;
  return generate(`roof:${tint}`,S,(x,y)=>{
    const rowH=16,row=Math.floor(y/rowH),off=row%2?8:0,lx=((x+off)%16)-8,ly=y%rowH;
    const arc=Math.sqrt(Math.max(0,1-(lx/8)**2)),bottom=ly/rowH;
    const h=arc*.6+bottom*.5,id=hash(Math.floor((x+off)/16),row,9),edge=ly>rowH-2?.55:1;
    const k=(.72+bottom*.35+id*.15)*edge*(.85+arc*.2);
    return [base[0]*k,base[1]*k,base[2]*k,h];
  },3);
}
/** Cut stone blocks (castle walls, house foundations). */
export function stoneBricks(tint='#cfc6b6'):TexSet{
  const base=rgb(tint),S=256;
  return generate(`brick:${tint}`,S,(x,y)=>{
    const bh=32,bw=64,row=Math.floor(y/bh),off=row%2?32:0,lx=(x+off)%bw,ly=y%bh,bx=Math.floor((x+off)/bw);
    const edge=Math.min(lx,bw-1-lx,ly,bh-1-ly),seam=clamp(edge/3.5),id=hash(bx,row,13),n=fbm(x/S*8,y/S*8,8,17);
    const k=(.8+id*.25+(n-.5)*.3)*mix(.45,1,seam);
    return [base[0]*k,base[1]*k,base[2]*k,seam*.9+n*.25];
  },2.2);
}
/** Lime plaster with subtle stains. */
export function plaster(tint='#f4ead6'):TexSet{
  const base=rgb(tint),S=128;
  return generate(`plaster:${tint}`,S,(x,y)=>{const n=fbm(x/S*5,y/S*5,5,51),f=vnoise(x/S*40,y/S*40,40,8);const k=.9+n*.14+(f-.5)*.05;return [base[0]*k,base[1]*k,base[2]*k,n*.4+f*.2];},1);
}
/** Wooden planks with grain. */
export function planks(tint='#9a6a42'):TexSet{
  const base=rgb(tint),S=128;
  return generate(`plank:${tint}`,S,(x,y)=>{
    const pw=32,p=Math.floor(x/pw),lx=x%pw,id=hash(p,0,3),grain=fbm(x/S*2+id*7,y/S*24,24,61,3);
    const seam=clamp(Math.min(lx,pw-1-lx)/2),k=(.75+id*.25+(grain-.5)*.4)*mix(.5,1,seam);
    return [base[0]*k,base[1]*k,base[2]*k,seam*.6+grain*.3];
  },2);
}
/** Clustered leaves for tree crowns and hedges (sphere UVs, so it repeats a few times). */
export function leaves(tint:string):TexSet{
  const base=rgb(tint),S=256;
  return generate(`leaf:${tint}`,S,(x,y)=>{
    const v=voronoi(x,y,18,S,71,.95),leaf=clamp(v.edge*5),n=fbm(x/S*4,y/S*4,4,73);
    const k=(.62+v.id*.42+(n-.5)*.3)*mix(.55,1,leaf),hl=clamp((v.id-.82)*4)*leaf;
    return [base[0]*k+hl*40,base[1]*k+hl*40,base[2]*k+hl*20,leaf*.8+v.id*.3];
  },3);
}
/** Bark: vertical ridges. */
export function bark(tint='#7a5234'):TexSet{
  const base=rgb(tint),S=128;
  return generate(`bark:${tint}`,S,(x,y)=>{const r=fbm(x/S*10,y/S*2,10,81,3),k=.6+r*.6;return [base[0]*k,base[1]*k,base[2]*k,r];},3);
}
/** Fabric weave for clothes (fine, subtle). */
export function fabric():TexSet{
  const S=64;
  return generate('fabric',S,(x,y)=>{const w=(Math.sin(x*Math.PI/2)*Math.sin(y*Math.PI/2)+1)/2,n=vnoise(x/4,y/4,16,5);const k=225+w*20+n*10;return [k,k,k,w*.5+n*.2];},.6);
}
