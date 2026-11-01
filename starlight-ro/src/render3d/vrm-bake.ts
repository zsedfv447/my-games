// Collapses a VRoid avatar (~70 skinned primitives, each with its own MToon material) into ONE
// skinned mesh with ONE texture atlas and a light cartoon material, so a townsperson costs a single
// draw call instead of ~70 per pass. The skeleton is kept, so retargeted motion and spring-bone
// hair/cloth sway still work; facial expressions (morph targets) are dropped.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { cartoonize } from './hero';

type Part={mesh:THREE.SkinnedMesh;geo:THREE.BufferGeometry;mat:THREE.Material&{map?:THREE.Texture|null;color?:THREE.Color}};
const CELL=512;

/** Draws every distinct texture (tinted by its material colour) into a square atlas grid. */
function buildAtlas(parts:Part[]){
  const keys=new Map<string,number>(),cells:{img:CanvasImageSource|null;color:THREE.Color}[]=[];
  const keyOf=(p:Part)=>`${p.mat.map?.uuid??'none'}|${p.mat.color?.getHexString()??'ffffff'}`;
  for(const p of parts){const k=keyOf(p);if(!keys.has(k)){keys.set(k,cells.length);cells.push({img:(p.mat.map?.image as CanvasImageSource)??null,color:p.mat.color?.clone()??new THREE.Color(1,1,1)});}}
  const grid=Math.ceil(Math.sqrt(cells.length)),size=grid*CELL;
  const c=document.createElement('canvas');c.width=c.height=size;const g=c.getContext('2d')!;
  cells.forEach((cell,i)=>{const x=(i%grid)*CELL,y=Math.floor(i/grid)*CELL;
    const tint=`#${cell.color.clone().convertLinearToSRGB().getHexString()}`;
    if(cell.img){
      if(tint==='#ffffff')g.drawImage(cell.img,x,y,CELL,CELL);
      else{// Tint on a scratch canvas: 'destination-in' would otherwise wipe the rest of the atlas.
        const t=document.createElement('canvas');t.width=t.height=CELL;const tg=t.getContext('2d')!;tg.drawImage(cell.img,0,0,CELL,CELL);
        tg.globalCompositeOperation='multiply';tg.fillStyle=tint;tg.fillRect(0,0,CELL,CELL);tg.globalCompositeOperation='destination-in';tg.drawImage(cell.img,0,0,CELL,CELL);
        g.drawImage(t,x,y);}}
    else{g.fillStyle=tint;g.fillRect(x,y,CELL,CELL);}});
  const tex=new THREE.CanvasTexture(c);tex.flipY=false;tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=4;
  return {tex,grid,cellOf:(p:Part)=>keys.get(keyOf(p))!};
}

