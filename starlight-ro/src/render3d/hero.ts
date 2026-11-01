// Skinned heroes: CC0 Quaternius outfit bodies and original heads, with Universal Animation
// Library motion. Base bodies contribute only head/neck triangles so skin cannot cover clothes.
// Every material is converted to soft cartoon shading — bright, saturated, no gritty normal maps —
// and the rig is chibi-fied by scaling bones after the mixer runs each frame.
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { type CharLook, type CharPose } from './character3d';
import { buildWeaponAppearance, type WeaponAppearance } from './weapon-appearance';
import { isBaseBodyMaterial } from './hero-parts';
import { equipProfession } from './profession-outfit';
import { equipAccessories } from './hero-accessories';

export type HeroPose='idle'|'walk'|'run'|'attack'|'cast'|'sit'|'dead'|'hurt';
export type HeroLook={sex:'f'|'m';outfit:'ranger'|'peasant';hair:string;hairColor:string;tint?:string;shirt?:string;weaponFrom?:CharLook;profession?:CharLook['outfit'];character?:CharLook};
const HAIRS=['hair_simpleparted','hair_long','hair_buns','hair_buzzed'];
/** Maps a game character look (job, hair style, colours, weapon) onto a Quaternius outfit + hairstyle. */
export function heroLookFrom(l:CharLook,female:boolean):HeroLook{
  const job=l.outfit;const tints:Record<string,string|undefined>={swordman:'#e8645a',mage:'#8a6ae0',archer:undefined,novice:undefined,npc:l.cloth};
  const hair=female?['hair_long','hair_buns','hair_long','hair_buzzedfemale'][l.hair%4]:HAIRS[l.hair%4];
  return {character:{...l},profession:job,sex:female?'f':'m',outfit:job==='archer'||job==='swordman'?'ranger':'peasant',hair,hairColor:l.hairColor,tint:tints[job],shirt:job==='novice'||job==='npc'?'#f4ead8':undefined,weaponFrom:l.weapon?l:undefined};
}
type Assets={gltf:Map<string,GLTF>;clips:Map<string,THREE.AnimationClip>};
let assets:Promise<Assets>|null=null;
const BASE='models/';
const FILES=['female_ranger','male_ranger','female_peasant','male_peasant','body_f','body_m','hair_long','hair_buns','hair_simpleparted','hair_buzzed','hair_buzzedfemale','eyebrows_female','eyebrows_regular'];
/** Loads every outfit and animation once; later calls share the same promise. */
export function loadHeroAssets():Promise<Assets>{
  if(assets)return assets;
  const loader=new GLTFLoader();
  assets=(async()=>{
    const gltf=new Map<string,GLTF>();
    await Promise.all(FILES.map(async f=>gltf.set(f,await loader.loadAsync(`${BASE}${f}.gltf`))));
    const clips=new Map<string,THREE.AnimationClip>();
    for(const a of ['anim1','anim2']){const g=await loader.loadAsync(`${BASE}${a}.glb`);for(const c of g.animations){
      // Rotations (and the pelvis translation) only, so the bone scales that make the chibi look survive.
      c.tracks=c.tracks.filter(t=>t.name.endsWith('.quaternion')||t.name==='pelvis.position');clips.set(c.name,c);}}
    return {gltf,clips};
  })();
  return assets;
}

