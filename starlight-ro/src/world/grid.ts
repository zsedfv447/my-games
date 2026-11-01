// Walkability grid and A* pathfinding (8 directions, no corner cutting).
export type Cell = { x:number; y:number };

export class Grid {
  constructor(readonly w:number, readonly h:number, readonly blocked:Uint8Array) {}
  inside(x:number,y:number){ return x>=0&&y>=0&&x<this.w&&y<this.h; }
  walkable(x:number,y:number){ return this.inside(x,y)&&this.blocked[y*this.w+x]===0; }
  /** Walkable at a continuous position (cell units). */
  free(px:number,py:number){ return this.walkable(Math.floor(px),Math.floor(py)); }

  /** Nearest walkable cell to (x,y) by expanding rings; null if none within maxR. */
  nearestWalkable(x:number,y:number,maxR=12):Cell|null {
    const cx=Math.floor(x),cy=Math.floor(y);
    if(this.walkable(cx,cy))return {x:cx,y:cy};
    for(let r=1;r<=maxR;r++){
      let best:Cell|null=null,bestD=Infinity;
      for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){
        if(Math.max(Math.abs(dx),Math.abs(dy))!==r)continue;
        const nx=cx+dx,ny=cy+dy;
        if(!this.walkable(nx,ny))continue;
        const d=(nx+.5-x)**2+(ny+.5-y)**2;
        if(d<bestD){bestD=d;best={x:nx,y:ny};}
      }
      if(best)return best;
    }
    return null;
  }

  /** True when a straight walk between two positions never enters a blocked cell (used to smooth paths). */
  lineOfSight(ax:number,ay:number,bx:number,by:number):boolean {
    const dist=Math.hypot(bx-ax,by-ay),steps=Math.max(1,Math.ceil(dist*4));
    for(let i=0;i<=steps;i++){
      const t=i/steps,x=ax+(bx-ax)*t,y=ay+(by-ay)*t;
      // Sample a small body radius so the walker never clips a wall corner.
      for(const [ox,oy] of [[0,0],[.22,.22],[-.22,.22],[.22,-.22],[-.22,-.22]])if(!this.free(x+ox,y+oy))return false;
    }
    return true;
  }

  /** A* from start to goal cell. Returns cell centres excluding the start, or null. */
  findPath(sx:number,sy:number,gx:number,gy:number,maxNodes=6000):Cell[]|null {
    const start={x:Math.floor(sx),y:Math.floor(sy)};
    let goal={x:Math.floor(gx),y:Math.floor(gy)};
    if(!this.walkable(goal.x,goal.y)){const n=this.nearestWalkable(gx,gy);if(!n)return null;goal=n;}
    if(!this.walkable(start.x,start.y)){const n=this.nearestWalkable(sx,sy,3);if(!n)return null;start.x=n.x;start.y=n.y;}
    if(start.x===goal.x&&start.y===goal.y)return [];
    const W=this.w,size=W*this.h,key=(x:number,y:number)=>y*W+x;
    const g=new Float32Array(size).fill(Infinity),came=new Int32Array(size).fill(-1),closed=new Uint8Array(size);
    const heap:number[]=[],f=new Float32Array(size);
    const push=(k:number)=>{heap.push(k);let i=heap.length-1;while(i>0){const p=(i-1)>>1;if(f[heap[p]]<=f[heap[i]])break;[heap[p],heap[i]]=[heap[i],heap[p]];i=p;}};
    const pop=()=>{const top=heap[0],last=heap.pop()!;if(heap.length){heap[0]=last;let i=0;for(;;){const l=i*2+1,r=l+1;let m=i;if(l<heap.length&&f[heap[l]]<f[heap[m]])m=l;if(r<heap.length&&f[heap[r]]<f[heap[m]])m=r;if(m===i)break;[heap[m],heap[i]]=[heap[i],heap[m]];i=m;}}return top;};
    const h=(x:number,y:number)=>{const dx=Math.abs(x-goal.x),dy=Math.abs(y-goal.y);return Math.max(dx,dy)+.4142*Math.min(dx,dy);};
    const s=key(start.x,start.y);g[s]=0;f[s]=h(start.x,start.y);push(s);
    let expanded=0;
    let bestK=s,bestH=f[s];
    while(heap.length){
      const k=pop();if(closed[k])continue;closed[k]=1;
      const x=k%W,y=(k-x)/W;
      if(x===goal.x&&y===goal.y){bestK=k;break;}
      const hk=h(x,y);if(hk<bestH){bestH=hk;bestK=k;}
      if(++expanded>maxNodes)break;
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
        if(!dx&&!dy)continue;const nx=x+dx,ny=y+dy;
        if(!this.walkable(nx,ny))continue;
        if(dx&&dy&&(!this.walkable(x+dx,y)||!this.walkable(x,y+dy)))continue;
        const nk=key(nx,ny);if(closed[nk])continue;
        const ng=g[k]+(dx&&dy?1.4142:1);
        if(ng<g[nk]){g[nk]=ng;came[nk]=k;f[nk]=ng+h(nx,ny);push(nk);}
      }
    }
    // Unreachable goals walk to the closest explored cell instead of standing still.
    const path:Cell[]=[];
    for(let k=bestK;k!==s&&k>=0;k=came[k]){const x=k%W;path.push({x,y:(k-x)/W});}
    return path.reverse();
  }

  /** Path as continuous waypoints (cell centres), shortened with line-of-sight so walking looks natural. */
  smoothPath(sx:number,sy:number,cells:Cell[],endX?:number,endY?:number):{x:number;y:number}[] {
    const pts=cells.map(c=>({x:c.x+.5,y:c.y+.5}));
    if(endX!==undefined&&endY!==undefined&&pts.length&&this.free(endX,endY)){
      const last=pts[pts.length-1];
      if(Math.floor(endX)===Math.floor(last.x)&&Math.floor(endY)===Math.floor(last.y))pts[pts.length-1]={x:endX,y:endY};
    }
    const out:{x:number;y:number}[]=[];let from={x:sx,y:sy},i=0;
    while(i<pts.length){
      let j=pts.length-1;
      while(j>i&&!this.lineOfSight(from.x,from.y,pts[j].x,pts[j].y))j--;
      out.push(pts[j]);from=pts[j];i=j+1;
    }
    return out;
  }

  /** Cells reachable from (x,y). */
  flood(x:number,y:number):Uint8Array {
    const seen=new Uint8Array(this.w*this.h);if(!this.walkable(x,y))return seen;
    const stack=[y*this.w+x];seen[stack[0]]=1;
    while(stack.length){
      const k=stack.pop()!,cx=k%this.w,cy=(k-cx)/this.w;
      for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
        const nx=cx+dx,ny=cy+dy;if(!this.walkable(nx,ny))continue;const nk=ny*this.w+nx;
        if(!seen[nk]){seen[nk]=1;stack.push(nk);}
      }
    }
    return seen;
  }
}