export function bakeAvatar(scene:THREE.Object3D):THREE.SkinnedMesh|null{
  const parts:Part[]=[];
  scene.traverse(o=>{const m=o as THREE.SkinnedMesh;if(!m.isSkinnedMesh||!m.visible)return;
    const mats=(Array.isArray(m.material)?m.material:[m.material]) as Part['mat'][];
    if(!Array.isArray(m.material)){if(mats[0].visible&&!(mats[0] as {isOutline?:boolean}).isOutline)parts.push({mesh:m,geo:m.geometry,mat:mats[0]});return;}
    for(const gr of m.geometry.groups){const mat=mats[gr.materialIndex??0];if(!mat?.visible||(mat as {isOutline?:boolean}).isOutline)continue;
      const sub=m.geometry.clone();sub.setIndex(Array.from(m.geometry.index!.array.slice(gr.start,gr.start+gr.count)));sub.clearGroups();parts.push({mesh:m,geo:sub,mat});}});
  if(!parts.length)return null;
  const first=parts[0].mesh;
  // Unified skeleton: every bone used by any part, with its inverse bind matrix.
  const bones:THREE.Bone[]=[],inverses:THREE.Matrix4[]=[],bonesIndex=new Map<THREE.Bone,number>(),skinD=new Map<THREE.SkinnedMesh,THREE.Matrix4>();
  // Each glTF skin carries its own inverse bind matrices. Relate every skin to the first one through
  // D = IBM₀(b)⁻¹ · IBMₘ(b) (constant per skin) and store all inverses in the first skin's space.
  for(const m of new Set(parts.map(p=>p.mesh))){
    const own=m.skeleton.bones,ref=own.findIndex(b=>bonesIndex.has(b));
    const D=ref<0?new THREE.Matrix4():inverses[bonesIndex.get(own[ref])!].clone().invert().multiply(m.skeleton.boneInverses[ref]);skinD.set(m,D);
    const Dinv=D.clone().invert();
    own.forEach((b,i)=>{if(!bonesIndex.has(b)){bonesIndex.set(b,bones.length);bones.push(b);inverses.push(m.skeleton.boneInverses[i].clone().multiply(Dinv));}});
  }
  const atlas=buildAtlas(parts);const bindInv=first.bindMatrix.clone().invert();
  const geos:THREE.BufferGeometry[]=[];
  const v=new THREE.Vector3(),nm=new THREE.Matrix3();
  for(const p of parts){
    // Compact each primitive to the vertices its triangles actually use, reading through accessors
    // (VRoid face/body buffers are interleaved, which mergeGeometries cannot handle).
    const src=p.geo,A=src.attributes,tri=src.index?src.index.array:[...Array(A.position.count).keys()];
    const remap=new Map<number,number>(),used:number[]=[],index:number[]=[];
    for(let i=0;i<tri.length;i++){const o=tri[i];let n=remap.get(o);if(n===undefined){n=used.length;remap.set(o,n);used.push(o);}index.push(n);}
    const own=p.mesh.skeleton.bones;
    const n=used.length,P=new Float32Array(n*3),N=new Float32Array(n*3),UV=new Float32Array(n*2),SI=new Uint16Array(n*4),SW=new Float32Array(n*4);
    // Into the shared bind space: pos' = B₀⁻¹ · D · Bₘ · pos.
    const D=skinD.get(p.mesh)!;
    const toFirst=bindInv.clone().multiply(D).multiply(p.mesh.bindMatrix);nm.getNormalMatrix(toFirst);
    const cell=atlas.cellOf(p),cx=(cell%atlas.grid)/atlas.grid,cy=Math.floor(cell/atlas.grid)/atlas.grid,s=1/atlas.grid;
    used.forEach((o,i)=>{
      v.fromBufferAttribute(A.position as THREE.BufferAttribute,o).applyMatrix4(toFirst);P.set([v.x,v.y,v.z],i*3);
      if(A.normal){v.fromBufferAttribute(A.normal as THREE.BufferAttribute,o).applyMatrix3(nm).normalize();N.set([v.x,v.y,v.z],i*3);}
      const u=A.uv?A.uv.getX(o):0,w=A.uv?A.uv.getY(o):0,fu=u>=0&&u<=1?u:u-Math.floor(u),fw=w>=0&&w<=1?w:w-Math.floor(w);UV[i*2]=cx+fu*s;UV[i*2+1]=cy+fw*s;
      for(let k=0;k<4;k++){SI[i*4+k]=bonesIndex.get(own[A.skinIndex.getComponent(o,k)])??0;SW[i*4+k]=A.skinWeight.getComponent(o,k);}
    });
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(P,3));g.setAttribute('normal',new THREE.BufferAttribute(N,3));
    g.setAttribute('uv',new THREE.BufferAttribute(UV,2));g.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(SI,4));g.setAttribute('skinWeight',new THREE.BufferAttribute(SW,4));
    g.setIndex(index);geos.push(g);
  }
  const merged=mergeGeometries(geos,false);if(!merged)return null;geos.forEach(g=>g.dispose());
  const material=cartoonize(new THREE.MeshStandardMaterial({map:atlas.tex,alphaTest:.5,side:THREE.DoubleSide}),{sat:1.05,bright:1.1});
  const mesh=new THREE.SkinnedMesh(merged,material);mesh.name='bakedAvatar';
  mesh.position.copy(first.position);mesh.quaternion.copy(first.quaternion);mesh.scale.copy(first.scale);
  first.parent!.add(mesh);mesh.bind(new THREE.Skeleton(bones,inverses),first.bindMatrix.clone());
  mesh.frustumCulled=false;mesh.castShadow=false;mesh.receiveShadow=false;mesh.userData.noAO=true;
  // Remove the originals.
  for(const m of new Set(parts.map(p=>p.mesh))){m.removeFromParent();m.geometry.dispose();}
  scene.traverse(o=>{const m=o as THREE.Mesh;if(m.isMesh&&m!==mesh&&(m as THREE.SkinnedMesh).isSkinnedMesh)m.visible=false;});
  return mesh;
}
