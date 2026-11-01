// Dev-only lineup of the skinned Quaternius-based heroes (not part of the game build).
import * as THREE from 'three';
import { Engine } from './render3d/engine';
import type { CharLook } from './render3d/character3d';
import { Hero, heroLookFrom,type HeroLook, type HeroPose } from './render3d/hero';
const e=new Engine(document.getElementById('v')!);e.setMood('meadow');
const ground=new THREE.Mesh(new THREE.CircleGeometry(30,48),new THREE.MeshStandardMaterial({color:'#8cc46a',roughness:.95}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;e.scene.add(ground);
const q=new URLSearchParams(location.search);
const looks:HeroLook[]=[
  {sex:'f',outfit:'ranger',hair:'hair_long',hairColor:'#f2c14e'},
  {sex:'m',outfit:'ranger',hair:'hair_simpleparted',hairColor:'#d9534f',shirt:'#e9edf3'},
  {sex:'f',outfit:'peasant',hair:'hair_buns',hairColor:'#ff9ec4'},
  {sex:'m',outfit:'peasant',hair:'hair_buzzed',hairColor:'#5a3b2e',shirt:'#f4ead8'},
];
if(q.has('jobs')){const jobs=q.get('jobs')!.split(',');const sexes=(q.get('sexes')??'m,m,f,f').split(',');
  for(let i=0;i<looks.length;i++){const job=(jobs[i%jobs.length]??'novice') as CharLook['outfit'];looks[i]=heroLookFrom({outfit:job,hair:i,hairColor:looks[i].hairColor,weapon:job==='swordman'?'sword':job==='mage'?'staff':job==='archer'?'bow':'dagger'},sexes[i%sexes.length]==='f');}}
if(q.has('heads')||q.has('backs')){const heads=(q.get('heads')??'').split(','),backs=(q.get('backs')??'').split(',');for(let i=0;i<looks.length;i++){const l=looks[i].character??{outfit:'novice' as const,hair:i,hairColor:looks[i].hairColor,weapon:null};looks[i].character={...l,costumeHead:heads[i%heads.length]||null,costumeBack:backs[i%backs.length]||null};}}
if(q.has('weapons')){const ids=q.get('weapons')!.split(',');for(let i=0;i<looks.length;i++){const l=looks[i].weaponFrom;if(l)l.weaponStyle=ids[i%ids.length];}}
const poses:HeroPose[]=(q.get('poses')??'idle,walk,attack,cast').split(',') as HeroPose[];
const heroes=looks.map((l,i)=>{const h=new Hero(l);if(q.get('raw'))h.chibi={head:1,legs:1,torso:1};const sp=Number(q.get('sp')??1.5);h.root.position.set((i-1.5)*sp,0,0);e.scene.add(h.root);return h;});
Promise.all(heroes.map(h=>h.ready)).then(()=>{document.getElementById('ui')!.textContent='OK';}).catch(err=>{document.getElementById('ui')!.textContent='ERR '+err;console.error(err);});
let t=0,last=performance.now();const yaw=Number(q.get('yaw')??0),dist=Number(q.get('d')??6),pitch=Number(q.get('p')??.25),ty=Number(q.get('ty')??.8);
function loop(){const now=performance.now(),dt=Math.min(.05,(now-last)/1000);last=now;t+=dt;
  heroes.forEach((h,i)=>{h.root.rotation.y=Number(q.get('ry')??.3);h.animate(poses[i%poses.length],dt);});
  e.camera.position.set(Math.sin(yaw)*dist,ty+dist*Math.sin(pitch),Math.cos(yaw)*dist);e.camera.lookAt(0,ty,0);e.follow(new THREE.Vector3(0,0,0));e.render();requestAnimationFrame(loop);}
loop();
