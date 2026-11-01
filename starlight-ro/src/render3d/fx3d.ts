// Visual effects: a GPU-drawn particle pool (additive glow) and short-lived effect meshes.
import * as THREE from 'three';
import { additive, canvasTexture } from './toon';

const MAX=6000;
type P={x:number;y:number;z:number;vx:number;vy:number;vz:number;life:number;max:number;size:number;r:number;g:number;b:number;grav:number;drag:number;fade:number;spin:number};
export type Burst={count:number;color:THREE.ColorRepresentation|THREE.ColorRepresentation[];speed?:number;up?:number;life?:number;size?:number;gravity?:number;spread?:number;drag?:number;radius?:number;soft?:boolean};

/** Round soft sprite used by every particle. */
function dotTexture(){return canvasTexture(64,64,g=>{const gr=g.createRadialGradient(32,32,0,32,32,32);gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(.25,'rgba(255,255,255,.85)');gr.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gr;g.fillRect(0,0,64,64);});}

export class Particles {
  readonly points:THREE.Points;
  private ps:P[]=[];
  private pos=new Float32Array(MAX*3);private col=new Float32Array(MAX*4);private size=new Float32Array(MAX);
  constructor(){
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.BufferAttribute(this.pos,3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color',new THREE.BufferAttribute(this.col,4).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('psize',new THREE.BufferAttribute(this.size,1).setUsage(THREE.DynamicDrawUsage));
    const mat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{map:{value:dotTexture()},scale:{value:600}},
      vertexShader:`attribute vec4 color;attribute float psize;varying vec4 vC;uniform float scale;void main(){vC=color;vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=psize*scale/-mv.z;gl_Position=projectionMatrix*mv;}`,
      fragmentShader:`uniform sampler2D map;varying vec4 vC;void main(){vec4 t=texture2D(map,gl_PointCoord);gl_FragColor=vec4(vC.rgb*2.2,vC.a*t.a);}`});
    this.points=new THREE.Points(geo,mat);this.points.frustumCulled=false;this.points.renderOrder=10;
  }
  setScale(px:number){(this.points.material as THREE.ShaderMaterial).uniforms.scale.value=px;}
  emit(x:number,y:number,z:number,b:Burst){
    const colors=(Array.isArray(b.color)?b.color:[b.color]).map(c=>new THREE.Color(c));
    for(let i=0;i<b.count;i++){
      if(this.ps.length>=MAX)this.ps.shift();
      const a=Math.random()*Math.PI*2,el=(Math.random()-.3)*(b.spread??1.2),sp=(b.speed??2)*(.4+Math.random()*.8),c=colors[i%colors.length];
      const r0=b.radius?Math.random()*b.radius:0;
      this.ps.push({x:x+Math.cos(a)*r0,y,z:z+Math.sin(a)*r0,vx:Math.cos(a)*Math.cos(el)*sp,vy:Math.sin(el)*sp+(b.up??1),vz:Math.sin(a)*Math.cos(el)*sp,
        life:0,max:(b.life??.8)*(.6+Math.random()*.6),size:(b.size??.25)*(.6+Math.random()*.8),r:c.r,g:c.g,b:c.b,grav:b.gravity??-3,drag:b.drag??1.5,fade:1,spin:0});
    }
  }
  /** Ambient emitters (weather) use explicit velocity. */
  spawn(x:number,y:number,z:number,vx:number,vy:number,vz:number,life:number,size:number,color:THREE.Color,grav=0,drag=0){
    if(this.ps.length>=MAX)return;
    this.ps.push({x,y,z,vx,vy,vz,life:0,max:life,size,r:color.r,g:color.g,b:color.b,grav,drag,fade:1,spin:Math.random()*6});
  }
  update(dt:number,t:number){
    const ps=this.ps;let n=0;
    for(let i=0;i<ps.length;i++){
      const p=ps[i];p.life+=dt;if(p.life>=p.max)continue;
      const d=Math.max(0,1-p.drag*dt);p.vx*=d;p.vz*=d;p.vy=p.vy*d+p.grav*dt;
      p.x+=p.vx*dt+(p.spin?Math.sin(t*1.5+p.spin)*.3*dt:0);p.y+=p.vy*dt;p.z+=p.vz*dt;
      const k=p.life/p.max,a=k<.15?k/.15:1-(k-.15)/.85;
      this.pos[n*3]=p.x;this.pos[n*3+1]=p.y;this.pos[n*3+2]=p.z;
      this.col[n*4]=p.r;this.col[n*4+1]=p.g;this.col[n*4+2]=p.b;this.col[n*4+3]=Math.max(0,a);
      this.size[n]=p.size*(1-k*.4);ps[n]=p;n++;
    }
    ps.length=n;
    const g=this.points.geometry;g.setDrawRange(0,n);
    (g.attributes.position as THREE.BufferAttribute).needsUpdate=true;(g.attributes.color as THREE.BufferAttribute).needsUpdate=true;(g.attributes.psize as THREE.BufferAttribute).needsUpdate=true;
  }
}

