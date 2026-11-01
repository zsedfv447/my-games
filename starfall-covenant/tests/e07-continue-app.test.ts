// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import type { Router } from '../src/ui/router';
let router: Router | undefined;
afterEach(()=>{router?.stop();router=undefined;vi.restoreAllMocks();document.body.replaceChildren();});
async function lostApp(gems=30) {
  vi.resetModules();localStorage.clear();sessionStorage.clear();history.replaceState(null,'','#/battle/st-1-1');
  vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(new Proxy({}, {get:(_t,key)=>key==='createLinearGradient'||key==='createRadialGradient'?()=>({addColorStop(){}}):()=>{}}) as CanvasRenderingContext2D);
  const state=await import('../src/ui/state');
  const {gameData}=await import('../src/data/load');
  const engine=await import('../src/battle/battle-state');
  const {createRng}=await import('../src/core/rng');
  const active=await import('../src/progression/active-battle');
  const fresh=structuredClone(state.getSave());fresh.player.gems=gems;fresh.tutorial={step:'done',giftGiven:true};fresh.progress.tutorialDone=true;state.commit(fresh);
  const stage=gameData.stages.find(s=>s.id==='st-1-1')!,card=fresh.inventory.cards[0];
  const members=[{cardId:card.cardId,level:card.level,uid:card.uid}];
  const actual=engine.startBattle(stage,members,null,createRng(123),gameData);
  for(let i=0;i<200&&actual.getState().phase==='player';i++) actual.submitMove([]);
  expect(actual.getState().phase).toBe('lost');
  const ticket=active.beginActiveBattle(state.getSave(),{stageId:stage.id,seed:123,members,helper:null,drops:{stageId:stage.id,drops:[]}},Date.now());
  state.commit(active.recordBattleSnapshot(ticket,actual.snapshot()));
  const resume=vi.spyOn(engine,'resumeBattle'); // pass-through observation of the actual resumed engine
  const {startApp}=await import('../src/ui/app');const host=document.createElement('div');document.body.append(host);router=startApp(host);
  const latest=()=>resume.mock.results.at(-1)!.value as ReturnType<typeof engine.resumeBattle>;
  const buttons=()=>{
    const dlg=host.querySelector('[role="dialog"][aria-label="隊伍倒下了"]');expect(dlg).not.toBeNull();
    const all=[...dlg!.querySelectorAll<HTMLButtonElement>('button')];
    return {revive:all.find(b=>b.textContent?.startsWith('續戰'))!,giveUp:all.find(b=>b.textContent==='放棄')!};
  };
  return {state,active,latest,buttons,host};
}
const forceClick=(button:HTMLButtonElement)=>button.dispatchEvent(new MouseEvent('click',{bubbles:true}));
const wait=(ms:number)=>new Promise(r=>setTimeout(r,ms));

it('real resumed loss:50ms duplicate/detached Continue and stale GiveUp settle once; next genuine loss can pay again',async()=>{
  const {state,active,latest,buttons,host}=await lostApp();const {revive,giveUp}=buttons();
  const {SAVE_KEY}=await import('../src/save/save');
  const storage=vi.spyOn(localStorage,'setItem');
  const savedPayloads=()=>storage.mock.calls.filter(([key])=>key===SAVE_KEY).map(([,raw])=>JSON.parse(raw).data);
  const before=state.getSave().player.gems;revive.click();
  expect(savedPayloads()).toHaveLength(1);
  expect(savedPayloads()[0].player.gems).toBe(before-5);
  expect(savedPayloads()[0].activeBattle.snapshot.state).toMatchObject({phase:'player',continues:1});
  await wait(50);revive.click(); // normal DOM click matches original rapid-click report
  expect(state.getSave().player.gems).toBe(before-5);
  forceClick(revive); // additional dispatched-event stress must also be safe
  expect(state.getSave().player.gems).toBe(before-5);
  expect(state.getSave().activeBattle?.snapshot?.state.continues).toBe(1);
  expect(state.getSave().activeBattle?.snapshot?.state.phase).toBe('player');
  expect(state.getSave().activeBattle?.snapshot).toEqual(latest().snapshot());
  await wait(160);expect(revive.isConnected).toBe(false);
  const settled=JSON.stringify(state.getSave());forceClick(revive);forceClick(giveUp);
  expect(JSON.stringify(state.getSave())).toBe(settled);expect(savedPayloads()).toHaveLength(1);
  const persisted=state.getSave().activeBattle!.snapshot!;
  router!.replace('battle',['st-1-1']); // actual resume of the successful saved state
  expect(latest().snapshot()).toEqual(persisted);
  expect(state.getSave().player.gems).toBe(before-5);expect(savedPayloads()).toHaveLength(1);
  const battle=latest();for(let i=0;i<200&&battle.getState().phase==='player';i++)battle.submitMove([]);
  expect(battle.getState().phase).toBe('lost');
  state.commit(active.recordBattleSnapshot(state.getSave(),battle.snapshot()));
  router!.replace('battle',['st-1-1']);
  await vi.waitFor(()=>expect(host.querySelector('[role="dialog"][aria-label="隊伍倒下了"]')).not.toBeNull());
  buttons().revive.click();
  expect(state.getSave().player.gems).toBe(before-10);
  expect(state.getSave().activeBattle?.snapshot?.state.continues).toBe(2);
  expect(state.getSave().activeBattle?.snapshot?.state.phase).toBe('player');
},20000);

it('insufficient gems: even dispatched disabled-button event cannot debit, revive or persist a changed snapshot',async()=>{
  const {state,latest,buttons}=await lostApp(4);const {revive}=buttons();expect(revive.disabled).toBe(true);
  const save=JSON.stringify(state.getSave()),snapshot=JSON.stringify(latest().snapshot());forceClick(revive);
  expect(JSON.stringify(state.getSave())).toBe(save);expect(JSON.stringify(latest().snapshot())).toBe(snapshot);
  expect(latest().getState().phase).toBe('lost');
},20000);

it('actual player phase rejects stale defeat Continue without charging or committing',async()=>{
  const {state,latest,buttons}=await lostApp();const {revive}=buttons();
  expect(latest().continueBattle().ok).toBe(true); // actual engine transition, UI callback now stale
  const save=JSON.stringify(state.getSave()),snapshot=JSON.stringify(latest().snapshot());forceClick(revive);
  expect(JSON.stringify(state.getSave())).toBe(save);expect(JSON.stringify(latest().snapshot())).toBe(snapshot);
},20000);

it('GiveUp first cannot be undone by stale Continue callback',async()=>{
  const {state,latest,buttons}=await lostApp();const {revive,giveUp}=buttons();giveUp.click();
  expect(state.getSave().activeBattle).toBeNull();const save=JSON.stringify(state.getSave()),snapshot=JSON.stringify(latest().snapshot());
  forceClick(revive);await wait(160);forceClick(revive);
  expect(JSON.stringify(state.getSave())).toBe(save);expect(JSON.stringify(latest().snapshot())).toBe(snapshot);
},20000);

it('real Router departure destroys view: detached defeat callbacks cannot mutate save or engine',async()=>{
  const {state,latest,buttons}=await lostApp();const {revive,giveUp}=buttons();router!.replace('settings');
  const save=JSON.stringify(state.getSave()),snapshot=JSON.stringify(latest().snapshot());forceClick(revive);forceClick(giveUp);
  expect(JSON.stringify(state.getSave())).toBe(save);expect(JSON.stringify(latest().snapshot())).toBe(snapshot);
},20000);
