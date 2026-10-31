import { h } from '../dom';
import { gameData } from '../../data/load';
import { growth } from '../state';
import { ROLE_LABEL } from '../../growth';
import { ATTRIBUTE_NAMES, RACE_NAMES } from '../art/palette';
import { badge, button, panel } from './basic';
import { cardPortrait } from './card-thumb';
import { overlayRoot } from './overlay';
import { bindToRoute } from '../route-scope';
import { beginQuickViewHistory, dismissQuickView, leaveQuickView } from '../quick-view-history';
import type { Navigator } from '../router';
import { passiveText } from '../screens/growth-view';

let current: { show: (id: string) => void } | undefined;
/** Read-only: no collection discovery, reward, team editing or currency writes. */
export function openCardQuickView(cardId: string, nav: Navigator): void {
  if (!growth.card(cardId)) return;
  if (current) { current.show(cardId); return; }
  const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const overlay = h('div', { class: 'overlay', role: 'dialog', 'aria-modal': 'true', 'data-card-quickview': '' });
  const content = h('div', { class: 'codex-detail' });
  const closeButton = button('關閉介紹', { variant: 'ghost', onClick: () => dismissQuickView() });
  const header = h('div', { class: 'row between', style: { position: 'sticky', top: '0', zIndex: '1', background: 'var(--bg-elev)', paddingBottom: '6px' } }, h('strong', null, '卡片介紹'), closeButton);
  const dialog = h('section', { class: 'panel gold dialog', tabIndex: -1 }, header, content);
  overlay.append(dialog);
  let unbind: (() => void) | undefined;
  const cleanup = () => {
    unbind?.(); document.removeEventListener('keydown', onKey);
    overlay.remove(); current = undefined;
    if (opener?.isConnected) opener.focus({ preventScroll: true });
  };
  const onKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape') { event.preventDefault(); dismissQuickView(); }
    if (event.key === 'Tab') {
      const controls = [...dialog.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],[tabindex="0"]')];
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  };
  if (!beginQuickViewHistory(cleanup)) return;
  const go = (name: string, args: string[]) => { nav.rememberPosition?.(); nav.go(name, args); leaveQuickView(); };
  const show = (id: string) => {
    const card = growth.card(id); if (!card) return;
    const skill = card.activeSkill && growth.skill(card.activeSkill);
    const leader = card.leaderSkill && growth.leaderSkill(card.leaderSkill);
    overlay.setAttribute('aria-label', `${card.name}・卡片介紹`);
    content.replaceChildren(
      h('h2', null, card.name), cardPortrait(card),
      h('div', { class: 'row wrap' }, badge(`${ATTRIBUTE_NAMES[card.attribute]}屬性`), badge(RACE_NAMES[card.race]), badge(`Cost ${card.cost}`)),
      h('p', { class: 'small-text' }, `滿級基礎：生命 ${card.stats.hp[1].toLocaleString()}・攻擊 ${card.stats.atk[1].toLocaleString()}・回復 ${card.stats.rcv[1].toLocaleString()}`),
      h('div', { class: 'row wrap' }, card.archetypes.map(a => button(`${gameData.archetypes.find(d => d.id === a.id)?.name ?? a.id}・${ROLE_LABEL[a.role]}`, { small: true, variant: 'ghost', onClick: () => go('archetypes', [a.id]) }))),
      ...(skill ? [panel({ title: `主動技・${skill.name}` }, h('p', null, skill.description), h('p', { class: 'small-text' }, `冷卻 ${skill.cooldown.max} 回合（最短 ${skill.cooldown.min}）`))] : []),
      ...(leader ? [panel({ title: `隊長技・${leader.name}` }, h('p', null, leader.description))] : []),
      ...(card.awakenings?.length ? [panel({ title: '可解鎖的星紋覺醒' }, h('ul', null, card.awakenings.map(p => h('li', null, passiveText(p)))))] : []),
      h('p', { class: 'small-text dim' }, '僅供查看搭配，不會取得卡片或領取獎勵。'),
      button('完整圖鑑與取得方式', { variant: 'primary', onClick: () => go('collection-card', [card.id]) }),
    );
    dialog.scrollTop = 0;
  };
  current = { show }; show(cardId);
  overlay.addEventListener('click', e => { if (e.target === overlay) dismissQuickView(); });
  document.addEventListener('keydown', onKey);
  unbind = bindToRoute(leaveQuickView);
  overlayRoot().append(overlay); closeButton.focus({ preventScroll: true });
}
