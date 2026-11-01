// Dev-only lineup of the VRoid avatars with retargeted motion (not part of the game build).
import * as THREE from 'three';
import { Engine } from './render3d/engine';
import { VrmHero, VRM_CAST, type VrmCast } from './render3d/vrm-hero';
import type { CharPose } from './render3d/character3d';
const e=new Engine(document.getElementById('v')!);e.setMood('meadow');
const ground=new THREE.Mesh(new THREE.CircleGeometry(30,48),new THREE.MeshStandardMaterial({color:'#8cc46a',roughness:.95}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;e.scene.add(ground);
const q=new URLSearchParams(location.search);
const ids=(q.get('ids')?.split(',')??[...VRM_CAST]) as VrmCast[];const weapons=['sword','staff','bow','dagger'] as const;
const pose=(q.get('pose')??'idle') as CharPose;const sp=Number(q.get('sp')??.9);
const heroes=ids.map((id,i)=>{const h=new VrmHero({cast:id,weapon:q.get('w')?(q.get('w')==='sword'?'sword':weapons[i%4]):null,head:q.get('head')?Number(q.get('head')):undefined,job:q.get('job')??['swordman','mage','archer','novice'][i%4]});h.root.position.set((i-(ids.length-1)/2)*sp,0,0);e.scene.add(h.root);return h;});
(window as unknown as {__h:unknown}).__h={heroes,e};
const t0=performance.now();
Promise.all(heroes.map(h=>h.ready)).then(()=>{document.getElementById('ui')!.textContent=`OK ${pose} ${((performance.now()-t0)/1000).toFixed(1)}s`;}).catch(err=>{document.getElementById('ui')!.textContent='ERR '+err;console.error(err);});
const yaw=Number(q.get('yaw')??0),dist=Number(q.get('d')??7),pitch=Number(q.get('p')??.22),ty=Number(q.get('ty')??.75);let t=0,last=performance.now();
function loop(){const now=performance.now(),dt=Math.min(.05,(now-last)/1000);last=now;t+=dt;
  const fixed=q.get('act');const act=fixed!==null?Number(fixed):(t*1.1)%1;
  heroes.forEach((h,i)=>{h.root.rotation.y=Number(q.get('ry')??.3);h.animate(pose,t,0,act);});
  e.camera.position.set(Math.sin(yaw)*dist,ty+dist*Math.sin(pitch),Math.cos(yaw)*dist);e.camera.lookAt(0,ty,0);e.follow(new THREE.Vector3(0,0,0));e.render();requestAnimationFrame(loop);}
loop();