/** Re-binds a skinned mesh from another file onto `bones` (matched by name), keeping its own bind pose. */
function rebind(src:THREE.SkinnedMesh,bones:Map<string,THREE.Bone>,geometry=src.geometry):THREE.SkinnedMesh{
  const m=new THREE.SkinnedMesh(geometry,Array.isArray(src.material)?src.material.map(x=>x.clone()):src.material.clone());
  m.bind(new THREE.Skeleton(src.skeleton.bones.map(b=>bones.get(b.name)!),src.skeleton.boneInverses.map(x=>x.clone())),src.bindMatrix.clone());
  m.castShadow=true;m.receiveShadow=false;m.frustumCulled=false;return m;
}
/** Keeps only the triangles skinned (mostly) to the head and neck: the face of a full-body base mesh. */
function headOnly(mesh:THREE.SkinnedMesh):THREE.BufferGeometry{
  const g=mesh.geometry.clone(),si=g.attributes.skinIndex,sw=g.attributes.skinWeight,names=mesh.skeleton.bones.map(b=>b.name),headish=new Set(['Head','neck_01']);
  const w=new Float32Array(si.count);
  for(let i=0;i<si.count;i++){let s=0;for(let k=0;k<4;k++)if(headish.has(names[si.getComponent(i,k)]))s+=sw.getComponent(i,k);w[i]=s;}
  const idx=g.index!.array,keep:number[]=[];
  for(let t=0;t<idx.length;t+=3){const a=idx[t],b=idx[t+1],c=idx[t+2];if(w[a]>.5&&w[b]>.5&&w[c]>.5)keep.push(a,b,c);}
  g.setIndex(keep);return g;
}

let rampTex:THREE.DataTexture|null=null;
/** Soft three-band light ramp: cartoon banding with gentle, not hard, transitions. */
function ramp(){
  if(rampTex)return rampTex;
  const n=64,d=new Uint8Array(n*4);
  for(let i=0;i<n;i++){const x=i/(n-1);const v=x<.32?.62:x<.4?.62+(x-.32)/.08*.22:x<.62?.84:x<.68?.84+(x-.62)/.06*.16:1;d.set([v*255,v*255,v*255,255],i*4);}
  rampTex=new THREE.DataTexture(d,n,1,THREE.RGBAFormat);rampTex.magFilter=rampTex.minFilter=THREE.LinearFilter;rampTex.needsUpdate=true;return rampTex;
}
/** Converts any lit material to bright cartoon shading with a soft rim; optionally recolours bare-skin texels as a shirt. */
export function cartoonize(src:THREE.Material,opts:{sat?:number;bright?:number;shirt?:string}={}):THREE.Material{
  const s=src as THREE.MeshStandardMaterial;
  if(!(s.isMeshStandardMaterial||(s as unknown as THREE.MeshToonMaterial).isMeshToonMaterial))return src;
  const m=new THREE.MeshToonMaterial({map:s.map,color:s.color.clone(),gradientMap:ramp(),side:s.side,transparent:s.transparent,opacity:s.opacity,depthWrite:s.depthWrite,
    emissive:s.emissive?.clone(),emissiveIntensity:s.emissiveIntensity??1,polygonOffset:s.polygonOffset,polygonOffsetFactor:s.polygonOffsetFactor,alphaTest:s.alphaTest});
  const sat=opts.sat??1.35,bright=opts.bright??1.12,shirt=new THREE.Color(opts.shirt??'#ffffff');
  m.onBeforeCompile=sh=>{
    sh.uniforms.uSat={value:sat};sh.uniforms.uBright={value:bright};sh.uniforms.uShirt={value:shirt};sh.uniforms.uKey={value:opts.shirt?1:0};
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nuniform float uSat,uBright,uKey;uniform vec3 uShirt;')
      .replace('#include <map_fragment>',`#include <map_fragment>
  {vec3 c=diffuseColor.rgb;
   float skin=uKey*step(.16,c.r)*step(c.g,c.r*.92)*step(c.b,c.g*.92)*smoothstep(.05,.09,c.r-c.b)*(1.-smoothstep(.32,.42,c.r-c.b))*step(.12,c.g);
   c=mix(c,uShirt*(.55+dot(c,vec3(.6,.3,.1))*1.2),skin);
   float l=dot(c,vec3(.299,.587,.114));c=mix(vec3(l),c,uSat)*uBright;
   c=mix(c,vec3(l)*1.05+.04,.08);diffuseColor.rgb=c;}`)
      .replace('#include <opaque_fragment>',`float rim=pow(1.-clamp(dot(normalize(vViewPosition),normal),0.,1.),2.6);
  outgoingLight+=diffuseColor.rgb*rim*.45+vec3(.04)*rim;
  #include <opaque_fragment>`);
  };
  m.customProgramCacheKey=()=>`cartoon${opts.shirt?'k':''}`;
  return m;
}

