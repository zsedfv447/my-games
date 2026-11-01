import {describe,expect,test} from 'vitest';
import {createHash} from 'node:crypto';
import {buildMap,G} from './mapgen';
import {villageFootprint,villageSites} from './village-layout';

describe('城鎮場景與靜態碰撞共用配置',()=>{
  test('大型道具整個範圍阻擋，NPC、傳送與出生點仍可達',()=>{
    const map=buildMap('town');expect(map.villageSites.length).toBeGreaterThan(0);
    const used=new Set<number>();
    for(const site of map.villageSites){
      expect(site.x).toBeGreaterThan(3);expect(site.z).toBeGreaterThan(3);
      expect(site.x).toBeLessThan(map.w-3);expect(site.z).toBeLessThan(map.h-3);
      expect(site.variant).toBeGreaterThanOrEqual(0);expect(site.variant).toBeLessThan(3);
      for(const c of villageFootprint(site)){
        const id=c.z*map.w+c.x;expect(used.has(id)).toBe(false);used.add(id);
        expect([G.grass,G.grass2,G.flowers]).toContain(map.ground[id]);
        expect(map.grid.walkable(c.x,c.z)).toBe(false);expect(map.blocked[id]).toBe(1);
      }
      for(const n of map.def.npcs)expect(Math.hypot(site.x-n.x-.5,site.z-n.y-.5)).toBeGreaterThan(3);
      for(const p of map.def.warps)expect(Math.hypot(site.x-p.x-.5,site.z-p.y-.5)).toBeGreaterThan(4);
    }
    for(const p of [map.def.start,...map.def.npcs,...map.def.warps]){
      expect(map.grid.walkable(p.x,p.y)).toBe(true);expect(map.reachable[p.y*map.w+p.x]).toBe(1);
    }
  });
  test('配置器不修改輸入且重算一致，每棟房子最多一處',()=>{
    const map=buildMap('town'),blocked=map.blocked.slice();
    for(const s of map.villageSites)for(const c of villageFootprint(s))blocked[c.z*map.w+c.x]=0;
    const before=blocked.slice(),ground=map.ground.slice(),props=JSON.stringify(map.props);
    const a=villageSites({...map,blocked}),b=villageSites({...map,blocked});
    expect(a).toEqual(b);expect(a).toEqual(map.villageSites);expect(blocked).toEqual(before);
    expect(map.ground).toEqual(ground);expect(JSON.stringify(map.props)).toBe(props);
    expect(a.length).toBeLessThanOrEqual(map.props.filter(p=>p.kind==='house').length);
  });
  test('組合邊緣道具也包含在碰撞區，不只封住中心格',()=>{
    const cells=villageFootprint({x:10.2,z:9.5});
    for(const [x,z] of [[11.3,8.5],[9.2,10.3],[10.2,9.5]])expect(cells.some(c=>c.x===Math.floor(x)&&c.z===Math.floor(z))).toBe(true);
  });
  // Captured before introducing village layout: guards unchanged non-town terrain, RNG outputs and reachability.
  const previous:Record<string,string>={
    meadow:'bb5cfefeb77c163468348271883581dca08d120375f4407d4169afeee5859dd4',
    forest:'62d6357ce34540b6bfb59135abb2952db54d26b495557c561889ec11c7585b92',
    cave:'05f9cdb9edeb1b2595b3dafa7da6d0f758980d0c9f16ea2cbeb9462ff06dabb1',
    // v5.0: ruins gained its east road to 曙光前哨 (intentional terrain change; re-captured).
    ruins:'a2dd48e1c97a8c7566f0ec347057281b524b47a7d52d93f9e9bda56be9131d67',
  };
  for(const [id,expected]of Object.entries(previous))test(`${id}地形、碰撞、裝飾亂數與可達性保持原樣`,()=>{
    const map=buildMap(id);expect(map.villageSites).toEqual([]);
    expect(createHash('sha256').update(map.ground).update(map.blocked).update(map.reachable).update(JSON.stringify(map.props)).digest('hex')).toBe(expected);
  });
});
