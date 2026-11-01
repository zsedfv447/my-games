// @vitest-environment happy-dom
import {afterEach,expect,it,vi} from 'vitest';
import {startBattle} from '../src/battle/battle-state';
import {gameData} from '../src/data/load';
import {createRng} from '../src/core/rng';
import type {AssistantPlan} from '../src/battle/assistant/types';
import {openOrbAssistant} from '../src/ui/components/orb-assistant';
import {setOverlayHost} from '../src/ui/components/overlay';
import {closeRouteScoped} from '../src/ui/route-scope';
afterEach(()=>{closeRouteScoped();vi.restoreAllMocks();document.body.replaceChildren();});
const button=(root:ParentNode,text:string)=>{const b=[...root.querySelectorAll<HTMLButtonElement>('button')].find(x=>x.textContent===text);expect(b,text).toBeDefined();return b!;};
// Deliberate component callback doubles: no solver/worker/real execution is invoked.
const plan:AssistantPlan={path:[{row:0,col:0},{row:0,col:1}],score:1,examined:1,timedOut:false,forecast:{combo:1,damage:1,heal:0,incomingDamage:0,poisonDamage:0,hpAfter:1,enemyHp:[1],colors:['fire'],goalAchieved:true,constraintsMet:true,warnings:[],groups:[],ringBroken:[],absorbedDamage:0}};
function setup(){
 const host=document.createElement('div');document.body.append(host);setOverlayHost(host);const stage=gameData.stages.find(s=>s.id==='st-1-1')!;
 const state=startBattle(stage,[{cardId:'c101',level:1}],null,createRng(81),gameData).getState();
 const callbacks={onSaveRequest:vi.fn(),requestPlan:vi.fn(async()=>plan),execute:vi.fn(async()=>true),preview:vi.fn(),cancelPlan:vi.fn(),onClose:vi.fn()};
 const handle=openOrbAssistant({state,stage,...callbacks});const dialog=host.querySelector<HTMLElement>('[role="dialog"]')!;return{host,handle,dialog,callbacks};
}
for(const end of ['close','route'] as const)it(`closed ${end} dialog denies all retained action callbacks including plan synchronous preference write`,async()=>{
 const a=setup();button(a.dialog,'規劃路線').click();await vi.waitFor(()=>expect(button(a.dialog,'照路線轉珠（本回合）').hidden).toBe(false));
 if(end==='close')button(a.dialog,'收起').click();else closeRouteScoped();
 expect(a.callbacks.cancelPlan).toHaveBeenCalled();expect(a.callbacks.preview).toHaveBeenLastCalledWith(null);expect(a.callbacks.onClose).toHaveBeenCalledTimes(1);
 Object.values(a.callbacks).forEach(fn=>fn.mockClear());
 for(const label of ['儲存設定並收起','規劃路線','取消規劃','照路線轉珠（本回合）','顯示路線並收起','收起'])button(a.dialog,label).click();
 await Promise.resolve();for(const [name,fn] of Object.entries(a.callbacks))expect.soft(fn,name).not.toHaveBeenCalled();
});
for(const label of ['照路線轉珠（本回合）','顯示路線並收起'] as const)it(`valid accepted ${label} closes first but still invokes accepted callback exactly once`,async()=>{
 const a=setup();button(a.dialog,'規劃路線').click();await vi.waitFor(()=>expect(button(a.dialog,label).hidden).toBe(false));expect(a.callbacks.onSaveRequest).toHaveBeenCalledTimes(1);expect(a.callbacks.requestPlan).toHaveBeenCalledTimes(1);
 a.callbacks.preview.mockClear();button(a.dialog,label).click();expect(a.callbacks.onClose).toHaveBeenCalledTimes(1);const fn=label.startsWith('照')?a.callbacks.execute:a.callbacks.preview;
 expect(fn).toHaveBeenLastCalledWith(plan);expect(a.callbacks.onClose.mock.invocationCallOrder[0]).toBeLessThan(fn.mock.invocationCallOrder.at(-1)!);
 const calls=fn.mock.calls.length;button(a.dialog,label).click();expect(fn.mock.calls).toHaveLength(calls);
});
it('valid cancel planning remains usable for retry, while a closed change event cannot call cancel/preview',async()=>{
 const a=setup();button(a.dialog,'規劃路線').click();await Promise.resolve();button(a.dialog,'取消規劃').click();button(a.dialog,'規劃路線').click();await Promise.resolve();expect(a.callbacks.requestPlan).toHaveBeenCalledTimes(2);a.handle.close();a.callbacks.cancelPlan.mockClear();a.callbacks.preview.mockClear();
 const goal=a.dialog.querySelector<HTMLSelectElement>('[aria-label="轉珠模式"]')!;goal.value='heal';goal.dispatchEvent(new Event('change',{bubbles:true}));expect(a.callbacks.cancelPlan).not.toHaveBeenCalled();expect(a.callbacks.preview).not.toHaveBeenCalled();
});
