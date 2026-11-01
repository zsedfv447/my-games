import {describe,it,expect} from 'vitest';
import type {SimEvent} from '../world/sim';
const context={weaponType:'sword',ranged:false,attackCadence:.72,skillCadence:.35};
const swing:SimEvent={t:'swing',who:'p',tx:3,ty:2};
const hit:SimEvent={t:'dmg',to:'m',id:1,x:3,y:2,amount:10,element:'neutral',src:'attack'};
async function timeline(){
  const path='./combat-presentation.ts';const m=await import(path).catch(()=>null);
  expect(m,'the shared combat presentation timeline must exist').not.toBeNull();
  return new m.CombatPresentation();
}
describe('attack sounds share visible release and contact beats',()=>{
  it('keeps release and contact separate while using the same action progress',async()=>{
    const p=await timeline();p.enqueue([swing,hit],context);
    expect(p.drain()).toEqual([]);expect(p.action().progress).toBe(0);
    p.advance(.17);expect(p.drain()).toEqual([swing]);expect(p.action().progress).toBeGreaterThan(6/13);
    p.advance(.06);expect(p.drain()).toEqual([hit]);expect(p.action().progress).toBeCloseTo(23/36);
  });
  it('restarts every fast attack and completes each contact before the next attack',async()=>{
    const p=await timeline(),fast={...context,attackCadence:.28};const shown:SimEvent[]=[];
    for(let i=0;i<8;i++){
      p.enqueue([swing,hit],fast);expect(p.action().progress).toBe(0);
      p.advance(.11);shown.push(...p.drain());p.advance(.04);shown.push(...p.drain());
      p.advance(.13);shown.push(...p.drain());expect(p.action()).toBeNull();
    }
    expect(shown.filter(e=>e.t==='swing')).toHaveLength(8);expect(shown.filter(e=>e.t==='dmg')).toHaveLength(8);
  });
  it('launches ranged motion and sound now, and leaves projectile damage at its real arrival',async()=>{
    const p=await timeline(),arrow:SimEvent={t:'fx',kind:'arrow',x:0,y:0,tx:3,ty:2,dur:.3};
    p.enqueue([swing,arrow],{...context,weaponType:'bow',ranged:true});
    expect(p.drain()).toEqual([swing,arrow]);expect(p.action().progress).toBe(4/15);
    p.advance(.3);p.enqueue([hit],context);expect(p.drain()).toEqual([hit]);
  });
  it('keeps magic hit times and spaces both arrows without replaying a launch at impact',async()=>{
    const p=await timeline();
    const skill:SimEvent={t:'skill',skill:'doubleStrafe',lv:1,from:{x:0,y:0},to:{x:3,y:2}};
    const first:SimEvent={t:'fx',kind:'arrow',x:0,y:0,tx:3,ty:2,dur:.3};
    const second:SimEvent={...first,dur:.42};p.enqueue([skill,first,second],context);
    expect(p.drain()).toEqual([skill,first]);p.advance(.12);
    expect(p.drain()).toEqual([{...second,dur:.3}]);
    const fire:SimEvent={...hit,src:'fireBolt',element:'fire'};p.enqueue([fire],context);expect(p.drain()).toEqual([fire]);
  });
  it('schedules lightning visual strikes at the same individual bolt beats, not all at cast release',async()=>{
    const p=await timeline(),skill:SimEvent={t:'skill',skill:'lightningBolt',lv:2,from:{x:0,y:0},to:{x:3,y:2}};
    const one:SimEvent={t:'fx',kind:'thunder',x:3,y:2,dur:.12,element:'wind'},two:SimEvent={...one,dur:.29};
    p.enqueue([skill,one,two],context);expect(p.drain()).toEqual([skill]);
    p.advance(.12);expect(p.drain()).toEqual([one]);p.advance(.17);expect(p.drain()).toEqual([two]);
  });
  it('map or pause reset cancels both pending contact and delayed effect callbacks',async()=>{
    const p=await timeline();let expired=0;p.enqueue([swing,hit],context);p.defer(.3,()=>expired++);
    p.advance(.17);expect(p.drain()).toEqual([swing]);p.reset();p.advance(1);
    expect(p.drain()).toEqual([]);expect(expired).toBe(0);expect(p.action()).toBeNull();
  });
  it('holds a killed monster until its contact cue without changing the simulation event objects',async()=>{
    const p=await timeline(),kill:SimEvent={t:'kill',id:1,monster:'poring',x:3,y:2,exp:1,jexp:1,mvp:false};
    const source=structuredClone([swing,hit,kill]);p.enqueue(source,context);
    expect(p.pendingImpact(1)).toBe(true);p.advance(.23);expect(p.drain()).toEqual([swing,hit,kill]);
    expect(p.pendingImpact(1)).toBe(false);expect(source).toEqual([swing,hit,kill]);
  });
});
