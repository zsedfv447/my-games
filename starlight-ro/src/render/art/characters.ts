// Procedural chibi characters (original designs). Each look renders to one sprite sheet:
// rows = views S, SE, E, NE, N; columns = pose frames. Frames are 128×192 and drawn at 2× scale.
import { canvas, shade, ink, ellipse, rr, eye, blush, OUTLINE, radial, linear } from './util';
import type { View } from '../iso';

export const CW=192, CH=192;
export type Pose='idle'|'walk'|'attack'|'cast'|'sit'|'dead';
export const POSES:{pose:Pose;frames:number}[]=[{pose:'idle',frames:2},{pose:'walk',frames:8},{pose:'attack',frames:3},{pose:'cast',frames:2},{pose:'sit',frames:1},{pose:'dead',frames:1}];
export const VIEWS:View[]=['S','SE','E','NE','N'];
export const frameIndex=(pose:Pose,f:number)=>{let i=0;for(const p of POSES){if(p.pose===pose)return i+Math.min(f,p.frames-1);i+=p.frames;}return 0;};
export const FRAME_COUNT=POSES.reduce((a,p)=>a+p.frames,0);

export type Look = {
  outfit:'novice'|'swordman'|'mage'|'archer'|'npc'; hair:number; hairColor:string; skin?:string;
  cloth?:string; hat?:string; weaponStyle?:string;refine?:number;headgear?:string;armorStyle?:string; weapon:'dagger'|'sword'|'staff'|'bow'|null;
};
const SKIN='#ffe2cc';
type Ctx=CanvasRenderingContext2D;

const palettes={
  novice:{body:'#d8b07a',trim:'#f4e3c2',pants:'#7a5a3e',boots:'#6b4630'},
  swordman:{body:'#c8443e',trim:'#e7edf3',pants:'#4a3a46',boots:'#4a3830'},
  mage:{body:'#6b4fc4',trim:'#f2cf63',pants:'#4b3a8a',boots:'#3b2f5a'},
  archer:{body:'#4f9a5a',trim:'#a9744c',pants:'#5a4a36',boots:'#6b4630'},
  npc:{body:'#5aa0e0',trim:'#ffffff',pants:'#4a4a5a',boots:'#4a3830'},
};

export function drawCharacterSheet(look:Look):HTMLCanvasElement {
  const [c,g]=canvas(CW*FRAME_COUNT,CH*VIEWS.length);
  VIEWS.forEach((view,row)=>{
    let col=0;
    for(const {pose,frames} of POSES)for(let f=0;f<frames;f++){
      g.save();g.translate(col*CW,row*CH);g.beginPath();g.rect(0,0,CW,CH);g.clip();drawCharacter(g,look,view,pose,f);g.restore();col++;
    }
  });
  return c;
}

export function drawCharacter(g:Ctx,look:Look,view:View,pose:Pose,f:number){
  g.save();g.translate((CW-128)/2,0);
  if(pose==='dead'){g.save();g.translate(64,166);g.rotate(-Math.PI/2);g.scale(.72,.72);g.translate(-64,-117);drawFigure(g,look,'S','idle',0,true);g.restore();g.restore();return;}
  drawFigure(g,look,view,pose,f,false);g.restore();
}

