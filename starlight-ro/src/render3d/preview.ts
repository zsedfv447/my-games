// Small standalone 3D turntable used on the character-creation screen.
import * as THREE from 'three';
import { type CharLook } from './character3d';
import { VrmHero, vrmLookFrom } from './vrm-hero';
import { hairColors } from '../rules/state';

export function mountPreview(host:HTMLElement,initial:CharLook){
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.shadowMap.enabled=true;
  const w=host.clientWidth||180,h=host.clientHeight||240;renderer.setSize(w,h);host.appendChild(renderer.domElement);
  const scene=new THREE.Scene(),cam=new THREE.PerspectiveCamera(30,w/h,.1,50);cam.position.set(0,1.15,4.6);cam.lookAt(0,.88,0);
  const sun=new THREE.DirectionalLight('#fff4e0',2.6);sun.position.set(2,4,3);sun.castShadow=true;scene.add(sun,new THREE.HemisphereLight('#dff0ff','#8fbf70',1.2));
  const floor=new THREE.Mesh(new THREE.CircleGeometry(.9,40),new THREE.ShadowMaterial({opacity:.25}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;scene.add(floor);
  let chibi=new VrmHero(vrmLookFrom(initial,hairColors[0]));scene.add(chibi.root);
  let t=0,alive=true,pose:'idle'|'walk'|'cast'='idle',poseT=0,last=performance.now(),raf=0;
  const resize=()=>{const w=host.clientWidth||180,h=host.clientHeight||240;renderer.setSize(w,h);cam.aspect=w/h;cam.updateProjectionMatrix();};
  const observer=new ResizeObserver(resize);observer.observe(host);
  const loop=()=>{if(!alive)return;const now=performance.now(),dt=Math.min(.05,(now-last)/1000);last=now;t+=dt;poseT+=dt;
    if(poseT>3){poseT=0;pose=pose==='idle'?'walk':pose==='walk'?'cast':'idle';}
    chibi.root.rotation.y=Math.sin(t*.6)*.7;chibi.animate(pose);renderer.render(scene,cam);raf=requestAnimationFrame(loop);};
  loop();
  return {
    update(look:CharLook){scene.remove(chibi.root);chibi.dispose();chibi=new VrmHero(vrmLookFrom(look,hairColors[0]));scene.add(chibi.root);pose='cast';poseT=1.8;},
    dispose(){alive=false;cancelAnimationFrame(raf);observer.disconnect();chibi.dispose();floor.geometry.dispose();floor.material.dispose();sun.shadow.dispose();renderer.dispose();renderer.domElement.remove();},
  };
}
