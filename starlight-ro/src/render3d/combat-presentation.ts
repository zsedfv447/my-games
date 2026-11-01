import type {SimEvent} from '../world/sim';
import {skills} from '../data/jobs';
import type {Sfx} from '../audio';

export type CombatContext={weaponType:string|null;ranged:boolean;attackCadence:number;skillCadence:number};
type Action={start:number;duration:number;startPhase:number;target:{x:number;y:number}};
type Cue={at:number;order:number;event?:SimEvent;run?:()=>void};
// Native Sword_Regular_A is 13/30 s. Its upper-arm strike accelerates at frames 6–8.
// These are skeletal-speed estimates, not authored contact markers or human hearing approval.
const RELEASE=6/13,CONTACT=8/13,CAST_RELEASE=4/15;

/** A render clock, not a second simulation. Input events and all authoritative state stay untouched. */
export class CombatPresentation{
  private clock=0;private serial=0;private cues:Cue[]=[];private active:Action|null=null;
  advance(seconds:number){if(Number.isFinite(seconds))this.clock+=Math.max(0,seconds);}
  reset(){this.cues=[];this.active=null;}
  defer(seconds:number,run:()=>void){this.cues.push({at:this.clock+Math.max(0,seconds),order:++this.serial,run});}
  action(){
    const a=this.active;if(!a||this.clock>=a.start+a.duration-1e-9)return null;
    const k=Math.max(0,Math.min(1,(this.clock-a.start)/a.duration));
    return {progress:a.startPhase+(1-a.startPhase)*k,target:a.target};
  }
  pendingImpact(id:number){return this.cues.some(c=>c.at>this.clock+1e-9&&c.event?.t==='dmg'&&c.event.to==='m'&&c.event.id===id);}
  enqueue(events:readonly SimEvent[],ctx:CombatContext){
    if(events.some(e=>e.t==='death'))this.reset();
    const gates=new Map<string,number>(),lastHit=new Map<number,number>();
    const doubleArrow=events.some(e=>e.t==='skill'&&e.skill==='doubleStrafe');
    const lightning=events.some(e=>e.t==='skill'&&e.skill==='lightningBolt');
    let arrows=0,meleeContact=this.clock;
    for(const raw of events){
      let event=raw,at=this.clock;
      if(event.t==='swing'&&event.who==='p'||event.t==='skill'){
        const skill=event.t==='skill'?skills[event.skill]:null;
        const melee=event.t==='swing'?!ctx.ranged&&ctx.weaponType!=='staff':!!skill?.tags.includes('melee');
        const cadence=event.t==='swing'?ctx.attackCadence:ctx.skillCadence;
        const duration=Math.max(.1,Math.min(.36,cadence*.8));
        const target=event.t==='swing'?{x:event.tx,y:event.ty}:{...event.to};
        this.active={start:this.clock,duration,startPhase:melee?0:CAST_RELEASE,target};
        if(melee){
          at+=duration*RELEASE;meleeContact=this.clock+duration*CONTACT;
          gates.set(event.t==='swing'?'attack':event.skill,meleeContact);
        }
      }
      if(event.t==='dmg'&&event.to==='m'){
        at=gates.get(event.src)??at;if(event.id!==undefined)lastHit.set(event.id,at);
      }
      if(event.t==='kill')at=lastHit.get(event.id)??at;
      if(event.t==='fx'){
        if(event.kind==='bash'||event.kind==='magnum')at=meleeContact;
        if(event.kind==='thunder'&&lightning)at+=event.dur;
        if(event.kind==='arrow'&&doubleArrow){
          const delay=arrows++*.12;at+=delay;event={...event,dur:Math.max(1/60,event.dur-delay)};
        }
      }
      this.cues.push({at,order:++this.serial,event});
    }
  }
  drain():SimEvent[]{
    const ready=this.cues.filter(c=>c.at<=this.clock+1e-9).sort((a,b)=>a.at-b.at||a.order-b.order);
    this.cues=this.cues.filter(c=>c.at>this.clock+1e-9);
    const events:SimEvent[]=[];for(const cue of ready){if(cue.event)events.push(cue.event);else cue.run?.();}
    return events;
  }
}

/** Launch and impact are separate cues; a ranged skill never duplicates its projectile launch sound. */
export function combatSounds(event:SimEvent,ctx:Pick<CombatContext,'weaponType'|'ranged'>):Sfx[]{
  if(event.t==='dmg'){
    if(event.miss)return ['miss'];if(event.to==='p')return ['hurt'];
    const body:Sfx=event.crit?'crit':'hit',magic=skills[event.src]?.tags.includes('magic');
    if(magic&&event.element==='fire')return ['fire',body];
    if(magic&&event.element==='water')return ['ice',body];
    return [body];
  }
  if(event.t==='swing'&&event.who==='p')return ctx.ranged?[]:ctx.weaponType==='staff'?['cast']:['swing'];
  if(event.t==='skill')return skills[event.skill]?.tags.includes('melee')?['swing']:skills[event.skill]?.tags.includes('magic')?['cast']:[];
  if(event.t==='castStart')return ['cast'];
  if(event.t==='fx')return event.kind==='arrow'||event.kind==='arrowRain'?['arrow']:event.kind==='thunder'?['thunder']:event.kind==='magnum'||event.kind==='explode'||event.kind==='meteor'?['fire']:[];
  return event.t==='kill'?['kill']:[];
}
