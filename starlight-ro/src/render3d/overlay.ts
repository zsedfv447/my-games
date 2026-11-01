// DOM overlay above the 3D canvas: names, HP bars, cast bar, floating damage numbers and banners.
import * as THREE from 'three';

export type Tag={el:HTMLElement;pos:THREE.Vector3;offsetY:number;visible:boolean};
export class Overlay {
  readonly root=document.createElement('div');
  private tags=new Set<Tag>();
  private v=new THREE.Vector3();
  constructor(host:HTMLElement){
    this.root.className='ov3d';host.appendChild(this.root);
    if(!document.getElementById('ov3d-style')){const st=document.createElement('style');st.id='ov3d-style';st.textContent=CSS;document.head.appendChild(st);}
  }
  tag(html:string,cls:string,offsetY=0):Tag{
    const el=document.createElement('div');el.className=`ov-tag ${cls}`;el.innerHTML=html;this.root.appendChild(el);
    const t={el,pos:new THREE.Vector3(),offsetY,visible:true};this.tags.add(t);return t;
  }
  remove(t:Tag|undefined){if(!t)return;t.el.remove();this.tags.delete(t);}
  clear(){for(const t of this.tags)t.el.remove();this.tags.clear();this.root.querySelectorAll('.ov-float').forEach(e=>e.remove());}
  project(p:THREE.Vector3,cam:THREE.Camera,out:{x:number;y:number;behind:boolean}){
    this.v.copy(p).project(cam);out.x=(this.v.x+1)/2*this.root.clientWidth;out.y=(1-this.v.y)/2*this.root.clientHeight;out.behind=this.v.z>1;return out;
  }
  private pt={x:0,y:0,behind:false};
  update(cam:THREE.Camera){
    for(const t of this.tags){
      if(!t.visible){t.el.style.display='none';continue;}
      this.project(t.pos,cam,this.pt);
      if(this.pt.behind){t.el.style.display='none';continue;}
      t.el.style.display='';t.el.style.transform=`translate(${this.pt.x}px,${this.pt.y+t.offsetY}px) translate(-50%,-50%)`;
    }
  }
  /** Floating text that rises and fades (damage, heals, Miss, status words). */
  float(p:THREE.Vector3,cam:THREE.Camera,text:string,cls:string){
    this.project(p,cam,this.pt);if(this.pt.behind)return;
    const el=document.createElement('div');el.className=`ov-float ${cls}`;el.textContent=text;
    const dx=(Math.random()-.5)*50;el.style.left=`${this.pt.x}px`;el.style.top=`${this.pt.y}px`;el.style.setProperty('--dx',`${dx}px`);
    this.root.appendChild(el);setTimeout(()=>el.remove(),1100);
  }
  banner(p:THREE.Vector3,cam:THREE.Camera,text:string,cls:string){
    this.project(p,cam,this.pt);const el=document.createElement('div');el.className=`ov-float ov-banner ${cls}`;el.textContent=text;
    el.style.left=`${this.pt.x}px`;el.style.top=`${this.pt.y}px`;this.root.appendChild(el);setTimeout(()=>el.remove(),1800);
  }
}
const CSS=`
.ov3d{position:absolute;inset:0;pointer-events:none;overflow:hidden;font-family:"PingFang TC","Microsoft JhengHei",sans-serif}
.ov-tag{position:absolute;left:0;top:0;white-space:nowrap;will-change:transform}
.ov-name{font-size:12px;font-weight:700;color:#fff;text-shadow:0 0 3px #1a2a1a,0 1px 2px #1a2a1a,0 0 1px #000}
.ov-name.npc{color:#ffe9a8}.ov-name.mvp{color:#ffb0c8;font-size:13px}.ov-name.warp{color:#e8fff8;font-size:13px;text-shadow:0 0 6px #2a8a9a,0 1px 2px #123}
.ov-name.ally{color:#bfe8ff}.ov-name.ally small{color:#e8f4ff;font-weight:400}.ov-float.hurt.ally{font-size:17px;color:#ff9a7a}
.ov-name.landmark{color:#fff1bf;font-size:12px;text-shadow:0 0 4px #3e5843,0 1px 2px #123}
.ov-name.landmark.trial{color:#e4c9ff;text-shadow:0 0 6px #6a3aa8,0 1px 2px #123}.ov-name.landmark.supply{color:#c9ffd8}
.ov-name.chest{font-size:11px;color:#fff3c4;text-shadow:0 1px 2px #000}.ov-name.chest.rare{color:#ffe27a;font-weight:800;text-shadow:0 0 6px #b8791a,0 1px 2px #000}.ov-name.chest.trial{color:#e4c9ff;font-weight:800;text-shadow:0 0 6px #6a3aa8,0 1px 2px #000}
.ov-bars{width:54px}.ov-bars i{display:block;height:5px;border-radius:2px;background:#1a2430;box-shadow:0 0 0 1px rgba(10,20,30,.8);overflow:hidden;margin-top:2px}
.ov-bars i b{display:block;height:100%;background:linear-gradient(#8cff8c,#33c24a);transition:width .12s}
.ov-bars i.sp b{background:linear-gradient(#a8c8ff,#3b7bff)}.ov-bars i.low b{background:linear-gradient(#ffa0a0,#ff4a4a)}
.ov-bars.mon{width:60px}.ov-bars.mvp{width:120px}.ov-bars.mvp i{height:7px}.ov-bars.mvp i b{background:linear-gradient(#ffb08a,#ff5a3a)}
.ov-cast{width:80px;text-align:center;font-size:11px;font-weight:700;color:#fff;text-shadow:0 0 3px #123}
.ov-cast i{display:block;height:7px;border-radius:4px;background:#1a2030;box-shadow:0 0 0 1px #9fd5ff,0 0 8px #7fd0ff;overflow:hidden;margin-top:2px}
.ov-cast i b{display:block;height:100%;background:linear-gradient(90deg,#7fd0ff,#e8f8ff)}
.ov-quest{font-size:22px;font-weight:900;color:#ffd84a;text-shadow:0 0 6px #ff9a2a,0 2px 2px #6a3a00;animation:ovBob 1s ease-in-out infinite}
@keyframes ovBob{50%{transform:translateY(-6px)}}
.ov-float{position:absolute;transform:translate(-50%,-50%);font-weight:900;white-space:nowrap;animation:ovRise 1.05s cubic-bezier(.2,.8,.3,1) forwards;
  font-family:"Trebuchet MS","Arial Rounded MT Bold","PingFang TC",sans-serif;-webkit-text-stroke:1.5px #1a1020;paint-order:stroke fill}
.ov-float.dmg{font-size:24px;color:#fff;text-shadow:0 2px 0 #1a1020}
.ov-float.crit{font-size:34px;color:#ffe24a;text-shadow:0 0 10px #ff8a2a,0 2px 0 #3a1a00}
.ov-float.crit::before{content:"✦";position:absolute;left:-26px;top:-4px;font-size:22px;color:#ff9a3d;-webkit-text-stroke:0}
.ov-float.hurt{font-size:24px;color:#ff5a5a}
.ov-float.miss{font-size:18px;color:#c9d7ff;font-style:italic}
.ov-float.heal{font-size:20px;color:#7dff8a}.ov-float.sp{color:#8ab8ff}
.ov-float.burn{font-size:15px;color:#ffae5a}.ov-float.detonate{font-size:28px;color:#ff7a2a;text-shadow:0 0 8px #ffb04a,0 2px 0 #3a1000}
.ov-float.shatter{font-size:30px;color:#bff0ff;text-shadow:0 0 10px #6fd0ff,0 2px 0 #0a2a40}.ov-float.shard{font-size:17px;color:#cdefff}
.ov-float.chainz{font-size:17px;color:#fff3a0}.ov-float.strike{font-size:26px;color:#ffe85a;text-shadow:0 0 10px #fff27a,0 2px 0 #3a3000}
.ov-bars .sts{display:flex;gap:2px;justify-content:center;margin-top:2px}.ov-bars .st{font-style:normal;font-size:10px;font-weight:800;padding:0 3px;border-radius:6px;line-height:13px;color:#fff;text-shadow:0 1px 1px #000}
.ov-bars .st.burn{background:#c2451fcc}.ov-bars .st.chill{background:#3a86c8cc}.ov-bars .st.mark{background:#e8f8ffee;color:#1a5a8a;text-shadow:none}.ov-bars .st.shock{background:#b89a10cc}.ov-bars .st.prey{background:#c23a3acc}.ov-name.elite{color:#ffe9a8;background:rgba(90,30,140,.78);border-color:#c070ff;font-weight:800}.ov-name.invader{color:#ffd0c8;background:rgba(150,20,20,.75);border-color:#ff6a5a}
.ov-float.venom{font-size:16px;color:#d8a8ff}
.ov-float.info{font-size:15px;color:#ffe9c0}
.ov-float.status{font-size:17px;color:#a8e4ff}
@keyframes ovRise{0%{transform:translate(-50%,-50%) scale(1.8);opacity:0}12%{transform:translate(-50%,-80%) scale(1);opacity:1}
  70%{opacity:1}100%{transform:translate(calc(-50% + var(--dx,0px)),-260%) scale(.9);opacity:0}}
.ov-banner{font-size:34px;letter-spacing:2px;animation:ovBanner 1.8s ease-out forwards}
.ov-banner.base{color:#fff1a0;text-shadow:0 0 14px #ffb020,0 3px 0 #6a4000}
.ov-banner.job{color:#cfeaff;text-shadow:0 0 14px #4a9aff,0 3px 0 #10305a}
@keyframes ovBanner{0%{transform:translate(-50%,-50%) scale(.3);opacity:0}15%{transform:translate(-50%,-140%) scale(1.15);opacity:1}
  80%{transform:translate(-50%,-160%) scale(1);opacity:1}100%{transform:translate(-50%,-200%) scale(1);opacity:0}}
`;
