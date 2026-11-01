// Ground chunks and props, painted procedurally (original art).
import { canvas, shade, ink, ellipse, rr, OUTLINE, radial, linear, prng, rgba } from './util';
import { G, type MapData, type Prop } from '../../world/mapgen';
import { TW, TH, toScreen } from '../iso';

export const CHUNK=16;
type Ctx=CanvasRenderingContext2D;
const groundColor:Record<number,string>={[G.grass]:'#8cc46a',[G.grass2]:'#9dd075',[G.path]:'#dcbc8c',[G.stone]:'#d3cbbd',[G.water]:'#5fb3e6',
  [G.flowers]:'#94c96c',[G.caveFloor]:'#8796ad',[G.ice]:'#c4e4f5',[G.darkGrass]:'#679f55',[G.sand]:'#e9d8a8'};

/** Paints cells [x0,x0+CHUNK)×[y0,y0+CHUNK). Returns the canvas and the screen position of its top-left. */
export function paintChunk(map:MapData,x0:number,y0:number):{canvas:HTMLCanvasElement;left:number;top:number}{
  const x1=Math.min(map.w,x0+CHUNK),y1=Math.min(map.h,y0+CHUNK);
  const left=toScreen(x0,y1).x-TW,right=toScreen(x1,y0).x+TW,top=toScreen(x0,y0).y-TH,bottom=toScreen(x1,y1).y+TH;
  const [c,g]=canvas(right-left,bottom-top);
  g.translate(-left,-top);
  const code=(x:number,y:number)=>x<0||y<0||x>=map.w||y>=map.h?-1:map.ground[y*map.w+x];
  const own=(x:number,y:number)=>x>=x0&&x<x1&&y>=y0&&y<y1;
  const diamond=(x:number,y:number,grow=0)=>{const p=toScreen(x+.5,y+.5),hw=TW/2+grow,hh=TH/2+grow/2;g.beginPath();g.moveTo(p.x,p.y-hh);g.lineTo(p.x+hw,p.y);g.lineTo(p.x,p.y+hh);g.lineTo(p.x-hw,p.y);g.closePath();};
  const base=map.def.theme==='cave'?G.caveFloor:map.def.theme==='forest'?G.darkGrass:G.grass;
  // 1. Base layer: every cell (with a one-cell margin so neighbouring chunks agree).
  for(let y=y0-1;y<=y1;y++)for(let x=x0-1;x<=x1;x++){
    const k=code(x,y);if(k<0)continue;
    const r=prng((y*977+x*131)^map.def.seed);
    const under=k===G.path||k===G.stone||k===G.water||k===G.sand||k===G.ice||k===G.grass2||k===G.flowers?base:k;
    diamond(x,y,1);g.fillStyle=shade(groundColor[under],(r()-.5)*.035);g.fill();
  }
  // 2. Soft blobs for special ground so roads, plazas and ponds have rounded edges.
  const blobs=[G.grass2,G.flowers,G.sand,G.path,G.ice,G.stone,G.water];
  for(const want of blobs)for(let y=y0-1;y<=y1;y++)for(let x=x0-1;x<=x1;x++){
    if(code(x,y)!==want)continue;
    const p=toScreen(x+.5,y+.5),r=prng((y*577+x*313)^want);
    const col=want===G.sand&&map.def.theme==='cave'?'#a9b7cb':groundColor[want];
    if(want===G.stone){diamond(x,y,1);g.fillStyle=shade(col,(r()-.5)*.06);g.fill();continue;}
    const grow=want===G.water?.95:want===G.grass2||want===G.flowers?1.25:1.05;
    ellipse(g,p.x,p.y,TW*grow*.62,TH*grow*.62);g.fillStyle=want===G.water?shade(col,-.05):shade(col,(r()-.5)*.05);g.fill();
  }
  // 3. Details on owned cells only.
  for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
    const k=code(x,y),p=toScreen(x+.5,y+.5),r=prng((y*7919+x*104729)^map.def.seed);
    if(k===G.grass||k===G.grass2||k===G.darkGrass||k===G.flowers){
      const n=3+Math.floor(r()*4);
      for(let i=0;i<n;i++){const gx=p.x+(r()-.5)*TW*.8,gy=p.y+(r()-.5)*TH*.7;
        g.beginPath();g.moveTo(gx,gy);g.lineTo(gx-1.5+r()*3,gy-4-r()*3);g.strokeStyle=shade(groundColor[k],-.18-r()*.1);g.lineWidth=1.3;g.stroke();}
      if(k===G.flowers||r()<.08){for(let i=0;i<(k===G.flowers?4:1);i++){const fx=p.x+(r()-.5)*TW*.7,fy=p.y+(r()-.5)*TH*.6;
        ellipse(g,fx,fy,2.2,1.6);g.fillStyle=['#fff6f0','#ffd45c','#ff9ec4','#b9a3ff'][Math.floor(r()*4)];g.fill();}}
      if(r()<.12){ellipse(g,p.x+(r()-.5)*20,p.y+(r()-.5)*10,10+r()*8,4+r()*3);g.fillStyle=rgba('#ffffff',.06);g.fill();}
    }else if(k===G.path||k===G.sand){
      const pc=k===G.sand&&map.def.theme==='cave'?'#a9b7cb':groundColor[k];
      for(let i=0;i<3;i++){ellipse(g,p.x+(r()-.5)*TW*.6,p.y+(r()-.5)*TH*.5,1.6+r()*1.6,1.1+r());g.fillStyle=shade(pc,-.2);g.fill();}
    }else if(k===G.stone){
      diamond(x,y,0);g.strokeStyle=rgba('#7a6f60',.35);g.lineWidth=1;g.stroke();
      if(r()<.5){g.beginPath();g.moveTo(p.x-TW/4,p.y-TH/4);g.lineTo(p.x+TW/4,p.y+TH/4);g.strokeStyle=rgba('#7a6f60',.18);g.stroke();}
    }else if(k===G.water){
      for(let i=0;i<2;i++){const wx=p.x+(r()-.5)*TW*.5,wy=p.y+(r()-.5)*TH*.5;g.beginPath();g.moveTo(wx-6,wy);g.quadraticCurveTo(wx,wy-3,wx+6,wy);g.strokeStyle=rgba('#ffffff',.45);g.lineWidth=1.4;g.stroke();}
    }else if(k===G.caveFloor||k===G.ice){
      for(let i=0;i<2;i++){ellipse(g,p.x+(r()-.5)*TW*.6,p.y+(r()-.5)*TH*.5,2+r()*3,1.4+r()*2);g.fillStyle=k===G.ice?rgba('#ffffff',.5):shade(groundColor[k],-.15);g.fill();}
    }
  }
  return {canvas:c,left,top};
}