/** Glowing rune circle used under casters and on the ground for skills. */
export function runeTexture(color:string){
  return canvasTexture(256,256,g=>{
    g.translate(128,128);g.strokeStyle=color;g.fillStyle=color;g.shadowColor=color;g.shadowBlur=8;
    for(const [r,w] of [[120,4],[104,2],[70,3]] as const){g.lineWidth=w;g.beginPath();g.arc(0,0,r,0,Math.PI*2);g.stroke();}
    g.lineWidth=2.5;g.beginPath();for(let i=0;i<=6;i++){const a=i/6*Math.PI*2*2-Math.PI/2;g.lineTo(Math.cos(a)*104,Math.sin(a)*104);}g.stroke();
    g.font='bold 16px serif';g.textAlign='center';g.textBaseline='middle';
    const runes='✦ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃ';for(let i=0;i<12;i++){const a=i/12*Math.PI*2;g.save();g.rotate(a);g.fillText(runes[i%runes.length],0,-112);g.restore();}
    for(let i=0;i<6;i++){const a=i/6*Math.PI*2;g.beginPath();g.arc(Math.cos(a)*70,Math.sin(a)*70,6,0,Math.PI*2);g.fill();}
  });
}
const runeCache=new Map<string,THREE.Texture>();
export function rune(color:string){let t=runeCache.get(color);if(!t){t=runeTexture(color);runeCache.set(color,t);}return t;}
let beamTex:THREE.Texture|null=null;
/** Vertical gradient used for light pillars and portals. */
export function beamTexture(){
  if(!beamTex)beamTex=canvasTexture(16,128,g=>{const gr=g.createLinearGradient(0,128,0,0);gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(.6,'rgba(255,255,255,.35)');gr.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gr;g.fillRect(0,0,16,128);});
  return beamTex;
}

