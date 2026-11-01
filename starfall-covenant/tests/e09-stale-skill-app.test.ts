// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import type { Router } from '../src/ui/router';
let router:Router|undefined;
afterEach(()=>{router?.stop();router=undefined;vi.restoreAllMocks();document.body.replaceChildren();});
const wait=(ms:number)=>new Promise(r=>setTimeout(r,ms));
const force=(button:HTMLButtonElement)=>button.dispatchEvent(new MouseEvent('click',{bubbles:true}));
async function readyApp() {
  vi.resetModules();localStorage.clear();history.replaceState(null,'','#/battle/st-1-1');
  vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(new Proxy({}, {get:(_t,k)=>k==='createLinearGradient'||k==='createRadialGradient'?()=>({addColorStop(){}}):()=>{}}) as CanvasRenderingContext2D);
  const state=await import('../src/ui/state');const {gameData}=await import('../src/data/load');
  const engine=await import('../src/battle/battle-state');const {createRng}=await import('../src/core/rng');const active=await import('../src/progression/active-battle');
  const save=structuredClone(state.getSave());save.tutorial={step:'done',giftGiven:true};save.progress.tutorialDone=true;state.commit(save);
  state.updateSettings({lowFx:true,battleFx:false,battleSpeed:2});
  const stage=gameData.stages.find(s=>s.id==='st-1-1')!,card=save.inventory.cards[0],members=[{cardId:card.cardId,level:card.level,uid:card.uid}];
  // Legal ready-engine fixture: real turns to loss then real engine continue, not a UI-paid-revival test.
  const ready=engine.startBattle(stage,members,null,createRng(123),gameData);
  for(let i=0;i<100&&ready.getState().phase==='player';i++)ready.submitMove([]);
  expect(ready.getState().phase).toBe('lost');expect(ready.continueBattle().ok).toBe(true);
  expect(ready.getState().team[0].skillCooldown).toBe(0);
  state.commit(active.recordBattleSnapshot(active.beginActiveBattle(state.getSave(),{stageId:stage.id,seed:123,members,helper:null,drops:{stageId:stage.id,drops:[]}},Date.now()),ready.snapshot()));
  const resume=vi.spyOn(engine,'resumeBattle'); // observational, original implementation retained
  const {startApp}=await import('../src/ui/app');const host=document.createElement('div');document.body.append(host);router=startApp(host);
  await wait(20);
  const latest=()=>resume.mock.results.at(-1)!.value as ReturnType<typeof engine.resumeBattle>;
  const open=()=>{
    host.querySelector<HTMLButtonElement>('.team-row .card-thumb')!.click();
    const name=gameData.skills.find(s=>s.id===gameData.cards.find(c=>c.id===card.cardId)!.activeSkill)!.name;
    const dialog=[...host.querySelectorAll('[role="dialog"]')].find(el=>el.getAttribute('aria-label')===name);expect(dialog).toBeDefined();
    return {dialog:dialog!,cast:[...dialog!.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent==='施放')!,cancel:[...dialog!.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent==='取消')!};
  };
  const {SAVE_KEY}=await import('../src/save/save');
  const storage=vi.spyOn(localStorage,'setItem');const writes=()=>storage.mock.calls.filter(([key])=>key===SAVE_KEY);
  return {state,gameData,engine,active,createRng,stage,members,host,latest,open,writes};
}

it('real skill preview open/cancel never changes save, full engine snapshot or RNG and old cancelled callback stays inert',async()=>{
  const {state,latest,open,writes}=await readyApp();const battle=latest(),castEngine=vi.spyOn(battle,'useSkill');
  const before=JSON.stringify(state.getSave()),snapshot=JSON.stringify(battle.snapshot());
  const {cast,cancel}=open();cancel.click();await wait(200);
  expect(JSON.stringify(state.getSave())).toBe(before);expect(JSON.stringify(battle.snapshot())).toBe(snapshot);expect(writes()).toHaveLength(0);
  force(cast);await wait(20);
  expect(JSON.stringify(state.getSave())).toBe(before);expect(JSON.stringify(battle.snapshot())).toBe(snapshot);expect(castEngine).not.toHaveBeenCalled();expect(writes()).toHaveLength(0);
},20000);

it('real app settings departure closes skill dialog after fade and stale cast cannot alter former battle',async()=>{
  const {state,latest,open,writes}=await readyApp();const old=latest(),action=vi.spyOn(old,'useSkill');const {dialog,cast}=open();
  router!.replace('settings');await wait(200);
  expect.soft(dialog.isConnected).toBe(false);
  const before=JSON.stringify(state.getSave()),snapshot=JSON.stringify(old.snapshot()),count=writes().length;
  cast.click();force(cast);await wait(20);
  expect.soft(JSON.stringify(state.getSave())).toBe(before);expect.soft(JSON.stringify(old.snapshot())).toBe(snapshot);
  expect.soft(action).not.toHaveBeenCalled();expect.soft(writes()).toHaveLength(count);
},20000);

it('same-stage Router replacement creates a new view that old skill callback cannot mutate or overwrite',async()=>{
  const {state,latest,open,writes}=await readyApp();const old=latest(),{cast}=open();router!.replace('battle',['st-1-1']);await wait(20);
  const fresh=latest();expect(fresh).not.toBe(old);
  const save=JSON.stringify(state.getSave()),a=JSON.stringify(old.snapshot()),b=JSON.stringify(fresh.snapshot()),count=writes().length;
  force(cast);await wait(20);
  expect.soft(JSON.stringify(state.getSave())).toBe(save);expect.soft(JSON.stringify(old.snapshot())).toBe(a);expect.soft(JSON.stringify(fresh.snapshot())).toBe(b);expect.soft(writes()).toHaveLength(count);
},20000);

it('same-stage new ticket fixture without navigation invalidates old skill authorization',async()=>{
  const {state,latest,open,writes,engine,createRng,active,stage,members,gameData}=await readyApp();const old=latest(),{cast}=open();
  const newBattle=engine.startBattle(stage,members,null,createRng(999),gameData);
  const newTicket=active.recordBattleSnapshot(active.beginActiveBattle(state.getSave(),{stageId:stage.id,seed:999,members,helper:null,drops:{stageId:stage.id,drops:[]}},Date.now()+1),newBattle.snapshot());
  state.commit(newTicket);const save=JSON.stringify(state.getSave()),a=JSON.stringify(old.snapshot()),count=writes().length;
  force(cast);await wait(20);
  expect.soft(JSON.stringify(state.getSave())).toBe(save);expect.soft(JSON.stringify(old.snapshot())).toBe(a);expect.soft(writes()).toHaveLength(count);
},20000);

it('normal ready skill still performs its real conversion once and persists the actual cooldown/board',async()=>{
  const {state,latest,open,writes,gameData}=await readyApp();const battle=latest(),castEngine=vi.spyOn(battle,'useSkill');
  const before=battle.getState();expect(before.board.cells.some(o=>o.type==='wood')).toBe(true);
  const {cast}=open();expect(cast.disabled).toBe(false);cast.click();
  await vi.waitFor(()=>expect(battle.getState().team[0].skillCooldown).toBe(8));
  expect(battle.getState().board.cells.some(o=>o.type==='wood')).toBe(false);
  expect(castEngine).toHaveBeenCalledTimes(1);expect(writes()).toHaveLength(1);
  expect(state.getSave().activeBattle?.snapshot).toEqual(battle.snapshot());
  expect(gameData.skills.find(s=>s.id==='s106')?.cooldown.max).toBe(8);
},20000);
