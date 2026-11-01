// Development-only visual regression harness. Uses the production map renderer; no save access.
import * as THREE from 'three';
import {Engine} from './render3d/engine';
import {buildMap} from './world/mapgen';
import {buildWorld,type WorldView} from './render3d/world3d';
const e=new Engine(document.getElementById('v')!);
let view:WorldView|null=null,id='town',yaw=Math.PI/4,pitch=.6,edge=false,spin=false,t=0,frame=0;
const focus=new THREE.Vector3(29,0,22);
const ao=e.composer.passes[1];
const bloom=e.composer.passes[2];
const sky=e.scene.children.find(o=>(o as THREE.Mesh).isMesh&&(o as THREE.Mesh).geometry?.type==='SphereGeometry')!;
const load=()=>{if(view){view.group.userData.disposeVisuals?.();e.scene.remove(view.group);}view=buildWorld(buildMap(id));e.scene.add(view.group);e.setMood(id==='town'?'town':id==='forest'?'forest':id==='cave'?'cave':'meadow');edge=false;};load();
document.getElementById('map')!.onchange=ev=>{id=(ev.target as HTMLSelectElement).value;load();};
const actions:Record<string,()=>void>={rotate:()=>yaw+=Math.PI/4,edge:()=>edge=true,center:()=>edge=false,pitch:()=>pitch=pitch===.6?.35:pitch===.35?1.2:.6,ao:()=>ao.enabled=!ao.enabled,bloom:()=>bloom.enabled=!bloom.enabled,sky:()=>sky.visible=!sky.visible,spin:()=>{spin=!spin;}};
for(const [key,fn] of Object.entries(actions))document.getElementById(key)!.onclick=()=>{fn();document.getElementById('ao')!.textContent='環境遮蔽 '+(ao.enabled?'開':'關');document.getElementById('bloom')!.textContent='泛光 '+(bloom.enabled?'開':'關');document.getElementById('sky')!.textContent='天空 '+(sky.visible?'開':'關');document.getElementById('spin')!.textContent='自動轉向 '+(spin?'開':'關');};
let last=performance.now(),maxBlack=0;
function loop(){const now=performance.now(),dt=Math.min(.05,(now-last)/1000);last=now;t+=dt;if(spin)yaw+=dt*.5;frame++;
focus.set(edge?5:29,0,edge?32:22);const dist=18,cp=Math.cos(pitch);e.camera.position.set(focus.x+Math.sin(yaw)*cp*dist,Math.sin(pitch)*dist+.8,focus.z+Math.cos(yaw)*cp*dist);e.camera.lookAt(focus.x,.9,focus.z);e.follow(focus);view!.update(t,e.night);e.render();
if(frame%30===0){const gl=e.renderer.getContext(),w=gl.drawingBufferWidth,h=gl.drawingBufferHeight,data=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,data);let black=0;for(let i=0;i<data.length;i+=4)if(data[i]<2&&data[i+1]<2&&data[i+2]<2)black++;const pct=black/(w*h)*100;maxBlack=Math.max(maxBlack,pct);document.getElementById('report')!.textContent=`${id} / yaw ${yaw.toFixed(2)} / pitch ${pitch} / edge ${edge}\n純黑像素 ${pct.toFixed(3)}%（本次最高 ${maxBlack.toFixed(3)}%）\n外部素材：${view!.group.userData.natureReady?'已載入':id==='cave'?'原洞窟素材':'載入中／備用'}`;}
requestAnimationFrame(loop);}loop();
