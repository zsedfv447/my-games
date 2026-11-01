// @vitest-environment happy-dom
import {afterEach,expect,it,vi} from 'vitest';
import type {Router} from '../src/ui/router';
let router:Router|undefined;
afterEach(()=>{router?.stop();router=undefined;vi.restoreAllMocks();vi.unstubAllGlobals();document.body.replaceChildren();});
const canvas=()=>vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(new Proxy({},{get:(_t,k)=>k==='createLinearGradient'||k==='createRadialGradient'?()=>({addColorStop(){}}):()=>{}}) as CanvasRenderingContext2D);
const btn=(root:ParentNode,text:string)=>{const b=[...root.querySelectorAll<HTMLButtonElement>('button')].find(x=>x.textContent===text);expect(b,text).toBeDefined();return b!;};
async function boot(stageId='st-1-1'){
 vi.resetModules();localStorage.clear();sessionStorage.clear();canvas();const backing=localStorage,writes:{key:string,value:string|null}[]=[];
 vi.stubGlobal('localStorage',{getItem:(k:string)=>backing.getItem(k),setItem:(k:string,v:string)=>{writes.push({key:k,value:v});backing.setItem(k,v);},removeItem:(k:string)=>{writes.push({key:k,value:null});backing.removeItem(k);}});
 const state=await import('../src/ui/state'),{gameData}=await import('../src/data/load'),{SAVE_KEY}=await import('../src/save/save');const s=structuredClone(state.getSave());s.tutorial={step:'done',giftGiven:true};s.progress.tutorialDone=true;s.progress.clearedStages=['st-1-1','st-2-9'];s.progress.storySeen=Object.keys(gameData.story);s.hintsSeen=['ringShield'];const base=s.inventory.cards[0];s.inventory.cards=[{...base,uid:'leader815',cardId:'c815'}];s.teams[0].members=['leader815',null,null,null,null];state.commit(s);
 history.replaceState(null,'',`#/prepare/${stageId}`);const {startApp}=await import('../src/ui/app');const host=document.createElement('div');document.body.append(host);router=startApp(host);
 const sortie=await import('../src/ui/sortie');writes.length=0;
 const search=(text:string)=>{const input=host.querySelector<HTMLInputElement>('[aria-label="搜尋常駐助戰名稱或卡號"]')!;expect(input).not.toBeNull();input.value=text;input.dispatchEvent(new Event('input'));};
 const rows=()=>[...host.querySelectorAll<HTMLButtonElement>('[data-support-id]')];
 const seenWindow=()=>{const before=structuredClone(state.getSave());writes.length=0;return async()=>{
  await Promise.resolve();const {rosterFor}=await import('../src/ui/screens/helper'),stage=gameData.stages.find(s=>s.id===stageId)!;
  const visible=[...rows().map(r=>r.dataset.supportId!.slice('support:'.length)),...rosterFor(stage).map(o=>o.card.id)];const allowed=new Set([...before.collection.seen,...visible]);
  const actual=structuredClone(state.getSave());expect(new Set(actual.collection.seen)).toEqual(allowed);actual.collection.seen=before.collection.seen;expect(actual).toEqual(before);
  for(const write of writes){expect(write.key).toBe(SAVE_KEY);expect(write.value).not.toBeNull();const payload=JSON.parse(write.value!).data as typeof before;expect(payload.collection.seen.every(id=>allowed.has(id))).toBe(true);payload.collection.seen=before.collection.seen;expect(payload).toEqual(before);}
 };};
 const open=async()=>{btn(host,'更換助戰').click();await vi.waitFor(()=>expect(host.querySelector('[data-screen="helper"]')).not.toBeNull());};
 return{state,gameData,SAVE_KEY,backing,writes,host,sortie,rows,search,seenWindow,open};
}
for(const noHelper of [false,true])it(`previously unavailable c815 support selected, oath suppression=${noHelper}, paid ticket and module reload preserve helper without second charge`,async()=>{
 const a=await boot();const existing=a.sortie.chosenHelper('st-1-1');expect(existing?.npcId.startsWith('npc-')).toBe(true);const seen=a.seenWindow();await a.open();expect(a.rows()).toHaveLength(12);await seen();expect(a.state.getSave().collection.seen.length).toBeLessThan(91);expect(a.sortie.chosenHelper('st-1-1')).toEqual(existing);
 const searched=a.seenWindow();a.search('C815');expect(a.rows()).toHaveLength(1);await searched();const row=a.rows()[0];expect(row.dataset.supportId).toBe('support:c815');row.click();await vi.waitFor(()=>expect(a.host.querySelector('[data-tut="sortie"] button')).not.toBeNull());const selected=a.sortie.chosenHelper('st-1-1');expect(selected?.npcId).toBe('support:c815');expect(selected?.card.id).toBe('c815');
 // Actual noHelper oath removes selected support from effective party only; clear restores memory.
 btn(a.host,'刻下誓約').click();let dialog=a.host.querySelector<HTMLElement>('[role="dialog"][aria-label="誓約碑"]:not(.closing)')!;const label=[...dialog.querySelectorAll('label')].find(l=>l.textContent?.includes('孤行之誓'))!;label.parentElement!.querySelector<HTMLInputElement>('input')!.click();btn(dialog,'確定').click();expect(a.host.textContent).toContain('沒有帶助戰。');expect(a.sortie.chosenHelper('st-1-1')).toEqual(selected);
 if(!noHelper){btn(a.host,'修改誓約').click();dialog=a.host.querySelector<HTMLElement>('[role="dialog"][aria-label="誓約碑"]:not(.closing)')!;btn(dialog,'清除').click();btn(dialog,'確定').click();expect(a.host.textContent).not.toContain('沒有帶助戰。');expect(a.sortie.chosenHelper('st-1-1')).toEqual(selected);}
 const before=structuredClone(a.state.getSave());a.writes.length=0;a.host.querySelector<HTMLButtonElement>('[data-tut="sortie"] button')!.click();await vi.waitFor(()=>expect(a.state.getSave().activeBattle?.snapshot).toBeTruthy());
 const paid=structuredClone(a.state.getSave()),ticket=paid.activeBattle!,bytes=a.backing.getItem(a.SAVE_KEY),stage=a.gameData.stages.find(s=>s.id==='st-1-1')!;
 expect(paid.stamina.current).toBe(before.stamina.current-stage.stamina);expect(ticket.helper??null).toEqual(noHelper?null:selected!.input);expect(ticket.oaths??[]).toEqual(noHelper?['noHelper']:[]);expect(ticket.snapshot!.state.team.filter(m=>m.isHelper).map(m=>m.cardId)).toEqual(noHelper?[]:['c815']);expect(paid.inventory).toEqual(before.inventory);expect(paid.collection).toEqual(before.collection);expect(paid.quests).toEqual(before.quests);
 let stamina=before.stamina.current,charges=0;for(const w of a.writes.filter(w=>w.key===a.SAVE_KEY&&w.value)){const payload=JSON.parse(w.value!).data as typeof paid;if(payload.stamina.current<stamina)charges++;stamina=payload.stamina.current;}expect(charges).toBe(1);
 router!.stop();document.body.replaceChildren();vi.restoreAllMocks();vi.resetModules();canvas();history.replaceState(null,'','#/home');a.writes.length=0;const state=await import('../src/ui/state');expect(a.writes).toEqual([{key:'__starfall_probe__',value:'1'},{key:'__starfall_probe__',value:null}]);a.writes.length=0;expect((await import('../src/ui/sortie')).chosenHelper('st-1-1')).toBeUndefined();
 const engine=await import('../src/battle/battle-state'),resumed=vi.spyOn(engine,'resumeBattle');const{startApp}=await import('../src/ui/app');const host=document.createElement('div');document.body.append(host);router=startApp(host);btn(host.querySelector('[aria-label="有未完成的戰鬥"]')!,'繼續').click();await vi.waitFor(()=>expect(resumed).toHaveBeenCalledTimes(1));expect(resumed.mock.results[0].value.snapshot()).toEqual(ticket.snapshot);expect(state.getSave()).toEqual(paid);expect(a.backing.getItem(a.SAVE_KEY)).toBe(bytes);expect(a.writes).toEqual([]);const{dropSeed}=await import('../src/progression/active-battle');expect(dropSeed(state.getSave().activeBattle!)).toBe(dropSeed(ticket));
},20000);
it('all/search only expose exact seen IDs; old search rows and departed callbacks cannot choose or navigate',async()=>{
 const a=await boot(),initial=a.seenWindow();await a.open();await initial();const old=a.rows()[0],selected=a.sortie.chosenHelper('st-1-1');
 const window=a.seenWindow();a.search('c809');await window();const save=structuredClone(a.state.getSave());a.writes.length=0;old.click();await Promise.resolve();expect(location.hash).toBe('#/helper/st-1-1?from=prepare');expect(a.sortie.chosenHelper('st-1-1')).toEqual(selected);expect(a.state.getSave()).toEqual(save);expect(a.writes).toEqual([]);
 const clear=a.seenWindow();btn(a.host,'清除搜尋').click();await clear();const all=a.seenWindow();btn(a.host,'顯示全部').click();expect(a.rows()).toHaveLength(91);await all();expect(a.sortie.chosenHelper('st-1-1')).toEqual(selected);
 const detached=a.rows().find(r=>r.dataset.supportId==='support:c809')!;router!.go('settings');await vi.waitFor(()=>expect(a.host.querySelector('[data-screen="settings"]')).not.toBeNull());const after=structuredClone(a.state.getSave());a.writes.length=0;detached.click();await Promise.resolve();expect(location.hash).toBe('#/settings');expect(a.sortie.chosenHelper('st-1-1')).toEqual(selected);expect(a.state.getSave()).toEqual(after);expect(a.writes).toEqual([]);
},20000);
it('actual fixed-team trial does not expose selectable permanent support',async()=>{
 const a=await boot('trial-combo');router!.go('helper',['trial-combo']);await vi.waitFor(()=>expect(a.host.querySelector('[data-screen="helper"]')).not.toBeNull());expect(a.host.textContent).toContain('這一關使用借用隊伍');expect(a.rows()).toHaveLength(0);
});

it('synthetic stage filter disables incompatible support without selection; fixture is restored',async()=>{
 const a=await boot();const original=a.gameData.stages.find(s=>s.id==='st-1-1')!;const fixture={...structuredClone(original),id:'test-helper-filter',teamRule:{filter:{attribute:'fire' as const}}};a.gameData.stages.push(fixture);
 try{router!.go('helper',[fixture.id]);await vi.waitFor(()=>expect(a.host.querySelector('[data-screen="helper"]')).not.toBeNull());a.search('c815');await Promise.resolve();const row=a.rows()[0];expect(row).toBeDefined();expect(row.disabled).toBe(true);const chosen=a.sortie.chosenHelper(fixture.id),save=structuredClone(a.state.getSave());a.writes.length=0;row.click();await Promise.resolve();expect(a.sortie.chosenHelper(fixture.id)).toEqual(chosen);expect(a.state.getSave()).toEqual(save);expect(a.writes).toEqual([]);expect(location.hash).toBe('#/helper/test-helper-filter');}
 finally{a.gameData.stages.splice(a.gameData.stages.indexOf(fixture),1);}
});
