import { describe,it,expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { isBaseBodyMaterial } from './hero-parts';
type Asset={materials:{name:string}[];meshes:{name:string;primitives:{material:number}[]}[]};
const asset=(name:string):Asset=>JSON.parse(readFileSync(new URL(`../../public/models/${name}.gltf`,import.meta.url),'utf8'));
const bodyMeshes=(data:Asset)=>data.meshes.filter(mesh=>isBaseBodyMaterial(mesh.primitives.map(p=>data.materials[p.material].name)));
describe('base body versus outfit classification',()=>{
  it('crops the actual male mesh despite its exporter-generated name',()=>{
    expect(bodyMeshes(asset('body_m')).map(m=>m.name)).toEqual(['Sphere.005_Retopology.004']);
  });
  it('crops the female body but preserves the separate eyes and eyebrows',()=>{
    expect(bodyMeshes(asset('body_f')).map(m=>m.name)).toEqual(['Superhero_Female']);
  });
  for(const outfit of ['male_peasant','female_peasant','male_ranger','female_ranger'])it(`does not crop any ${outfit} clothing or arms`,()=>{
    expect(bodyMeshes(asset(outfit))).toEqual([]);
  });
});
