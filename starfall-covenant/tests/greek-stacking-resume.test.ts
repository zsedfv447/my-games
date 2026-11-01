import {expect,it,vi} from 'vitest';
import {gameData} from '../src/data/load';
import {createRng} from '../src/core/rng';
import {boardFromStrings} from '../src/battle/board';
import {startBattle,resumeBattle,type Battle,type BattleSnapshot} from '../src/battle/battle-state';
function finite(value:unknown):void{if(typeof value==='number')expect(Number.isFinite(value)).toBe(true);else if(value&&typeof value==='object')Object.values(value).forEach(finite);}
function observe(battle:Battle){const log:{type:string;payload:unknown}[]=[];const emit=battle.events.emit.bind(battle.events);const spy=vi.spyOn(battle.events,'emit').mockImplementation((type,payload)=>{finite(payload);log.push({type:String(type),payload:structuredClone(payload)});emit(type,payload);});return{log,stop:()=>spy.mockRestore()};}
it('real dual c807 same-version JSON resume preserves nonempty forced-enhanced suffix, RNG, complete events and results',async()=>{
 const dataBefore=JSON.stringify(gameData),stage=gameData.stages.find(s=>s.id==='st-1-1')!,seed=30071;
 const initial=startBattle(stage,[{cardId:'c807',level:1}],{cardId:'c807',level:1},createRng(seed),gameData),opening=observe(initial);
 let a:ReturnType<typeof observe>|undefined,b:ReturnType<typeof observe>|undefined;
 try{
  await Promise.resolve();expect(opening.log.map(e=>e.type)).toEqual(['battleStart','waveStart']);expect(opening.log[0].payload).toEqual({state:initial.getState()});
  // Explicit board-only checkpoint fixture. Real cards/leader/helper/enemy stats,
  // cooldowns and battle rules are unchanged. Bottom-row adjacent swap is legal.
  const setup=initial.snapshot();setup.state.board=boardFromStrings(['fffwgl','wghdlf','ghdlfw','hdlfwg','dlfwgh']);
  const live=resumeBattle(stage,setup,gameData);a=observe(live);await Promise.resolve();expect(a.log.map(e=>e.type)).toEqual(['battleStart']);expect(a.log[0].payload).toEqual({state:live.getState()});
  const checkpoint=live.snapshot();expect(checkpoint.state.team.filter(m=>m.isHelper).map(m=>m.cardId)).toEqual(['c807']);expect(checkpoint.state.board.cells.every(o=>!o.enhanced)).toBe(true);
  const saved=JSON.parse(JSON.stringify(checkpoint)) as BattleSnapshot,restored=resumeBattle(stage,saved,gameData);b=observe(restored);await Promise.resolve();expect(b.log.map(e=>e.type)).toEqual(['battleStart']);expect(b.log[0].payload).toEqual({state:live.getState()});expect(restored.snapshot()).toEqual(checkpoint);expect(restored.getResult()).toEqual(live.getResult());a.log.length=0;b.log.length=0;
  const actions=[[{row:4,col:4},{row:4,col:5}],[{row:3,col:0},{row:3,col:1}]];
  const trace:unknown[]=[];
  for(const [index,path]of actions.entries()){
   expect(live.getState().phase).toBe('player');expect(restored.getState().phase).toBe('player');const rngBefore=live.snapshot().rng;
   const left=live.submitMove(path),right=restored.submitMove(path);expect(left.ok).toBe(true);expect(right).toEqual(left);finite(left);
   if(!left.ok)throw new Error('legal suffix rejected');
   if(index===0){
    expect(left.summary.steps.length).toBeGreaterThan(0);const first=left.summary.steps[0];expect(first.groups.filter(g=>g.orb==='fire').reduce((n,g)=>n+g.cells.length,0)).toBe(3);
    const forced=first.after.cells.filter(o=>o.enhanced);expect(forced).toHaveLength(2);expect(forced.every(o=>o.type==='fire')).toBe(true);expect(live.snapshot().rng).not.toEqual(rngBefore);
   }
   const snapshot=live.snapshot();finite(snapshot);expect(restored.snapshot()).toEqual(snapshot);expect(restored.getResult()).toEqual(live.getResult());expect(b.log).toEqual(a.log);
   trace.push({index,turn:left.summary.turn,combo:left.summary.combo,steps:left.summary.steps.length,rngBefore,rngAfter:snapshot.rng,phase:snapshot.state.phase});
  }
  expect(a.log.filter(e=>e.type==='turnResolved')).toHaveLength(2);expect((a.log.find(e=>e.type==='turnResolved')!.payload as {combo:number}).combo).toBeGreaterThan(0);expect(live.snapshot().rng).not.toEqual(checkpoint.rng);expect(JSON.stringify(gameData)).toBe(dataBefore);
  console.info('GREEK_JSON_RESUME_TRACE',JSON.stringify({seed,stage:stage.id,trace,eventTypes:a.log.map(e=>e.type),result:live.getResult()}));
 }finally{opening.stop();a?.stop();b?.stop();}
});
