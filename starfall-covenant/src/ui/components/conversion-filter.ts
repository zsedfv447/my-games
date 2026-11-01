import { ORB_TYPES, type OrbType } from '../../core/types';
import { ORB_NAMES } from '../art/palette';
import { conversionQueryActive, type ConversionQuery } from '../conversion-query';
import { h } from '../dom';
import { button } from './basic';

/** Keeps the native controls mounted while the caller redraws only card results. */
export function conversionFilter(initial: ConversionQuery, open: boolean, onChange: (query: ConversionQuery) => void, onToggle: (open: boolean) => void): HTMLDetailsElement {
  let query = { ...initial };
  const summary = h('summary', { style: { cursor: 'pointer', padding: '8px 0' } });
  const controls = (key: 'from' | 'to', label: string) => {
    const select = h('select', { class: 'codex-select', 'aria-label': label },
      h('option', { value: '' }, '不限'),
      ORB_TYPES.map(type => h('option', { value: type }, ORB_NAMES[type])));
    select.value = query[key] ?? '';
    select.addEventListener('change', () => {
      query = { ...query, [key]: (select.value || undefined) as OrbType | undefined };
      update(); onChange({ ...query });
    });
    return { select, node: h('label', { class: 'small-text', style: { display: 'grid', gap: '4px', minWidth: '0' } }, label, select) };
  };
  const from = controls('from', '轉換來源'), to = controls('to', '轉換目標');
  const clear = button('清除轉珠條件', { small: true, variant: 'ghost', onClick: () => {
    query = {}; from.select.value = ''; to.select.value = ''; update(); onChange({});
  } });
  function update() {
    summary.textContent = conversionQueryActive(query)
      ? `指定轉珠：${query.from ? ORB_NAMES[query.from] : '不限'} → ${query.to ? ORB_NAMES[query.to] : '不限'}`
      : '指定轉珠';
    clear.disabled = !conversionQueryActive(query);
  }
  update();
  const details = h('details', { 'data-conversion-filter': '', open, style: { margin: '8px 0' } }, summary,
    h('div', { class: 'codex-filters', style: { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' } }, from.node, to.node),
    h('p', { class: 'small-text' }, '技能包含指定轉換段，其他效果請查看技能。'),
    h('p', { class: 'small-text dim' }, '只查主動技的明確轉珠段。洗盤、整排轉珠、雙色盤、強化、補珠或天降本身不算指定轉換段；技能包含其他效果仍可符合，不代表施放後的最終盤面。'),
    clear);
  details.addEventListener('toggle', () => { if (details.isConnected) onToggle(details.open); });
  return details;
}
