// v4 procedural 3D heroes in the "new generation" mobile-MMO style: ~3.7 heads tall, jointed
// limbs (elbows/knees), lathe-shaped garments, sculpted hair locks with a glossy sheen, PBR cloth,
// leather and metal, anime face texture. Same API as the old chibi (CharLook / animate / dispose).
import * as THREE from 'three';
import { toon, inked, glow, metal, cloth } from './toon';
import { faceTexture, faceShell, type Expression } from './face';
import { costumes } from '../data/costumes';
import { buildWeaponAppearance, type WeaponAppearance } from './weapon-appearance';

export type CharLook={
  outfit:'novice'|'swordman'|'mage'|'archer'|'npc'; hair:number; hairColor:string; eyeColor?:string;
  cloth?:string; hat?:string; weapon:'dagger'|'sword'|'staff'|'bow'|null; weaponStyle?:string; refine?:number;
  headgear?:string; armorStyle?:string; costumeHead?:string|null; costumeBack?:string|null;
};
export type CharPose='idle'|'walk'|'attack'|'cast'|'sit'|'dead'|'hurt';
const SKIN='#ffe2d0';
const outfitColors:Record<CharLook['outfit'],{body:string;trim:string;pants:string;boots:string;cape?:string;under:string}>={
  novice:{body:'#d9b98a',trim:'#fff6e4',pants:'#7a5a3e',boots:'#6b4630',under:'#f4ead8'},
  swordman:{body:'#b8383a',trim:'#e9d9a8',pants:'#3a3446',boots:'#4a3830',cape:'#8a2228',under:'#2f2a3a'},
  mage:{body:'#5a44b8',trim:'#f0c860',pants:'#3f327a',boots:'#3b2f5a',cape:'#2f2668',under:'#e9e0ff'},
  archer:{body:'#3f8a56',trim:'#c89a5a',pants:'#5a4a36',boots:'#6b4630',cape:'#2f6a44',under:'#f2ead8'},
  npc:{body:'#5aa0e0',trim:'#ffffff',pants:'#4a4a5a',boots:'#4a3830',under:'#f4ead8'},
};
const eyeColors=['#3f7ae0','#2f9e6a','#b04a8a','#a0602a','#7d5bd6','#d9534f','#2a9aaa','#c9a020'];
/** Legacy head radius the costume/headgear code was authored against. */
const LEGACY_R=.34;
const HEAD_R=.2;