export type Effect={obj:THREE.Object3D;born:number;dur:number;update:(k:number,t:number)=>void;dispose?:()=>void};
export class EffectMeshes {
  readonly group=new THREE.Group();
  private list:Effect[]=[];
  add(e:Omit<Effect,'born'>&{born?:number},now:number){const ef={...e,born:e.born??now};this.group.add(ef.obj);this.list.push(ef);ef.update(0,now);return ef;}
  update(now:number){
    this.list=this.list.filter(e=>{
      // `now`/`born` are performance.now() milliseconds; `dur` is seconds (fixed in v6.0: effects used to vanish after one frame).
      const k=(now-e.born)/(e.dur*1000);
      if(k<0){e.obj.visible=false;return true;}e.obj.visible=true;
      if(k>=1){this.group.remove(e.obj);e.dispose?.();e.obj.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.Line){o.geometry.dispose();(o.material as THREE.Material).dispose();}});return false;}
      e.update(k,now);return true;
    });
  }
  clear(){for(const e of this.list){this.group.remove(e.obj);}this.list=[];}
  // ——— building blocks ———
  ring(x:number,z:number,r0:number,r1:number,color:THREE.ColorRepresentation,now:number,dur=.6,y=.05,width=.12){
    const mat=additive(color,1),m=new THREE.Mesh(new THREE.RingGeometry(1-width,1,48),mat);m.rotation.x=-Math.PI/2;m.position.set(x,y,z);
    return this.add({obj:m,dur,update:k=>{const r=r0+(r1-r0)*(1-(1-k)**2);m.scale.setScalar(r);mat.opacity=1-k;}},now);
  }
  disc(x:number,z:number,r:number,color:THREE.ColorRepresentation,now:number,dur=.5,opacity=.6,grow=true){
    const mat=additive(color,opacity,undefined),m=new THREE.Mesh(new THREE.CircleGeometry(1,40),mat);m.rotation.x=-Math.PI/2;m.position.set(x,.04,z);
    return this.add({obj:m,dur,update:k=>{m.scale.setScalar(r*(grow?.4+k*.6:1));mat.opacity=opacity*(1-k);}},now);
  }
  runeCircle(x:number,z:number,r:number,color:string,now:number,dur:number,y=.06){
    const mat=additive(color,.95,rune(color)),m=new THREE.Mesh(new THREE.PlaneGeometry(2,2),mat);m.rotation.x=-Math.PI/2;m.position.set(x,y,z);
    return this.add({obj:m,dur,update:(k,t)=>{m.scale.setScalar(r*Math.min(1,k*6));m.rotation.z=t*.0015;mat.opacity=.95*Math.min(1,(1-k)*4);}},now);
  }
  beam(x:number,z:number,r:number,h:number,color:THREE.ColorRepresentation,now:number,dur:number,pulse=false){
    const mat=additive(color,.9,beamTexture()),m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,24,1,true),mat);m.position.set(x,h/2,z);
    return this.add({obj:m,dur,update:k=>{const a=k<.15?k/.15:1-(k-.15)/.85;mat.opacity=.9*a;m.scale.x=m.scale.z=pulse?1+Math.sin(k*30)*.08:1-k*.3;}},now);
  }
  sphere(pos:THREE.Vector3,r:number,color:THREE.ColorRepresentation,now:number,dur:number){
    const mat=additive(color,.7),m=new THREE.Mesh(new THREE.SphereGeometry(1,20,14),mat);m.position.copy(pos);
    return this.add({obj:m,dur,update:k=>{m.scale.setScalar(r*(.5+k));mat.opacity=.7*(1-k);}},now);
  }
  lightning(from:THREE.Vector3,to:THREE.Vector3,color:THREE.ColorRepresentation,now:number,dur=.25,jag=.45){
    const pts:THREE.Vector3[]=[];const n=10;
    for(let i=0;i<=n;i++){const p=from.clone().lerp(to,i/n);if(i>0&&i<n){p.x+=(Math.random()-.5)*jag;p.z+=(Math.random()-.5)*jag;p.y+=(Math.random()-.5)*jag*.5;}pts.push(p);}
    const curve=new THREE.CatmullRomCurve3(pts);const mat=additive(color,1);
    const m=new THREE.Mesh(new THREE.TubeGeometry(curve,30,.05,5,false),mat);
    const glowM=new THREE.Mesh(new THREE.TubeGeometry(curve,30,.16,6,false),additive(color,.35));
    const g=new THREE.Group();g.add(m,glowM);
    return this.add({obj:g,dur,update:k=>{mat.opacity=1-k;(glowM.material as THREE.MeshBasicMaterial).opacity=.35*(1-k);}},now);
  }
  slash(x:number,y:number,z:number,yaw:number,color:THREE.ColorRepresentation,now:number,r=.9,dur=.28){
    const mat=additive(color,1),m=new THREE.Mesh(new THREE.TorusGeometry(r,.06,6,32,Math.PI*1.1),mat);
    const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=yaw;m.rotation.set(Math.PI/2,0,-Math.PI*.1);g.add(m);
    return this.add({obj:g,dur,update:k=>{mat.opacity=1-k;m.rotation.z=-Math.PI*.1-k*1.2;m.scale.setScalar(.8+k*.4);}},now);
  }
  /** A ground marker shaped like the danger zone (circle or line) that fills up until it lands. */
  warn(x:number,z:number,shape:{r:number;line?:{angle:number;length:number}},color:THREE.ColorRepresentation,now:number,dur:number){
    const g=new THREE.Group();g.position.set(x,.05,z);
    const fill=additive(color,.25),edge=additive(color,.9);
    let inner:THREE.Mesh,outline:THREE.Mesh;
    if(shape.line){const L=shape.line.length,W=shape.r*2;
      inner=new THREE.Mesh(new THREE.PlaneGeometry(L,W),fill);inner.rotation.x=-Math.PI/2;inner.position.x=L/2;
      outline=new THREE.Mesh(new THREE.EdgesGeometry(new THREE.PlaneGeometry(L,W)) as unknown as THREE.BufferGeometry,edge);
      const frame=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(L,W)),new THREE.LineBasicMaterial({color,transparent:true}));frame.rotation.x=-Math.PI/2;frame.position.x=L/2;
      g.rotation.y=-shape.line.angle;g.add(inner,frame);outline.visible=false;
      return this.add({obj:g,dur,update:(k,t)=>{inner.scale.set(Math.max(.01,k),1,1);inner.position.x=L*k/2;fill.opacity=.2+.25*k;(frame.material as THREE.LineBasicMaterial).opacity=.6+.4*Math.abs(Math.sin(t*.02));}},now);
    }
    inner=new THREE.Mesh(new THREE.CircleGeometry(shape.r,40),fill);inner.rotation.x=-Math.PI/2;
    outline=new THREE.Mesh(new THREE.RingGeometry(shape.r*.94,shape.r,48),edge);outline.rotation.x=-Math.PI/2;
    g.add(inner,outline);
    return this.add({obj:g,dur,update:(k,t)=>{inner.scale.setScalar(Math.max(.01,k));fill.opacity=.18+.25*k;edge.opacity=.6+.4*Math.abs(Math.sin(t*.02));}},now);
  }
  // ——— v6.0 二轉 building blocks (all additive, no lights) ———
  /** A ground field that stays for `dur` (fades in/out at the ends, soft pulse). */
  field(x:number,z:number,r:number,color:THREE.ColorRepresentation,now:number,dur:number,opacity=.32){
    // Normal blending keeps the colour readable on bright ground (additive washes out to white).
    const mat=new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,toneMapped:false}),m=new THREE.Mesh(new THREE.CircleGeometry(1,48),mat);m.rotation.x=-Math.PI/2;m.position.set(x,.035,z);m.scale.setScalar(r);
    return this.add({obj:m,dur,update:(k,t)=>{const edge=Math.min(1,k*dur*4,(1-k)*dur*3);mat.opacity=opacity*edge*(.82+.18*Math.sin(t*.006));}},now);
  }
  /** A shield dome; the caller may move `obj` every frame to follow someone. */
  dome(pos:THREE.Vector3,r:number,color:THREE.ColorRepresentation,now:number,dur:number){
    const mat=new THREE.MeshBasicMaterial({color,transparent:true,opacity:.2,depthWrite:false,toneMapped:false,side:THREE.DoubleSide}),m=new THREE.Mesh(new THREE.SphereGeometry(1,22,14,0,Math.PI*2,0,Math.PI*.55),mat);m.position.copy(pos);m.scale.setScalar(r);
    return this.add({obj:m,dur,update:(k,t)=>{const edge=Math.min(1,k*dur*5,(1-k)*dur*4);mat.opacity=(.14+.06*Math.sin(t*.008))*edge;m.rotation.y=t*.0012;}},now);
  }
  /** A fan (or full circle when spread ≥ 2π) flashing on the ground in world direction `angle`. */
  fan(x:number,z:number,r:number,angle:number,spread:number,color:THREE.ColorRepresentation,now:number,dur=.5){
    const full=spread>=Math.PI*2-1e-3,mat=additive(color,.85),m=new THREE.Mesh(new THREE.CircleGeometry(1,48,full?0:-angle-spread/2,full?Math.PI*2:spread),mat);
    m.rotation.x=-Math.PI/2;m.position.set(x,.06,z);
    return this.add({obj:m,dur,update:k=>{m.scale.setScalar(r*(.35+.65*Math.min(1,k*3)));mat.opacity=.85*(1-k);}},now);
  }
  /** A straight bright streak (sniper shot, piercing arrow, dash trail). */
  streak(x:number,z:number,angle:number,length:number,width:number,color:THREE.ColorRepresentation,now:number,dur=.35,y=.6){
    const g=new THREE.Group(),mat=additive(color,.9),m=new THREE.Mesh(new THREE.PlaneGeometry(length,width),mat);m.rotation.x=-Math.PI/2;m.position.x=length/2;g.add(m);
    g.position.set(x,y,z);g.rotation.y=-angle;
    return this.add({obj:g,dur,update:k=>{mat.opacity=.9*(1-k);m.scale.y=1-k*.6;}},now);
  }
  projectile(from:THREE.Vector3,to:THREE.Vector3,color:THREE.ColorRepresentation,now:number,dur:number,size:number,arc:number,onFrame?:(p:THREE.Vector3)=>void,kind:'orb'|'arrow'|'shard'='orb'){
    const g=new THREE.Group();
    if(kind==='arrow'){const shaft=new THREE.Mesh(new THREE.CylinderGeometry(.015,.015,.5,5),new THREE.MeshBasicMaterial({color:'#8b5a36'}));shaft.rotation.x=Math.PI/2;g.add(shaft);
      const tip=new THREE.Mesh(new THREE.ConeGeometry(.04,.1,6),new THREE.MeshBasicMaterial({color:'#eef4fa'}));tip.rotation.x=Math.PI/2;tip.position.z=.28;g.add(tip);
      const glowM=new THREE.Mesh(new THREE.SphereGeometry(.08,8,6),additive(color,.6));glowM.position.z=.25;g.add(glowM);}
    else if(kind==='shard'){const s=new THREE.Mesh(new THREE.OctahedronGeometry(size),additive(color,1));s.scale.z=2.2;g.add(s);}
    else{const core=new THREE.Mesh(new THREE.SphereGeometry(size*.55,12,10),new THREE.MeshBasicMaterial({color:'#ffffff',toneMapped:false}));const halo=new THREE.Mesh(new THREE.SphereGeometry(size,14,10),additive(color,.8));g.add(core,halo);}
    const p=new THREE.Vector3(),prev=from.clone();
    return this.add({obj:g,dur,update:k=>{p.lerpVectors(from,to,k);p.y+=Math.sin(k*Math.PI)*arc;g.position.copy(p);
      if(kind!=='orb'){const dir=p.clone().sub(prev);if(dir.lengthSq()>1e-6)g.lookAt(p.clone().add(dir));}prev.copy(p);onFrame?.(p);}},now);
  }
}
