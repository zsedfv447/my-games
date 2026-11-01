// Shared material helpers. v4 switched from hard cel shading + ink outlines to soft, image-lit
// "modern mobile MMO" shading: physically based materials lit by the sky environment map.
import * as THREE from 'three';

type MatOpts={emissive?:THREE.ColorRepresentation;emissiveIntensity?:number;map?:THREE.Texture;normalMap?:THREE.Texture;normalScale?:number;roughnessMap?:THREE.Texture;
  transparent?:boolean;opacity?:number;side?:THREE.Side;rough?:number;metal?:number;sheen?:boolean};
const cache=new Map<string,THREE.MeshStandardMaterial>();
/** Soft PBR material (name kept from the toon era so every model upgraded at once). */
export function toon(color:THREE.ColorRepresentation,opts:MatOpts={}):THREE.MeshStandardMaterial{
  const key=`${new THREE.Color(color).getHexString()}|${opts.emissive?new THREE.Color(opts.emissive).getHexString():''}|${opts.emissiveIntensity??0}|${opts.map?.uuid??''}|${opts.normalMap?.uuid??''}|${opts.opacity??1}|${opts.side??0}|${opts.rough??''}|${opts.metal??''}|${opts.sheen??''}`;
  let m=cache.get(key);
  if(!m){
    const params:THREE.MeshPhysicalMaterialParameters={color,map:opts.map,normalMap:opts.normalMap,roughnessMap:opts.roughnessMap,roughness:opts.rough??.72,metalness:opts.metal??0,
      transparent:opts.transparent||opts.opacity!==undefined&&opts.opacity<1,opacity:opts.opacity??1,side:opts.side??THREE.FrontSide};
    if(opts.sheen){const p=new THREE.MeshPhysicalMaterial({...params,sheen:.6,sheenRoughness:.6,sheenColor:new THREE.Color(color).lerp(new THREE.Color('#ffffff'),.5)});m=p;}
    else m=new THREE.MeshStandardMaterial(params as THREE.MeshStandardMaterialParameters);
    if(opts.normalMap)m.normalScale.setScalar(opts.normalScale??1);
    if(opts.emissive){m.emissive=new THREE.Color(opts.emissive);m.emissiveIntensity=opts.emissiveIntensity??1;}
    cache.set(key,m);
  }
  return m;
}
/** Polished metal (armour, blades, gold trim). */
export const metal=(color:THREE.ColorRepresentation,rough=.32)=>toon(color,{metal:.85,rough});
/** Cloth with a velvet sheen. */
export const cloth=(color:THREE.ColorRepresentation)=>toon(color,{sheen:true,rough:.85});
/** Glossy jelly / gem surface. */
export function glossy(color:THREE.ColorRepresentation,opacity=1,emissive?:THREE.ColorRepresentation):THREE.MeshPhysicalMaterial{
  return new THREE.MeshPhysicalMaterial({color,roughness:.12,metalness:0,clearcoat:1,clearcoatRoughness:.08,transparent:opacity<1,opacity,
    emissive:emissive?new THREE.Color(emissive):undefined,emissiveIntensity:emissive?.18:0,sheen:.4,sheenColor:new THREE.Color('#ffffff')});
}
const outlineCache=new Map<string,THREE.MeshBasicMaterial>();
export function outlineMat(color:THREE.ColorRepresentation='#2a1f2a'){
  const key=new THREE.Color(color).getHexString();let m=outlineCache.get(key);
  if(!m){m=new THREE.MeshBasicMaterial({color,side:THREE.BackSide});outlineCache.set(key,m);}
  return m;
}
/** A shadow-casting mesh wrapped in a group. Outlines were dropped in v4; the thickness argument is ignored. */
export function inked(geo:THREE.BufferGeometry,mat:THREE.Material,_thickness=0,_outline?:THREE.ColorRepresentation):THREE.Group{
  const g=new THREE.Group();
  const m=new THREE.Mesh(geo,mat);m.castShadow=true;m.receiveShadow=true;g.add(m);
  return g;
}
export function glow(color:THREE.ColorRepresentation,intensity=2):THREE.MeshBasicMaterial{
  const c=new THREE.Color(color).multiplyScalar(intensity);
  return new THREE.MeshBasicMaterial({color:c,toneMapped:false});
}
export function additive(color:THREE.ColorRepresentation,opacity=1,map?:THREE.Texture):THREE.MeshBasicMaterial{
  return new THREE.MeshBasicMaterial({color:new THREE.Color(color),transparent:true,opacity,blending:THREE.AdditiveBlending,depthWrite:false,...(map?{map}:{}),side:THREE.DoubleSide,toneMapped:false});
}
export function canvasTexture(w:number,h:number,paint:(g:CanvasRenderingContext2D)=>void):THREE.CanvasTexture{
  const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d')!;g.lineCap='round';g.lineJoin='round';paint(g);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t;
}
