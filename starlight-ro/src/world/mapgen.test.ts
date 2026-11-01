import {describe,expect,test} from 'vitest';
import {buildMap} from './mapgen';
import {maps} from '../data/maps';

describe('地圖產生',()=>{
  for(const id of Object.keys(maps))test(`${id}：起點可走、每個傳送點都走得到、NPC 不在牆裡`,()=>{
    const m=buildMap(id),idx=(x:number,y:number)=>y*m.w+x;
    expect(m.grid.walkable(m.def.start.x,m.def.start.y)).toBe(true);
    for(const wp of m.def.warps)expect(m.reachable[idx(wp.x,wp.y)]).toBe(1);
    for(const n of m.def.npcs)expect(m.blocked[idx(n.x,n.y)]).toBe(0);
    for(const wp of m.def.warps){const target=buildMap(wp.to);expect(target.grid.walkable(wp.tx,wp.ty)).toBe(true);}
  });
  test('同一張地圖每次產生結果相同',()=>{
    const a=buildMap('forest'),b=buildMap('forest');
    expect(Buffer.from(a.blocked).equals(Buffer.from(b.blocked))).toBe(true);
    expect(a.props.length).toBe(b.props.length);
  });
  test('A* 會繞過障礙而不是穿過去',()=>{
    const m=buildMap('meadow');
    const path=m.grid.findPath(m.def.start.x+.5,m.def.start.y+.5,66,36)!;
    expect(path.length).toBeGreaterThan(10);
    for(const c of path)expect(m.grid.walkable(c.x,c.y)).toBe(true);
    const smooth=m.grid.smoothPath(m.def.start.x+.5,m.def.start.y+.5,path);
    let from={x:m.def.start.x+.5,y:m.def.start.y+.5};
    for(const p of smooth){expect(m.grid.lineOfSight(from.x,from.y,p.x,p.y)).toBe(true);from=p;}
  });
  test('目標在牆裡時走到最近可走處',()=>{
    const m=buildMap('town');
    const path=m.grid.findPath(24.5,30.5,24.5,24.5)!; // fountain centre is solid
    expect(path.length).toBeGreaterThan(0);
    const end=path[path.length-1];
    expect(m.grid.walkable(end.x,end.y)).toBe(true);
  });
});
