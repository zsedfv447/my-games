// Anime heroes from the CC0 VRoid sample avatars (VRM 0.x): MToon cel shading, spring-bone hair
// and clothes, blinking, and every motion baked from the Universal Animation Library through
// retarget.ts. Proportions are pushed toward a 4.5-head "new generation" chibi by scaling the head.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils, type VRM } from '@pixiv/three-vrm';
import { type CharLook, type CharPose } from './character3d';
import { bakeClips, type Human } from './retarget';
import { AVATAR_IDS } from '../data/avatars';
import { emotes } from '../data/adventure';
import { equipJobGear, dressForJob, type Gear } from './vrm-gear';
import { bakeAvatar } from './vrm-bake';
import { buildWeaponAppearance, type WeaponAppearance } from './weapon-appearance';

export const VRM_CAST=['shibu','shibu_dark','vivi','vita','victoria','base_f','base_m','hair_f','hair_m','fumiriya','shino','fleur','vulpek','yueji'] as const;
/** Avatars reserved for townsfolk — never offered to the player, so NPCs never share the hero's face. */
export const NPC_CAST:VrmCast[]=['vivi','vita','victoria','shibu','shibu_dark','fleur','vulpek','yueji'];
export type VrmCast=typeof VRM_CAST[number];
/** Character-creation order (the save's `hair` field is the index). */
export const AVATARS:readonly VrmCast[]=AVATAR_IDS;
export const VRM_MALE:VrmCast[]=['base_m','hair_m','fumiriya','vulpek'];
export const VRM_FEMALE:VrmCast[]=['shibu','shibu_dark','vivi','vita','victoria','base_f','hair_f','shino'];

const CLIPS={idle:'Idle_Loop',walk:'Walk_Loop',run:'Jog_Fwd_Loop',dead:'Death01',hurt:'Hit_Chest',sit:'Sitting_Idle_Loop',cast:'Spell_Simple_Shoot',shoot:'OverhandThrow',
  attack0:'Sword_Attack',attack1:'Sword_Regular_B',attack2:'Sword_Regular_C',talk:'Idle_Talking_Loop',
  ...Object.fromEntries(emotes.map(e=>[`emote_${e.id}`,e.clip]))} as Record<string,string>;
const HUMAN_KEYS:Human[]=['hips','spine','chest','upperChest','neck','head'];
for(const S of ['left','right'])for(const b of ['Shoulder','UpperArm','LowerArm','Hand','MiddleProximal','IndexProximal','LittleProximal','UpperLeg','LowerLeg','Foot','Toes'])HUMAN_KEYS.push(`${S}${b}` as Human);

