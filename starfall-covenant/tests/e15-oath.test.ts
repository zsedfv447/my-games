// @vitest-environment happy-dom
import {afterEach,expect,it,vi} from 'vitest';
import type {Router} from '../src/ui/router';
let router:Router|undefined;
afterEach(()=>{router?.stop();router=undefined;vi.restoreAllMocks();document.body.replaceChildren();});
const wait=(ms:number)=>new Promise(r=>setTimeout(r,ms));
const btn=(root:ParentNode,name:string)=>{const b=[...root.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent===name);expect(b,`button ${name}`).toBeDefined();return b!;};
const live=(host:HTMLElement,name:string)=>{const d=[...host.querySelectorAll<HTMLElement>('[role="dialog"]')].find(d=>d.getAttribute('aria-label')===name&&!d.classList.contains('closing'));expect(d,`dialog ${name}`).toBeDefined();return d!;};
async function boot(route='team'){
 vi.resetModules();localStorage.clear();history.replaceState(null,'',`#/${route}`);const state=await import('../src/ui/state');const s=structuredClone(state.getSave());s.tutorial={step:'done',giftGiven:true};s.progress.tutorialDone=true;s.progress.clearedStages=['st-1-1'];const base=s.inventory.cards[0];
 // Explicit inventory fixture: cheap swap, over-Cost candidate, and feed material.
 s.inventory.cards.push({...base,uid:'spare',cardId:'c106',locked:true},{...base,uid:'expensive',cardId:'c101'},{...base,uid:'food',cardId:'c901'});state.commit(s);
 const {startApp}=await import('../src/ui/app');const host=document.createElement('div');document.body.append(host);router=startApp(host);const {SAVE_KEY}=await import('../src/save/save');return{state,host,raw:()=>localStorage.getItem(SAVE_KEY)};
}
for(const ending of ['normal','cancel','leave','replacePicker'] as const)it(`oath ${ending}: module-memory selection lifecycle, not save`,async()=>{
 const {host,state,raw}=await boot('prepare/st-1-1');const oath=await import('../src/ui/oath-stele');btn(host,'刻下誓約').click();const d=live(host,'誓約碑');d.querySelector<HTMLInputElement>('input')!.click();const ok=btn(d,'確定');
 if(ending==='cancel'){d.click();await wait(50);}else if(ending==='leave'){router!.replace('settings');await wait(200);}else if(ending==='replacePicker'){d.click();btn(host,'刻下誓約').click();const fresh=live(host,'誓約碑');fresh.querySelectorAll<HTMLInputElement>('input')[1].click();btn(fresh,'確定').click();}
 const before=JSON.stringify(state.getSave()),bytes=raw(),chosen=oath.chosenOaths('st-1-1'),hash=location.hash;ok.click();expect(JSON.stringify(state.getSave())).toBe(before);expect(raw()).toBe(bytes);
 if(ending==='normal')expect(oath.chosenOaths('st-1-1')).toHaveLength(1);else{expect(oath.chosenOaths('st-1-1')).toEqual(chosen);expect(location.hash).toBe(hash);}
});
it('replacement revokes old clear/toggle/confirm; MAX3 and valid clear/retry preserve stage memory without save', async () => {
 const {host,state,raw}=await boot('prepare/st-1-1');const oath=await import('../src/ui/oath-stele');
 btn(host,'刻下誓約').click();const old=live(host,'誓約碑'),oldClear=btn(old,'清除'),oldOk=btn(old,'確定'),oldToggle=old.querySelector<HTMLInputElement>('input')!;
 btn(host,'刻下誓約').click();const fresh=live(host,'誓約碑');expect(fresh).not.toBe(old);expect(old.classList.contains('closing')).toBe(true);
 for(let i=0;i<3;i++)fresh.querySelectorAll<HTMLInputElement>('input')[i].click();
 expect(fresh.querySelectorAll<HTMLInputElement>('input')[3].disabled).toBe(true);
 const preview=fresh.textContent,before=JSON.stringify(state.getSave()),bytes=raw();oldClear.click();oldToggle.click();oldOk.click();
 expect(fresh.textContent).toBe(preview);expect(fresh.classList.contains('closing')).toBe(false);
 btn(fresh,'確定').click();expect(oath.chosenOaths('st-1-1')).toHaveLength(3);expect(location.hash).toBe('#/prepare/st-1-1');
 expect(oath.chosenOaths('st-1-2')).toEqual([]);expect(JSON.stringify(state.getSave())).toBe(before);expect(raw()).toBe(bytes);
 // Actual onChange replaced prepare; reopening reads the committed module-only choice.
 await wait(1);btn(host,'修改誓約').click();const next=live(host,'誓約碑');expect(next.querySelectorAll('input:checked')).toHaveLength(3);
 btn(next,'清除').click();btn(next,'確定').click();expect(oath.chosenOaths('st-1-1')).toEqual([]);expect(JSON.stringify(state.getSave())).toBe(before);expect(raw()).toBe(bytes);
});
