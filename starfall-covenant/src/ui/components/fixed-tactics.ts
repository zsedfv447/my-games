import { gameData } from '../../data/load';
import { buildFixedTactics } from '../fixed-tactics';
import { h } from '../dom';
import type { Navigator } from '../router';
import { button } from './basic';
import { openCardQuickView } from './card-quickview';

/** Optional, read-only explanation of the actual borrowed roster; never grants cards or starts a trial. */
export function fixedTacticsView(nav: Navigator): HTMLElement | null {
  const tactics = buildFixedTactics(gameData);
  if (!tactics) return null;
  return h('details', { 'data-fixed-tactics': '', style: { marginTop: '10px' } },
    h('summary', { style: { cursor: 'pointer', padding: '8px 0' } }, '這支借用隊怎麼打'),
    h('h4', null, '借用隊員與分工'),
    tactics.members.map((member) => h('div', { 'data-tactics-card': member.card.id, style: { marginBottom: '12px' } },
      button(member.card.name, { small: true, variant: 'ghost', onClick: () => openCardQuickView(member.card.id, nav) }),
      h('span', { class: 'small-text dim' }, ` Lv${member.level}・${member.helper ? '助戰' : member.leader ? '隊長' : '隊員'}`),
      h('p', { class: 'small-text' }, member.role),
      h('p', { class: 'small-text' }, h('strong', null, '主動技：'), member.activeDescription),
      member.leaderDescription && h('p', { class: 'small-text', 'data-tactics-leader': '' }, h('strong', null, '隊長技：'), member.leaderDescription))),
    h('h4', null, '每回合檢查'),
    h('ol', { class: 'small-text', style: { paddingLeft: '24px' } }, tactics.steps.map(step => h('li', { style: { marginBottom: '6px' } }, step))),
    h('h4', null, '護盾與傷害邊界'),
    h('dl', { class: 'small-text' }, tactics.defenses.map(defense => [
      h('dt', null, h('strong', null, defense.label)),
      h('dd', { style: { margin: '4px 0 10px' } }, defense.detail),
    ])));
}
