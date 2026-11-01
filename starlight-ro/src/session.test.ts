import {describe,it,expect} from 'vitest';
import {SaveQueue,captureSession} from './session';
import {applyDeath,newGame} from './rules/state';

describe('session save boundaries',()=>{
  it('keeps canonical death destination instead of copying dead world position',()=>{
    const s=applyDeath(newGame());
    const next=captureSession(s,{dead:true,hp:0,sp:4,map:'meadow',x:31,y:56});
    expect(next.position).toEqual(s.savePoint);expect(next.char.hp).toBe(1);
  });
  it('records live position without mutating prior state',()=>{
    const s=newGame(),next=captureSession(s,{dead:false,hp:12,sp:3,map:'meadow',x:10,y:11});
    expect(next.position.map).toBe('meadow');expect(next.char.hp).toBe(12);expect(s.position.map).toBe('town');
  });
  it('an import supersedes queued autosaves and rejects writes during replacement',async()=>{
    let stored='old';const q=new SaveQueue();
    const old=q.write(async()=>{stored='old snapshot';});
    const replacement=q.exclusive(async()=>{stored='imported';});
    const late=q.write(async()=>{stored='pagehide old snapshot';});
    await Promise.all([old,replacement,late]);expect(stored).toBe('imported');
    await q.write(async()=>{stored='new gameplay';});expect(stored).toBe('new gameplay');
  });
  it('clear is ordered after an active write and prevents stale queued writes',async()=>{
    let release!:()=>void,stored='old';const q=new SaveQueue();
    const writing=q.write(async()=>{await new Promise<void>(r=>release=r);stored='saved';});
    await Promise.resolve();
    const clear=q.exclusive(async()=>{stored='';});
    void q.write(async()=>{stored='stale';});release();await Promise.all([writing,clear]);expect(stored).toBe('');
  });
  it('a failed write does not poison future saves',async()=>{
    const q=new SaveQueue();await expect(q.write(async()=>{throw Error('disk');})).rejects.toThrow('disk');
    let saved=false;await q.write(async()=>{saved=true;});expect(saved).toBe(true);
  });
});
