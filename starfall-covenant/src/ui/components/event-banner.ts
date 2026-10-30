// 限時活動橫幅：活動名稱、剩餘時間（每秒更新）、代幣持有數、兌換商店入口
import { eventStatusText, eventWindow, type EventDef } from '../../progression/events';
import { h } from '../dom';
import { tokenName } from '../economy';
import type { Navigator } from '../router';
import { getSave } from '../state';
import { button, resource } from './basic';
import '../economy.css';

export function eventBanner(event: EventDef, opts: { nav?: Navigator; onLeave: (fn: () => void) => void; /** false：商店內使用，不顯示代幣數與商店鈕（商店自己有） */ showShop?: boolean }): HTMLElement {
  const status = h('strong', { class: 'event-countdown' });
  const el = h('div', { class: 'event-banner' },
    h('div', { class: 'event-banner-head' }, h('h2', null, event.name), status),
    h('p', { class: 'small-text' }, event.summary),
    h('div', { class: 'row between' },
      opts.showShop !== false && event.token ? resource('token', `${tokenName(event.token)} ${(getSave().player.tokens[event.token] ?? 0).toLocaleString()}`) : h('span'),
      opts.showShop !== false && opts.nav && event.token && button('兌換商店', { small: true, icon: 'shop', onClick: () => opts.nav!.go('shop', ['event']) })));
  const tick = () => {
    const now = Date.now();
    status.textContent = eventStatusText(event, now);
    el.dataset.state = eventWindow(event, now).state;
  };
  tick();
  // 常駐活動不倒數，只顯示「常駐」標籤
  if (!event.period) return el;
  const timer = setInterval(tick, 1000);
  opts.onLeave(() => clearInterval(timer));
  return el;
}
