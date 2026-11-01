// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
let cleanup: (() => void) | undefined;
afterEach(() => { cleanup?.(); cleanup = undefined; document.body.replaceChildren(); });
async function show(ids: string[]) {
  vi.resetModules();
  const [{ gameData }, { createNewSave }, state, { teamScreen }, { installTutorial }] = await Promise.all([
    import('../src/data/load'), import('../src/save/save'), import('../src/ui/state'), import('../src/ui/screens/team'), import('../src/ui/tutorial/controller'),
  ]);
  const save = createNewSave(gameData.config, 1);
  save.tutorial = { step: 'team', giftGiven: false };
  save.inventory.cards = ids.map((cardId,i) => ({ uid: `fit-${i}`,cardId,level:1,exp:0,skillLevel:1,limitBreak:0,awakened:0,locked:false,obtainedAt:1 }));
  save.teams[0].members = [...save.inventory.cards.map(c=>c.uid), ...Array(5-ids.length).fill(null)]; state.commit(save);
  const before = JSON.stringify(state.getSave());
  const nav = { go:vi.fn(),replace:vi.fn(),back:vi.fn(),backTo:vi.fn() };
  const route = { name:'team',args:[],query:{} };
  const root = teamScreen.render({route,nav,onLeave() {}}), stage = document.createElement('div'); stage.append(root); document.body.append(stage);
  const controller = installTutorial(stage,nav); controller.onRoute(teamScreen,root,route);
  cleanup = () => controller.onRoute(teamScreen,root,{name:'settings',args:[],query:{}});
  const bubble = stage.querySelector<HTMLElement>('.tut-bubble')!, lines: string[] = [];
  for (let i=0;i<10;i++) { lines.push(bubble.querySelector('.tut-text')!.textContent!); if (!bubble.classList.contains('has-more')) break; bubble.click(); }
  expect(JSON.stringify(state.getSave())).toBe(before); // includes tutorial/gift/claimed/resources
  expect(nav.go).not.toHaveBeenCalled();
  return { text:lines.join('\n'), root };
}
it('installed team tutorial agrees with neutral c811+c710 tag-only result; reading does not grant or advance', async () => {
  const {text,root} = await show(['c811','c710']);
  expect(root.querySelectorAll('.team-slots .misfit')).toHaveLength(0);
  expect(text).not.toContain('紅框'); expect(text).not.toContain('換掉');
  expect(text).toContain('流派標籤僅供編隊參考');
  expect(text).not.toContain('每位隊員都吃得到'); expect(text).not.toContain('打得贏');
});
it('installed team tutorial keeps real non-beast filter warning without guaranteeing victory or forcing swaps', async () => {
  const {text,root} = await show(['c811','c103']);
  expect(root.querySelectorAll('.team-slots .misfit')).toHaveLength(1);
  expect(text).toContain('紅框'); expect(text).toContain('篩選條件');
  expect(text).not.toContain('打得贏'); expect(text).not.toContain('換掉吧');
});
it('conditional c710 leader without filter mismatch does not promise unconditional bonuses', async () => {
  const {text} = await show(['c710']);
  expect(text).not.toContain('每位隊員都吃得到');
  expect(text).toContain('實際加成仍以隊長技條件為準');
});
