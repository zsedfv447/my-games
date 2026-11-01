import {readFileSync,existsSync} from 'node:fs';
import {describe,test,expect} from 'vitest';
import {chibiClip,CHIBI_CAST} from './chibi-profile';
describe('完整日系Q版候選角色',()=>{
 test('提供五套完整人物並對應日常NPC，不以裸身或拼接頭取代玩家',()=>{
  expect(CHIBI_CAST).toEqual(['merchant','archer','knight','ninja','student']);
 });
 test('只使用來源實際具備的動作，缺戰鬥動作時不冒稱劍術或施法',()=>{
  const names=['anim_iddle','anim_iddle.001','anim_walk','anim_run','anim_dying','anim_push'];
  expect(chibiClip(names,'idle')).toBe('anim_iddle');expect(chibiClip(names,'walk')).toBe('anim_walk');
  expect(chibiClip(names,'dead')).toBe('anim_dying');expect(chibiClip(names,'attack')).toBeNull();expect(chibiClip(names,'cast')).toBeNull();
  expect(chibiClip(['walkanim_','iddle.001anim_','iddleanim_'],'idle')).toBe('iddleanim_');
 });
 test.each(['merchant','archer','knight','ninja','student'])('%s的模型、蒙皮、動畫與材質資源完整',(name)=>{
  const base=new URL('../../public/models/styloo/',import.meta.url),g=JSON.parse(readFileSync(new URL(name+'.gltf',base),'utf8'));
  expect(g.meshes.length).toBeGreaterThan(3);expect(g.skins.length).toBeGreaterThan(0);expect(g.animations.length).toBe(11);
  for(const ref of [...g.buffers,...g.images]){expect(ref.uri).not.toMatch(/^(https?:|data:|\/|\.\.)/);expect(existsSync(new URL(ref.uri,base))).toBe(true);}
  const buffer=readFileSync(new URL(g.buffers[0].uri,base));
  for(const v of g.bufferViews)expect((v.byteOffset??0)+v.byteLength).toBeLessThanOrEqual(buffer.byteLength);
  for(const skin of g.skins)for(const joint of skin.joints)expect(g.nodes[joint]).toBeDefined();
  for(const anim of g.animations)for(const channel of anim.channels){expect(g.nodes[channel.target.node]).toBeDefined();expect(anim.samplers[channel.sampler]).toBeDefined();}
  for(const m of g.materials){expect(m.extensions.KHR_materials_unlit).toBeDefined();expect(m.doubleSided).toBe(true);}
  for(const mesh of g.meshes)for(const p of mesh.primitives){const a=g.accessors[p.attributes.POSITION];expect(a.count).toBeGreaterThan(0);expect([...a.min,...a.max].every(Number.isFinite)).toBe(true);}
 });
});
