import {describe,it,expect,vi,afterEach} from 'vitest';
import * as THREE from 'three';
import {Hero} from './hero';
function rig(){
  const duration=13/30,clip=new THREE.AnimationClip('Sword_Regular_A',duration,[new THREE.NumberKeyframeTrack('.position[x]',[0,duration],[0,1])]);
  const root=new THREE.Object3D(),mixer=new THREE.AnimationMixer(root),attack=mixer.clipAction(clip);
  const hero=Object.create(Hero.prototype) as any;
  const bones=new Map(['pelvis','spine_01','Head','thigh_l','thigh_r'].map(name=>[name,new THREE.Object3D()]));
  Object.assign(hero,{mixer,look:{},current:null,actions:new Map([['attack',attack],['idle',mixer.clipAction(new THREE.AnimationClip('idle',1,[]))]]),last:0,lastAct:0,bones,pelvisRaw:new THREE.Vector3(),chibi:{torso:1,head:1,legs:1}});
  return {hero,attack,duration};
}
afterEach(()=>vi.restoreAllMocks());
describe('native Hero combat action follows presentation progress',()=>{
  it('samples the actual native action from explicit progress rather than a second wall clock',()=>{
    vi.spyOn(performance,'now').mockReturnValue(5000);const {hero,attack,duration}=rig();
    hero.animate('attack',0,0,.5,true);expect(attack.time).toBeCloseTo(duration*.5,8);
    hero.animate('attack',0,0,.8,true);expect(attack.time).toBeCloseTo(duration*.8,8);
  });
  it('rapid repeated attacks reset to their new visible phase even before the old clip has finished',()=>{
    vi.spyOn(performance,'now').mockReturnValue(5000);const {hero,attack,duration}=rig();
    hero.animate('attack',0,0,.8,true);hero.animate('attack',0,0,0,true);expect(attack.time).toBe(0);
    hero.animate('attack',0,0,.45,true);expect(attack.time).toBeCloseTo(duration*.45,8);
  });
});
