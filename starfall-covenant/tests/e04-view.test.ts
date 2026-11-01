// @vitest-environment happy-dom
import { beforeEach, expect, it, vi } from 'vitest';
import { collectionScreen } from '../src/ui/screens/collection';
import { gameData } from '../src/data/load';
import { createNewSave } from '../src/save/save';
import { commit, getSave } from '../src/ui/state';
const nav = { go: vi.fn(), replace: vi.fn(), back: vi.fn(), backTo: vi.fn() };
function render() {
  const el = collectionScreen.render({ route: { name: 'collection', args: [], query: {} }, nav, onLeave() {} });
  document.body.replaceChildren(el); return el;
}
function set(root: ParentNode, label: string, value: string) {
  const el = root.querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`)!;
  expect(el).not.toBeNull(); el.value = value; el.dispatchEvent(new Event('change')); return el;
}
function clear(root: ParentNode) { [...root.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent === '清除轉珠條件')?.click(); }
const ids = (root: ParentNode) => [...root.querySelectorAll('.codex-grid .codex-no')].map(e => e.textContent!.replace('No.', 'c'));
beforeEach(() => {
  commit(createNewSave(gameData.config, Date.now()));
  const root = render(); clear(root);
  for (const name of ['屬性', '種族', '流派']) set(root, name, '');
});
it('default collapsed accessible six-orb selects leave all112 original results unchanged when inactive', () => {
  const root = render(); const details = root.querySelector<HTMLDetailsElement>('[data-conversion-filter]');
  expect(details).not.toBeNull(); expect(details!.tagName).toBe('DETAILS'); expect(details!.open).toBe(false);
  expect(details!.querySelector('summary')!.textContent).toBe('指定轉珠');
  for (const name of ['轉換來源', '轉換目標']) {
    const select = root.querySelector<HTMLSelectElement>(`select[aria-label="${name}"]`)!;
    expect([...select.options].map(o => o.value)).toEqual(['', 'fire', 'water', 'wood', 'light', 'dark', 'heart']);
    expect(select.options[0].textContent).toBe('不限');
  }
  expect(ids(root)).toHaveLength(112);
  expect(root.textContent).toContain('技能包含指定轉換段，其他效果請查看技能。');
  expect(root.textContent).toContain('本身不算指定轉換段；技能包含其他效果仍可符合');
});
it('wood→light is ANDed with light/beast/archetype, keeps control focus mounted, and does not mutate save', () => {
  const root = render(), before = JSON.stringify(getSave());
  const source = set(root, '轉換來源', 'wood'); source.focus();
  set(root, '轉換目標', 'light'); set(root, '屬性', 'light'); set(root, '種族', 'beast');
  expect(ids(root)).toEqual(['c710']);
  expect(root.querySelector('select[aria-label="轉換來源"]')).toBe(source); expect(document.activeElement).toBe(source);
  expect(root.querySelector('[data-conversion-filter] summary')!.textContent).toBe('指定轉珠：森 → 輝');
  set(root, '流派', 'classicbeast'); expect(ids(root)).toEqual([]);
  expect(root.textContent).toContain('目前篩選條件沒有符合的指定轉珠卡；不含洗盤、整排轉珠、補珠或天降。');
  expect(JSON.stringify(getSave())).toBe(before);
  clear(root); expect(ids(root).length).toBeGreaterThan(0);
  for (const [label, value] of [['屬性','light'],['種族','beast'],['流派','classicbeast']]) expect(root.querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`)!.value).toBe(value);
});
it('partial active summary and precise zero-result scope do not claim final board or other supplies absent', () => {
  const root = render(); set(root, '轉換來源', 'heart');
  expect(root.querySelector('[data-conversion-filter] summary')!.textContent).toBe('指定轉珠：心 → 不限');
  set(root, '轉換目標', 'light'); expect(ids(root)).toEqual([]);
  expect(root.textContent).toContain('不含洗盤、整排轉珠、補珠或天降');
  clear(root); expect(root.querySelector('[data-conversion-filter] summary')!.textContent).toBe('指定轉珠');
  expect(ids(root)).toHaveLength(112);
});
it('new pair uses two responsive columns without changing existing three-filter layout', () => {
  const root = render();
  const pair = root.querySelector<HTMLElement>('[data-conversion-filter] .codex-filters')!;
  expect(pair.style.gridTemplateColumns).toBe('repeat(2, minmax(0, 1fr))');
  const original = [...root.querySelectorAll<HTMLElement>('.codex-filters')].find(el => !el.closest('[data-conversion-filter]'))!;
  expect(original.style.gridTemplateColumns).toBe('');
});
it('detached details cannot overwrite newer screen open state via delayed toggle', async () => {
  const { conversionFilter } = await import('../src/ui/components/conversion-filter');
  const toggled = vi.fn(); const details = conversionFilter({}, false, vi.fn(), toggled);
  document.body.append(details); details.remove();
  details.open = true; details.dispatchEvent(new Event('toggle'));
  expect(toggled).not.toHaveBeenCalled();
});
