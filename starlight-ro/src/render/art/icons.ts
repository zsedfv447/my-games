// Small UI icons for items, skills and cards, painted once and cached as data URLs.
import { canvas, shade, ink, ellipse, rr, OUTLINE, radial, linear } from './util';
import type { Icon } from '../../data/items';
import { cards, items } from '../../data/items';
import { monsters } from '../../data/monsters';
import { skills } from '../../data/jobs';
import { drawMonsterSheet, monsterSize } from './monsters';

type Ctx=CanvasRenderingContext2D;
const cache=new Map<string,string>();
const SZ=48;
function make(key:string,paint:(g:Ctx)=>void,w=SZ,h=SZ){
  const hit=cache.get(key);if(hit)return hit;
  const [c,g]=canvas(w,h);paint(g);const url=c.toDataURL();cache.set(key,url);return url;
}
export function itemIcon(id:string):string{const d=items[id];return d?make(`i:${id}`,g=>paintItem(g,d.icon)):'';}
export function cardIcon(defId:string):string{
  return make(`c:${defId}`,g=>{
    rr(g,8,3,32,42,4);ink(g,linear(g,0,3,0,45,[[0,'#fff8e8'],[1,'#e9d8a8']]),'#7a5a2a',2);
    rr(g,12,7,24,22,2);g.fillStyle='#cfe7ff';g.fill();
    const m=monsters[cards[defId].monster];const sheet=drawMonsterSheet({...m.art,scale:1,crown:m.art.crown});
    const S=monsterSize({...m.art,scale:1});g.drawImage(sheet,0,0,S,S,10,5,28,28);
    for(let i=0;i<3;i++){rr(g,13,32+i*4,22,2,1);g.fillStyle='#b9a37a';g.fill();}
  });
}
/** Small portrait of a monster (used for pets). */
export function monsterIcon(id:string):string{
  return make(`m:${id}`,g=>{const m=monsters[id];if(!m)return;const art={...m.art,scale:1,crown:false};const sheet=drawMonsterSheet(art);const S=monsterSize(art);g.drawImage(sheet,0,0,S,S,0,0,48,48);});
}
export function skillIcon(id:string):string{return make(`s:${id}`,g=>paintSkill(g,id));}
/** 2× canvases for loot lying on the ground. */
export function itemIconCanvas(id:string):HTMLCanvasElement{const [c,g]=canvas(96,96);g.scale(2,2);if(items[id])paintItem(g,items[id].icon);return c;}
export function cardIconCanvas():HTMLCanvasElement{
  const [c,g]=canvas(96,96);g.scale(2,2);
  rr(g,12,6,24,34,3);ink(g,linear(g,0,6,0,40,[[0,'#fff3c4'],[1,'#e0a42a']]),'#7a5210',2);
  g.save();g.translate(24,23);g.beginPath();for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,r=i%2?4:9;g.lineTo(Math.cos(a)*r,Math.sin(a)*r);}g.closePath();g.fillStyle='#ffffff';g.fill();g.restore();
  return c;
}

