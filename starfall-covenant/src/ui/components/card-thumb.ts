// 卡片頭像與立繪：使用者提供的圖優先，沒有就用程式產生的卡面
import type { CardDef } from '../../core/types';
import { h, svg } from '../dom';
import { cardIconSvg, cardPortraitSvg, type CardFaceInput } from '../art/card-face';
import { resolveArtPath, userAsset } from '../assets';
import { icon } from './basic';

type CardLike = CardFaceInput & { art?: CardDef['art'] };

export function cardIconUrl(card: CardLike): string | undefined {
  return userAsset('cards', `${card.id}_i`) ?? resolveArtPath(card.art?.icon);
}

export function cardPortraitUrl(card: CardLike): string | undefined {
  return userAsset('cards', card.id) ?? resolveArtPath(card.art?.portrait);
}

/** 圖片載不到時（離線、改版後舊檔已下架）換成程式產生的卡面 */
function img(url: string, alt: string, fallback: () => string): HTMLImageElement {
  const el = h('img', { src: url, alt, draggable: 'false', loading: 'lazy' });
  el.addEventListener('error', () => el.replaceWith(svg(fallback())), { once: true });
  return el;
}

export interface ThumbOptions {
  level?: number;
  locked?: boolean;
  selected?: boolean;
  size?: number;
  onClick?: () => void;
}

export function cardThumb(card: CardLike, opts: ThumbOptions = {}): HTMLElement {
  const url = cardIconUrl(card);
  // 只有立繪沒有頭像時，用立繪上半部當頭像
  const portrait = !url ? cardPortraitUrl(card) : undefined;
  const face = url ? img(url, card.name, () => cardIconSvg(card)) : portrait ? img(portrait, card.name, () => cardIconSvg(card)) : svg(cardIconSvg(card));
  if (portrait) (face as HTMLImageElement).style.objectFit = 'cover';
  return h(
    'button',
    { type: 'button', class: ['card-thumb', `card-attr-${card.attribute}`, opts.selected && 'selected'], style: opts.size ? { '--thumb': `${opts.size}px` } : undefined, 'aria-label': card.name, onClick: opts.onClick },
    face,
    opts.level !== undefined && h('span', { class: 'lv' }, `Lv.${opts.level}`),
    opts.locked && h('span', { class: 'lock' }, icon('lock')),
  );
}

export function emptySlot(onClick?: () => void, size?: number): HTMLElement {
  return h('button', { type: 'button', class: 'card-thumb empty', style: size ? { '--thumb': `${size}px` } : undefined, 'aria-label': '空位', onClick }, '+');
}

export function cardPortrait(card: CardLike): HTMLElement {
  const url = cardPortraitUrl(card);
  return h('div', { class: 'card-portrait' }, url ? img(url, card.name, () => cardPortraitSvg(card)) : svg(cardPortraitSvg(card)));
}
