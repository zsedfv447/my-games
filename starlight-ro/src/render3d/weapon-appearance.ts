import * as THREE from 'three';
import {items,type WeaponType} from '../data/items';

export type WeaponProfile='straight'|'broad'|'curved'|'winged'|'dirk'|'leaf'|'hook'|'fork'|'orb'|'crescent'|'crystal'|'star'|'long'|'recurve'|'composite'|'elven';
const profiles:Record<WeaponType,WeaponProfile[]>={sword:['straight','broad','curved','winged'],dagger:['dirk','leaf','hook','fork'],staff:['orb','crescent','crystal','star'],bow:['long','recurve','composite','elven']};
const known:Record<string,WeaponProfile>={knife:'dirk',cutter:'leaf',sword:'straight',dawnSword:'winged',meteorSword:'broad',rod:'orb',woodStaff:'crescent',starRod:'star',bow:'long',compositeBow:'composite',elvenBow:'elven',galeBow:'recurve'};
/** Palette comes from the equipment definition; future IDs also get a stable silhouette. */
export function weaponAppearance(type:WeaponType,id:string=type){
 const item=items[id],icon=item?.kind==='equip'&&item.weaponType===type?item.icon:undefined;
 const names=id.split('_').at(-1)!.toLowerCase();let profile:WeaponProfile|undefined=known[id];
 if(!profile){
  const rules:Record<WeaponType,[RegExp,WeaponProfile][]>= {
   sword:[[/guardsword/,'broad'],[/edgesword/,'straight'],[/saber|sabre|katana|crescent|gale|tide|fang/,'curved'],[/broad|great|iron|heavy|stone|breaker/,'broad'],[/dawn|holy|wing|royal|angel|sun/,'winged']],
   dagger:[[/leaf|cutter|forest/,'leaf'],[/hook|fang|claw|assassin|curved/,'hook'],[/fork|twin|shadow|venom/,'fork']],
   staff:[[/orbstaff/,'orb'],[/star|sun|solar/,'star'],[/moon|crescent|wood|nature|tide/,'crescent'],[/crystal|ice|frost|gem|arcane/,'crystal']],
   bow:[[/longbow/,'long'],[/composite|steel|iron|mechanic/,'composite'],[/elven|elf|forest|spirit/,'elven'],[/recurve|gale|wind|moon|swift/,'recurve']],
  };
  profile=rules[type].find(([pattern])=>pattern.test(names))?.[1];
  if(!profile){let hash=0;for(const c of id)hash=(hash*31+c.charCodeAt(0))>>>0;profile=profiles[type][hash%4];}
 }
 return {type,id,profile,color:icon?.color??(type==='bow'?'#a9744c':type==='staff'?'#a8734a':'#dfe7ef'),accent:icon?.accent??'#d9b56b'};
}
export type WeaponAppearance=ReturnType<typeof buildWeaponAppearance>;
/** All geometry/materials are owned by this instance. Grip center is always local (0,0,0).
 * Blade/shaft follows +Y, bow spans Y and curves toward -X. Rig attachment owns rotation. */