function drawFigure(g:Ctx,look:Look,view:View,pose:Pose,f:number,dead:boolean){
  const pal={...palettes[look.outfit]};if(look.cloth)pal.body=look.cloth;
  if(look.armorStyle==='chainMail')pal.body='#768ba0';else if(look.armorStyle==='mageRobe')pal.body='#54789c';else if(look.armorStyle==='adventureSuit')pal.trim='#80bca1';
  const skin=look.skin??SKIN;
  const back=view==='N'||view==='NE',side=view==='E'?1:view==='SE'||view==='NE'?.5:0;
  const bob=pose==='walk'?[0,-1.6,-2.4,-1.6,0,-1.6,-2.4,-1.6][f]:pose==='idle'?(f?1.5:0):pose==='attack'?[0,1,2][f]:0;
  const sit=pose==='sit'?22:0;
  const cx=64,feet=184;
  const torsoTop=120+bob+sit,torsoBot=160+bob+sit;
  const headY=86+bob+sit;
  // —— legs ——
  if(pose==='sit'){
    for(const s of [-1,1]){ellipse(g,cx+s*12+side*6,feet-8,13,8);ink(g,pal.pants);ellipse(g,cx+s*14+side*14,feet-6,8,6);ink(g,pal.boots);}
  }else if(!dead||true){
    const stride=pose==='walk'?[0,5,8,5,0,-5,-8,-5][f]:0,lift=pose==='walk'?[0,2.4,4,2.4,0,0,0,0][f]:0;
    for(const s of [-1,1]){
      const lx=side>.9?cx+s*stride-2:cx+s*(9-side*3)+(side*s*stride*.6),ly=feet-(s===1?lift:pose==='walk'?[0,2.4,4,2.4,0,0,0,0][(f+4)%8]:0);
      const fx=side>.9?cx-s*stride-2:lx;
      const x=side>.9&&s===1?fx:lx;
      rr(g,x-7,torsoBot-6,14,ly-torsoBot+2,6);ink(g,pal.pants);
      ellipse(g,x+(side*3),ly-3,9,6);ink(g,pal.boots);
    }
  }
  // —— back items (cape / quiver / long hair) drawn behind body for front views ——
  if(look.outfit==='archer'&&!back)drawQuiver(g,cx+14-side*24,torsoTop-6,false);
  if(!back)drawBackHair(g,look,cx,headY,side);
  // —— body ——
  const tw=side>.9?30:40-side*6;
  if(look.outfit==='mage'){
    g.beginPath();g.moveTo(cx-tw/2,torsoTop+4);g.lineTo(cx+tw/2,torsoTop+4);g.lineTo(cx+tw/2+8,torsoBot+14-sit*.5);g.lineTo(cx-tw/2-8,torsoBot+14-sit*.5);g.closePath();
    ink(g,linear(g,0,torsoTop,0,torsoBot+14,[[0,shade(pal.body,.15)],[1,shade(pal.body,-.15)]]));
    g.beginPath();g.moveTo(cx-tw/2-8,torsoBot+12-sit*.5);g.lineTo(cx+tw/2+8,torsoBot+12-sit*.5);g.strokeStyle=pal.trim;g.lineWidth=4;g.stroke();
    if(!back){g.beginPath();g.moveTo(cx,torsoTop+6);g.lineTo(cx,torsoBot+12-sit*.5);g.strokeStyle=pal.trim;g.lineWidth=3;g.stroke();}
  }else{
    rr(g,cx-tw/2,torsoTop,tw,torsoBot-torsoTop+4,12);ink(g,linear(g,0,torsoTop,0,torsoBot,[[0,shade(pal.body,.12)],[1,shade(pal.body,-.12)]]));
    if(look.outfit==='swordman'&&!back){rr(g,cx-tw/2+5,torsoTop+4,tw-10,22,8);ink(g,linear(g,0,torsoTop,0,torsoTop+26,[[0,'#ffffff'],[1,'#b9c4cf']]),'#55606b',2);}
    if(look.outfit==='archer'){rr(g,cx-tw/2+3,torsoTop+3,tw-6,24,8);ink(g,pal.trim);}
    rr(g,cx-tw/2,torsoBot-10,tw,6,3);ink(g,look.outfit==='swordman'?'#6b4630':'#5a3e2a',OUTLINE,1.6);
    if(look.outfit==='novice'&&!back){g.beginPath();g.moveTo(cx-9,torsoTop+1);g.lineTo(cx,torsoTop+12);g.lineTo(cx+9,torsoTop+1);ink(g,pal.trim,OUTLINE,1.6);}
  }
  if(look.outfit==='swordman'){for(const s of side>.9?[1]:[-1,1]){ellipse(g,cx+s*(tw/2-2)-side*4,torsoTop+4,11,8);ink(g,'#d6dde6','#55606b',2);}}
  // —— arms & weapon ——
  const arm=armPose(pose,f,look.weapon);
  const shoulderY=torsoTop+10;
  const drawArm=(s:number,front:boolean)=>{
    const a=s<0?arm.l:arm.r;
    const sx=cx+s*(tw/2-1)-(side>.9?6:0),hx=sx+Math.cos(a)*22*(side>.9&&s<0?.6:1),hy=shoulderY+Math.sin(a)*22;
    g.beginPath();g.moveTo(sx,shoulderY);g.lineTo(hx,hy);g.strokeStyle=OUTLINE;g.lineWidth=13;g.stroke();
    g.strokeStyle=look.outfit==='mage'?pal.body:shade(pal.body,-.05);g.lineWidth=9;g.stroke();
    ellipse(g,hx,hy,5.5,5.5);ink(g,skin,OUTLINE,2);
    if(front&&s===1&&look.weapon)drawWeapon(g,look.weapon,hx,hy,arm.w,pose,f,look);
    return {hx,hy};
  };
  const mirror=(n:number)=>side>.9?-1:n; // side view: the far arm is the left one
  if(back){drawArm(1,true);drawArm(-1,false);}
  else{drawArm(mirror(-1),false);}
  // —— head ——
  ellipse(g,cx+side*2,headY,34,32);ink(g,radial(g,cx+side*2,headY,36,'#fff4ea',skin));
  if(!back)drawFace(g,cx,headY,side,pose,dead);
  drawHair(g,look,cx,headY,side,back);
  drawHat(g,look,cx,headY,side,back);
  if(back&&look.outfit==='archer')drawQuiver(g,cx-6,torsoTop-8,true);
  if(!back)drawArm(1,true);
  if(pose==='cast'){
    for(let i=0;i<5;i++){const a=f*.6+i/5*Math.PI*2,r=26+f*4;ellipse(g,cx+Math.cos(a)*r,torsoTop+4+Math.sin(a)*r*.45,2.5,2.5);g.fillStyle=f?'#fff6b0':'#cfe7ff';g.fill();}
  }
}
function armPose(pose:Pose,f:number,weapon:Look['weapon']):{l:number;r:number;w:number}{
  const down=Math.PI/2;
  if(pose==='walk')return {l:down+[0,.25,.38,.25,0,-.25,-.38,-.25][f],r:down-[0,.25,.38,.25,0,-.25,-.38,-.25][f],w:-.6};
  if(pose==='cast')return {l:down+.9+f*.1,r:down-1.25-f*.1,w:-1.6};
  if(pose==='sit')return {l:down+.15,r:down-.2,w:-.3};
  if(pose==='attack'){
    if(weapon==='bow')return [{l:down-1.3,r:down-1.45,w:0},{l:down-1.4,r:down-1.5,w:0},{l:down-1.3,r:down-1.2,w:0}][f];
    if(weapon==='staff')return [{l:down+.2,r:down-2.2,w:-2.4},{l:down+.1,r:down-1.2,w:-1},{l:down+.2,r:down-.9,w:-.6}][f];
    return [{l:down+.3,r:down-2.6,w:-2.8},{l:down+.1,r:down-.9,w:-.2},{l:down+.2,r:down+.2,w:.9}][f];
  }
  return {l:down+.12,r:down-.12,w:-.5};
}
function drawWeapon(g:Ctx,w:NonNullable<Look['weapon']>,x:number,y:number,ang:number,pose:Pose,f:number,look:Look){
  g.save();g.translate(x,y);
  const glow=(look.refine??0)>=4,accent=(look.refine??0)>=6?'#ffe1a0':'#a4eff2';
  if(glow){g.shadowBlur=6+(look.refine??0);g.shadowColor=accent;}
  if(w==='bow'){
    g.rotate(0);const draw=pose==='attack'&&f===0?10:0;
    g.beginPath();g.arc(-4,0,26,-1.2,1.2);g.strokeStyle=OUTLINE;g.lineWidth=7;g.stroke();g.strokeStyle=look.weaponStyle==='compositeBow'?'#4c8176':'#a9744c';g.lineWidth=4;g.stroke();
    g.beginPath();g.moveTo(-4+26*Math.cos(-1.2),26*Math.sin(-1.2));g.lineTo(-4-draw,0);g.lineTo(-4+26*Math.cos(1.2),26*Math.sin(1.2));g.strokeStyle='#f4f0e0';g.lineWidth=1.5;g.stroke();
    if(pose==='attack'&&f<2){g.beginPath();g.moveTo(-4-draw,0);g.lineTo(30,0);g.strokeStyle='#7f5634';g.lineWidth=2.5;g.stroke();g.beginPath();g.moveTo(30,0);g.lineTo(24,-4);g.lineTo(24,4);g.closePath();g.fillStyle='#d6dde6';g.fill();}
    g.restore();return;
  }
  g.rotate(ang);
  if(w==='staff'){
    g.beginPath();g.moveTo(-14,0);g.lineTo(46,0);g.strokeStyle=OUTLINE;g.lineWidth=7;g.stroke();g.strokeStyle='#a8734a';g.lineWidth=4;g.stroke();
    ellipse(g,50,0,7,7);ink(g,radial(g,50,0,8,'#ffffff',look.weaponStyle==='woodStaff'?'#b9f28a':'#7fc8ff'),'#2d4d7a',2);
  }else{
    const len=w==='sword'?52:30;
    g.beginPath();g.moveTo(4,0);g.lineTo(len,-3);g.lineTo(len+7,0);g.lineTo(len,3);g.closePath();ink(g,linear(g,0,-4,0,4,[[0,'#ffffff'],[1,look.weaponStyle==='dawnSword'?'#e2bc69':'#aab6c2']]),'#4a5560',2);
    rr(g,-2,-7,6,14,2);ink(g,'#d9a441',OUTLINE,1.6);rr(g,-12,-3,11,6,2);ink(g,'#6b4630',OUTLINE,1.6);
  }
  g.restore();
}
function drawFace(g:Ctx,cx:number,hy:number,side:number,pose:Pose,dead:boolean){
  const fx=cx+side*16;
  if(side>.9){eye(g,fx+8,hy+8,6.5,'#3a2a4a',dead);blush(g,fx+6,hy+18,5);g.beginPath();g.arc(fx+16,hy+20,3,0,Math.PI);g.strokeStyle=OUTLINE;g.lineWidth=1.8;g.stroke();return;}
  const sep=13-side*3;
  g.save();
  for(const s of [-1,1]){g.save();const ex=fx+s*sep;g.translate(ex,hy+8);g.scale(s<0&&side>0?.8:1,1);eye(g,0,0,7,'#3a2a4a',dead||pose==='sit'&&false);g.restore();}
  blush(g,fx-sep-3,hy+19,5.5);blush(g,fx+sep+3,hy+19,5.5);
  g.beginPath();
  if(pose==='attack'||pose==='cast'){ellipse(g,fx,hy+21,3.5,3);g.fillStyle='#b34a4a';g.fill();}
  else{g.arc(fx,hy+18,3.5,.2,Math.PI-.2);g.strokeStyle=OUTLINE;g.lineWidth=1.8;g.stroke();}
  g.restore();
}
function drawBackHair(g:Ctx,look:Look,cx:number,hy:number,side:number){
  const c=look.hairColor;
  if(look.hair===1){rr(g,cx-30+side*4,hy-6,60-side*14,70,22);ink(g,linear(g,0,hy,0,hy+70,[[0,shade(c,.05)],[1,shade(c,-.2)]]));}
  if(look.hair===2){for(const s of side>.9?[-1]:[-1,1]){ellipse(g,cx+s*38-side*20,hy+26,11,26,s*.25);ink(g,c);}}
}
function drawHair(g:Ctx,look:Look,cx:number,hy:number,side:number,back:boolean){
  const c=look.hairColor,hi=shade(c,.3),grad=linear(g,0,hy-36,0,hy+10,[[0,hi],[1,shade(c,-.1)]]);
  // Cap covering the crown.
  g.beginPath();
  if(back){ellipse(g,cx,hy-2,36,34);ink(g,grad);
    for(let i=-2;i<=2;i++){g.beginPath();g.moveTo(cx+i*9,hy-30+Math.abs(i)*3);g.quadraticCurveTo(cx+i*12,hy+4,cx+i*10,hy+28);g.strokeStyle=shade(c,-.28);g.lineWidth=1.6;g.stroke();}
    if(look.hair===1){rr(g,cx-32,hy,64,64,22);ink(g,shade(c,-.05));}
    if(look.hair===2){for(const s of [-1,1]){ellipse(g,cx+s*38,hy+26,11,26,s*.25);ink(g,c);}}
    if(look.hair===3){rr(g,cx-36,hy-6,72,38,16);ink(g,c);}
    return;}
  g.beginPath();g.ellipse(cx+side*2,hy-6,37,30,0,Math.PI*1.02,Math.PI*1.98);g.lineTo(cx+36+side*2,hy+4);
  // Bangs: a zig-zag fringe that shifts with the view.
  const fx=cx+side*10;
  const tips=look.hair===0?[[-34,4],[-24,-6],[-16,8],[-6,-4],[4,10],[14,-4],[24,6],[34,0]]:look.hair===3?[[-36,22],[-26,4],[-12,10],[0,2],[12,10],[26,4],[36,22]]:[[-34,10],[-22,-2],[-10,10],[0,0],[10,10],[22,-2],[34,10]];
  for(let i=tips.length-1;i>=0;i--)g.lineTo(fx+tips[i][0]*(1-side*.25),hy+tips[i][1]-4);
  g.closePath();ink(g,grad);
  if(look.hair===3&&side<.9){for(const s of [-1,1]){rr(g,cx+s*30-7,hy-4,14,34,7);ink(g,c);}}
  if(look.hair===2){for(const s of side>.9?[1]:[-1,1]){ellipse(g,cx+s*30,hy-20,7,7);ink(g,'#ff7aa8');}}
  // Shine.
  g.beginPath();g.ellipse(cx-10+side*6,hy-24,12,4,-.3,0,Math.PI*2);g.fillStyle='rgba(255,255,255,.35)';g.fill();
}
function drawHat(g:Ctx,look:Look,cx:number,hy:number,side:number,back:boolean){
  if(look.headgear==='jellyCrown'){g.beginPath();g.moveTo(cx-30,hy-24);g.lineTo(cx-34,hy-46);g.lineTo(cx-14,hy-35);g.lineTo(cx,hy-57);g.lineTo(cx+14,hy-35);g.lineTo(cx+34,hy-46);g.lineTo(cx+30,hy-24);g.closePath();ink(g,'#f3d374','#8b6a31',2);ellipse(g,cx,hy-33,4,5);ink(g,'#71c8bf','#8b6a31',1.2);return;}
  if(look.headgear==='ironHelm'){g.beginPath();g.ellipse(cx,hy-12,36,33,0,Math.PI,Math.PI*2);g.lineTo(cx+35,hy+4);g.lineTo(cx+25,hy+6);g.lineTo(cx+22,hy-15);g.lineTo(cx-22,hy-15);g.lineTo(cx-25,hy+6);g.lineTo(cx-35,hy+4);g.closePath();ink(g,linear(g,cx-30,0,cx+30,0,[[0,'#dbe6e9'],[1,'#7f9baf']]),'#526979',2);return;}
  if(look.headgear==='cap'){g.beginPath();g.ellipse(cx,hy-24,35,18,0,Math.PI,Math.PI*2);g.lineTo(cx+35,hy-24);g.closePath();ink(g,'#8cbca1','#456b58',2);rr(g,cx-37,hy-26,74,8,4);ink(g,'#d9d5a5','#456b58',1.5);return;}
  if(look.outfit==='mage'){
    const c='#5a3fae';
    g.beginPath();g.moveTo(cx-40,hy-20);g.quadraticCurveTo(cx,hy-34,cx+40,hy-20);g.quadraticCurveTo(cx,hy-10,cx-40,hy-20);ink(g,shade(c,-.1));
    g.beginPath();g.moveTo(cx-24+side*4,hy-24);g.quadraticCurveTo(cx-6,hy-62,cx+18+side*14,hy-82);g.quadraticCurveTo(cx+12,hy-52,cx+26+side*4,hy-24);g.closePath();ink(g,linear(g,0,hy-80,0,hy-20,[[0,shade(c,.2)],[1,c]]));
    g.beginPath();g.moveTo(cx-24+side*4,hy-26);g.quadraticCurveTo(cx,hy-32,cx+26+side*4,hy-26);g.strokeStyle='#f2cf63';g.lineWidth=5;g.stroke();
    if(!back){ellipse(g,cx+18+side*14,hy-82,4,4);ink(g,'#f2cf63',OUTLINE,1.5);}
    return;
  }
  if(look.outfit==='archer'&&!back){g.beginPath();g.moveTo(cx+18,hy-26);g.quadraticCurveTo(cx+40,hy-50,cx+50,hy-44);g.quadraticCurveTo(cx+34,hy-34,cx+22,hy-22);ink(g,'#f4f0e0',OUTLINE,1.8);}
  if(look.outfit==='swordman'&&!back){rr(g,cx-30+side*6,hy-20,60-side*10,7,3);ink(g,'#c8443e',OUTLINE,1.6);}
  if(look.hat){
    g.beginPath();g.ellipse(cx,hy-24,34,9,0,0,Math.PI*2);ink(g,shade(look.hat,-.1));
    g.beginPath();g.ellipse(cx,hy-30,22,16,0,Math.PI,0);ink(g,look.hat);
  }
}
function drawQuiver(g:Ctx,x:number,y:number,front:boolean){
  g.save();g.translate(x,y);g.rotate(.35);rr(g,-7,0,14,40,5);ink(g,'#8b5a36');
  for(let i=0;i<3;i++){g.beginPath();g.moveTo(-4+i*4,0);g.lineTo(-4+i*4,-10);g.strokeStyle='#f4f0e0';g.lineWidth=3;g.stroke();}
  g.restore();void front;
}
