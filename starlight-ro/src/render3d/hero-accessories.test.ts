import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {costumes} from '../data/costumes';
import {equipAccessories} from './hero-accessories';
describe('existing costume IDs on native skeleton',()=>{
 for(const costume of Object.values(costumes))it(`${costume.id} creates finite geometry and cleans up only its own objects`,()=>{
  const rig=new THREE.Group(),head=new THREE.Bone(),spine=new THREE.Bone();rig.add(head,spine);
  const before=head.children.length+spine.children.length;
  const a=equipAccessories(rig,new Map([['Head',head],['spine_03',spine]]),{outfit:'novice',hair:0,hairColor:'#000000',weapon:null,costumeHead:costume.slot==='head'?costume.id:null,costumeBack:costume.slot==='back'?costume.id:null});
  let count=0;rig.traverse(o=>{if((o as THREE.Mesh).isMesh){count++;expect(Array.from((o as THREE.Mesh).geometry.attributes.position.array).every(Number.isFinite)).toBe(true);}});
  expect(count).toBeGreaterThan(0);a.tick(1,true);a.dispose();expect(head.children.length+spine.children.length).toBe(before);expect(rig.children).toContain(head);
 });
});
