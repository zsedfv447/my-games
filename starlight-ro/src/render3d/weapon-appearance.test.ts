import {describe,it,expect,vi} from 'vitest';
import * as THREE from 'three';
import {items,type EquipDef,type WeaponType} from '../data/items';
import {buildWeaponAppearance,weaponAppearance} from './weapon-appearance';
import {Hero} from './hero';

const equipment=Object.values(items).filter((i):i is EquipDef=>i.kind==='equip'&&i.slot==='weapon');
const signatures:Record<WeaponType,string[]>={sword:['sword','dawnSword','meteorSword','exp_dew_fangSword'],dagger:['knife','cutter','exp_dew_fangDagger','exp_dew_venomDagger'],staff:['rod','woodStaff','exp_dew_crystalStaff','starRod'],bow:['bow','galeBow','compositeBow','elvenBow']};
describe('equipment-driven held weapons',()=>{
 for(const item of equipment)it(`${item.id} has finite geometry and its equipment palette`,()=>{
  const w=buildWeaponAppearance(item.weaponType!,item.id,7);let meshes=0;
  w.group.traverse(o=>{if(o instanceof THREE.Mesh){meshes++;expect(Array.from(o.geometry.attributes.position.array).every(Number.isFinite)).toBe(true);}});
  expect(meshes).toBeGreaterThan(3);expect(w.style.color).toBe(item.icon.color);expect(w.group.userData.grip).toEqual([0,0,0]);
  const bounds=new THREE.Box3().setFromObject(w.group);expect(bounds.min.y).toBeLessThan(0);expect(bounds.max.y).toBeGreaterThan(.25);expect(bounds.max.y-bounds.min.y).toBeLessThan(1.8);w.dispose();
 });
 for(const type of Object.keys(signatures) as WeaponType[])it(`${type} supports four materially different silhouettes`,()=>{
  const names=new Set<string>(),geometry=new Set<string>();
  for(const id of signatures[type]){const w=buildWeaponAppearance(type,id);names.add(w.style.profile);const vertices:number[][]=[];w.group.traverse(o=>{if(o instanceof THREE.Mesh)vertices.push(Array.from(o.geometry.attributes.position.array));});geometry.add(JSON.stringify(vertices));w.dispose();}
  expect(names.size).toBe(4);expect(geometry.size).toBe(4);
 });
 it('uses the family in generated IDs rather than the tier name',()=>{
  expect(weaponAppearance('staff','exp_crystal_orbStaff').profile).toBe('orb');
  expect(weaponAppearance('sword','exp_astral_guardSword').profile).toBe('broad');
  expect(weaponAppearance('sword','exp_dew_edgeSword').profile).toBe('straight');
 });
 it('centers every native-rig grip on the same hand axis',()=>{
  for(const type of Object.keys(signatures) as WeaponType[]){
   const bone=new THREE.Bone(),hero=Object.create(Hero.prototype) as any;
   hero.root=new THREE.Group();hero.root.add(bone);hero.disposed=false;hero.look={weaponFrom:{weapon:type,weaponStyle:signatures[type][0]}};hero.bones=new Map([[type==='bow'?'hand_l':'hand_r',bone]]);hero.addWeapon();
   const w=hero.weapon,root=w.group as THREE.Group;
   expect(root.parent).toBe(bone);expect(root.position.toArray()).toEqual([0,.05,0]);
   const direction=new THREE.Vector3(0,1,0).applyQuaternion(root.quaternion);expect(Math.abs(direction.x)).toBeLessThan(1e-6);expect(Math.abs(direction.z)).toBeLessThan(1e-6);
   expect(root.rotation.x).toBe(0);expect(root.rotation.y).toBe(0);hero.dispose();hero.dispose();expect(bone.children).toHaveLength(0);
  }
 });
 it('disposes only its own geometry and materials exactly once',()=>{
  const a=buildWeaponAppearance('staff','starRod'),b=buildWeaponAppearance('staff','starRod'),parent=new THREE.Group();parent.add(a.group,b.group);
  const spies:ReturnType<typeof vi.spyOn>[]=[];const seen=new Set<unknown>();a.group.traverse(o=>{if(o instanceof THREE.Mesh){for(const resource of [o.geometry,...(Array.isArray(o.material)?o.material:[o.material])])if(!seen.has(resource)){seen.add(resource);spies.push(vi.spyOn(resource,'dispose'));}}});
  a.dispose();a.dispose();for(const spy of spies)expect(spy).toHaveBeenCalledTimes(1);expect(parent.children).toEqual([b.group]);expect(b.group.children.length).toBeGreaterThan(0);b.dispose();
 });
});
