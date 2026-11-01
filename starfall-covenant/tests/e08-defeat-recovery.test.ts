// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import type { Router } from '../src/ui/router';
let router: Router | undefined;
afterEach(()=>{router?.stop();router=undefined;vi.restoreAllMocks();document.body.replaceChildren();});
const wait=(ms:number)=>new Promise(r=>setTimeout(r,ms));
async function wonAfterPaidRevive() {
  vi.resetModules();localStorage.clear();history.replaceState(null,'','#/battle/st-1-1');
  vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(new Proxy({}, {get:(_t,key)=>key==='createLinearGradient'||key==='createRadialGradient'?()=>({addColorStop(){}}):()=>{}}) as CanvasRenderingContext2D);
  const state=await import('../src/ui/state');const {gameData}=await import('../src/data/load');
  const engine=await import('../src/battle/battle-state');const {createRng}=await import('../src/core/rng');
  const active=await import('../src/progression/active-battle');const {planDrops}=await import('../src/progression/drops');
  const stage=gameData.stages.find(s=>s.id==='st-1-1')!;
  const save=structuredClone(state.getSave());save.player.gems=30;save.tutorial={step:'done',giftGiven:true};save.progress.tutorialDone=true;
  // Explicit test roster fixture, not granted gameplay progress: real existing c305 with real stats/skills.
  const {expForLevel}=await import('../src/growth/level');
  Object.assign(save.inventory.cards[0],{cardId:'c305',level:70,exp:expForLevel(state.growth.card('c305')!,70,state.growth.rules),skillLevel:6});state.commit(save);
  state.updateSettings({lowFx:true,battleFx:false,battleSpeed:2});
  const card=state.getSave().inventory.cards[0],members=[{cardId:card.cardId,level:card.level,skillLevel:card.skillLevel,uid:card.uid}];
  let seed=0,plan=planDrops(stage,createRng(active.dropSeed({seed})));
  while(!plan.drops.length&&seed<100) {seed++;plan=planDrops(stage,createRng(active.dropSeed({seed})));}
  expect(plan.drops.length).toBeGreaterThan(0); // actual deterministic roll, no invented reward
  const lost=engine.startBattle(stage,members,null,createRng(seed),gameData);
  for(let i=0;i<300&&lost.getState().phase==='player';i++)lost.submitMove([]);
  expect(lost.getState().phase).toBe('lost');
  const ticket=active.beginActiveBattle(state.getSave(),{stageId:stage.id,seed,members,helper:null,drops:plan},Date.now());
  state.commit(active.recordBattleSnapshot(ticket,lost.snapshot()));
  const resume=vi.spyOn(engine,'resumeBattle');
  const {startApp}=await import('../src/ui/app');const host=document.createElement('div');document.body.append(host);router=startApp(host);
  await vi.waitFor(()=>expect(host.querySelector('[aria-label="隊伍倒下了"]')).not.toBeNull());
  const before=structuredClone(state.getSave());
  [...host.querySelectorAll<HTMLButtonElement>('[aria-label="隊伍倒下了"] button')].find(b=>b.textContent?.startsWith('續戰'))!.click();
  expect(state.getSave().player.gems).toBe(before.player.gems-5);
  const battle=resume.mock.results.at(-1)!.value as ReturnType<typeof engine.resumeBattle>;
  expect(battle.getState().continues).toBe(1);expect(battle.useSkill(0).ok).toBe(true);
  for(let i=0;i<30&&battle.getState().phase==='player'&&battle.getState().team[0].skillCooldown!==0;i++)battle.submitMove([]);
  expect(battle.getState().phase).toBe('player');expect(battle.useSkill(0).ok).toBe(true);
  expect(battle.getState().phase).toBe('won');expect(battle.getResult()?.continues).toBe(1);
  // Actual engine outcome persisted for interrupted-victory recovery; reward algorithms remain real.
  state.commit(active.recordBattleSnapshot(state.getSave(),battle.snapshot()));
  return {state,stage,plan,host,before,battle};
}

it('paid revival→real victory→resumed result grants once; noContinue star stays false and settled re-entry cannot reward again',async()=>{
  const {state,stage,plan,host,before,battle}=await wonAfterPaidRevive();
  router!.replace('battle',[stage.id]);
  await vi.waitFor(()=>expect(state.getSave().activeBattle).toBeNull(),{timeout:5000});
  await wait(250);
  const settled=structuredClone(state.getSave());
  expect(settled.player.gems).toBe(before.player.gems-5+(stage.rewards.firstClear?.gems??0));
  expect(settled.player.coin).toBe(before.player.coin+stage.rewards.coin);
  expect(settled.inventory.cards.length).toBe(before.inventory.cards.length+plan.drops.length);
  expect(settled.progress.clearedStages.filter(id=>id===stage.id)).toHaveLength(1);
  const noContinue=stage.stars!.findIndex(s=>s.type==='noContinue');expect(noContinue).toBeGreaterThanOrEqual(0);
  expect(settled.progress.stars[stage.id][noContinue]).toBe(false);expect(battle.getResult()?.continues).toBe(1);
  for(const drop of plan.drops) expect(settled.inventory.cards.filter(c=>c.cardId===drop.cardId).length-before.inventory.cards.filter(c=>c.cardId===drop.cardId).length).toBe(plan.drops.filter(d=>d.cardId===drop.cardId).length);
  const {SAVE_KEY,parseSave}=await import('../src/save/save');const {gameData}=await import('../src/data/load');
  const loaded=parseSave(localStorage.getItem(SAVE_KEY),gameData.config,Date.now());expect(loaded.ok).toBe(true);
  if(loaded.ok) {expect(loaded.save.activeBattle).toBeNull();expect(loaded.save.player).toEqual(settled.player);expect(loaded.save.inventory.cards).toEqual(settled.inventory.cards);}
  router!.replace('settings');router!.replace('battle',[stage.id]);
  expect(host.textContent).toContain('戰鬥已中斷');await wait(700);
  expect(state.getSave().player).toEqual(settled.player);expect(state.getSave().inventory.cards).toEqual(settled.inventory.cards);
},20000);

