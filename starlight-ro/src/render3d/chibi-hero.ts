// Player / NPC hero built on a complete Styloo anime-chibi character (native head, body, rig),
// with its own idle/walk/run/dying motion plus combat motion retargeted from the Universal
// Animation Library (sword combos, spell casting, hit reaction, sitting).
import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { type CharLook, type CharPose } from './character3d';
import { loadChibiSource } from './chibi-candidate';
import { type ChibiCast } from './chibi-profile';
import { bakeClips, RIGIFY } from './retarget';
import { buildWeaponAppearance, type WeaponAppearance } from './weapon-appearance';

type Pose=CharPose|'run';
/** Which complete chibi outfit each job wears. */
export function castFor(look:CharLook):ChibiCast{
  const byJob:Record<string,ChibiCast>={novice:'student',swordman:'knight',mage:'merchant',archer:'archer',npc:'merchant'};
  return byJob[look.outfit]??'student';
}
const COMBAT={attack:['Sword_Regular_A','Sword_Regular_B','Sword_Regular_C'],cast:['Spell_Simple_Shoot'],shoot:['OverhandThrow'],sit:['Sitting_Idle_Loop'],hurt:['Hit_Chest']};
const baked=new Map<ChibiCast,Promise<Map<string,THREE.AnimationClip>>>();
async function combatClips(cast:ChibiCast){
  let p=baked.get(cast);
  if(!p){p=loadChibiSource(cast).then(g=>bakeClips(SkeletonUtils.clone(g.scene),RIGIFY,Object.values(COMBAT).flat()));baked.set(cast,p);}
  return p;
}

export class ChibiHero{
  readonly root=new THREE.Group();readonly ready:Promise<void>;
  private rig:THREE.Object3D|null=null;private mixer:THREE.AnimationMixer|null=null;
  private actions=new Map<string,THREE.AnimationAction>();private current:THREE.AnimationAction|null=null;
  private last=performance.now();private lastAct=0;private combo=0;private disposed=false;
  private weapon:WeaponAppearance|null=null;
  constructor(readonly look:CharLook,readonly cast:ChibiCast=castFor(look),height=1.45){this.ready=this.build(height);}
  private async build(height:number){
    const [src,combat]=await Promise.all([loadChibiSource(this.cast),combatClips(this.cast)]);if(this.disposed)return;
    const rig=this.rig=SkeletonUtils.clone(src.scene);this.root.add(rig);
    rig.traverse(o=>{const m=o as THREE.Mesh;if(m.isMesh){m.castShadow=true;m.receiveShadow=false;m.frustumCulled=false;}});
    // Normalise height and stand on the origin.
    rig.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(rig),size=box.getSize(new THREE.Vector3()),k=height/Math.max(.01,size.y);
    rig.scale.multiplyScalar(k);rig.position.set(-(box.min.x+box.max.x)*k*.5,-box.min.y*k,-(box.min.z+box.max.z)*k*.5);
    this.mixer=new THREE.AnimationMixer(rig);
    const nat=(re:RegExp)=>src.animations.find(c=>re.test(c.name));
    const add=(key:string,clip:THREE.AnimationClip|undefined,once=false)=>{if(!clip)return;const a=this.mixer!.clipAction(clip);if(once){a.setLoop(THREE.LoopOnce,1);a.clampWhenFinished=true;}this.actions.set(key,a);};
    add('idle',nat(/^anim_iddle$/));add('walk',nat(/walk/));add('run',nat(/run/));add('dead',nat(/dying/),true);
    COMBAT.attack.forEach((n,i)=>add(`attack${i}`,combat.get(n),true));
    add('cast',combat.get(COMBAT.cast[0]),true);add('shoot',combat.get(COMBAT.shoot[0])??combat.get(COMBAT.cast[0]),true);
    add('sit',combat.get(COMBAT.sit[0]));add('hurt',combat.get(COMBAT.hurt[0]),true);
    this.addWeapon(rig);
    this.play('idle');this.mixer.update(0);
  }
  private addWeapon(rig:THREE.Object3D){
    const w=this.look.weapon;if(!w)return;
    const bow=w==='bow',hand=rig.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(bow?'DEF-hand.L':'DEF-hand.R'));if(!hand)return;
    this.weapon=buildWeaponAppearance(w,this.look.weaponStyle,this.look.refine);
    rig.updateMatrixWorld(true);const hs=Math.max(1e-4,hand.getWorldScale(new THREE.Vector3()).x);
    // Rigify hand bones point +Y down the fingers; grip sits across the palm, blade along the thumb side.
    const g=this.weapon.group;g.scale.setScalar((w==='dagger'?.8:.85)/hs);g.position.set(0,.05/hs,0);g.rotation.set(bow?0:Math.PI/2,0,bow?0:Math.PI/2);
    hand.add(g);
  }
  private play(key:string,fade=.15){
    const a=this.actions.get(key)??this.actions.get('idle');if(!a||a===this.current)return;
    a.reset().play();if(this.current){if(fade>0)a.crossFadeFrom(this.current,fade,false);else this.current.stop();}this.current=a;
  }
  animate(pose:Pose,_t=0,_phase=0,act=0,_sync=false){
    if(!this.mixer)return;
    const now=performance.now(),dt=Math.min(.05,(now-this.last)/1000);this.last=now;
    const w=this.look.weapon;let key:string=pose;
    if(pose==='attack'){
      if(act<this.lastAct-.2)this.combo=(this.combo+1)%3;
      key=w==='staff'?'cast':w==='bow'?'shoot':`attack${this.combo}`;
      const a=this.actions.get(key);
      if(a&&a===this.current&&act<this.lastAct-.2)a.reset().play();
      this.play(key,0);
      // Map the sim's attack phase onto the clip so the hit lands on the swing.
      if(this.current&&this.actions.get(key)===this.current){this.current.time=Math.min(1,act)*this.current.getClip().duration*.85;}
      this.lastAct=act;
    }else{this.lastAct=0;
      if(pose==='cast'){const a=this.actions.get('cast');if(a!==this.current)this.play('cast');else if(!a.isRunning())a.reset().play();}
      else this.play(key);}
    this.mixer.update(pose==='attack'?0:dt);
    if(this.weapon&&this.weapon.group.userData.glow!==undefined){/* weapon glow handled by its own material */}
  }
  setExpression(_e:string){}
  dispose(){if(this.disposed)return;this.disposed=true;this.mixer?.stopAllAction();if(this.rig)this.mixer?.uncacheRoot(this.rig);this.weapon?.dispose();this.root.clear();}
}
