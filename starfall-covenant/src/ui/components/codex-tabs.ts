import { h } from '../dom';
import type { Navigator } from '../router';
const sections = [
  { id: 'cards', label: '卡片', route: 'collection' },
  { id: 'archetypes', label: '流派', route: 'archetypes' },
  { id: 'enemies', label: '敵人', route: 'bestiary' },
] as const;
export function codexSwitch(active: typeof sections[number]['id'], nav: Navigator): HTMLElement {
  return h('div', { class: 'tabs', role: 'tablist', 'aria-label': '圖鑑與流派' }, sections.map(s => h('button', {
    type: 'button', class: ['tab', s.id === active && 'active'], role: 'tab', 'aria-selected': String(s.id === active),
    'data-codex-tab': s.id, onClick: () => { if (s.id !== active) nav.replace(s.route); },
  }, s.label)));
}
