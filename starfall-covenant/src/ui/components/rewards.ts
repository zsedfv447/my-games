// 獎勵小標籤與畫面頂部橫幅（商店、登入、任務、成就共用）
import type { Reward } from '../../core/types';
import { gameData } from '../../data/load';
import { h, type Child } from '../dom';
import { userAsset } from '../assets';
import { rewardParts } from '../economy';
import { resourceIcon } from './basic';
import { cardThumb } from './card-thumb';
import '../economy.css';

const cardById = new Map(gameData.cards.map((c) => [c.id, c]));

export function rewardChips(reward: Reward): HTMLElement {
  return h('div', { class: 'reward-chips' }, rewardParts(reward).map((p) => {
    const card = p.card ? cardById.get(p.card) : undefined;
    return h('span', { class: 'reward-chip' }, card ? cardThumb(card, { size: 22 }) : p.icon !== 'card' && resourceIcon(p.icon), p.label);
  }));
}

/** 獎勵的大圖示（登入格子、商品圖用） */
export function rewardArt(reward: Reward, art?: string, fallback?: Child): HTMLElement {
  const url = art && userAsset('ui', art);
  if (url) return h('img', { class: 'reward-art', src: url, alt: '', draggable: 'false' });
  const first = rewardParts(reward)[0];
  const card = first?.card ? cardById.get(first.card) : undefined;
  if (card) return h('div', { class: 'reward-art' }, cardThumb(card, { size: 52 }));
  return h('div', { class: 'reward-art' }, fallback ?? (first && first.icon !== 'card' ? resourceIcon(first.icon) : null));
}

/** 畫面頂部橫幅：有使用者素材就顯示圖，沒有就只顯示標題 */
export function screenBanner(art: string, title: string, sub: string): HTMLElement {
  const packArt: Record<string, string> = { 'shop-banner': 'pack-shop-banner', 'login-banner': 'pack-login-banner', 'quest-banner': 'pack-quest-banner' };
  const url = (packArt[art] && userAsset('backgrounds', packArt[art])) || userAsset('ui', art);
  return h('div', { class: ['screen-banner', url && 'has-art'] },
    url && h('img', { src: url, alt: '', draggable: 'false' }),
    h('div', { class: 'screen-banner-copy' }, h('strong', null, title), h('small', null, sub)));
}
