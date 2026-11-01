// @vitest-environment happy-dom
import {afterEach,expect,it,vi} from 'vitest';
import {startBattle} from '../src/battle/battle-state';
import {gameData} from '../src/data/load';
import {createRng} from '../src/core/rng';
import type {AssistantPlan,AssistantRequest} from '../src/battle/assistant/types';
import {normalizeAssistantRequest,loadAssistantRequest,saveAssistantRequest} from '../src/battle/assistant/preferences';
import {openOrbAssistant} from '../src/ui/components/orb-assistant';
import {setOverlayHost} from '../src/ui/components/overlay';
import {closeRouteScoped} from '../src/ui/route-scope';
afterEach(()=>{closeRouteScoped();vi.restoreAllMocks();document.body.replaceChildren();localStorage.clear();});
const labels=['同配額優先留珠','已知落珠疊珠／缺口分析'];
const button=(root:ParentNode,text:string)=>{const b=[...root.querySelectorAll<HTMLButtonElement>('button')].find(x=>x.textContent===text);expect(b).toBeDefined();return b!;};
const plan:AssistantPlan={path:[{row:0,col:0},{row:0,col:1}],score:1,examined:1,timedOut:false,forecast:{combo:1,damage:123,heal:0,incomingDamage:0,poisonDamage:0,hpAfter:100,enemyHp:[1],colors:['fire'],goalAchieved:true,constraintsMet:true,warnings:[],groups:[],ringBroken:[],absorbedDamage:0,greekAnalysis:{quotaByColor:{fire:2},retainedByColor:{fire:2},knownCascadeGroups:1,conditionalHooks:2}}};
function setup(available=true,initialRequest?:AssistantRequest){const host=document.createElement('div');document.body.append(host);setOverlayHost(host);const stage=gameData.stages.find(s=>s.id==='st-1-1')!;const state=startBattle(stage,[{cardId:'c807',level:50}],{cardId:'c807',level:50},createRng(817),gameData).getState();const callbacks={onSaveRequest:vi.fn((_request:AssistantRequest)=>{}),requestPlan:vi.fn(async(_request:AssistantRequest)=>plan),execute:vi.fn(async()=>true),preview:vi.fn(),cancelPlan:vi.fn(),onClose:vi.fn()};const handle=openOrbAssistant({state,stage,greekAvailable:available,initialRequest,...callbacks});return{handle,callbacks,dialog:host.querySelector<HTMLElement>('[role=dialog]')!};}
const check=(root:ParentNode,index:number)=>{const input=root.querySelector<HTMLInputElement>(`[aria-label="${labels[index]}"]`);expect(input).not.toBeNull();return input!;};
it('normalizes only boolean opt-ins, preserves legacy fields, and uses existing formal preference key',()=>{
 expect(normalizeAssistantRequest({goal:'auto'})).toEqual({goal:'auto'});
 expect(normalizeAssistantRequest({goal:'greek',color:'fire',constraints:{minCombo:4},greek:{reserve:true,setup:false,junk:'secret'}})).toEqual({goal:'greek',color:'fire',constraints:{minCombo:4},greek:{reserve:true,setup:false}});
 expect(normalizeAssistantRequest({goal:'auto',greek:{reserve:'true',setup:1}})).toEqual({goal:'auto'});
 localStorage.setItem('starfall.experiment.e00-e01.starfall-covenant.orb-assistant.request.v1','private-sentinel');
 const set=vi.spyOn(localStorage,'setItem');saveAssistantRequest({goal:'auto',greek:{reserve:true,setup:true}});
 expect(loadAssistantRequest().greek).toEqual({reserve:true,setup:true});expect(set.mock.calls.map(c=>c[0])).toEqual(['starfall-covenant.orb-assistant.request.v1']);
 expect(localStorage.getItem('starfall.experiment.e00-e01.starfall-covenant.orb-assistant.request.v1')).toBe('private-sentinel');
});
it('options default off, only effective auto/greek exposes them, remembered choices restore',()=>{
 const a=setup();expect(check(a.dialog,0).checked).toBe(false);expect(check(a.dialog,1).checked).toBe(false);
 const goal=a.dialog.querySelector<HTMLSelectElement>('[aria-label="轉珠模式"]')!;goal.value='damage';goal.dispatchEvent(new Event('change',{bubbles:true}));expect(check(a.dialog,0).closest<HTMLElement>('[data-greek-options]')!.hidden).toBe(true);
 goal.value='greek';goal.dispatchEvent(new Event('change',{bubbles:true}));expect(check(a.dialog,0).closest<HTMLElement>('[data-greek-options]')!.hidden).toBe(false);a.handle.close();
 const b=setup(false,{goal:'greek',greek:{reserve:true,setup:true}});expect(check(b.dialog,0).closest<HTMLElement>('[data-greek-options]')!.hidden).toBe(true);b.handle.close();
 const c=setup(true,{goal:'greek',greek:{reserve:true,setup:true}});expect(check(c.dialog,0).checked).toBe(true);expect(check(c.dialog,1).checked).toBe(true);
});
it('each checkbox invalidates pending/completed plans immediately and closed callbacks remain inert',async()=>{
 const a=setup();let finish!:(p:AssistantPlan)=>void;a.callbacks.requestPlan.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
 button(a.dialog,'規劃路線').click();check(a.dialog,0).checked=true;check(a.dialog,0).dispatchEvent(new Event('change',{bubbles:true}));
 expect(a.callbacks.cancelPlan).toHaveBeenCalled();expect(a.callbacks.preview).toHaveBeenLastCalledWith(null);finish(plan);await Promise.resolve();expect(button(a.dialog,'照路線轉珠（本回合）').hidden).toBe(true);
 button(a.dialog,'規劃路線').click();await vi.waitFor(()=>expect(button(a.dialog,'照路線轉珠（本回合）').hidden).toBe(false));
 expect(a.callbacks.requestPlan.mock.calls.at(-1)?.[0].greek).toEqual({reserve:true,setup:false});
 expect(a.dialog.textContent).toContain('首消預估');expect(a.dialog.textContent).toContain('123');
 const analysis=a.dialog.querySelector('[data-greek-analysis]');expect(analysis).not.toBeNull();expect(analysis!.textContent).toContain('首消理論配額：火 2；保留珠：火 2');expect(analysis!.textContent).toContain('未知補珠');expect(analysis!.textContent).not.toContain('可成組：');
 check(a.dialog,1).checked=true;check(a.dialog,1).dispatchEvent(new Event('change',{bubbles:true}));button(a.dialog,'照路線轉珠（本回合）').click();expect(a.callbacks.execute).not.toHaveBeenCalled();
 button(a.dialog,'規劃路線').click();await vi.waitFor(()=>expect(button(a.dialog,'照路線轉珠（本回合）').hidden).toBe(false));expect(a.dialog.querySelector('[data-greek-analysis]')!.textContent).toContain('可成組：1；需未知補珠配合的缺口：2');
 button(a.dialog,'儲存設定並收起').click();expect(a.callbacks.onSaveRequest.mock.calls.at(-1)?.[0].greek).toEqual({reserve:true,setup:true});
 Object.values(a.callbacks).forEach(f=>f.mockClear());check(a.dialog,0).dispatchEvent(new Event('change',{bubbles:true}));button(a.dialog,'規劃路線').click();for(const fn of Object.values(a.callbacks))expect(fn).not.toHaveBeenCalled();
});
