import {recordVitals,type GameState} from './rules/state';

export type LiveSnapshot={dead:boolean;hp:number;sp:number;map:string;x:number;y:number};
/** A death has already committed its canonical save point in the rules layer. */
export function captureSession(state:GameState,live:LiveSnapshot):GameState{
  if(live.dead)return structuredClone(state);
  return recordVitals(state,{map:live.map,x:live.x,y:live.y},live.hp,live.sp);
}

/** Imports and resets form a barrier against all previously queued autosaves. */
export class SaveQueue{
  private tail:Promise<void>=Promise.resolve();
  private generation=0;
  private barriers=0;
  write(operation:()=>Promise<void>):Promise<void>{
    if(this.barriers)return this.tail;
    const generation=this.generation;
    return this.enqueue(async()=>{if(generation===this.generation)await operation();});
  }
  exclusive(operation:()=>Promise<void>):Promise<void>{
    this.generation++;this.barriers++;
    return this.enqueue(operation).finally(()=>{this.barriers--;});
  }
  private enqueue(operation:()=>Promise<void>):Promise<void>{
    const result=this.tail.then(operation);
    this.tail=result.catch(()=>{});return result;
  }
}
