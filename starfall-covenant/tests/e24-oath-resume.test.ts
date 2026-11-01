import {expect,it,vi} from 'vitest';
import {startBattle,resumeBattle,type Battle,type BattleSnapshot} from '../src/battle/battle-state';
import {createRng} from '../src/core/rng';
import {gameData} from '../src/data/load';
import {oathModifiers,oathSelectionProblem} from '../src/progression/oaths';
function finite(value:unknown):void{if(typeof value==='number')expect(Number.isFinite(value)).toBe(true);else if(value&&typeof value==='object')for(const item of Object.values(value))finite(item);}
function observe(battle:Battle){
 const log:{type:string;payload:unknown}[]=[];const emit=battle.events.emit.bind(battle.events);
 // Observe every event, not a hand-picked subset; preserve original emission and snapshot payload immediately.
 const spy=vi.spyOn(battle.events,'emit').mockImplementation((type,payload)=>{finite(payload);log.push({type:String(type),payload:structuredClone(payload)});emit(type,payload);});
 return{log,stop:()=>spy.mockRestore()};
}
it('actual st-1-4 shield expiry and sealLeader oath countdown match across JSON resume for three fixed empty turns',async()=>{
 const stage=gameData.stages.find(s=>s.id==='st-1-4')!;expect(stage.kind).toBe('main');expect(stage.waves[0].enemies).toContain('e0001');expect(gameData.enemies.find(e=>e.id==='e0001')!.abilities).toContainEqual({status:'shield',trigger:'onStart',turns:1});
 // Explicit isolated fixture: legal high-level real cards and fixed seed, not earned progress or UI playthrough.
 // No HP/CD/board/status edits. Three deliberate no-match moves advance natural timers without killing the wave.
 const seed=62423,oaths=['sealLeader'] as const;expect(oathSelectionProblem(oaths)).toBeNull();
 const live=startBattle(stage,[{cardId:'c405',level:99},{cardId:'c107',level:70}],null,createRng(seed),gameData,undefined,oathModifiers(oaths));
 const a=observe(live);let b:ReturnType<typeof observe>|undefined;
 try{
  await Promise.resolve();expect(a.log.map(e=>e.type)).toEqual(['battleStart','waveStart']);expect(a.log[0].payload).toEqual({state:live.getState()});
  const initial=live.snapshot();finite(initial);expect(initial.state.enemies.some(e=>e.statuses.some(s=>s.id==='shield'&&s.turns===1))).toBe(true);expect(initial.state.teamStatuses.find(s=>s.id==='attributeSeal')).toMatchObject({turns:3});
  const serialized=JSON.stringify(initial),saved=JSON.parse(serialized) as BattleSnapshot;const restored=resumeBattle(stage,saved,gameData);b=observe(restored);await Promise.resolve();expect(b.log.map(e=>e.type)).toEqual(['battleStart']);expect(b.log[0].payload).toEqual({state:live.getState()});expect(restored.snapshot()).toEqual(initial);expect(restored.getResult()).toEqual(live.getResult());a.log.length=0;b.log.length=0;
  const trace:{step:number;enemyShield:boolean;sealTurns:number|null;events:string[]}[]=[];
  for(let step=1;step<=3;step++){
   expect(live.getState().phase).toBe('player');expect(restored.getState().phase).toBe('player');const before=a.log.length;
   const left=live.submitMove([]),right=restored.submitMove([]);finite(left);finite(right);expect(left.ok).toBe(true);expect(right).toEqual(left);
   const snap=live.snapshot();finite(snap);finite(restored.snapshot());expect(restored.snapshot()).toEqual(snap);expect(restored.getResult()).toEqual(live.getResult());expect(b.log).toEqual(a.log);
   const enemyShield=snap.state.enemies.some(e=>e.statuses.some(s=>s.id==='shield')),seal=snap.state.teamStatuses.find(s=>s.id==='attributeSeal');expect(enemyShield).toBe(false);expect(seal?.turns??null).toBe(step===3?null:3-step);expect(snap.state.turns).toBe(step);expect(snap.state.wave).toBe(0);expect(snap.state.phase).toBe('player');trace.push({step,enemyShield,sealTurns:seal?.turns??null,events:a.log.slice(before).map(e=>e.type)});
  }
  const expired=a.log.filter(e=>e.type==='statusExpired').map(e=>e.payload as {side:string;status:{id:string}});expect(expired.some(e=>e.side==='enemy'&&e.status.id==='shield')).toBe(true);expect(expired.some(e=>e.status.id==='attributeSeal')).toBe(true);expect(a.log.filter(e=>e.type==='turnResolved')).toHaveLength(3);expect(a.log.some(e=>e.type==='enemyAttack')).toBe(true);expect(live.getState().hp).toBeLessThan(initial.state.hp);expect(live.getResult()).toBeNull();
  console.info('E24 oath fixed trace',JSON.stringify({seed,stage:stage.id,oaths,trace,events:a.log.map(e=>e.type),rng:live.snapshot().rng}));
 }finally{a.stop();b?.stop();}
});
