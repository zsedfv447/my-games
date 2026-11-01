import {describe,it,expect} from 'vitest';
import {readFileSync,existsSync} from 'node:fs';
import {NATURE_FILES} from './nature-assets';
import {VILLAGE_FILES} from './village-assets';

describe('shipping nature assets',()=>{
  for(const [folder,names] of [['nature',NATURE_FILES],['village',VILLAGE_FILES]] as const)for(const name of names)it(`${folder}/${name} has complete local resources and valid geometry bounds`,()=>{
    const base=new URL(`../../public/models/${folder}/`,import.meta.url);
    const file=new URL(`${name}.gltf`,base);
    const gltf=JSON.parse(readFileSync(file,'utf8'));
    expect(gltf.asset.version).toBe('2.0');expect(gltf.meshes.length).toBeGreaterThan(0);
    for(const ref of [...gltf.buffers,...(gltf.images??[])]){
      expect(ref.uri).not.toMatch(/^(https?:|data:|\/|\.\.)/);
      expect(existsSync(new URL(ref.uri,base)),`${name}: missing ${ref.uri}`).toBe(true);
      if(ref.byteLength)expect(readFileSync(new URL(ref.uri,base)).length).toBeGreaterThanOrEqual(ref.byteLength);
    }
    for(const mesh of gltf.meshes)for(const primitive of mesh.primitives){
      const position=gltf.accessors[primitive.attributes.POSITION];
      expect(position.count).toBeGreaterThan(0);
      expect([...position.min,...position.max].every(Number.isFinite)).toBe(true);
      expect(gltf.materials[primitive.material]).toBeDefined();
    }
  });
});
