// 3D map, v4 "new generation" look: splat-textured ground (grass / dirt / cobble / sand with normal
// maps), wind-swept grass, half-timbered houses with tiled gable roofs, ornate plaza, textured trees,
// a castle skyline behind town and rolling hills around the fields. Static geometry is merged per
// material so the whole map costs a few dozen draw calls.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { G, type MapData, type Prop } from '../world/mapgen';
import { toon, glow, canvasTexture, additive, metal } from './toon';
import { beamTexture } from './fx3d';
import { prng } from '../render/art/util';
import { cobble, flagstone, grass, dirt, roofTiles, stoneBricks, plaster, planks, leaves, bark, type TexSet } from './textures';
import { Chibi } from './character3d';
import { hillsGeometry } from './terrain';
import { attachNature } from './nature-assets';
import { attachVillage } from './village-assets';

type Theme=MapData['def']['theme'];
const tex=(t:TexSet,color:THREE.ColorRepresentation='#ffffff',rough=.85,ns=1)=>toon(color,{map:t.map,normalMap:t.normal,rough,normalScale:ns});

// ---------------------------------------------------------------- geometry helpers
/** Box whose UVs are in world units × k, so tiling textures keep their scale on any size. */
function tbox(w:number,h:number,d:number,k=1){
  const g=new THREE.BoxGeometry(w,h,d),uv=g.attributes.uv as THREE.BufferAttribute;
  const dims=[[d,h],[d,h],[w,d],[w,d],[w,h],[w,h]];
  for(let f=0;f<6;f++)for(let i=0;i<4;i++){const j=f*4+i;uv.setXY(j,uv.getX(j)*dims[f][0]*k,uv.getY(j)*dims[f][1]*k);}
  return g;
}
function tcyl(rt:number,rb:number,h:number,seg=16,k=1,open=false){
  const g=new THREE.CylinderGeometry(rt,rb,h,seg,1,open),uv=g.attributes.uv as THREE.BufferAttribute,c=Math.PI*(rt+rb);
  for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*c*k,uv.getY(i)*h*k);return g;
}
function tcone(r:number,h:number,seg=16,k=1){const g=new THREE.ConeGeometry(r,h,seg,4),uv=g.attributes.uv as THREE.BufferAttribute,sl=Math.hypot(r,h);
  for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*Math.PI*2*r*k,uv.getY(i)*sl*k);return g;}
/** Indexed geometry from explicit vertices/uvs/triangles. */
function poly(verts:number[][],uvs:number[][],tris:number[][]){
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(verts.flat(),3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs.flat(),2));
  g.setIndex(tris.flat());g.computeVertexNormals();return g;
}
/** Gable roof, ridge along X, eaves at y=0, with overhang and an underside. */
function gableRoof(len:number,span:number,rise:number,ov=.35,k=1){
  const hx=len/2+ov,ze=span/2+ov,ye=-ov*rise/(span/2),sl=Math.hypot(ze,rise-ye);
  const v:number[][]=[],u:number[][]=[],t:number[][]=[];
  const quad=(a:number[],b:number[],c:number[],d:number[])=>{const n=v.length;v.push(a,b,c,d);u.push([0,0],[2*hx*k,0],[2*hx*k,sl*k],[0,sl*k]);t.push([n,n+1,n+2],[n,n+2,n+3]);};
  quad([-hx,ye,ze],[hx,ye,ze],[hx,rise,0],[-hx,rise,0]);           // front slope
  quad([hx,ye,-ze],[-hx,ye,-ze],[-hx,rise,0],[hx,rise,0]);         // back slope
  const th=.1;
  quad([hx,ye-th,ze],[-hx,ye-th,ze],[-hx,rise-th,0],[hx,rise-th,0]); // undersides
  quad([-hx,ye-th,-ze],[hx,ye-th,-ze],[hx,rise-th,0],[-hx,rise-th,0]);
  quad([-hx,ye-th,ze],[hx,ye-th,ze],[hx,ye,ze],[-hx,ye,ze]);       // eave edges
  quad([hx,ye-th,-ze],[-hx,ye-th,-ze],[-hx,ye,-ze],[hx,ye,-ze]);
  return poly(v,u,t);
}
function gable(span:number,rise:number,k=1){return poly([[0,0,span/2],[0,0,-span/2],[0,rise,0]],[[0,0],[span*k,0],[span*k/2,rise*k]],[[0,1,2]]);}

/** Accumulates transformed geometry per material and merges it into one mesh per material. */
class Merger{
  private parts=new Map<THREE.Material,{list:THREE.BufferGeometry[];shadow:boolean}>();
  private m=new THREE.Matrix4();private q=new THREE.Quaternion();private e=new THREE.Euler();private s=new THREE.Vector3();private p=new THREE.Vector3();
  add(geo:THREE.BufferGeometry,mat:THREE.Material,base:THREE.Matrix4|null,x:number,y:number,z:number,rx=0,ry=0,rz=0,sx=1,sy=1,sz=1,shadow=true){
    const g=geo.clone();for(const k of Object.keys(g.attributes))if(k!=='position'&&k!=='normal'&&k!=='uv')g.deleteAttribute(k);
    if(!g.attributes.uv)g.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count*2),2));
    if(!g.index){const n=g.attributes.position.count;g.setIndex([...Array(n).keys()]);}
    this.e.set(rx,ry,rz);this.q.setFromEuler(this.e);this.m.compose(this.p.set(x,y,z),this.q,this.s.set(sx,sy,sz));
    if(base)this.m.premultiply(base);g.applyMatrix4(this.m);
    let e=this.parts.get(mat);if(!e){e={list:[],shadow};this.parts.set(mat,e);}e.list.push(g);
  }
  build(parent:THREE.Object3D){
    for(const [mat,{list,shadow}] of this.parts){if(!list.length)continue;const geo=mergeGeometries(list,false);if(!geo)continue;
      const mesh=new THREE.Mesh(geo,mat);mesh.castShadow=shadow;mesh.receiveShadow=true;parent.add(mesh);list.forEach(g=>g.dispose());}
    this.parts.clear();
  }
}

/** Instanced props (trees, rocks, grass…) with per-instance colour. */
class Batcher {
  private groups=new Map<string,{geo:THREE.BufferGeometry;mat:THREE.Material;mats:THREE.Matrix4[];colors:THREE.Color[]|null;shadow:boolean}>();
  private q=new THREE.Quaternion();private e=new THREE.Euler();
  add(key:string,geo:THREE.BufferGeometry,mat:THREE.Material,pos:THREE.Vector3,rot:[number,number,number],scale:THREE.Vector3|number,color?:THREE.ColorRepresentation,_o=0,shadow=true){
    let g=this.groups.get(key);if(!g){g={geo,mat,mats:[],colors:color!==undefined?[]:null,shadow};this.groups.set(key,g);}
    this.e.set(rot[0],rot[1],rot[2]);this.q.setFromEuler(this.e);
    const s=typeof scale==='number'?new THREE.Vector3(scale,scale,scale):scale;
    g.mats.push(new THREE.Matrix4().compose(pos,this.q,s));if(g.colors)g.colors.push(new THREE.Color(color??'#ffffff'));
  }
  build(parent:THREE.Object3D){
    for(const [key,g] of this.groups){
      const mesh=new THREE.InstancedMesh(g.geo,g.mat,g.mats.length);mesh.castShadow=g.shadow;mesh.receiveShadow=true;
      mesh.name=key;
      g.mats.forEach((m,i)=>{mesh.setMatrixAt(i,m);if(g.colors)mesh.setColorAt(i,g.colors[i]);});
      mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;mesh.computeBoundingSphere();parent.add(mesh);
    }
  }
}

