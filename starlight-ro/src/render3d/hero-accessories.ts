import * as THREE from 'three';
import type { CharLook } from './character3d';
import { costumes } from '../data/costumes';
/** Original accessories only: no copied head, face, hair, or body geometry. */
export function equipAccessories(rig:THREE.Object3D,bones:Map<string,THREE.Bone>,look:CharLook){
  const objects:THREE.Object3D[]=[],geos:THREE.BufferGeometry[]=[],mats:THREE.Material[]=[],wings:THREE.Group[]=[];
  let cape:THREE.Mesh|undefined;
  const mat=(color:string,metalness=0,opacity=1)=>{const m=new THREE.MeshStandardMaterial({color,metalness,roughness:.6,side:THREE.DoubleSide,transparent:opacity<1,opacity,depthWrite:opacity===1});mats.push(m);return m;};
  const add=(g:THREE.Object3D,geo:THREE.BufferGeometry,m:THREE.Material,x=0,y=0,z=0)=>{const o=new THREE.Mesh(geo,m);o.position.set(x,y,z);o.castShadow=true;g.add(o);geos.push(geo);return o;};
  rig.updateMatrixWorld(true);
  const anchor=(name:string,x:number,y:number,z:number)=>{const b=bones.get(name);if(!b)return null;const g=new THREE.Group();
    g.quaternion.copy(b.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rig.getWorldQuaternion(new THREE.Quaternion())));g.position.set(x,y,z).applyQuaternion(g.quaternion);b.add(g);objects.push(g);return g;};
  const id=look.costumeHead??look.headgear??(look.outfit==='mage'?'starHat':look.hat?'cap':null);
  if(id){const h=anchor('Head',0,.185,0);if(h){const def=costumes[id],col=mat(def?.color??look.hat??'#739b9b'),accent=mat(def?.accent??'#e6c56a',.25);
    if(id==='starHat'){add(h,new THREE.CylinderGeometry(.23,.24,.018,28),col);add(h,new THREE.ConeGeometry(.14,.31,24),col,0,.16,0);add(h,new THREE.CylinderGeometry(.135,.145,.035,24),accent,0,.032,0);add(h,new THREE.OctahedronGeometry(.025),accent,0,.04,.146);}
    else if(id==='catEars'||id==='bunnyEars'||id==='devilHorns')for(const s of [-1,1]){const ear=add(h,id==='bunnyEars'?new THREE.CapsuleGeometry(.03,.16,4,10):new THREE.ConeGeometry(id==='catEars'?.05:.03,id==='catEars'?.10:.13,4),col,s*.085,.04,0);ear.rotation.z=-s*.2;ear.scale.z=.55;if(id!=='devilHorns')add(h,new THREE.ConeGeometry(.023,.065,4),accent,s*.085,.04,.025).scale.z=.3;}
    else if(id==='ribbon'){for(const s of [-1,1])add(h,new THREE.SphereGeometry(.065,12,8),col,s*.05,.015,0).scale.set(1,.7,.35);add(h,new THREE.SphereGeometry(.026,10,8),accent,0,.015,.01);}
    else if(id==='flowerCrown'||id==='halo'){const ring=add(h,new THREE.TorusGeometry(.115,.012,6,24),col,0,id==='halo'?.13:0,0);ring.rotation.x=Math.PI/2;
      if(id==='flowerCrown')for(let i=0;i<9;i++){const a=i/9*Math.PI*2;add(h,new THREE.SphereGeometry(.022,8,6),accent,Math.cos(a)*.115,.01,Math.sin(a)*.115);}}
    else if(id==='jellyCrown'){add(h,new THREE.CylinderGeometry(.115,.115,.04,16,1,true),accent);for(let i=0;i<5;i++){const a=i/5*Math.PI*2;add(h,new THREE.ConeGeometry(.025,.07,5),accent,Math.cos(a)*.10,.045,Math.sin(a)*.1);}}
    else if(id==='ironHelm'){const iron=mat('#b7c6d4',.65);add(h,new THREE.SphereGeometry(.125,20,12,0,Math.PI*2,0,Math.PI/2),iron,0,-.04,0);}
    else if(id==='cap')add(h,new THREE.SphereGeometry(.14,20,12,0,Math.PI*2,0,Math.PI/2),col,0,-.02,0).scale.y=.45;
  }}
  const back=look.costumeBack?costumes[look.costumeBack]:null;
  if(back){const b=anchor('spine_03',0,.04,-.17);if(b){const cloth=mat(back.color,0,back.id==='fairyWings'?.65:1),accent=mat(back.accent??'#ffffff');
    if(back.id==='heroCape'){const g=new THREE.PlaneGeometry(.45,.68,8,10);g.translate(0,-.34,0);const p=g.attributes.position;for(let i=0;i<p.count;i++){p.setX(i,p.getX(i)*(1-p.getY(i)*.45));p.setZ(i,-.02+Math.sin(p.getX(i)*20)*.012);}g.computeVertexNormals();cape=add(b,g,cloth);}
    else if(back.id==='jellyBag'){add(b,new THREE.SphereGeometry(.16,16,12),cloth,0,-.12,-.04).scale.set(1,.9,.6);for(const s of [-1,1])add(b,new THREE.SphereGeometry(.012,8,6),mat('#392b41'),s*.055,-.10,-.135);}
    else for(const s of [-1,1]){const pivot=new THREE.Group();pivot.position.x=s*.05;b.add(pivot);wings.push(pivot);const shape=new THREE.Shape();shape.moveTo(0,0);
      if(back.id==='devilWings'){shape.lineTo(.38,.19);shape.lineTo(.33,-.05);shape.lineTo(.24,.01);shape.lineTo(.17,-.16);shape.lineTo(.08,-.07);}
      else {shape.bezierCurveTo(.14,.29,.38,.35,.42,.21);shape.bezierCurveTo(.35,-.07,.2,-.22,.06,-.13);}shape.closePath();const wing=add(pivot,new THREE.ShapeGeometry(shape,12),cloth);wing.scale.x=s;
      if(back.id==='angelWings')for(let i=0;i<4;i++){const feather=add(pivot,new THREE.CapsuleGeometry(.02,.16,4,8),accent,s*(.1+i*.07),.07-i*.04,-.005);feather.rotation.z=s*(.5+i*.18);}
    }
  }}
  return {tick(t:number,moving:boolean){if(cape)cape.rotation.x=.12+(moving?.16:0)+Math.sin(t*2)*.04;wings.forEach((w,i)=>w.rotation.y=(i===0?-1:1)*(.25+Math.sin(t*(moving?6:2))*.22));},
    dispose(){objects.forEach(o=>o.removeFromParent());geos.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());}};
}
