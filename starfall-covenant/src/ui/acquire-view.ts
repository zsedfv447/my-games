// 追卡指南的畫面元件：圖鑑詳情的「取得方式」與進化畫面的「素材去哪拿」共用（規則在 acquire-guide.ts）
import { h } from './dom';
import { gameData } from '../data/load';
import { acquireRoutes, KIND_LABEL, materialGuide, rateText, type AcquireRoute, type MaterialGuide } from './acquire-guide';
import { badge, icon, panel } from './components/basic';
import { cardThumb } from './components/card-thumb';
import type { Navigator } from './router';
import { getSave } from './state';
import { shopPrice, tokenName } from './economy';
import type { ShopItemDef } from '../core/types';
import './acquire.css';

/** 兌換價格：同一種素材可能在金幣商店與不同活動商店都換得到，要寫出用什麼換 */
function priceText(item: ShopItemDef): string {
  const p = shopPrice(item);
  const unit = p.icon === 'gem' ? '星晶' : p.icon === 'coin' ? '金幣' : tokenName(p.token ?? '');
  return `${p.amount.toLocaleString()} ${unit}`;
}

function routeTitle(r: AcquireRoute): string {
  switch (r.kind) {
    case 'firstClear': return r.stage.name;
    case 'drop': return `${r.stage.name}・掉落率 ${rateText(r.rate)}`;
    case 'shop': return `${r.item.name}・${priceText(r.item)}`;
    case 'evolve': return `由「${r.from.name}」進化`;
    case 'gacha': return r.pool.name;
    case 'quest': return r.quest.name;
  }
}

function routeRow(r: AcquireRoute, nav: Navigator): HTMLElement {
  return h('button', { type: 'button', class: ['acquire-row', !r.available && 'unavailable'], onClick: () => nav.go(r.go[0], r.go[1]) },
    badge(KIND_LABEL[r.kind], r.available ? 'gold' : undefined),
    h('span', { class: 'acquire-main' },
      h('span', { class: 'acquire-title' }, routeTitle(r)),
      r.note && h('span', { class: 'acquire-note small-text' }, r.note)),
    h('span', { class: ['acquire-state', 'small-text', r.available ? 'ok' : 'ng'] }, r.available ? '現在可取得' : '暫時無法'),
    icon('chevron'));
}

/** 圖鑑詳情的「取得方式」區塊；沒有任何途徑時回傳 null */
export function acquirePanel(cardId: string, nav: Navigator): HTMLElement | null {
  const routes = acquireRoutes(getSave(), cardId, gameData, Date.now());
  if (!routes.length) return null;
  return panel({ title: '取得方式' },
    h('p', { class: 'small-text dim', style: { margin: '0 0 6px' } }, '隨機掉落的機率照實標示，不保證一定會掉。點一下前往對應的入口。'),
    h('div', { class: 'acquire-list' }, routes.map((r) => routeRow(r, nav))));
}

function materialBlock(m: MaterialGuide, nav: Navigator): HTMLElement {
  const enough = m.have >= m.need;
  return h('div', { class: 'acquire-material' },
    h('div', { class: 'row', style: { gap: '8px', alignItems: 'center' } },
      cardThumb(m.card, { size: 40 }),
      h('span', { class: 'grow' }, m.card.name),
      h('strong', { class: enough ? 'gold-text' : 'acquire-short' }, `需要 ${m.need}・持有 ${m.have}`)),
    !enough && (m.routes.length
      ? h('div', { class: 'acquire-list' }, m.routes.map((r) => routeRow(r, nav)))
      : h('p', { class: 'small-text dim' }, '目前沒有關卡或商店能拿到這種素材')));
}

/** 進化畫面的「素材去哪拿」：每種素材需要／持有，缺的列出掉落關卡與商店 */
export function evolutionMaterialPanel(needs: { id: string; need: number; have: number }[], nav: Navigator): HTMLElement | null {
  const guide = materialGuide(getSave(), needs, gameData, Date.now());
  if (!guide.length) return null;
  return panel({ title: '進化素材' },
    guide.some((m) => m.have < m.need) && h('p', { class: 'small-text dim', style: { margin: '0 0 6px' } }, '缺少的素材可以從下面的關卡或商店取得；掉落是機率，不保證一定會掉。'),
    guide.map((m) => materialBlock(m, nav)));
}
