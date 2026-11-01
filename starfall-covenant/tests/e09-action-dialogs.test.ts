// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import type { Battle } from '../src/battle/battle-state';
let leave:(()=>void)|undefined;
afterEach(async()=>{leave?.();leave=undefined;await new Promise(r=>setTimeout(r,180));vi.restoreAllMocks();document.body.replaceChildren();});
const forceClick=(b:HTMLButtonElement)=>b.dispatchEvent(new MouseEvent('click',{bubbles:true}));
const stored=()=>JSON.stringify(Array.from({length:localStorage.length},(_,i)=>{const k=localStorage.key(i)!;return[k,localStorage.getItem(k)];}).sort());
async function base(){
  vi.resetModules();localStorage.clear();sessionStorage.clear();
  vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(new Proxy({}, {get:(_t,k)=>k==='createLinearGradient'||k==='createRadialGradient'?()=>({addColorStop(){}}):()=>{}}) as CanvasRenderingContext2D);
  const state=await import('../src/ui/state'),{gameData}=await import('../src/data/load'),{createNewSave}=await import('../src/save/save');
  const fixture=createNewSave(gameData.config,1);fixture.tutorial={step:'done',giftGiven:true};fixture.progress.tutorialDone=true;state.commit(fixture);
  state.updateSettings({battleFx:false,lowFx:true,battleSpeed:2});
  const engine=await import('../src/battle/battle-state'),start=vi.spyOn(engine,'startBattle'),resume=vi.spyOn(engine,'resumeBattle');
  const {battleScreen}=await import('../src/ui/screens/battle'),{setOverlayHost}=await import('../src/ui/components/overlay');
  const host=document.createElement('div');document.body.append(host);setOverlayHost(host);
  const render=(args:string[])=>{const root=battleScreen.render({route:{name:'battle',args,query:{}},nav:{go:vi.fn(),replace:vi.fn(),back:vi.fn(),backTo:vi.fn()},onLeave:fn=>{leave=fn;}});host.append(root);return root;};
  const dialogs=()=>[...host.querySelectorAll<HTMLElement>('[role="dialog"]:not(.closing)')];
  const action=(dialog:ParentNode,label:string)=>{const b=[...dialog.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent===label);expect(b).toBeDefined();return b!;};
  return {state,gameData,engine,start,resume,render,host,dialogs,action};
}
async function practice(){
  const f=await base();const root=f.render(['practice','drill-convert']);const result=f.start.mock.results.at(-1)!;expect(result.type).toBe('return');const battle=result.value as Battle;
  const rng=f.start.mock.calls.at(-1)![3],rngCalls=[vi.spyOn(rng,'next'),vi.spyOn(rng,'int'),vi.spyOn(rng,'pick')];
  const cast=vi.spyOn(battle,'useSkill'),commits=vi.spyOn(f.state,'commit');
  const member=(i:number)=>root.querySelectorAll<HTMLButtonElement>('.team-row .card-thumb')[i];
  expect(f.state.getSave().activeBattle).toBeNull();expect(battle.getState().team[2].skillCooldown).toBe(0);
  return {...f,root,battle,rngCalls,cast,commits,member};
}
it('true ticket-free practice preview/cancel settles dialog: delayed fade cast cannot alter engine/save/RNG',async()=>{
  const f=await practice(),before=JSON.stringify(f.battle.getState()),save=JSON.stringify(f.state.getSave()),disk=stored();
  f.member(2).click();const dlg=f.dialogs()[0],old=f.action(dlg,'施放');expect(dlg.querySelector('[data-conversion-preview]')).not.toBeNull();
  f.action(dlg,'取消').click();await new Promise(r=>setTimeout(r,50));forceClick(old);
  expect(JSON.stringify(f.battle.getState())).toBe(before);expect(f.cast).not.toHaveBeenCalled();f.rngCalls.forEach(s=>expect(s).not.toHaveBeenCalled());
  expect(JSON.stringify(f.state.getSave())).toBe(save);expect(stored()).toBe(disk);expect(f.commits).not.toHaveBeenCalled();
});
it('opening another member replaces ownership; old cast cannot act on the new live dialog',async()=>{
  const f=await practice(),before=JSON.stringify(f.battle.getState()),save=JSON.stringify(f.state.getSave()),disk=stored();
  f.member(2).click();const old=f.action(f.dialogs()[0],'施放');f.member(3).click();
  expect(f.dialogs()).toHaveLength(1);expect(f.dialogs()[0].getAttribute('aria-label')).toBe('示範・淬火');
  forceClick(old);expect(f.cast).not.toHaveBeenCalled();f.action(f.dialogs()[0],'取消').click();
  expect(JSON.stringify(f.battle.getState())).toBe(before);expect(JSON.stringify(f.state.getSave())).toBe(save);expect(stored()).toBe(disk);expect(f.commits).not.toHaveBeenCalled();
});
it('normal ready practice cast works exactly once without ticket/persistence; subsequent cooldown rejects stale/disabled buttons',async()=>{
  const f=await practice(),before=f.battle.getState(),save=JSON.stringify(f.state.getSave()),disk=stored();
  f.member(2).click();const cast=f.action(f.dialogs()[0],'施放');expect(cast.disabled).toBe(false);cast.click();forceClick(cast);
  await vi.waitFor(()=>expect(f.root.querySelector('.board-view')!.classList.contains('disabled')).toBe(false));
  forceClick(cast);expect(f.cast).toHaveBeenCalledTimes(1);expect(f.battle.getState().team[2].skillCooldown).toBeGreaterThan(0);
  expect(f.battle.getState().board).not.toEqual(before.board);
  f.member(2).click();const cooldown=f.dialogs()[0];expect(cooldown.textContent).toContain('冷卻中');expect(f.action(cooldown,'施放').disabled).toBe(true);
  const after=JSON.stringify(f.battle.getState());forceClick(f.action(cooldown,'施放'));expect(JSON.stringify(f.battle.getState())).toBe(after);
  expect(f.battle.useSkill(2).ok).toBe(false); // real engine still enforces the current cooldown
  expect(JSON.stringify(f.state.getSave())).toBe(save);expect(stored()).toBe(disk);expect(f.state.getSave().activeBattle).toBeNull();expect(f.commits).not.toHaveBeenCalled();
});
it('real resumed sealed-ready member remains uncastable and no save debit/persist occurs on forced disabled click',async()=>{
  const f=await base(),{createRng}=await import('../src/core/rng'),{beginActiveBattle,recordBattleSnapshot}=await import('../src/progression/active-battle');
  const stage=f.gameData.stages.find(s=>s.id==='st-1-1')!,members=[{cardId:'c710',level:1}];
  const original=f.engine.startBattle(stage,members,null,createRng(42),f.gameData),snapshot=original.snapshot();
  // Explicit test-only ready+sealed resumable fixture; no replacement engine and no user data mutation.
  snapshot.state.team[0].skillCooldown=0;snapshot.state.teamStatuses.push({id:'attributeSeal',turns:3,params:{attribute:'light'}});
  f.state.commit(recordBattleSnapshot(beginActiveBattle(f.state.getSave(),{stageId:stage.id,seed:42,members,helper:null,drops:{stageId:stage.id,drops:[]}},1),snapshot));
  const root=f.render([stage.id]),battle=f.resume.mock.results.at(-1)!.value as Battle;
  const before=JSON.stringify(battle.snapshot()),save=JSON.stringify(f.state.getSave()),disk=stored(),commits=vi.spyOn(f.state,'commit');
  root.querySelector<HTMLButtonElement>('.team-row .card-thumb')!.click();const dlg=f.dialogs()[0];expect(dlg.textContent).toContain('封印');expect(f.action(dlg,'施放').disabled).toBe(true);
  forceClick(f.action(dlg,'施放'));expect(battle.useSkill(0).ok).toBe(false); // real engine seal guard, not a stubbed transaction
  expect(JSON.stringify(battle.snapshot())).toBe(before);expect(JSON.stringify(f.state.getSave())).toBe(save);expect(stored()).toBe(disk);expect(commits).not.toHaveBeenCalled();
});