// ———————————————————————————— props ————————————————————————————
/** Prop textures are drawn at 2×; anchor (ax, ay) is the ground point in the 2× canvas. */
export type PropArt = { canvas:HTMLCanvasElement; ax:number; ay:number };
const S=2;
export function paintProp(p:Prop,theme:string):PropArt {
  switch(p.kind){
    case 'tree':return tree(p.v,theme);
    case 'pine':return pine(p.v,theme);
    case 'bigTree':return bigTree(p.v);
    case 'bush':return bush(p.v);
    case 'rock':return rock(p.v,theme);
    case 'flower':return flower(p.v);
    case 'tuft':return tuft(p.v,theme);
    case 'mushroom':return mushroomDeco(p.v);
    case 'log':return log();
    case 'lamp':return lamp();
    case 'fountain':return fountain();
    case 'house':return house(p.w??5,p.h??5,p.v);
    case 'stall':return stall(p.v);
    case 'sign':return sign();
    case 'crystal':return crystal(p.v);
    case 'stalagmite':return stalagmite(p.v);
    case 'caveWall':return caveWall(p.v);
    default:return flower(0);
  }
}
const shadowAt=(g:Ctx,x:number,y:number,rx:number,ry:number)=>{ellipse(g,x,y,rx,ry);g.fillStyle='rgba(40,50,30,.25)';g.fill();};
function tree(v:number,theme:string):PropArt{
  const [c,g]=canvas(90*S,130*S);g.scale(S,S);const cx=45,by=122;
  const palettes=theme==='town'?[['#7fc25a','#4f9a45'],['#f0a64a','#c9702e'],['#9ccf6e','#5b9a46'],['#f2c14e','#d38b2c']]:[['#7fc25a','#4f9a45'],['#6cb352','#3f8a3f'],['#8fcf62','#559a45'],['#78bd5a','#468a3c']];
  const [hi,lo]=palettes[v%palettes.length];
  shadowAt(g,cx,by,30,10);
  rr(g,cx-7,by-46,14,46,5);ink(g,linear(g,cx-7,0,cx+7,0,[[0,'#a9744c'],[1,'#7a4e32']]),'#4a3020',2);
  for(const [x,y,r] of [[-16,-58,22],[16,-60,22],[0,-80,26],[-10,-92,16],[12,-94,17]]){ellipse(g,cx+x,by+y,r,r*.92);ink(g,radial(g,cx+x,by+y,r*1.1,hi,lo),shade(lo,-.45),2.2);}
  for(const [x,y] of [[-8,-96],[8,-86],[-20,-66]]){ellipse(g,cx+x,by+y,6,3.5,-.4);g.fillStyle='rgba(255,255,255,.28)';g.fill();}
  return {canvas:c,ax:cx*S,ay:by*S};
}
function pine(v:number,theme:string):PropArt{
  const [c,g]=canvas(80*S,140*S);g.scale(S,S);const cx=40,by=132;
  const col=theme==='cave'?'#6f8fa8':['#3f8a4f','#4a9a58','#347a46','#3f8f5a'][v%4];
  shadowAt(g,cx,by,24,8);rr(g,cx-5,by-24,10,24,3);ink(g,'#7a4e32','#4a3020',2);
  for(let i=0;i<4;i++){const y=by-20-i*24,w=34-i*7;g.beginPath();g.moveTo(cx-w,y);g.quadraticCurveTo(cx,y+8,cx+w,y);g.lineTo(cx,y-36);g.closePath();
    ink(g,linear(g,cx-w,0,cx+w,0,[[0,shade(col,.25)],[1,shade(col,-.15)]]),shade(col,-.5),2.2);}
  if(theme!=='cave'&&v%2===0){g.beginPath();g.moveTo(cx-3,by-110);g.lineTo(cx+3,by-110);g.lineTo(cx,by-126);g.fillStyle='rgba(255,255,255,.25)';g.fill();}
  return {canvas:c,ax:cx*S,ay:by*S};
}
function bigTree(v:number):PropArt{
  const [c,g]=canvas(150*S,190*S);g.scale(S,S);const cx=75,by=180;
  const [hi,lo]=[['#8fd068','#4a9445'],['#7fc25a','#3f8540'],['#9ad472','#52984a']][v%3];
  shadowAt(g,cx,by,52,16);
  g.beginPath();g.moveTo(cx-18,by);g.quadraticCurveTo(cx-10,by-40,cx-12,by-70);g.lineTo(cx+12,by-70);g.quadraticCurveTo(cx+10,by-40,cx+20,by);g.closePath();ink(g,linear(g,cx-18,0,cx+20,0,[[0,'#a9744c'],[1,'#6b4430']]),'#4a3020',2.4);
  for(const [x,y,r] of [[-34,-86,30],[34,-88,30],[0,-108,38],[-22,-128,24],[24,-130,26],[0,-148,22]]){ellipse(g,cx+x,by+y,r,r*.9);ink(g,radial(g,cx+x,by+y,r*1.1,hi,lo),shade(lo,-.45),2.4);}
  return {canvas:c,ax:cx*S,ay:by*S};
}
function bush(v:number):PropArt{
  const [c,g]=canvas(52*S,40*S);g.scale(S,S);const cx=26,by=34;
  const col=['#6cb352','#7fc25a','#5aa35b','#8cc46a'][v%4];
  shadowAt(g,cx,by,20,6);
  for(const [x,y,r] of [[-10,-10,11],[10,-10,11],[0,-18,13]]){ellipse(g,cx+x,by+y,r,r*.85);ink(g,radial(g,cx+x,by+y,r,shade(col,.3),col),shade(col,-.45),2);}
  if(v%2){for(const [x,y] of [[-8,-14],[6,-20],[12,-8]]){ellipse(g,cx+x,by+y,2.2,2.2);g.fillStyle=v===1?'#ff6b6b':'#fff6f0';g.fill();}}
  return {canvas:c,ax:cx*S,ay:by*S};
}
function rock(v:number,theme:string):PropArt{
  const [c,g]=canvas(56*S,46*S);g.scale(S,S);const cx=28,by=40;
  const col=theme==='cave'?'#6d7a90':'#a8a49a';
  shadowAt(g,cx,by,22,7);
  g.beginPath();g.moveTo(cx-20,by-2);g.quadraticCurveTo(cx-22,by-22,cx-6,by-28-v*2);g.quadraticCurveTo(cx+14,by-30,cx+20,by-12);g.quadraticCurveTo(cx+20,by,cx-20,by-2);
  ink(g,radial(g,cx-4,by-20,26,shade(col,.35),col),shade(col,-.5),2.2);
  if(v%2){ellipse(g,cx+14,by-6,8,6);ink(g,shade(col,-.08),shade(col,-.5),2);}
  return {canvas:c,ax:cx*S,ay:by*S};
}
function flower(v:number):PropArt{
  const [c,g]=canvas(22*S,22*S);g.scale(S,S);const cx=11,by=18;
  const col=['#ff9ec4','#ffd45c','#b9a3ff','#ffffff'][v%4];
  for(const [x,y] of [[-4,-2],[4,-4],[0,-8]]){g.beginPath();g.moveTo(cx+x,by);g.lineTo(cx+x,by+y);g.strokeStyle='#4f9a45';g.lineWidth=1.4;g.stroke();
    for(let i=0;i<5;i++){const a=i/5*Math.PI*2;ellipse(g,cx+x+Math.cos(a)*2.4,by+y+Math.sin(a)*2.4,1.8,1.8);g.fillStyle=col;g.fill();}
    ellipse(g,cx+x,by+y,1.3,1.3);g.fillStyle='#f2a93b';g.fill();}
  return {canvas:c,ax:cx*S,ay:by*S};
}
function tuft(v:number,theme:string):PropArt{
  const [c,g]=canvas(24*S,20*S);g.scale(S,S);const cx=12,by=18;
  const col=theme==='cave'?(v===3?'#bfe3f5':'#7d8aa0'):theme==='forest'?'#4f8f45':'#6aa84f';
  if(theme==='cave'&&v===3){g.beginPath();g.moveTo(cx-4,by);g.lineTo(cx-1,by-12);g.lineTo(cx+2,by);g.moveTo(cx+1,by);g.lineTo(cx+5,by-8);g.lineTo(cx+7,by);ink(g,'#d9f1ff','#6f9ab5',1.4);return {canvas:c,ax:cx*S,ay:by*S};}
  for(let i=0;i<6;i++){const x=cx-6+i*2.4;g.beginPath();g.moveTo(x,by);g.quadraticCurveTo(x+(i-3)*.8,by-8,x+(i-3)*1.6,by-11-(i%2)*3);g.strokeStyle=shade(col,(i%2)*.15);g.lineWidth=1.8;g.stroke();}
  return {canvas:c,ax:cx*S,ay:by*S};
}
function mushroomDeco(v:number):PropArt{
  const [c,g]=canvas(22*S,22*S);g.scale(S,S);const cx=11,by=19;
  const col=['#e96a5b','#b07ad9','#f2a93b','#e96a5b'][v%4];
  rr(g,cx-2.5,by-8,5,8,2);ink(g,'#fff6e6','#8a6a4a',1.2);
  g.beginPath();g.ellipse(cx,by-8,7,5.5,0,Math.PI,0);ink(g,col,shade(col,-.5),1.4);
  ellipse(g,cx-2,by-10,1.4,1);g.fillStyle='#fff';g.fill();
  return {canvas:c,ax:cx*S,ay:by*S};
}
function log():PropArt{
  const [c,g]=canvas(64*S,36*S);g.scale(S,S);const by=30;
  shadowAt(g,32,by,26,6);
  rr(g,8,by-18,48,16,8);ink(g,linear(g,0,by-18,0,by-2,[[0,'#b07a50'],[1,'#7a4e32']]),'#4a3020',2);
  ellipse(g,54,by-10,6,8);ink(g,'#e0b98a','#4a3020',2);ellipse(g,54,by-10,2.5,3.5);g.strokeStyle='#a9744c';g.lineWidth=1;g.stroke();
  return {canvas:c,ax:32*S,ay:by*S};
}
function lamp():PropArt{
  const [c,g]=canvas(30*S,96*S);g.scale(S,S);const cx=15,by=90;
  shadowAt(g,cx,by,9,3);
  rr(g,cx-2.5,by-70,5,70,2);ink(g,'#4a4a5a','#2a2a35',1.6);
  rr(g,cx-8,by-86,16,18,4);ink(g,radial(g,cx,by-78,12,'#fff8d0','#f2c14e'),'#4a4a5a',2);
  g.beginPath();g.moveTo(cx-10,by-86);g.lineTo(cx,by-94);g.lineTo(cx+10,by-86);g.closePath();ink(g,'#4a4a5a','#2a2a35',1.6);
  return {canvas:c,ax:cx*S,ay:by*S};
}
function fountain():PropArt{
  const [c,g]=canvas(200*S,150*S);g.scale(S,S);const cx=100,by=110;
  ellipse(g,cx,by,92,44);ink(g,linear(g,0,by-44,0,by+44,[[0,'#e8e2d6'],[1,'#a8a092']]),'#6b6358',2.4);
  ellipse(g,cx,by-6,80,36);ink(g,radial(g,cx,by-10,80,'#a9dcff','#4b9fd8'),'#6b6358',2);
  for(let i=0;i<5;i++){g.beginPath();g.ellipse(cx,by-6,30+i*10,14+i*4.5,0,0,Math.PI*2);g.strokeStyle='rgba(255,255,255,.18)';g.lineWidth=1.2;g.stroke();}
  rr(g,cx-12,by-56,24,52,6);ink(g,linear(g,cx-12,0,cx+12,0,[[0,'#f0eadf'],[1,'#b8b0a2']]),'#6b6358',2);
  ellipse(g,cx,by-58,26,10);ink(g,'#e8e2d6','#6b6358',2);ellipse(g,cx,by-60,20,7);g.fillStyle='#7fc4f2';g.fill();
  for(const s of [-1,1])for(let i=0;i<3;i++){g.beginPath();g.moveTo(cx,by-64);g.quadraticCurveTo(cx+s*(14+i*8),by-92+i*4,cx+s*(26+i*10),by-30+i*6);g.strokeStyle='rgba(220,245,255,.75)';g.lineWidth=2;g.stroke();}
  ellipse(g,cx,by-72,8,10);g.fillStyle='rgba(235,250,255,.8)';g.fill();
  return {canvas:c,ax:cx*S,ay:by*S};
}
function house(w:number,h:number,v:number):PropArt{
  const wallH=64,ridge=46;
  const pts=(x:number,y:number)=>toScreen(x-w/2,y-h/2);
  const N=pts(0,0),E=pts(w,0),So=pts(w,h),W=pts(0,h);
  const minX=W.x-14,maxX=E.x+14,minY=N.y-wallH-ridge-20,maxY=So.y+10;
  const [c,g]=canvas((maxX-minX)*S,(maxY-minY)*S);g.scale(S,S);g.translate(-minX,-minY);
  const roofs=['#d9534f','#4b7fe0','#3f9e5a','#e8892a'],roof=roofs[v%4],wall='#f6ead2';
  const up=(p:{x:number;y:number},dy:number)=>({x:p.x,y:p.y-dy});
  ellipse(g,(W.x+E.x)/2,So.y-8,(E.x-W.x)/2+6,(So.y-N.y)/2+4);g.fillStyle='rgba(40,50,30,.22)';g.fill();
  const poly=(ps:{x:number;y:number}[],fill:string|CanvasGradient,stroke='#5a4636')=>{g.beginPath();g.moveTo(ps[0].x,ps[0].y);for(const p of ps.slice(1))g.lineTo(p.x,p.y);g.closePath();ink(g,fill,stroke,2);};
  // Walls: front-left (W→S) shaded, front-right (S→E) lit.
  poly([W,So,up(So,wallH),up(W,wallH)],linear(g,W.x,0,So.x,0,[[0,shade(wall,-.18)],[1,shade(wall,-.08)]]));
  poly([So,E,up(E,wallH),up(So,wallH)],linear(g,So.x,0,E.x,0,[[0,wall],[1,shade(wall,.05)]]));
  // Timber frame.
  g.strokeStyle='#8a6a4a';g.lineWidth=3;
  for(const [a,b] of [[W,So],[So,E]]){g.beginPath();g.moveTo(a.x,a.y-wallH*.5);g.lineTo(b.x,b.y-wallH*.5);g.stroke();}
  // Door on the right wall, windows on both.
  const lerp=(a:{x:number;y:number},b:{x:number;y:number},t:number)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
  const d0=lerp(So,E,.38),d1=lerp(So,E,.58);
  poly([d0,d1,up(d1,34),up(d0,34)],'#8b5a36','#4a3020');ellipse(g,(d0.x+d1.x)/2+4,(d0.y+d1.y)/2-16,1.6,1.6);g.fillStyle='#f2c14e';g.fill();
  for(const [a,b,t0,t1] of [[W,So,.25,.45],[W,So,.6,.8],[So,E,.72,.9]] as const){const p0=lerp(a,b,t0),p1=lerp(a,b,t1);
    poly([up(p0,30),up(p1,30),up(p1,48),up(p0,48)],linear(g,0,p0.y-48,0,p0.y-30,[[0,'#cfefff'],[1,'#7fb8e0']]),'#5a4636');}
  // Hip roof with eaves.
  const eave=10,top=(p:{x:number;y:number})=>up(p,wallH);
  const cxp=(N.x+So.x)/2,cyp=(N.y+So.y)/2-wallH-ridge;
  const peakA={x:cxp-(w>=h?(E.x-N.x)*.25:0),y:cyp+(w>=h?-(E.y-N.y)*.25:0)},peakB={x:cxp+(w>=h?(E.x-N.x)*.25:0),y:cyp+(w>=h?(E.y-N.y)*.25:0)};
  const tN={x:top(N).x,y:top(N).y-eave*.5},tE={x:top(E).x+eave,y:top(E).y},tS={x:top(So).x,y:top(So).y+eave*.5},tW={x:top(W).x-eave,y:top(W).y};
  poly([tN,tE,peakB,peakA],shade(roof,-.25));poly([tW,tN,peakA],shade(roof,-.3));
  poly([tW,tS,peakB,peakA],linear(g,tW.x,0,tS.x,0,[[0,shade(roof,-.12)],[1,roof]]));
  poly([tS,tE,peakB],linear(g,tS.x,0,tE.x,0,[[0,shade(roof,.12)],[1,shade(roof,.02)]]));
  // Roof tile lines.
  g.strokeStyle=rgba('#ffffff',.18);g.lineWidth=1.4;
  for(let i=1;i<4;i++){const t=i/4,a=lerp(tW,peakA,t),b=lerp(tS,peakB,t);g.beginPath();g.moveTo(a.x,a.y);g.lineTo(b.x,b.y);g.stroke();}
  // Chimney.
  const ch=lerp(peakA,peakB,.75);rr(g,ch.x+6,ch.y-6,12,20,2);ink(g,'#b8735a','#5a3a2a');
  return {canvas:c,ax:-minX*S,ay:(-minY+(N.y+So.y)/2)*S};
}
function stall(v:number):PropArt{
  const [c,g]=canvas(110*S,96*S);g.scale(S,S);const cx=55,by=86;
  shadowAt(g,cx,by,46,12);
  rr(g,cx-40,by-34,80,30,4);ink(g,linear(g,0,by-34,0,by-4,[[0,'#c9905a'],[1,'#8b5a36']]),'#4a3020');
  for(const x of [-36,32]){rr(g,cx+x,by-74,4,44,2);ink(g,'#8b5a36','#4a3020',1.6);}
  const col=v?'#4b7fe0':'#d9534f';
  for(let i=0;i<6;i++){g.beginPath();g.moveTo(cx-46+i*15.3,by-70);g.lineTo(cx-46+(i+1)*15.3,by-70);g.lineTo(cx-46+(i+1)*15.3,by-58);g.quadraticCurveTo(cx-46+(i+.5)*15.3,by-52,cx-46+i*15.3,by-58);g.closePath();ink(g,i%2?'#ffffff':col,'#5a4636',1.6);}
  for(const [x,cl] of [[-24,'#e8524a'],[-8,'#ffd45c'],[8,'#7fc25a'],[24,'#ff9ec4']] as const){ellipse(g,cx+x,by-38,6,5);ink(g,cl,OUTLINE,1.5);}
  return {canvas:c,ax:cx*S,ay:by*S};
}
function sign():PropArt{
  const [c,g]=canvas(50*S,70*S);g.scale(S,S);const cx=25,by=64;
  shadowAt(g,cx,by,12,4);rr(g,cx-3,by-46,6,46,2);ink(g,'#8b5a36','#4a3020',1.6);
  g.beginPath();g.moveTo(cx-18,by-54);g.lineTo(cx+14,by-54);g.lineTo(cx+22,by-46);g.lineTo(cx+14,by-38);g.lineTo(cx-18,by-38);g.closePath();ink(g,'#c9905a','#4a3020',2);
  g.beginPath();g.moveTo(cx-10,by-46);g.lineTo(cx+10,by-46);g.moveTo(cx+4,by-50);g.lineTo(cx+10,by-46);g.lineTo(cx+4,by-42);g.strokeStyle='#4a3020';g.lineWidth=2;g.stroke();
  return {canvas:c,ax:cx*S,ay:by*S};
}
function crystal(v:number):PropArt{
  const [c,g]=canvas(56*S,80*S);g.scale(S,S);const cx=28,by=74;
  shadowAt(g,cx,by,18,6);
  const col=['#9fd5ff','#b9a3ff','#a8f0e8','#9fd5ff'][v%4];
  for(const [x,h,w,a] of [[-10,40,8,-.25],[8,52,10,.15],[0,62,11,0],[14,30,7,.4]]){g.save();g.translate(cx+x,by-4);g.rotate(a);
    g.beginPath();g.moveTo(-w,0);g.lineTo(-w,-h*.7);g.lineTo(0,-h);g.lineTo(w,-h*.7);g.lineTo(w,0);g.closePath();ink(g,linear(g,-w,0,w,0,[[0,shade(col,.45)],[1,shade(col,-.15)]]),shade(col,-.55),1.8);
    g.beginPath();g.moveTo(0,-h);g.lineTo(0,0);g.strokeStyle='rgba(255,255,255,.5)';g.lineWidth=1.2;g.stroke();g.restore();}
  return {canvas:c,ax:cx*S,ay:by*S};
}
function stalagmite(v:number):PropArt{
  const [c,g]=canvas(48*S,84*S);g.scale(S,S);const cx=24,by=78;
  shadowAt(g,cx,by,16,5);const col='#7d8aa0';
  g.beginPath();g.moveTo(cx-16,by);g.quadraticCurveTo(cx-10,by-30,cx-2+v,by-70+v*4);g.quadraticCurveTo(cx+8,by-30,cx+16,by);g.closePath();
  ink(g,linear(g,cx-16,0,cx+16,0,[[0,shade(col,.3)],[1,shade(col,-.2)]]),shade(col,-.5),2);
  for(let i=0;i<3;i++){g.beginPath();g.moveTo(cx-10+i*6,by-6-i*14);g.lineTo(cx-4+i*6,by-10-i*14);g.strokeStyle=rgba('#ffffff',.2);g.lineWidth=1.5;g.stroke();}
  return {canvas:c,ax:cx*S,ay:by*S};
}
function caveWall(v:number):PropArt{
  const [c,g]=canvas(76*S,120*S);g.scale(S,S);const cx=38,by=112;
  const col=['#5f6c82','#66748a','#58647a','#6a778c'][v%4];
  g.beginPath();g.moveTo(cx-34,by);g.lineTo(cx-36,by-60);g.quadraticCurveTo(cx-24,by-104-v*3,cx+2,by-100);g.quadraticCurveTo(cx+30,by-96,cx+34,by-56);g.lineTo(cx+34,by);g.closePath();
  ink(g,linear(g,cx-36,0,cx+34,0,[[0,shade(col,.22)],[1,shade(col,-.25)]]),shade(col,-.55),2.2);
  for(const [x,y] of [[-18,-70],[8,-50],[-6,-30],[18,-82]]){g.beginPath();g.moveTo(cx+x,by+y);g.lineTo(cx+x+10,by+y+4);g.strokeStyle=rgba('#000000',.18);g.lineWidth=2;g.stroke();}
  if(v%2){g.beginPath();g.moveTo(cx+10,by-60);g.lineTo(cx+14,by-74);g.lineTo(cx+18,by-60);ink(g,'#bfe3f5','#6f9ab5',1.4);}
  return {canvas:c,ax:cx*S,ay:by*S};
}
