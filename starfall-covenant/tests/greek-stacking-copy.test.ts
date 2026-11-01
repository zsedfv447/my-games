// @vitest-environment happy-dom
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { afterEach, expect, it, vi } from 'vitest';
import { gameData } from '../src/data/load';
import { createNewSave } from '../src/save/save';
import { commit, getSave } from '../src/ui/state';
import { collectionCardScreen } from '../src/ui/screens/collection';
import { helperScreen } from '../src/ui/screens/helper';
const old = '相同連動不疊加', replacement = '隊長與助戰的連動產量相加';
const cases = [['l806','c806','水'],['l807','c807','火'],['l808','c808','木'],['l809','c809','光'],['l810','c810','暗']] as const;
const description = (color: string, text: string) => `${color}屬性成員攻擊力 2.5 倍；每段消除每 3 顆${color}珠，該段補珠產生 1 顆${color}強化珠（以可補空格為上限；${text}）。`;
afterEach(() => { vi.restoreAllMocks(); document.body.replaceChildren(); });
it('exact five description substitutions reconstruct original entire file bytes, including all rules and formatting', () => {
  const raw = readFileSync('data/leader-skills.json', 'utf8');
  expect(raw.split(replacement).length - 1).toBe(5); expect(raw).not.toContain(old);
  for (const [id, , color] of cases) expect(gameData.leaderSkills.find(l => l.id === id)!.description).toBe(description(color, replacement));
  const restored = raw.replaceAll(replacement, old);
  expect(createHash('sha256').update(restored).digest('hex')).toBe('17d8e5d08454a3280d876116ce43e871487afdb7e7c347033b5f412cdf21a9eb');
});
it.each(cases)('%s corrected full description reaches unowned card detail and actual helper search without grants or read writes', async (id, cardId, color) => {
  const save = createNewSave(gameData.config, Date.now());
  // Explicit already-seen isolated fixture: helper browsing normally records seen.
  // No owned cards/rewards are added to neutralize that legitimate discovery effect.
  save.collection.seen = gameData.cards.map(c => c.id); save.collection.owned = []; save.collection.claimed = []; save.inventory.cards = [];
  commit(save); const before = JSON.stringify(getSave()), disk = JSON.stringify(localStorage);
  const writes = vi.spyOn(Storage.prototype, 'setItem');
  const nav = { go: vi.fn(), replace: vi.fn(), back: vi.fn(), backTo: vi.fn() }; const leave: (() => void)[] = [];
  const detail = collectionCardScreen.render({ nav, route: { name: 'collection-card', args: [cardId], query: {} }, onLeave: fn => leave.push(fn) });
  document.body.append(detail); expect(detail.textContent).toContain(description(color, replacement));
  leave.splice(0).forEach(fn => fn());
  const helper = helperScreen.render({ nav, route: { name: 'helper', args: ['st-1-1'], query: {} }, onLeave: fn => leave.push(fn) });
  document.body.replaceChildren(helper);
  const input = helper.querySelector<HTMLInputElement>('[aria-label="搜尋常駐助戰名稱或卡號"]')!; input.value = cardId; input.dispatchEvent(new Event('input', { bubbles: true }));
  await Promise.resolve();
  const row = helper.querySelector(`[data-support-id="support:${cardId}"]`)!; expect(row).not.toBeNull();
  expect(row.textContent).toContain(description(color, replacement)); expect(row.textContent).not.toContain(old);
  expect(gameData.cards.find(c => c.id === cardId)!.leaderSkill).toBe(id);
  expect(JSON.stringify(getSave())).toBe(before); expect(JSON.stringify(localStorage)).toBe(disk); expect(writes).not.toHaveBeenCalled();
  expect(nav.go).not.toHaveBeenCalled(); expect(nav.replace).not.toHaveBeenCalled(); leave.forEach(fn => fn());
});