function paintItem(g:Ctx,ic:Icon){
  const c=ic.color,a=ic.accent??shade(c,-.3);
  g.save();g.translate(24,24);
  switch(ic.shape){
    case 'potion':
      rr(g,-5,-17,10,7,2);ink(g,'#c9a46b');
      g.beginPath();g.moveTo(-5,-11);g.lineTo(-5,-6);g.bezierCurveTo(-15,-2,-15,16,0,16);g.bezierCurveTo(15,16,15,-2,5,-6);g.lineTo(5,-11);g.closePath();
      ink(g,radial(g,0,4,14,shade(c,.45),c));ellipse(g,-5,2,3,5,-.3);g.fillStyle='rgba(255,255,255,.6)';g.fill();break;
    case 'apple':ellipse(g,0,3,13,12);ink(g,radial(g,0,3,14,shade(c,.4),c));g.beginPath();g.moveTo(0,-8);g.lineTo(2,-15);g.strokeStyle='#6b4630';g.lineWidth=2.5;g.stroke();ellipse(g,6,-12,5,2.5,-.5);ink(g,'#6fcf6f',OUTLINE,1.4);break;
    case 'dagger':case 'sword':{g.rotate(-Math.PI/4);const L=ic.shape==='sword'?20:13;
      g.beginPath();g.moveTo(-3,-2);g.lineTo(-3,-L);g.lineTo(0,-L-5);g.lineTo(3,-L);g.lineTo(3,-2);g.closePath();ink(g,linear(g,-3,0,3,0,[[0,'#ffffff'],[1,c]]),'#4a5560',1.8);
      rr(g,-8,-3,16,4,2);ink(g,ic.accent??'#d9a441',OUTLINE,1.5);rr(g,-2.5,1,5,10,2);ink(g,'#6b4630',OUTLINE,1.5);break;}
    case 'staff':g.rotate(-Math.PI/4);rr(g,-2,-16,4,34,2);ink(g,c,OUTLINE,1.6);ellipse(g,0,-18,6,6);ink(g,radial(g,0,-18,6,'#ffffff',a));break;
    case 'bow':g.rotate(-Math.PI/4);g.beginPath();g.arc(-6,0,18,-1.2,1.2);g.strokeStyle=OUTLINE;g.lineWidth=6;g.stroke();g.strokeStyle=c;g.lineWidth=3.5;g.stroke();
      g.beginPath();g.moveTo(-6+18*Math.cos(-1.2),18*Math.sin(-1.2));g.lineTo(-6+18*Math.cos(1.2),18*Math.sin(1.2));g.strokeStyle='#f4f0e0';g.lineWidth=1.2;g.stroke();break;
    case 'hat':ellipse(g,0,8,18,6);ink(g,shade(c,-.1));g.beginPath();g.ellipse(0,6,11,12,0,Math.PI,0);ink(g,c);break;
    case 'helm':g.beginPath();g.ellipse(0,4,14,15,0,Math.PI,0);g.lineTo(14,12);g.lineTo(-14,12);g.closePath();ink(g,linear(g,0,-12,0,12,[[0,'#ffffff'],[1,c]]),'#4a5560');rr(g,-2,-12,4,22,2);g.fillStyle=shade(c,-.25);g.fill();break;
    case 'crown':g.beginPath();g.moveTo(-15,10);g.lineTo(-16,-8);g.lineTo(-7,0);g.lineTo(0,-12);g.lineTo(7,0);g.lineTo(16,-8);g.lineTo(15,10);g.closePath();ink(g,linear(g,0,-12,0,10,[[0,shade(c,.4)],[1,c]]));ellipse(g,0,3,3,3);g.fillStyle=a;g.fill();break;
    case 'armor':case 'robe':g.beginPath();g.moveTo(-14,-12);g.lineTo(-6,-15);g.lineTo(0,-10);g.lineTo(6,-15);g.lineTo(14,-12);g.lineTo(16,0);g.lineTo(10,0);g.lineTo(ic.shape==='robe'?14:10,16);g.lineTo(ic.shape==='robe'?-14:-10,16);g.lineTo(-10,0);g.lineTo(-16,0);g.closePath();
      ink(g,linear(g,0,-15,0,16,[[0,shade(c,.2)],[1,shade(c,-.15)]]));if(ic.accent){g.beginPath();g.moveTo(0,-10);g.lineTo(0,16);g.strokeStyle=ic.accent;g.lineWidth=2.5;g.stroke();}break;
    case 'cape':g.beginPath();g.moveTo(-8,-14);g.lineTo(8,-14);g.quadraticCurveTo(18,4,14,16);g.quadraticCurveTo(0,12,-14,16);g.quadraticCurveTo(-18,4,-8,-14);ink(g,linear(g,0,-14,0,16,[[0,shade(c,.2)],[1,shade(c,-.15)]]));ellipse(g,0,-13,4,3);ink(g,ic.accent??'#d9a441',OUTLINE,1.4);break;
    case 'shoes':for(const s of [-1,1]){g.beginPath();g.moveTo(s*2,-10);g.lineTo(s*2,6);g.quadraticCurveTo(s*2+s*14,6,s*2+s*14,12);g.lineTo(s*2,12);ink(g,c);}break;
    case 'ring':g.beginPath();g.arc(0,4,11,0,Math.PI*2);g.strokeStyle=OUTLINE;g.lineWidth=7;g.stroke();g.strokeStyle=c;g.lineWidth=4;g.stroke();ellipse(g,0,-8,6,5);ink(g,radial(g,0,-8,6,'#ffffff',a));break;
    case 'clip':rr(g,-14,-4,28,8,4);ink(g,c);ellipse(g,-8,0,5,5);ink(g,'#ffffff',OUTLINE,1.5);break;
    case 'goo':g.beginPath();g.moveTo(-14,10);g.bezierCurveTo(-14,-4,-6,-14,0,-14);g.bezierCurveTo(6,-14,14,-4,14,10);g.closePath();ink(g,radial(g,0,0,16,shade(c,.45),c),shade(c,-.5));ellipse(g,-5,-4,3,4,-.4);g.fillStyle='rgba(255,255,255,.65)';g.fill();break;
    case 'feather':g.rotate(.6);g.beginPath();g.moveTo(0,-18);g.quadraticCurveTo(12,-4,0,16);g.quadraticCurveTo(-12,-4,0,-18);ink(g,radial(g,0,0,16,'#ffffff',c));g.beginPath();g.moveTo(0,-14);g.lineTo(0,18);g.strokeStyle=shade(c,-.4);g.lineWidth=1.5;g.stroke();break;
    case 'leaf':g.rotate(-.5);g.beginPath();g.moveTo(0,-16);g.quadraticCurveTo(14,0,0,16);g.quadraticCurveTo(-14,0,0,-16);ink(g,radial(g,0,0,16,shade(c,.35),c));g.beginPath();g.moveTo(0,-12);g.lineTo(0,16);g.strokeStyle=shade(c,-.4);g.lineWidth=1.4;g.stroke();break;
    case 'fang':g.beginPath();g.moveTo(-8,-12);g.quadraticCurveTo(10,-10,6,14);g.quadraticCurveTo(-2,0,-8,-12);ink(g,radial(g,0,0,14,'#ffffff',c));break;
    case 'shard':g.beginPath();g.moveTo(0,-16);g.lineTo(10,-2);g.lineTo(4,16);g.lineTo(-8,8);g.lineTo(-8,-6);g.closePath();ink(g,linear(g,-8,0,10,0,[[0,'#ffffff'],[1,c]]),shade(c,-.5));break;
    case 'heart':g.beginPath();g.moveTo(0,14);g.bezierCurveTo(-18,0,-12,-16,0,-6);g.bezierCurveTo(12,-16,18,0,0,14);ink(g,radial(g,0,0,16,'#ffffff',c),shade(c,-.5));break;
    case 'silk':for(let i=0;i<3;i++){g.beginPath();g.arc(0,0,6+i*4,0,Math.PI*1.6);g.strokeStyle=c;g.lineWidth=3;g.stroke();}break;
    case 'cap':g.beginPath();g.ellipse(0,2,15,11,0,Math.PI,0);ink(g,c);for(const [x,y] of [[-6,-4],[5,-6]]){ellipse(g,x,y,2.4,2);g.fillStyle='#fff';g.fill();}rr(g,-4,2,8,10,3);ink(g,'#fff6e6');break;
    case 'bark':case 'chip':rr(g,-12,-10,24,20,4);ink(g,linear(g,0,-10,0,10,[[0,shade(c,.2)],[1,shade(c,-.2)]]));for(let i=0;i<3;i++){g.beginPath();g.moveTo(-8,-5+i*5);g.lineTo(8,-6+i*5);g.strokeStyle=shade(c,-.4);g.lineWidth=1.2;g.stroke();}break;
    case 'honey':rr(g,-11,-6,22,20,6);ink(g,radial(g,0,4,14,shade(c,.4),c));rr(g,-12,-12,24,7,3);ink(g,'#c9a46b');break;
    case 'stone':g.beginPath();g.moveTo(-12,8);g.lineTo(-10,-8);g.lineTo(4,-13);g.lineTo(13,-2);g.lineTo(8,11);g.closePath();ink(g,radial(g,0,0,16,shade(c,.35),c));ellipse(g,1,-1,4,4);g.fillStyle='#7fd3ff';g.fill();break;
    case 'stinger':g.beginPath();g.moveTo(-6,-12);g.lineTo(6,-12);g.lineTo(0,16);g.closePath();ink(g,linear(g,-6,0,6,0,[[0,'#6b5a50'],[1,c]]));break;
    case 'fur':ellipse(g,0,2,15,11);ink(g,radial(g,0,0,16,'#ffffff',c),'#9aa8c0');break;
    case 'card':rr(g,-11,-15,22,30,3);ink(g,'#fff8e8','#7a5a2a');break;
  }
  g.restore();
}

