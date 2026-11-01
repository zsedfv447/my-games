import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {StaticTexturePool} from './static-textures';

export type Part={geometry:THREE.BufferGeometry;material:THREE.Material|THREE.Material[]};
export type Model={parts:Part[];size:THREE.Vector3};
const packs=new Map<string,Promise<Map<string,Model>>>();
const textures=new StaticTexturePool();
export const staticWind={value:0};
export function loadStaticPack(names:readonly string[],folder:string){
  const existing=packs.get(folder);if(existing)return existing;
  const loader=new GLTFLoader();
  const pending=Promise.all(names.map(async name=>{
    const {scene,parser}=await loader.loadAsync(`models/${folder}/${name}.gltf`);scene.updateMatrixWorld(true);
    const box=new THREE.Box3().setFromObject(scene),size=box.getSize(new THREE.Vector3());
    const tree=/Tree|Pine/.test(name);
    const base=new THREE.Matrix4().makeTranslation(tree?0:-(box.min.x+box.max.x)/2,-box.min.y,tree?0:-(box.min.z+box.max.z)/2);
    const parts:Part[]=[];
    scene.traverse(o=>{if(!(o instanceof THREE.Mesh))return;
      const geometry=o.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(base,o.matrixWorld));
      const materials=(Array.isArray(o.material)?o.material:[o.material]).map(original=>{
        const m=original.clone() as THREE.MeshStandardMaterial;m.roughness=.9;m.metalness=0;
        for(const slot of ['map','normalMap','roughnessMap','metalnessMap','aoMap','emissiveMap','alphaMap'] as const){
          const texture=m[slot];if(!texture)continue;
          const index=parser.associations.get(texture)?.textures;
          const source=index===undefined?undefined:parser.json.textures[index]?.source;
          const uri=source===undefined?undefined:parser.json.images[source]?.uri;
          if(uri&&!uri.startsWith('data:'))m[slot]=textures.use(texture,`models/${folder}/${uri}`);
        }
        if(m.map)m.map.anisotropy=4;
        if(/Leaves|Leaf|Flowers/.test(m.name)){
          // Leaf cards keep their cutout silhouette, with only a gentle tip movement.
          m.onBeforeCompile=sh=>{sh.uniforms.uNatureWind=staticWind;
            sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nuniform float uNatureWind;')
              .replace('#include <begin_vertex>',`#include <begin_vertex>
              #ifdef USE_INSTANCING
              vec2 ip=instanceMatrix[3].xz;
              transformed.x+=sin(uNatureWind*1.2+ip.x*.31+ip.y*.27+position.y)*.05*clamp(position.y,0.,4.);
              #endif`);};
          m.customProgramCacheKey=()=> 'nature-leaf-wind-v1';
        }
        return m;
      });
      parts.push({geometry,material:Array.isArray(o.material)?materials:materials[0]});
    });
    if(!parts.length||!Number.isFinite(size.y)||size.y<=0)throw new Error(`Invalid nature model: ${name}`);
    return [name,{parts,size}] as const;
  })).then(entries=>new Map(entries)).catch(err=>{packs.delete(folder);throw err;});
  packs.set(folder,pending);return pending;
}
