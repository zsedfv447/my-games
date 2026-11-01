// CC0 Quaternius Stylized Nature MegaKit. Static scenery only; simulation props stay unchanged.
import * as THREE from 'three';
import { loadStaticPack,staticWind } from './static-models';
import type { MapData, Prop } from '../world/mapgen';
import { prng } from '../render/art/util';

export const NATURE_FILES=['CommonTree_1','CommonTree_2','CommonTree_3','CommonTree_4','Pine_1','Pine_3','Pine_5','TwistedTree_1','DeadTree_1','Rock_Medium_1','Rock_Medium_2','Rock_Medium_3','Bush_Common','Bush_Common_Flowers','Fern_1','Flower_3_Group','Flower_4_Group','Flower_3_Single','Plant_1','Plant_7','Clover_1','Grass_Common_Short','Grass_Wispy_Short','Grass_Wispy_Tall','Mushroom_Common'] as const;
type Asset=typeof NATURE_FILES[number];
function choice(p:Prop,theme:string):Asset|null{
  if(p.kind==='tree')return (['CommonTree_1','CommonTree_2','CommonTree_3','CommonTree_4'] as const)[p.v%4];
  if(p.kind==='bigTree')return theme==='forest'&&p.v%4===1?'DeadTree_1':'TwistedTree_1';
  if(p.kind==='pine')return (['Pine_1','Pine_3','Pine_5'] as const)[p.v%3];
  if(p.kind==='rock')return (['Rock_Medium_1','Rock_Medium_2','Rock_Medium_3'] as const)[p.v%3];
  if(p.kind==='bush')return (['Bush_Common_Flowers','Fern_1','Bush_Common','Plant_7'] as const)[p.v%4];
  if(p.kind==='flower')return (['Flower_3_Group','Flower_4_Group','Flower_3_Single','Plant_1'] as const)[p.v%4];
  if(p.kind==='tuft')return (['Clover_1','Grass_Common_Short','Grass_Wispy_Short','Grass_Wispy_Tall'] as const)[p.v%4];
  if(p.kind==='mushroom')return 'Mushroom_Common';
  return null;
}
/** Each map owns instance buffers and cloned geometry; cached source textures/materials stay alive. */
export function attachNature(map:MapData,parent:THREE.Group){
  let disposed=false;
  const group=new THREE.Group();group.name='imported-nature';
  const ready=map.def.theme==='cave'?Promise.resolve(false):loadStaticPack(NATURE_FILES,'nature').then(models=>{
    if(disposed)return false;
    const placements=new Map<Asset,THREE.Matrix4[]>(),r=prng(map.def.seed+991);
    for(const p of map.props){const key=choice(p,map.def.theme);if(!key)continue;const model=models.get(key)!;
      const tree=p.kind==='tree'||p.kind==='pine'||p.kind==='bigTree';
      const target=tree?(p.kind==='bigTree'?4.4:2.6+r()*.85):p.kind==='rock'?.7+r()*.25:p.kind==='bush'?.65+r()*.2:.4+r()*.15;
      const factor=target/(tree?model.size.y:Math.max(model.size.x,model.size.y,model.size.z));
      const m=new THREE.Matrix4().compose(new THREE.Vector3(p.x,.01,p.y),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),r()*Math.PI*2),new THREE.Vector3(factor,factor,factor));
      if(!placements.has(key))placements.set(key,[]);placements.get(key)!.push(m);
    }
    for(const [key,matrices] of placements)for(const part of models.get(key)!.parts){
      const mesh=new THREE.InstancedMesh(part.geometry.clone(),part.material,matrices.length);
      mesh.name=`nature-${key}`;mesh.userData.sharedNatureMaterial=true;
      matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.instanceMatrix.needsUpdate=true;
      mesh.castShadow=true;mesh.receiveShadow=true;mesh.computeBoundingSphere();group.add(mesh);
    }
    // Only switch after every file is ready; errors leave the complete procedural scene visible.
    for(const o of parent.children)if(['trunk','crown','crown2','pine','bush','berry','rock','moss','stem','flower-heart','flower-bloom','tuft-blades','mstem','mcap'].includes(o.name))o.visible=false;
    parent.add(group);return true;
  }).catch(err=>{console.warn('Nature assets unavailable; retaining scenery',err);return false;});
  return {ready,update:(time:number)=>{staticWind.value=time;},dispose:()=>{disposed=true;group.traverse(o=>{if(o instanceof THREE.InstancedMesh){o.dispose();o.geometry.dispose();}});group.removeFromParent();}};
}
