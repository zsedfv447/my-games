// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import type { Router } from '../src/ui/router';
import type { SaveData } from '../src/core/types';
import type { Battle } from '../src/battle/battle-state';
let router:Router|undefined;
afterEach(()=>{router?.stop();router=undefined;vi.restoreAllMocks();vi.unstubAllGlobals();document.body.replaceChildren();});
const button=(root:ParentNode,text:string)=>{const b=[...root.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent===text);expect(b,text).toBeDefined();return b!;};
async function boot(){
 vi.resetModules();localStorage.clear();sessionStorage.clear();history.replaceState(null,'','#/prepare/st-1-1');
 vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(new Proxy({}, {get:(_t,k)=>k==='createLinearGradient'||k==='createRadialGradient'?()=>({addColorStop(){}}):()=>{}}) as CanvasRenderingContext2D);
 const {BoardView}=await import('../src/battle/view/board-view');vi.spyOn(BoardView.prototype as unknown as {draw():void},'draw').mockImplementation(()=>{});
 const backing=localStorage,payloads:SaveData[]=[];vi.stubGlobal('localStorage',{getItem:(k:string)=>backing.getItem(k),setItem:(k:string,v:string)=>{if(k.endsWith('starfall.save'))payloads.push(JSON.parse(v).data);backing.setItem(k,v);},removeItem:(k:string)=>backing.removeItem(k)});
 const state=await import('../src/ui/state');const s=structuredClone(state.getSave());s.tutorial={step:'done',giftGiven:true};s.progress.tutorialDone=true;s.progress.clearedStages=['st-1-1','st-2-9'];s.progress.storySeen=['ch1-open'];
 // Explicit isolated returning-player inventory/unlocks, not naturally earned or user grants.
 const base=s.inventory.cards[0];s.inventory.cards=[{...base,uid:'d',cardId:'c405'},{...base,uid:'x',cardId:'c107'}];s.teams[0].members=['d','x',null,null,null];state.commit(s);
 const engine=await import('../src/battle/battle-state'),start=vi.spyOn(engine,'startBattle');
 const {startApp}=await import('../src/ui/app');const host=document.createElement('div');document.body.append(host);router=startApp(host);
 const {HELPER_NPCS}=await import('../src/progression/helpers');const {chosenHelper}=await import('../src/ui/sortie');const {chosenOaths}=await import('../src/ui/oath-stele');
 let visibleSeen:string[]=[];
 const selectHelper=async()=>{const entry=[...host.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent==='更換助戰'||b.textContent==='選擇助戰')!;entry.click();await vi.waitFor(()=>expect(host.querySelector('.helper-row')).not.toBeNull());const visible=[...host.querySelectorAll<HTMLElement>('[data-support-id]')];expect(visible).toHaveLength(12);const {rosterFor}=await import('../src/ui/screens/helper');const {gameData}=await import('../src/data/load');visibleSeen=[...visible.map(row=>row.dataset.supportId!.slice('support:'.length)),...rosterFor(gameData.stages.find(s=>s.id==='st-1-1')!).map(o=>o.card.id)];const name=HELPER_NPCS.find(n=>n.id==='npc-combo')!.name;[...host.querySelectorAll<HTMLButtonElement>('.helper-row')].find(b=>b.textContent?.includes(name))!.click();await vi.waitFor(()=>expect(host.querySelector('[data-tut="sortie"] button')).not.toBeNull());};
 const openOath=()=>{const entry=[...host.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent==='刻下誓約'||b.textContent==='修改誓約')!;entry.click();return host.querySelector<HTMLElement>('[aria-label="誓約碑"]:not(.closing)')!;};
 const applyNoHelper=async()=>{const d=openOath();const field=[...d.querySelectorAll('label')].find(l=>l.textContent?.includes('孤行之誓'))!.parentElement!;field.querySelector<HTMLInputElement>('input')!.click();expect(d.textContent).toContain('通關（不續戰）');expect(d.textContent).toContain('金幣 400');button(d,'確定').click();await vi.waitFor(()=>expect(host.textContent).toContain('沒有帶助戰。'));};
 payloads.length=0;return{state,host,payloads,start,chosenHelper,chosenOaths,selectHelper,openOath,applyNoHelper,get visibleSeen(){return visibleSeen;}};
}
it('noHelper overrides remembered non-dragon helper and reselect; genuine paid ticket and engine keep helper absent',async()=>{
 const f=await boot();let before=structuredClone(f.state.getSave());await f.selectHelper();const seen=[...new Set([...before.collection.seen,...f.visibleSeen])];const expected={...before,collection:{...before.collection,seen}};expect(f.state.getSave()).toEqual(expected);for(const payload of f.payloads)expect(payload).toEqual(expected);before=structuredClone(f.state.getSave());f.payloads.length=0;expect(f.chosenHelper('st-1-1')?.card.id).toBe('c206');await f.applyNoHelper();await f.selectHelper();
 expect(f.chosenHelper('st-1-1')?.card.id).toBe('c206');expect(f.chosenOaths('st-1-1')).toEqual(['noHelper']);expect(f.host.textContent).toContain('沒有帶助戰。');expect(f.state.getSave()).toEqual(before);expect(f.payloads).toEqual([]);
 const stamina=before.stamina.current;f.host.querySelector<HTMLButtonElement>('[data-tut="sortie"] button')!.click();await vi.waitFor(()=>expect(f.state.getSave().activeBattle?.snapshot).toBeTruthy());
 const ticket=f.state.getSave().activeBattle!;expect(ticket.helper).toBeNull();expect(ticket.oaths).toEqual(['noHelper']);expect(ticket.snapshot!.state.team.map(c=>c.cardId)).toEqual(['c405','c107']);
 const actual=f.start.mock.results.at(-1)!.value as Battle;expect(actual.getState().team.map(c=>c.cardId)).toEqual(['c405','c107']);expect(f.state.getSave().teams).toEqual(before.teams);expect(f.state.getSave().stamina.current).toBe(stamina-3);expect(f.state.getSave().player).toEqual(before.player);expect(f.state.getSave().collection).toEqual(before.collection);
 expect(f.payloads.length).toBeGreaterThan(0);for(const s of f.payloads){expect(s.stamina.current).toBe(stamina-3);expect(s.player).toEqual(before.player);expect(s.teams).toEqual(before.teams);if(s.activeBattle){expect(s.activeBattle.helper).toBeNull();expect(s.activeBattle.oaths).toEqual(['noHelper']);}}
});
it('clearing noHelper restores remembered helper and normal paid roster without granting oath rewards',async()=>{
 const f=await boot();let before=structuredClone(f.state.getSave());await f.selectHelper();const seen=[...new Set([...before.collection.seen,...f.visibleSeen])];const expected={...before,collection:{...before.collection,seen}};expect(f.state.getSave()).toEqual(expected);for(const payload of f.payloads)expect(payload).toEqual(expected);before=structuredClone(f.state.getSave());f.payloads.length=0;await f.applyNoHelper();const d=f.openOath();button(d,'清除').click();button(d,'確定').click();await vi.waitFor(()=>expect(f.host.textContent).not.toContain('沒有帶助戰。'));
 expect(f.chosenOaths('st-1-1')).toEqual([]);expect(f.chosenHelper('st-1-1')?.card.id).toBe('c206');expect(f.state.getSave()).toEqual(before);expect(f.payloads).toEqual([]);
 f.host.querySelector<HTMLButtonElement>('[data-tut="sortie"] button')!.click();await vi.waitFor(()=>expect(f.state.getSave().activeBattle?.snapshot).toBeTruthy());const ticket=f.state.getSave().activeBattle!;expect(ticket.helper?.cardId).toBe('c206');expect(ticket.oaths??[]).toEqual([]);expect(ticket.snapshot!.state.team.map(c=>c.cardId)).toEqual(['c405','c107','c206']);expect((f.start.mock.results.at(-1)!.value as Battle).getState().team.map(c=>c.cardId)).toEqual(['c405','c107','c206']);expect(f.state.getSave().player).toEqual(before.player);expect(f.state.getSave().teams).toEqual(before.teams);expect(f.state.getSave().stamina.current).toBe(before.stamina.current-3);
 for(const s of f.payloads){expect(s.stamina.current).toBe(before.stamina.current-3);expect(s.player).toEqual(before.player);if(s.activeBattle)expect(s.activeBattle.helper?.cardId).toBe('c206');}
});
