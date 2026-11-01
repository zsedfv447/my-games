// Original layered scenery. Generated once per theme, never during animation frames.
import {canvas,linear,prng,ellipse} from './util';
export function paintBackdrop(theme:string):HTMLCanvasElement{
  const [c,g]=canvas(1280,900),cave=theme==='cave',forest=theme==='forest';
  g.fillStyle=linear(g,0,0,0,900,[[0,cave?'#526b86':forest?'#c9dfbf':'#d3e9d6'],[.55,cave?'#788da4':'#a6c693'],[1,cave?'#394e6d':'#6f9f72']]);g.fillRect(0,0,1280,900);
  const rnd=prng(cave?43:forest?29:13);
  for(let layer=0;layer<5;layer++){
    g.beginPath();g.moveTo(0,900);
    for(let x=-80;x<=1360;x+=40){const y=290+layer*105+Math.sin(x*.004+layer*1.3)*95+Math.sin(x*.011+layer)*20;g.lineTo(x,y);}
    g.lineTo(1280,900);g.closePath();g.fillStyle=cave?`rgba(40,67,96,${.07+layer*.035})`:`rgba(63,114,79,${.06+layer*.025})`;g.fill();
  }
  for(let i=0;i<200;i++){
    const x=rnd()*1280,y=150+rnd()*750,r=12+rnd()*42;
    ellipse(g,x,y,r,r*.45);g.fillStyle=cave?'rgba(177,219,235,.04)':'rgba(235,248,211,.045)';g.fill();
  }
  if(!cave)for(let i=0;i<14;i++){const x=rnd()*1280,y=rnd()*350;ellipse(g,x,y,70+rnd()*160,12+rnd()*25);g.fillStyle='rgba(255,253,236,.13)';g.fill();}
  return c;
}

export { landmarks, type Landmark } from '../../data/landmarks';
import type { Landmark } from '../../data/landmarks';

export function paintLandmark(kind:Landmark['kind']):HTMLCanvasElement{
  const [c,g]=canvas(200,180);g.translate(100,150);
  ellipse(g,0,0,78,24);g.fillStyle='rgba(32,68,45,.2)';g.fill();
  if(kind==='camp'){
    g.beginPath();g.moveTo(-66,0);g.lineTo(-22,-90);g.lineTo(40,-12);g.closePath();g.fillStyle='#d5b57a';g.fill();g.strokeStyle='#66593e';g.lineWidth=3;g.stroke();
    g.beginPath();g.moveTo(-22,-90);g.lineTo(68,-58);g.lineTo(80,6);g.lineTo(40,-12);g.closePath();g.fillStyle='#e6cfa3';g.fill();g.stroke();
    g.beginPath();g.moveTo(-42,-8);g.lineTo(-22,-58);g.lineTo(4,-8);g.closePath();g.fillStyle='#655642';g.fill();
    g.fillStyle='#91774f';g.fillRect(62,-104,5,108);g.fillStyle='#3d8b79';g.fillRect(67,-101,30,22);
    for(let i=0;i<7;i++){const a=i/7*Math.PI*2;ellipse(g,22+Math.cos(a)*15,18+Math.sin(a)*5,5,3);g.fillStyle='#a19d8c';g.fill();}
  }else{
    for(let i=0;i<7;i++){const a=i/7*Math.PI*2,x=Math.cos(a)*62,y=Math.sin(a)*20;g.fillStyle='#7b8e7d';g.fillRect(x-8,y-24,16,27);g.fillStyle='#c6d2b9';g.fillRect(x-8,y-24,16,5);}
    if(kind==='shrine'){
      g.fillStyle='#7c9699';g.fillRect(-18,-100,36,102);g.fillStyle='#c1dbd7';g.fillRect(-22,-105,44,13);
      g.strokeStyle='#b4f3e8';g.lineWidth=4;g.beginPath();g.moveTo(0,-88);g.lineTo(10,-65);g.lineTo(0,-42);g.lineTo(-10,-65);g.closePath();g.stroke();
    }else{g.strokeStyle='#b6bd9a';g.lineWidth=5;g.beginPath();g.ellipse(0,0,48,14,0,0,Math.PI*2);g.stroke();}
  }
  return c;
}
