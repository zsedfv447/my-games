// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import type { Router } from '../src/ui/router';
let router:Router|undefined;
afterEach(()=>{router?.stop();router=undefined;vi.restoreAllMocks();document.body.replaceChildren();});
const wait=(ms:number)=>new Promise(r=>setTimeout(r,ms));
const force=(b:HTMLButtonElement)=>b.dispatchEvent(new MouseEvent('click',{bubbles:true}));
type Mode='enhance'|'evolve';
async function boot(mode:Mode) {
  vi.resetModules();localStorage.clear();history.replaceState(null,'',mode==='enhance'?'#/enhance/u1?mat=fixture-c811':'#/evolve/fixture-evo');
  const state=await import('../src/ui/state');const api=await import('../src/growth');const {expForLevel}=await import('../src/growth/level');
  const s=structuredClone(state.getSave());s.tutorial={step:'done',giftGiven:true};s.progress.tutorialDone=true;s.player.coin=100000;
  const base=s.inventory.cards[0];
  // Explicit isolated inventory fixtures, not cards obtained through gameplay.
  if(mode==='enhance')s.inventory.cards.push({...base,uid:'fixture-c811',cardId:'c811',locked:false});
  else {
    const def=state.growth.card('c102')!;
    s.inventory.cards.push({...base,uid:'fixture-evo',cardId:def.id,level:def.maxLevel,exp:expForLevel(def,def.maxLevel,state.growth.rules),skillLevel:2,limitBreak:1,awakened:1});
    for(let i=0;i<3;i++)s.inventory.cards.push({...base,uid:'fixture-mat'+i,cardId:'c916'});
  }
  state.commit(s);const {startApp}=await import('../src/ui/app');const host=document.createElement('div');document.body.append(host);router=startApp(host);
  const {SAVE_KEY}=await import('../src/save/save');const storage=vi.spyOn(localStorage,'setItem');const writes=()=>storage.mock.calls.filter(([k])=>k===SAVE_KEY);
  const open=async()=>{
    const action=host.querySelector<HTMLButtonElement>('.growth-action button')!;expect(action.disabled).toBe(false);action.click();
    const title=mode==='enhance'?'確認素材':'確認進化';
    const dialog=[...host.querySelectorAll<HTMLElement>('[role="dialog"]')].find(d=>d.getAttribute('aria-label')===title&&!d.classList.contains('closing'))!;expect(dialog).toBeDefined();
    return {dialog,confirm:[...dialog.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent===(mode==='enhance'?'確定強化':'進化'))!,cancel:[...dialog.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent==='取消')!};
  };
  return {state,api,host,writes,open};
}
for(const mode of ['enhance','evolve'] as const) {
  it(`${mode}: route leave closes pending confirmation and old callback cannot consume resources or navigate`,async()=>{
    const {state,writes,open}=await boot(mode);const old=await open();router!.replace('settings');await wait(200);
    expect.soft(old.dialog.isConnected).toBe(false);const before=JSON.stringify(state.getSave()),n=writes().length;
    old.confirm.click();force(old.confirm);await wait(20);
    expect(JSON.stringify(state.getSave())).toBe(before);expect(writes()).toHaveLength(n);expect(location.hash).toBe('#/settings');
  },20000);
  it(`${mode}: answer then leave in the same task revokes pending async continuation`,async()=>{
    const {state,writes,open}=await boot(mode);const old=await open();const before=JSON.stringify(state.getSave()),n=writes().length;
    old.confirm.click();router!.replace('settings');await wait(200);
    expect(JSON.stringify(state.getSave())).toBe(before);expect(writes()).toHaveLength(n);expect(location.hash).toBe('#/settings');
  },20000);
  it(`${mode}: cancel is read-only and new confirmation performs exactly the real growth result once`,async()=>{
    const {state,api,writes,open}=await boot(mode);const before=structuredClone(state.getSave());const old=await open();old.cancel.click();await wait(20);
    expect(state.getSave()).toEqual(before);expect(writes()).toHaveLength(0);
    const expected=mode==='enhance'?api.enhance(before,state.growth,'u1',['fixture-c811'],{confirmRisky:true}):api.evolve(before,state.growth,'fixture-evo',['fixture-mat0','fixture-mat1','fixture-mat2']);
    expect(expected.ok).toBe(true);if(!expected.ok)throw new Error(expected.error.message);
    const fresh=await open();force(old.confirm);force(old.cancel);fresh.confirm.click();await wait(20);
    expect(state.getSave()).toEqual(expected.save);expect(writes()).toHaveLength(1);
    const after=JSON.stringify(state.getSave());force(fresh.confirm);force(old.confirm);await wait(20);
    expect(JSON.stringify(state.getSave())).toBe(after);expect(writes()).toHaveLength(1);
  },20000);
}