const jobTint:Record<string,string>={novice:'#c9a46b',swordman:'#d9534f',mage:'#7d5bd6',archer:'#3f9e5a',knight:'#e8a33a',wizard:'#5b7dd6',ranger:'#2fa08a'};
const elemTint:Record<string,string>={fire:'#ff7a3d',water:'#4b9fe0',wind:'#e8c33a',earth:'#a9744c'};
function paintSkill(g:Ctx,id:string){
  const sk=skills[id],base=sk.element!=='neutral'?elemTint[sk.element]:jobTint[sk.job];
  rr(g,2,2,44,44,9);ink(g,radial(g,24,22,30,shade(base,.45),shade(base,-.25)),shade(base,-.6),2);
  if(sk.target==='passive'){rr(g,4,4,40,40,8);g.strokeStyle='rgba(255,255,255,.35)';g.setLineDash([3,3]);g.lineWidth=1.5;g.stroke();g.setLineDash([]);}
  g.save();g.translate(24,24);g.strokeStyle='#fff';g.fillStyle='#fff';g.lineWidth=3;
  const W='#ffffff';
  const arrow=(x:number,y:number,a:number,l:number)=>{g.save();g.translate(x,y);g.rotate(a);g.beginPath();g.moveTo(-l/2,0);g.lineTo(l/2,0);g.strokeStyle=W;g.lineWidth=2.4;g.stroke();g.beginPath();g.moveTo(l/2+4,0);g.lineTo(l/2-3,-4);g.lineTo(l/2-3,4);g.closePath();g.fillStyle=W;g.fill();g.restore();};
  const flame=(x:number,y:number,s:number)=>{g.beginPath();g.moveTo(x,y-12*s);g.quadraticCurveTo(x+10*s,y,x,y+9*s);g.quadraticCurveTo(x-10*s,y,x,y-12*s);ink(g,'#fff6c0','rgba(0,0,0,.3)',1.2);};
  switch(id){
    case 'basic':star(g,0,0,13,6);break;
    case 'firstAid':rr(g,-4,-12,8,24,2);g.fill();rr(g,-12,-4,24,8,2);g.fill();break;
    case 'swordMastery':case 'bash':g.rotate(-Math.PI/4);rr(g,-2.5,-15,5,24,2);g.fill();rr(g,-8,7,16,4,2);g.fill();if(id==='bash'){g.rotate(Math.PI/4);for(let i=0;i<5;i++){const a=i/5*Math.PI*2;g.beginPath();g.moveTo(Math.cos(a)*10+8,Math.sin(a)*10-8);g.lineTo(Math.cos(a)*15+8,Math.sin(a)*15-8);g.stroke();}}break;
    case 'hpRecovery':heart(g,0,2,11);g.fillStyle='#ff6b6b';g.fill();g.fillStyle=W;rr(g,10,-14,4,10,1);g.fill();rr(g,7,-11,10,4,1);g.fill();break;
    case 'spRecovery':g.beginPath();g.moveTo(0,-14);g.quadraticCurveTo(12,2,0,12);g.quadraticCurveTo(-12,2,0,-14);g.fillStyle='#bfe0ff';g.fill();break;
    case 'magnum':for(let i=0;i<8;i++){const a=i/8*Math.PI*2;flame(Math.cos(a)*10,Math.sin(a)*10,.55);}ellipse(g,0,0,6,6);g.fillStyle='#fff6c0';g.fill();break;
    case 'provoke':for(const [x,y,r] of [[-6,-6,0],[6,-6,1],[6,6,2],[-6,6,3]]){g.save();g.translate(x,y);g.rotate(r*Math.PI/2);g.beginPath();g.moveTo(-5,0);g.quadraticCurveTo(0,-1,0,-5);g.lineWidth=3.5;g.strokeStyle='#ffe0e0';g.stroke();g.restore();}break;
    case 'endure':g.beginPath();g.moveTo(0,-14);g.lineTo(12,-8);g.quadraticCurveTo(12,8,0,15);g.quadraticCurveTo(-12,8,-12,-8);g.closePath();g.fill();break;
    case 'fireBolt':arrow(0,0,Math.PI/2.4,22);flame(-6,-4,.7);break;
    case 'coldBolt':for(const a of [0,Math.PI/3,-Math.PI/3]){g.save();g.rotate(a);rr(g,-2,-14,4,28,2);g.fill();g.restore();}break;
    case 'lightningBolt':g.beginPath();g.moveTo(4,-16);g.lineTo(-6,2);g.lineTo(2,2);g.lineTo(-4,16);g.lineTo(8,-4);g.lineTo(0,-4);g.closePath();g.fill();break;
    case 'fireBall':ellipse(g,2,2,9,9);g.fill();flame(-6,-6,.7);break;
    case 'frostDiver':for(let i=0;i<6;i++){g.save();g.rotate(i*Math.PI/3);g.beginPath();g.moveTo(0,0);g.lineTo(0,-14);g.moveTo(0,-8);g.lineTo(-4,-12);g.moveTo(0,-8);g.lineTo(4,-12);g.stroke();g.restore();}break;
    case 'thunderStorm':ellipse(g,-4,-8,9,6);g.fill();ellipse(g,6,-8,8,6);g.fill();g.beginPath();g.moveTo(2,-2);g.lineTo(-4,8);g.lineTo(1,8);g.lineTo(-3,16);g.lineTo(6,4);g.lineTo(1,4);g.closePath();g.fillStyle='#fff6a0';g.fill();break;
    case 'owlEye':case 'concentrate':ellipse(g,0,0,14,8);g.fill();ellipse(g,0,0,5,5);g.fillStyle=shade(base,-.4);g.fill();if(id==='concentrate')star(g,10,-10,5,3);break;
    case 'vulture':for(const r of [12,7,2]){g.beginPath();g.arc(0,0,r,0,Math.PI*2);g.lineWidth=2.2;g.strokeStyle=W;g.stroke();}break;
    case 'doubleStrafe':arrow(0,-5,0,24);arrow(0,5,0,24);break;
    case 'arrowShower':for(const x of [-9,0,9])arrow(x,0,Math.PI/2,18);break;
    case 'chargeArrow':arrow(-3,0,0,22);for(let i=0;i<3;i++){g.beginPath();g.moveTo(10,-8+i*8);g.lineTo(16,-10+i*10);g.stroke();}break;
    // v6.0 二轉
    case 'k_wheel':for(let i=0;i<3;i++){g.save();g.rotate(i*Math.PI*2/3);g.beginPath();g.arc(0,0,12,-.2,1.2);g.lineWidth=3;g.stroke();rr(g,9,-2,7,3,1);g.fill();g.restore();}star(g,0,0,5,2.5);break;
    case 'k_charge':g.rotate(-Math.PI/4);rr(g,-2,-14,4,20,2);g.fill();rr(g,-6,5,12,3,1);g.fill();g.rotate(Math.PI/4);for(let i=0;i<3;i++){g.beginPath();g.moveTo(-15,-6+i*6);g.lineTo(-7,-6+i*6);g.lineWidth=2;g.stroke();}break;
    case 'k_ward':g.beginPath();g.moveTo(0,-14);g.lineTo(12,-8);g.quadraticCurveTo(12,8,0,15);g.quadraticCurveTo(-12,8,-12,-8);g.closePath();g.fill();star(g,0,0,7,3);g.fillStyle=shade(base,-.3);break;
    case 'k_rend':g.rotate(-Math.PI/4);rr(g,-3,-16,6,26,2);g.fill();rr(g,-9,9,18,4,2);g.fill();g.rotate(Math.PI/4);g.beginPath();g.moveTo(-14,10);g.lineTo(14,-10);g.lineWidth=2;g.strokeStyle='#fff6a0';g.stroke();break;
    case 'k_quake':for(const r of [5,10,14]){g.beginPath();g.ellipse(0,6,r,r*.4,0,0,Math.PI*2);g.lineWidth=2;g.stroke();}g.beginPath();g.moveTo(-4,-14);g.lineTo(0,-2);g.lineTo(4,-14);g.fill();break;
    case 'k_trample':ellipse(g,-2,2,11,8);g.fill();g.fillStyle=shade(base,-.4);ellipse(g,7,-6,5,4);g.fill();g.fillStyle='#fff';for(const x of [-8,0,8]){g.beginPath();g.moveTo(x,10);g.lineTo(x-3,16);g.moveTo(x,10);g.lineTo(x+3,16);g.lineWidth=2;g.strokeStyle='#fff';g.stroke();}break;
    case 'k_training':heart(g,0,2,10);g.fill();rr(g,-2,-15,4,10,1);g.fill();break;
    case 'k_judgment':g.beginPath();g.moveTo(0,10);g.arc(0,10,20,-Math.PI*.8,-Math.PI*.2);g.closePath();g.globalAlpha=.6;g.fill();g.globalAlpha=1;star(g,0,-4,9,4);break;
    case 'w_flame':g.beginPath();g.ellipse(0,8,14,5,0,0,Math.PI*2);g.lineWidth=2;g.stroke();flame(-6,2,.6);flame(6,2,.6);flame(0,-2,.85);break;
    case 'w_frost':g.beginPath();g.ellipse(0,8,14,5,0,0,Math.PI*2);g.lineWidth=2;g.stroke();for(let i=0;i<6;i++){g.save();g.translate(0,-3);g.rotate(i*Math.PI/3);g.beginPath();g.moveTo(0,0);g.lineTo(0,-10);g.stroke();g.restore();}break;
    case 'w_totem':rr(g,-3,-14,6,24,2);g.fill();g.beginPath();g.moveTo(8,-14);g.lineTo(3,-4);g.lineTo(7,-4);g.lineTo(2,6);g.lineTo(11,-6);g.lineTo(7,-6);g.closePath();g.fillStyle='#fff6a0';g.fill();break;
    case 'w_veil':g.beginPath();g.arc(0,4,13,Math.PI,0);g.lineWidth=3;g.stroke();star(g,0,0,6,3);break;
    case 'w_ascend':for(let i=0;i<3;i++){arrow(-8+i*8,0,-Math.PI/2,16);}break;
    case 'w_study':rr(g,-12,-10,24,20,2);g.fill();g.fillStyle=shade(base,-.4);rr(g,-1,-10,2,20,1);g.fill();star(g,6,-4,4,2);break;
    case 'w_arcana':for(const [r,c] of [[13,'#ff9a5a'],[9,'#7fd0ff'],[5,'#fff6a0']] as [number,string][]){g.beginPath();g.arc(0,0,r,0,Math.PI*2);g.lineWidth=2.4;g.strokeStyle=c;g.stroke();}star(g,0,0,4,2);break;
    case 'r_mark':for(const r of [12,6]){g.beginPath();g.arc(0,0,r,0,Math.PI*2);g.lineWidth=2.2;g.stroke();}for(const [x,y] of [[0,-16],[0,16],[-16,0],[16,0]]){g.beginPath();g.moveTo(x*.6,y*.6);g.lineTo(x,y);g.stroke();}break;
    case 'r_snipe':arrow(0,0,-Math.PI/4,30);g.beginPath();g.arc(8,-8,5,0,Math.PI*2);g.lineWidth=1.6;g.stroke();break;
    case 'r_pierce':arrow(0,0,0,30);for(const x of [-6,4]){g.beginPath();g.ellipse(x,0,3,7,0,0,Math.PI*2);g.lineWidth=1.6;g.stroke();}break;
    case 'r_barrage':for(let i=0;i<5;i++)arrow(-2,-10+i*5,0,20);break;
    case 'r_trap':for(let i=0;i<8;i++){g.save();g.rotate(i*Math.PI/4);rr(g,-1.5,-14,3,7,1);g.fill();g.restore();}g.beginPath();g.arc(0,0,6,0,Math.PI*2);g.fillStyle='#e0c8ff';g.fill();break;
    case 'r_falcon':g.beginPath();g.moveTo(-15,-2);g.quadraticCurveTo(-6,-12,0,-2);g.quadraticCurveTo(6,-12,15,-2);g.quadraticCurveTo(4,-4,0,8);g.quadraticCurveTo(-4,-4,-15,-2);g.fill();break;
    case 'r_starRain':for(const [x,y] of [[-9,-8],[0,-2],[9,-8],[-5,8],[6,8]])star(g,x,y,4.5,2);break;
  }
  g.restore();
}
function star(g:Ctx,x:number,y:number,r:number,ri:number){g.beginPath();for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,rr2=i%2?ri:r;g.lineTo(x+Math.cos(a)*rr2,y+Math.sin(a)*rr2);}g.closePath();g.fillStyle='#ffffff';g.fill();}
function heart(g:Ctx,x:number,y:number,s:number){g.beginPath();g.moveTo(x,y+s);g.bezierCurveTo(x-s*1.4,y,x-s,y-s*1.2,x,y-s*.4);g.bezierCurveTo(x+s,y-s*1.2,x+s*1.4,y,x,y+s);}
/** v4.5 large monster portrait for the card reveal (full sprite resolution, not the 48px icon). */
export function monsterPortrait(id:string):string{
  return make(`mp:${id}`,g=>{const m=monsters[id];if(!m)return;const art={...m.art,scale:1};const sheet=drawMonsterSheet(art);const S=monsterSize(art);g.imageSmoothingQuality='high';g.drawImage(sheet,0,0,S,S,0,0,160,160);},160,160);
}
