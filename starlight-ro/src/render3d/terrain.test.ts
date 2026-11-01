import { describe,it,expect } from 'vitest';
import { hillsGeometry } from './terrain';
import { maps } from '../data/maps';
describe('landscape geometry',()=>{
  for(const map of Object.values(maps))it(`${map.id} has finite positions and normals at the inner rim`,()=>{
    const g=hillsGeometry(map.w,map.h,map.seed,map.theme);
    for(const key of ['position','normal','uv']){
      const a=g.getAttribute(key).array;
      expect(Array.from(a).every(Number.isFinite),`${key} contains NaN/Infinity`).toBe(true);
    }
    g.computeBoundingSphere();expect(Number.isFinite(g.boundingSphere!.radius)).toBe(true);g.dispose();
  });
});
