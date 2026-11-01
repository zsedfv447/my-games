// One complete snapshot per transaction. Only validated snapshots may rotate into the backup.
import { validateGame, normalizeGame, type GameState } from './rules/state';

export type RecoveryStatus = {source:'empty'|'main'|'backup';migrated:boolean;message?:string};
const PRE_UPGRADE='pre-upgrade-v2.2';
function decode(raw:unknown):GameState {const state=normalizeGame(raw);validateGame(state);return state;}
const errorText=(e:unknown)=>e instanceof Error?e.message:String(e);
/** v6.1 multiple characters: slot 0 keeps the original keys (old saves need no migration); slot n uses "main:n" etc. */
export const SLOT_COUNT=6;
export type SlotSummary={slot:number;empty:boolean;broken?:boolean;name?:string;job?:string;job2?:string|null;baseLv?:number;jobLv?:number;job2Lv?:number;map?:string;hair?:number;hairColor?:number;zeny?:number};
const slotKey=(slot:number,base:string)=>slot===0?base:`${base}:${slot}`;
export class SaveStore {
  /** Which character slot this store reads and writes. */
  slot=0;
  private k(base:string){return slotKey(this.slot,base);}
  private db:Promise<IDBDatabase>;
  recoveryStatus:RecoveryStatus={source:'empty',migrated:false};
  constructor(name='starlight-ro'){
    this.db=new Promise((resolve,reject)=>{
      const req=indexedDB.open(name,1);
      req.onupgradeneeded=()=>req.result.createObjectStore('saves');
      req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
    });
  }
  private async tx<T>(mode:IDBTransactionMode,run:(s:IDBObjectStore,done:(v:T)=>void)=>void):Promise<T>{
    const db=await this.db;
    return new Promise<T>((resolve,reject)=>{
      const t=db.transaction('saves',mode),store=t.objectStore('saves');let value:T;
      try{run(store,v=>{value=v;});}catch(e){t.abort();reject(e);return;}
      t.oncomplete=()=>resolve(value);t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error??new Error('存檔交易中止'));
    });
  }
  private async read(key:string):Promise<unknown>{
    return this.tx<unknown>('readonly',(s,done)=>{const r=s.get(key);r.onsuccess=()=>done(r.result);});
  }
  /** A once-only copy of the untouched save before its first successful legacy normalization. */
  async preUpgradeBackup():Promise<unknown>{return this.read(this.k(PRE_UPGRADE));}
  private async preserveOnce(key:string,value:unknown):Promise<void>{
    await this.tx<void>('readwrite',(s,done)=>{const r=s.get(key);r.onsuccess=()=>{if(r.result===undefined)s.put(structuredClone(value),key);done();};});
  }
  async load():Promise<GameState|null>{
    const raw=await this.read(this.k('main'));let mainError:unknown;
    if(raw!==undefined&&raw!==null){
      try{
        const v=decode(raw),migrated=JSON.stringify(v)!==JSON.stringify(raw);
        if(migrated)await this.preserveOnce(this.k(PRE_UPGRADE),raw);
        this.recoveryStatus={source:'main',migrated};return v;
      }catch(e){mainError=e;}
    }
    const backup=await this.read(this.k('backup'));
    if(backup===undefined||backup===null){
      if(mainError)throw new Error(`主存檔損壞，沒有可用的備份：${errorText(mainError)}`);
      this.recoveryStatus={source:'empty',migrated:false};return null;
    }
    let state:GameState;
    try{state=decode(backup);}catch(e){throw new Error(`主存檔與備份皆無法載入：${errorText(e)}`);}
    const migrated=JSON.stringify(state)!==JSON.stringify(backup);
    if(migrated)await this.preserveOnce(this.k(PRE_UPGRADE),backup);
    if(mainError)await this.preserveOnce(this.k('corrupt-main'),raw);
    this.recoveryStatus={source:'backup',migrated,message:mainError?'主存檔損壞，已從備份復原。':'主存檔遺失，已從備份復原。'};
    return state;
  }
  /** Validates before touching IndexedDB, and resolves only after the transaction commits. */
  async save(state:GameState):Promise<void>{
    const snapshot=structuredClone(state);validateGame(snapshot);
    const MAIN=this.k('main'),BACKUP=this.k('backup'),PRE=this.k(PRE_UPGRADE),CORRUPT=this.k('corrupt-main');
    await this.tx<void>('readwrite',(s,done)=>{
      const r=s.get(MAIN);
      r.onsuccess=()=>{
        if(r.result!==undefined&&r.result!==null){
          try{
            const valid=decode(r.result);s.put(valid,BACKUP);
            if(JSON.stringify(valid)!==JSON.stringify(r.result)){
              const before=structuredClone(r.result),previous=s.get(PRE);
              previous.onsuccess=()=>{if(previous.result===undefined)s.put(before,PRE);};
            }
          }
          catch{
            // Preserve evidence and leave the existing good backup untouched.
            const bad=structuredClone(r.result),preserved=s.get(CORRUPT);
            preserved.onsuccess=()=>{if(preserved.result===undefined)s.put(bad,CORRUPT);};
          }
        }
        s.put(snapshot,MAIN);done();
      };
    });
  }
  /** Deletes only this slot's character (other characters are untouched). */
  async clear():Promise<void>{
    const MAIN=this.k('main'),BACKUP=this.k('backup');
    await this.tx<void>('readwrite',(s,done)=>{s.delete(MAIN);s.delete(BACKUP);done();});
    this.recoveryStatus={source:'empty',migrated:false};
  }
  /** Read-only overview of every slot for the character select screen (main, falling back to backup). */
  async summaries():Promise<SlotSummary[]>{
    const out:SlotSummary[]=[];
    for(let slot=0;slot<SLOT_COUNT;slot++){
      let raw:unknown=await this.read(slotKey(slot,'main'));let state:GameState|null=null;
      try{if(raw!=null)state=decode(raw);}catch{/* try the backup */}
      if(!state){const b=await this.read(slotKey(slot,'backup'));try{if(b!=null){state=decode(b);raw=b;}}catch{/* broken */}}
      if(!state){out.push({slot,empty:raw==null,broken:raw!=null});continue;}
      if(!state.created){out.push({slot,empty:true});continue;}
      const c=state.char;out.push({slot,empty:false,name:c.name,job:c.job,job2:c.job2??null,baseLv:c.baseLv,jobLv:c.jobLv,job2Lv:c.job2Lv,map:state.position.map,hair:c.hair,hairColor:c.hairColor,zeny:c.zeny});
    }
    return out;
  }
}
