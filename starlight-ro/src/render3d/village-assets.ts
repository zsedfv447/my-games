// CC0 Fantasy Props MegaKit. Small off-road compositions give each shop its own identity.
import * as THREE from 'three';
import type {MapData} from '../world/mapgen';
import {loadStaticPack} from './static-models';
export const VILLAGE_FILES=['Bag','Banner_1','Barrel','Barrel_Apples','Bench','Bucket_Wooden_1','Chair_1','Crate_Wooden','FarmCrate_Apple','FarmCrate_Carrot','FarmCrate_Empty','Lantern_Wall','Pot_1','Stall_Cart_Empty','Stall_Empty','Stool','Table_Large','Anvil_Log','WeaponStand','Workbench','BookStand','Book_Stack_1','Potion_1','Vase_2','Rope_1'] as const;
type Asset=typeof VILLAGE_FILES[number];
type Placement={asset:Asset;x:number;z:number;width:number;y?:number;yaw?:number};
export function attachVillage(map:MapData,parent:THREE.Group){
  let disposed=false;const group=new THREE.Group();group.name='village-life';
  const ready=map.def.theme!=='town'?Promise.resolve(false):loadStaticPack(VILLAGE_FILES,'village').then(models=>{
    if(disposed)return false;
    const places:Placement[]=[];
    const add=(asset:Asset,x:number,z:number,width:number,y=0,yaw=0)=>places.push({asset,x,z,width,y,yaw});
    for(const stall of map.props.filter(p=>p.kind==='stall')){
      add(stall.v?'Potion_1':'FarmCrate_Apple',stall.x-.4,stall.y,.4,.73);
      add(stall.v?'Book_Stack_1':'FarmCrate_Carrot',stall.x+.35,stall.y,.4,.73);
      add('Rope_1',stall.x+.55,stall.y+.22,.25,.73);
    }
    for(const {x,z,variant:i} of map.villageSites){
      if(i%3===0){add('Stall_Cart_Empty',x,z,1.5);add('FarmCrate_Apple',x,z,.6,.7);add('FarmCrate_Carrot',x+.65,z-.55,.65);add('Barrel_Apples',x-.75,z+.4,.5);add('Bag',x+.5,z+.7,.4);}
      else if(i%3===1){add('Workbench',x,z,1.3);add('Anvil_Log',x+.8,z-.45,.5);add('WeaponStand',x-.7,z-.6,.7);add('Crate_Wooden',x+.5,z+.7,.45);add('Bucket_Wooden_1',x-.65,z+.55,.35);}
      else{const table=models.get('Table_Large')!,top=table.size.y*1.1/Math.max(table.size.x,table.size.z);
        add('Table_Large',x,z,1.1);add('BookStand',x,z,.4,top);add('Potion_1',x+.3,z,.15,top);add('Book_Stack_1',x-.3,z,.3,top);add('Stool',x,z+.8,.4);add('Vase_2',x+.75,z-.4,.35);add('Chair_1',x-.7,z-.4,.6);}
      add('Banner_1',x+1.1,z-1, .65,0,Math.PI*.15);add('Pot_1',x-1,z+.8,.35);
    }
    for(const p of places){const model=models.get(p.asset)!;const s=p.width/Math.max(model.size.x,model.size.z);const pose=new THREE.Matrix4().compose(new THREE.Vector3(p.x,p.y??0,p.z),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),p.yaw??0),new THREE.Vector3(s,s,s));
      for(const part of model.parts){const mesh=new THREE.Mesh(part.geometry.clone().applyMatrix4(pose),part.material);mesh.castShadow=true;mesh.receiveShadow=true;mesh.name=p.asset;group.add(mesh);}}
    parent.add(group);return true;
  }).catch(err=>{console.warn('Village props unavailable; retaining town',err);return false;});
  return {ready,dispose:()=>{disposed=true;group.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});group.removeFromParent();}};
}
