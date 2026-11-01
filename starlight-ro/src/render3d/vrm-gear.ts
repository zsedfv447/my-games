// Job outfits for VRoid avatars. Their own clothes are re-dyed into the job's palette (the
// garment's folds and seams are kept by remapping the texture's brightness onto job colours, and
// modern accessories like neckties are hidden), then job gear is layered on: swordman tabard,
// breastplate, pauldrons and cape; mage floor-length robe, wizard hat and cape; archer leather
// vest, skirt, feathered cap, quiver and short cape; novice belt and satchel. Pieces hang off
// humanoid bones (VRM 0.x bone space: the avatar faces -Z, so its back is +Z).
import * as THREE from 'three';
import type { VRM } from '@pixiv/three-vrm';
import { cartoonize } from './hero';

const mat=(color:string,opts:THREE.MeshStandardMaterialParameters={})=>cartoonize(new THREE.MeshStandardMaterial({color,roughness:.7,...opts}),{sat:1.15,bright:1.05});
function capeGeometry(w:number,len:number){
  const g=new THREE.PlaneGeometry(w,len,8,12);g.translate(0,-len/2,0);
  const p=g.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i);p.setX(i,x*(1+(-y/len)*.45));p.setZ(i,Math.abs(x)*-.25+Math.cos(x*22)*.006-y*.05);}
  g.computeVertexNormals();return g;
}
export type Gear={dispose():void;tick(t:number,moving:boolean):void};
type Palette={tops:[string,string];bottoms:[string,string];shoes:[string,string]};
const PALETTES:Record<string,Palette>={
  swordman:{tops:['#4a1418','#d24a46'],bottoms:['#1f1a24','#5a4a5e'],shoes:['#2a1a12','#7a5234']},
  mage:{tops:['#1c1440','#7a62d8'],bottoms:['#16102e','#4a3a8a'],shoes:['#1a1228','#4a3a62']},
  archer:{tops:['#13301e','#5aa56a'],bottoms:['#2a1e14','#7a5a3c'],shoes:['#2a1a10','#8a5a34']},
  novice:{tops:['#5a4a34','#efe2c4'],bottoms:['#2e2218','#7a5a3e'],shoes:['#2a1a10','#8a5a34']},
  smith:{tops:['#3a2416','#b07a4a'],bottoms:['#1e1612','#5a4636'],shoes:['#1e140e','#5a3a24']},
};
const dyed=new Map<string,THREE.Texture>();
/** Remaps a garment texture's brightness onto a dark→light job colour ramp, keeping alpha. */
function dye(tex:THREE.Texture,[dark,light]:[string,string]):THREE.Texture{
  const key=`${tex.uuid}|${dark}|${light}`;const hit=dyed.get(key);if(hit)return hit;
  const img=tex.image as CanvasImageSource&{width:number;height:number};const w=img.width,h=img.height;
  const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d',{willReadFrequently:true})!;g.drawImage(img,0,0);
  const d=g.getImageData(0,0,w,h),px=d.data;let lo=1,hi=0;const lum=new Float32Array(w*h);
  for(let i=0;i<w*h;i++){const l=(px[i*4]*.299+px[i*4+1]*.587+px[i*4+2]*.114)/255;lum[i]=l;if(px[i*4+3]>20){if(l<lo)lo=l;if(l>hi)hi=l;}}
  const a=new THREE.Color(dark),b=new THREE.Color(light),k=new THREE.Color();const span=Math.max(.08,hi-lo);
  for(let i=0;i<w*h;i++){const t=Math.min(1,Math.max(0,(lum[i]-lo)/span));k.copy(a).lerp(b,Math.pow(t,.8));
    k.convertLinearToSRGB();px[i*4]=k.r*255;px[i*4+1]=k.g*255;px[i*4+2]=k.b*255;}
  g.putImageData(d,0,0);const out=new THREE.CanvasTexture(c);out.flipY=tex.flipY;out.colorSpace=THREE.SRGBColorSpace;out.wrapS=tex.wrapS;out.wrapT=tex.wrapT;
  dyed.set(key,out);return out;
}
type MToonish=THREE.Material&{map?:THREE.Texture|null;shadeMultiplyTexture?:THREE.Texture|null;color?:THREE.Color;shadeColorFactor?:THREE.Color};
/** Re-dyes the avatar's own clothes into the job palette and hides modern accessories. */
export function dressForJob(vrm:VRM,job:string){
  const pal=PALETTES[job];if(!pal)return;
  vrm.scene.traverse(o=>{const m=o as THREE.Mesh;if(!m.isMesh)return;
    for(const mat of (Array.isArray(m.material)?m.material:[m.material]) as MToonish[]){
      if(/Accessory/i.test(mat.name)){mat.visible=false;continue;}
      const part=/Tops/i.test(mat.name)?pal.tops:/Bottoms/i.test(mat.name)?pal.bottoms:/Shoes/i.test(mat.name)?pal.shoes:null;if(!part)continue;
      if(mat.map){const t=dye(mat.map,part);mat.map=t;if(mat.shadeMultiplyTexture)mat.shadeMultiplyTexture=t;}
      mat.color?.set('#ffffff');mat.shadeColorFactor?.set(new THREE.Color(part[0]).lerp(new THREE.Color(part[1]),.35));mat.needsUpdate=true;}});
}
export function equipJobGear(vrm:VRM,job:string):Gear{
  const bone=(n:string)=>vrm.humanoid.getRawBoneNode(n as never);
  const parts:THREE.Object3D[]=[],capes:THREE.Object3D[]=[];
  const attach=(n:string,o:THREE.Object3D)=>{const b=bone(n);if(!b)return;b.add(o);parts.push(o);o.traverse(c=>{if((c as THREE.Mesh).isMesh){c.castShadow=true;(c as THREE.Mesh).frustumCulled=false;}});};
  const cape=(color:string,trim:string,w:number,len:number)=>{
    const pivot=new THREE.Group();pivot.position.set(0,.12,.09);
    const m=new THREE.Mesh(capeGeometry(w,len),mat(color,{side:THREE.DoubleSide}));pivot.add(m);
    const hem=new THREE.Mesh(new THREE.BoxGeometry(w*1.45,.025,.012),mat(trim,{metalness:.5}));hem.position.set(0,-len,-.05+len*.05);pivot.add(hem);
    for(const s of [-1,1]){const clasp=new THREE.Mesh(new THREE.SphereGeometry(.018,10,8),mat('#e2b450',{metalness:.8,roughness:.3}));clasp.position.set(s*w*.42,.0,-.03);pivot.add(clasp);}
    attach('upperChest',pivot);capes.push(pivot);
  };
  const steel=mat('#dfe6ee',{metalness:.85,roughness:.25}),gold=mat('#e2b450',{metalness:.85,roughness:.28});
  dressForJob(vrm,job);
  // Body measures (VRM units): hip half-width and hip height drive skirt/robe sizes.
  const hips=bone('hips'),lul=bone('leftUpperLeg');
  const waist=Math.max(.11,Math.abs(lul?.position.x??.08)*1.75),hipH=Math.max(.6,hips?.position.y??.9);
  const skirt=(color:string,trim:string,len:number,flare:number)=>{
    const pts:[number,number][]=[[waist*1.02,.04],[waist*1.08,0],[waist*(1.15+flare*.35),-len*.45],[waist*(1.2+flare),-len],[waist*(1.18+flare),-len-.012]];
    const g=new THREE.LatheGeometry(pts.map(([r,y])=>new THREE.Vector2(r,y)),36);g.scale(1,1,.82);
    const m=new THREE.Mesh(g,mat(color,{side:THREE.DoubleSide}));const hem=new THREE.Mesh(new THREE.TorusGeometry(waist*(1.2+flare),.008,6,40),mat(trim,{metalness:.5}));
    hem.rotation.x=Math.PI/2;hem.scale.set(1,.82,1);hem.position.y=-len;const grp=new THREE.Group();grp.add(m,hem);attach('hips',grp);return grp;
  };
  const belt=(color:string)=>{const b=new THREE.Mesh(new THREE.TorusGeometry(waist*1.06,.014,8,40),mat(color));b.rotation.x=Math.PI/2;b.scale.set(1,.84,1);b.position.y=.03;attach('hips',b);
    const buckle=new THREE.Mesh(new THREE.BoxGeometry(.04,.032,.01),gold);buckle.position.set(0,.03,-waist*.9);attach('hips',buckle);};
  if(job==='swordman'){
    cape('#b8383a','#e9d9a8',.34,.62);
    belt('#4a3020');
    for(const z of [-1,1]){const tab=new THREE.Mesh(new THREE.PlaneGeometry(waist*.95,hipH*.42,1,4),mat('#b8383a',{side:THREE.DoubleSide}));tab.geometry.translate(0,-hipH*.21,0);
      tab.position.set(0,.01,z*waist*.86);attach('hips',tab);const trim=new THREE.Mesh(new THREE.BoxGeometry(waist*.95,.02,.006),gold);trim.position.set(0,-hipH*.42+.01,z*waist*.86);attach('hips',trim);}
    for(const [n,s] of [['leftUpperArm',-1],['rightUpperArm',1]] as const){
      const g=new THREE.Group();const pad=new THREE.Mesh(new THREE.SphereGeometry(.075,16,10,0,Math.PI*2,0,Math.PI/1.9),steel);pad.scale.set(1.15,.8,1.2);g.add(pad);
      const rim=new THREE.Mesh(new THREE.TorusGeometry(.075,.007,6,24),gold);rim.rotation.x=Math.PI/2;rim.scale.set(1.15,1.2,1);g.add(rim);
      g.position.set(s*.035,.045,0);g.rotation.z=s*.35;attach(n,g);
    }
    const plate=new THREE.Mesh(new THREE.SphereGeometry(.11,24,14,0,Math.PI*2,0,Math.PI/2),steel);plate.rotation.x=Math.PI/2;plate.scale.set(1.05,.55,1.1);plate.position.set(0,.02,-.045);attach('upperChest',plate);
    const crest=new THREE.Mesh(new THREE.BoxGeometry(.018,.12,.01),gold);crest.position.set(0,.03,-.108);attach('upperChest',crest);
    const gem=new THREE.Mesh(new THREE.OctahedronGeometry(.016),new THREE.MeshBasicMaterial({color:new THREE.Color('#ff5a5a').multiplyScalar(1.6),toneMapped:false}));gem.position.set(0,.06,-.112);attach('upperChest',gem);
  }
  if(job==='mage'){
    cape('#3b2f7a','#f0c860',.36,.95);
    skirt('#4a35a0','#f0c860',hipH*.92,.9);belt('#f0c860');
    const hat=new THREE.Group();const felt=mat('#4a35a0');
    const brim=new THREE.Mesh(new THREE.CylinderGeometry(.2,.21,.012,40),felt);hat.add(brim);
    const cone=new THREE.LatheGeometry([[.1,0],[.093,.05],[.075,.11],[.052,.17],[.03,.22],[.012,.255],[0,.27]].map(([r,y])=>new THREE.Vector2(r,y)),32);
    const cp=cone.attributes.position;for(let i=0;i<cp.count;i++){const k=cp.getY(i)/.27;cp.setZ(i,cp.getZ(i)+k*k*.09);}cone.computeVertexNormals();
    hat.add(new THREE.Mesh(cone,felt));
    const band=new THREE.Mesh(new THREE.CylinderGeometry(.1,.101,.03,32,1,true),gold);band.position.y=.018;hat.add(band);
    const star=new THREE.Mesh(new THREE.OctahedronGeometry(.02),new THREE.MeshBasicMaterial({color:new THREE.Color('#ffe26b').multiplyScalar(1.8),toneMapped:false}));star.position.set(0,.02,-.102);hat.add(star);
    hat.position.set(0,.17,.01);hat.rotation.x=.12;attach('head',hat);
  }
  if(job==='archer'){
    cape('#2f6a44','#c89a5a',.3,.42);
    skirt('#7a5234','#c89a5a',hipH*.3,.25);belt('#5a3a22');
    const vest=new THREE.LatheGeometry([[.1,-.09],[.118,-.02],[.122,.06],[.11,.12]].map(([r,y])=>new THREE.Vector2(r*waist/.13,y)),32);vest.scale(1,1,.8);
    attach('upperChest',new THREE.Mesh(vest,mat('#6b4630',{side:THREE.DoubleSide})));
    const cap=new THREE.Group();const felt=mat('#3f8a56');
    const crown=new THREE.Mesh(new THREE.SphereGeometry(.125,24,12,0,Math.PI*2,0,Math.PI/2),felt);crown.scale.set(1.08,.62,1.15);cap.add(crown);
    const brim=new THREE.Mesh(new THREE.CylinderGeometry(.13,.14,.012,32),felt);brim.position.set(0,.005,-.02);brim.scale.set(1,1,1.15);cap.add(brim);
    const feather=new THREE.Mesh(new THREE.ConeGeometry(.018,.2,8),mat('#f4f0e0'));feather.position.set(-.11,.08,.04);feather.rotation.set(.3,0,.9);feather.scale.setScalar(1.3);cap.add(feather);
    cap.position.set(0,.175,.005);cap.rotation.set(.1,0,-.1);attach('head',cap);
    const quiver=new THREE.Group();quiver.add(new THREE.Mesh(new THREE.CylinderGeometry(.04,.034,.3,12),mat('#6b4630')));
    for(let i=0;i<4;i++){const f=new THREE.Mesh(new THREE.ConeGeometry(.014,.05,4),mat('#f4f4f4'));f.position.set(-.02+i*.014,.18,0);quiver.add(f);}
    quiver.position.set(-.04,.02,.13);quiver.rotation.z=.5;attach('upperChest',quiver);
  }
  if(job==='smith'){belt('#3a2416');
    const apron=new THREE.Mesh(new THREE.PlaneGeometry(waist*1.5,hipH*.55,1,4),mat('#5a3a24',{side:THREE.DoubleSide}));apron.geometry.translate(0,-hipH*.2,0);apron.position.set(0,.12,-waist*.92);attach('hips',apron);}
  if(job==='novice'){
    belt('#6b4630');
    const bag=new THREE.Mesh(new THREE.BoxGeometry(.13,.15,.06),mat('#8a5a34'));bag.position.set(0,.02,.12);attach('upperChest',bag);
    const flap=new THREE.Mesh(new THREE.BoxGeometry(.135,.06,.065),mat('#6b4630'));flap.position.set(0,.08,.12);attach('upperChest',flap);
  }
  return {
    tick(t,moving){for(const c of capes)c.rotation.x=(moving?.32+Math.sin(t*9)*.06:.06+Math.sin(t*1.6)*.03);},
    dispose(){for(const p of parts){p.removeFromParent();p.traverse(o=>{const m=o as THREE.Mesh;if(m.isMesh){m.geometry.dispose();(m.material as THREE.Material).dispose();}});}},
  };
}
