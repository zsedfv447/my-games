// "See-through" occluders: any world geometry standing between the camera and the player is
// dithered away inside a soft circle around the player on screen, so houses, trees and walls never
// hide your character. Implemented as a fragment-shader patch on the world's lit materials.
import * as THREE from 'three';

/** xy = player's screen position (drawing-buffer pixels), z = radius (px), w = player's view depth. */
export const fadeUniform={value:new THREE.Vector4(-1e5,-1e5,0,0)};
const patched=new WeakSet<THREE.Material>();

function patch(m:THREE.Material){
  if(patched.has(m)||!(m as THREE.MeshStandardMaterial).isMeshStandardMaterial&&!(m as THREE.MeshToonMaterial).isMeshToonMaterial&&!(m as THREE.MeshLambertMaterial).isMeshLambertMaterial)return;
  patched.add(m);
  const prev=m.onBeforeCompile.bind(m),prevKey=m.customProgramCacheKey.bind(m);
  m.onBeforeCompile=(sh,r)=>{prev(sh,r);sh.uniforms.uFade=fadeUniform;
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nuniform vec4 uFade;')
      .replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
  {float fd=distance(gl_FragCoord.xy,uFade.xy);
   if(fd<uFade.z&&-vViewPosition.z<uFade.w-.8){
     float k=smoothstep(uFade.z,uFade.z*.55,fd);
     float ign=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))));
     if(k*.85>ign)discard;}}`);};
  m.customProgramCacheKey=()=>`${prevKey()}|fade`;
  m.needsUpdate=true;
}
/** Applies the fade to every mesh in `root` that stands up (flat ground and water are skipped). */
export function enableOcclusionFade(root:THREE.Object3D){
  root.updateMatrixWorld(true);const box=new THREE.Box3();
  root.traverse(o=>{const mesh=o as THREE.Mesh;if(!mesh.isMesh||!mesh.geometry)return;
    box.setFromObject(mesh);if(!isFinite(box.max.y)||box.max.y-box.min.y<.6||box.max.y<.6)return;
    for(const m of Array.isArray(mesh.material)?mesh.material:[mesh.material])patch(m);});
}
const v=new THREE.Vector3();
/** Call each frame with the player's position. */
export function updateOcclusionFade(renderer:THREE.WebGLRenderer,cam:THREE.PerspectiveCamera,x:number,z:number,dist:number){
  v.set(x,1,z).applyMatrix4(cam.matrixWorldInverse);const depth=-v.z;
  v.set(x,1,z).project(cam);const size=renderer.getDrawingBufferSize(new THREE.Vector2());
  fadeUniform.value.set((v.x*.5+.5)*size.x,(v.y*.5+.5)*size.y,size.y*.13*(13/Math.max(4,dist)),depth);
}
