// @vitest-environment happy-dom
import {afterEach,expect,it,vi} from 'vitest';
import type {Router} from '../src/ui/router';
let router:Router|undefined;
afterEach(()=>{router?.stop();router=undefined;vi.restoreAllMocks();vi.unstubAllGlobals();document.body.replaceChildren();});
async function boot(mode:'open'|'claimed'|'locked'|'closed'='open',material=false){
 vi.resetModules();vi.spyOn(Date,'now').mockReturnValue(new Date(2026,mode==='closed'?10:9,mode==='closed'?4:28,12).getTime());localStorage.clear();sessionStorage.clear();
 const backing=localStorage,writes:{key:string;value:string|null}[]=[];vi.stubGlobal('localStorage',{getItem:(k:string)=>backing.getItem(k),setItem:(k:string,v:string)=>{writes.push({key:k,value:v});backing.setItem(k,v);},removeItem:(k:string)=>{writes.push({key:k,value:null});backing.removeItem(k);}});
 const session=sessionStorage,sessionWrites:string[]=[];vi.stubGlobal('sessionStorage',{getItem:(k:string)=>session.getItem(k),setItem:(k:string,v:string)=>{sessionWrites.push(k);session.setItem(k,v);},removeItem:(k:string)=>{sessionWrites.push(k);session.removeItem(k);}});
 const state=await import('../src/ui/state'),{gameData}=await import('../src/data/load');const stage=gameData.stages.find(s=>s.id==='nm-ironwall-3')!,s=structuredClone(state.getSave());s.tutorial={step:'done',giftGiven:true};s.progress.tutorialDone=true;s.progress.storySeen=Object.keys(gameData.story);s.progress.clearedStages=mode==='locked'?['st-3-1']:['st-3-1','nm-ironwall-1','nm-ironwall-2'];
 if(mode==='claimed'){const {eventPeriodKey}=await import('../src/progression/events');const event=gameData.events.find(e=>e.id===stage.event)!;s.quests.counters[`periodClear:${stage.id}${eventPeriodKey(event,Date.now())}`]=1;s.progress.clearedStages.push(stage.id);}
 if(material){const base=s.inventory.cards[0];s.inventory.cards.push({...base,uid:'evo509',cardId:'c509'});}
 state.commit(s);const {SAVE_KEY}=await import('../src/save/save');const before=structuredClone(state.getSave()),bytes=backing.getItem(SAVE_KEY);writes.length=0;
 history.replaceState(null,'',material?'#/evolve/evo509':'#/collection-card/c921');const {startApp}=await import('../src/ui/app');const host=document.createElement('div');document.body.append(host);router=startApp(host);
 const unchanged=()=>{expect(state.getSave()).toEqual(before);expect(backing.getItem(SAVE_KEY)).toBe(bytes);expect(writes).toEqual([]);expect(sessionWrites).toEqual([]);};
 const source=()=>{const matches=[...host.querySelectorAll<HTMLButtonElement>('.acquire-row')].filter(b=>b.querySelector('.acquire-title')?.textContent===stage.name);expect(matches.length,'actual periodic stage source').toBeGreaterThan(0);return matches[0];};
 return{host,state,stage,source,unchanged};
}
it('c921 detail exposes active periodic guaranteed source then real prepare and Back without reward/ownership/save writes',async()=>{
 const a=await boot();expect(a.stage.rewards.periodFirstClear?.cards).toContainEqual({card:'c921',count:1});expect(a.state.getSave().inventory.cards.some(c=>c.cardId==='c921')).toBe(false);const row=a.source();expect(row.textContent).toContain('本期首通必得（須通關）');expect(row.textContent).toContain('通關後領取');expect(row.querySelector('.acquire-state')?.textContent).toBe('可挑戰取得');a.unchanged();row.click();await vi.waitFor(()=>expect(a.host.querySelector('[data-screen="prepare"]')).not.toBeNull());expect(location.hash).toBe('#/prepare/nm-ironwall-3');expect(a.host.textContent).toContain('本週首通獎勵');expect(a.host.querySelector('[data-screen="prepare"] [aria-label="星輝結晶"]')).not.toBeNull();a.unchanged();router!.back();await vi.waitFor(()=>expect(a.host.querySelector('[data-screen="collection-card"]')).not.toBeNull());expect(location.hash).toBe('#/collection-card/c921');expect(a.source().classList.contains('unavailable')).toBe(false);a.unchanged();
});
it('claimed but playable source remains navigable without promising another current reward',async()=>{
 const a=await boot('claimed'),row=a.source();expect(row.classList.contains('unavailable')).toBe(true);expect(row.textContent).toContain('本期已領取');expect(row.textContent).not.toContain('可挑戰取得');row.click();await vi.waitFor(()=>expect(a.host.querySelector('[data-screen="prepare"]')).not.toBeNull());expect(location.hash).toBe('#/prepare/nm-ironwall-3');a.unchanged();
});
for(const mode of ['closed','locked'] as const)it(`${mode} source preserves restriction and navigates existing nemesis list, not departure`,async()=>{
 const a=await boot(mode),row=a.source();expect(row.classList.contains('unavailable')).toBe(true);expect(row.querySelector('.acquire-note')!.textContent).toContain(mode==='closed'?'活動未開放':'通過前一關後開放');expect(row.textContent).not.toContain('可挑戰取得');row.click();await vi.waitFor(()=>expect(a.host.querySelector('[data-screen="stages"]')).not.toBeNull());expect(location.hash).toBe('#/stages/nemesis');expect(a.host.querySelector('[data-screen="prepare"]')).toBeNull();a.unchanged();
});
it('actual evolution material source reaches same periodic stage without consuming material or evolving',async()=>{
 const a=await boot('open',true);const blocks=[...a.host.querySelectorAll<HTMLElement>('.acquire-material')];const block=blocks.find(b=>b.querySelector('[aria-label="蝕之星核"]')||b.textContent?.includes(a.state.growth.card('c920')!.name));expect(block).toBeDefined();const row=[...block!.querySelectorAll<HTMLButtonElement>('.acquire-row')].find(b=>b.querySelector('.acquire-title')?.textContent===a.stage.name);expect(row).toBeDefined();expect(row!.textContent).toContain('本期首通必得（須通關）');a.unchanged();row!.click();await vi.waitFor(()=>expect(a.host.querySelector('[data-screen="prepare"]')).not.toBeNull());expect(location.hash).toBe('#/prepare/nm-ironwall-3');a.unchanged();router!.back();await vi.waitFor(()=>expect(a.host.querySelector('[data-screen="evolve"]')).not.toBeNull());a.unchanged();
});
