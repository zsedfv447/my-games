// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import type { Router } from '../src/ui/router';
let router:Router|undefined;
afterEach(()=>{router?.stop();vi.restoreAllMocks();vi.unstubAllGlobals();document.body.replaceChildren();});
async function boot(unlocked=false){
 vi.resetModules();localStorage.clear();sessionStorage.clear();history.replaceState(null,'','#/archetypes/chain');const backing=localStorage,writes:string[]=[];vi.stubGlobal('localStorage',{getItem:(k:string)=>backing.getItem(k),setItem:(k:string,v:string)=>{writes.push(k);backing.setItem(k,v);},removeItem:(k:string)=>{writes.push(k);backing.removeItem(k);},key:(i:number)=>backing.key(i),get length(){return backing.length;}});const state=await import('../src/ui/state');const save=structuredClone(state.getSave());save.tutorial={step:'done',giftGiven:true};save.progress.tutorialDone=true;save.inventory.cards=[];save.collection={seen:[],owned:[],claimed:[]};save.teams.forEach(t=>t.members=[null,null,null,null,null]);save.progress.clearedStages=unlocked?['st-2-3']:[];state.commit(save);
 const {startApp}=await import('../src/ui/app');const host=document.createElement('div');document.body.append(host);router=startApp(host);const {gameData}=await import('../src/data/load');writes.length=0;return{state,host,gameData,writes};
}
const storage=()=>JSON.stringify(Array.from({length:localStorage.length},(_,i)=>{const k=localStorage.key(i)!;return[k,localStorage.getItem(k)];}).sort());
it('unowned locked chain guide and all quickviews preserve actual Router context/scroll/save with Back',async()=>{
 const f=await boot();const root=f.host.querySelector<HTMLElement>('[data-screen="archetypes"]')!,guide=root.querySelector<HTMLDetailsElement>('[data-chain-tactics]')!;expect(guide).not.toBeNull();guide.open=true;await new Promise(r=>setTimeout(r,30));root.scrollTop=613;
 const before=JSON.stringify(f.state.getSave()),disk=storage();const links=[...guide.querySelectorAll<HTMLButtonElement>('[data-chain-card] button,[data-chain-comparison]')];expect(links).toHaveLength(8);
 for(const link of links){link.focus();link.click();expect(f.host.querySelector('[data-card-quickview]')).not.toBeNull();router!.back();await vi.waitFor(()=>expect(f.host.querySelector('[data-card-quickview]')).toBeNull());expect(location.hash).toBe('#/archetypes/chain');expect(root.scrollTop).toBe(613);expect(guide.open).toBe(true);expect(document.activeElement).toBe(link);}
 expect(JSON.stringify(f.state.getSave())).toBe(before);expect(storage()).toBe(disk);expect(f.writes).toEqual([]);expect(f.state.getSave().activeBattle).toBeNull();
 const trial=f.gameData.stages.find(s=>s.id==='trial-chain')!;const buttons=[...root.querySelectorAll<HTMLButtonElement>('button')].filter(b=>b.textContent===trial.name);expect(buttons).toHaveLength(1);expect(guide.contains(buttons[0])).toBe(false);buttons[0].click();await vi.waitFor(()=>expect(location.hash).toBe('#/prepare/trial-chain'));await vi.waitFor(()=>expect(f.host.querySelector('[data-screen="prepare"]')).not.toBeNull());
 const start=[...f.host.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent?.startsWith('出發'))!;start.click();await vi.waitFor(()=>expect(f.host.textContent).toContain('還沒解鎖這一關'));expect(location.hash).toBe('#/prepare/trial-chain');expect(f.state.getSave().activeBattle).toBeNull();expect(JSON.stringify(f.state.getSave())).toBe(before);expect(f.writes).toEqual([]);
});
it('existing unlocked trial entry reaches normal prepare without auto-start or guide rewards',async()=>{
 const f=await boot(true),before=JSON.stringify(f.state.getSave());const trial=f.gameData.stages.find(s=>s.id==='trial-chain')!;[...f.host.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent===trial.name)!.click();await vi.waitFor(()=>expect(f.host.querySelector('[data-screen="prepare"]')).not.toBeNull());expect(f.host.textContent).not.toContain('還沒解鎖這一關');expect(f.host.textContent).toContain('借用');expect(f.state.getSave().activeBattle).toBeNull();expect(JSON.stringify(f.state.getSave())).toBe(before);expect(f.writes).toEqual([]);
});
