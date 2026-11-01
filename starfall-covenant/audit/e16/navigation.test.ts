import {afterEach,expect,it,vi} from 'vitest';
import type {Router} from '../../src/ui/router';
let router:Router|undefined;
afterEach(()=>{router?.stop();router=undefined;vi.restoreAllMocks();document.body.replaceChildren();});
const wait=(ms:number)=>new Promise(r=>setTimeout(r,ms));
const btn=(root:ParentNode,label:string)=>{const b=[...root.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent===label);expect(b,label).toBeDefined();return b!;};
const modal=(host:HTMLElement,title:string)=>{const d=[...host.querySelectorAll<HTMLElement>('[role="dialog"]')].find(d=>d.getAttribute('aria-label')===title&&!d.classList.contains('closing'));expect(d,title).toBeDefined();return d!;};
async function boot(lost=false){
 vi.resetModules();localStorage.clear();sessionStorage.clear();history.replaceState(null,'',lost?'#/prepare/st-1-1':'#/team');
 if(lost)vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(new Proxy({}, {get:(_t,k)=>k==='createLinearGradient'||k==='createRadialGradient'?()=>({addColorStop(){}}):()=>{}}) as CanvasRenderingContext2D);
 const state=await import('../../src/ui/state');const {gameData}=await import('../../src/data/load');const s=structuredClone(state.getSave());s.tutorial={step:'done',giftGiven:true};s.progress.tutorialDone=true;s.hintsSeen=['ringShield'];
 // Returning-player fixture: helper roster reading legitimately marks seen, not ownership/rewards.
 const {HELPER_NPCS}=await import('../../src/progression/helpers');s.collection.seen=[...new Set([...s.collection.seen,...HELPER_NPCS.flatMap(n=>n.tiers.map(t=>t.card))])];state.commit(s);
 if(lost){
  const {startBattle}=await import('../../src/battle/battle-state');const {createRng}=await import('../../src/core/rng');const {beginActiveBattle,recordBattleSnapshot}=await import('../../src/progression/active-battle');
  const stage=gameData.stages.find(s=>s.id==='st-1-1')!,members=[{cardId:'c106',level:1,uid:'u1'}];const battle=startBattle(stage,members,null,createRng(123),gameData);for(let i=0;i<200&&battle.getState().phase==='player';i++)battle.submitMove([]);expect(battle.getState().phase).toBe('lost');
  state.commit(recordBattleSnapshot(beginActiveBattle(state.getSave(),{stageId:stage.id,seed:123,members,helper:null,drops:{stageId:stage.id,drops:[]}},Date.now()),battle.snapshot()));
 }
 const {startApp}=await import('../../src/ui/app');const host=document.createElement('div');document.body.append(host);router=startApp(host);
 if(lost){router.go('battle',['st-1-1']);await vi.waitFor(()=>expect(host.querySelector('[aria-label="隊伍倒下了"]')).not.toBeNull());btn(modal(host,'隊伍倒下了'),'放棄').click();expect(state.getSave().activeBattle).toBeNull();expect(modal(host,'挑戰失敗')).toBeDefined();}
 const {SAVE_KEY}=await import('../../src/save/save');const storage=vi.spyOn(localStorage,'setItem');const writes=()=>storage.mock.calls.filter(([k])=>k===SAVE_KEY);
 const read=()=>({save:structuredClone(state.getSave()),raw:localStorage.getItem(SAVE_KEY),hash:location.hash,writes:writes().length});
 const unchanged=(before:ReturnType<typeof read>)=>{expect.soft(state.getSave()).toEqual(before.save);expect.soft(localStorage.getItem(SAVE_KEY)).toBe(before.raw);expect.soft(writes()).toHaveLength(before.writes);};
 return{host,state,read,unchanged};
}
function stamina(host:HTMLElement){const b=host.querySelector<HTMLButtonElement>('.stamina-button[aria-label="體力回復時間"]');expect(b).not.toBeNull();b!.click();return modal(host,'體力');}
it('stamina normal: actual Shell link only navigates to shop; Back restores team without purchase',async()=>{
 const {host,read,unchanged}=await boot();const own=stamina(host),before=read();btn(own,'去商店補充').click();expect(location.hash).toBe('#/shop');unchanged(before);router!.back();await vi.waitFor(()=>expect(location.hash).toBe('#/team'));unchanged(before);
});
for(const ending of ['close50','leave200','replacement'] as const)it(`stamina ${ending}: old shop/close cannot take over new route or dialog`,async()=>{
 const {host,read,unchanged}=await boot();const own=stamina(host),shop=btn(own,'去商店補充'),close=btn(own,'關閉');let fresh:HTMLElement|undefined;
 if(ending==='close50'){close.click();await wait(50);expect(shop.isConnected).toBe(true);}else if(ending==='leave200'){router!.replace('settings');await wait(200);}else{close.click();fresh=stamina(host);}
 const before=read();shop.click();close.click();await wait(20);unchanged(before);expect.soft(location.hash).toBe(before.hash);if(fresh)expect(fresh.classList.contains('closing')).toBe(false);
});
it('defeat normal: real lost snapshot and UI abandon produce helper shortcut; Back returns to prepare with no new rewards or costs',async()=>{
 const {host,read,unchanged}=await boot(true);const own=modal(host,'挑戰失敗'),before=read();btn(own,'借助戰').click();expect(location.hash).toBe('#/helper/st-1-1?from=prepare');unchanged(before);router!.back();await vi.waitFor(()=>expect(location.hash).toBe('#/prepare/st-1-1'));unchanged(before);
});
for(const ending of ['return50','leave200','replacement'] as const)it(`defeat ${ending}: stale advice/return cannot redirect newer navigation`,async()=>{
 const {host,read,unchanged}=await boot(true);const own=modal(host,'挑戰失敗'),advice=btn(own,'借助戰'),back=btn(own,'返回');
 if(ending==='return50'){back.click();await wait(50);expect(advice.isConnected).toBe(true);expect(location.hash).toBe('#/prepare/st-1-1');}
 else if(ending==='leave200'){router!.replace('settings');await wait(200);}
 else { // Explicit new-route replacement, not a fabricated second defeat guide.
  btn(own,'借助戰').click();router!.go('team');
 }
 const before=read();advice.click();await wait(20);unchanged(before);expect.soft(location.hash).toBe(before.hash);
 back.click();await wait(30);unchanged(before);expect(location.hash).toBe(before.hash);
});
