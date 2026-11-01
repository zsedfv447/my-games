// Bakes Universal Animation Library clips (Quaternius / UE-style skeleton) onto other humanoid rigs
// (VRM avatars, Styloo Rigify chibis) through a shared humanoid bone vocabulary.
// Spine/neck/head copy the source's change from its rest pose; limbs aim each target bone along
// the source bone's current direction (so differing rest poses — T vs A — don't matter); hands also
// match the palm's sideways axis so weapons keep their angle. Hips move by the source's hip
// offset scaled to the target's leg length.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

export type Human='hips'|'spine'|'chest'|'upperChest'|'neck'|'head'|`${'left'|'right'}${'Shoulder'|'UpperArm'|'LowerArm'|'Hand'|'MiddleProximal'|'IndexProximal'|'LittleProximal'|'UpperLeg'|'LowerLeg'|'Foot'|'Toes'}`;
const clean=(n:string)=>THREE.PropertyBinding.sanitizeNodeName(n);
/** Universal Animation Library bone names. */
const UAL:Record<string,string>={hips:'pelvis',spine:'spine_01',chest:'spine_02',upperChest:'spine_03',neck:'neck_01',head:'Head'};
for(const [s,S] of [['l','left'],['r','right']]){Object.assign(UAL,{[`${S}Shoulder`]:`clavicle_${s}`,[`${S}UpperArm`]:`upperarm_${s}`,[`${S}LowerArm`]:`lowerarm_${s}`,[`${S}Hand`]:`hand_${s}`,
  [`${S}MiddleProximal`]:`middle_01_${s}`,[`${S}IndexProximal`]:`index_01_${s}`,[`${S}LittleProximal`]:`pinky_01_${s}`,[`${S}UpperLeg`]:`thigh_${s}`,[`${S}LowerLeg`]:`calf_${s}`,[`${S}Foot`]:`foot_${s}`,[`${S}Toes`]:`ball_${s}`});}
/** Styloo (Blender Rigify DEF-) bone names. */
export const RIGIFY:Record<string,string>={hips:'DEF-spine',spine:'DEF-spine.001',chest:'DEF-spine.002',upperChest:'DEF-spine.003',neck:'DEF-spine.004',head:'DEF-spine.005'};
for(const [S,s] of [['left','L'],['right','R']]){Object.assign(RIGIFY,{[`${S}Shoulder`]:`DEF-shoulder.${s}`,[`${S}UpperArm`]:`DEF-upper_arm.${s}`,[`${S}LowerArm`]:`DEF-forearm.${s}`,[`${S}Hand`]:`DEF-hand.${s}`,
  [`${S}MiddleProximal`]:`DEF-f_middle.01.${s}`,[`${S}IndexProximal`]:`DEF-f_index.01.${s}`,[`${S}LittleProximal`]:`DEF-f_pinky.01.${s}`,[`${S}UpperLeg`]:`DEF-thigh.${s}`,[`${S}LowerLeg`]:`DEF-shin.${s}`,[`${S}Foot`]:`DEF-foot.${s}`,[`${S}Toes`]:`DEF-toe.${s}`});}

type Mode='delta'|'aim'|'hand';
type Link={key:Human;mode:Mode;child?:Human;side?:[Human,Human]};
const LINKS:Link[]=[{key:'hips',mode:'delta'},{key:'spine',mode:'delta'},{key:'chest',mode:'delta'},{key:'upperChest',mode:'delta'},{key:'neck',mode:'delta'},{key:'head',mode:'delta'}];
for(const S of ['left','right'] as const)LINKS.push(
  {key:`${S}Shoulder`,mode:'aim',child:`${S}UpperArm`},{key:`${S}UpperArm`,mode:'aim',child:`${S}LowerArm`},{key:`${S}LowerArm`,mode:'aim',child:`${S}Hand`},
  {key:`${S}Hand`,mode:'hand',child:`${S}MiddleProximal`,side:[`${S}IndexProximal`,`${S}LittleProximal`]},
  {key:`${S}UpperLeg`,mode:'aim',child:`${S}LowerLeg`},{key:`${S}LowerLeg`,mode:'aim',child:`${S}Foot`},{key:`${S}Foot`,mode:'aim',child:`${S}Toes`});

let source:Promise<{scene:THREE.Object3D;clips:Map<string,THREE.AnimationClip>}>|null=null;
/** The animation library (both files) — clips plus a rest-pose mannequin to sample them on. */
export function loadMotionLibrary(){
  if(source)return source;
  const loader=new GLTFLoader();
  source=(async()=>{
    const clips=new Map<string,THREE.AnimationClip>();let scene:THREE.Object3D|null=null;
    for(const f of ['anim1','anim2']){const g=await loader.loadAsync(`models/${f}.glb`);scene??=g.scene;for(const c of g.animations)clips.set(c.name,c);}
    return {scene:scene!,clips};
  })();
  return source;
}
const wq=(o:THREE.Object3D)=>o.getWorldQuaternion(new THREE.Quaternion());
const wp=(o:THREE.Object3D)=>o.getWorldPosition(new THREE.Vector3());
/** Orthonormal frame from a primary direction and a rough side vector. */
function frame(dir:THREE.Vector3,side:THREE.Vector3){
  const x=dir.clone().normalize(),z=new THREE.Vector3().crossVectors(x,side).normalize(),y=new THREE.Vector3().crossVectors(z,x);
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x,y,z));
}
function byName(root:THREE.Object3D){const m=new Map<string,THREE.Object3D>();root.traverse(o=>{if(!m.has(o.name))m.set(o.name,o);});return m;}

