import * as THREE from 'three';
import {GLTFLoader,type GLTF} from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import {chibiClip,type ChibiCast,type ChibiMotion} from './chibi-profile';
import {StaticTexturePool} from './static-textures';
const textures=new StaticTexturePool();
const sourceCache=new Map<ChibiCast,Promise<GLTF>>();
export async function loadChibiSource(model:ChibiCast){let p=sourceCache.get(model);if(!p){p=new GLTFLoader().loadAsync(`models/styloo/${model}.gltf`).then(g=>{g.scene.traverse(o=>{const mesh=o as THREE.Mesh;if(!mesh.isMesh)return;for(const m of (Array.isArray(mesh.material)?mesh.material:[mesh.material])){const material=m as THREE.MeshBasicMaterial,texture=material.map;if(!texture)continue;const index=g.parser.associations.get(texture)?.textures;const source=index===undefined?undefined:g.parser.json.textures[index]?.source;const uri=source===undefined?undefined:g.parser.json.images[source]?.uri;if(uri)material.map=textures.use(texture,`models/styloo/${uri}`);}});return g;});sourceCache.set(model,p);}return p;}
/** A whole native rig with its own source motion. It is intentionally not the player's combat rig. */
export class ChibiCandidate{
 readonly root=new THREE.Group();readonly ready:Promise<void>;
 private disposed=false;private rig:THREE.Object3D|null=null;private mixer:THREE.AnimationMixer|null=null;
 private actions=new Map<string,THREE.AnimationAction>();private current:THREE.AnimationAction|null=null;private previous=performance.now();
 constructor(readonly model:ChibiCast,height=1.55){this.ready=this.build(height);}
 private async build(height:number){
  const source=await loadChibiSource(this.model);if(this.disposed)return;
  const rig=this.rig=SkeletonUtils.clone(source.scene);this.root.add(rig);this.mixer=new THREE.AnimationMixer(rig);
  rig.traverse(o=>{const m=o as THREE.Mesh;if(!m.isMesh)return;m.castShadow=true;m.receiveShadow=false;m.frustumCulled=false;});
  for(const clip of source.animations)this.actions.set(clip.name,this.mixer.clipAction(clip));
  this.setMotion('idle');this.mixer.update(0);rig.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(rig).applyMatrix4(this.root.matrixWorld.clone().invert()),size=box.getSize(new THREE.Vector3()),scale=height/Math.max(.01,size.y);
  rig.scale.multiplyScalar(scale);rig.position.add(new THREE.Vector3(-(box.min.x+box.max.x)*scale*.5,-box.min.y*scale,-(box.min.z+box.max.z)*scale*.5));
  this.previous=performance.now();
 }
 setMotion(motion:ChibiMotion){
  const name=chibiClip([...this.actions.keys()],motion);if(!name)return false;
  const next=this.actions.get(name)!;if(next===this.current)return true;
  const old=this.current;next.reset().setEffectiveWeight(1).play();next.setLoop(motion==='dead'?THREE.LoopOnce:THREE.LoopRepeat,Infinity);next.clampWhenFinished=motion==='dead';
  if(old){next.crossFadeFrom(old,.15,false);}this.current=next;return true;
 }
 animate(_pose='idle',_t=0,_phase=0,_act=0){const now=performance.now();this.mixer?.update(Math.min(.05,(now-this.previous)/1000));this.previous=now;}
 dispose(){if(this.disposed)return;this.disposed=true;this.mixer?.stopAllAction();if(this.rig)this.mixer?.uncacheRoot(this.rig);
  const skeletons=new Set<THREE.Skeleton>();this.root.traverse(o=>{if((o as THREE.SkinnedMesh).isSkinnedMesh)skeletons.add((o as THREE.SkinnedMesh).skeleton);});skeletons.forEach(s=>s.dispose());this.root.clear();this.actions.clear();}
}