let blobTex:THREE.Texture|null=null;
/** Soft contact shadow for characters that don't render into the shadow map. */
function blobShadow(){
  blobTex??=(()=>{const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d')!;const gr=g.createRadialGradient(32,32,2,32,32,31);
    gr.addColorStop(0,'rgba(20,30,20,.55)');gr.addColorStop(.6,'rgba(20,30,20,.25)');gr.addColorStop(1,'rgba(20,30,20,0)');g.fillStyle=gr;g.fillRect(0,0,64,64);return new THREE.CanvasTexture(c);})();
  const m=new THREE.Mesh(new THREE.PlaneGeometry(.95,.95),new THREE.MeshBasicMaterial({map:blobTex,transparent:true,depthWrite:false}));
  m.rotation.x=-Math.PI/2;m.position.y=.02;m.renderOrder=1;m.userData.noAO=true;return m;
}
const bytes=new Map<VrmCast,Promise<ArrayBuffer>>();
async function parse(id:VrmCast):Promise<VRM>{
  let p=bytes.get(id);if(!p){p=fetch(`models/vrm/${id}.vrm`).then(r=>{if(!r.ok)throw new Error(`VRM ${id}: ${r.status}`);return r.arrayBuffer();});bytes.set(id,p);}
  const loader=new GLTFLoader();loader.register(parser=>new VRMLoaderPlugin(parser));
  const gltf=await loader.parseAsync((await p).slice(0),'');const vrm=gltf.userData.vrm as VRM;
  VRMUtils.removeUnnecessaryVertices(gltf.scene);VRMUtils.rotateVRM0(vrm);
  vrm.humanoid.autoUpdateHumanBones=false;
  return vrm;
}
const rawNames=(vrm:VRM)=>{const n:Partial<Record<Human,string>>={};for(const k of HUMAN_KEYS){const o=vrm.humanoid.getRawBoneNode(k as never);if(o)n[k]=o.name;}return n;};
// Every VRoid avatar shares bone names and an identity-rotation T-pose, so motion is baked once on
// one reference avatar and shared; only the hip translation is rescaled to each avatar's leg length.
let shared:Promise<{clips:Map<string,THREE.AnimationClip>;hipY:number;hip:string}>|null=null;
function sharedClips(){
  shared??=parse('base_f').then(async v=>{const names=rawNames(v);const hip=v.humanoid.getRawBoneNode('hips')!;
    return {clips:await bakeClips(v.scene,names,Object.values(CLIPS)),hipY:hip.position.y,hip:hip.name};});
  return shared;
}
const scaled=new Map<string,Map<string,THREE.AnimationClip>>();
async function clipsFor(id:VrmCast,hipY?:number){
  const S=await sharedClips();if(hipY===undefined)return S.clips;
  const key=`${id}:${hipY.toFixed(4)}`;let m=scaled.get(key);
  if(!m){m=new Map();const k=hipY/S.hipY;
    for(const [n,c] of S.clips){const clip=c.clone();for(const tr of clip.tracks)if(tr.name===`${S.hip}.position`){const v=tr.values;for(let i=0;i<v.length;i++)v[i]*=k;}m.set(n,clip);}
    scaled.set(key,m);}
  return m;
}
/** Warm the caches so the first hero appears without a hitch. */
export function preloadVrm(){return sharedClips();}

export type VrmLook={cast:VrmCast;weapon?:CharLook['weapon'];weaponStyle?:string;refine?:number;tint?:string;head?:number;hairColor?:string|null;job?:string;
  /** The player: real shadow + MToon outlines. Townsfolk get a cheap blob shadow and no outlines. */
  hero?:boolean};
