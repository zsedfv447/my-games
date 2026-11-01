// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { Router } from '../src/ui/router';
let router: Router | undefined;
let root: HTMLElement;
let backing: Storage;
const writes: string[] = [];
beforeEach(() => {
  vi.resetModules();
  backing = localStorage;
  backing.clear(); writes.length = 0;
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => backing.getItem(key),
    setItem: vi.fn((key: string, value: string) => { writes.push(`set:${key}`); backing.setItem(key, value); }),
    removeItem: vi.fn((key: string) => { writes.push(`remove:${key}`); backing.removeItem(key); }),
  });
  const session = sessionStorage;
  session.clear();
  vi.stubGlobal('sessionStorage', {
    getItem: (key: string) => session.getItem(key),
    setItem: vi.fn((key: string, value: string) => { writes.push(`session-set:${key}`); session.setItem(key, value); }),
    removeItem: vi.fn((key: string) => { writes.push(`session-remove:${key}`); session.removeItem(key); }),
  });
  history.replaceState(null, '', '#/collection');
});
afterEach(() => { router?.stop(); router = undefined; vi.unstubAllGlobals(); vi.restoreAllMocks(); document.body.replaceChildren(); });
async function boot(historical = false) {
  const state = await import('../src/ui/state');
  const { createNewSave } = await import('../src/save/save');
  const { gameData } = await import('../src/data/load');
  const save = createNewSave(gameData.config, Date.now());
  save.inventory.cards = [];
  save.collection = { seen: historical ? ['c710'] : [], owned: historical ? ['c710'] : [], claimed: [] };
  state.commit(save);
  await mount(); writes.length = 0;
  return state;
}
async function mount() {
  const { Router } = await import('../src/ui/router');
  const { collectionScreen, collectionCardScreen } = await import('../src/ui/screens/collection');
  const { archetypesScreen } = await import('../src/ui/screens/archetypes');
  router = new Router((screen, el) => { root = el; el.dataset.testScreen = screen.name; document.body.replaceChildren(el); el.scrollTop = 0; }).register(collectionScreen, collectionCardScreen, archetypesScreen);
  router.start();
}
function select(label: string) {
  const control = root.querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`);
  expect(control, `missing ${label}`).not.toBeNull(); return control!;
}
function choose(label: string, value: string) {
  const control = select(label); control.value = value; control.dispatchEvent(new Event('change', { bubbles: true })); return control;
}
const results = () => [...root.querySelectorAll('.codex-grid .codex-no')].map(n => n.textContent);
function button(text: string) {
  const control = [...root.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent === text);
  expect(control, `missing button ${text}`).toBeDefined(); return control!;
}
const bytes = () => Array.from({ length: backing.length }, (_, i) => backing.key(i)!).sort().map(k => [k, backing.getItem(k)]);
function conversion() {
  const details = root.querySelector<HTMLDetailsElement>('details[data-conversion-filter]');
  expect(details).not.toBeNull(); return details!;
}

it('real Router c710 detail→Back and codex replace tabs retain conversion, existing filters, results and scroll without writes', async () => {
  const state = await boot();
  const before = JSON.stringify(state.getSave()), stored = bytes();
  expect(results()).toHaveLength(112);
  const details = conversion(); expect(details.open).toBe(false);
  details.open = true; details.dispatchEvent(new Event('toggle'));
  choose('屬性', 'light'); choose('種族', 'beast');
  choose('轉換來源', 'wood'); const to = choose('轉換目標', 'light');
  to.focus(); const from = select('轉換來源');
  choose('流派', 'classicbeast'); expect(results()).toEqual([]);
  expect(select('轉換來源')).toBe(from); expect(select('轉換目標')).toBe(to); expect(document.activeElement).toBe(to);
  choose('流派', ''); expect(results()).toEqual(['No.710']);
  expect(root.querySelector('.codex-grid .card-thumb')?.classList.contains('codex-unseen')).toBe(true);
  expect(root.querySelector('.codex-grid .codex-claim')).toBeNull();
  root.scrollTop = 487;
  root.querySelector<HTMLButtonElement>('.codex-grid .card-thumb')!.click();
  await vi.waitFor(() => expect(root.dataset.testScreen).toBe('collection-card'));
  expect(location.hash).toBe('#/collection-card/c710');
  expect(root.textContent).toContain('森珠轉為輝珠');
  router!.back();
  await vi.waitFor(() => expect(root.dataset.testScreen).toBe('collection'));
  expect(root.scrollTop).toBe(487);
  expect(select('轉換來源').value).toBe('wood'); expect(select('轉換目標').value).toBe('light');
  expect(select('屬性').value).toBe('light'); expect(select('種族').value).toBe('beast');
  expect(conversion().open).toBe(true); expect(results()).toEqual(['No.710']);
  const replace = vi.spyOn(router!, 'replace'); // passthrough spy; real Router/history still execute
  button('流派').click(); expect(root.dataset.testScreen).toBe('archetypes');
  button('卡片').click(); expect(root.dataset.testScreen).toBe('collection');
  expect(replace.mock.calls.map(call => call[0])).toEqual(['archetypes', 'collection']);
  expect(select('轉換來源').value).toBe('wood'); expect(select('轉換目標').value).toBe('light');
  expect(conversion().open).toBe(true); expect(results()).toEqual(['No.710']); expect(root.scrollTop).toBe(487);
  conversion().open = false; conversion().dispatchEvent(new Event('toggle'));
  expect(conversion().querySelector('summary')?.textContent).toContain('指定轉珠：森 → 輝');
  expect(JSON.stringify(state.getSave())).toBe(before); expect(bytes()).toEqual(stored); expect(writes).toEqual([]);
});

it('clear conversion preserves legacy filters/status; historical owned is not current holdings or a browsing reward', async () => {
  const state = await boot(true); const before = JSON.stringify(state.getSave()), stored = bytes();
  choose('屬性', 'light'); choose('種族', 'beast'); button('曾取得').click();
  choose('轉換來源', 'wood'); choose('轉換目標', 'light');
  expect(results()).toEqual(['No.710']); expect(state.getSave().inventory.cards).toEqual([]);
  expect(root.querySelector('.codex-grid .card-thumb')?.classList.contains('codex-owned')).toBe(true);
  const claimText = root.querySelector('.codex-grid .codex-claim')?.textContent;
  expect(claimText).toBeTruthy();
  choose('流派', 'classicbeast'); expect(results()).toEqual([]);
  const from = select('轉換來源'), to = select('轉換目標');
  button('清除轉珠條件').click();
  expect(select('轉換來源')).toBe(from); expect(select('轉換目標')).toBe(to);
  expect(from.value).toBe(''); expect(to.value).toBe('');
  expect(select('屬性').value).toBe('light'); expect(select('種族').value).toBe('beast'); expect(select('流派').value).toBe('classicbeast');
  expect(results()).toEqual([]);
  choose('流派', ''); expect(results()).toEqual(['No.710']);
  expect(root.querySelector('.codex-grid .codex-claim')?.textContent).toBe(claimText);
  button('未見過').click(); expect(results()).not.toContain('No.710');
  expect(JSON.stringify(state.getSave())).toBe(before); expect(bytes()).toEqual(stored); expect(writes).toEqual([]);
});

it('fresh module load resets conversion query and disclosure instead of persisting either', async () => {
  await boot(); choose('轉換來源', 'wood'); choose('轉換目標', 'light');
  conversion().open = true; conversion().dispatchEvent(new Event('toggle'));
  expect(results()).toEqual(['No.710']);
  const stored = bytes(); expect(writes).toEqual([]);
  router!.stop(); vi.resetModules();
  await mount();
  expect(select('轉換來源').value).toBe(''); expect(select('轉換目標').value).toBe('');
  expect(conversion().open).toBe(false); expect(results()).toHaveLength(112);
  // Fresh state import performs only the existing experiment probe write/remove, no prefs or save write.
  expect(writes.every(key => key.endsWith('__starfall_probe__'))).toBe(true);
  expect(bytes()).toEqual(stored);
});
