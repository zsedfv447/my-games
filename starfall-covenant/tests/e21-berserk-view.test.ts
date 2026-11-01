// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import type { Router } from '../src/ui/router';
let router:Router|undefined;
afterEach(()=>{router?.stop();vi.restoreAllMocks();vi.unstubAllGlobals();document.body.replaceChildren();});
async function boot(unlocked=false){
 vi.resetModules();localStorage.clear();sessionStorage.clear();history.replaceState(null,'','#/archetypes/berserk');const backing=localStorage,writes:string[]=[];vi.stubGlobal('localStorage',{getItem:(k:string)=>backing.getItem(k),setItem:(k:string,v:string)=>{writes.push(k);backing.setItem(k,v);},removeItem:(k:string)=>{writes.push(k);backing.removeItem(k);},key:(i:number)=>backing.key(i),get length(){return backing.length;}});const state=await import('../src/ui/state');const save=structuredClone(state.getSave());save.tutorial={step:'done',giftGiven:true};save.progress.tutorialDone=true;save.inventory.cards=[];save.collection={seen:[],owned:[],claimed:[]};save.teams.forEach(t=>t.members=[null,null,null,null,null]);save.progress.clearedStages=unlocked?['st-2-5']:[];state.commit(save);
 const {startApp}=await import('../src/ui/app');const host=document.createElement('div');document.body.append(host);router=startApp(host);const {gameData}=await import('../src/data/load');writes.length=0;return{state,host,gameData,writes};
}
const storage=()=>JSON.stringify(Array.from({length:localStorage.length},(_,i)=>{const k=localStorage.key(i)!;return[k,localStorage.getItem(k)];}).sort());
const summary='依隊長技的低血量門檻取得加成，不是每少一點生命都會增加倍率。';
const how='主動技補血或自損會先改變血線；轉珠攻擊按本回合心珠回復前的生命判定隊長門檻，因此同回合消心回復不會取消已算出的這次攻擊加成。仍須評估敵人下一次攻擊，低血量不等於安全。';
it('unowned berserk central copy is readable through actual codex/prepare; locked departure and Back do not write',async()=>{
 const f=await boot(),before=JSON.stringify(f.state.getSave()),disk=storage();let root=f.host.querySelector<HTMLElement>('[data-screen="archetypes"]')!;const section=root.querySelector('[data-archetype-section="berserk"]')!;expect(section.textContent).toContain(summary);expect(section.textContent).toContain(how);await new Promise(r=>setTimeout(r,30));root.scrollTop=521;
 const trial=f.gameData.stages.find(s=>s.id==='trial-berserk')!;[...section.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent===trial.name)!.click();await vi.waitFor(()=>expect(f.host.querySelector('[data-screen="prepare"]')).not.toBeNull());expect(location.hash).toBe('#/prepare/trial-berserk');expect(f.host.textContent).toContain(how);expect(f.host.textContent).toContain('借用隊伍');
 const leader=f.gameData.cards.find(c=>c.id==='c109')!;expect(f.host.textContent).toContain(f.gameData.leaderSkills.find(l=>l.id===leader.leaderSkill)!.description);
 f.host.querySelector<HTMLButtonElement>('[data-tut="sortie"] button')!.click();await vi.waitFor(()=>expect(f.host.textContent).toContain('還沒解鎖這一關'));expect(location.hash).toBe('#/prepare/trial-berserk');expect(f.state.getSave().activeBattle).toBeNull();
 router!.back();await vi.waitFor(()=>expect(f.host.querySelector('[data-screen="archetypes"]')).not.toBeNull());root=f.host.querySelector<HTMLElement>('[data-screen="archetypes"]')!;expect(location.hash).toBe('#/archetypes/berserk');expect(root.scrollTop).toBe(521);expect(root.querySelector('[data-archetype-section="berserk"]')?.textContent).toContain(how);expect(JSON.stringify(f.state.getSave())).toBe(before);expect(storage()).toBe(disk);expect(f.writes).toEqual([]);
});
it('unlocked original prepare remains borrowed and read-only, without starting or giving cards',async()=>{
 const f=await boot(true),before=JSON.stringify(f.state.getSave()),disk=storage();router!.go('prepare',['trial-berserk']);await vi.waitFor(()=>expect(f.host.querySelector('[data-screen="prepare"]')).not.toBeNull());expect(f.host.textContent).toContain(how);expect(f.host.textContent).toContain('借用隊伍');expect(f.state.getSave().activeBattle).toBeNull();expect(JSON.stringify(f.state.getSave())).toBe(before);expect(storage()).toBe(disk);expect(f.writes).toEqual([]);
});
