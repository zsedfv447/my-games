// Anime-style face textures painted on canvas and wrapped onto the front of a head sphere.
import * as THREE from 'three';
import { canvasTexture } from './toon';

export type Expression='normal'|'blink'|'happy'|'hurt'|'attack'|'dead'|'cast';
const cache=new Map<string,THREE.CanvasTexture>();
const S=256;

/** Face for player characters and NPCs. Coordinates assume the texture spans the front ~90° of the head. */
export function faceTexture(eyeColor:string,expr:Expression,feminine=true):THREE.CanvasTexture{
  const key=`f:${eyeColor}:${expr}:${feminine}`;const hit=cache.get(key);if(hit)return hit;
  const t=canvasTexture(S,S,g=>{
    const ey=148,ex=58;
    // Blush.
    for(const s of [-1,1]){const gr=g.createRadialGradient(S/2+s*80,182,2,S/2+s*80,182,26);gr.addColorStop(0,'rgba(255,120,140,.55)');gr.addColorStop(1,'rgba(255,120,140,0)');g.fillStyle=gr;g.fillRect(S/2+s*80-30,152,60,60);}
    for(const s of [-1,1]){
      const x=S/2+s*ex;
      if(expr==='blink'||expr==='dead'&&false){g.strokeStyle='#3a2430';g.lineWidth=6;g.beginPath();g.moveTo(x-22,ey+4);g.quadraticCurveTo(x,ey+14,x+22,ey+4);g.stroke();continue;}
      if(expr==='happy'||expr==='cast'){g.strokeStyle='#3a2430';g.lineWidth=7;g.beginPath();g.moveTo(x-22,ey+8);g.quadraticCurveTo(x,ey-16,x+22,ey+8);g.stroke();continue;}
      if(expr==='hurt'){g.strokeStyle='#3a2430';g.lineWidth=7;g.beginPath();g.moveTo(x-18*s,ey-14);g.lineTo(x+14*s,ey);g.lineTo(x-18*s,ey+14);g.stroke();continue;}
      if(expr==='dead'){g.strokeStyle='#3a2430';g.lineWidth=7;g.beginPath();g.moveTo(x-16,ey-14);g.lineTo(x+16,ey+14);g.moveTo(x+16,ey-14);g.lineTo(x-16,ey+14);g.stroke();continue;}
      // Big glossy anime eye.
      const w=25,h=feminine?36:31;
      g.save();g.beginPath();g.ellipse(x,ey,w,h,0,0,Math.PI*2);g.fillStyle='#ffffff';g.fill();g.clip();
      const iris=g.createLinearGradient(0,ey-h,0,ey+h);iris.addColorStop(0,shade(eyeColor,-.55));iris.addColorStop(.55,eyeColor);iris.addColorStop(1,shade(eyeColor,.45));
      g.beginPath();g.ellipse(x+s*2,ey+4,w*.86,h*.9,0,0,Math.PI*2);g.fillStyle=iris;g.fill();
      g.beginPath();g.ellipse(x+s*2,ey+6,w*.42,h*.46,0,0,Math.PI*2);g.fillStyle=shade(eyeColor,-.7);g.fill();
      g.restore();
      // Upper lash line and lid shadow.
      g.strokeStyle='#2b1a26';g.lineWidth=feminine?9:7;g.beginPath();g.ellipse(x,ey,w+2,h+2,0,Math.PI*1.08,Math.PI*1.92);g.stroke();
      if(feminine){g.lineWidth=5;g.beginPath();g.moveTo(x+s*(w+1),ey-h*.55);g.lineTo(x+s*(w+11),ey-h*.8);g.stroke();}
      // Highlights.
      g.fillStyle='#ffffff';g.beginPath();g.ellipse(x-s*7,ey-12,8,10,-.3,0,Math.PI*2);g.fill();
      g.beginPath();g.ellipse(x+s*9,ey+16,4,4,0,0,Math.PI*2);g.fill();
      // Brow.
      g.strokeStyle='rgba(60,36,44,.75)';g.lineWidth=5;g.beginPath();
      if(expr==='attack'){g.moveTo(x-s*22,ey-h-14);g.lineTo(x+s*16,ey-h-4);}else{g.moveTo(x-20,ey-h-12);g.quadraticCurveTo(x,ey-h-20,x+20,ey-h-12);}g.stroke();
    }
    // Mouth.
    g.strokeStyle='#7a3a42';g.fillStyle='#b24a58';g.lineWidth=4;g.beginPath();
    if(expr==='attack'||expr==='hurt'){g.ellipse(S/2,206,10,8,0,0,Math.PI*2);g.fill();}
    else if(expr==='happy'||expr==='cast'){g.moveTo(S/2-14,198);g.quadraticCurveTo(S/2,218,S/2+14,198);g.closePath();g.fill();}
    else if(expr==='dead'){g.moveTo(S/2-10,206);g.lineTo(S/2+10,206);g.stroke();}
    else{g.moveTo(S/2-9,200);g.quadraticCurveTo(S/2,208,S/2+9,200);g.stroke();}
  });
  cache.set(key,t);return t;
}
/** Simpler cute monster face (dot eyes, highlight, mouth). */
export function monsterFace(expr:'normal'|'hurt'|'angry',eye='#2e2440'):THREE.CanvasTexture{
  const key=`m:${expr}:${eye}`;const hit=cache.get(key);if(hit)return hit;
  const t=canvasTexture(S,S,g=>{
    for(const s of [-1,1]){
      const x=S/2+s*48,y=128;
      if(expr==='hurt'){g.strokeStyle=eye;g.lineWidth=9;g.beginPath();g.moveTo(x-16*s,y-14);g.lineTo(x+12*s,y);g.lineTo(x-16*s,y+14);g.stroke();continue;}
      g.fillStyle=eye;g.beginPath();g.ellipse(x,y,15,21,0,0,Math.PI*2);g.fill();
      g.fillStyle='#fff';g.beginPath();g.ellipse(x-5,y-8,6,7,0,0,Math.PI*2);g.fill();g.beginPath();g.ellipse(x+5,y+8,3,3,0,0,Math.PI*2);g.fill();
      if(expr==='angry'){g.strokeStyle=eye;g.lineWidth=7;g.beginPath();g.moveTo(x-s*20,y-34);g.lineTo(x+s*14,y-24);g.stroke();}
      const gr=g.createRadialGradient(x+s*22,y+30,2,x+s*22,y+30,22);gr.addColorStop(0,'rgba(255,110,140,.5)');gr.addColorStop(1,'rgba(255,110,140,0)');g.fillStyle=gr;g.fillRect(x+s*22-24,y+6,48,48);
    }
    g.strokeStyle='#5a2a3a';g.lineWidth=6;g.beginPath();
    if(expr==='hurt'){g.fillStyle='#8a3a4a';g.ellipse(S/2,176,11,9,0,0,Math.PI*2);g.fill();}
    else if(expr==='angry'){g.moveTo(S/2-16,178);g.lineTo(S/2-6,170);g.lineTo(S/2+6,178);g.lineTo(S/2+16,170);g.stroke();}
    else{g.arc(S/2,166,12,.25,Math.PI-.25);g.stroke();}
  });
  cache.set(key,t);return t;
}
function shade(hex:string,amt:number){
  const c=new THREE.Color(hex);
  if(amt>=0)c.lerp(new THREE.Color('#ffffff'),amt);else c.multiplyScalar(1+amt);
  return `#${c.getHexString()}`;
}
/** Front-of-sphere geometry that the face texture wraps onto. */
export function faceShell(radius:number,width=1.55,height=1.35,centerTheta=Math.PI/2+.08):THREE.SphereGeometry{
  return new THREE.SphereGeometry(radius,24,18,Math.PI/2-width/2,width,centerTheta-height/2,height);
}
