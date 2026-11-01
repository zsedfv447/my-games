import {afterEach,describe,it,expect,vi} from 'vitest';
import {Audio} from './audio';
const param=()=>({value:1,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}});
function sound(){
  const sources:{stops:number[];onended:(()=>void)|null;start():void;stop(t:number):void;connect():void;disconnect():void;frequency:ReturnType<typeof param>;type:string;buffer:unknown}[]=[];
  const source=()=>{const s={stops:[] as number[],onended:null as (()=>void)|null,start(){},stop(t:number){this.stops.push(t);},connect(){},disconnect(){},frequency:param(),type:'sine',buffer:null as unknown};sources.push(s);return s;};
  const audio=new Audio() as any;
  audio.ctx={currentTime:1,sampleRate:100,createOscillator:source,createBufferSource:source,createGain:()=>({gain:param(),connect(){},disconnect(){}}),createBiquadFilter:()=>({type:'bandpass',frequency:param(),connect(){},disconnect(){}}),createBuffer:(_c:number,n:number)=>({getChannelData:()=>new Float32Array(n)})};
  audio.master={gain:param()};vi.spyOn(performance,'now').mockReturnValue(1000);
  return {audio,sources};
}
afterEach(()=>vi.restoreAllMocks());
describe('combat audio cancellation at a presentation boundary',()=>{
  it('stops active attack sources on map/pause reset while leaving UI sounds alone',()=>{
    const {audio,sources}=sound();audio.play('swing','combat');audio.play('click');
    expect(typeof audio.stopCombat).toBe('function');audio.stopCombat();
    expect(sources[0].stops).toContain(1);expect(sources[1].stops).not.toContain(1);
    expect(()=>audio.stopCombat()).not.toThrow();
  });
  it('muting cancels active attack sound tails before they can return after unmuting',()=>{
    const {audio,sources}=sound();audio.play('fire','combat');audio.setMuted(true);audio.setMuted(false);
    expect(sources.every(s=>s.stops.includes(1))).toBe(true);
  });
});
