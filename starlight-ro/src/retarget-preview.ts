// Dev-only: Styloo chibis playing retargeted combat clips (not part of the game build).
import * as THREE from 'three';
import { Engine } from './render3d/engine';
import { ChibiHero } from './render3d/chibi-hero';
import type { CharLook, CharPose } from './render3d/character3d';
const e=new Engine(document.getElementById('v')!);e.setMood('meadow');
const ground=new THREE.Mesh(new THREE.CircleGeometry(30,48),new THREE.MeshStandardMaterial({color:'#8cc46a',roughness:.95}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;e.scene.add(ground);
const q=new URLSearchParams(location.search);
const looks:CharLook[]=[
  {outfit:'novice',hair:0,hairColor:'#5a3b2e',weapon:'dagger'},
  {outfit:'swordman',hair:0,hairColor:'#5a3b2e',weapon:'sword'},
  {outfit:'mage',hair:0,hairColor:'#5a3b2e',weapon:'staff'},
  {outfit:'archer',hair:0,hairColor:'#5a3b2e',weapon:'bow'},
];
const pose=(q.get('pose')??'attack') as CharPose;
const heroes=looks.map((l,i)=>{const h=new ChibiHero(l);h.root.position.set((i-1.5)*Number(q.get('sp')??1.1),0,0);e.scene.add(h.root);return h;});
Promise.all(heroes.map(h=>h.ready)).then(()=>{document.getElementById('ui')!.textContent='OK '+pose;}).catch(err=>{document.getElementById('ui')!.textContent='ERR '+err;console.error(err);});
let t=0,last=performance.now();const yaw=Number(q.get('yaw')??0),dist=Number(q.get('d')??5),pitch=Number(q.get('p')??.25),ty=Number(q.get('ty')??.7);
function loop(){const now=performance.now(),dt=Math.min(.05,(now-last)/1000);last=now;t+=dt;
  const fixed=q.get('act');const act=fixed!==null?Number(fixed):(t*1.2)%1;
  heroes.forEach(h=>{h.root.rotation.y=Number(q.get('ry')??.4);h.animate(pose,t,0,act);});
  e.camera.position.set(Math.sin(yaw)*dist,ty+dist*Math.sin(pitch),Math.cos(yaw)*dist);e.camera.lookAt(0,ty,0);e.follow(new THREE.Vector3(0,0,0));e.render();requestAnimationFrame(loop);}
loop();
// Reference: the source mannequin playing the same clip.
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
const clipName=q.get('clip')??'Sword_Regular_A';
Promise.all([new GLTFLoader().loadAsync('models/anim1.glb'),new GLTFLoader().loadAsync('models/anim2.glb')]).then(([a,b])=>{
  const ref=b.scene;ref.position.set(-3.6,0,0);ref.scale.setScalar(.8);ref.rotation.y=Number(q.get('ry')??.4);e.scene.add(ref);
  const clip=[...a.animations,...b.animations].find(c=>c.name===clipName)!;const m=new THREE.AnimationMixer(ref);const act=m.clipAction(clip);act.play();
  (window as unknown as {__ref:unknown}).__ref={ref,heroes};
  const tick=()=>{const fixed=q.get('act');m.setTime(fixed!==null?Number(fixed)*clip.duration*.85:(performance.now()/1000*1.2%1)*clip.duration);requestAnimationFrame(tick);};tick();
});
