// @vitest-environment happy-dom
import {afterEach,expect,it,vi} from 'vitest';
import type {Router} from '../src/ui/router';
let router:Router|undefined;
afterEach(()=>{router?.stop();router=undefined;vi.restoreAllMocks();vi.unstubAllGlobals();document.body.replaceChildren();});
const wait=(ms:number)=>new Promise(r=>setTimeout(r,ms));
const btn=(root:ParentNode,name:string)=>{const b=[...root.querySelectorAll<HTMLButtonElement>('button')].find(x=>x.textContent===name);expect(b,name).toBeDefined();return b!;};
const live=(host:HTMLElement)=>{const d=host.querySelector<HTMLElement>('[role="dialog"][aria-label="誓約碑"]:not(.closing)');expect(d).not.toBeNull();return d!;};
const check=(d:HTMLElement,i:number)=>d.querySelectorAll<HTMLInputElement>('input')[i].click();
function open(host:HTMLElement){btn(host,host.querySelector('.oath-sortie-chip.on')?'修改誓約':'刻下誓約').click();return live(host);}
async function boot(){
 vi.resetModules();localStorage.clear();sessionStorage.clear();const backing=localStorage,writes:string[]=[];
 vi.stubGlobal('localStorage',{getItem:(k:string)=>backing.getItem(k),setItem:(k:string,v:string)=>{writes.push(`set:${k}`);backing.setItem(k,v);},removeItem:(k:string)=>{writes.push(`remove:${k}`);backing.removeItem(k);}});
 const state=await import('../src/ui/state');const s=structuredClone(state.getSave());s.tutorial={step:'done',giftGiven:true};s.progress.tutorialDone=true;s.progress.clearedStages=['st-1-1','st-1-2'];state.commit(s);
 history.replaceState(null,'','#/prepare/st-1-1');const {startApp}=await import('../src/ui/app');const host=document.createElement('div');document.body.append(host);router=startApp(host);
 const oath=await import('../src/ui/oath-stele'),{SAVE_KEY}=await import('../src/save/save');writes.length=0;const save=structuredClone(state.getSave()),bytes=backing.getItem(SAVE_KEY);
 const unchanged=()=>{expect(state.getSave()).toEqual(save);expect(backing.getItem(SAVE_KEY)).toBe(bytes);expect(writes).toEqual([]);};
 return{host,state,oath,unchanged};
}
it('real prepare oath preview/MAX3/confirm redraw and stage-aware memory; clear is only committed on approval',async()=>{
 const {host,oath,unchanged}=await boot();const original=host.querySelector('[data-screen="prepare"]');const d=open(host);
 check(d,0);expect(d.textContent).toContain('通關（不續戰）可得');expect(d.textContent).toContain('金幣');expect(oath.chosenOaths('st-1-1')).toEqual([]);unchanged();
 check(d,1);check(d,2);expect(d.textContent).toContain('已選 3/3');expect(d.querySelectorAll<HTMLInputElement>('input')[3].disabled).toBe(true);check(d,3);expect([...d.querySelectorAll<HTMLInputElement>('input')].filter(x=>x.checked)).toHaveLength(3);
 btn(d,'確定').click();expect(oath.chosenOaths('st-1-1')).toEqual(['noSkill','shortMove','noHearts']);expect(host.querySelector('[data-screen="prepare"]')).not.toBe(original);expect(location.hash).toBe('#/prepare/st-1-1');unchanged();
 router!.replace('prepare',['st-1-2']);expect(oath.chosenOaths('st-1-2')).toEqual([]);router!.replace('prepare',['st-1-1']);expect(host.querySelector('.oath-sortie-chip')?.textContent).toContain('3 條');
 const next=open(host);btn(next,'清除').click();expect(next.textContent).toContain('已選 0/3');expect(oath.chosenOaths('st-1-1')).toHaveLength(3);btn(next,'確定').click();expect(oath.chosenOaths('st-1-1')).toEqual([]);expect(host.querySelector('.oath-sortie-chip')?.textContent).toBe('刻下誓約');unchanged();
});
for(const ending of ['cancel','leave'] as const)it(`oath ${ending} revokes stale clear/confirm and permits a valid retry without save writes`,async()=>{
 const {host,oath,unchanged}=await boot();const d=open(host);check(d,0);const clear=btn(d,'清除'),ok=btn(d,'確定');
 if(ending==='cancel'){d.click();await wait(50);}else{router!.replace('settings');await wait(200);}
 const hash=location.hash,text=d.textContent;clear.click();expect.soft(d.textContent).toBe(text);ok.click();expect(oath.chosenOaths('st-1-1')).toEqual([]);expect(location.hash).toBe(hash);unchanged();
 if(ending==='leave')router!.replace('prepare',['st-1-1']);const fresh=open(host);check(fresh,1);btn(fresh,'確定').click();expect(oath.chosenOaths('st-1-1')).toEqual(['shortMove']);unchanged();
});
it('same-page new picker revokes old callbacks before and after replacement approval',async()=>{
 const {host,oath,unchanged}=await boot();const old=open(host);check(old,0);const fresh=open(host);check(fresh,1);const text=old.textContent;
 btn(old,'清除').click();expect.soft(old.textContent).toBe(text);btn(old,'確定').click();expect(oath.chosenOaths('st-1-1')).toEqual([]);expect(fresh.classList.contains('closing')).toBe(false);unchanged();
 btn(fresh,'確定').click();expect(oath.chosenOaths('st-1-1')).toEqual(['shortMove']);const screen=host.querySelector('[data-screen="prepare"]');btn(old,'確定').click();expect(oath.chosenOaths('st-1-1')).toEqual(['shortMove']);expect(host.querySelector('[data-screen="prepare"]')).toBe(screen);unchanged();
});
it('consumed confirmation cannot redraw or overwrite a newer same-stage selection',async()=>{
 const {host,oath,unchanged}=await boot();const first=open(host);check(first,0);const oldOk=btn(first,'確定');oldOk.click();const second=open(host);btn(second,'清除').click();check(second,1);btn(second,'確定').click();const screen=host.querySelector('[data-screen="prepare"]');oldOk.click();expect(oath.chosenOaths('st-1-1')).toEqual(['shortMove']);expect(host.querySelector('[data-screen="prepare"]')).toBe(screen);unchanged();
});