/**
 * Bakes the named clips for a target rig. `target` must be at rest pose; it is posed while baking
 * and restored afterwards. `names` maps humanoid keys to the target's node names (RIGIFY, or a
 * VRM's raw bone names).
 */
export async function bakeClips(target:THREE.Object3D,names:Partial<Record<Human,string>>,clipNames:string[],fps=30):Promise<Map<string,THREE.AnimationClip>>{
  const S=await loadMotionLibrary();
  const src=SkeletonUtils.clone(S.scene);const holder=new THREE.Scene();holder.add(src);
  const prevParent=target.parent;holder.add(target);holder.updateMatrixWorld(true);
  const sn=byName(src),tn=byName(target);
  const s=(k:Human)=>sn.get(clean(UAL[k])),t=(k:Human)=>{const n=names[k];return n?tn.get(n)??tn.get(clean(n)):undefined;};
  const links=LINKS.filter(l=>s(l.key)&&t(l.key));
  const restLocal=new Map<THREE.Object3D,[THREE.Quaternion,THREE.Vector3]>();for(const l of links){const o=t(l.key)!;restLocal.set(o,[o.quaternion.clone(),o.position.clone()]);}
  const facing=(get:(k:Human)=>THREE.Object3D|undefined)=>{const r=wp(get('rightUpperLeg')!).sub(wp(get('leftUpperLeg')!));r.y=0;return new THREE.Vector3(0,1,0).cross(r).normalize();};
  const C=new THREE.Quaternion().setFromUnitVectors(facing(s),facing(t)),Ci=C.clone().invert();
  const rest=new Map<Human,{sq:THREE.Quaternion;tq:THREE.Quaternion;tDir?:THREE.Vector3;tFrame?:THREE.Quaternion}>();
  for(const l of links){
    const r:{sq:THREE.Quaternion;tq:THREE.Quaternion;tDir?:THREE.Vector3;tFrame?:THREE.Quaternion}={sq:wq(s(l.key)!),tq:wq(t(l.key)!)};
    if(l.child&&t(l.child))r.tDir=wp(t(l.child)!).sub(wp(t(l.key)!)).normalize();
    if(l.mode==='hand'&&r.tDir&&l.side&&t(l.side[0])&&t(l.side[1]))r.tFrame=frame(r.tDir,wp(t(l.side[1])!).sub(wp(t(l.side[0])!)));
    rest.set(l.key,r);
  }
  const sHip=s('hips')!,tHip=t('hips')!,sHipRest=wp(sHip),tHipRest=wp(tHip);
  const ratio=(tHipRest.y-wp(t('leftFoot')??tHip).y)/Math.max(.01,sHipRest.y-wp(s('leftFoot')!).y);
  const mixer=new THREE.AnimationMixer(src);const out=new Map<string,THREE.AnimationClip>();
  for(const name of clipNames){
    const clip=S.clips.get(name);if(!clip)continue;
    mixer.stopAllAction();mixer.clipAction(clip).reset().play();
    const frames=Math.max(2,Math.round(clip.duration*fps)+1),times:number[]=[],qv=new Map<Human,number[]>(),pv:number[]=[];
    for(let f=0;f<frames;f++){
      const time=Math.min(clip.duration,f/fps);times.push(time);mixer.setTime(time);src.updateMatrixWorld(true);
      for(const l of links){
        const node=t(l.key)!,r=rest.get(l.key)!;let want:THREE.Quaternion;
        const child=l.child&&s(l.child);
        if(l.mode==='delta'||!r.tDir||!child){
          want=C.clone().multiply(wq(s(l.key)!)).multiply(r.sq.clone().invert()).multiply(Ci).multiply(r.tq);
        }else{
          const dir=wp(child).sub(wp(s(l.key)!)).normalize().applyQuaternion(C);
          const a=l.side&&s(l.side[0]),b=l.side&&s(l.side[1]);
          if(l.mode==='hand'&&r.tFrame&&a&&b)want=frame(dir,wp(b).sub(wp(a)).applyQuaternion(C)).multiply(r.tFrame.clone().invert()).multiply(r.tq);
          else want=new THREE.Quaternion().setFromUnitVectors(r.tDir,dir).multiply(r.tq);
        }
        const parentQ=node.parent?wq(node.parent):new THREE.Quaternion();
        node.quaternion.copy(parentQ.invert().multiply(want));node.updateMatrixWorld(true);
        let arr=qv.get(l.key);if(!arr){arr=[];qv.set(l.key,arr);}arr.push(node.quaternion.x,node.quaternion.y,node.quaternion.z,node.quaternion.w);
      }
      const world=tHipRest.clone().add(wp(sHip).sub(sHipRest).applyQuaternion(C).multiplyScalar(ratio));
      const local=tHip.parent?tHip.parent.worldToLocal(world):world;tHip.position.copy(local);tHip.updateMatrixWorld(true);pv.push(local.x,local.y,local.z);
    }
    const tracks:THREE.KeyframeTrack[]=[...qv].map(([k,v])=>new THREE.QuaternionKeyframeTrack(`${t(k)!.name}.quaternion`,times,v));
    tracks.push(new THREE.VectorKeyframeTrack(`${tHip.name}.position`,times,pv));
    out.set(name,new THREE.AnimationClip(name,clip.duration,tracks));
  }
  mixer.stopAllAction();
  for(const [o,[q,p]] of restLocal){o.quaternion.copy(q);o.position.copy(p);}
  if(prevParent)prevParent.add(target);else holder.remove(target);target.updateMatrixWorld(true);
  return out;
}