it('re-entering recovered won battle during finisher must not settle the same ticket twice',async()=>{
  const {state,stage,plan,before}=await wonAfterPaidRevive();
  const {bus}=await import('../src/core/events');const events=vi.spyOn(bus,'emit');
  router!.replace('battle',[stage.id]);await wait(50); // first real onWin is awaiting finisher
  expect(state.getSave().activeBattle?.snapshot?.state.phase).toBe('won');
  router!.replace('battle',[stage.id]);
  await wait(1200);
  expect(state.getSave().activeBattle).toBeNull();
  const after=state.getSave();const added=after.inventory.cards.filter(c=>!before.inventory.cards.some(old=>old.uid===c.uid));
  const cardExp=after.inventory.cards.find(c=>c.uid===before.inventory.cards[0].uid)!.exp-before.inventory.cards[0].exp;
  const clears=events.mock.calls.filter(([kind])=>kind==='stageCleared').length;
  console.info('E08_SETTLEMENT_EVIDENCE',JSON.stringify({coinDelta:after.player.coin-before.player.coin,playerExpDelta:after.player.exp-before.player.exp,levelBefore:before.player.level,levelAfter:after.player.level,cardExpDelta:cardExp,added:added.map(c=>({id:c.cardId,uid:c.uid})),stageCleared:clears,gemsDelta:after.player.gems-before.player.gems}));
  expect.soft(after.player.coin).toBe(before.player.coin+stage.rewards.coin);
  expect.soft(after.player.gems).toBe(before.player.gems-5+(stage.rewards.firstClear?.gems??0));
  expect.soft(after.inventory.cards).toHaveLength(before.inventory.cards.length+plan.drops.length);
  expect.soft(cardExp).toBe(stage.rewards.cardExp);
  expect.soft(clears).toBe(1);
},20000);

it('leaving recovered win during finisher defers settlement until a live resume, without background rewards',async()=>{
  const {state,stage,before,plan}=await wonAfterPaidRevive();
  const pending=structuredClone(state.getSave());
  const {bus}=await import('../src/core/events');const events=vi.spyOn(bus,'emit');
  router!.replace('battle',[stage.id]);await wait(50);router!.replace('settings');await wait(700);
  expect.soft(state.getSave().player).toEqual(pending.player);
  expect.soft(state.getSave().inventory.cards).toEqual(pending.inventory.cards);
  expect.soft(state.getSave().activeBattle).toEqual(pending.activeBattle);
  expect.soft(events.mock.calls.filter(([kind])=>kind==='stageCleared')).toHaveLength(0);
  router!.replace('battle',[stage.id]);
  await vi.waitFor(()=>expect(state.getSave().activeBattle).toBeNull(),{timeout:5000});
  expect(state.getSave().player.coin).toBe(before.player.coin+stage.rewards.coin);
  expect(state.getSave().inventory.cards).toHaveLength(before.inventory.cards.length+plan.drops.length);
  expect(events.mock.calls.filter(([kind])=>kind==='stageCleared')).toHaveLength(1);
},20000);

it.each([0,50])('same-stage replacement ticket at %sms survives an older winning view without reward or accidental clear',async(delay)=>{
  const {state,stage,plan}=await wonAfterPaidRevive();
  const {startBattle}=await import('../src/battle/battle-state');const {createRng}=await import('../src/core/rng');
  const {beginActiveBattle,recordBattleSnapshot}=await import('../src/progression/active-battle');const {gameData}=await import('../src/data/load');
  router!.replace('battle',[stage.id]);if(delay) await wait(delay);
  const members=state.getSave().activeBattle!.members,seed=999;
  const fresh=startBattle(stage,members,null,createRng(seed),gameData);
  const replacement=recordBattleSnapshot(beginActiveBattle(state.getSave(),{stageId:stage.id,seed,members,helper:null,drops:plan},Date.now()+1),fresh.snapshot());
  state.commit(replacement);const stable=structuredClone(state.getSave());await wait(700);
  expect.soft(state.getSave().activeBattle).toEqual(stable.activeBattle);
  expect.soft(state.getSave().player).toEqual(stable.player);
  expect.soft(state.getSave().inventory.cards).toEqual(stable.inventory.cards);
  expect.soft(state.getSave().progress.clearedStages).toEqual(stable.progress.clearedStages);
},20000);
