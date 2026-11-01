import * as THREE from 'three';
/** Original cloth/armour pieces fitted to the existing Universal Base rig. No head replacement. */
export function equipProfession(rig:THREE.Object3D,bones:Map<string,THREE.Bone>,job:string){
  const objects:THREE.Object3D[]=[],geometries:THREE.BufferGeometry[]=[],materials:THREE.Material[]=[],skeletons:THREE.Skeleton[]=[];
  if(job!=='swordman'&&job!=='mage')return ()=>{};
  rig.updateMatrixWorld(true);
  const mat=(color:string,metalness=0)=>{const m=new THREE.MeshStandardMaterial({color,roughness:metalness?.4:.86,metalness,side:THREE.DoubleSide});materials.push(m);return m;};
  const steel=mat('#bbcbdc',.65),gold=mat('#d4af65',.55),cloth=mat(job==='mage'?'#514c9c':'#823d48'),dark=mat('#354659',.3);
  const anchor=(name:string,offset:THREE.Vector3)=>{const bone=bones.get(name);if(!bone)return null;
    const g=new THREE.Group(),q=bone.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rig.getWorldQuaternion(new THREE.Quaternion()));
    g.quaternion.copy(q);g.position.copy(offset).applyQuaternion(q);bone.add(g);objects.push(g);return g;};
  const mesh=(g:THREE.Object3D,geometry:THREE.BufferGeometry,m:THREE.Material,x=0,y=0,z=0)=>{const o=new THREE.Mesh(geometry,m);o.position.set(x,y,z);o.castShadow=true;g.add(o);geometries.push(geometry);return o;};
  if(job==='swordman'){
    const chest=anchor('spine_03',new THREE.Vector3(0,-.12,0));
    if(chest){mesh(chest,new THREE.SphereGeometry(1,16,12),steel,0,0,.015).scale.set(.235,.23,.16);
      mesh(chest,new THREE.BoxGeometry(.075,.26,.025),gold,0,.015,.169);
      mesh(chest,new THREE.BoxGeometry(.36,.055,.025),gold,0,-.12,.15);
      mesh(chest,new THREE.BoxGeometry(.16,.19,.035),cloth,0,-.27,.15);}
    for(const side of ['l','r']){
      const shoulder=anchor(`upperarm_${side}`,new THREE.Vector3(0,-.045,0));if(shoulder){mesh(shoulder,new THREE.SphereGeometry(1,14,10),steel).scale.set(.13,.12,.14);mesh(shoulder,new THREE.TorusGeometry(.105,.013,6,16),gold).rotation.x=Math.PI/2;}
      const shin=anchor(`calf_${side}`,new THREE.Vector3(0,-.18,.035));if(shin)mesh(shin,new THREE.BoxGeometry(.13,.26,.075),dark);
    }
  }else{
    // Skin the robe to the source skeleton so it follows the same pelvis/leg animation.
    let source:THREE.SkinnedMesh|undefined;rig.traverse(o=>{if(!source&&(o as THREE.SkinnedMesh).isSkinnedMesh)source=o as THREE.SkinnedMesh;});
    if(source){
      const addSkirt=(top:number,bottom:number,height:number,y:number,m:THREE.Material)=>{
        const geo=new THREE.CylinderGeometry(top,bottom,height,32,8,true);geo.translate(0,y,0);
        const indices:number[]=[],weights:number[]=[],pos=geo.attributes.position;
        const names=source!.skeleton.bones.map(b=>b.name),pelvis=names.indexOf('pelvis');
        for(let i=0;i<pos.count;i++){const blend=THREE.MathUtils.clamp((.95-pos.getY(i))/.8,0,.45);const leg=names.indexOf(pos.getX(i)<0?'thigh_r':'thigh_l');indices.push(pelvis,leg,0,0);weights.push(1-blend,blend,0,0);}
        geo.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(indices,4));geo.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
        const sk=new THREE.Skeleton(source!.skeleton.bones,source!.skeleton.boneInverses.map(m=>m.clone()));
        const robe=new THREE.SkinnedMesh(geo,m);robe.bind(sk,source!.bindMatrix.clone());robe.castShadow=true;robe.frustumCulled=false;
        rig.add(robe);objects.push(robe);geometries.push(geo);skeletons.push(sk);
      };
      addSkirt(.19,.36,.86,.65,cloth);addSkirt(.354,.36,.035,.237,gold);
    }
    const shoulders=anchor('spine_03',new THREE.Vector3(0,.065,0));
    if(shoulders){const mantle=mesh(shoulders,new THREE.ConeGeometry(.30,.19,24,1,true),cloth);mantle.scale.z=.7;
      mesh(shoulders,new THREE.OctahedronGeometry(.04),gold,0,-.035,.22);}
  }
  return ()=>{objects.forEach(o=>o.removeFromParent());geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());skeletons.forEach(s=>s.dispose());};
}
