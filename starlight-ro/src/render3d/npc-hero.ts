import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { Hero,heroLookFrom,type HeroPose } from './hero';
import {ChibiCandidate} from './chibi-candidate';
import type { NpcDef } from '../data/maps';
import { VrmHero, NPC_CAST, type VrmLook } from './vrm-hero';
const profiles:Record<string,{model:string;height:number;weapon?:boolean;tint?:string}>={
  job:{model:'Warrior',height:1.57,weapon:true},
  gear:{model:'Warrior',height:1.48,tint:'#d5ad87'},
  card:{model:'Wizard',height:1.6,weapon:true},
  service:{model:'Cleric',height:1.5},
  refine:{model:'Monk',height:1.52,tint:'#bda58e'},
  pet:{model:'Ranger',height:1.42},
  stylist:{model:'Rogue',height:1.46,tint:'#dfbbde'},
};
const cache=new Map<string,Promise<GLTF>>();
function load(name:string){let p=cache.get(name);if(!p){p=new GLTFLoader().loadAsync(`models/rpg/${name}.gltf`);cache.set(name,p);}return p;}
/** Complete original NPC rig + its own animation; never grafted onto the player's skeleton. */
export class NativeNpcHero{
  readonly root=new THREE.Group();readonly ready:Promise<void>;
  private disposed=false;private mixer:THREE.AnimationMixer|null=null;private rig:THREE.Object3D|null=null;
  private materials:THREE.Material[]=[];private last=performance.now();
  constructor(profile:{model:string;height:number;weapon?:boolean;tint?:string}){this.ready=this.build(profile);}
  private async build(p:{model:string;height:number;weapon?:boolean;tint?:string}){
    const source=await load(p.model);if(this.disposed)return;
    const rig=this.rig=SkeletonUtils.clone(source.scene);this.root.add(rig);
    rig.traverse(o=>{const m=o as THREE.Mesh;if(!m.isMesh)return;
      if(!p.weapon&&/(Sword|Staff|Dagger|Bow)/i.test(o.name)){o.visible=false;return;}
      m.castShadow=true;m.receiveShadow=false;m.frustumCulled=false;
      const mats=(Array.isArray(m.material)?m.material:[m.material]).map(raw=>{const mat=raw.clone() as THREE.MeshStandardMaterial;
        if(mat.isMeshStandardMaterial){mat.roughness=.85;mat.metalness=.05;if(p.tint)mat.color.multiply(new THREE.Color(p.tint));}
        this.materials.push(mat);return mat;});m.material=Array.isArray(m.material)?mats:mats[0];
    });
    this.mixer=new THREE.AnimationMixer(rig);
    const clip=source.animations.find(c=>c.name===(p.weapon?'Idle_Weapon':'Idle'))??source.animations.find(c=>c.name==='Idle');
    if(clip)this.mixer.clipAction(clip).play();this.mixer.update(0);rig.updateMatrixWorld(true);
    const bounds=new THREE.Box3().setFromObject(rig),height=bounds.max.y-bounds.min.y;
    const scale=p.height/Math.max(.1,height);rig.scale.multiplyScalar(scale);rig.position.y-=bounds.min.y*scale;
    this.last=performance.now();
  }
  animate(_pose:HeroPose='idle',_t=0,_phase=0,_act=0){const now=performance.now();this.mixer?.update(Math.min(.05,(now-this.last)/1000));this.last=now;}
  dispose(){if(this.disposed)return;this.disposed=true;this.mixer?.stopAllAction();if(this.rig)this.mixer?.uncacheRoot(this.rig);
    const skeletons=new Set<THREE.Skeleton>();this.root.traverse(o=>{if((o as THREE.SkinnedMesh).isSkinnedMesh)skeletons.add((o as THREE.SkinnedMesh).skeleton);});skeletons.forEach(s=>s.dispose());this.materials.forEach(m=>m.dispose());this.root.clear();}
}
export type NpcHero=Hero|NativeNpcHero|ChibiCandidate|VrmHero;
/** Town NPCs: each a different VRoid avatar, outfit tinted to their role, holding their trade's tool. */
const VRM_NPCS:Record<string,VrmLook>={
  guide:{cast:'vivi'},job:{cast:'vulpek',weapon:'sword'},tool:{cast:'vita',tint:'#e8a060'},gear:{cast:'shibu_dark',weapon:'sword'},
  card:{cast:'yueji',weapon:'staff'},service:{cast:'victoria'},refine:{cast:'shibu',job:'smith'},
  pet:{cast:'fleur'},stylist:{cast:'vita',tint:'#d986c8',hairColor:'#ff9ec4'},
};
export function createNpcHero(n:NpcDef):NpcHero{
  const v=VRM_NPCS[n.id];if(v)return new VrmHero(v);
  return new VrmHero({cast:NPC_CAST[n.id.length%NPC_CAST.length],tint:n.look.outfit});
  if(n.id==='tool')return new ChibiCandidate('merchant',1.5);
  if(n.id==='pet')return new ChibiCandidate('archer',1.5);
  const p=profiles[n.id];if(p)return new NativeNpcHero(p);
  const hair=n.id==='guide'?1:2;
  return new Hero(heroLookFrom({outfit:'npc',hair,hairColor:n.look.hair,cloth:n.look.outfit,hat:n.look.hat,weapon:null},true));
}
