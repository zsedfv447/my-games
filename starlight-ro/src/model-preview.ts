// Dev-only 3D lineup of characters and monsters (not part of the game build).
import * as THREE from 'three';
import { Engine } from './render3d/engine';
import { Chibi, type CharLook } from './render3d/character3d';
import { MonsterModel } from './render3d/monster3d';
import { monsters } from './data/monsters';
import { hairColors } from './rules/state';
const e=new Engine(document.getElementById('v')!);e.setMood('meadow');
const ground=new THREE.Mesh(new THREE.CircleGeometry(30,48),new THREE.MeshStandardMaterial({color:'#8cc46a',roughness:.9}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;e.scene.add(ground);
const looks:CharLook[]=[
  {outfit:'novice',hair:0,hairColor:hairColors[0],weapon:'dagger'},
  {outfit:'swordman',hair:1,hairColor:hairColors[2],weapon:'sword',costumeBack:'heroCape',refine:5},
  {outfit:'mage',hair:2,hairColor:hairColors[6],weapon:'staff'},
  {outfit:'archer',hair:3,hairColor:hairColors[1],weapon:'bow',costumeHead:'catEars'},
  {outfit:'novice',hair:2,hairColor:hairColors[3],weapon:'dagger',costumeHead:'halo',costumeBack:'angelWings'},
  {outfit:'mage',hair:1,hairColor:hairColors[5],weapon:'staff',costumeHead:'bunnyEars',costumeBack:'fairyWings'},
];
const chars=looks.map((l,i)=>{const c=new Chibi(l);c.root.position.set(-5+i*2,0,2);e.scene.add(c.root);return c;});
const mons=Object.values(monsters).filter(m=>!m.mvp).map((m,i)=>{const mm=new MonsterModel(m.art);mm.root.position.set(-6+i*1.3,0,-1);e.scene.add(mm.root);return mm;});
const mvp=new MonsterModel(monsters.jellyKing.art);mvp.root.position.set(5,0,-4);e.scene.add(mvp.root);
const poses=['idle','walk','attack','cast','idle','walk'] as const;
let t=0;const q=new URLSearchParams(location.search);const yaw=Number(q.get('yaw')??0.35),dist=Number(q.get('d')??13),pitch=Number(q.get('p')??.62);
function loop(){t+=1/60;
  chars.forEach((c,i)=>{const p=poses[i];c.root.rotation.y=yaw*0+Math.sin(t*.4+i)*.6;c.animate(p,t+i,t*7,(t*1.5)%1);});
  mons.forEach((m,i)=>m.animate(i%2?'move':'idle',t+i,t*6));mvp.animate('idle',t,t*4);
  e.camera.position.set(Math.sin(yaw)*dist+Number(q.get('x')??0),dist*pitch,Math.cos(yaw)*dist+2);e.camera.lookAt(Number(q.get('x')??0),.8,2);e.follow(new THREE.Vector3(0,0,0));e.render();requestAnimationFrame(loop);}
loop();
