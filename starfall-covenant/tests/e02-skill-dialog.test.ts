// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { gameData } from '../src/data/load';
import { startBattle, resumeBattle } from '../src/battle/battle-state';
import { createRng } from '../src/core/rng';
import { commit, getSave } from '../src/ui/state';
import { createNewSave } from '../src/save/save';
import { beginActiveBattle, recordBattleSnapshot, dropSeed } from '../src/progression/active-battle';
import { battleScreen } from '../src/ui/screens/battle';
const bridge = vi.hoisted(() => ({ opened: undefined as unknown }));
vi.mock('../src/ui/battle-session', async importOriginal => ({
  ...await importOriginal<typeof import('../src/ui/battle-session')>(),
  openStageBattle: () => bridge.opened,
}));
let leave: (() => void) | undefined;
afterEach(() => { leave?.(); vi.restoreAllMocks(); document.body.replaceChildren(); });
it('real battle skill dialog cancels read-only and reopening after real cast has no stale exact counts', async () => {
  // Happy DOM has no Canvas rendering; stub drawing only, keep real BattleView/dialog/engine.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(new Proxy({}, { get: (_t, key) => key === 'createLinearGradient' || key === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => {} }) as CanvasRenderingContext2D);
  commit(createNewSave(gameData.config, 1));
  const stage=gameData.stages[0];
  const original=startBattle(stage,[{cardId:'c710',level:1}],null,createRng(123),gameData);
  const snap=original.snapshot(); snap.state.team[0].skillCooldown=0;
  // Only the test fixture resumes a manufactured ready battle, never preview code.
  const battle=resumeBattle(stage,snap,gameData);
  // Official screen fixtures also need the real matching admission ticket; never bypass session guards.
  const ticket=beginActiveBattle(getSave(),{stageId:stage.id,seed:123,members:[{cardId:'c710',level:1}],helper:null,drops:{stageId:stage.id,drops:[]}},1);
  commit(recordBattleSnapshot(ticket,battle.snapshot()));
  bridge.opened={battle,memberUids:[],dropSeed:dropSeed({seed:123}),drops:{stageId:stage.id,drops:[]},resumed:true,oaths:[]};
  const nav={go:vi.fn(),replace:vi.fn(),back:vi.fn(),backTo:vi.fn()};
  const render=()=>{ const root=battleScreen.render({route:{name:'battle',args:[stage.id],query:{}},nav,onLeave:fn=>{leave=fn;}}); document.body.append(root); return root; };
  let root=render(); const saveBefore=JSON.stringify(getSave()), snapBefore=JSON.stringify(battle.snapshot());
  root.querySelector<HTMLButtonElement>('.team-row .card-thumb')!.click();
  expect(document.querySelector('[data-conversion-preview]')).not.toBeNull();
  [...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')].find(b=>b.textContent==='取消')!.click();
  await new Promise(r=>setTimeout(r,160));
  expect(JSON.stringify(getSave())).toBe(saveBefore); expect(JSON.stringify(battle.snapshot())).toBe(snapBefore);
  const result=battle.useSkill(0); expect(result.ok).toBe(true);
  leave?.(); document.body.replaceChildren(); root=render();
  root.querySelector<HTMLButtonElement>('.team-row .card-thumb')!.click();
  expect(document.querySelector('[data-conversion-preview]')).toBeNull();
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain('冷卻中');
});
