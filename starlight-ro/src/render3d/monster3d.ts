// Procedural 3D monsters with cute toon faces and per-kind procedural animation.
import * as THREE from 'three';
import { toon, inked, glow, canvasTexture, glossy } from './toon';
import { monsterFace, faceShell } from './face';
import type { MonsterArt } from '../data/monsters';

export type MonPose='idle'|'move'|'attack'|'hurt';
export class MonsterModel {
  readonly root=new THREE.Group();
  readonly body=new THREE.Group();
  private faceMats:THREE.MeshStandardMaterial[]=[];
  private parts:Record<string,THREE.Object3D>={};
  private faceExpr='';
  height=.8;
  constructor(readonly art:MonsterArt){
    this.root.add(this.body);this.body.scale.setScalar(art.scale);this.build();this.height*=art.scale;
    if(art.crown)this.addCrown();
  }
  private face(r:number,parent:THREE.Object3D,opts:{w?:number;h?:number;theta?:number;y?:number;z?:number}={}){
    const mat=new THREE.MeshStandardMaterial({map:monsterFace('normal'),transparent:true,depthWrite:false,roughness:.5,polygonOffset:true,polygonOffsetFactor:-2});
    const m=new THREE.Mesh(faceShell(r*1.015,opts.w??1.2,opts.h??1.1,opts.theta??Math.PI/2+.12),mat);m.renderOrder=2;
    if(opts.y)m.position.y=opts.y;if(opts.z)m.position.z=opts.z;parent.add(m);this.faceMats.push(mat);return m;
  }
  private build(){
    const a=this.art,body=toon(a.body),acc=toon(a.accent),B=this.body;
    const P=this.parts;
    switch(a.kind){
      case 'jelly':{
        const geo=new THREE.SphereGeometry(.36,32,24);const pos=geo.attributes.position;
        for(let i=0;i<pos.count;i++){const y=pos.getY(i);if(y>0)pos.setY(i,y*1.15+Math.max(0,y-.25)*.6);}geo.computeVertexNormals();
        const blob=inked(geo,glossy(a.body,1,a.body),.03);blob.position.y=.33;B.add(blob);P.blob=blob;
        const shine=new THREE.Mesh(new THREE.SphereGeometry(.08,12,8),new THREE.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:.85}));shine.scale.set(1,.6,.5);shine.position.set(-.16,.6,.22);blob.add(shine);shine.position.y-=.33;
        this.face(.36,blob,{theta:Math.PI/2+.25});
        this.height=.8;break;}
      case 'worm':{
        for(let i=0;i<4;i++){const s=inked(new THREE.SphereGeometry(.15-i*.015,16,12),i%2?body:toon(new THREE.Color(a.body).multiplyScalar(.88)),.02);s.position.set(0,.14,-.18-i*.16);B.add(s);P[`seg${i}`]=s;}
        const head=inked(new THREE.SphereGeometry(.22,24,16),toon(a.accent),.025);head.position.set(0,.24,.05);B.add(head);P.head=head;
        this.face(.22,head,{theta:Math.PI/2+.1});
        for(const s of [-1,1]){const an=new THREE.Mesh(new THREE.CylinderGeometry(.012,.012,.2,6),toon('#3a2a2a'));an.position.set(s*.08,.24,0);an.rotation.z=-s*.4;head.add(an);
          const ball=new THREE.Mesh(new THREE.SphereGeometry(.04,8,6),glow('#ffd45c',1.2));ball.position.set(s*.12,.33,0);head.add(ball);}
        this.height=.55;break;}
      case 'shroom':{
        const stem=inked(new THREE.CylinderGeometry(.17,.2,.3,20),toon(a.accent),.025);stem.position.y=.2;B.add(stem);this.face(.2,stem,{theta:Math.PI/2+.1,w:1.3,h:.9});
        const cap=inked(new THREE.SphereGeometry(.36,28,16,0,Math.PI*2,0,Math.PI/2),body,.03);cap.scale.y=.75;cap.position.y=.32;B.add(cap);P.cap=cap;
        for(let i=0;i<7;i++){const ang=i/7*Math.PI*2,el=.5+(i%3)*.3;const d=new THREE.Mesh(new THREE.SphereGeometry(.05+(i%2)*.02,10,8),toon('#fffaf0'));d.position.set(Math.cos(ang)*Math.cos(el)*.35,Math.sin(el)*.27,Math.sin(ang)*Math.cos(el)*.35);d.scale.y=.4;d.lookAt(0,0,0);cap.add(d);}
        for(const s of [-1,1]){const foot=inked(new THREE.SphereGeometry(.07,10,8),toon('#8a5a3a'),.015);foot.scale.set(1,.6,1.3);foot.position.set(s*.1,.03,.04);B.add(foot);P[`foot${s}`]=foot;}
        this.height=.7;break;}
      case 'chick':{
        const b=inked(new THREE.SphereGeometry(.32,28,20),body,.03);b.position.y=.36;B.add(b);P.blob=b;this.face(.32,b,{theta:Math.PI/2-.05});
        const beak=new THREE.Mesh(new THREE.ConeGeometry(.06,.12,8),acc);beak.rotation.x=Math.PI/2;beak.position.set(0,-.04,.33);b.add(beak);
        for(let i=0;i<3;i++){const c=new THREE.Mesh(new THREE.SphereGeometry(.05+i%2*.02,10,8),toon('#ff5a4a'));c.position.set(-.05+i*.05,.32+i%2*.03,.02);b.add(c);}
        for(const s of [-1,1]){const w=inked(new THREE.SphereGeometry(.12,12,10),toon(new THREE.Color(a.body).multiplyScalar(.9)),.02);w.scale.set(.4,.9,1.1);w.position.set(s*.3,-.02,-.02);b.add(w);P[`wing${s}`]=w;
          const leg=new THREE.Mesh(new THREE.CylinderGeometry(.015,.015,.1,6),acc);leg.position.set(s*.1,.06,0);B.add(leg);}
        this.height=.75;break;}
      case 'wolf':{
        const b=inked(new THREE.CapsuleGeometry(.17,.32,8,14),body,.025);b.rotation.x=Math.PI/2;b.position.set(0,.32,-.05);B.add(b);
        const belly=new THREE.Mesh(new THREE.CapsuleGeometry(.12,.2,6,10),acc);belly.rotation.x=Math.PI/2;belly.position.set(0,.26,-.03);B.add(belly);
        const head=inked(new THREE.SphereGeometry(.22,24,16),body,.025);head.position.set(0,.52,.25);B.add(head);P.head=head;this.face(.22,head,{theta:Math.PI/2+.05,w:1.1});
        const snout=inked(new THREE.SphereGeometry(.09,12,10),acc,.015);snout.scale.set(1,.8,1.1);snout.position.set(0,-.07,.2);head.add(snout);
        const nose=new THREE.Mesh(new THREE.SphereGeometry(.03,8,6),toon('#2a1f2a'));nose.position.set(0,-.04,.3);head.add(nose);
        for(const s of [-1,1]){const ear=inked(new THREE.ConeGeometry(.07,.16,6),body,.015);ear.position.set(s*.13,.2,-.02);ear.rotation.z=-s*.3;head.add(ear);
          for(const z of [.12,-.2]){const leg=inked(new THREE.CapsuleGeometry(.05,.14,4,8),body,.015);leg.position.set(s*.1,.12,z);B.add(leg);P[`leg${s}${z}`]=leg;}}
        const tail=new THREE.Group();tail.position.set(0,.4,-.33);const tl=inked(new THREE.ConeGeometry(.07,.3,8),body,.015);tl.rotation.x=-2.3;tl.position.set(0,.06,-.1);tail.add(tl);B.add(tail);P.tail=tail;
        this.height=.85;break;}
      case 'bee':{
        const stripes=canvasTexture(128,64,g=>{g.fillStyle=a.body;g.fillRect(0,0,128,64);g.fillStyle=a.accent;for(const y of [20,40])g.fillRect(0,y,128,10);});
        const b=inked(new THREE.SphereGeometry(.26,24,18),new THREE.MeshStandardMaterial({map:stripes,roughness:.6}),.025);b.scale.set(.95,.95,1.15);b.position.y=.62;B.add(b);P.blob=b;
        const head=inked(new THREE.SphereGeometry(.18,20,14),body,.02);head.position.set(0,.06,.28);b.add(head);this.face(.18,head);
        const sting=new THREE.Mesh(new THREE.ConeGeometry(.05,.14,8),toon('#3b2f2a'));sting.rotation.x=-Math.PI/2;sting.position.set(0,-.04,-.34);b.add(sting);
        for(const s of [-1,1]){const w=new THREE.Mesh(new THREE.SphereGeometry(.16,12,8),new THREE.MeshBasicMaterial({color:'#dff4ff',transparent:true,opacity:.6,depthWrite:false}));w.scale.set(1,.15,.6);w.position.set(s*.2,.24,-.05);b.add(w);P[`wing${s}`]=w;
          const an=new THREE.Mesh(new THREE.CylinderGeometry(.01,.01,.16,6),toon('#3a2a2a'));an.position.set(s*.07,.18,.05);an.rotation.z=-s*.4;head.add(an);}
        this.height=1;break;}
      case 'sapling':{
        const trunk=inked(new THREE.CylinderGeometry(.16,.2,.42,16),toon(a.accent),.025);trunk.position.y=.28;B.add(trunk);this.face(.17,trunk,{theta:Math.PI/2+.05,w:1.3,h:.8});
        for(const [x,y,z,r] of [[0,.62,0,.26],[-.18,.55,.05,.18],[.18,.56,-.02,.19],[0,.8,-.05,.18]]){const l=inked(new THREE.IcosahedronGeometry(r,1),body,.025);l.position.set(x,y,z);B.add(l);}
        for(const s of [-1,1]){const arm=new THREE.Group();arm.position.set(s*.16,.36,0);const br=inked(new THREE.CylinderGeometry(.03,.04,.24,6),toon(a.accent),.015);br.position.set(s*.08,.06,0);br.rotation.z=-s*.9;arm.add(br);
          const leaf=new THREE.Mesh(new THREE.SphereGeometry(.07,8,6),body);leaf.position.set(s*.18,.14,0);arm.add(leaf);B.add(arm);P[`arm${s}`]=arm;}
        this.height=1;break;}
      case 'bat':{
        const b=inked(new THREE.SphereGeometry(.22,24,16),toon(a.accent),.025);b.position.y=.68;B.add(b);P.blob=b;this.face(.22,b);
        for(const s of [-1,1]){const ear=inked(new THREE.ConeGeometry(.06,.14,6),body,.015);ear.position.set(s*.11,.2,0);ear.rotation.z=-s*.25;b.add(ear);
          const shape=new THREE.Shape();shape.moveTo(0,0);shape.lineTo(.45,.22);shape.lineTo(.4,0);shape.lineTo(.32,-.06);shape.lineTo(.24,.02);shape.lineTo(.15,-.06);shape.lineTo(0,0);
          const wing=new THREE.Mesh(new THREE.ShapeGeometry(shape),toon(a.body,{side:THREE.DoubleSide}));wing.scale.x=s;const piv=new THREE.Group();piv.position.set(s*.16,.02,-.02);piv.add(wing);b.add(piv);P[`wing${s}`]=piv;}
        this.height=1;break;}
      case 'bunny':{
        const b=inked(new THREE.SphereGeometry(.3,28,20),body,.03);b.scale.set(1,.9,1);b.position.y=.3;B.add(b);P.blob=b;this.face(.3,b,{theta:Math.PI/2+.1});
        for(const s of [-1,1]){const ear=new THREE.Group();ear.position.set(s*.11,.24,-.02);const e=inked(new THREE.CapsuleGeometry(.06,.32,6,10),body,.02);e.position.y=.2;e.scale.z=.5;ear.add(e);
          const inner=new THREE.Mesh(new THREE.CapsuleGeometry(.03,.26,4,8),acc);inner.position.set(0,.2,.03);inner.scale.z=.3;ear.add(inner);ear.rotation.z=-s*.15;b.add(ear);P[`ear${s}`]=ear;
          const foot=inked(new THREE.SphereGeometry(.08,10,8),body,.015);foot.scale.set(1,.5,1.4);foot.position.set(s*.13,.03,.08);B.add(foot);}
        const puff=new THREE.Mesh(new THREE.SphereGeometry(.08,10,8),body);puff.position.set(0,-.05,-.3);b.add(puff);
        this.height=.85;break;}
      case 'wisp':{
        // Floating spirit: glowing core, soft halo shell, two tiny wing-leaves and a trailing tail.
        const core=new THREE.Mesh(new THREE.SphereGeometry(.24,28,20),toon(a.body,{emissive:a.body,emissiveIntensity:.55}));core.position.y=.75;B.add(core);P.blob=core;this.face(.24,core);
        const halo=new THREE.Mesh(new THREE.SphereGeometry(.34,20,14),new THREE.MeshBasicMaterial({color:a.body,transparent:true,opacity:.18,blending:THREE.AdditiveBlending,depthWrite:false}));core.add(halo);
        const tail=new THREE.Mesh(new THREE.ConeGeometry(.16,.4,16),toon(a.body,{emissive:a.body,emissiveIntensity:.4}));tail.rotation.x=Math.PI;tail.position.y=-.3;core.add(tail);P.tail=tail;
        for(const sd of [-1,1]){const w=new THREE.Mesh(new THREE.SphereGeometry(.1,10,8),new THREE.MeshBasicMaterial({color:a.accent,transparent:true,opacity:.7,depthWrite:false}));w.scale.set(1.4,.5,.3);w.position.set(sd*.25,.12,-.05);core.add(w);P[`wing${sd}`]=w;}
        const spark=new THREE.Mesh(new THREE.OctahedronGeometry(.04),glow(a.accent,2.5));spark.position.y=.32;core.add(spark);P.spark=spark;
        this.height=1.1;break;}
      case 'fox':{
        const b=inked(new THREE.CapsuleGeometry(.15,.26,8,14),body,.025);b.rotation.x=Math.PI/2;b.position.set(0,.3,-.04);B.add(b);
        const chest=new THREE.Mesh(new THREE.SphereGeometry(.12,12,10),acc);chest.position.set(0,.3,.12);B.add(chest);
        const head=inked(new THREE.SphereGeometry(.2,24,16),body,.025);head.position.set(0,.5,.22);B.add(head);P.head=head;this.face(.2,head,{theta:Math.PI/2+.08,w:1.1});
        const snout=inked(new THREE.ConeGeometry(.08,.16,10),acc,.012);snout.rotation.x=Math.PI/2;snout.position.set(0,-.06,.2);head.add(snout);
        const nose=new THREE.Mesh(new THREE.SphereGeometry(.025,8,6),toon('#2a1f2a'));nose.position.set(0,-.06,.29);head.add(nose);
        for(const sd of [-1,1]){const ear=inked(new THREE.ConeGeometry(.08,.2,4),body,.015);ear.position.set(sd*.12,.2,-.02);ear.rotation.z=-sd*.25;head.add(ear);
          const inner=new THREE.Mesh(new THREE.ConeGeometry(.04,.12,4),acc);inner.position.set(sd*.12,.19,.02);inner.rotation.z=-sd*.25;head.add(inner);
          for(const z of [.1,-.18]){const leg=inked(new THREE.CapsuleGeometry(.04,.12,4,8),body,.012);leg.position.set(sd*.09,.1,z);B.add(leg);P[`leg${sd}${z}`]=leg;}}
        // Big fluffy tail with a pale tip.
        const tail=new THREE.Group();tail.position.set(0,.38,-.26);const t1=inked(new THREE.SphereGeometry(.15,14,10),body,.02);t1.scale.set(.8,.8,1.6);t1.position.set(0,.08,-.16);tail.add(t1);
        const tip=new THREE.Mesh(new THREE.SphereGeometry(.09,12,8),acc);tip.position.set(0,.14,-.36);tail.add(tip);B.add(tail);P.tail=tail;
        this.height=.8;break;}
      case 'golem':{
        const stone=toon(a.body),dark=toon(new THREE.Color(a.body).multiplyScalar(.8));
        const torso=inked(new THREE.BoxGeometry(.6,.5,.4,2,2,2),stone,.03);torso.position.y=.55;B.add(torso);P.blob=torso;
        const head=inked(new THREE.BoxGeometry(.36,.28,.3),stone,.025);head.position.set(0,.36,.04);torso.add(head);
        for(const s of [-1,1]){const eye=new THREE.Mesh(new THREE.SphereGeometry(.04,8,6),glow(a.accent,2.2));eye.position.set(s*.08,.02,.16);head.add(eye);
          const arm=new THREE.Group();arm.position.set(s*.38,.18,0);const fist=inked(new THREE.BoxGeometry(.2,.38,.22),dark,.025);fist.position.y=-.18;arm.add(fist);torso.add(arm);P[`arm${s}`]=arm;
          const leg=inked(new THREE.BoxGeometry(.18,.28,.2),dark,.02);leg.position.set(s*.16,.14,0);B.add(leg);}
        const core=new THREE.Mesh(new THREE.OctahedronGeometry(.09),glow(a.accent,2.5));core.position.set(0,0,.21);torso.add(core);P.core=core;
        for(let i=0;i<3;i++){const c=new THREE.Mesh(new THREE.OctahedronGeometry(.06),glow(a.accent,1.4));c.position.set(-.18+i*.18,.28,-.1);c.scale.y=1.8;torso.add(c);}
        this.height=1.2;break;}
    }
  }
  private addCrown(){
    const g=new THREE.Group(),gold=toon('#ffd45c',{emissive:'#ffb020',emissiveIntensity:.25});
    const band=inked(new THREE.CylinderGeometry(.14,.16,.07,16,1,true),gold,.01);g.add(band);
    for(let i=0;i<5;i++){const ang=i/5*Math.PI*2,sp=new THREE.Mesh(new THREE.ConeGeometry(.03,.09,6),gold);sp.position.set(Math.cos(ang)*.15,.07,Math.sin(ang)*.15);g.add(sp);
      const gem=new THREE.Mesh(new THREE.OctahedronGeometry(.02),glow(i%2?'#ff5a7a':'#5ab0ff',2));gem.position.set(Math.cos(ang)*.16,0,Math.sin(ang)*.16);g.add(gem);}
    const top={jelly:.88,sapling:1,golem:1.05,wolf:.78,bat:.95,bunny:.72,chick:.78,bee:.95,shroom:.62,worm:.5,wisp:1.05,fox:.75}[this.art.kind]??.9;
    g.position.y=top;this.body.add(g);this.parts.crown=g;
  }
  setFace(expr:'normal'|'hurt'|'angry'){if(expr===this.faceExpr)return;this.faceExpr=expr;const t=monsterFace(expr);for(const m of this.faceMats){m.map=t;m.needsUpdate=true;}}
  animate(pose:MonPose,t:number,phase:number,actT=0){
    const P=this.parts,k=this.art.kind;
    this.body.position.set(0,0,0);this.body.rotation.set(0,0,0);
    const s=this.art.scale;
    if(k==='jelly'){const bounce=pose==='move'?Math.abs(Math.sin(phase)):(Math.sin(t*3)+1)*.08;
      const sq=pose==='attack'?1+Math.sin(actT*Math.PI)*.4:1+bounce*.12;P.blob.scale.set(1/Math.sqrt(sq),sq,1/Math.sqrt(sq));this.body.position.y=(pose==='move'?bounce*.18:0)*s;
      if(pose==='attack')this.body.position.z=Math.sin(actT*Math.PI)*.15*s;}
    else if(k==='worm'){for(let i=0;i<4;i++){const seg=P[`seg${i}`];seg.position.y=.14+Math.max(0,Math.sin(phase*1.5-i*.9))*.08;}P.head.rotation.z=Math.sin(t*2)*.1;}
    else if(k==='shroom'){P.cap.rotation.z=Math.sin(phase)*.08;this.body.position.y=Math.abs(Math.sin(phase))*.06*s;P['foot-1'].position.z=.04+Math.sin(phase)*.06;P.foot1.position.z=.04-Math.sin(phase)*.06;}
    else if(k==='chick'){this.body.position.y=Math.abs(Math.sin(phase))*.08*s;P['wing-1'].rotation.z=.3+Math.sin(t*(pose==='move'?14:3))*.4;P.wing1.rotation.z=-.3-Math.sin(t*(pose==='move'?14:3))*.4;
      if(pose==='attack')P.blob.rotation.x=Math.sin(actT*Math.PI)*.5;else P.blob.rotation.x=0;}
    else if(k==='wolf'){for(const key of Object.keys(P).filter(x=>x.startsWith('leg'))){const front=key.endsWith('0.12'),side=key.includes('-1')?1:-1;P[key].rotation.x=Math.sin(phase*1.4+(front?0:Math.PI)+(side>0?Math.PI/2:0))*.6;}
      P.tail.rotation.y=Math.sin(t*6)*.4;P.head.rotation.x=pose==='attack'?Math.sin(actT*Math.PI)*.4:Math.sin(t*1.5)*.05;if(pose==='attack')this.body.position.z=Math.sin(actT*Math.PI)*.2*s;}
    else if(k==='bee'||k==='bat'){const hover=Math.sin(t*4)*.06;this.body.position.y=hover*s;
      const f=Math.sin(t*(k==='bee'?40:12));if(k==='bee'){P['wing-1'].rotation.z=f*.5;P.wing1.rotation.z=-f*.5;}else{P['wing-1'].rotation.y=f*.7;P.wing1.rotation.y=-f*.7;}
      if(pose==='attack')this.body.position.z=Math.sin(actT*Math.PI)*.25*s;}
    else if(k==='sapling'){this.body.rotation.z=Math.sin(phase)*.06;P['arm-1'].rotation.z=Math.sin(t*2)*.2+(pose==='attack'?Math.sin(actT*Math.PI)*-1.2:0);P.arm1.rotation.z=-Math.sin(t*2)*.2+(pose==='attack'?Math.sin(actT*Math.PI)*1.2:0);}
    else if(k==='bunny'){const hop=pose==='move'?Math.abs(Math.sin(phase*1.2)):0;this.body.position.y=hop*.2*s;P['ear-1'].rotation.x=-hop*.5+Math.sin(t*2)*.08;P.ear1.rotation.x=-hop*.5+Math.cos(t*2)*.08;}
    else if(k==='wisp'){this.body.position.y=Math.sin(t*2.2)*.08*s;P.blob.rotation.y=Math.sin(t*1.3)*.4;P.tail.rotation.z=Math.sin(t*3)*.25;
      P['wing-1'].rotation.z=Math.sin(t*10)*.4;P.wing1.rotation.z=-Math.sin(t*10)*.4;P.spark.rotation.y=t*3;
      if(pose==='attack')this.body.position.z=Math.sin(actT*Math.PI)*.2*s;}
    else if(k==='fox'){for(const key of Object.keys(P).filter(x=>x.startsWith('leg'))){const front=key.endsWith('0.1'),side=key.includes('-1')?1:-1;P[key].rotation.x=Math.sin(phase*1.5+(front?0:Math.PI)+(side>0?Math.PI/2:0))*.7;}
      P.tail.rotation.y=Math.sin(t*4)*.5;P.tail.rotation.x=-.2+Math.sin(t*2)*.1;P.head.rotation.z=Math.sin(t*1.2)*.08;
      if(pose==='attack'){this.body.position.z=Math.sin(actT*Math.PI)*.25*s;P.head.rotation.x=Math.sin(actT*Math.PI)*.4;}}
    else if(k==='golem'){this.body.rotation.z=Math.sin(phase*.8)*.04;P.core.rotation.y=t*2;
      const slam=pose==='attack'?Math.sin(actT*Math.PI):0;P['arm-1'].rotation.x=-slam*1.6;P.arm1.rotation.x=-slam*1.6+Math.sin(t)*.05;}
    if(pose==='hurt'){this.body.rotation.x=-.2;this.body.position.z=-.06*s;}
    if(P.crown)P.crown.rotation.y=t*.5;
    this.setFace(pose==='hurt'?'hurt':pose==='attack'?'angry':'normal');
  }
}
