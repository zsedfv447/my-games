// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import type { Router } from '../src/ui/router';
let router:Router|undefined;
afterEach(()=>{router?.stop();router=undefined;vi.restoreAllMocks();vi.unstubAllGlobals();document.body.replaceChildren();});
async function boot(){
 vi.resetModules();localStorage.clear();sessionStorage.clear();history.replaceState(null,'','#/collection');
 const backing=localStorage,writes:{key:string;value:string|null}[]=[];
 vi.stubGlobal('localStorage',{getItem:(k:string)=>backing.getItem(k),setItem:(k:string,v:string)=>{writes.push({key:k,value:v});backing.setItem(k,v);},removeItem:(k:string)=>{writes.push({key:k,value:null});backing.removeItem(k);}});
 const state=await import('../src/ui/state');const save=structuredClone(state.getSave());save.tutorial={step:'done',giftGiven:true};save.progress.tutorialDone=true;const base=save.inventory.cards[0];
 // Test-only owned Nordic lineup; this is not a naturally acquired user's account.
 save.inventory.cards=['c801','c802','c803','c804','c805'].map((cardId,i)=>({...base,uid:`image-${i}`,cardId}));save.teams[0].members=save.inventory.cards.map(c=>c.uid);state.commit(save);
 const {startApp}=await import('../src/ui/app');const host=document.createElement('div');document.body.append(host);router=startApp(host);
 const {gameData}=await import('../src/data/load');const art=await import('../src/ui/components/card-thumb');
 const bytes=()=>JSON.stringify(Array.from({length:backing.length},(_,i)=>{const key=backing.key(i)!;return[key,backing.getItem(key)];}).sort());
 // Initialization storage availability probes and explicit fixture commit precede baseline.
 writes.length=0;return{state,host,gameData,art,bytes,writes};
}
for(const entry of ['collection','collection-card','team'] as const)it(`${entry} actual DOM uses selected card URLs and lazy images, with no navigation save effects`,async()=>{
 const f=await boot(),before=JSON.stringify(f.state.getSave()),disk=f.bytes();
 const args=entry==='collection-card'?['c806']:[];router!.replace(entry,args);await vi.waitFor(()=>expect(f.host.querySelector(`main > [data-screen="${entry}"]`)).not.toBeNull());expect(location.hash).toBe(entry==='collection-card'?'#/collection-card/c806':`#/${entry}`);
 const root=f.host.querySelector<HTMLElement>(`main > [data-screen="${entry}"]`)!;const images=[...root.querySelectorAll<HTMLImageElement>('.card-thumb img,.card-portrait img')];
 expect(images.every(img=>img.getAttribute('loading')==='lazy')).toBe(true);expect(images.every(img=>img.getAttribute('alt')!.length>0)).toBe(true);
 if(entry==='collection'){
  expect(images).toHaveLength(120);const urls=new Set(images.map(img=>img.getAttribute('src')));expect(urls.size).toBe(112);expect(root.querySelectorAll('.card-portrait img')).toHaveLength(0);
  const actualSelected=new Set(f.gameData.cards.map(card=>f.art.cardIconUrl(card)??f.art.cardPortraitUrl(card)));expect(urls).toEqual(actualSelected);
  // Repeated milestone thumbs count as DOM references, not additional unique files/downloads.
  expect(images.length-urls.size).toBe(8);
 }else if(entry==='collection-card'){
  expect(images).toHaveLength(1);expect(root.querySelectorAll('.card-portrait img')).toHaveLength(1);const card=f.gameData.cards.find(c=>c.id==='c806')!;expect(images[0].getAttribute('src')).toBe(f.art.cardPortraitUrl(card));expect(images[0].alt).toBe(card.name);expect(images[0].getAttribute('src')).not.toBe(f.art.cardIconUrl(card));
 }else{
  expect(images).toHaveLength(5);expect(root.querySelectorAll('.card-portrait img')).toHaveLength(0);const expected=['c801','c802','c803','c804','c805'].map(id=>f.art.cardIconUrl(f.gameData.cards.find(c=>c.id===id)!));expect(images.map(img=>img.getAttribute('src'))).toEqual(expected);expect(new Set(expected).size).toBe(5);
 }
 expect(JSON.stringify(f.state.getSave())).toBe(before);expect(f.bytes()).toBe(disk);expect(f.writes).toEqual([]);expect(f.state.getSave().activeBattle).toBeNull();
});