// ---------------------------------------------------------------- ground
type GroundSet={grass:TexSet;dirt:TexSet;paved:TexSet;sand:TexSet;scale:[number,number,number,number];outer:string};
function groundSet(theme:Theme,variant?:string):GroundSet{
  switch(variant){ // v5.0 look variants reuse the theme's terrain with new colours
    case 'frontier':return {grass:grass('#a8b46a'),dirt:dirt('#c9a07a'),paved:cobble('#d8c4a8'),sand:dirt('#e8cfa0'),scale:[.5,.45,.55,.45],outer:'#8a9a5a'};
    case 'swamp':return {grass:grass('#5a7a44'),dirt:dirt('#6a5a3a'),paved:cobble('#8a8a72'),sand:dirt('#7a7050'),scale:[.5,.45,.55,.45],outer:'#3e5a32'};
    case 'lava':return {grass:dirt('#5a3a32'),dirt:dirt('#3a2420'),paved:flagstone('#8a4a32'),sand:dirt('#c25a2a'),scale:[.35,.4,.45,.45],outer:'#2a1814'};
    case 'sky':return {grass:grass('#8fd47a'),dirt:dirt('#d8d4c8'),paved:flagstone('#eef0ff'),sand:dirt('#dce8f8'),scale:[.5,.45,.45,.45],outer:'#bfe4ff'};
    case 'astral':return {grass:grass('#6a5aa8'),dirt:dirt('#4a3a7a'),paved:flagstone('#b8a8e8'),sand:dirt('#8a7ac8'),scale:[.5,.45,.45,.45],outer:'#2a2050'};
    case 'forge':return {grass:dirt('#3a2a2a'),dirt:dirt('#241818'),paved:flagstone('#5a3a30'),sand:dirt('#a8481e'),scale:[.35,.4,.45,.45],outer:'#140c0a'};
    case 'bell':return {grass:grass('#9ab88a'),dirt:dirt('#b89a7a'),paved:flagstone('#d8c4a0'),sand:dirt('#e0c8a0'),scale:[.5,.45,.45,.45],outer:'#7a6a8a'};
    case 'harbor':return {grass:grass('#8ab07a'),dirt:dirt('#b89a80'),paved:cobble('#d8c8b8'),sand:dirt('#f0dcb8'),scale:[.5,.45,.55,.45],outer:'#5a7a9a'};
    case 'bay':return {grass:grass('#9ad08a'),dirt:dirt('#e8d8b0'),paved:cobble('#e8e0d0'),sand:dirt('#f8e8c0'),scale:[.5,.45,.55,.4],outer:'#7ad0e0'};
  }
  switch(theme){
    case 'town':return {grass:grass('#7cb85a'),dirt:dirt('#c9ae86'),paved:cobble('#d2c7b4'),sand:dirt('#e2d2a6'),scale:[.5,.45,.55,.45],outer:'#6a9f4c'};
    case 'forest':return {grass:grass('#5e9844'),dirt:dirt('#a7845a'),paved:cobble('#aaa292'),sand:dirt('#cdb98a'),scale:[.5,.45,.55,.45],outer:'#4c7f3c'};
    case 'cave':return {grass:dirt('#7c879c'),dirt:dirt('#5f687e'),paved:flagstone('#cfe4f2'),sand:dirt('#9eabc0'),scale:[.35,.4,.45,.45],outer:'#4a5670'};
    case 'ruins':return {grass:grass('#8db474'),dirt:dirt('#c8b48a'),paved:flagstone('#e4dac8'),sand:dirt('#e6d5a6'),scale:[.5,.45,.45,.45],outer:'#7a9a6c'};
    default:return {grass:grass('#82c055'),dirt:dirt('#cfae7c'),paved:cobble('#cdc3b2'),sand:dirt('#e6d4a0'),scale:[.5,.45,.55,.45],outer:'#6aa64e'};
  }
}
/** Soft splat mask: R = dirt, G = paved, B = sand; grass is whatever is left. */
function splatMask(map:MapData){
  const S=16;
  return canvasTexture(map.w*S,map.h*S,g=>{
    g.fillStyle='#000';g.fillRect(0,0,map.w*S,map.h*S);g.globalCompositeOperation='lighter';
    const chan=(k:number)=>k===G.path?'255,0,0':k===G.stone||k===G.ice?'0,255,0':k===G.sand||k===G.water?'0,0,255':'';
    for(let y=0;y<map.h;y++)for(let x=0;x<map.w;x++){
      const c=chan(map.ground[y*map.w+x]);if(!c)continue;const cx=(x+.5)*S,cy=(y+.5)*S,r=S*1.05;
      const gr=g.createRadialGradient(cx,cy,0,cx,cy,r);gr.addColorStop(0,`rgba(${c},.9)`);gr.addColorStop(.55,`rgba(${c},.55)`);gr.addColorStop(1,`rgba(${c},0)`);
      g.fillStyle=gr;g.fillRect(cx-r,cy-r,r*2,r*2);
    }
  });
}
function groundMaterial(set:GroundSet,mask:THREE.Texture,mapW:number,mapH:number){
  mask.colorSpace=THREE.NoColorSpace;
  const mat=new THREE.MeshStandardMaterial({map:mask,normalMap:set.grass.normal,roughness:.92});
  mat.onBeforeCompile=sh=>{
    Object.assign(sh.uniforms,{tGA:{value:set.grass.map},tGN:{value:set.grass.normal},tDA:{value:set.dirt.map},tDN:{value:set.dirt.normal},
      tPA:{value:set.paved.map},tPN:{value:set.paved.normal},tSA:{value:set.sand.map},tSN:{value:set.sand.normal},uSize:{value:new THREE.Vector2(mapW,mapH)},uK:{value:new THREE.Vector4(...set.scale)}});
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>',`#include <common>
uniform sampler2D tGA,tGN,tDA,tDN,tPA,tPN,tSA,tSN;uniform vec2 uSize;uniform vec4 uK;`)
    .replace('#include <map_fragment>',`
  vec2 wuv=vMapUv*uSize;vec3 msk=texture2D(map,vMapUv).rgb;
  float macro=texture2D(tGA,wuv*.043).g*1.6+texture2D(tDA,wuv*.11).r*.6;
  float hD=texture2D(tDN,wuv*uK.y).b,hP=texture2D(tPN,wuv*uK.z).b;
  vec3 gW=vec3(smoothstep(.35,.62,msk.r+(macro-.75)*.35),smoothstep(.4,.6,msk.g+(hP-.85)*.6),smoothstep(.35,.62,msk.b+(macro-.75)*.3));
  vec3 gc=texture2D(tGA,wuv*uK.x).rgb*(.82+macro*.22);
  gc=mix(gc,texture2D(tSA,wuv*uK.w).rgb,gW.z);gc=mix(gc,texture2D(tDA,wuv*uK.y).rgb,gW.x);gc=mix(gc,texture2D(tPA,wuv*uK.z).rgb,gW.y);
  diffuseColor.rgb*=gc;`)
    .replace('vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;',`vec3 mapN=texture2D(tGN,wuv*uK.x).xyz;
  mapN=mix(mapN,texture2D(tSN,wuv*uK.w).xyz,gW.z);mapN=mix(mapN,texture2D(tDN,wuv*uK.y).xyz,gW.x);mapN=mix(mapN,texture2D(tPN,wuv*uK.z).xyz,gW.y);mapN=mapN*2.-1.;`)
    .replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\n  roughnessFactor=mix(roughnessFactor,.62,gW.y);');
  };
  return mat;
}
function waterMask(map:MapData){
  return canvasTexture(map.w*8,map.h*8,g=>{g.fillStyle='#000';g.fillRect(0,0,map.w*8,map.h*8);g.fillStyle='#fff';g.filter='blur(3px)';
    for(let y=0;y<map.h;y++)for(let x=0;x<map.w;x++)if(map.ground[y*map.w+x]===G.water){g.beginPath();g.arc((x+.5)*8,(y+.5)*8,6.5,0,Math.PI*2);g.fill();}});
}

// ---------------------------------------------------------------- vegetation
let bladeTex:THREE.Texture|null=null;
function grassBlades(){
  if(bladeTex)return bladeTex;
  bladeTex=canvasTexture(128,128,g=>{
    const r=prng(7);for(let i=0;i<34;i++){const x=8+r()*112,h=50+r()*72,lean=(r()-.5)*30,w=3+r()*3;
      const gr=g.createLinearGradient(0,128,0,128-h);gr.addColorStop(0,'#5d8a3a');gr.addColorStop(.6,'#9ccf6a');gr.addColorStop(1,'#d8f2a0');g.fillStyle=gr;
      g.beginPath();g.moveTo(x-w,128);g.quadraticCurveTo(x+lean*.3,128-h*.6,x+lean,128-h);g.quadraticCurveTo(x+lean*.3+w*.4,128-h*.55,x+w,128);g.fill();}
  });
  return bladeTex;
}
function bladeGeometry(){
  const a=new THREE.PlaneGeometry(.9,.5),b=a.clone();a.translate(0,.25,0);b.translate(0,.25,0);b.rotateY(Math.PI/2);
  const g=mergeGeometries([a,b])!;const n=g.attributes.normal;for(let i=0;i<n.count;i++)n.setXYZ(i,0,1,0);return g;
}
/** Leafy crown: lumpy icosphere with leaf texture and baked bottom shading in vertex colours. */
function crownGeometry(seed:number){
  const g=new THREE.IcosahedronGeometry(1,2),p=g.attributes.position,col:number[]=[],uv=g.attributes.uv as THREE.BufferAttribute;
  const r=prng(seed),ph=[r()*6,r()*6,r()*6];
  for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
    const k=1+Math.sin(x*4+ph[0])*Math.sin(y*4+ph[1])*Math.sin(z*4+ph[2])*.23+Math.sin(x*9+z*7)*.09;
    p.setXYZ(i,x*k,y*k*.92,z*k);const ao=.58+.42*THREE.MathUtils.smoothstep(y,-.9,.7);col.push(ao,ao,ao);uv.setXY(i,uv.getX(i)*4,uv.getY(i)*2.5);}
  g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));g.computeVertexNormals();return g;
}

// ---------------------------------------------------------------- town buildings
const HOUSE_PAL=[{wall:'#f4ead6',roof:'#3f6fb3',shutter:'#3f6fb3'},{wall:'#f1e2c6',roof:'#c45b3c',shutter:'#4f8f6a'},
  {wall:'#f7efe0',roof:'#d9883a',shutter:'#8a4a3a'},{wall:'#ece0cc',roof:'#4f8a66',shutter:'#c45b3c'},{wall:'#f5e8d8',roof:'#6a5aa8',shutter:'#d9a441'}];
type Mats={stone:THREE.Material;wood:THREE.Material;dark:THREE.Material;iron:THREE.Material;gold:THREE.Material;windows:THREE.MeshBasicMaterial};
function house(M:Merger,mats:Mats,x:number,z:number,w:number,d:number,v:number){
  const pal=HOUSE_PAL[v%HOUSE_PAL.length],base=new THREE.Matrix4().makeTranslation(x,0,z);
  const wallM=tex(plaster(pal.wall),'#ffffff',.9,.6),roofM=tex(roofTiles(pal.roof),'#ffffff',.55,1.2),shutM=tex(planks(pal.shutter),'#ffffff',.8);
  const P=(geo:THREE.BufferGeometry,mat:THREE.Material,px:number,py:number,pz:number,rx=0,ry=0,rz=0,sx=1,sy=1,sz=1)=>M.add(geo,mat,base,px,py,pz,rx,ry,rz,sx,sy,sz);
  const fh=.55,floors=w>=6?2:1,H=floors===2?2.9:2.1,top=fh+H;
  P(tbox(w+.1,fh,d+.1,.8),mats.stone,0,fh/2,0);
  P(tbox(w,H,d,.7),wallM,0,fh+H/2,0);
  // Half-timber frame.
  const beam=(len:number,horiz:boolean,px:number,py:number,pz:number,ry=0)=>P(horiz?tbox(len,.12,.08,2):tbox(.12,len,.08,2),mats.wood,px,py,pz,0,ry);
  for(const s of [1,-1]){
    for(const yy of [fh+.06,top-.06,...(floors===2?[fh+H/2]:[])]){beam(w,true,0,yy,s*(d/2+.03));P(tbox(.08,.12,d,2),mats.wood,s*(w/2+.03),yy,0);}
    const posts=Math.max(2,Math.round(w/1.7));for(let i=0;i<=posts;i++)beam(H,false,-w/2+i*w/posts,fh+H/2,s*(d/2+.035));
    for(const zz of [-d/2,d/2])P(tbox(.08,H,.12,2),mats.wood,s*(w/2+.035),fh+H/2,zz);
    if(floors===2)for(const sx of [-1,1]){const g=tbox(.1,Math.hypot(w/posts,H/2)*.95,.06,2);P(g,mats.wood,sx*(w/2-w/posts/2),fh+H*.75,s*(d/2+.04),0,0,sx*Math.atan2(w/posts,H/2));}
  }
  // Roof: ridge along the longer side.
  const along=w>=d,len=along?w:d,span=along?d:w,rise=span*.45+.35;
  P(gableRoof(len,span,rise,.4,.9),roofM,0,top,0,0,along?0:Math.PI/2);
  for(const s of [-1,1])P(gable(span,rise,.7),wallM,along?s*(len/2):0,top,along?0:s*(len/2),0,along?(s>0?0:Math.PI):(s>0?-Math.PI/2:Math.PI/2));
  P(tcyl(.09,.09,len+.9,8,1),mats.dark,0,top+rise+.02,0,0,along?0:Math.PI/2,Math.PI/2);
  // Chimney.
  P(tbox(.45,rise+1,.45,1.2),mats.stone,w*.22,top+rise*.5+.3,along?-d*.18:0);P(tbox(.55,.12,.55),mats.dark,w*.22,top+rise+.85,along?-d*.18:0);
  // Door with stone arch, step and lantern.
  const dz=d/2+.05;P(tbox(1.1,1.55,.12,1.2),mats.stone,0,fh+.72,dz-.02);P(tbox(.82,1.3,.1,1.5),tex(planks('#6b4a32')),0,fh+.62,dz+.02);
  P(tcyl(.41,.41,.1,16,1.5),tex(planks('#6b4a32')),0,fh+1.27,dz+.02,Math.PI/2);P(tbox(1.3,.18,.55,1),mats.stone,0,.09,dz+.3);
  P(new THREE.SphereGeometry(.035,8,6),mats.gold,.28,fh+.62,dz+.09);
  // Windows: framed glass, open shutters, flower boxes on the ground floor.
  const win=(px:number,py:number,pz:number,ry:number,box:boolean)=>{
    const m=new THREE.Matrix4().makeRotationY(ry).setPosition(px,py,pz),bm=base.clone().multiply(m);
    M.add(tbox(.72,.86,.1,2),mats.wood,bm,0,0,0);M.add(new THREE.PlaneGeometry(.56,.7),mats.windows,bm,0,0,.056,0,0,0,1,1,1,false);
    M.add(tbox(.04,.7,.04),mats.wood,bm,0,0,.07);M.add(tbox(.56,.04,.04),mats.wood,bm,0,.05,.07);
    for(const s of [-1,1])M.add(tbox(.3,.8,.04,2),shutM,bm,s*.52,0,.12,0,s*.5);
    if(box){M.add(tbox(.8,.16,.24,2),mats.wood,bm,0,-.5,.14);
      for(let i=0;i<5;i++)M.add(new THREE.IcosahedronGeometry(.075,1),toon(['#ff6b8a','#ffd45c','#ffffff','#ff9ec4','#c9a3ff'][(i+v)%5],{rough:.6}),bm,-.3+i*.15,-.38,.16);
      M.add(new THREE.IcosahedronGeometry(.12,1),toon('#5a9a45'),bm,0,-.44,.15,0,0,0,3.2,.7,1);}
  };
  const bays=Math.max(1,Math.floor(w/2.2));
  for(let f=0;f<floors;f++){const wy=fh+H/floors*(f+.55);
    for(let i=0;i<bays*2;i++){const px=-w/2+(i+.5)*w/(bays*2);if(f===0&&Math.abs(px)<.9)continue;win(px,wy,d/2+.06,0,f===0);win(px,wy,-d/2-.06,Math.PI,false);}
    for(const s of [-1,1])win(s*(w/2+.06),wy,0,s*Math.PI/2,f===0);}
  // Corner tower on big houses.
  if(w>=6&&v%2===0){const tx=-w/2+.2,tz=d/2-.2,th=top+1.4;
    P(tcyl(1,1.05,fh,16,.8),mats.stone,tx,fh/2,tz);P(tcyl(.95,.95,th-fh,20,.7),wallM,tx,fh+(th-fh)/2,tz);
    P(tcyl(1.1,1.1,.16,20,1),mats.wood,tx,th,tz);P(tcone(1.25,2.1,20,.9),roofM,tx,th+1.05,tz);P(new THREE.SphereGeometry(.09,8,6),mats.gold,tx,th+2.15,tz);
    win(tx+.4,th-.7,tz+.86,.42,false);}
}
/** Prontera-style plaza fountain: octagonal basin, tiered bowls and a knight statue on top. */
function fountain(M:Merger,mats:Mats,group:THREE.Group,x:number,z:number){
  const base=new THREE.Matrix4().makeTranslation(x,0,z);const P=(g:THREE.BufferGeometry,m:THREE.Material,px:number,py:number,pz:number,rx=0,ry=0,rz=0,s=1)=>M.add(g,m,base,px,py,pz,rx,ry,rz,s,s,s);
  const white=tex(stoneBricks('#ece6da'),'#ffffff',.6,.6);
  P(tcyl(1.75,1.85,.55,8,.8),white,0,.27,0);P(tcyl(1.92,1.92,.12,8,.8),mats.stone,0,.58,0);
  P(tcyl(.55,.7,.9,8,1),white,0,.9,0);P(tcyl(1,.45,.22,16,1),white,0,1.4,0);P(tcyl(.3,.38,.7,8,1),white,0,1.8,0);P(tcyl(.62,.3,.14,16,1),white,0,2.2,0);
  P(tbox(.7,.35,.7,1),mats.stone,0,2.42,0);
  const water=new THREE.Mesh(new THREE.CircleGeometry(1.65,8),new THREE.MeshPhysicalMaterial({color:'#5fb8e8',roughness:.05,transmission:0,clearcoat:1,emissive:'#1f6aa0',emissiveIntensity:.25}));
  water.rotation.x=-Math.PI/2;water.rotation.z=Math.PI/8;water.position.set(x,.5,z);group.add(water);
  const bowl=new THREE.Mesh(new THREE.CircleGeometry(.9,16),water.material);bowl.rotation.x=-Math.PI/2;bowl.position.set(x,1.5,z);group.add(bowl);
  const statue=new Chibi({outfit:'swordman',hair:1,hairColor:'#ffffff',weapon:'sword',costumeBack:'heroCape'});
  statue.animate('attack',0,0,.2);const stone=toon('#e9e4da',{rough:.7});
  statue.root.traverse(o=>{if(o instanceof THREE.Mesh){o.material=stone;o.castShadow=true;}});
  statue.root.scale.setScalar(1.35);statue.root.position.set(x,2.6,z);statue.root.rotation.y=Math.PI/4;group.add(statue.root);
}
function lamp(M:Merger,mats:Mats,x:number,z:number,banner:THREE.Material|null,ry:number){
  const base=new THREE.Matrix4().makeTranslation(x,0,z);const P=(g:THREE.BufferGeometry,m:THREE.Material,px:number,py:number,pz:number,rx=0,yy=0,rz=0)=>M.add(g,m,base,px,py,pz,rx,yy,rz);
  P(tcyl(.16,.2,.3,8),mats.iron,0,.15,0);P(tcyl(.05,.07,2.3,8),mats.iron,0,1.4,0);P(new THREE.TorusGeometry(.09,.025,6,12),mats.gold,0,1,0,Math.PI/2);
  P(tcyl(.18,.12,.08,8),mats.iron,0,2.55,0);P(tbox(.05,.42,.05),mats.iron,-.13,2.78,-.13);P(tbox(.05,.42,.05),mats.iron,.13,2.78,.13);P(tbox(.05,.42,.05),mats.iron,-.13,2.78,.13);P(tbox(.05,.42,.05),mats.iron,.13,2.78,-.13);
  P(new THREE.ConeGeometry(.28,.3,4),mats.iron,0,3.12,0,0,Math.PI/4);P(new THREE.SphereGeometry(.05,8,6),mats.gold,0,3.3,0);
  if(banner){const bm=base.clone().multiply(new THREE.Matrix4().makeRotationY(ry));M.add(tbox(.7,.05,.05),mats.iron,bm,.35,2.25,0);
    M.add(new THREE.PlaneGeometry(.5,1.1),banner,bm,.38,1.65,0,0,0,0,1,1,1,true);M.add(new THREE.PlaneGeometry(.5,1.1),banner,bm,.38,1.65,-.001,0,Math.PI,0,1,1,1,true);}
}
let bannerMat:THREE.Material|null=null;
function banner(){
  if(bannerMat)return bannerMat;
  const t=canvasTexture(64,140,g=>{g.fillStyle='#2f5aa8';g.beginPath();g.moveTo(0,0);g.lineTo(64,0);g.lineTo(64,120);g.lineTo(32,140);g.lineTo(0,120);g.fill();
    g.strokeStyle='#f2cf63';g.lineWidth=4;g.strokeRect(5,5,54,108);g.fillStyle='#f2cf63';g.beginPath();g.moveTo(32,30);for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,r=i%2?8:18;g.lineTo(32+Math.cos(a)*r,58+Math.sin(a)*r);}g.fill();
    g.fillStyle='#ffffff';g.fillRect(14,86,36,4);g.fillRect(20,94,24,3);});
  bannerMat=new THREE.MeshStandardMaterial({map:t,roughness:.9,alphaTest:.5,side:THREE.DoubleSide,transparent:false});
  (bannerMat as THREE.MeshStandardMaterial).map!.colorSpace=THREE.SRGBColorSpace;return bannerMat;
}
/** Distant castle skyline (outside the walkable map, top of the screen). */
function castle(M:Merger,mats:Mats,x:number,z:number){
  const base=new THREE.Matrix4().makeTranslation(x,0,z).multiply(new THREE.Matrix4().makeRotationY(Math.PI/4));
  const wall=tex(stoneBricks('#e6dfd2'),'#ffffff',.85,.8),roof=tex(roofTiles('#3f6fb3'),'#ffffff',.5,1.1);
  const P=(g:THREE.BufferGeometry,m:THREE.Material,px:number,py:number,pz:number)=>M.add(g,m,base,px,py,pz);
  P(tbox(16,7,7,.35),wall,0,3.5,0);P(tbox(8,6,6,.35),wall,0,10,-.5);
  for(let i=0;i<9;i++)P(tbox(.9,.8,7.2,.5),wall,-7.6+i*1.9,7.4,0);
  for(const [tx,tz,r,h] of [[-8.5,1,2.2,13],[8.5,1,2.2,13],[-4,-1,1.6,17],[4,-1,1.6,17],[0,-.5,2.1,19]] as const){
    P(tcyl(r,r*1.06,h,20,.35),wall,tx,h/2,tz);P(tcyl(r*1.12,r*1.12,.5,20,.5),mats.stone,tx,h+.25,tz);P(tcone(r*1.3,r*2.6,20,.4),roof,tx,h+.5+r*1.3,tz);
    P(tcyl(.05,.05,1.6,6),mats.iron,tx,h+r*2.6+1.2,tz);
    for(let k=0;k<4;k++){const a=k/4*Math.PI*2+.4;M.add(new THREE.PlaneGeometry(.5,.9),mats.windows,base,tx+Math.cos(a)*r*1.01,h*.72,tz+Math.sin(a)*r*1.01,0,Math.PI/2-a,0,1,1,1,false);}
  }
  for(let i=0;i<5;i++)M.add(new THREE.PlaneGeometry(.6,1.2),mats.windows,base,-6+i*3,4,3.52,0,0,0,1,1,1,false);
  P(tbox(3,4.6,.4,.5),mats.dark,0,2.3,3.5);
}
/** Rolling hills (or cave walls) ringing the map so the horizon is never a flat plane. */
function hills(group:THREE.Group,map:MapData,set:GroundSet,theme:Theme){
  const g=hillsGeometry(map.w,map.h,map.def.seed,theme);
  const mat=tex(theme==='cave'?stoneBricks('#6a7690'):set.grass,theme==='cave'?'#ffffff':'#e8f0dc',.95,1);
  const mesh=new THREE.Mesh(g,mat);mesh.receiveShadow=true;group.add(mesh);
}

let flowerGeo:THREE.BufferGeometry|null=null;
/** Five separate oval petals: readable flower silhouettes rather than coloured beads. */
function flowerGeometry(){
  if(flowerGeo)return flowerGeo;
  const parts:THREE.BufferGeometry[]=[];
  for(let i=0;i<5;i++){const angle=i*Math.PI*2/5,g=new THREE.SphereGeometry(1,6,4);g.scale(.025,.009,.052);g.translate(0,0,.043);g.rotateY(angle);parts.push(g);}
  flowerGeo=mergeGeometries(parts)!;for(const p of parts)p.dispose();return flowerGeo;
}
/** Small town garden pockets and a bounded ambient flock. All placement stays off roads and NPCs. */
function gardenDetails(map:MapData,group:THREE.Group,M:Merger,b:Batcher,mats:Mats){
  const rr=prng(map.def.seed+207),centres:THREE.Vector3[]=[];
  const safe=(x:number,z:number)=>{
    if(x<3||z<3||x>map.w-3||z>map.h-3)return false;
    for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){const ix=Math.floor(x+dx),iz=Math.floor(z+dz),k=map.ground[iz*map.w+ix];if(map.blocked[iz*map.w+ix]||!(k===G.grass||k===G.grass2||k===G.flowers))return false;}
    return map.def.npcs.every(n=>Math.hypot(n.x+.5-x,n.y+.5-z)>3)&&map.def.warps.every(w=>Math.hypot(w.x+.5-x,w.y+.5-z)>4)&&Math.hypot(map.def.start.x-x,map.def.start.y-z)>3;
  };
  if(map.def.theme==='town')for(const house of map.props.filter(p=>p.kind==='house')){
    const candidates=[[house.x-(house.w??5)/2-1.8,house.y+1],[house.x+(house.w??5)/2+1.8,house.y-1],[house.x-1,house.y+(house.h??5)/2+1.8]];
    const site=candidates.find(([x,z])=>safe(x,z));if(!site)continue;const [x,z]=site,base=new THREE.Matrix4().makeTranslation(x,0,z);centres.push(new THREE.Vector3(x,.6,z));
    const P=(g:THREE.BufferGeometry,m:THREE.Material,px:number,py:number,pz:number)=>M.add(g,m,base,px,py,pz);
    // Curved garden rim, companion bench, and terracotta pot form a deliberate composition.
    const terracotta=toon('#b88064',{rough:.95});
    P(tcyl(.48,.43,.12,12),mats.stone,0,.06,.25);P(tcyl(.42,.42,.07,12),toon('#655344',{rough:1}),0,.13,.25);
    for(let j=0;j<7;j++){const a=j*2.4,d=.12+rr()*.25,fx=x+Math.cos(a)*d,fz=z+.25+Math.sin(a)*d;
      b.add('garden-leaf',new THREE.SphereGeometry(1,6,4),toon('#67905a',{rough:1}),new THREE.Vector3(fx,.17,fz),[0,a,0],new THREE.Vector3(.12,.065,.07),undefined,0,false);
      b.add('garden-bloom',flowerGeometry(),toon('#ffffff',{rough:.85}),new THREE.Vector3(fx,.24+rr()*.10,fz),[.15,a,0],1.3,['#fff5df','#d8b2d5','#ebaeae'][j%3],0,false);
    }
    for(const px of [-.42,.42]){P(tbox(.10,.4,.10),mats.iron,px,.2,-.63);P(tbox(.10,.4,.10),mats.iron,px,.2,-.93);}
    for(let j=0;j<3;j++)P(tbox(1.1,.06,.1,2),mats.wood,0,.42,-.63-j*.14);
    for(const px of [-.44,.44])P(tbox(.06,.75,.06),mats.iron,px,.39,-.99);
    for(const py of [.63,.78])P(tbox(1.1,.11,.06,2),mats.wood,0,py,-.99);
    P(tcyl(.20,.13,.28,10),terracotta,.83,.14,.08);P(tcyl(.22,.22,.045,10),terracotta,.83,.29,.08);
    b.add('garden-leaf',new THREE.SphereGeometry(1,6,4),toon('#67905a',{rough:1}),new THREE.Vector3(x+.83,.35,z+.08),[0,0,0],new THREE.Vector3(.23,.14,.23),undefined,0,false);
    if(house.v%2===0){P(tbox(.42,.38,.42,2),mats.wood,-.85,.19,.35);P(tbox(.34,.28,.34,2),mats.wood,-.82,.51,.35);}
    else{P(tcyl(.23,.23,.5,10,2),mats.wood,-.86,.25,.3);for(const y of [.1,.4])P(tcyl(.24,.24,.035,10),mats.iron,-.86,y,.3);}
  }
  // A few butterflies follow independent looping paths; no allocation occurs in the frame loop.
  if(!centres.length)for(const p of map.props.filter(p=>p.kind==='flower').slice(0,5))centres.push(new THREE.Vector3(p.x,.6,p.y));
  const wingGeo=new THREE.PlaneGeometry(.13,.16),wingMat=new THREE.MeshBasicMaterial({color:'#f4d195',side:THREE.DoubleSide});
  const flies=centres.slice(0,5).map((origin,i)=>{const root=new THREE.Group(),left=new THREE.Mesh(wingGeo,wingMat),right=new THREE.Mesh(wingGeo,wingMat);left.position.x=-.06;right.position.x=.06;root.add(left,right);root.scale.setScalar(.8);group.add(root);return {root,left,right,origin,phase:i*1.7};});
  return (t:number)=>{for(const f of flies){const p=t*.48+f.phase;f.root.position.set(f.origin.x+Math.sin(p)*.7,f.origin.y+.18+Math.sin(p*2.3)*.18,f.origin.z+Math.sin(p*.73)*.5);f.root.rotation.y=-p;f.left.rotation.y=Math.sin(t*14+f.phase)*.9;f.right.rotation.y=-f.left.rotation.y;}};
}

/** Shore details are constrained to existing water cells. No collision or navigation data changes. */
function pondGardens(map:MapData,group:THREE.Group,M:Merger,b:Batcher,mats:Mats){
  const isWater=(x:number,z:number)=>x>=0&&z>=0&&x<map.w&&z<map.h&&map.ground[z*map.w+x]===G.water;
  const random=prng(map.def.seed+902),seen=new Set<number>(),pools:number[][]=[];
  for(let z=1;z<map.h-1;z++)for(let x=1;x<map.w-1;x++){
    const id=z*map.w+x;if(!isWater(x,z)||seen.has(id))continue;
    const pool=[id];seen.add(id);
    for(let k=0;k<pool.length;k++){const cx=pool[k]%map.w,cz=Math.floor(pool[k]/map.w);
      for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=cx+dx,nz=cz+dz,ni=nz*map.w+nx;if(isWater(nx,nz)&&!seen.has(ni)){seen.add(ni);pool.push(ni);}}}
    pools.push(pool);
  }
  if(!pools.length)return null;
  const rock=new THREE.DodecahedronGeometry(1,1),reed=new THREE.ConeGeometry(.035,.65,4),pad=new THREE.CircleGeometry(.17,12,0,Math.PI*1.86);
  const rockM=tex(dirt('#a9b9b1'),'#ffffff',.94,.55),mossM=toon('#799c5a',{rough:1}),reedM=toon('#5f9867',{rough:1}),padM=toon('#6fba81',{rough:.6});
  const flowerM=toon('#fff0dd',{rough:.8}),foamM=new THREE.MeshBasicMaterial({color:'#d7f8ef',transparent:true,opacity:.44,depthWrite:false});
  const flow=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:{time:{value:0}},
    vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`uniform float time;varying vec2 vUv;void main(){float edge=smoothstep(0.,.12,vUv.x)*smoothstep(0.,.12,1.-vUv.x);
      float streak=pow(.5+.5*sin(vUv.x*96.+sin(vUv.y*9.+time*4.)*.6),3.);
      float run=.5+.5*sin(vUv.y*42.+time*10.+vUv.x*12.);
      vec3 c=mix(vec3(.15,.61,.66),vec3(.88,.99,1.),streak*.65+run*.2);
      gl_FragColor=vec4(c,edge*(.53+streak*.33));
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`});
  for(const pool of pools){
    // Clusters follow real shorelines instead of a regular decorative grid.
    for(const id of pool){const x=id%map.w,z=Math.floor(id/map.w),shore=!isWater(x-1,z)||!isWater(x+1,z)||!isWater(x,z-1)||!isWater(x,z+1);
      if(shore&&random()<.31){const px=x+.3+random()*.4,pz=z+.3+random()*.4,sz=.18+random()*.18;
        b.add('shore-rock',rock,rockM,new THREE.Vector3(px,.07,pz),[0,random()*6,.1],new THREE.Vector3(sz,.15+sz*.3,sz*.8));
        b.add('shore-moss',rock,mossM,new THREE.Vector3(px,.19,pz),[0,random()*6,0],new THREE.Vector3(sz*.8,.035,sz*.7));
        for(let j=0;j<3;j++)b.add('shore-reed',reed,reedM,new THREE.Vector3(x+.25+j*.13,.24,z+.6),[.12,random()*6,.1],.7+random()*.4,undefined,0,false);
      }else if(random()<.07){const px=x+.2+random()*.6,pz=z+.2+random()*.6;
        b.add('lily',pad,padM,new THREE.Vector3(px,.066,pz),[-Math.PI/2,0,random()*6],.8+random()*.5,undefined,0,false);
        if(random()<.35)b.add('water-blossom',new THREE.IcosahedronGeometry(.065,1),flowerM,new THREE.Vector3(px,.10,pz),[0,0,0],new THREE.Vector3(1,.55,1),undefined,0,false);
      }
    }
    // A three-by-three water footprint keeps the raised rock and fall off every walkable tile.
    const site=pool.find(id=>{const x=id%map.w,z=Math.floor(id/map.w);return [-1,0,1].every(dz=>[-1,0,1].every(dx=>isWater(x+dx,z+dz)));});
    if(site===undefined||pool.length<24)continue;
    const x=site%map.w+.5,z=Math.floor(site/map.w)+.5;
    for(const side of [-1,1])for(let j=0;j<3;j++){
      b.add('shore-rock',rock,rockM,new THREE.Vector3(x+side*.66,.25+j*.48,z-.26),[.12,side+j*.5,.05],new THREE.Vector3(.43,.37,.55));
      b.add('shore-moss',rock,mossM,new THREE.Vector3(x+side*.66,1.51,z-.24),[0,side,0],new THREE.Vector3(.40,.065,.45));
    }
    b.add('shore-rock',rock,rockM,new THREE.Vector3(x,1.35,z-.6),[0,.4,0],new THREE.Vector3(.58,.17,.28));
    const fall=new THREE.Mesh(new THREE.PlaneGeometry(.85,1.35,1,6),flow);fall.position.set(x,.77,z+.06);fall.name='animated-waterfall';group.add(fall);
    for(let j=0;j<3;j++){const ring=new THREE.Mesh(new THREE.RingGeometry(.14+j*.16,.19+j*.17,32),foamM);ring.rotation.x=-Math.PI/2;ring.position.set(x,.075+j*.002,z+.16);ring.scale.y=.6;group.add(ring);}
  }
  // Boardwalk dressing only on existing traversable paths crossing water. It does not add routes.
  for(let z=2;z<map.h-2;z++)for(let x=2;x<map.w-2;x++){
    const code=map.ground[z*map.w+x];if(map.blocked[z*map.w+x]||(code!==G.path&&code!==G.stone))continue;
    const horizontal=isWater(x,z-2)&&isWater(x,z+2),vertical=isWater(x-2,z)&&isWater(x+2,z);
    if(!horizontal&&!vertical)continue;
    const base=new THREE.Matrix4().makeRotationY(horizontal?0:Math.PI/2).setPosition(x+.5,0,z+.5);
    for(let j=0;j<4;j++)M.add(tbox(.23,.025,.98,2),mats.wood,base,-.375+j*.25,.005,0);
  }
  return flow;
}

export type WorldView={group:THREE.Group;water:THREE.ShaderMaterial|null;lamps:THREE.PointLight[];lampGlows:THREE.Mesh[];windows:THREE.MeshBasicMaterial[];portals:THREE.Group[];fountains:THREE.Vector3[];crystals:THREE.Vector3[];
  update:(t:number,night:number)=>void};

export function buildWorld(map:MapData):WorldView{
  const group=new THREE.Group();const theme=map.def.theme;const set=groundSet(theme,map.def.variant);
  // Ground.
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(map.w,map.h),groundMaterial(set,splatMask(map),map.w,map.h));
  ground.rotation.x=-Math.PI/2;ground.position.set(map.w/2,0,map.h/2);ground.receiveShadow=true;ground.name='ground';group.add(ground);
  if(theme==='town'){
    // A stone-and-brass compass inlay makes the large plaza a recognisable meeting place.
    const crest=canvasTexture(1024,1024,c=>{
      const cx=512,cy=512;c.translate(cx,cy);
      c.strokeStyle='#b3a88e';c.lineWidth=20;c.beginPath();c.arc(0,0,480,0,Math.PI*2);c.stroke();
      c.strokeStyle='#e5cc86';c.lineWidth=8;c.beginPath();c.arc(0,0,466,0,Math.PI*2);c.stroke();
      c.strokeStyle='#7c9b9e';c.lineWidth=9;c.beginPath();c.arc(0,0,394,0,Math.PI*2);c.stroke();
      for(let i=0;i<8;i++){c.save();c.rotate(i*Math.PI/4);c.fillStyle=i%2?'#a8b5ad':'#6f929e';c.beginPath();c.moveTo(0,-420);c.lineTo(45,-230);c.lineTo(0,-150);c.lineTo(-45,-230);c.closePath();c.fill();c.restore();}
    });
    const inlay=new THREE.Mesh(new THREE.PlaneGeometry(10,10),new THREE.MeshStandardMaterial({map:crest,transparent:true,depthWrite:false,roughness:.95}));
    inlay.rotation.x=-Math.PI/2;inlay.position.set(24,.016,24);inlay.receiveShadow=true;group.add(inlay);
  }
  const outerGeo=new THREE.PlaneGeometry(400,400);const ouv=outerGeo.attributes.uv as THREE.BufferAttribute;for(let i=0;i<ouv.count;i++)ouv.setXY(i,ouv.getX(i)*400*set.scale[0],ouv.getY(i)*400*set.scale[0]);
  const outer=new THREE.Mesh(outerGeo,tex(set.grass,'#dfe8d4',.95));outer.rotation.x=-Math.PI/2;outer.position.set(map.w/2,-.04,map.h/2);outer.receiveShadow=true;group.add(outer);
  hills(group,map,set,theme);
  // Water.
  let water:THREE.ShaderMaterial|null=null;
  if(map.ground.some(c=>c===G.water)){
    water=new THREE.ShaderMaterial({transparent:true,depthWrite:false,fog:true,uniforms:{...THREE.UniformsLib.fog,mask:{value:waterMask(map)},time:{value:0},deep:{value:new THREE.Color(map.def.variant==='lava'||map.def.variant==='forge'?'#c0300a':map.def.variant==='bay'?'#1aa8c0':map.def.variant==='swamp'?'#3a5a3a':map.def.variant==='astral'?'#3a2a8a':theme==='cave'?'#1f5a9a':'#178f9e')},shallow:{value:new THREE.Color(map.def.variant==='lava'||map.def.variant==='forge'?'#ffb040':map.def.variant==='bay'?'#b8f4f0':map.def.variant==='swamp'?'#7a9a6a':map.def.variant==='astral'?'#a88aff':theme==='cave'?'#9fe0ff':'#9de1cd')}},
      vertexShader:`varying vec2 vUv;varying vec3 vW;
#include <fog_pars_vertex>
        void main(){vUv=uv;vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;vec4 mvPosition=viewMatrix*w;gl_Position=projectionMatrix*mvPosition;
        #include <fog_vertex>
        }`,
      fragmentShader:`uniform sampler2D mask;uniform float time;uniform vec3 deep;uniform vec3 shallow;varying vec2 vUv;varying vec3 vW;
#include <fog_pars_fragment>
        float n(vec2 p){return sin(p.x)*sin(p.y);}
        void main(){float m=texture2D(mask,vUv).r;if(m<.02)discard;
          float w=n(vW.xz*3.+time*1.2)+n(vW.zx*4.3-time*.9)*.6+n(vW.xz*9.-time*2.)*.25;vec3 c=mix(shallow,deep,smoothstep(.2,.95,m));
          vec3 V=normalize(cameraPosition-vW);float fr=pow(clamp(1.-V.y,0.,1.),3.);c=mix(c,vec3(.85,.95,1.),fr*.5);
          float sp=pow(clamp(w*.53,0.,1.),14.)*.65;c+=vec3(sp);float caustic=pow(.5+.5*sin(vW.x*8.+sin(vW.z*7.+time)),12.)*.09;c+=vec3(caustic*.6,caustic,caustic);c=mix(vec3(.88,.98,.95),c,smoothstep(.0,.28,m)*.88+.12);
          gl_FragColor=vec4(c,.78*smoothstep(.0,.22,m));
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
        }`});
    const wm=new THREE.Mesh(new THREE.PlaneGeometry(map.w,map.h),water);wm.rotation.x=-Math.PI/2;wm.position.set(map.w/2,.04,map.h/2);wm.renderOrder=1;group.add(wm);
  }
  const b=new Batcher(),M=new Merger();const R=(p:Prop)=>prng(Math.floor(p.x*131+p.y*977));
  const V=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z);
  const windows=new THREE.MeshBasicMaterial({color:'#bfe4ff',toneMapped:false});
  const mats:Mats={stone:tex(stoneBricks('#cfc6b6'),'#ffffff',.85,.9),wood:tex(planks('#5e4230'),'#ffffff',.8),dark:toon('#4a3a32',{rough:.8}),iron:metal('#3a3a44',.5),gold:metal('#e0b050',.3),windows};
  const leafPal=theme==='ruins'?['#8fbf8a','#a3c99a','#c9a3d8','#7fb09a']:theme==='town'?['#7fc25a','#e8a04a','#9ccf6e','#f2c14e','#6fb85a']:theme==='forest'?['#4f9a4a','#3f8a46','#5aa356','#6aaf5a']:['#7fc25a','#6cb352','#8fcf62','#78bd5a'];
  const leafMat=new THREE.MeshStandardMaterial({map:leaves('#e7eddb').map,normalMap:leaves('#e7eddb').normal,normalScale:new THREE.Vector2(.35,.35),roughness:.92,vertexColors:true});
  leafMat.onBeforeCompile=shader=>{shader.uniforms.uWind=windTime;shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nuniform float uWind;').replace('#include <begin_vertex>',`#include <begin_vertex>
#ifdef USE_INSTANCING
vec2 treePos=instanceMatrix[3].xz;float crownHeight=instanceMatrix[3].y;
float breeze=sin(uWind*.85+treePos.x*.37+treePos.y*.29);transformed.x+=breeze*.025*clamp(crownHeight,0.,3.);transformed.z+=sin(uWind*.67+treePos.x*.23)*.018;
#endif`);};
  const barkMat=tex(bark(),'#ffffff',.9);
  const geo={trunk:tcyl(.1,.17,1,10,1.5),crown:crownGeometry(3),crown2:crownGeometry(9),cone:(()=>{const g=tcone(1,1,14,2);return g;})(),sphere:new THREE.SphereGeometry(1,16,12),
    rock:new THREE.DodecahedronGeometry(1,1),blade:new THREE.ConeGeometry(.03,.3,4),petal:new THREE.IcosahedronGeometry(.055,1),crystal:new THREE.OctahedronGeometry(1,0),cyl:tcyl(1,1,1,12),box:tbox(1,1,1)};
  const rockMat=tex(dirt(theme==='cave'?'#8a96ae':'#b8b2a6'),'#ffffff',.9,1.4);
  const lamps:THREE.PointLight[]=[],lampGlows:THREE.Mesh[]=[],fountains:THREE.Vector3[]=[],crystals:THREE.Vector3[]=[];
  const pineCol=theme==='cave'?'#7f9fb8':'#3f7f4a';
  for(const p of map.props){
    const r=R(p),x=p.x,z=p.y,v=p.v;
    switch(p.kind){
      case 'tree':{const h=.85+r()*.85,lean=(r()-.5)*.16,slender=v%4===1;
        b.add('trunk',geo.trunk,barkMat,V(x,h/2,z),[lean,r()*3,lean*.5],V(1.1,h,1.1));
        const col=leafPal[(v+Math.floor(r()*3))%leafPal.length];
        if(v%7===3){for(let i=0;i<4;i++)b.add('pine',geo.cone,leafMat,V(x+lean*i*.2,h*.6+i*.42,z),[0,r()*6,lean],V(.72-i*.14,.85,.72-i*.14),new THREE.Color('#77a975').offsetHSL(0,0,i*.025));}
        else {const yaw=r()*6,spread=slender?.65:1.05;
          for(let j=0;j<5;j++){const a=yaw+j*2.4,side=j===4?0:.35+r()*.2,oy=j===4?h+1.25:h+.25+r()*.45,sz=j===4?.47:.45+r()*.17;
            const key=j%2?'crown':'crown2';b.add(key,j%2?geo.crown:geo.crown2,leafMat,V(x+Math.cos(a)*side*spread+lean,oy,z+Math.sin(a)*side*spread),[r()*.4,r()*6,lean],V(sz*spread,sz*(slender?1.35:.8),sz),new THREE.Color(col).offsetHSL(0,(r()-.5)*.08,(r()-.5)*.09));}}
        break;}
      case 'bigTree':{b.add('trunk',geo.trunk,barkMat,V(x,1.1,z),[.05,r()*3,-.08],V(2.3,2.2,2.5));
        for(const [ox,oy,oz,s] of [[0,2.8,0,1.25],[-.8,2.3,.3,.9],[.8,2.4,-.2,.95],[0,3.5,0,.85],[.3,2.5,.8,.8],[-.4,2.5,-.8,.8]])b.add('crown',geo.crown,leafMat,V(x+ox+(r()-.5)*.25,oy+(r()-.5)*.3,z+oz),[r()*.5,r()*6,.1],V(s*(.8+r()*.3),s*(.7+r()*.4),s),new THREE.Color(leafPal[v%leafPal.length]).offsetHSL(0,0,(r()-.5)*.08));break;}
      case 'pine':{b.add('trunk',geo.trunk,barkMat,V(x,.35,z),[0,0,0],V(1,.7,1));
        for(let i=0;i<4;i++)b.add('pine',geo.cone,leafMat,V(x,.9+i*.5,z),[0,r()*3,0],V(.82-i*.17,.9,.82-i*.17),new THREE.Color(pineCol).offsetHSL(0,0,i*.03+(v%3)*.02));
        if(theme==='cave')b.add('snowcap',geo.cone,toon('#f4fbff',{rough:.4}),V(x,2.55,z),[0,0,0],V(.25,.35,.25));break;}
      case 'bush':for(const [ox,oz,s] of [[0,0,.36],[.22,.1,.27],[-.18,.12,.24]])b.add('bush',geo.crown2,leafMat,V(x+ox,s*.75,z+oz),[0,r()*6,0],V(s,s*.8,s),leafPal[((v+Math.floor(ox*10))%leafPal.length+leafPal.length)%leafPal.length]);
        if(v%2)for(let i=0;i<4;i++)b.add('berry',geo.petal,toon('#ffffff',{rough:.3}),V(x-.15+i*.1,.42+r()*.1,z+.22),[0,0,0],1,v===1?'#ff5a6a':'#fff6f0',0,false);break;
      case 'rock':if(theme!=='cave')b.add('moss',geo.rock,toon('#779754',{rough:1}),V(x,.35,z),[0,r()*3,0],V(.31,.085,.27));b.add('rock',geo.rock,rockMat,V(x,.2,z),[r(),r()*3,r()],V(.42,.3,.38),theme==='cave'?'#9aa8c0':'#d8d2c8');
        if(r()<.5)b.add('rock',geo.rock,rockMat,V(x+.3,.1,z+.2),[r(),r()*3,r()],V(.2,.15,.18),'#c8c2b8');break;
      case 'flower':for(let i=0;i<3;i++){const fx=x+(r()-.5)*.6,fz=z+(r()-.5)*.6,h=.13+r()*.16;
        b.add('stem',geo.blade,toon('#4f9a45'),V(fx,h*.5,fz),[0,0,0],V(.65,h/.3,.65),undefined,0,false);
        b.add('flower-bloom',flowerGeometry(),toon('#ffffff',{rough:.85}),V(fx,h,fz),[.12,r()*6,.08],.8+r()*.5,['#fff9e8','#ffd483','#edacc9','#b8a7d9'][(v+i)%4],0,false);
        b.add('flower-heart',geo.petal,toon('#e5b458',{rough:.9}),V(fx,h+.014,fz),[0,0,0],V(.4,.2,.4),undefined,0,false);}break;
      case 'tuft':if(theme==='cave'&&v===3){b.add('crystalS',geo.crystal,glow('#9fe0ff',1.4),V(x,.12,z),[0,r(),0],V(.06,.16,.06),undefined,0,false);break;}
        for(let i=0;i<3;i++)b.add('tuft-blades',bladeGeometryCached(),bladeMaterial(),V(x+(r()-.5)*.4,0,z+(r()-.5)*.4),[0,r()*3,0],.8+r()*.5,theme==='forest'?'#7fae68':theme==='cave'?'#9aa8b8':'#b8d890',0,false);break;
      case 'mushroom':b.add('mstem',geo.cyl,toon('#fff6e6'),V(x,.07,z),[0,0,0],V(.03,.14,.03),undefined,0,false);b.add('mcap',geo.sphere,toon('#ffffff',{emissive:'#ff6a5a',emissiveIntensity:.12,rough:.4}),V(x,.15,z),[0,0,0],V(.09,.06,.09),['#e96a5b','#b07ad9','#f2a93b','#e96a5b'][v%4],0,false);break;
      case 'log':b.add('log',geo.cyl,barkMat,V(x,.17,z),[0,r()*3,Math.PI/2],V(.17,.95,.17));break;
      case 'pillar':{const h=1.8+r()*1.6,broken=r()<.35,marble=tex(stoneBricks('#efe7d8'),'#ffffff',.55,.5);
        b.add('pillarBase',geo.box,marble,V(x,.15,z),[0,0,0],V(.7,.3,.7));
        b.add('pillar',geo.cyl,marble,V(x,h*(broken?.35:.5)+.3,z),[0,0,0],V(.24,h*(broken?.7:1),.24));
        if(!broken)b.add('pillarCap',geo.box,marble,V(x,h+.4,z),[0,r()*.3,0],V(.68,.2,.68));
        else b.add('rubble',geo.rock,rockMat,V(x+.3,.15,z+.2),[r(),r(),r()],V(.24,.17,.2),'#e8e0d0');
        if(r()<.25){const gem=new THREE.Mesh(new THREE.OctahedronGeometry(.12),glow('#c9a3ff',2));gem.position.set(x,h+.75,z);group.add(gem);crystals.push(V(x,h+.7,z));}break;}
      case 'stalagmite':b.add('stal',geo.cone,rockMat,V(x,.65,z),[0,r()*3,(r()-.5)*.2],V(.3,1.3+r()*.5,.3),'#a8b4c8');break;
      case 'caveWall':for(let i=0;i<3;i++)b.add('wall',geo.rock,rockMat,V(x+(r()-.5)*.3,.6+i*.7,z+(r()-.5)*.3),[r(),r()*3,r()],V(.7,1-i*.25,.7),['#7f8ca2','#8794aa','#76839a'][v%3]);break;
      case 'crystal':{const col=['#9fd5ff','#c9a3ff','#a8f0e8','#9fd5ff'][v%4];for(let i=0;i<3;i++){const h=.5+r()*.6;b.add(`cr${v%4}`,geo.crystal,glow(col,1.5),V(x+(r()-.5)*.35,h*.55,z+(r()-.5)*.35),[(r()-.5)*.4,r()*3,(r()-.5)*.4],V(.13,h,.13));}crystals.push(V(x,.6,z));break;}
      case 'lamp':{lamp(M,mats,x,z,theme==='town'?banner():null,Math.atan2(map.h/2-z,map.w/2-x)*-1);
        const lg=new THREE.Mesh(new THREE.BoxGeometry(.2,.32,.2),glow('#ffd88a',1.4));lg.position.set(x,2.78,z);group.add(lg);lampGlows.push(lg);
        if(lamps.length<8){const pl=new THREE.PointLight('#ffcf7a',0,8,1.6);pl.position.set(x,2.7,z);group.add(pl);lamps.push(pl);}break;}
      case 'fountain':fountain(M,mats,group,x,z);fountains.push(V(x,2.3,z));break;
      case 'house':house(M,mats,x,z,(p.w??5)-.5,(p.h??5)-.5,v);break;
      case 'stall':{const base=new THREE.Matrix4().makeTranslation(x,0,z);
        M.add(tbox(1.7,.7,.75,2),tex(planks('#a9744c')),base,0,.35,0);for(const s of [-1,1])for(const zz of [-.32,.3])M.add(tcyl(.04,.04,1.7,6),mats.wood,base,s*.8,.85,zz);
        const stripes=canvasTexture(128,32,g=>{for(let i=0;i<8;i++){g.fillStyle=i%2?'#ffffff':(v?'#3f6fb3':'#d9534f');g.fillRect(i*16,0,16,32);}});
        M.add(tbox(1.9,.06,1.1),new THREE.MeshStandardMaterial({map:stripes,roughness:.9}),base,0,1.7,0,.28);
        for(let i=0;i<6;i++)M.add(new THREE.IcosahedronGeometry(.09,1),toon(['#e8524a','#ffd45c','#7fc25a','#ff9ec4','#f39a3a','#9fd5ff'][i],{rough:.4}),base,-.62+i*.25,.79,.1);
        M.add(tbox(.36,.3,.36,2),mats.wood,base,1.1,.15,.2);M.add(tcyl(.2,.2,.45,10,2),mats.wood,base,-1.1,.22,.15);break;}
      case 'fence':{const base=new THREE.Matrix4().makeTranslation(x,0,z);for(const side of [-1,1])M.add(tbox(.1,.8,.1),mats.wood,base,side*.43,.4,0);for(const y of [.28,.59])M.add(tbox(.95,.07,.06),mats.wood,base,0,y,0);break;}
      case 'sign':{const base=new THREE.Matrix4().makeTranslation(x,0,z).multiply(new THREE.Matrix4().makeRotationY(.6));
        M.add(tbox(.1,1.2,.1,2),mats.wood,base,0,.6,0);M.add(tbox(.85,.58,.09,2),tex(planks('#b07a48')),base,0,1.05,0);
        const notice=canvasTexture(128,80,g=>{g.fillStyle='#eee1bf';g.fillRect(0,0,128,80);g.fillStyle='#64503a';g.font='bold 18px sans-serif';g.fillText('晨光告示',26,27);g.fillStyle='#ad8262';for(let j=0;j<3;j++)g.fillRect(15,39+j*10,82-j*12,3);g.fillStyle='#8e6654';g.beginPath();g.arc(109,63,7,0,Math.PI*2);g.fill();});
        M.add(new THREE.PlaneGeometry(.73,.46),new THREE.MeshStandardMaterial({map:notice,roughness:1}),base,0,1.05,.051);
        break;}
    }
  }
  // Wind-swept grass over the open fields (non-blocking, purely visual).
  if(theme!=='cave'){
    const rr=prng(map.def.seed+77),bc=theme==='forest'?'#8fbf70':theme==='ruins'?'#c8dca0':'#c8e8a0';
    // Low-frequency meadow patches leave broad quiet spaces; samples are not snapped to tiles.
    const count=Math.floor(map.w*map.h*(theme==='town'?.44:1.15));
    for(let i=0;i<count;i++){const x=1+rr()*(map.w-2),z=1+rr()*(map.h-2),ix=Math.floor(x),iz=Math.floor(z),k=map.ground[iz*map.w+ix];
      const patch=(Math.sin(x*.29+map.def.seed)*Math.cos(z*.23)+Math.sin((x+z)*.16)*.55+1.55)/3.1;
      if((k===G.grass||k===G.grass2||k===G.darkGrass||k===G.flowers)&&!map.blocked[iz*map.w+ix]&&patch>.43&&rr()<patch*.7){
        const height=.35+rr()*.55;
        b.add('blades',bladeGeometryCached(),bladeMaterial(),V(x,0,z),[0,rr()*6,0],V(.65+rr()*.6,height,.65+rr()*.6),new THREE.Color(bc).offsetHSL(0,(rr()-.5)*.08,(rr()-.5)*.07),0,false);}}
  }
  const ambience=theme==='cave'?null:gardenDetails(map,group,M,b,mats);
  const waterDetails=theme==='cave'?null:pondGardens(map,group,M,b,mats);
  if(theme==='town')castle(M,mats,-14,-14);
  b.build(group);M.build(group);
  const nature=attachNature(map,group),village=attachVillage(map,group);
  group.userData.disposeVisuals=()=>{nature.dispose();village.dispose();};
  void nature.ready.then(loaded=>{group.userData.natureReady=loaded;});
  void village.ready.then(loaded=>{group.userData.villageReady=loaded;});
  // Warp portals: a glowing ring, a light column and a soft floor glow.
  const portals:THREE.Group[]=[];
  for(const wp of map.def.warps){
    const pg=new THREE.Group();pg.position.set(wp.x+.5,0,wp.y+.5);
    const ring=new THREE.Mesh(new THREE.TorusGeometry(.75,.06,10,40),glow('#7fe8ff',2));ring.rotation.x=Math.PI/2;ring.position.y=.08;pg.add(ring);
    const floor=new THREE.Mesh(new THREE.CircleGeometry(.8,32),additive('#5fd0ff',.4));floor.rotation.x=-Math.PI/2;floor.position.y=.05;pg.add(floor);
    const col=new THREE.Mesh(new THREE.CylinderGeometry(.7,.75,2.4,32,1,true),additive('#8fe8ff',.55,beamTexture()));col.position.y=1.2;pg.add(col);
    group.add(pg);portals.push(pg);
  }
  return {group,water,lamps,lampGlows,windows:[windows],portals,fountains,crystals,update:(t,night)=>{
    nature.update(t);if(ambience)ambience(t);if(water)water.uniforms.time.value=t;if(waterDetails)waterDetails.uniforms.time.value=t;windTime.value=t;
    for(const l of lamps)l.intensity=night*7;
    for(const g of lampGlows)(g.material as THREE.MeshBasicMaterial).color.set('#ffd88a').multiplyScalar(.6+night*1.6);
    windows.color.set(night>.3?'#ffd98a':'#a8c8e0').multiplyScalar(night>.3?1+night:.75);
    portals.forEach((p,i)=>{p.children[0].rotation.z=t*1.5+i;const c=p.children[2] as THREE.Mesh;c.scale.x=c.scale.z=1+Math.sin(t*3+i)*.05;});
  }};
}
const windTime={value:0};
let bladeGeo:THREE.BufferGeometry|null=null,bladeMat:THREE.MeshStandardMaterial|null=null;
function bladeGeometryCached(){return bladeGeo??=bladeGeometry();}
/** Alpha-tested grass cards that sway in the wind (tips move, roots stay put). */
function bladeMaterial(){
  if(bladeMat)return bladeMat;
  bladeMat=new THREE.MeshStandardMaterial({map:grassBlades(),alphaTest:.45,side:THREE.DoubleSide,roughness:.9});
  bladeMat.onBeforeCompile=sh=>{sh.uniforms.uWind=windTime;
    sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nuniform float uWind;').replace('#include <begin_vertex>',`#include <begin_vertex>
  #ifdef USE_INSTANCING
  vec2 ip=instanceMatrix[3].xz;
  #else
  vec2 ip=vec2(0.);
  #endif
  float sw=sin(uWind*1.7+ip.x*.6+ip.y*.4)*.5+sin(uWind*3.1+ip.x*1.3)*.2;transformed.x+=sw*.12*uv.y;transformed.z+=sw*.06*uv.y;`);};
  return bladeMat;
}
