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
  ...await importOriginal<typeof import('../src/ui/battle-session')>(), openStageBattle: () => bridge.opened,
}));
let leave: (() => void) | undefined;
afterEach(() => { leave?.(); vi.restoreAllMocks(); document.body.replaceChildren(); });
it.each(['c103','c110','c205','c305','c410'])('%s actual BattleView skill confirmation shows full centralized text and cancel changes nothing', async cardId => {
  // Drawing stub only: real BattleView, dialog, skill definitions and battle state.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(new Proxy({}, { get: (_t,key) => key === 'createLinearGradient' || key === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => {} }) as CanvasRenderingContext2D);
  commit(createNewSave(gameData.config, 1));
  const stage = gameData.stages[0], original = startBattle(stage,[{cardId,level:1}],null,createRng(123),gameData);
  const snapshot = original.snapshot(); snapshot.state.team[0].skillCooldown = 0;
  const battle = resumeBattle(stage,snapshot,gameData);
  // Official BattleView requires the same legitimate persisted ticket as a resumed production journey.
  commit(recordBattleSnapshot(beginActiveBattle(getSave(), { stageId: stage.id, seed: 123, members: [{ cardId, level: 1 }], helper: null, drops: { stageId: stage.id, drops: [] } }, 1), snapshot));
  bridge.opened = { battle,memberUids:[],dropSeed:dropSeed({seed:123}),drops:{stageId:stage.id,drops:[]},resumed:true,oaths:[] };
  const nav = { go:vi.fn(),replace:vi.fn(),back:vi.fn(),backTo:vi.fn() };
  const root = battleScreen.render({route:{name:'battle',args:[stage.id],query:{}},nav,onLeave:fn=>{leave=fn;}}); document.body.append(root);
  const beforeSave = JSON.stringify(getSave()), beforeBattle = JSON.stringify(battle.snapshot());
  root.querySelector<HTMLButtonElement>('.team-row .card-thumb')!.click();
  const def = gameData.cards.find(c=>c.id===cardId)!, skill = gameData.skills.find(s=>s.id===def.activeSkill)!;
  expect(skill.description).not.toContain('同上');
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain(skill.description);
  [...document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')].find(b=>b.textContent==='取消')!.click();
  await new Promise(resolve=>setTimeout(resolve,160));
  expect(JSON.stringify(getSave())).toBe(beforeSave); expect(JSON.stringify(battle.snapshot())).toBe(beforeBattle);
});
