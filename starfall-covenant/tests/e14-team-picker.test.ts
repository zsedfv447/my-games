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

it('new picker revokes old equip/remove and old close cannot dismiss replacement',async()=>{
 const {host,state,raw}=await boot();const old=picker(host);pickNamed(old,state.growth.card('c106')!.name);const fresh=picker(host,2),before=raw();
 btn(old,'換上').click();btn(old,'移出隊伍').click();btn(old,'關閉').click();expect(raw()).toBe(before);expect(fresh.classList.contains('closing')).toBe(false);
 pickNamed(fresh,state.growth.card('c106')!.name);btn(fresh,'換上').click();expect(state.getSave().teams[0].members[2]).toBe('spare');
});
for(const mode of ['picker','cost'] as const)it(`${mode} same-page changed lineup rejects without relying on route disposal`,async()=>{
 const {host,state,raw}=await boot();const old=picker(host);pickNamed(old,state.growth.card(mode==='cost'?'c101':'c106')!.name);if(mode==='cost')btn(old,'換上').click();const d=mode==='cost'?live(host,'隊伍空間不足'):old;
 const s=structuredClone(state.getSave());s.teams[0].members[2]=null;state.commit(s);const before=raw();btn(d,mode==='cost'?'換下並放入':'換上').click();expect(raw()).toBe(before);
});
it('unrelated preference save does not revoke valid picker and normal Cost handoff stays usable',async()=>{
 const {host,state}=await boot();const d=picker(host);pickNamed(d,state.growth.card('c101')!.name);state.commit({...state.getSave(),settings:{...state.getSave().settings,bgm:0.25}});btn(d,'換上').click();btn(live(host,'隊伍空間不足'),'換下並放入').click();expect(state.getSave().teams[0].members).toContain('expensive');
});
it('rename invalid input can retry; new dialog and same-page newer name revoke prior approval',async()=>{
 const {host,state,raw}=await boot();const old=rename(host);old.input.value='   ';old.ok.click();expect(old.dialog.classList.contains('closing')).toBe(false);old.input.value='合法';old.input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));expect(state.getSave().teams[0].name).toBe('合法');
 const stale=rename(host);stale.input.value='舊';const fresh=rename(host);fresh.input.value='新';const before=raw();stale.ok.click();stale.cancel.click();expect(raw()).toBe(before);expect(fresh.dialog.classList.contains('closing')).toBe(false);fresh.ok.click();expect(state.getSave().teams[0].name).toBe('新');
 const pending=rename(host);pending.input.value='過期';const s=structuredClone(state.getSave());s.teams[0].name='後來名稱';state.commit(s);const bytes=raw();pending.ok.click();expect(raw()).toBe(bytes);
});
it('stale candidate removed from inventory cannot be previewed or equipped',async()=>{
 const {host,state,raw}=await boot();const d=picker(host);const candidate=d.querySelector<HTMLButtonElement>(`.picker-grid [aria-label="${state.growth.card('c106')!.name}"]`)!;
 const s=structuredClone(state.getSave());s.inventory.cards=s.inventory.cards.filter(c=>c.uid!=='spare');state.commit(s);const before=raw();const errors:unknown[]=[];const catchError=(e:ErrorEvent)=>{errors.push(e.error);e.preventDefault();};window.addEventListener('error',catchError);try{candidate.click();expect(errors).toEqual([]);expect(raw()).toBe(before);expect(btn(d,'換上').disabled).toBe(true);}finally{window.removeEventListener('error',catchError);}
});
