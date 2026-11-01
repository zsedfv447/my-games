// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import type { Router } from '../src/ui/router';
let router:Router|undefined;
afterEach(()=>{router?.stop();router=undefined;vi.restoreAllMocks();document.body.replaceChildren();});
const wait=(ms:number)=>new Promise(r=>setTimeout(r,ms));
const button=(root:ParentNode,label:string)=>{const b=[...root.querySelectorAll<HTMLButtonElement>('button')].find(x=>x.textContent===label);expect(b).toBeDefined();return b!;};
const force=(b:HTMLButtonElement)=>b.dispatchEvent(new MouseEvent('click',{bubbles:true}));
const inactiveKeys=['starfall.save','starfall.ui-prefs','starfall-covenant.orb-assistant.request.v1','debug.abyssWeak','__starfall_probe__'].map(key=>'starfall.experiment.e00-e01.'+key);
function seedSentinels(){for(const store of [localStorage,sessionStorage])for(const key of inactiveKeys)store.setItem(key,`inactive experiment fixture untouched ${key} 漢字`);}
function checkSentinels(){for(const store of [localStorage,sessionStorage])for(const key of inactiveKeys)expect(store.getItem(key)).toBe(`inactive experiment fixture untouched ${key} 漢字`);}
async function fresh(){
  vi.resetModules();localStorage.clear();sessionStorage.clear();seedSentinels();history.replaceState(null,'','#/settings');
  const state=await import('../src/ui/state');const codec=await import('../src/save/save');
  const fixture=structuredClone(state.getSave());fixture.tutorial={step:'done',giftGiven:true};fixture.progress.tutorialDone=true;fixture.player.coin=12345;state.commit(fixture);
  const good=state.exportCode();fixture.player.coin=999;state.commit(fixture);
  return {state,codec,good};
}
async function mount(){const {startApp}=await import('../src/ui/app');const host=document.createElement('div');document.body.append(host);router=startApp(host);return host;}
function openImport(host:HTMLElement){button(host,'匯入存檔碼').click();const dialog=[...host.querySelectorAll<HTMLElement>('[aria-label="匯入存檔碼"]')].find(d=>!d.classList.contains('closing'))!;expect(dialog).toBeDefined();return{dialog,area:dialog.querySelector('textarea')!,accept:button(dialog,'匯入'),cancel:button(dialog,'取消')};}
it('checksum corruption survives deferred warning, settings commit and invalid imports; valid production backup recovers through real module reload',async()=>{
  const fixture=await fresh();const envelope=JSON.parse(localStorage.getItem(fixture.codec.SAVE_KEY)!);envelope.data.player.coin=54321;const corrupt=JSON.stringify(envelope);localStorage.setItem(fixture.codec.SAVE_KEY,corrupt);
  vi.resetModules();let state=await import('../src/ui/state');let host=await mount();expect(state.getLoadProblem()).toBe('checksum');expect(host.querySelector('[aria-label="存檔讀取失敗"]')).not.toBeNull();button(host,'稍後').click();await wait(150);
  const volume=host.querySelector<HTMLInputElement>('input[type=range]')!;volume.value='0.2';volume.dispatchEvent(new Event('input'));expect(localStorage.getItem(fixture.codec.SAVE_KEY)).toBe(corrupt);expect(state.getLoadProblem()).toBe('checksum');
  const own=openImport(host);own.area.value='not-valid';own.accept.click();expect(state.getLoadProblem()).toBe('checksum');expect(localStorage.getItem(fixture.codec.SAVE_KEY)).toBe(corrupt);
  // Experimental-tagged backup remains invalid for production; use only isolated synthetic data.
  own.area.value='STARFALL-EXPERIMENT:E00-E01:'+fixture.good;own.accept.click();expect(state.getLoadProblem()).toBe('checksum');expect(localStorage.getItem(fixture.codec.SAVE_KEY)).toBe(corrupt);checkSentinels();
  own.area.value=fixture.good;own.accept.click();expect(state.getLoadProblem()).toBeNull();expect(state.getSave().player.coin).toBe(12345);const recovered=localStorage.getItem(fixture.codec.SAVE_KEY);expect(recovered).not.toBe(corrupt);checkSentinels();
  router!.stop();host.remove();vi.resetModules();state=await import('../src/ui/state');host=await mount();
  expect(location.hash).toBe('#/settings');expect(state.getLoadProblem()).toBeNull();expect(state.getSave().player.coin).toBe(12345);expect(localStorage.getItem(fixture.codec.SAVE_KEY)).toBe(recovered);expect(host.querySelector('[aria-label="存檔讀取失敗"]')).toBeNull();checkSentinels();
},20000);
it('cancelled import during 50ms fade cannot overwrite through retained normal click or forced callback',async()=>{
  const {state,codec,good}=await fresh();const host=await mount();const old=openImport(host);old.area.value=good;const save=JSON.stringify(state.getSave()),raw=localStorage.getItem(codec.SAVE_KEY);old.cancel.click();await wait(50);expect(old.accept.isConnected).toBe(true);old.accept.click();force(old.accept);
  expect(JSON.stringify(state.getSave())).toBe(save);expect(localStorage.getItem(codec.SAVE_KEY)).toBe(raw);expect(state.getLoadProblem()).toBeNull();checkSentinels();
},20000);
it('route departure closes import and retained callback cannot overwrite the current save',async()=>{
  const {state,codec,good}=await fresh();const host=await mount();const old=openImport(host);old.area.value=good;router!.replace('collection');await wait(200);expect.soft(old.dialog.isConnected).toBe(false);const save=JSON.stringify(state.getSave()),raw=localStorage.getItem(codec.SAVE_KEY);old.accept.click();force(old.accept);
  expect(JSON.stringify(state.getSave())).toBe(save);expect(localStorage.getItem(codec.SAVE_KEY)).toBe(raw);expect(location.hash).toBe('#/collection');checkSentinels();
},20000);
it('invalid import can be corrected in the same dialog and successful old callback cannot replay over newer progress',async()=>{
  const {state,codec,good}=await fresh();const host=await mount();const own=openImport(host);const raw=localStorage.getItem(codec.SAVE_KEY);own.area.value='bad';own.accept.click();expect(localStorage.getItem(codec.SAVE_KEY)).toBe(raw);
  own.area.value=good;own.accept.click();expect(state.getSave().player.coin).toBe(12345);const changed=structuredClone(state.getSave());changed.player.coin=999;state.commit(changed);const newer=localStorage.getItem(codec.SAVE_KEY);force(own.accept);expect(state.getSave().player.coin).toBe(999);expect(localStorage.getItem(codec.SAVE_KEY)).toBe(newer);checkSentinels();
},20000);
