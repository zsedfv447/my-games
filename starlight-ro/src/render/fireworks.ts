// v4.5 card-reveal fireworks: a lightweight 2D particle show on its own canvas. Returns a stop function.
type P={x:number;y:number;vx:number;vy:number;life:number;max:number;color:string;size:number;trail:boolean};
const PALETTE=['#ffd45c','#ff7aa8','#7fd7ff','#b38cff','#8dffb0','#ffffff','#ff9d4d'];
export function fireworks(cv:HTMLCanvasElement,grand=false):()=>void{
  const g=cv.getContext('2d')!;let w=0,h=0,raf=0,alive=true;const dpr=1; // full-screen effect: 1x backing store is plenty and halves fill cost on Retina
  const fit=()=>{w=cv.clientWidth;h=cv.clientHeight;cv.width=w*dpr;cv.height=h*dpr;g.setTransform(dpr,0,0,dpr,0,0);};fit();
  const ps:P[]=[];const rockets:{x:number;y:number;vy:number;ty:number;color:string}[]=[];
  const burst=(x:number,y:number,color:string)=>{
    if(ps.length>700)return; // hard cap keeps the overlay cheap on slow machines
    const n=grand?90:64,ring=Math.random()<.35;
    for(let i=0;i<n;i++){const a=i/n*Math.PI*2+Math.random()*.1,sp=ring?4.2:1.5+Math.random()*3.6;
      ps.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:0,max:55+Math.random()*35,color:Math.random()<.2?'#ffffff':color,size:1.4+Math.random()*1.6,trail:true});}
    for(let i=0;i<14;i++)ps.push({x,y,vx:(Math.random()-.5)*1.2,vy:(Math.random()-.5)*1.2,life:0,max:30,color:'#fff8d0',size:3,trail:false});
  };
  const launch=()=>{const color=PALETTE[Math.floor(Math.random()*PALETTE.length)];rockets.push({x:w*(.12+Math.random()*.76),y:h+10,vy:-(9+Math.random()*4)*(h/800),ty:h*(.12+Math.random()*.35),color});};
  // Opening salvo, then a steady show.
  for(let i=0;i<(grand?5:3);i++)setTimeout(()=>alive&&burst(w*(.2+.6*Math.random()),h*(.18+.25*Math.random()),PALETTE[i%PALETTE.length]),120+i*160);
  let next=performance.now()+500;
  const frame=(t:number)=>{
    if(!alive)return;
    if(cv.clientWidth!==w||cv.clientHeight!==h)fit();
    g.globalCompositeOperation='destination-out';g.fillStyle='rgba(0,0,0,.22)';g.fillRect(0,0,w,h);g.globalCompositeOperation='lighter';
    if(t>next){launch();if(grand&&Math.random()<.5)launch();next=t+(grand?260:420)+Math.random()*300;}
    for(let i=rockets.length-1;i>=0;i--){const r=rockets[i];r.y+=r.vy;g.fillStyle=r.color;g.beginPath();g.arc(r.x,r.y,2.2,0,7);g.fill();
      if(r.y<=r.ty){burst(r.x,r.y,r.color);rockets.splice(i,1);}}
    for(let i=ps.length-1;i>=0;i--){const p=ps[i];p.life++;p.vx*=.975;p.vy=p.vy*.975+.045;p.x+=p.vx;p.y+=p.vy;
      const k=1-p.life/p.max;if(k<=0){ps.splice(i,1);continue;}
      g.globalAlpha=k;g.fillStyle=p.color;g.beginPath();g.arc(p.x,p.y,p.size*(p.trail?k+.3:k*1.5),0,7);g.fill();}
    g.globalAlpha=1;raf=requestAnimationFrame(frame);
  };
  raf=requestAnimationFrame(frame);
  return ()=>{alive=false;cancelAnimationFrame(raf);};
}
