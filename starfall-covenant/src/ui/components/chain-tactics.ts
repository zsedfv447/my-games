import { gameData } from '../../data/load';
import { buildChainTactics } from '../chain-tactics';
import { h } from '../dom';
import type { Navigator } from '../router';
import { button } from './basic';
import { openCardQuickView } from './card-quickview';

/** Read-only borrowed-team teaching; no trial entry, board simulation or save mutation. */
export function chainTacticsView(nav: Navigator): HTMLElement | null {
  const tactics = buildChainTactics(gameData);
  if (!tactics) return null;
  return h('details', { 'data-chain-tactics': '', style: { marginTop: '10px' } },
    h('summary', { style: { cursor: 'pointer', padding: '8px 0' } }, '長串借隊：怎麼搭、先開誰'),
    h('h4', null, '長串加成、全體與破防'),
    tactics.mechanics.map(text => h('p', { class: 'small-text' }, text)),
    h('div', { class: 'row wrap' }, tactics.comparisons.map(card => {
      const link = button(card.name, { small: true, variant: 'ghost', onClick: () => openCardQuickView(card.id, nav) });
      link.setAttribute('data-chain-comparison', card.id); return link;
    })),
    h('h4', null, '實際借用隊員與分工'),
    tactics.members.map(member => h('div', { 'data-chain-card': member.card.id, style: { marginBottom: '12px' } },
      button(member.card.name, { small: true, variant: 'ghost', onClick: () => openCardQuickView(member.card.id, nav) }),
      h('span', { class: 'small-text dim' }, ` Lv${member.level}・${member.helper ? '助戰' : member.leader ? '隊長' : '隊員'}`),
      h('p', { class: 'small-text' }, member.role),
      h('p', { class: 'small-text' }, h('strong', null, '主動技：'), member.activeDescription),
      member.leaderDescription && h('p', { class: 'small-text', 'data-chain-leader': '' }, h('strong', null, '隊長技：'), member.leaderDescription))),
    h('h4', null, '示意盤面：先開誰會留下不同顏色'),
    h('p', { class: 'small-text' }, tactics.orderExample.intro),
    tactics.orderExample.rows.length > 0 && h('ol', { class: 'small-text', style: { paddingLeft: '24px' } }, tactics.orderExample.rows.map(row =>
      h('li', { 'data-chain-order': '', style: { marginBottom: '6px' } }, `${row.label}：蝕珠 ${row.dark}、焰珠 ${row.fire}。`))),
    h('p', { class: 'small-text dim' }, tactics.orderExample.note));
}
