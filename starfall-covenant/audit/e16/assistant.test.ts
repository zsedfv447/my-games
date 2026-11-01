import {afterEach,expect,it,vi} from 'vitest';
import type {Router} from '../../src/ui/router';
let router:Router|undefined;
afterEach(()=>{router?.stop();router=undefined;vi.restoreAllMocks();vi.unstubAllGlobals();document.body.replaceChildren();});
const wait=(ms:number)=>new Promise(r=>setTimeout(r,ms));
const btn=(root:ParentNode,text:string)=>{const b=[...root.querySelectorAll<HTMLButtonElement>('button')].find(x=>x.textContent===text);expect(b,text).toBeDefined();return b!;};
function open(host:HTMLElement){const mode=host.querySelector<HTMLButtonElement>('[aria-label^="設定轉珠模式："]');expect(mode).not.toBeNull();mode!.click();const d=host.querySelector<HTMLElement>('[role="dialog"][aria-label="轉珠模式設定"]:not(.closing)');expect(d).not.toBeNull();return d!;}
function goal(d:HTMLElement,value:string){const s=d.querySelector<HTMLSelectElement>('[aria-label="轉珠模式"]')!;s.value=value;s.dispatchEvent(new Event('change',{bubbles:true}));}
async function boot(){
 vi.resetModules();localStorage.clear();sessionStorage.clear();history.replaceState(null,'','#/battle/st-1-1');
 vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(new Proxy({},{get:(_t,key)=>key==='createLinearGradient'||key==='createRadialGradient'?()=>({addColorStop(){}}):()=>{}}) as CanvasRenderingContext2D);
 const backing=localStorage,writes:{key:string,value:string|null}[]=[];
 vi.stubGlobal('localStorage',{getItem:(k:string)=>backing.getItem(k),setItem:(k:string,v:string)=>{writes.push({key:k,value:v});backing.setItem(k,v);},removeItem:(k:string)=>{writes.push({key:k,value:null});backing.removeItem(k);}});
 const state=await import('../../src/ui/state'),{gameData}=await import('../../src/data/load'),engine=await import('../../src/battle/battle-state'),{createRng}=await import('../../src/core/rng'),active=await import('../../src/progression/active-battle');
 const s=structuredClone(state.getSave());s.tutorial={step:'done',giftGiven:true};s.progress.tutorialDone=true;s.progress.storySeen=Object.keys(gameData.story);s.hintsSeen=['ringShield'];state.commit(s);
 const stage=gameData.stages.find(x=>x.id==='st-1-1')!,members=s.inventory.cards.map(c=>({cardId:c.cardId,uid:c.uid,level:c.level})),actual=engine.startBattle(stage,members,null,createRng(777),gameData);
 state.commit(active.recordBattleSnapshot(active.beginActiveBattle(state.getSave(),{stageId:stage.id,seed:777,members,helper:null,drops:{stageId:stage.id,drops:[]}},Date.now()),actual.snapshot()));
 const resume=vi.spyOn(engine,'resumeBattle');const {startApp}=await import('../../src/ui/app');const host=document.createElement('div');document.body.append(host);router=startApp(host);
 const battle=resume.mock.results.at(-1)!.value as ReturnType<typeof engine.resumeBattle>;const snapshot=structuredClone(battle.snapshot()),save=structuredClone(state.getSave());const {SAVE_KEY}=await import('../../src/save/save');const bytes=backing.getItem(SAVE_KEY);
 const prefKey='starfall-covenant.orb-assistant.request.v1';writes.length=0;
 const unchangedBattle=()=>{expect(state.getSave()).toEqual(save);expect(backing.getItem(SAVE_KEY)).toBe(bytes);expect(battle.snapshot()).toEqual(snapshot);expect(writes.filter(w=>w.key!==prefKey)).toEqual([]);};
 return{host,writes,prefKey,backing,unchangedBattle};
}
it('valid assistant preferences save once and reopen reads goal; battle/ticket/resources unchanged',async()=>{
 const a=await boot();const d=open(a.host);goal(d,'heal');btn(d,'儲存設定並收起').click();expect(a.writes).toHaveLength(1);expect(a.writes[0].key).toBe(a.prefKey);expect(JSON.parse(a.backing.getItem(a.prefKey)!).goal).toBe('heal');a.unchangedBattle();const again=open(a.host);expect(again.querySelector<HTMLSelectElement>('[aria-label="轉珠模式"]')!.value).toBe('heal');btn(again,'收起').click();expect(a.writes).toHaveLength(1);a.unchangedBattle();
});
it('invalid exactcombo rejects without saving and a valid retry remains possible',async()=>{
 const a=await boot();const d=open(a.host);goal(d,'exactcombo');btn(d,'儲存設定並收起').click();expect(d.textContent).toContain('請在附加條件填入');expect(d.classList.contains('closing')).toBe(false);expect(a.writes).toEqual([]);a.unchangedBattle();goal(d,'damage');btn(d,'儲存設定並收起').click();expect(a.writes).toHaveLength(1);a.unchangedBattle();
});
for(const ending of ['close50','leave200'] as const)it(`${ending}: old save must not persist preferences despite unchanged battle`,async()=>{
 const a=await boot();const d=open(a.host);goal(d,'heal');const old=btn(d,'儲存設定並收起');if(ending==='close50'){btn(d,'收起').click();await wait(50);expect(old.isConnected).toBe(true);}else{router!.replace('settings');await wait(200);expect(old.isConnected).toBe(false);}
 const hash=location.hash,pref=a.backing.getItem(a.prefKey);old.click();a.unchangedBattle();expect(location.hash).toBe(hash);expect.soft(a.backing.getItem(a.prefKey)).toBe(pref);expect(a.writes).toEqual([]);
});
it('new goal saved after reopen cannot be overwritten by old save; old close cannot dismiss new dialog',async()=>{
 const a=await boot();const old=open(a.host);goal(old,'heal');btn(old,'收起').click();const fresh=open(a.host);goal(fresh,'damage');btn(old,'收起').click();expect(fresh.classList.contains('closing')).toBe(false);btn(fresh,'儲存設定並收起').click();const newest=open(a.host);const pref=a.backing.getItem(a.prefKey);a.writes.length=0;btn(old,'儲存設定並收起').click();a.unchangedBattle();expect(newest.classList.contains('closing')).toBe(false);expect.soft(a.backing.getItem(a.prefKey)).toBe(pref);expect(a.writes).toEqual([]);
});
