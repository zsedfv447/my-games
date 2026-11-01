// Isometric projection: world cells (x right-down, y left-down) ↔ screen pixels.
export const TW = 64, TH = 32;
export const toScreen = (x:number,y:number) => ({ x:(x-y)*TW/2, y:(x+y)*TH/2 });
export const toWorld = (sx:number,sy:number) => ({ x:sy/TH+sx/TW, y:sy/TH-sx/TW });
/** 8-way facing (world angle index) → sprite view and mirror flag. Views: S, SE, E, NE, N. */
export type View = 'S'|'SE'|'E'|'NE'|'N';
export function viewFor(facing:number):{view:View;flip:boolean} {
  // World direction → screen direction, then pick the closest of 8 screen directions.
  const a=facing*Math.PI/4,dx=Math.cos(a),dy=Math.sin(a);
  const sx=dx-dy,sy=(dx+dy)/2;
  const ang=Math.atan2(sy,sx); // 0 = screen right, +π/2 = screen down
  const idx=(Math.round(ang/(Math.PI/4))+8)%8; // 0 E,1 SE,2 S,3 SW,4 W,5 NW,6 N,7 NE
  return [{view:'E',flip:false},{view:'SE',flip:false},{view:'S',flip:false},{view:'SE',flip:true},{view:'E',flip:true},{view:'NE',flip:true},{view:'N',flip:false},{view:'NE',flip:false}][idx] as {view:View;flip:boolean};
}
