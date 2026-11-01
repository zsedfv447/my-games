import * as THREE from 'three';
import { prng } from '../render/art/util';

/** Pure terrain construction shared by the world renderer and finite-geometry regression tests. */
export function hillsGeometry(width:number,height:number,seed:number,theme:string){
  const cx=width/2,cz=height/2,inner=Math.hypot(width,height)/2-3,outer=inner+55;
  const g=new THREE.RingGeometry(inner,outer,96,14),p=g.attributes.position,uv=g.attributes.uv as THREE.BufferAttribute;const r=prng(seed+5);const ph=[r()*6,r()*6];
  const tall=theme==='cave'?2.4:theme==='forest'?1.4:1;
  for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),d=Math.hypot(x,y),a=Math.atan2(y,x),t=THREE.MathUtils.clamp((d-inner)/(outer-inner),0,1);
    const h=(Math.pow(t,.7)*(5+Math.sin(a*5+ph[0])*2.5+Math.sin(a*11+ph[1])*1.5)+Math.sin(a*23)*.4*t)*tall*(t<.02?0:1);
    p.setZ(i,h);uv.setXY(i,x*.35,y*.35);}
  g.computeVertexNormals();g.rotateX(-Math.PI/2);g.translate(cx,-.03,cz);
  return g;
}
