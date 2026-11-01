import 'fake-indexeddb/auto';
import { expect, test } from 'vitest';
import { SaveStore } from './save';
import * as R from './rules/state';
let seq=0;
const name=()=>`recovery-test-${Date.now()}-${seq++}`;
const made=()=>R.createCharacter(R.newGame(),'測試者',0,0);
async function raw(name:string,key:string,value?:unknown):Promise<unknown>{
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open(name,1);r.onupgradeneeded=()=>r.result.createObjectStore('saves');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  return new Promise((resolve,reject)=>{const t=db.transaction('saves',value===undefined?'readonly':'readwrite');const s=t.objectStore('saves');const r=value===undefined?s.get(key):s.put(value,key);r.onsuccess=()=>{const v=r.result;t.oncomplete=()=>{db.close();resolve(v);};};t.onerror=()=>reject(t.error);});
}
test('missing main recovers backup and reports recovery source',async()=>{
  const n=name(),s=made();await raw(n,'backup',s);const store=new SaveStore(n);
  expect(await store.load()).toEqual(s);expect(store.recoveryStatus.source).toBe('backup');
});
test('corrupt main cannot overwrite valid backup on first post-recovery write',async()=>{
  const n=name(),s=made();await raw(n,'main',{version:999});await raw(n,'backup',s);
  const store=new SaveStore(n),loaded=await store.load();expect(loaded).toEqual(s);
  await store.save(R.addZeny(loaded!,50));expect(await raw(n,'backup')).toEqual(s);
  expect(await raw(n,'corrupt-main')).toEqual({version:999});expect((await store.load())!.char.zeny).toBe(250);
});
test('failed validation writes nothing and preserves existing main and backup',async()=>{
  const n=name(),s=made(),store=new SaveStore(n);await store.save(s);await store.save(R.addZeny(s,10));
  const bad=structuredClone(s);bad.char.hp=NaN;await expect(store.save(bad)).rejects.toThrow();
  expect(await raw(n,'main')).toEqual(R.addZeny(s,10));expect(await raw(n,'backup')).toEqual(s);
});
test('first legacy load keeps an immutable pre-upgrade snapshot',async()=>{
  const n=name(),s:any=made();delete s.migrations;delete s.quest;s.char.skills={basic:3,firstAid:1};s.char.skillPoints=0;
  const original=structuredClone(s);await raw(n,'main',s);const store=new SaveStore(n),loaded=await store.load();
  expect(loaded!.char.skillPoints).toBe(1);expect(await store.preUpgradeBackup()).toEqual(original);
  await store.save(loaded!);await store.load();expect(await store.preUpgradeBackup()).toEqual(original);
});
test('both invalid snapshots reject instead of inventing a new character',async()=>{
  const n=name();await raw(n,'main',{version:999});await raw(n,'backup',{version:999});
  await expect(new SaveStore(n).load()).rejects.toThrow();
});

test('overwriting a legacy main also preserves its untouched pre-upgrade copy',async()=>{
  const n=name(),old:any=made();delete old.migrations;delete old.quest;await raw(n,'main',old);
  const store=new SaveStore(n);await store.save(made());expect(await store.preUpgradeBackup()).toEqual(old);
});
test('v6.1 多角色：第 1 欄沿用舊存檔，各欄互不影響；刪除只影響自己那一欄',async()=>{
  const n=name(),old=made();await raw(n,'main',old);
  const store=new SaveStore(n);expect(await store.load()).toEqual(old);
  store.slot=2;expect(await store.load()).toBeNull();
  const second=R.createCharacter(R.newGame(),'第二隻',1,2);await store.save(second);
  expect(await raw(n,'main:2')).toEqual(second);expect(await raw(n,'main')).toEqual(old);
  const list=await store.summaries();expect(list).toHaveLength(6);
  expect(list[0]).toMatchObject({empty:false,name:'測試者',job:'novice'});expect(list[2]).toMatchObject({empty:false,name:'第二隻'});expect(list[1].empty).toBe(true);
  await store.clear();expect(await store.load()).toBeNull();store.slot=0;expect(await store.load()).toEqual(old);
});