export function buildWeaponAppearance(type:WeaponType,id:string=type,refine=0){
 const style=weaponAppearance(type,id),group=new THREE.Group();group.name=`weapon:${id}`;group.userData={...style,grip:[0,0,0]};
 const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();let glow:THREE.Object3D|null=null,disposed=false;
 const material=(color:string,metalness=.2)=>{const m=new THREE.MeshStandardMaterial({color,metalness,roughness:.36});materials.add(m);return m;};
 const body=material(style.color,.75),accent=material(style.accent,.65),grip=material('#49362c',0);
 const mesh=(geometry:THREE.BufferGeometry,mat:THREE.Material,x=0,y=0,z=0)=>{geometries.add(geometry);const m=new THREE.Mesh(geometry,mat);m.position.set(x,y,z);m.castShadow=true;group.add(m);return m;};
 const bar=(a:THREE.Vector3,b:THREE.Vector3,r:number,mat:THREE.Material)=>{const delta=b.clone().sub(a),m=mesh(new THREE.CylinderGeometry(r,r,delta.length(),8),mat);m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return m;};
 const polygon=(points:[number,number][],depth:number,mat:THREE.Material)=>{const shape=new THREE.Shape(points.map(([x,y])=>new THREE.Vector2(x,y)));const geo=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false});geo.translate(0,0,-depth/2);return mesh(geo,mat);};
 const gem=(radius:number,y:number)=>{const m=material(style.accent,0);m.emissive.set(style.accent);m.emissiveIntensity=.65;const g=mesh(new THREE.OctahedronGeometry(radius),m,0,y);glow=g;return g;};
 if(type==='sword'||type==='dagger'){
  const dagger=type==='dagger',len=dagger?.34:.67,p=style.profile,width=dagger?.048:p==='broad'?.085:.045;
  mesh(new THREE.CylinderGeometry(.019,.019,.14,8),grip);
  mesh(new THREE.SphereGeometry(.027,10,8),accent,0,-.095);
  if(p==='curved'||p==='hook')polygon([[-width,.075],[width,.075],[width+.05,len*.62],[.13,len+.08],[.045,len],[-width,len*.55]],.018,body);
  else if(p==='fork'){
   polygon([[-width,.075],[width,.075],[width+.025,len],[.014,len+.08],[0,len*.65],[-.014,len+.08],[-width-.025,len]],.018,body);
  }else if(p==='leaf')polygon([[-.026,.075],[.026,.075],[.08,len*.55],[0,len+.08],[-.08,len*.55]],.02,body);
  else polygon([[-width,.075],[width,.075],[width*.72,len*.82],[0,len+.09],[-width*.72,len*.82]],.022,body);
  if(p==='winged'){
   polygon([[-.16,.13],[-.075,.07],[0,.09],[.075,.07],[.16,.13],[.105,.025],[0,.045],[-.105,.025]],.035,accent);
   gem(.033,.095);
  }else mesh(new THREE.BoxGeometry(dagger?.15:.23,.034,.044),accent,0,.062);
  if(p==='broad')mesh(new THREE.BoxGeometry(.015,len*.66,.027),accent,0,len*.44+.065);
  if(refine>=4){
   const aura=new THREE.MeshBasicMaterial({color:refine>=7?'#ffcf5a':'#7fd0ff',transparent:true,opacity:.25,blending:THREE.AdditiveBlending,depthWrite:false});materials.add(aura);
   glow=mesh(new THREE.BoxGeometry(width*2+.025,len,.035),aura,0,len/2+.07);
  }
 }else if(type==='staff'){
  mesh(new THREE.CylinderGeometry(.018,.024,1.02,10),body,0,.19);
  mesh(new THREE.CylinderGeometry(.026,.026,.16,8),grip);
  for(const y of [-.22,.3,.65]){const m=mesh(new THREE.TorusGeometry(.025,.007,6,12),accent,0,y);m.rotation.x=Math.PI/2;}
  const y=.79;
  if(style.profile==='crescent'){
   const m=mesh(new THREE.TorusGeometry(.11,.018,8,24,Math.PI*1.55),accent,0,y);m.rotation.z=Math.PI*.225;gem(.045,y);
  }else if(style.profile==='crystal'){
   const g=gem(.11,y);g.scale.set(.65,1.5,.65);mesh(new THREE.TorusGeometry(.09,.012,6,16),accent,0,y-.04);
  }else if(style.profile==='star'){
   const points:[number,number][]=[];for(let i=0;i<10;i++){const a=Math.PI/2+i*Math.PI/5,r=i%2?.055:.13;points.push([Math.cos(a)*r,y+Math.sin(a)*r]);}polygon(points,.04,accent);gem(.035,y);
  }else{mesh(new THREE.TorusGeometry(.095,.015,8,20),accent,0,y);gem(.065,y);}
 }else{
  const p=style.profile,half=p==='long'?.46:p==='composite'?.36:.42;
  const points=p==='recurve'?[[.07,-half],[-.06,-half*.8],[-.18,-half*.4],[0,0],[-.18,half*.4],[-.06,half*.8],[.07,half]]:
   p==='elven'?[[.06,-half],[-.17,-half*.72],[-.11,-half*.32],[0,0],[-.11,half*.32],[-.17,half*.72],[.06,half]]:
   p==='composite'?[[.07,-half],[-.1,-half*.78],[-.15,-half*.34],[0,0],[-.15,half*.34],[-.1,half*.78],[.07,half]]:
   [[.1,-half],[-.08,-half*.55],[0,0],[-.08,half*.55],[.1,half]];
  const curve=new THREE.CatmullRomCurve3(points.map(([x,y])=>new THREE.Vector3(x,y,0)));mesh(new THREE.TubeGeometry(curve,32,p==='composite'?.022:.017,8),body);
  mesh(new THREE.CylinderGeometry(.025,.025,.13,8),grip);
  const stringMat=material('#f4ecd5',0),tip=points[0][0];bar(new THREE.Vector3(tip,-half,0),new THREE.Vector3(tip,half,0),.003,stringMat);
  for(const sign of [-1,1]){
   mesh(new THREE.SphereGeometry(.022,8,6),accent,tip,sign*half);
   if(p==='composite'){const cam=mesh(new THREE.TorusGeometry(.048,.009,6,16),accent,tip,sign*half*.82);cam.scale.z=.7;}
   if(p==='elven')polygon([[-.14,sign*half*.65],[-.24,sign*half*.9],[-.07,sign*half*.82]],.018,accent);
  }
 }
 return {group,glow,style,dispose(){if(disposed)return;disposed=true;group.removeFromParent();group.clear();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());}};
}