/** Game character look → avatar. `hair` picks the avatar; hair colour index 0 keeps the original. */
export function vrmLookFrom(l:CharLook,defaultHair?:string):VrmLook{
  return {cast:AVATARS[((l.hair%AVATARS.length)+AVATARS.length)%AVATARS.length],weapon:l.weapon,weaponStyle:l.weaponStyle,refine:l.refine,job:l.outfit,hero:true,hairColor:l.hairColor===defaultHair?null:l.hairColor};
}
export class VrmHero{
  readonly root=new THREE.Group();readonly ready:Promise<void>;
  vrm:VRM|null=null;
  private mixer:THREE.AnimationMixer|null=null;private actions=new Map<string,THREE.AnimationAction>();private current:THREE.AnimationAction|null=null;
  private last=performance.now();private lastAct=0;private combo=0;private disposed=false;private blinkAt=1+Math.random()*3;private t=0;
  private weapon:WeaponAppearance|null=null;private gear:Gear|null=null;
  constructor(readonly look:VrmLook,height=1.78){this.ready=this.build(height);}
  private async build(height:number){
    const vrm=await parse(this.look.cast);
    if(this.disposed){VRMUtils.deepDispose(vrm.scene);return;}
    const clips=await clipsFor(this.look.cast,vrm.humanoid.getRawBoneNode('hips')?.position.y);
    if(this.disposed){VRMUtils.deepDispose(vrm.scene);return;}
    this.vrm=vrm;const scene=vrm.scene;this.root.add(scene);
    // Draw-call budget: a VRoid avatar is ~70 primitives, so extra passes multiply fast. Characters
    // skip the ambient-occlusion pass; only the player casts a real shadow and keeps ink outlines.
    const hero=!!this.look.hero;
    scene.traverse(o=>{const m=o as THREE.Mesh;if(!m.isMesh)return;m.castShadow=hero;m.receiveShadow=false;m.frustumCulled=false;m.userData.noAO=true;
      if(!hero)for(const mat of (Array.isArray(m.material)?m.material:[m.material]) as (THREE.Material&{isOutline?:boolean})[])if(mat.isOutline)mat.visible=false;});
    if(!hero)this.root.add(blobShadow());
    if(this.look.tint)this.tintOutfit(this.look.tint);
    if(this.look.hairColor)this.tintHair(this.look.hairColor);
    // Townsfolk are baked into one draw call (see vrm-bake.ts); the player keeps full MToon detail.
    if(!hero){if(this.look.job)dressForJob(vrm,this.look.job);bakeAvatar(scene);}
    // Chibi head, then normalise height so every avatar stands the same size on the ground.
    const head=vrm.humanoid.getRawBoneNode('head');if(head)head.scale.setScalar(this.look.head??1.32);
    scene.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(scene),k=height/Math.max(.01,box.max.y-box.min.y);
    scene.scale.setScalar(k);scene.position.y=-box.min.y*k;scene.updateMatrixWorld(true);
    vrm.springBoneManager?.setInitState();
    this.mixer=new THREE.AnimationMixer(scene);
    for(const [key,name] of Object.entries(CLIPS)){const c=clips.get(name);if(!c)continue;const a=this.mixer.clipAction(c);
      const once=['dead','hurt','cast','shoot','attack0','attack1','attack2'].includes(key)||emotes.some(e=>`emote_${e.id}`===key&&!e.loop);
      if(once){a.setLoop(THREE.LoopOnce,1);a.clampWhenFinished=true;}this.actions.set(key,a);}
    this.addWeapon();if(this.look.job)this.gear=equipJobGear(vrm,this.look.job);this.play('idle');this.mixer.update(0);
  }
  /** Recolours the main outfit materials (not skin, face, eyes or hair) for NPC variety. */
  private tintOutfit(color:string){
    this.vrm!.scene.traverse(o=>{const m=o as THREE.Mesh;if(!m.isMesh)return;for(const mat of (Array.isArray(m.material)?m.material:[m.material]) as (THREE.Material&{color?:THREE.Color;shadeColorFactor?:THREE.Color})[]){
      if(!/cloth|tops|bottoms|onepiece|shoes|outer|jacket|clothes/i.test(mat.name))continue;mat.color?.lerp(new THREE.Color(color),.55);mat.shadeColorFactor?.lerp(new THREE.Color(color).multiplyScalar(.6),.55);}});
  }
  private tintHair(color:string){
    this.vrm!.scene.traverse(o=>{const m=o as THREE.Mesh;if(!m.isMesh)return;for(const mat of (Array.isArray(m.material)?m.material:[m.material]) as (THREE.Material&{color?:THREE.Color;shadeColorFactor?:THREE.Color})[]){
      if(!/hair/i.test(mat.name))continue;const c=new THREE.Color(color);mat.color?.lerp(c,.6);mat.shadeColorFactor?.lerp(c.clone().multiplyScalar(.55),.6);}});
  }
  private addWeapon(){
    const w=this.look.weapon,vrm=this.vrm!;if(!w)return;
    const bow=w==='bow',hand=vrm.humanoid.getRawBoneNode(bow?'leftHand':'rightHand');if(!hand)return;
    this.weapon=buildWeaponAppearance(w,this.look.weaponStyle,this.look.refine);
    vrm.scene.updateMatrixWorld(true);const hs=Math.max(1e-4,hand.getWorldScale(new THREE.Vector3()).x);
    const g=this.weapon.group;g.scale.setScalar((w==='dagger'?.8:.85)/hs);g.position.set(bow?.03/hs:-.03/hs,-.01/hs,0);
    // VRM hand bones run along ±X toward the fingertips; grip the weapon across the palm.
    g.rotation.set(bow?0:Math.PI/2,0,bow?Math.PI/2:0);
    hand.add(g);
  }
  private play(key:string,fade=.18){
    const a=this.actions.get(key)??this.actions.get('idle');if(!a||a===this.current)return;
    a.reset().play();if(this.current){if(fade>0)a.crossFadeFrom(this.current,fade,false);else this.current.stop();}this.current=a;
  }
  /** Same signature as the other hero models. */
  /** World units per second the character is moving; picks walk vs run and syncs the stride. */
  moveSpeed=0;
  private emote:string|null=null;
  /** Plays an emote until the character does something else (idle keeps it going). */
  playEmote(id:string){const key=`emote_${id}`;if(!this.actions.has(key))return false;this.emote=key;const a=this.actions.get(key)!;a.reset();this.play(key,.2);return true;}
  get emoting(){return this.emote!==null;}
  /** World-space height of the hips bone (for seating the rider on a mount). */
  hipsWorld(){const h=this.vrm?.humanoid.getRawBoneNode('hips');if(!h)return null;this.root.updateMatrixWorld(true);return h.getWorldPosition(new THREE.Vector3());}
  animate(pose:CharPose|'run'|'talk'|'ride',_t=0,_phase=0,act=0,_sync=false){
    if(!this.mixer||!this.vrm)return;
    const now=performance.now(),dt=Math.min(.05,(now-this.last)/1000);this.last=now;this.t+=dt;
    const w=this.look.weapon;
    if(pose==='attack'){
      if(act<this.lastAct-.2)this.combo=(this.combo+1)%3;
      const key=w==='staff'?'cast':w==='bow'?'shoot':`attack${this.combo}`;
      const a=this.actions.get(key);if(a&&a===this.current&&act<this.lastAct-.2)a.reset().play();
      this.play(key,0);
      if(this.current&&this.actions.get(key)===this.current)this.current.time=Math.min(1,act)*this.current.getClip().duration*.85;
      this.lastAct=act;this.mixer.update(0);
    }else{
      this.lastAct=0;
      if(pose!=='idle')this.emote=null;
      if(this.emote){const a=this.actions.get(this.emote)!;if(this.current!==a)this.play(this.emote,.2);else if(!a.isRunning()&&a.loop===THREE.LoopOnce&&a.time>=a.getClip().duration-.01){this.emote=null;this.play('idle',.3);}}
      else if(pose==='cast'){const a=this.actions.get('cast');if(a!==this.current)this.play('cast');else if(a&&!a.isRunning())a.reset().play();}
      else if(pose==='ride')this.play('sit',.25);
      else if(pose==='walk'||pose==='run'){
        // Jog for normal travel speed; stride time-scaled so the feet don't skate.
        const run=pose==='run'||this.moveSpeed>2.6,key=run?'run':'walk';this.play(key,.15);
        const a=this.actions.get(key);if(a&&this.moveSpeed>0)a.timeScale=THREE.MathUtils.clamp(this.moveSpeed/(run?3.4:1.5),.6,1.8);
      }
      else this.play(pose);
      this.mixer.update(dt);
    }
    // Blink every few seconds; closed eyes when dead.
    const em=this.vrm.expressionManager;
    if(em){this.blinkAt-=dt;let blink=0;if(this.blinkAt<0){blink=1-Math.abs(this.blinkAt+.07)/.07;if(this.blinkAt<-.14)this.blinkAt=2+Math.random()*3;}
      em.setValue('blink',pose==='dead'?1:Math.max(0,blink));em.setValue('happy',pose==='sit'||this.emote==='emote_dance'||this.emote==='emote_yes'?.6:0);}
    this.gear?.tick(this.t,pose==='walk'||pose==='run');
    // Off-screen townsfolk skip expressions/spring bones (the scene hides their root).
    if(this.root.visible)this.vrm.update(dt);
  }
  setExpression(_e:string){}
  dispose(){if(this.disposed)return;this.disposed=true;this.mixer?.stopAllAction();this.weapon?.dispose();this.gear?.dispose();if(this.vrm)VRMUtils.deepDispose(this.vrm.scene);this.root.clear();}
}
