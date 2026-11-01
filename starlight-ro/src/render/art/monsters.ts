// Procedural monsters (original designs). Sheet columns: idle×4 (also used while moving), attack×2, hurt×1.
import { canvas, shade, ink, ellipse, rr, eye, blush, OUTLINE, radial, linear } from './util';
import type { MonsterArt } from '../../data/monsters';

export const MONSTER_FRAMES=7;
export const monsterFrame=(pose:'idle'|'attack'|'hurt',f:number)=>pose==='idle'?f%4:pose==='attack'?4+Math.min(1,f):6;
const BASE=128;
type Ctx=CanvasRenderingContext2D;

export function monsterSize(art:MonsterArt){return Math.ceil(BASE*art.scale*(art.kind==='bee'||art.kind==='bat'?1.1:1));}
export function drawMonsterSheet(art:MonsterArt):HTMLCanvasElement {
  const S=monsterSize(art),[c,g]=canvas(S*MONSTER_FRAMES,S);
  for(let i=0;i<MONSTER_FRAMES;i++){
    g.save();g.translate(i*S,0);g.scale(S/BASE,S/BASE);
    const pose=i<4?'idle':i<6?'attack':'hurt',f=i<4?i:i<6?i-4:0;
    paint(g,art,pose,f);
    if(art.crown)crown(g,art.kind);
    g.restore();
  }
  return c;
}
function paint(g:Ctx,a:MonsterArt,pose:'idle'|'attack'|'hurt',f:number){
  const sq=pose==='idle'?[0,.06,0,-.05][f]:pose==='attack'?[-.08,.1][f]:.12;
  const hurt=pose==='hurt';
  switch(a.kind){
    case 'jelly':jelly(g,a,sq,hurt,pose==='attack'&&f===1);break;
    case 'worm':worm(g,a,f,hurt);break;
    case 'shroom':shroom(g,a,sq,hurt);break;
    case 'chick':chick(g,a,f,hurt,pose==='attack');break;
    case 'wolf':wolf(g,a,f,hurt,pose==='attack');break;
    case 'bee':bee(g,a,f,hurt,pose==='attack');break;
    case 'sapling':sapling(g,a,f,hurt,pose==='attack');break;
    case 'bat':bat(g,a,f,hurt,pose==='attack');break;
    case 'bunny':bunny(g,a,f,hurt,pose==='attack');break;
    case 'golem':golem(g,a,f,hurt,pose==='attack');break;
    case 'wisp':wisp(g,a,f,hurt,pose==='attack');break;
    case 'fox':fox(g,a,f,hurt,pose==='attack');break;
  }
}
const face=(g:Ctx,x:number,y:number,r:number,hurt:boolean,mouth:'smile'|'open'|'grr'='smile')=>{
  eye(g,x-r*1.4,y,r,'#2e2440',hurt);eye(g,x+r*1.4,y,r,'#2e2440',hurt);
  blush(g,x-r*2.4,y+r*1.3,r*.8);blush(g,x+r*2.4,y+r*1.3,r*.8);
  g.beginPath();
  if(mouth==='open'||hurt){ellipse(g,x,y+r*1.6,r*.5,r*.45);g.fillStyle='#8a3a4a';g.fill();}
  else if(mouth==='grr'){g.moveTo(x-r*.9,y+r*1.7);g.lineTo(x-r*.3,y+r*1.4);g.lineTo(x+r*.3,y+r*1.7);g.lineTo(x+r*.9,y+r*1.4);g.strokeStyle=OUTLINE;g.lineWidth=2;g.stroke();}
  else{g.arc(x,y+r*1.2,r*.55,.2,Math.PI-.2);g.strokeStyle=OUTLINE;g.lineWidth=2;g.stroke();}
};
function jelly(g:Ctx,a:MonsterArt,sq:number,hurt:boolean,jump:boolean){
  const lift=jump?-14:0,w=40*(1+sq),h=36*(1-sq),by=118+lift;
  g.beginPath();g.moveTo(64-w,by);g.bezierCurveTo(64-w,by-h*1.6,64-w*.3,by-h*2.25,64,by-h*2.3);
  g.bezierCurveTo(64+w*.3,by-h*2.25,64+w,by-h*1.6,64+w,by);g.quadraticCurveTo(64,by+6,64-w,by);
  ink(g,radial(g,64,by-h,w*1.5,shade(a.body,.45),a.body),shade(a.body,-.55),3);
  ellipse(g,64-w*.45,by-h*1.6,w*.22,h*.28,-.5);g.fillStyle='rgba(255,255,255,.75)';g.fill();
  ellipse(g,64+w*.55,by-h*.8,w*.1,h*.12);g.fillStyle='rgba(255,255,255,.5)';g.fill();
  face(g,64,by-h*.95,6.5,hurt);
}
function worm(g:Ctx,a:MonsterArt,f:number,hurt:boolean){
  const wig=[0,3,0,-3][f];
  for(let i=3;i>=1;i--){const x=64-i*15,y=112-Math.sin(i+f)*2.5;ellipse(g,x,y,16-i,15-i);ink(g,radial(g,x,y,16,shade(a.body,.3),a.body),shade(a.body,-.5),2.5);
    ellipse(g,x,y+12-i,4,3);g.fillStyle=shade(a.body,-.35);g.fill();}
  const hx=72,hy=98+wig;ellipse(g,hx,hy,22,20);ink(g,radial(g,hx,hy,24,a.accent,a.body),shade(a.body,-.5),2.5);
  for(const s of [-1,1]){g.beginPath();g.moveTo(hx+s*8,hy-16);g.quadraticCurveTo(hx+s*14,hy-34,hx+s*18,hy-32);g.strokeStyle=OUTLINE;g.lineWidth=2.5;g.stroke();ellipse(g,hx+s*18,hy-32,4,4);ink(g,'#ffd45c',OUTLINE,1.5);}
  face(g,hx+2,hy-2,5,hurt);
}
function shroom(g:Ctx,a:MonsterArt,sq:number,hurt:boolean){
  const by=120;
  for(const s of [-1,1]){ellipse(g,64+s*12,by-4,9,6);ink(g,'#8a5a3a');}
  rr(g,44,by-44*(1-sq),40,42*(1-sq),16);ink(g,radial(g,64,by-28,30,'#fffaf0',a.accent),'#8a6a4a',2.5);
  face(g,64,by-24*(1-sq),5,hurt);
  const cy=by-46*(1-sq),cw=50*(1+sq);
  g.beginPath();g.moveTo(64-cw,cy+6);g.bezierCurveTo(64-cw,cy-36,64+cw,cy-36,64+cw,cy+6);g.quadraticCurveTo(64,cy+16,64-cw,cy+6);
  ink(g,radial(g,64,cy-12,cw,shade(a.body,.35),a.body),shade(a.body,-.5),3);
  for(const [x,y,r] of [[-24,-6,7],[4,-18,9],[26,-4,6],[-6,2,5]]){ellipse(g,64+x*(1+sq),cy+y,r,r*.8);g.fillStyle='#fffaf0';g.fill();}
}
function chick(g:Ctx,a:MonsterArt,f:number,hurt:boolean,atk:boolean){
  const hop=[0,-4,0,-2][f],by=118+hop,peck=atk?8:0;
  for(const s of [-1,1]){g.beginPath();g.moveTo(64+s*10,by-6);g.lineTo(64+s*10,by+4);g.lineTo(64+s*16,by+6);g.strokeStyle='#e8892a';g.lineWidth=4;g.stroke();}
  ellipse(g,64,by-34,38,36);ink(g,radial(g,64,by-34,40,'#fff6c0',a.body),shade(a.body,-.5),3);
  for(const s of [-1,1]){ellipse(g,64+s*36,by-30,12,18,s*.6+(f%2)*s*.3);ink(g,shade(a.body,-.08),shade(a.body,-.5),2.5);}
  for(const [x,r] of [[-6,8],[4,10],[13,7]]){ellipse(g,64+x,by-72,r*.7,r);ink(g,'#ff5a4a',OUTLINE,2);}
  face(g,64,by-42,5.5,hurt,'smile');
  g.beginPath();g.moveTo(64-7,by-30+peck*.3);g.lineTo(64+7,by-30+peck*.3);g.lineTo(64,by-20+peck);g.closePath();ink(g,a.accent,OUTLINE,2);
}
function wolf(g:Ctx,a:MonsterArt,f:number,hurt:boolean,atk:boolean){
  const step=[0,4,0,-4][f],lunge=atk?10:0;
  ellipse(g,46,98,8,6,-.8);g.beginPath();g.moveTo(36,96);g.quadraticCurveTo(14,80,22,70);g.quadraticCurveTo(30,86,44,92);ink(g,a.body,shade(a.body,-.5),2.5);
  for(const [x,o] of [[44,step],[58,-step],[72,step],[84,-step]]){rr(g,x-5+o*.5,100,10,20,5);ink(g,shade(a.body,-.1),shade(a.body,-.5),2);}
  ellipse(g,62+lunge*.3,94,30,20);ink(g,radial(g,62,90,32,shade(a.body,.35),a.body),shade(a.body,-.5),2.5);
  ellipse(g,62,100,18,9);g.fillStyle=a.accent;g.fill();
  const hx=88+lunge,hy=70;
  for(const s of [-1,1]){g.beginPath();g.moveTo(hx+s*14,hy-14);g.lineTo(hx+s*18,hy-38);g.lineTo(hx+s*4,hy-20);g.closePath();ink(g,a.body,shade(a.body,-.5),2.5);
    g.beginPath();g.moveTo(hx+s*13,hy-18);g.lineTo(hx+s*16,hy-32);g.lineTo(hx+s*7,hy-21);g.closePath();g.fillStyle='#ffb3c8';g.fill();}
  ellipse(g,hx,hy,26,24);ink(g,radial(g,hx,hy,28,shade(a.body,.4),a.body),shade(a.body,-.5),2.5);
  ellipse(g,hx+4,hy+12,13,9);ink(g,a.accent,shade(a.body,-.4),2);ellipse(g,hx+4,hy+6,4,3);g.fillStyle=OUTLINE;g.fill();
  eye(g,hx-9,hy-4,5,'#2e2440',hurt);eye(g,hx+13,hy-4,5,'#2e2440',hurt);blush(g,hx-14,hy+8,4);
  if(atk){g.beginPath();g.moveTo(hx,hy+16);g.lineTo(hx+3,hy+21);g.lineTo(hx+6,hy+16);g.fillStyle='#fff';g.fill();}
}
function bee(g:Ctx,a:MonsterArt,f:number,hurt:boolean,atk:boolean){
  const hover=[0,-4,-6,-3][f],y=78+hover,flap=f%2;
  ellipse(g,64,124,18,5);g.fillStyle='rgba(0,0,0,.0)';g.fill();
  for(const s of [-1,1]){ellipse(g,64+s*20,y-26,16,flap?22:12,s*(flap?.5:.9));ink(g,'rgba(220,240,255,.75)','#7a9ab5',2);}
  ellipse(g,64,y,30,26);ink(g,radial(g,64,y,32,shade(a.body,.4),a.body),shade(a.body,-.55),3);
  for(const dx of [-10,6]){g.save();ellipse(g,64,y,30,26);g.clip();g.fillStyle=a.accent;g.fillRect(64+dx,y-30,8,60);g.restore();}
  g.beginPath();g.moveTo(88,y+8);g.lineTo(100+(atk?8:0),y+16);g.lineTo(86,y+16);g.closePath();ink(g,a.accent,OUTLINE,2);
  for(const s of [-1,1]){g.beginPath();g.moveTo(52+s*6,y-22);g.quadraticCurveTo(48+s*10,y-40,44+s*14,y-40);g.strokeStyle=OUTLINE;g.lineWidth=2.5;g.stroke();ellipse(g,44+s*14,y-40,3.5,3.5);g.fillStyle=OUTLINE;g.fill();}
  face(g,50,y-2,4.6,hurt,atk?'grr':'smile');
}
function sapling(g:Ctx,a:MonsterArt,f:number,hurt:boolean,atk:boolean){
  const sway=[0,2,0,-2][f],by=120;
  for(const s of [-1,1]){g.beginPath();g.moveTo(64+s*8,by-14);g.quadraticCurveTo(64+s*20,by-4,64+s*24+(f%2?s*2:0),by);g.strokeStyle=shade(a.accent,-.3);g.lineWidth=7;g.stroke();}
  rr(g,46,by-58,36,52,14);ink(g,linear(g,46,0,82,0,[[0,shade(a.accent,.15)],[1,shade(a.accent,-.2)]]),shade(a.accent,-.55),2.5);
  for(const s of [-1,1]){g.beginPath();g.moveTo(64+s*16,by-40);g.quadraticCurveTo(64+s*34,by-50-(atk?16:0),64+s*40,by-62-(atk?12:0));g.strokeStyle=shade(a.accent,-.4);g.lineWidth=6;g.stroke();
    ellipse(g,64+s*42,by-66-(atk?12:0),8,6);ink(g,a.body,shade(a.body,-.5),2);}
  face(g,64,by-36,4.8,hurt,atk?'grr':'smile');
  for(const [x,y,r] of [[-18,-74,20],[16,-76,22],[0,-92,24],[-26,-90,14],[26,-94,15]]){ellipse(g,64+x+sway,by+y,r,r*.9);ink(g,radial(g,64+x,by+y,r,shade(a.body,.35),a.body),shade(a.body,-.5),2.5);}
  ellipse(g,58+sway,by-98,8,5,-.4);g.fillStyle='rgba(255,255,255,.35)';g.fill();
}
function bat(g:Ctx,a:MonsterArt,f:number,hurt:boolean,atk:boolean){
  const y=74+[0,-5,-8,-4][f],up=f%2===0;
  for(const s of [-1,1]){g.beginPath();g.moveTo(64+s*18,y-4);
    if(up){g.quadraticCurveTo(64+s*40,y-40,64+s*60,y-30);g.quadraticCurveTo(64+s*50,y-16,64+s*56,y-4);g.quadraticCurveTo(64+s*40,y-8,64+s*36,y+6);}
    else{g.quadraticCurveTo(64+s*44,y-6,64+s*58,y+18);g.quadraticCurveTo(64+s*44,y+16,64+s*40,y+26);g.quadraticCurveTo(64+s*30,y+14,64+s*20,y+10);}
    g.closePath();ink(g,linear(g,0,y-30,0,y+20,[[0,shade(a.body,.2)],[1,shade(a.body,-.25)]]),shade(a.body,-.6),2.5);}
  for(const s of [-1,1]){g.beginPath();g.moveTo(64+s*8,y-20);g.lineTo(64+s*18,y-40);g.lineTo(64+s*20,y-16);ink(g,a.body,shade(a.body,-.6),2.5);}
  ellipse(g,64,y,24,22);ink(g,radial(g,64,y,26,a.accent,a.body),shade(a.body,-.6),2.5);
  face(g,64,y-2,4.6,hurt,atk?'open':'smile');
  for(const s of [-1,1]){g.beginPath();g.moveTo(64+s*4,y+10);g.lineTo(64+s*6,y+16);g.lineTo(64+s*8,y+10);g.fillStyle='#fff';g.fill();}
}
function bunny(g:Ctx,a:MonsterArt,f:number,hurt:boolean,atk:boolean){
  const hop=[0,-8,-10,-3][f],by=118+hop;
  for(const s of [-1,1]){ellipse(g,64+s*12,by-62,9,26,s*.15+(atk?s*.2:0));ink(g,a.body,'#9aa8c0',2.5);ellipse(g,64+s*12,by-60,4.5,18,s*.15);g.fillStyle=a.accent;g.fill();}
  ellipse(g,64,by-24,36,30);ink(g,radial(g,64,by-30,38,'#ffffff',shade(a.body,-.04)),'#9aa8c0',3);
  ellipse(g,30,by-14,9,9);ink(g,'#ffffff','#9aa8c0',2);
  for(const s of [-1,1]){ellipse(g,64+s*16,by+2,10,6);ink(g,'#ffffff','#9aa8c0',2);}
  face(g,64,by-30,5,hurt,atk?'open':'smile');
  ellipse(g,64,by-22,3,2.4);g.fillStyle='#ff8aa8';g.fill();
}
function golem(g:Ctx,a:MonsterArt,f:number,hurt:boolean,atk:boolean){
  const by=122,sway=[0,1,0,-1][f],slam=atk?(f===0?-18:10):0;
  for(const s of [-1,1]){rr(g,64+s*16-10,by-24,20,24,6);ink(g,shade(a.body,-.15),shade(a.body,-.6),2.5);}
  rr(g,30+sway,by-80,68,62,18);ink(g,linear(g,0,by-80,0,by-18,[[0,shade(a.body,.25)],[1,shade(a.body,-.2)]]),shade(a.body,-.6),3);
  for(const [x,y,r] of [[-18,-60,6],[14,-40,8],[20,-68,5]]){ellipse(g,64+x+sway,by+y,r,r*.7);g.fillStyle=shade(a.body,-.2);g.fill();}
  for(const s of [-1,1]){rr(g,64+s*40-12,by-74+(s>0?slam:0),24,46,10);ink(g,shade(a.body,.05),shade(a.body,-.6),2.5);}
  rr(g,40+sway,by-108,48,36,14);ink(g,linear(g,0,by-108,0,by-72,[[0,shade(a.body,.3)],[1,shade(a.body,-.05)]]),shade(a.body,-.6),3);
  for(const s of [-1,1]){ellipse(g,64+s*10+sway,by-92,6,5);ink(g,hurt?'#888':a.accent,'#2a4a6a',2);ellipse(g,64+s*10+sway,by-93,2.5,2);g.fillStyle='#fff';g.fill();}
  g.beginPath();g.moveTo(52+sway,by-58);g.lineTo(64+sway,by-66);g.lineTo(76+sway,by-58);g.lineTo(64+sway,by-50);g.closePath();ink(g,radial(g,64,by-58,12,'#ffffff',a.accent),'#2a4a6a',2);
}
function wisp(g:Ctx,a:MonsterArt,f:number,hurt:boolean,atk:boolean){
  const y=70+[0,-4,-6,-3][f];
  const halo=g.createRadialGradient(64,y,4,64,y,46);halo.addColorStop(0,a.accent);halo.addColorStop(.45,a.body);halo.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=halo;g.fillRect(10,y-50,108,100);
  g.beginPath();g.moveTo(44,y+8);g.quadraticCurveTo(64,y+56+(f%2)*4,84,y+8);ink(g,radial(g,64,y+20,30,a.accent,a.body),shade(a.body,-.45),2.5);
  ellipse(g,64,y,24,23);ink(g,radial(g,64,y,26,'#ffffff',a.body),shade(a.body,-.45),2.5);
  for(const s of [-1,1]){ellipse(g,64+s*28,y-8,12,6,s*.5+(f%2)*s*.3);g.fillStyle='rgba(255,255,255,.75)';g.fill();}
  face(g,64,y,4.6,hurt,atk?'open':'smile');
}
function fox(g:Ctx,a:MonsterArt,f:number,hurt:boolean,atk:boolean){
  const step=[0,4,0,-4][f],lunge=atk?10:0;
  g.beginPath();g.ellipse(30,82,24,14,-.6,0,Math.PI*2);ink(g,a.body,shade(a.body,-.5),2.5);ellipse(g,16,70,10,8,-.6);g.fillStyle=a.accent;g.fill();
  for(const [x,o] of [[46,step],[58,-step],[72,step],[82,-step]]){rr(g,x-4+o*.5,100,8,18,4);ink(g,shade(a.body,-.1),shade(a.body,-.5),2);}
  ellipse(g,62+lunge*.3,96,26,17);ink(g,radial(g,62,92,28,shade(a.body,.35),a.body),shade(a.body,-.5),2.5);
  const hx=88+lunge,hy=72;
  for(const s of [-1,1]){g.beginPath();g.moveTo(hx+s*16,hy-12);g.lineTo(hx+s*14,hy-40);g.lineTo(hx+s*2,hy-18);g.closePath();ink(g,a.body,shade(a.body,-.5),2.5);}
  ellipse(g,hx,hy,22,20);ink(g,radial(g,hx,hy,24,shade(a.body,.4),a.body),shade(a.body,-.5),2.5);
  g.beginPath();g.moveTo(hx-6,hy+6);g.lineTo(hx+24,hy+10);g.lineTo(hx-4,hy+18);g.closePath();ink(g,a.accent,shade(a.body,-.4),2);
  eye(g,hx-8,hy-3,4.5,'#2e2440',hurt);eye(g,hx+10,hy-3,4.5,'#2e2440',hurt);blush(g,hx-12,hy+8,4);
}
function crown(g:Ctx,kind:string){
  const y=kind==='jelly'?32:kind==='sapling'?12:kind==='golem'?6:24;
  g.beginPath();g.moveTo(46,y+16);g.lineTo(44,y);g.lineTo(54,y+8);g.lineTo(64,y-6);g.lineTo(74,y+8);g.lineTo(84,y);g.lineTo(82,y+16);g.closePath();
  ink(g,linear(g,0,y-6,0,y+16,[[0,'#fff3a8'],[1,'#e0a42a']]),'#7a5210',2.2);
  for(const x of [52,64,76]){ellipse(g,x,y+10,2.6,2.6);g.fillStyle=x===64?'#e8524a':'#4b7fe0';g.fill();}
}