const lathe=(pts:[number,number][],seg=28,sz=.78)=>{const g=new THREE.LatheGeometry(pts.map(([r,y])=>new THREE.Vector2(r,y)),seg);g.scale(1,1,sz);return g;};
/** Anime head: sphere with a narrowed chin and fuller cheeks. Shared by skull and face shell. */
function deformHead(g:THREE.BufferGeometry,r:number){
  const p=g.attributes.position;
  for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),ny=y/r;
    let sx=1,sz=1;if(ny<0){sx=1-.2*Math.pow(-ny,1.6);sz=1-.08*Math.pow(-ny,2);}
    if(z>0&&ny<.1&&ny>-.7)sx*=1+.04*Math.cos(ny*3);
    p.setXYZ(i,x*sx,y*(ny<0?1.06:1),z*sz*.96);}
  g.computeVertexNormals();return g;
}
/** A sculpted hair lock: tapered, flattened tube following points; its flat side faces away from `center`. */
function lock(points:THREE.Vector3[],w0:number,th0:number,center=new THREE.Vector3(),seg=10,rad=8,tip=.12){
  const curve=new THREE.CatmullRomCurve3(points),pos:number[]=[],uv:number[]=[],idx:number[]=[];
  for(let i=0;i<=seg;i++){
    const t=i/seg,c=curve.getPointAt(t),T=curve.getTangentAt(t).normalize();
    const out=c.clone().sub(center).normalize();const B=out.sub(T.clone().multiplyScalar(out.dot(T))).normalize();const N=new THREE.Vector3().crossVectors(T,B).normalize();
    const taper=(tip+(1-tip)*Math.pow(1-t,.8))*(.75+.25*Math.sin(Math.min(1,t*5+.2)*Math.PI/2));
    for(let j=0;j<=rad;j++){const a=j/rad*Math.PI*2,cw=Math.cos(a)*w0*taper,cs=Math.sin(a)*th0*taper*(Math.sin(a)>0?1:.6);
      pos.push(c.x+N.x*cw+B.x*cs,c.y+N.y*cw+B.y*cs,c.z+N.z*cw+B.z*cs);uv.push(j/rad,t);}
  }
  for(let i=0;i<seg;i++)for(let j=0;j<rad;j++){const a=i*(rad+1)+j,b=a+rad+1;idx.push(a,b,a+1,b,b+1,a+1);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return g;
}
/** Point on the head sphere: azimuth (0 = front, + = character's left), elevation (radians). */
const sph=(r:number,az:number,el:number)=>new THREE.Vector3(Math.sin(az)*Math.cos(el)*r,Math.sin(el)*r,Math.cos(az)*Math.cos(el)*r);

type Limb={pivot:THREE.Group;joint:THREE.Group};
/** Position / rotate / scale an object in one call (Object3D transforms are read-only properties). */
function at<T extends THREE.Object3D>(o:T,x=0,y=0,z=0,rx=0,ry=0,rz=0,sx=1,sy=sx,sz=sx):T{o.position.set(x,y,z);o.rotation.set(rx,ry,rz);o.scale.set(sx,sy,sz);return o;}
export class Chibi {
  readonly root=new THREE.Group();
  private body=new THREE.Group();
  private hips=new THREE.Group();
  private chest=new THREE.Group();
  /** Head group (skull, face, hair, headgear); skinned heroes borrow it and parent it to their head bone. */
  readonly head=new THREE.Group();
  private armL!:Limb; private armR!:Limb; private legL!:Limb; private legR!:Limb;
  readonly hand=new THREE.Group();
  readonly offHand=new THREE.Group();
  private face!:THREE.Mesh;
  private faceMat!:THREE.MeshStandardMaterial;
  private eye:string;
  private cape:THREE.Object3D|null=null;
  private skirt:THREE.Object3D|null=null;
  private wings:THREE.Object3D[]=[];
  private earBits:THREE.Object3D[]=[];
  private tails:THREE.Object3D[]=[];
  private weaponGlow:THREE.Object3D|null=null;
  private weaponAppearance:WeaponAppearance|null=null;
  private blinkAt=Math.random()*3;
  private expr:Expression='normal';
  yaw=0;
  constructor(readonly look:CharLook){
    this.eye=look.eyeColor??eyeColors[(look.hair*3+look.hairColor.length)%eyeColors.length];
    this.root.add(this.body);this.body.add(this.hips);this.hips.position.y=.8;this.hips.add(this.chest);this.build();
  }
  private build(){
    const L=this.look,pal={...outfitColors[L.outfit]};if(L.cloth)pal.body=L.cloth;
    if(L.armorStyle==='chainMail')pal.body='#7d8ea6';else if(L.armorStyle==='mageRobe')pal.body='#4566b0';else if(L.armorStyle==='adventureSuit')pal.trim='#8fd0b0';
    const skin=toon(SKIN,{rough:.55,emissive:'#ff9a80',emissiveIntensity:.05}),body=cloth(pal.body),trim=toon(pal.trim,{rough:.5,metal:L.outfit==='mage'?.6:0}),
      pants=cloth(pal.pants),boots=toon(pal.boots,{rough:.45}),under=cloth(pal.under),leather=toon('#6b4630',{rough:.5}),gold=metal('#e2b450',.28),steel=metal('#dfe6ee',.25);
    const C=this.chest,Hp=this.hips;
    const add=(parent:THREE.Object3D,geo:THREE.BufferGeometry,mat:THREE.Material,x=0,y=0,z=0,rx=0,ry=0,rz=0)=>{const m=inked(geo,mat);m.position.set(x,y,z);m.rotation.set(rx,ry,rz);parent.add(m);return m;};
    const robe=L.outfit==='mage',armored=L.outfit==='swordman';
    // Legs: hip pivot → thigh → knee pivot → shin + boot.
    const leg=(side:number):Limb=>{const pivot=new THREE.Group();pivot.position.set(side*.085,0,0);
      add(pivot,new THREE.CapsuleGeometry(.064,.24,6,12),pants,0,-.17,0);
      const joint=new THREE.Group();joint.position.y=-.36;pivot.add(joint);
      add(joint,new THREE.CapsuleGeometry(.052,.2,6,12),pants,0,-.12,0);
      add(joint,lathe([[0,-.2],[.058,-.2],[.064,-.12],[.07,-.02],[.078,.02],[0,.02]],16,1),boots,0,-.18,0);
      add(joint,new THREE.SphereGeometry(.06,14,10),boots,0,-.4,.035).scale.set(1.05,.62,1.75);
      add(joint,new THREE.TorusGeometry(.074,.014,6,18),toon(pal.trim,{rough:.5}),0,-.16,0,Math.PI/2);
      if(armored)add(joint,lathe([[.06,-.26],[.068,-.14],[.064,-.02],[0,0]],14,1),steel,0,-.02,.008);
      Hp.add(pivot);return {pivot,joint};};
    this.legL=leg(-1);this.legR=leg(1);
    // Pelvis + torso.
    add(Hp,lathe([[0,-.06],[.12,-.05],[.15,0],[.15,.08],[0,.1]],24),pants,0,0,0);
    add(C,lathe([[0,.02],[.148,.03],[.142,.1],[.138,.16],[.16,.24],[.17,.3],[.15,.36],[.09,.405],[0,.41]],28),body,0,0,0);
    add(C,new THREE.CylinderGeometry(.042,.048,.1,12),skin,0,.44,0);
    // Collar / neckline.
    add(C,lathe([[.085,.36],[.115,.39],[.1,.42],[.07,.43]],20,.85),L.outfit==='novice'?under:trim,0,0,0);
    // Belt with buckle.
    add(Hp,lathe([[.152,.03],[.158,.05],[.158,.09],[.15,.11]],24),leather,0,0,0);
    add(Hp,new THREE.BoxGeometry(.06,.05,.02),gold,0,.07,.125);
    // Garment below the belt.
    if(robe){this.skirt=add(Hp,lathe([[.15,.06],[.17,-.05],[.21,-.3],[.26,-.55],[.29,-.74],[.3,-.76]],32,.82),toon(pal.body,{side:THREE.DoubleSide,rough:.85}),0,0,0);
      add(this.skirt,lathe([[.296,-.74],[.305,-.76],[.3,-.78]],32,.82),trim,0,0,0);
      add(C,lathe([[.12,.38],[.2,.32],[.24,.24],[.22,.2]],28,.8),toon(pal.cape!,{side:THREE.DoubleSide}),0,0,0);
      add(C,new THREE.OctahedronGeometry(.032),glow('#7fd0ff',1.6),0,.33,.135);}
    else{const len=armored?-.26:L.outfit==='archer'?-.24:-.2;
      this.skirt=add(Hp,lathe([[.152,.06],[.17,-.04],[.2,len*.6],[.215,len]],28,.8),toon(pal.body,{side:THREE.DoubleSide,rough:.85}),0,0,0);
      add(this.skirt,lathe([[.212,len+.012],[.22,len],[.214,len-.012]],28,.8),trim,0,0,0);}
    // Job details.
    if(armored){
      add(C,lathe([[0,.1],[.155,.11],[.165,.2],[.175,.28],[.155,.35],[.1,.39],[0,.395]],28,.8),steel,0,0,.008);
      add(C,new THREE.BoxGeometry(.03,.2,.01),gold,0,.25,.14);
      for(const s of [-1,1]){const pad=add(C,new THREE.SphereGeometry(.085,16,10,0,Math.PI*2,0,Math.PI/1.9),steel,s*.19,.35,0,0,0,-s*.55);pad.scale.set(1.1,.9,1);
        add(pad,new THREE.TorusGeometry(.083,.01,6,20),gold,0,.005,0,Math.PI/2);}
    }
    if(L.outfit==='archer'){
      add(C,lathe([[.15,.06],[.158,.14],[.165,.24],[.15,.27]],24,.8),leather,0,0,0);
      for(let i=0;i<3;i++)add(C,new THREE.BoxGeometry(.05,.008,.01),gold,0,.1+i*.06,.128);
      add(C,new THREE.TorusGeometry(.1,.035,8,20),toon('#e8c35a',{rough:.8}),0,.39,0,Math.PI/2).scale.set(1,.85,1);
      const quiver=new THREE.Group();add(quiver,new THREE.CylinderGeometry(.05,.042,.36,12),leather);
      for(let i=0;i<4;i++){add(quiver,new THREE.CylinderGeometry(.005,.005,.12,4),toon('#e8e0c8'),-.03+i*.02,.22,0);add(quiver,new THREE.ConeGeometry(.018,.05,4),toon('#f4f4f4'),-.03+i*.02,.29,0);}
      quiver.position.set(.07,.24,-.16);quiver.rotation.z=-.45;C.add(quiver);
    }
    if(L.outfit==='novice'){add(C,new THREE.BoxGeometry(.1,.08,.04),leather,.12,-.02,.06,0,.5);
      add(C,new THREE.CylinderGeometry(.006,.006,.38,4),leather,0,.2,.13,0,0,.85);}
    // Cape or costume back item.
    const back=L.costumeBack?costumes[L.costumeBack]:null;
    if(back&&back.id!=='heroCape'){const anchor=new THREE.Group();anchor.position.set(0,.4-.58*1.2+.08,.038-.02);anchor.scale.setScalar(1.2);C.add(anchor);this.buildBack(anchor,back.id,back.color,back.accent??back.color);}
    else if(pal.cape||back){
      const col=back?.color??pal.cape!;const geo=new THREE.PlaneGeometry(.4,robe?.95:.78,8,12);geo.translate(0,-(robe?.95:.78)/2,0);
      const p=geo.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i);p.setZ(i,-Math.abs(x)*.3+y*.08+Math.cos(x*14)*.012);p.setX(i,x*(1+(-y)*.5));}geo.computeVertexNormals();
      const capeMesh=new THREE.Mesh(geo,cloth(col));capeMesh.material=toon(col,{side:THREE.DoubleSide,rough:.8,sheen:true});capeMesh.castShadow=true;
      const holder=new THREE.Group();holder.position.set(0,.38,-.12);holder.add(capeMesh);C.add(holder);this.cape=holder;
      for(const s of [-1,1])add(C,new THREE.SphereGeometry(.025,10,8),gold,s*.11,.38,.08);
    }
    // Arms: shoulder pivot → upper arm → elbow pivot → forearm + hand.
    const arm=(side:number):Limb=>{const pivot=new THREE.Group();pivot.position.set(side*.19,.34,0);
      add(pivot,new THREE.CapsuleGeometry(.046,.15,6,12),body,0,-.11,0);
      const joint=new THREE.Group();joint.position.y=-.24;pivot.add(joint);
      add(joint,new THREE.CapsuleGeometry(.04,.13,6,12),robe?body:skin,0,-.09,0);
      if(robe)add(joint,lathe([[.05,.02],[.065,-.08],[.09,-.18],[.095,-.2]],18,.9),toon(pal.body,{side:THREE.DoubleSide}),0,0,0);
      else add(joint,lathe([[.046,-.06],[.054,-.12],[.05,-.17],[0,-.17]],14,1),armored?steel:L.outfit==='archer'&&side<0?leather:toon(pal.trim,{rough:.5}),0,0,0);
      add(joint,new THREE.SphereGeometry(.042,12,10),skin,0,-.21,0).scale.set(.85,1.1,.75);
      this.chest.add(pivot);return {pivot,joint};};
    this.armL=arm(-1);this.armR=arm(1);
    this.hand.position.set(0,-.23,.015);this.armR.joint.add(this.hand);
    this.offHand.position.set(0,-.23,.015);this.armL.joint.add(this.offHand);
    this.buildWeapon();
    // Head.
    this.head.position.y=.6;C.add(this.head);
    const r=HEAD_R;
    add(this.head,deformHead(new THREE.SphereGeometry(r,40,30),r),skin,0,0,0);
    for(const s of [-1,1])add(this.head,new THREE.SphereGeometry(.035,10,8),skin,s*r*.93,-.02,-.01).scale.set(.45,1,.75);
    this.faceMat=new THREE.MeshStandardMaterial({map:faceTexture(this.eye,'normal',L.hair!==0),transparent:true,depthWrite:false,roughness:.6,polygonOffset:true,polygonOffsetFactor:-2});
    this.face=new THREE.Mesh(deformHead(faceShell(r*1.004,1.6,1.3,Math.PI/2+.12),r*1.004),this.faceMat);this.face.renderOrder=2;this.head.add(this.face);
    this.buildHair(r);
    const hg=new THREE.Group();hg.scale.setScalar(r/LEGACY_R*1.06);hg.position.y=.012;this.head.add(hg);
    this.buildHeadgear(hg,LEGACY_R);
  }
  private buildHair(r:number){
    const L=this.look,col=new THREE.Color(L.hairColor);
    const mat=toon(col,{rough:.42,sheen:true}),dark=toon(col.clone().multiplyScalar(.78),{rough:.45,sheen:true});
    const H=this.head,O=new THREE.Vector3(0,0,0);
    const addLock=(pts:THREE.Vector3[],w:number,th:number,m=mat,tip=.12)=>{const g=inked(lock(pts,w,th,O,10,8,tip),m);H.add(g);return g;};
    // Base volume: crown cap tilted back so the forehead shows under the fringe.
    const cap=inked(new THREE.SphereGeometry(r*1.08,36,24,0,Math.PI*2,0,Math.PI*.56),mat);cap.rotation.x=-.42;cap.position.set(0,.012,-.012);H.add(cap);
    const backCap=inked(new THREE.SphereGeometry(r*1.07,30,20,Math.PI*1.12,Math.PI*.76,Math.PI*.3,Math.PI*.5),mat);H.add(backCap);
    // Fringe: locks from the crown sweeping over the forehead, alternating lengths.
    const n=L.hair===0?6:8;
    for(let i=0;i<n;i++){const t=i/(n-1)-.5,az=t*1.7,len=L.hair===0?.06:.03+((i*7)%3)*.012,sweep=L.hair===2?.12:L.hair===1?-.1:0;
      addLock([sph(r*1.04,az*.5,1.1),sph(r*1.14,az*.85+sweep*.5,.62),sph(r*1.1,az+sweep,.28),sph(r*1.05,az*1.05+sweep,.1+len)],.05,.024,i%2?dark:mat);}
    // Crown and back locks.
    const backLen=L.hair===1?.42:L.hair===3?.16:L.hair===0?.06:.12;
    for(let i=0;i<10;i++){const az=Math.PI*.42+i/9*Math.PI*1.16;
      addLock([sph(r*1.05,az,1.05),sph(r*1.14,az,.4),sph(r*1.1,az,-.25),new THREE.Vector3(Math.sin(az)*r*.95,-r*.55-backLen*(.7+((i*5)%3)*.15),Math.cos(az)*r*.85-.02)],.07,.03,i%2?dark:mat);}
    // Side locks framing the face.
    for(const s of [-1,1]){const len=L.hair===0?.06:L.hair===1?.3:.18;
      addLock([sph(r*1.06,s*1.0,.7),sph(r*1.12,s*1.18,.1),sph(r*1.06,s*1.22,-.45),new THREE.Vector3(s*r*.98,-r*.7-len,r*.25)],.055,.026,mat);}
    if(L.hair===0){// Spiky short crown.
      for(let i=0;i<7;i++){const az=-1+i/6*2.4+Math.PI*.15*(i%2),el=.85+(i%3)*.15;
        addLock([sph(r*.95,az,el),sph(r*1.18,az*1.05,el-.05),sph(r*1.32,az*1.1,el-.25)],.06,.03,i%2?dark:mat,.05);}
    }
    if(L.hair===1){// Long straight hair down the back.
      for(let i=0;i<7;i++){const az=Math.PI*.6+i/6*Math.PI*.8;
        const g=addLock([sph(r*1.08,az,.2),sph(r*1.12,az,-.4),new THREE.Vector3(Math.sin(az)*r*.9,-r*1.6,Math.cos(az)*r*.6-.05),new THREE.Vector3(Math.sin(az)*r*.8,-r*2.4-((i*3)%2)*.04,Math.cos(az)*r*.4-.08)],.075,.03,i%2?dark:mat);
        this.tails.push(g);}
    }
    if(L.hair===2){// Twin tails with ribbons.
      for(const s of [-1,1]){const grp=new THREE.Group();grp.position.set(s*r*.95,r*.45,-r*.2);H.add(grp);
        for(let i=0;i<3;i++){const g=inked(lock([new THREE.Vector3(0,0,0),new THREE.Vector3(s*.08,-.06,-.02+i*.015),new THREE.Vector3(s*.1,-.22,-.03),new THREE.Vector3(s*.05+i*.01*s,-.42,0)],.06,.04,new THREE.Vector3(-s*.2,-.1,0)),i%2?dark:mat);grp.add(g);}
        for(const k of [-1,1])grp.add(at(inked(new THREE.SphereGeometry(.035,12,8),toon('#ff6f9e',{rough:.5,sheen:true})),k*.03,.01,0,0,0,0,1.2,.7,.5));
        this.tails.push(grp);}
    }
    if(L.hair===3){// High ponytail.
      const grp=new THREE.Group();grp.position.set(0,r*.75,-r*.85);H.add(grp);
      for(let i=0;i<4;i++){const g=inked(lock([new THREE.Vector3(0,0,0),new THREE.Vector3((i-1.5)*.02,.02,-.08),new THREE.Vector3((i-1.5)*.03,-.15,-.14),new THREE.Vector3((i-1.5)*.02,-.36,-.1)],.06,.035,new THREE.Vector3(0,-.1,.2)),i%2?dark:mat);grp.add(g);}
      grp.add(at(inked(new THREE.TorusGeometry(.03,.012,6,14),toon('#ffd45c',{metal:.5,rough:.3})),0,0,0,Math.PI/2.4));
      this.tails.push(grp);
    }
    // Ahoge.
    const ah=addLock([sph(r*1.05,.1,1.3),new THREE.Vector3(.02,r*1.45,.02),new THREE.Vector3(.07,r*1.5,.06)],.025,.012,mat,.05);this.tails.push(ah);
  }
  private buildHeadgear(H:THREE.Group,r:number){
    const L=this.look;
    const costume=L.costumeHead?costumes[L.costumeHead]:null;
    if(costume){this.buildCostumeHead(H,costume.id,costume.color,costume.accent??costume.color,r);return;}
    if(L.outfit==='mage'||L.headgear==='starHat'){
      const hat=new THREE.Group();hat.position.y=.22;hat.rotation.x=-.1;
      const felt=toon('#4a35a0',{rough:.8,sheen:true});
      hat.add(inked(new THREE.CylinderGeometry(.5,.52,.025,40),felt));
      const coneGeo=new THREE.LatheGeometry([[.27,0],[.25,.1],[.2,.22],[.14,.34],[.08,.45],[.03,.53],[0,.56]].map(([r,y])=>new THREE.Vector2(r,y-.275)),36);const cp=coneGeo.attributes.position;
      for(let i=0;i<cp.count;i++){const y=cp.getY(i)+.275;const k=y/.55;cp.setZ(i,cp.getZ(i)-k*k*.18);}coneGeo.computeVertexNormals();const cone=new THREE.Mesh(coneGeo,felt);
      cone.position.set(0,.28,-.02);cone.castShadow=true;hat.add(cone);
      const band=new THREE.Mesh(new THREE.CylinderGeometry(.265,.27,.07,36,1,true),toon('#f0c860',{metal:.6,rough:.3}));band.position.y=.04;hat.add(band);
      const star=new THREE.Mesh(new THREE.OctahedronGeometry(.05),glow('#ffe26b',2));star.position.set(0,.04,.27);hat.add(star);
      H.add(hat);this.earBits.push(star);return;
    }
    if(L.headgear==='cap'){const beret=inked(new THREE.SphereGeometry(.3,24,14,0,Math.PI*2,0,Math.PI/2),toon(L.hat??'#d9534f',{sheen:true,rough:.8}));beret.scale.set(1.18,.5,1.18);beret.position.y=.25;beret.rotation.z=-.15;H.add(beret);}
    else if(L.headgear==='jellyCrown'){const crown=this.crown('#ffd45c');crown.position.y=.32;H.add(crown);}
    else if(L.headgear==='ironHelm'){const helm=inked(new THREE.SphereGeometry(r*1.14,28,16,0,Math.PI*2,0,Math.PI*.5),metal('#b8c2d0',.3));helm.rotation.x=-.25;H.add(helm);}
    else if(L.outfit==='archer'){const feather=inked(new THREE.ConeGeometry(.04,.3,6),toon('#f4f0e0'));feather.position.set(.24,.3,-.05);feather.rotation.z=-.7;H.add(feather);this.earBits.push(feather);
      const band=new THREE.Mesh(new THREE.TorusGeometry(r*1.02,.025,8,40),toon('#3f8a56'));band.rotation.x=Math.PI/2-.3;band.position.y=.12;H.add(band);}
    else if(L.outfit==='swordman'){const band=new THREE.Mesh(new THREE.TorusGeometry(r*1.02,.03,8,40),metal('#dfe6ee',.3));band.rotation.x=Math.PI/2-.35;band.position.y=.14;H.add(band);
      const gem=new THREE.Mesh(new THREE.OctahedronGeometry(.035),glow('#ff5a5a',1.5));gem.position.set(0,.22,.32);H.add(gem);}
    else if(L.hat){const beret=inked(new THREE.SphereGeometry(.3,24,14,0,Math.PI*2,0,Math.PI/2),toon(L.hat,{sheen:true,rough:.8}));beret.scale.set(1.18,.45,1.18);beret.position.y=.26;H.add(beret);}
  }
  private crown(color:string){
    const g=new THREE.Group(),m=metal(color,.25);g.add(inked(new THREE.CylinderGeometry(.2,.22,.1,24,1,true),toon(color,{side:THREE.DoubleSide,metal:.8,rough:.25})));
    for(let i=0;i<5;i++){const a=i/5*Math.PI*2;const sp=new THREE.Mesh(new THREE.ConeGeometry(.04,.12,6),m);sp.position.set(Math.cos(a)*.2,.1,Math.sin(a)*.2);g.add(sp);
      const gem=new THREE.Mesh(new THREE.OctahedronGeometry(.025),glow(i%2?'#ff5a7a':'#5ab0ff',1.6));gem.position.set(Math.cos(a)*.215,0,Math.sin(a)*.215);g.add(gem);}
    return g;
  }
  private buildCostumeHead(H:THREE.Group,id:string,col:string,acc:string,r:number){
    if(id==='catEars'||id==='bunnyEars'||id==='devilHorns'){
      for(const s of [-1,1]){const g=new THREE.Group();g.position.set(s*.2,.27,-.02);g.rotation.z=-s*(id==='bunnyEars'?.15:.35);
        if(id==='devilHorns'){const h=inked(new THREE.ConeGeometry(.05,.16,10),toon(col,{rough:.35}));h.rotation.z=s*.3;g.add(h);}
        else{const cat=id==='catEars',len=cat?.18:.42;
          const ear=inked(cat?new THREE.ConeGeometry(.09,.2,4):new THREE.CapsuleGeometry(.055,len,6,12),toon(col,{sheen:true,rough:.8}));ear.position.y=cat?.08:len/2;ear.scale.z=.5;g.add(ear);
          const inner=new THREE.Mesh(cat?new THREE.ConeGeometry(.05,.13,4):new THREE.CapsuleGeometry(.03,len*.8,4,8),toon(acc));inner.position.set(0,cat?.07:len/2,.025);inner.scale.z=.3;g.add(inner);}
        H.add(g);this.earBits.push(g);}
      return;
    }
    if(id==='ribbon'){const bow=new THREE.Group();bow.position.set(.12,.3,-.1);bow.rotation.z=-.3;
      for(const s of [-1,1]){const loop=inked(new THREE.SphereGeometry(.1,14,10),toon(col,{sheen:true}));loop.scale.set(1.2,.7,.4);loop.position.x=s*.1;bow.add(loop);}
      bow.add(new THREE.Mesh(new THREE.SphereGeometry(.04,10,8),toon(acc)));H.add(bow);this.earBits.push(bow);return;}
    if(id==='flowerCrown'){const ring=new THREE.Mesh(new THREE.TorusGeometry(r*.92,.03,6,32),toon(col));ring.rotation.x=Math.PI/2-.3;ring.position.y=.17;H.add(ring);
      for(let i=0;i<8;i++){const a=i/8*Math.PI*2;const f=new THREE.Mesh(new THREE.IcosahedronGeometry(.045,1),toon(i%2?acc:'#fff6c0',{emissive:i%2?acc:'#fff6c0',emissiveIntensity:.15}));
        f.position.set(Math.cos(a)*r*.92,.17+Math.sin(a)*.1*-.3,Math.sin(a)*r*.92*.95);H.add(f);}return;}
    if(id==='halo'){const halo=new THREE.Mesh(new THREE.TorusGeometry(.22,.025,8,32),glow(col,2.2));halo.rotation.x=Math.PI/2;halo.position.y=.5;H.add(halo);this.earBits.push(halo);return;}
    if(id==='starHat'){this.look.headgear='starHat';const save=this.look.costumeHead;this.look.costumeHead=null;this.buildHeadgear(H,r);this.look.costumeHead=save;return;}
  }
  private buildBack(B:THREE.Group,id:string,col:string,acc:string){
    if(id==='jellyBag'){const bag=inked(new THREE.SphereGeometry(.16,20,14),toon(col,{rough:.15,metal:0}));bag.scale.set(1,.9,.8);bag.position.set(0,.5,-.2);B.add(bag);
      const shine=new THREE.Mesh(new THREE.SphereGeometry(.04,8,6),new THREE.MeshBasicMaterial({color:'#ffffff'}));shine.position.set(-.06,.58,-.32);B.add(shine);return;}
    for(const s of [-1,1]){
      const pivot=new THREE.Group();pivot.position.set(s*.06,.58,-.14);
      const shape=new THREE.Shape();
      if(id==='devilWings'){shape.moveTo(0,0);shape.lineTo(.42,.18);shape.lineTo(.36,.02);shape.lineTo(.3,-.06);shape.lineTo(.22,0);shape.lineTo(.16,-.1);shape.lineTo(.08,-.02);shape.lineTo(0,0);}
      else{shape.moveTo(0,0);shape.bezierCurveTo(.15,.32,.42,.4,.52,.3);shape.bezierCurveTo(.46,.12,.4,-.02,.3,-.12);shape.bezierCurveTo(.2,-.2,.06,-.12,0,0);}
      const geo=new THREE.ShapeGeometry(shape,16);
      const mat=id==='fairyWings'?new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:.55,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,depthWrite:false})
        :toon(col,{side:THREE.DoubleSide,emissive:acc,emissiveIntensity:id==='angelWings'?.2:.08,sheen:true});
      const wing=new THREE.Mesh(geo,mat);wing.scale.x=s;wing.castShadow=id!=='fairyWings';pivot.add(wing);
      if(id==='angelWings'){for(let i=0;i<5;i++){const f=new THREE.Mesh(new THREE.CapsuleGeometry(.035,.18,4,8),toon('#ffffff',{sheen:true}));f.position.set(s*(.1+i*.08),.12-i*.05,0);f.rotation.z=s*(1.1+i*.22);pivot.add(f);}}
      B.add(pivot);this.wings.push(pivot);
    }
  }
  private buildWeapon(){
    const L=this.look;if(!L.weapon)return;
    this.weaponAppearance=buildWeaponAppearance(L.weapon,L.weaponStyle,L.refine);
    const w=this.weaponAppearance.group;this.weaponGlow=this.weaponAppearance.glow;
    if(L.weapon==='bow'){w.rotation.set(0,Math.PI/2,0);w.position.set(.02,-.02,.04);this.offHand.add(w);}
    else{if(L.weapon==='sword'||L.weapon==='dagger')w.rotation.x=Math.PI/2.3;this.hand.add(w);}
  }

  setExpression(e:Expression){if(e===this.expr)return;this.expr=e;this.faceMat.map=faceTexture(this.eye,e,this.look.hair!==0);this.faceMat.needsUpdate=true;}
  /** Procedural animation. `t` seconds, `phase` walk cycle (radians), `actT` 0..1 attack/cast progress. */
  animate(pose:CharPose,t:number,phase:number,actT=0){
    const B=this.body,Hp=this.hips,C=this.chest,aL=this.armL,aR=this.armR,lL=this.legL,lR=this.legR,H=this.head;
    B.position.set(0,0,0);B.rotation.set(0,0,0);Hp.position.set(0,.8,0);Hp.rotation.set(0,0,0);C.rotation.set(0,0,0);H.rotation.set(0,0,0);
    for(const a of [aL,aR]){a.pivot.rotation.set(0,0,0);a.joint.rotation.set(0,0,0);}
    for(const l of [lL,lR]){l.pivot.rotation.set(0,0,0);l.joint.rotation.set(0,0,0);}
    aL.pivot.rotation.z=.16;aR.pivot.rotation.z=-.16;aL.joint.rotation.x=-.18;aR.joint.rotation.x=-.18;
    let expr:Expression='normal';
    const breathe=Math.sin(t*2.2);const robe=this.look.outfit==='mage';
    if(pose==='idle'){C.rotation.x=breathe*.012;Hp.position.y=.8+breathe*.004;H.rotation.z=Math.sin(t*.9)*.04;H.rotation.y=Math.sin(t*.5)*.08;
      aL.pivot.rotation.z=.16+breathe*.02;aR.pivot.rotation.z=-.16-breathe*.02;lL.pivot.rotation.z=-.03;lR.pivot.rotation.z=.03;
      if(this.look.weapon==='sword'||this.look.weapon==='dagger'){aR.pivot.rotation.x=-.25;aR.joint.rotation.x=-.5;}
      if(this.look.weapon==='staff'){aR.pivot.rotation.x=-.2;aR.joint.rotation.x=-.9;}}
    else if(pose==='walk'){
      const s=Math.sin(phase),c=Math.cos(phase),sw=robe?.45:.7;
      Hp.position.y=.8-.02+Math.abs(c)*.04;Hp.rotation.y=s*.1;C.rotation.y=-s*.16;C.rotation.x=.08;Hp.rotation.z=s*.02;
      lL.pivot.rotation.x=s*sw;lR.pivot.rotation.x=-s*sw;lL.joint.rotation.x=Math.max(0,-s)*1.1+.1;lR.joint.rotation.x=Math.max(0,s)*1.1+.1;
      aL.pivot.rotation.x=-s*.7;aR.pivot.rotation.x=s*.7;aL.joint.rotation.x=-.35-Math.max(0,s)*.4;aR.joint.rotation.x=-.35-Math.max(0,-s)*.4;
      H.rotation.y=s*.05;H.rotation.x=-.04;
    }
    else if(pose==='attack'){
      const k=actT,wind=k<.35?k/.35:1-(k-.35)/.65;expr='attack';
      if(this.look.weapon==='bow'){aL.pivot.rotation.set(-Math.PI/2,0,-.2);aL.joint.rotation.x=0;aR.pivot.rotation.set(-Math.PI/2+.1,0,.5+wind*.4);aR.joint.rotation.x=-1.6-wind*.5;C.rotation.y=.5;H.rotation.y=-.4;}
      else if(this.look.weapon==='staff'){aR.pivot.rotation.x=-1.4-wind*.9;aR.joint.rotation.x=-.3;C.rotation.x=.12*wind;C.rotation.y=-.2*wind;}
      else{aR.pivot.rotation.x=k<.35?-2.6*wind:-2.6+(k-.35)/.65*3.4;aR.pivot.rotation.z=-.5;aR.joint.rotation.x=-.3;
        C.rotation.y=k<.35?-.4*wind:-.4+(k-.35)*1.6;C.rotation.x=.1;lL.pivot.rotation.x=-.35;lL.joint.rotation.x=.4;lR.pivot.rotation.x=.3;lR.joint.rotation.x=.2;Hp.position.y=.77;}
    }
    else if(pose==='cast'){expr='cast';const w=Math.sin(t*6)*.08;aL.pivot.rotation.set(-1.7+w,0,.55);aR.pivot.rotation.set(-1.7-w,0,-.55);aL.joint.rotation.x=-.3;aR.joint.rotation.x=-.3;
      Hp.position.y=.81+Math.sin(t*4)*.01;C.rotation.x=-.06;H.rotation.x=-.08;}
    else if(pose==='sit'){Hp.position.y=.32;lL.pivot.rotation.set(-1.5,0,.18);lR.pivot.rotation.set(-1.5,0,-.18);lL.joint.rotation.x=1.6;lR.joint.rotation.x=1.6;
      aL.pivot.rotation.x=-.5;aR.pivot.rotation.x=-.5;aL.joint.rotation.x=-.8;aR.joint.rotation.x=-.8;C.rotation.x=.12;expr='happy';}
    else if(pose==='hurt'){expr='hurt';C.rotation.x=-.2;H.rotation.x=-.18;aL.pivot.rotation.z=.7;aR.pivot.rotation.z=-.7;Hp.position.y=.78;lL.joint.rotation.x=.3;lR.joint.rotation.x=.3;}
    else if(pose==='dead'){expr='dead';B.rotation.x=-Math.PI/2;B.position.set(0,.16,-.75);aL.pivot.rotation.z=1.3;aR.pivot.rotation.z=-1.3;}
    if(this.look.weapon==='bow'&&pose!=='attack'){aL.pivot.rotation.x=Math.min(aL.pivot.rotation.x,-.15);aL.joint.rotation.x=-.6;}
    // Blinking.
    if(expr==='normal'){this.blinkAt-=1/60;if(this.blinkAt<0){expr='blink';if(this.blinkAt<-.12)this.blinkAt=2+Math.random()*3;}}
    this.setExpression(expr);
    // Secondary motion: cape, skirt, hair tails, wings, ears.
    const moving=pose==='walk';
    if(this.cape)this.cape.rotation.x=(moving?Math.sin(phase*2)*.1+.42:Math.sin(t*1.6)*.05+.1)+(pose==='attack'?.2:0);
    if(this.skirt){this.skirt.rotation.x=moving?Math.sin(phase*2)*.03+.05:0;this.skirt.rotation.z=moving?Math.sin(phase)*.04:Math.sin(t*1.3)*.01;}
    this.tails.forEach((o,i)=>{o.rotation.x=(moving?.22:0)+Math.sin(t*3+i)*.05;o.rotation.z=Math.sin(t*2.1+i)*.03;});
    this.wings.forEach((w,i)=>{const s=i===0?-1:1;w.rotation.y=s*(.35+Math.sin(t*(moving?7:2.5))*.28);});
    this.earBits.forEach((o,i)=>{o.rotation.x=Math.sin(t*2+i)*.06;});
    if(this.weaponGlow){const s=1+Math.sin(t*4)*.12;this.weaponGlow.scale.setScalar(s);}
  }
  /** Face expression, blinking and hair/ear sway only — for a head mounted on another rig. */
  tickHead(pose:CharPose,t:number,moving:boolean){
    let expr:Expression=pose==='attack'?'attack':pose==='cast'?'cast':pose==='sit'?'happy':pose==='hurt'?'hurt':pose==='dead'?'dead':'normal';
    if(expr==='normal'){this.blinkAt-=1/60;if(this.blinkAt<0){expr='blink';if(this.blinkAt<-.12)this.blinkAt=2+Math.random()*3;}}
    this.setExpression(expr);
    this.tails.forEach((o,i)=>{o.rotation.x=(moving?.22:0)+Math.sin(t*3+i)*.05;o.rotation.z=Math.sin(t*2.1+i)*.03;});
    this.earBits.forEach((o,i)=>{o.rotation.x=Math.sin(t*2+i)*.06;});
  }
  dispose(){this.weaponAppearance?.dispose();this.root.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});}
}