const CLIP:Record<HeroPose,string>={idle:'Idle_Loop',walk:'Walk_Loop',run:'Jog_Fwd_Loop',attack:'Sword_Regular_A',cast:'Spell_Simple_Shoot',sit:'Sitting_Idle_Loop',dead:'Death01',hurt:'Hit_Chest'};
export class Hero{
  readonly root=new THREE.Group();
  private disposed=false;
  private disposeOutfit:(()=>void)|null=null;
  private accessories:ReturnType<typeof equipAccessories>|null=null;
  private rig!:THREE.Object3D;
  private bones=new Map<string,THREE.Bone>();
  private mixer!:THREE.AnimationMixer;
  private actions=new Map<string,THREE.AnimationAction>();
  private current:THREE.AnimationAction|null=null;
  private pelvisRest=new THREE.Vector3();
  private pelvisRaw=new THREE.Vector3();
  private t=0;
  /** Chibi proportions: head, leg and torso bone scales. */
  chibi={head:1.75,legs:.7,torso:.82};
  ready:Promise<void>;
  private last=performance.now();private lastAct=0;private weapon:WeaponAppearance|null=null;
  constructor(readonly look:HeroLook){this.root.scale.setScalar(.8);this.ready=this.build();}
  /** Attach an owned weapon at its grip center, along the native hand's local Y axis. */
  private addWeapon(){
    const wl=this.look.weaponFrom;if(!wl?.weapon)return;
    const bone=this.bones.get(wl.weapon==='bow'?'hand_l':'hand_r');if(!bone)return;
    this.weapon=buildWeaponAppearance(wl.weapon,wl.weaponStyle,wl.refine);
    const g=this.weapon.group;
    // Native Idle_Loop hand +Y points down/forward (-.154,-.858,.489).
    // Keep that local axis; rotating a blade toward -Z sends it through the torso.
    g.scale.setScalar(wl.weapon==='dagger'?1.05:1.2);g.rotation.set(0,0,wl.weapon==='staff'?Math.PI:0);g.position.set(0,.05,0);bone.add(g);
  }
  private async build(){
    const A=await loadHeroAssets();if(this.disposed)return;const L=this.look,sex=L.sex==='f'?'female':'male';
    const outfit=A.gltf.get(`${sex}_${L.outfit}`)!;
    this.rig=SkeletonUtils.clone(outfit.scene);this.root.add(this.rig);
    this.rig.traverse(o=>{if((o as THREE.Bone).isBone)this.bones.set(o.name,o as THREE.Bone);
      const mesh=o as THREE.Mesh;if(!mesh.isMesh)return;mesh.castShadow=true;mesh.receiveShadow=false;mesh.frustumCulled=false;
      const mats=Array.isArray(mesh.material)?mesh.material:[mesh.material];
      const conv=mats.map(m=>{const skinMat=/Regular_(Male|Female)/.test(m.name);const c=cartoonize(m,{shirt:!skinMat?L.shirt:undefined,sat:skinMat?1.1:1.35,bright:skinMat?1.18:1.12});
        if(L.tint&&!skinMat)(c as THREE.MeshToonMaterial).color.set(L.tint);return c;});
      mesh.material=Array.isArray(mesh.material)?conv:conv[0];});
    // The base character's own head (face, eyes) plus hairstyle and eyebrows, re-bound onto this rig.
    const holder=this.bones.get('root')?.parent??this.rig;
    A.gltf.get(L.sex==='f'?'body_f':'body_m')!.scene.traverse(o=>{const sm=o as THREE.SkinnedMesh;if(!sm.isSkinnedMesh)return;
      const materials=Array.isArray(sm.material)?sm.material:[sm.material];
      const isBody=isBaseBodyMaterial(materials.map(material=>material.name));
      const m=rebind(sm,this.bones,isBody?headOnly(sm):sm.geometry);
      m.material=cartoonize(m.material as THREE.Material,{sat:1.1,bright:isBody?1.15:1.05});holder.add(m);});
    for(const part of [L.hair,L.sex==='f'?'eyebrows_female':'eyebrows_regular']){
      A.gltf.get(part)?.scene.traverse(o=>{const sm=o as THREE.SkinnedMesh;if(!sm.isSkinnedMesh)return;const m=rebind(sm,this.bones);
        const mat=cartoonize(m.material as THREE.Material,{sat:1.2,bright:1.1}) as THREE.MeshToonMaterial;mat.color.set(L.hairColor);m.material=mat;holder.add(m);});
    }
    // Hide the outfit's hood so the hairstyle reads clearly.
    this.rig.traverse(o=>{if(/Hood/i.test(o.name))o.visible=false;});
    const armor=L.character?.armorStyle;
    this.disposeOutfit=equipProfession(this.rig,this.bones,armor==='chainMail'?'swordman':armor==='mageRobe'?'mage':L.profession??'novice');
    if(L.character)this.accessories=equipAccessories(this.rig,this.bones,L.character);
    this.addWeapon();
    this.mixer=new THREE.AnimationMixer(this.rig);
    for(const [k,name] of Object.entries(CLIP)){const c=A.clips.get(name);if(!c)continue;const a=this.mixer.clipAction(c);
      if(k==='attack'||k==='cast'||k==='hurt'||k==='dead'){a.setLoop(THREE.LoopOnce,1);a.clampWhenFinished=true;}this.actions.set(k,a);}
    this.mixer.update(0);this.pelvisRest.copy(this.bones.get('pelvis')!.position);this.pelvisRaw.copy(this.pelvisRest);
    this.play('idle');
  }
  private play(pose:HeroPose,fade=.18){
    const a=this.actions.get(pose)??this.actions.get('idle')!;if(a===this.current)return;
    a.reset().play();if(this.current)a.crossFadeFrom(this.current,fade,false);this.current=a;
  }
  /** Same signature as the old procedural model; time comes from an internal clock. */
  animate(pose:CharPose|HeroPose,_t=0,_phase=0,act=0,syncAction=false){
    if(!this.mixer)return;
    const now=performance.now(),dt=Math.min(.05,(now-this.last)/1000);this.last=now;
    const bowOrStaff=this.look.weaponFrom?.weapon;
    const key:HeroPose=pose==='attack'&&(bowOrStaff==='bow'||bowOrStaff==='staff')?'cast':pose as HeroPose;
    const synchronized=syncAction&&pose==='attack';
    const prev=this.current;this.play(key,synchronized?.035:.18);
    if((key==='attack'||key==='cast')&&this.current===prev&&act<this.lastAct-.2){this.current!.reset().play();}
    if(key==='attack'||key==='cast')this.lastAct=act;else this.lastAct=0;
    this.bones.get('pelvis')!.position.copy(this.pelvisRaw);
    this.mixer.update(dt);
    // The 3D combat presenter owns this phase; never run a second attack clock.
    // Keep mixer time moving for short crossfades, then sample the native clip exactly.
    if(synchronized&&this.current){
      this.current.paused=false;this.current.time=THREE.MathUtils.clamp(act,0,1)*this.current.getClip().duration;
      this.mixer.update(0);
    }
    this.pelvisRaw.copy(this.bones.get('pelvis')!.position);
    this.t+=dt;this.accessories?.tick(this.t,key==='walk'||key==='run');
    const B=this.bones,c=this.chibi;
    // Chibi proportions: big head, shorter legs and torso, pelvis lowered so the feet stay on the ground.
    B.get('spine_01')!.scale.setScalar(c.torso);
    B.get('Head')!.scale.setScalar(c.head/c.torso);
    for(const s of ['l','r'])B.get(`thigh_${s}`)!.scale.setScalar(c.legs);
    const p=B.get('pelvis')!;p.position.z-=this.pelvisRaw.z*(1-c.legs);
  }
  setExpression(_e:string){}
  dispose(){if(this.disposed)return;this.disposed=true;this.mixer?.stopAllAction();if(this.rig)this.mixer?.uncacheRoot(this.rig);this.disposeOutfit?.();this.accessories?.dispose();this.weapon?.dispose();this.root.clear();}
}
