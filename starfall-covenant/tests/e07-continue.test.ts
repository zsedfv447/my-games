// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import type { Battle } from '../src/battle/battle-state';
let leave: (()=>void)|undefined;
afterEach(()=>{leave?.();leave=undefined;vi.restoreAllMocks();document.body.replaceChildren();});
async function setup(gems=50) {
  vi.resetModules();
  vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(new Proxy({}, {get:(_t,k)=>k==='createLinearGradient'||k==='createRadialGradient'?()=>({addColorStop(){}}):()=>{}}) as CanvasRenderingContext2D);
  const state=await import('../src/ui/state'), {gameData}=await import('../src/data/load'), {createNewSave}=await import('../src/save/save');
  const engine=await import('../src/battle/battle-state'), {createRng}=await import('../src/core/rng'), active=await import('../src/progression/active-battle');
  const save=createNewSave(gameData.config,1); save.player.gems=gems;save.tutorial={step:'done',giftGiven:true}; save.progress.tutorialDone=true; state.commit(save);
  const stage=gameData.stages.find(s=>s.id==='st-1-1')!, owned=save.inventory.cards[0], members=[{cardId:owned.cardId,level:owned.level,uid:owned.uid}];
  const original=engine.startBattle(stage,members,null,createRng(123),gameData);
  lose(original);
  state.commit(active.recordBattleSnapshot(active.beginActiveBattle(state.getSave(),{stageId:stage.id,seed:123,members,helper:null,drops:{stageId:stage.id,drops:[]}},1),original.snapshot()));
  const resume=vi.spyOn(engine,'resumeBattle'); // passthrough observer, no engine replacement
  const {battleScreen}=await import('../src/ui/screens/battle');
  const {setOverlayHost}=await import('../src/ui/components/overlay');
  const host=document.createElement('div'); document.body.append(host);setOverlayHost(host);
  const nav={go:vi.fn(),replace:vi.fn(),back:vi.fn(),backTo:vi.fn()};
  const render=()=>{ const root=battleScreen.render({route:{name:'battle',args:[stage.id],query:{}},nav,onLeave:fn=>{leave=fn;}});host.append(root);return root; };
  render(); await vi.waitFor(()=>expect(host.querySelector('[aria-label="隊伍倒下了"]')).not.toBeNull());
  const battle=resume.mock.results.at(-1)!.value as Battle;
  const buttons=()=>[...host.querySelectorAll<HTMLButtonElement>('[aria-label="隊伍倒下了"] button')];
  return {state,battle,host,nav,active,render,buttons};
}
function lose(battle:Battle) {
  for(let i=0;i<150&&battle.getState().phase==='player';i++)battle.submitMove([]);
  expect(battle.getState().phase).toBe('lost');
}
it('one lost dialog double click50ms apart charges5 only once and commits paid successful snapshot atomically',async()=>{
  const {state,battle,buttons}=await setup(); const before=state.getSave().player.gems;
  const commits=vi.spyOn(state,'commit'), continued=vi.spyOn(battle,'continueBattle');
  const old=buttons().find(b=>b.textContent?.startsWith('續戰'))!;
  old.click(); await new Promise(r=>setTimeout(r,50)); expect(old.isConnected).toBe(true); old.click();
  expect(before-state.getSave().player.gems).toBe(5); expect(battle.getState().continues).toBe(1);
  expect(continued).toHaveBeenCalledTimes(1); expect(commits).toHaveBeenCalledTimes(1);
  expect(commits.mock.calls[0][0].activeBattle?.snapshot?.state.phase).toBe('player');
  expect(commits.mock.calls[0][0].activeBattle?.snapshot?.state.continues).toBe(1);
  expect(commits.mock.calls[0][0].player.gems).toBe(before-5);
});
it('real engine already in player phase rejects stale continue without payment or save writes',async()=>{
  const {state,battle,buttons}=await setup(); const old=buttons().find(b=>b.textContent?.startsWith('續戰'))!;
  expect(battle.continueBattle().ok).toBe(true); const before=JSON.stringify(state.getSave()), commits=vi.spyOn(state,'commit');
  old.click(); expect(JSON.stringify(state.getSave())).toBe(before); expect(commits).not.toHaveBeenCalled();
});
it('insufficient current gems rechecked at click without debit, and destroyed view old callback cannot act',async()=>{
  const {state,battle,buttons}=await setup(); const old=buttons().find(b=>b.textContent?.startsWith('續戰'))!;
  state.commit({...state.getSave(),player:{...state.getSave().player,gems:4}});const before=JSON.stringify(state.getSave());
  const continued=vi.spyOn(battle,'continueBattle'), commits=vi.spyOn(state,'commit');
  old.click(); expect(JSON.stringify(state.getSave())).toBe(before);expect(continued).not.toHaveBeenCalled();expect(commits).not.toHaveBeenCalled();
  state.commit({...state.getSave(),player:{...state.getSave().player,gems:50}});commits.mockClear();leave?.();leave=undefined;
  old.click();expect(state.getSave().player.gems).toBe(50);expect(continued).not.toHaveBeenCalled();expect(commits).not.toHaveBeenCalled();
});
it('second genuine loss has a new transaction; previous dialog callbacks cannot spend or abandon it',async()=>{
  const {state,battle,buttons,active,render,host}=await setup(); const [giveUp,oldContinue]=buttons();
  oldContinue.click();lose(battle);state.commit(active.recordBattleSnapshot(state.getSave(),battle.snapshot()));
  leave?.();leave=undefined;host.querySelector('.battle')?.remove();render();
  await vi.waitFor(()=>expect(buttons().filter(b=>!b.closest('.closing'))).toHaveLength(2));
  const before=state.getSave().player.gems;oldContinue.click();giveUp.click();
  expect(state.getSave().player.gems).toBe(before);expect(state.getSave().activeBattle).not.toBeNull();
  buttons().filter(b=>!b.closest('.closing')).find(b=>b.textContent?.startsWith('續戰'))!.click();
  expect(state.getSave().player.gems).toBe(before-5);expect(state.getSave().activeBattle?.snapshot?.state.continues).toBe(2);
});
it('free practice policy and actual repeated loss/continue need no payment or persisted progress',async()=>{
  const {battlePolicy}=await import('../src/ui/battle-policy'), {practiceSetup,DEMO_TEAM,DEMO_HELPER}=await import('../src/ui/demo');
  const {startBattle}=await import('../src/battle/battle-state'), {createRng}=await import('../src/core/rng');
  const state=await import('../src/ui/state'); const before=JSON.stringify(state.getSave());
  const policy=battlePolicy({practice:true});expect(policy.paidContinue).toBe(false);expect(policy.savesProgress).toBe(false);
  const {stage,data}=practiceSetup('normal'); const battle=startBattle(stage,DEMO_TEAM,DEMO_HELPER,createRng(42),data);
  // Real forfeit is a legitimate engine loss; this is policy/engine coverage, not the practice dialog journey.
  for(let n=1;n<=2;n++){battle.forfeit();expect(battle.continueBattle().ok).toBe(true);expect(battle.getState().continues).toBe(n);}
  expect(JSON.stringify(state.getSave())).toBe(before);
});
