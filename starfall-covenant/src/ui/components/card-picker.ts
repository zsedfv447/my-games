// 從背包選一張卡（隊伍編成用）
import { h } from '../dom';
import { expeditionUids } from '../../growth/save-ops';
import type { OwnedCard } from '../../core/types';
import { sortCards } from '../../growth';
import { ATTRIBUTE_NAMES } from '../art/palette';
import { button, tabs } from './basic';
import { cardThumb } from './card-thumb';
import { openDialog } from './overlay';
import { getSave, growth } from '../state';

export function pickCard(title: string, opts: { exclude?: Set<string>; allowRemove?: boolean }, onPick: (uid: string | null) => void): void {
  // 星靈遠行中的卡不能編隊、也不能當養成目標
  const away = expeditionUids(getSave());
  const all = getSave().inventory.cards.filter((c) => growth.card(c.cardId)?.race !== 'material' && !opts.exclude?.has(c.uid) && !away.has(c.uid));
  const grid = h('div', { class: 'picker-grid' });
  const show = (attr: string) => {
    const list: OwnedCard[] = sortCards(attr === 'all' ? all : all.filter((c) => growth.card(c.cardId)?.attribute === attr), growth, 'rarity');
    grid.replaceChildren(
      ...(list.length
        ? list.map((c) => cardThumb(growth.card(c.cardId)!, { level: c.level, size: 60, onClick: () => { dlg.close(); onPick(c.uid); } }))
        : [h('p', { class: 'small-text dim' }, '沒有可以選的卡片')]),
    );
  };
  show('all');
  const dlg = openDialog(title, h('div', null,
    tabs([{ id: 'all', label: '全部' }, ...(['fire', 'water', 'wood', 'light', 'dark'] as const).map((a) => ({ id: a, label: ATTRIBUTE_NAMES[a] }))], 'all', show),
    grid,
  ), [
    ...(opts.allowRemove ? [button('移出隊伍', { variant: 'danger', onClick: () => { dlg.close(); onPick(null); } })] : []),
    button('關閉', { variant: 'ghost', sound: 'back', onClick: () => dlg.close() }),
  ]);
}
