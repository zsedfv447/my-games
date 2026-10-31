import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BattleState } from '../src/battle/runtime';
import type { AssistantRequest } from '../src/battle/assistant/types';

let storage: Map<string, string>;
beforeEach(() => {
  vi.resetModules();
  storage = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  });
});
afterEach(() => vi.unstubAllGlobals());
const module = () => import('../src/battle/assistant/preferences');

describe('助手上次設定記憶', () => {
  it('重新載入模組後仍能讀回設定，且只用獨立key存偏好', async () => {
    const first = await module();
    const preference: AssistantRequest = { goal: 'color', color: 'heart', targetEnemy: 2, starIndex: 1, constraints: { minCombo: 4, minColorOrbs: { color: 'heart', count: 6 }, requiredColors: ['heart', 'fire'], avoidAbsorb: true } };
    first.saveAssistantRequest({ ...preference, board: 'private', path: [1], enemyId: 'private' } as AssistantRequest);
    expect(storage.size).toBe(1);
    expect([...storage.values()][0]).not.toMatch(/private|board|path|enemyId/);
    vi.resetModules();
    const second = await module();
    expect(second.loadAssistantRequest()).toEqual(preference);
  });
  it('localStorage拒絕讀寫時仍保留本次工作階段設定並deep clone', async () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } });
    const api = await module();
    const request: AssistantRequest = { goal: 'rainbow', constraints: { requiredColors: ['fire'], minColorOrbs: { color: 'fire', count: 3 } } };
    api.saveAssistantRequest(request);
    request.constraints!.requiredColors!.push('water');
    const loaded = api.loadAssistantRequest();
    loaded.constraints!.minColorOrbs!.count = 30;
    expect(api.loadAssistantRequest()).toEqual({ goal: 'rainbow', constraints: { requiredColors: ['fire'], minColorOrbs: { color: 'fire', count: 3 } } });
  });
  it('只有寫入遭拒時也不會讓舊儲存值蓋過新偏好', async () => {
    const api=await module();api.saveAssistantRequest({goal:'damage'});
    vi.stubGlobal('localStorage',{getItem:(key:string)=>storage.get(key)??null,setItem:()=>{throw new Error('quota');}});
    api.saveAssistantRequest({goal:'heal'});expect(api.loadAssistantRequest()).toEqual({goal:'heal'});
  });
  it('嚴格檢查目標、珠色、整數與每個條件，剔除未知資料', async () => {
    const { normalizeAssistantRequest: normalize } = await module();
    for (const raw of [null, [], {}, {goal:'puzzle'}, {goal:'unknown'}, 'auto']) expect(normalize(raw)).toEqual({ goal: 'auto' });
    expect(normalize({ goal: 'damage', color: 'blue', targetEnemy: -1, starIndex: 1.5, constraints: {
      minCombo: 0, exactCombo: 31, minGroup: 3.1, minHeartGroups: '2', minEnhanced: Infinity, minRingBreaks: NaN,
      enhanced: 'true', avoidAbsorb: true, requiredColors: ['fire', 'unknown'], avoidColors: ['heart', 'heart'],
      clearColors: ['wood'], groupColor: 'dark', minColorOrbs: { color: 'fire', count: 3 }, unknown: 2,
    }})).toEqual({ goal: 'damage', constraints: { avoidAbsorb: true, avoidColors: ['heart'], clearColors: ['wood'], groupColor: 'dark', minColorOrbs: { color: 'fire', count: 3 } } });
    expect(normalize({goal:'auto', constraints:{ minCombo:1,exactCombo:30,minGroup:30,minHeartGroups:1,minEnhanced:30,minRingBreaks:1,enhanced:false,minColorOrbs:{color:'heart',count:31} }})).toEqual({goal:'auto',constraints:{minCombo:1,exactCombo:30,minGroup:30,minHeartGroups:1,minEnhanced:30,minRingBreaks:1,enhanced:false}});
  });
  it('壞JSON與未知goal回到auto', async () => {
    const api = await module();api.saveAssistantRequest({goal:'heal'});
    const key = [...storage.keys()][0];storage.set(key,'{broken');expect(api.loadAssistantRequest()).toEqual({goal:'auto'});
    storage.set(key,JSON.stringify({goal:'puzzle'}));expect(api.loadAssistantRequest()).toEqual({goal:'auto'});
  });
  it('新戰鬥將失效敵人索引改目前活目標，無活敵移除索引；不更換星章目標', async () => {
    const {resolveAssistantRequest:resolve}=await module();
    const state={target:2,enemies:[{hp:0},{hp:20},{hp:30}]} as BattleState;
    const original:AssistantRequest={goal:'target',targetEnemy:0};
    expect(resolve(original,state)).toEqual({goal:'target',targetEnemy:2});expect(original.targetEnemy).toBe(0);
    expect(resolve({goal:'target',targetEnemy:1},state)).toEqual({goal:'target',targetEnemy:1});
    state.target=0;expect(resolve(original,state)).toEqual({goal:'target',targetEnemy:1});
    state.enemies.forEach(e=>e.hp=0);expect(resolve(original,state)).toEqual({goal:'target'});
    expect(resolve({goal:'star',starIndex:2},state,{stars:[{type:'noContinue'}]})).toEqual({goal:'star'});
    expect(resolve({goal:'star',starIndex:0},state)).toEqual({goal:'star'});
    expect(resolve({goal:'star',starIndex:0},state,{stars:[{type:'noContinue'}]})).toEqual({goal:'star',starIndex:0});
  });
});
