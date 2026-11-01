// @vitest-environment happy-dom
import {afterEach,expect,it,vi} from 'vitest';
import type {Router} from '../src/ui/router';
let router:Router|undefined;
afterEach(()=>{router?.stop();router=undefined;vi.restoreAllMocks();vi.unstubAllGlobals();document.body.replaceChildren();});
const wait=(ms:number)=>new Promise(r=>setTimeout(r,ms));
const btn=(root:ParentNode,text:string)=>{const b=[...root.querySelectorAll<HTMLButtonElement>('button')].find(x=>x.textContent===text);expect(b,text).toBeDefined();return b!;};
function open(host:HTMLElement){const mode=host.querySelector<HTMLButtonElement>('[aria-label^="設定轉珠模式："]');expect(mode).not.toBeNull();mode!.click();const d=host.querySelector<HTMLElement>('[role="dialog"][aria-label="轉珠模式設定"]:not(.closing)');expect(d).not.toBeNull();return d!;}
function goal(d:HTMLElement,value:string){const s=d.querySelector<HTMLSelectElement>('[aria-label="轉珠模式"]')!;s.value=value;s.dispatchEvent(new Event('change',{bubbles:true}));}
async function boot(){
 vi.resetModules();localStorage.clear();sessionStorage.clear();history.replaceState(null,'','#/battle/st-1-1');
 vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(new Proxy({},{get:(_t,key)=>key==='createLinearGradient'||key==='createRadialGradient'?()=>({addColorStop(){}}):()=>{}}) as CanvasRenderingContext2D);
 const inactiveKey='starfall.experiment.e00-e01.starfall-covenant.orb-assistant.request.v1',inactiveValue=JSON.stringify({goal:'damage',greek:{reserve:false,setup:false}});localStorage.setItem(inactiveKey,inactiveValue);
 const backing=localStorage,writes:{key:string,value:string|null}[]=[];
 vi.stubGlobal('localStorage',{getItem:(k:string)=>backing.getItem(k),setItem:(k:string,v:string)=>{writes.push({key:k,value:v});backing.setItem(k,v);},removeItem:(k:string)=>{writes.push({key:k,value:null});backing.removeItem(k);}});
 const state=await import('../src/ui/state'),{gameData}=await import('../src/data/load'),engine=await import('../src/battle/battle-state'),{createRng}=await import('../src/core/rng'),active=await import('../src/progression/active-battle');
 const s=structuredClone(state.getSave());s.tutorial={step:'done',giftGiven:true};s.progress.tutorialDone=true;s.progress.storySeen=Object.keys(gameData.story);s.hintsSeen=['ringShield'];state.commit(s);
 const stage=gameData.stages.find(x=>x.id==='st-1-1')!,members=[{cardId:'c807',uid:s.inventory.cards[0].uid,level:1}],actual=engine.startBattle(stage,members,{cardId:'c807',level:1},createRng(777),gameData);
 state.commit(active.recordBattleSnapshot(active.beginActiveBattle(state.getSave(),{stageId:stage.id,seed:777,members,helper:{cardId:'c807',level:1},drops:{stageId:stage.id,drops:[]}},Date.now()),actual.snapshot()));
 const {BoardView}=await import('../src/battle/view/board-view');vi.spyOn(BoardView.prototype as unknown as{draw():void},'draw').mockImplementation(()=>{});
 const resume=vi.spyOn(engine,'resumeBattle');const {startApp}=await import('../src/ui/app');const host=document.createElement('div');document.body.append(host);router=startApp(host);
 const battle=resume.mock.results.at(-1)!.value as ReturnType<typeof engine.resumeBattle>;const snapshot=structuredClone(battle.snapshot()),save=structuredClone(state.getSave());const {SAVE_KEY}=await import('../src/save/save');const bytes=backing.getItem(SAVE_KEY);
 const prefKey='starfall-covenant.orb-assistant.request.v1';writes.length=0;
 const unchangedBattle=()=>{expect(backing.getItem(inactiveKey)).toBe(inactiveValue);expect(state.getSave()).toEqual(save);expect(backing.getItem(SAVE_KEY)).toBe(bytes);expect(battle.snapshot()).toEqual(snapshot);expect(writes.filter(w=>w.key!==prefKey)).toEqual([]);};
 return{host,writes,prefKey,backing,unchangedBattle,inactiveKey,inactiveValue,snapshot,save,bytes,SAVE_KEY};
}
function checkbox(d:HTMLElement,label:string){const input=d.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`);expect(input,label).not.toBeNull();return input!;}
it('actual Greek battle options default off, persist only formal prefs and retain exact battle/save; stale closed checkbox/save cannot overwrite',async()=>{
 const a=await boot(),d=open(a.host);expect(d.querySelector<HTMLSelectElement>('[aria-label="轉珠模式"]')!.value).toBe('auto');expect(d.querySelector<HTMLElement>('[data-greek-options]')!.hidden).toBe(false);goal(d,'damage');expect(d.querySelector<HTMLElement>('[data-greek-options]')!.hidden).toBe(true);goal(d,'greek');expect(d.querySelector<HTMLElement>('[data-greek-options]')!.hidden).toBe(false);const reserve=checkbox(d,'同配額優先留珠'),setup=checkbox(d,'已知落珠疊珠／缺口分析');expect(reserve.checked).toBe(false);expect(setup.checked).toBe(false);reserve.click();setup.click();a.unchangedBattle();expect(a.writes).toEqual([]);btn(d,'儲存設定並收起').click();expect(a.writes).toHaveLength(1);expect(a.writes[0].key).toBe(a.prefKey);expect(JSON.parse(a.backing.getItem(a.prefKey)!).greek).toEqual({reserve:true,setup:true});a.unchangedBattle();
 const current=open(a.host);expect(checkbox(current,'同配額優先留珠').checked).toBe(true);expect(checkbox(current,'已知落珠疊珠／缺口分析').checked).toBe(true);const raw=a.backing.getItem(a.prefKey);a.writes.length=0;reserve.click();setup.click();btn(d,'儲存設定並收起').click();expect(a.backing.getItem(a.prefKey)).toBe(raw);expect(current.classList.contains('closing')).toBe(false);expect(a.writes).toEqual([]);a.unchangedBattle();
 router!.go('settings');await wait(200);checkbox(current,'同配額優先留珠').click();btn(current,'儲存設定並收起').click();expect(a.backing.getItem(a.prefKey)).toBe(raw);expect(location.hash).toBe('#/settings');expect(a.writes).toEqual([]);a.unchangedBattle();
 // Real app/module reload from the same formal save and preference bytes.
 router!.stop();document.body.replaceChildren();vi.resetModules();history.replaceState(null,'','#/battle/st-1-1');
 const {BoardView}=await import('../src/battle/view/board-view');vi.spyOn(BoardView.prototype as unknown as{draw():void},'draw').mockImplementation(()=>{});const engine=await import('../src/battle/battle-state'),resume=vi.spyOn(engine,'resumeBattle'),{startApp}=await import('../src/ui/app');const host=document.createElement('div');document.body.append(host);router=startApp(host);await wait(0);
 expect(a.backing.getItem(a.SAVE_KEY)).toBe(a.bytes);expect(a.backing.getItem(a.inactiveKey)).toBe(a.inactiveValue);expect(a.backing.getItem(a.prefKey)).toBe(raw);expect(resume.mock.results.at(-1)!.value.snapshot()).toEqual(a.snapshot);
 const state=await import('../src/ui/state');expect(state.getSave()).toEqual(a.save);expect(a.writes.every(w=>w.key==='__starfall_probe__')).toBe(true);a.writes.length=0;
 const restored=open(host);expect(checkbox(restored,'同配額優先留珠').checked).toBe(true);expect(checkbox(restored,'已知落珠疊珠／缺口分析').checked).toBe(true);btn(restored,'收起').click();expect(a.writes).toEqual([]);
},20000);
