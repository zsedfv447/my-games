// Canvas helpers shared by the procedural painters.
export function canvas(w:number,h:number):[HTMLCanvasElement,CanvasRenderingContext2D] {
  const c=document.createElement('canvas');c.width=Math.ceil(w);c.height=Math.ceil(h);
  const g=c.getContext('2d')!;g.lineJoin='round';g.lineCap='round';return [c,g];
}
function parse(hex:string):[number,number,number]{
  const h=hex.replace('#','');const n=h.length===3?h.split('').map(x=>x+x).join(''):h;
  return [parseInt(n.slice(0,2),16),parseInt(n.slice(2,4),16),parseInt(n.slice(4,6),16)];
}
/** Lighten (amt>0) or darken (amt<0) a hex colour; amt in -1..1. */
export function shade(hex:string,amt:number):string {
  const [r,g,b]=parse(hex),f=(v:number)=>Math.round(amt>=0?v+(255-v)*amt:v*(1+amt));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}
export function rgba(hex:string,a:number){const [r,g,b]=parse(hex);return `rgba(${r},${g},${b},${a})`;}
export function mix(a:string,b:string,t:number){const x=parse(a),y=parse(b);return `rgb(${x.map((v,i)=>Math.round(v+(y[i]-v)*t)).join(',')})`;}
export const OUTLINE='#3a2a2a';
/** Fill then stroke with a darker outline, the way hand-drawn RO-era sprites read. */
export function ink(g:CanvasRenderingContext2D,fill:string|CanvasGradient,stroke=OUTLINE,width=2.4){
  g.fillStyle=fill;g.fill();g.strokeStyle=stroke;g.lineWidth=width;g.stroke();
}
export function ellipse(g:CanvasRenderingContext2D,x:number,y:number,rx:number,ry:number,rot=0){g.beginPath();g.ellipse(x,y,Math.max(.1,rx),Math.max(.1,ry),rot,0,Math.PI*2);}
export function rr(g:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,r:number){g.beginPath();g.roundRect(x,y,w,h,r);}
export function radial(g:CanvasRenderingContext2D,x:number,y:number,r:number,inner:string,outer:string){
  const gr=g.createRadialGradient(x-r*.35,y-r*.4,r*.1,x,y,r);gr.addColorStop(0,inner);gr.addColorStop(1,outer);return gr;
}
export function linear(g:CanvasRenderingContext2D,x0:number,y0:number,x1:number,y1:number,stops:[number,string][]){
  const gr=g.createLinearGradient(x0,y0,x1,y1);for(const [t,c] of stops)gr.addColorStop(t,c);return gr;
}
/** Seeded noise for painting variation without touching gameplay RNG. */
export function prng(seed:number){let a=seed>>>0;return ()=>{a=(a+0x6d2b79f5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
/** Cute anime-style eye: dark iris, two highlights. */
export function eye(g:CanvasRenderingContext2D,x:number,y:number,r:number,color='#3a2a4a',squint=false){
  if(squint){g.beginPath();g.moveTo(x-r,y);g.quadraticCurveTo(x,y-r*.9,x+r,y);g.strokeStyle=OUTLINE;g.lineWidth=r*.45;g.stroke();return;}
  ellipse(g,x,y,r*.78,r);g.fillStyle=color;g.fill();
  ellipse(g,x,y+r*.25,r*.55,r*.6);g.fillStyle=shade(color,.35);g.fill();
  ellipse(g,x-r*.25,y-r*.38,r*.3,r*.34);g.fillStyle='#fff';g.fill();
  ellipse(g,x+r*.3,y+r*.35,r*.14,r*.14);g.fillStyle='#fff';g.fill();
}
export function blush(g:CanvasRenderingContext2D,x:number,y:number,r:number){ellipse(g,x,y,r,r*.55);g.fillStyle='rgba(255,120,140,.35)';g.fill();}
