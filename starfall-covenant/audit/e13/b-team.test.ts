import {afterEach,expect,it,vi} from 'vitest';
import type {Router} from '../../src/ui/router';
let router:Router|undefined;
afterEach(()=>{router?.stop();router=undefined;vi.restoreAllMocks();document.body.replaceChildren();});
const wait=(ms:number)=>new Promise(r=>setTimeout(r,ms));
const btn=(root:ParentNode,name:string)=>{const b=[...root.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent===name);expect(b,`button ${name}`).toBeDefined();return b!;};
const live=(host:HTMLElement,name:string)=>{const d=[...host.querySelectorAll<HTMLElement>('[role="dialog"]')].find(d=>d.getAttribute('aria-label')===name&&!d.classList.contains('closing'));expect(d,`dialog ${name}`).toBeDefined();return d!;};
async function boot(route='team'){
 vi.resetModules();localStorage.clear();history.replaceState(null,'',`#/${route}`);const state=await import('../../src/ui/state');const s=structuredClone(state.getSave());s.tutorial={step:'done',giftGiven:true};s.progress.tutorialDone=true;s.progress.clearedStages=['st-1-1'];const base=s.inventory.cards[0];
 // Explicit inventory fixture: cheap swap, over-Cost candidate, and feed material.
 s.inventory.cards.push({...base,uid:'spare',cardId:'c106',locked:true},{...base,uid:'expensive',cardId:'c101'},{...base,uid:'food',cardId:'c901'});state.commit(s);
 const {startApp}=await import('../../src/ui/app');const host=document.createElement('div');document.body.append(host);router=startApp(host);const {SAVE_KEY}=await import('../../src/save/save');return{state,host,raw:()=>localStorage.getItem(SAVE_KEY)};
}
function rename(host:HTMLElement){host.querySelector<HTMLButtonElement>('.team-name')!.click();const dialog=live(host,'隊伍名稱');return{dialog,input:dialog.querySelector('input')!,ok:btn(dialog,'確定'),cancel:btn(dialog,'取消')};}
function picker(host:HTMLElement,slot=1){host.querySelectorAll<HTMLButtonElement>('.team-slot .card-thumb')[slot].click();return live(host,slot===0?'選擇隊長':`選擇第 ${slot+1} 位隊員`);}
function pickNamed(dialog:HTMLElement,name:string){const b=dialog.querySelector<HTMLButtonElement>(`.picker-grid [aria-label="${name}"]`);expect(b).not.toBeNull();b!.click();return b!;}
for(const method of ['button','Enter'] as const){
 const accept=(own:ReturnType<typeof rename>)=>method==='button'?own.ok.click():own.input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
 it(`rename ${method} normal updates only intended team`,async()=>{const {state,host}=await boot();const own=rename(host);own.input.value='測試隊';accept(own);expect(state.getSave().teams[0].name).toBe('測試隊');expect(state.getSave().teams[1].name).toBe('隊伍2');});
 for(const ending of ['cancel','leave','replaceTeam'] as const)it(`rename ${method} ${ending} rejects retained callback`,async()=>{
 const {state,host,raw}=await boot();const own=rename(host);own.input.value='舊操作';
 if(ending==='cancel'){own.cancel.click();await wait(50);}else if(ending==='leave'){router!.replace('settings');await wait(200);}else{const s=structuredClone(state.getSave());s.teams[0].name='新操作';state.commit(s);router!.replace('team');}
 const before=JSON.stringify(state.getSave()),bytes=raw();accept(own);expect(JSON.stringify(state.getSave())).toBe(before);expect(raw()).toBe(bytes);
 });
}
it('team picker preview is read-only, locked card remains legal to equip, removal preserves leader',async()=>{
 const {state,host,raw}=await boot();const d=picker(host),before=raw();pickNamed(d,state.growth.card('c106')!.name);expect(raw()).toBe(before);btn(d,'換上').click();expect(state.getSave().teams[0].members[1]).toBe('spare');const next=picker(host);btn(next,'移出隊伍').click();expect(state.getSave().teams[0].members[1]).toBeNull();expect(state.getSave().teams[0].members[0]).toBe('u1');const lead=picker(host,0);expect([...lead.querySelectorAll('button')].some(b=>b.textContent==='移出隊伍')).toBe(false);
});
for(const ending of ['cancel','leave','switchTeam','replaceLineup'] as const)it(`team picker ${ending} rejects old equip/remove`,async()=>{
 const {state,host,raw}=await boot();const d=picker(host);pickNamed(d,state.growth.card('c106')!.name);const equip=btn(d,'換上'),remove=btn(d,'移出隊伍');
 if(ending==='cancel'){btn(d,'關閉').click();await wait(50);}else if(ending==='leave'){router!.replace('settings');await wait(200);}else{const s=structuredClone(state.getSave());if(ending==='switchTeam')s.activeTeam=1;else s.teams[0].members[1]=null;state.commit(s);router!.replace('team');}
 const before=JSON.stringify(state.getSave()),bytes=raw();equip.click();expect.soft(JSON.stringify(state.getSave())).toBe(before);expect.soft(raw()).toBe(bytes);remove.click();expect(JSON.stringify(state.getSave())).toBe(before);expect(raw()).toBe(bytes);
});
async function costDialog(){const app=await boot();const d=picker(app.host);pickNamed(d,app.state.growth.card('c101')!.name);btn(d,'換上').click();return{...app,d:live(app.host,'隊伍空間不足')};}
it('Cost suggestion normal respects 33 limit and retains leader',async()=>{const {state,d}=await costDialog();btn(d,'換下並放入').click();const ids=state.getSave().teams[0].members;expect(ids[0]).toBe('u1');expect(ids).toContain('expensive');const total=ids.reduce((n,uid)=>n+(uid?state.growth.card(state.getSave().inventory.cards.find(c=>c.uid===uid)!.cardId)!.cost:0),0);expect(total).toBeLessThanOrEqual(33);});
for(const ending of ['cancel','leave','replaceLineup'] as const)it(`Cost suggestion ${ending} cannot commit captured lineup`,async()=>{const {state,d,raw}=await costDialog();const ok=btn(d,'換下並放入');if(ending==='cancel'){btn(d,'取消').click();await wait(50);}else if(ending==='leave'){router!.replace('settings');await wait(200);}else{const s=structuredClone(state.getSave());s.teams[0].members=['u1',null,null,null,null];state.commit(s);router!.replace('team');}const before=JSON.stringify(state.getSave()),bytes=raw();ok.click();expect(JSON.stringify(state.getSave())).toBe(before);expect(raw()).toBe(bytes);});
for(const ending of ['normal','cancel','leave'] as const)it(`cards material-target picker ${ending} navigation`,async()=>{const {host,state,raw}=await boot('card/food');btn(host,'去強化').click();const d=live(host,'要強化哪一張卡？'),candidate=d.querySelector<HTMLButtonElement>('.picker-grid .card-thumb')!;if(ending==='cancel'){btn(d,'關閉').click();await wait(50);}else if(ending==='leave'){router!.replace('settings');await wait(200);}const hash=location.hash,before=JSON.stringify(state.getSave()),bytes=raw();candidate.click();expect(JSON.stringify(state.getSave())).toBe(before);expect(raw()).toBe(bytes);if(ending==='normal'){expect(location.hash).toContain('#/enhance/');expect(location.hash).toContain('mat=food');}else expect(location.hash).toBe(hash);});
for(const ending of ['normal','cancel','leave','replacePicker'] as const)it(`oath ${ending}: module-memory selection lifecycle, not save`,async()=>{
 const {host,state,raw}=await boot('prepare/st-1-1');const oath=await import('../../src/ui/oath-stele');btn(host,'刻下誓約').click();const d=live(host,'誓約碑');d.querySelector<HTMLInputElement>('input')!.click();const ok=btn(d,'確定');
 if(ending==='cancel'){d.click();await wait(50);}else if(ending==='leave'){router!.replace('settings');await wait(200);}else if(ending==='replacePicker'){d.click();btn(host,'刻下誓約').click();const fresh=live(host,'誓約碑');fresh.querySelectorAll<HTMLInputElement>('input')[1].click();btn(fresh,'確定').click();}
 const before=JSON.stringify(state.getSave()),bytes=raw(),chosen=oath.chosenOaths('st-1-1'),hash=location.hash;ok.click();expect(JSON.stringify(state.getSave())).toBe(before);expect(raw()).toBe(bytes);
 if(ending==='normal')expect(oath.chosenOaths('st-1-1')).toHaveLength(1);else{expect(oath.chosenOaths('st-1-1')).toEqual(chosen);expect(location.hash).toBe(hash);}
});
