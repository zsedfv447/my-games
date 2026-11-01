// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import type { Router } from '../src/ui/router';
let router: Router | undefined;
afterEach(() => { router?.stop(); router = undefined; vi.restoreAllMocks(); document.body.replaceChildren(); });
const wait = (ms:number) => new Promise(r => setTimeout(r,ms));
const force = (b:HTMLButtonElement) => b.dispatchEvent(new MouseEvent('click',{bubbles:true}));
async function boot(gems=100) {
  vi.resetModules(); localStorage.clear(); history.replaceState(null,'','#/summon');
  const state = await import('../src/ui/state');
  const save=structuredClone(state.getSave()); save.tutorial={step:'done',giftGiven:true}; save.progress.tutorialDone=true; save.player.gems=gems; state.commit(save);
  const {startApp}=await import('../src/ui/app'); const host=document.createElement('div'); document.body.append(host); router=startApp(host);
  const {SAVE_KEY}=await import('../src/save/save'); const storage=vi.spyOn(localStorage,'setItem');
  const writes=()=>storage.mock.calls.filter(([key])=>key===SAVE_KEY);
  const open=(count:1|10=1)=>{
    host.querySelectorAll<HTMLButtonElement>('.seal-pull-actions button')[count===1?0:1].click();
    const dialog=[...host.querySelectorAll<HTMLElement>('[role="dialog"]')].filter(d=>!d.classList.contains('closing')).at(-1)!;
    expect(dialog).toBeDefined();
    return {dialog,confirm:[...dialog.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent==='召喚')!,cancel:[...dialog.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent==='取消')!};
  };
  return {state,host,open,writes};
}
it('cancel revokes old normal confirm during the 50ms connected fade without any save write',async()=>{
  const {state,open,writes}=await boot(); const before=JSON.stringify(state.getSave()); const old=open(); old.cancel.click(); await wait(50);
  expect(old.confirm.isConnected).toBe(true); old.confirm.click(); force(old.confirm);
  expect(JSON.stringify(state.getSave())).toBe(before); expect(writes()).toHaveLength(0); expect(location.hash).toBe('#/summon');
},20000);
it('old cancel and old confirm cannot close or consume a newer confirmation',async()=>{
  const {state,open,writes}=await boot(); const before=JSON.stringify(state.getSave()); const old=open();old.cancel.click();const fresh=open();
  old.cancel.click(); force(old.cancel); old.confirm.click(); force(old.confirm);
  expect(fresh.dialog.classList.contains('closing')).toBe(false); expect(JSON.stringify(state.getSave())).toBe(before);expect(writes()).toHaveLength(0);
  fresh.confirm.click(); expect(state.getSave().player.gems).toBe(95);expect(state.getSave().gacha.history).toHaveLength(1);expect(writes().length).toBeGreaterThan(0);
},20000);
it.each([1,10] as const)('normal %i summon commits exactly once despite retained callback',async count=>{
  const {state,open,writes}=await boot();const before=state.getSave().inventory.cards.length;const own=open(count);own.confirm.click();const committed=JSON.stringify(state.getSave()),n=writes().length;own.confirm.click();force(own.confirm);force(own.cancel);expect(JSON.stringify(state.getSave())).toBe(committed);expect(writes()).toHaveLength(n);
  expect(state.getSave().player.gems).toBe(100-count*5);expect(state.getSave().inventory.cards).toHaveLength(before+count);expect(state.getSave().gacha.history).toHaveLength(count);expect(writes().every(([,raw])=>JSON.parse(raw).data.player.gems===100-count*5)).toBe(true);expect(location.hash).toBe('#/summon-ritual');
},20000);
it('insufficient gems consume no save and a fresh dialog can retry once funds exist',async()=>{
  const {state,open,writes}=await boot(4);const before=JSON.stringify(state.getSave());const failed=open();failed.confirm.click();
  expect(JSON.stringify(state.getSave())).toBe(before);expect(writes()).toHaveLength(0);
  const funded=structuredClone(state.getSave());funded.player.gems=5;state.commit(funded);const fresh=open();force(failed.confirm);force(failed.cancel);
  expect(fresh.dialog.classList.contains('closing')).toBe(false);fresh.confirm.click();expect(state.getSave().player.gems).toBe(0);expect(state.getSave().gacha.history).toHaveLength(1);expect(writes().length).toBeGreaterThan(1);
},20000);
it('route departure disposes session and old dialog callbacks cannot spend',async()=>{
  const {state,open,writes}=await boot();const old=open();router!.replace('settings');await wait(200);const before=JSON.stringify(state.getSave()),n=writes().length;
  expect(old.dialog.isConnected).toBe(false);old.confirm.click();force(old.confirm);force(old.cancel);
  expect(JSON.stringify(state.getSave())).toBe(before);expect(writes()).toHaveLength(n);expect(location.hash).toBe('#/settings');
},20000);
