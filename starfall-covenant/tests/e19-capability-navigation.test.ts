// @vitest-environment happy-dom
import {afterEach,expect,it,vi} from 'vitest';
import type {Router} from '../src/ui/router';
let router:Router|undefined;
afterEach(()=>{router?.stop();router=undefined;vi.restoreAllMocks();vi.unstubAllGlobals();document.body.replaceChildren();});
const btn=(root:ParentNode,text:string)=>{const b=[...root.querySelectorAll<HTMLButtonElement>('button')].find(x=>x.textContent===text);expect(b,text).toBeDefined();return b!;};
const defense=(host:HTMLElement)=>{const d=host.querySelector<HTMLDetailsElement>('details[data-capability="defense"]');expect(d).not.toBeNull();return d!;};
const c405Leader=(host:HTMLElement)=>host.querySelector<HTMLElement>('[data-capability="defense"] [data-capability-card="c405"][data-capability-source="leader"]');
async function boot(){
 vi.resetModules();localStorage.clear();sessionStorage.clear();history.replaceState(null,'','#/team');const backing=localStorage,writes:{key:string;value:string|null}[]=[];
 vi.stubGlobal('localStorage',{getItem:(k:string)=>backing.getItem(k),setItem:(k:string,v:string)=>{writes.push({key:k,value:v});backing.setItem(k,v);},removeItem:(k:string)=>{writes.push({key:k,value:null});backing.removeItem(k);}});
 const session=sessionStorage,sessionWrites:string[]=[];vi.stubGlobal('sessionStorage',{getItem:(k:string)=>session.getItem(k),setItem:(k:string,v:string)=>{sessionWrites.push(k);session.setItem(k,v);},removeItem:(k:string)=>{sessionWrites.push(k);session.removeItem(k);}});
 const state=await import('../src/ui/state');const s=structuredClone(state.getSave());s.tutorial={step:'done',giftGiven:true};s.progress.tutorialDone=true;const template=s.inventory.cards[0];
 s.inventory.cards.push({...template,uid:'dragon405',cardId:'c405'},{...template,uid:'beast206',cardId:'c206'},{...template,uid:'dragon107',cardId:'c107'});
 s.teams[0].members=['dragon405','beast206',null,null,null];s.teams[1].members=['dragon405','dragon107',null,null,null];s.teams[2].members=['dragon107','dragon405',null,null,null];s.activeTeam=0;state.commit(s);
 const {startApp}=await import('../src/ui/app');const host=document.createElement('div');document.body.append(host);router=startApp(host);const {SAVE_KEY}=await import('../src/save/save');writes.length=0;sessionWrites.length=0;
 const baseline=()=>({save:structuredClone(state.getSave()),bytes:backing.getItem(SAVE_KEY)});
 const unchanged=(before:ReturnType<typeof baseline>)=>{expect(state.getSave()).toEqual(before.save);expect(backing.getItem(SAVE_KEY)).toBe(before.bytes);expect(writes).toEqual([]);expect(sessionWrites).toEqual([]);};
 return{host,state,writes,sessionWrites,SAVE_KEY,baseline,unchanged};
}
it('actual mixed c405 team sources expand/close and route back read-only without unconditional defense claim',async()=>{
 const a=await boot(),before=a.baseline();const d=defense(a.host);expect(d.open).toBe(false);expect(d.querySelector('summary')?.textContent).not.toContain('✓');d.querySelector('summary')!.click();expect(d.open).toBe(true);
 expect(c405Leader(a.host)?.dataset.capabilityStatus).toBe('blocked-lineup');expect(c405Leader(a.host)?.textContent).toContain('目前編成不符');expect(d.textContent).toContain(a.state.growth.leaderSkill('l405')!.description);a.unchanged(before);
 d.querySelector('summary')!.click();expect(d.open).toBe(false);router!.go('settings');router!.back();await vi.waitFor(()=>expect(a.host.querySelector('[data-screen="team"]')).not.toBeNull());expect(location.hash).toBe('#/team');expect(c405Leader(a.host)?.dataset.capabilityStatus).toBe('blocked-lineup');a.unchanged(before);
});
it('actual team tabs update blocked→helper-pending→ordinary-member without stale leader source',async()=>{
 const a=await boot();expect(c405Leader(a.host)?.dataset.capabilityStatus).toBe('blocked-lineup');const before=a.baseline().save;
 btn(a.host,'隊伍 2').click();expect(a.state.getSave()).toEqual({...before,activeTeam:1});expect(a.writes).toHaveLength(1);expect(a.writes[0].key).toBe(a.SAVE_KEY);expect(c405Leader(a.host)?.dataset.capabilityStatus).toBe('conditional');
 expect(c405Leader(a.host)?.textContent).toContain('助戰');a.writes.length=0;const reading=a.baseline();defense(a.host).querySelector('summary')!.click();a.unchanged(reading);
 btn(a.host,'隊伍 3').click();expect(a.state.getSave()).toEqual({...before,activeTeam:2});expect(a.writes).toHaveLength(1);expect(c405Leader(a.host)).toBeNull();a.writes.length=0;const third=a.baseline();defense(a.host).querySelector('summary')!.click();a.unchanged(third);
});
it('real remove member redraws composition sources; cancellation and subsequent reading never write',async()=>{
 const a=await boot(),before=a.baseline();const slot=()=>a.host.querySelectorAll<HTMLButtonElement>('.team-slot .card-thumb')[1];slot().click();let d=a.host.querySelector<HTMLElement>('[role="dialog"][aria-label="選擇第 2 位隊員"]:not(.closing)')!;btn(d,'關閉').click();a.unchanged(before);expect(c405Leader(a.host)?.dataset.capabilityStatus).toBe('blocked-lineup');
 slot().click();d=a.host.querySelector<HTMLElement>('[role="dialog"][aria-label="選擇第 2 位隊員"]:not(.closing)')!;btn(d,'移出隊伍').click();const expected=structuredClone(before.save);expected.teams[0].members[1]=null;expect(a.state.getSave()).toEqual(expected);expect(a.writes).toHaveLength(1);expect(a.writes[0].key).toBe(a.SAVE_KEY);expect(c405Leader(a.host)?.dataset.capabilityStatus).toBe('conditional');
 a.writes.length=0;const after=a.baseline();defense(a.host).querySelector('summary')!.click();expect(c405Leader(a.host)?.textContent).toContain('助戰');a.unchanged(after);
});
