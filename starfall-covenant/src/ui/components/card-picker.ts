// 從背包選一張卡（隊伍編成用）
import { h, type Child } from '../dom';
import { expeditionUids } from '../../growth/save-ops';
import type { OwnedCard } from '../../core/types';
import { sortCards } from '../../growth';
import { ATTRIBUTE_NAMES } from '../art/palette';
import { button, tabs } from './basic';
import { cardThumb } from './card-thumb';
import { openDialog } from './overlay';
import { getSave, growth } from '../state';
import { LABEL } from '../wording';

export interface PickCardOptions {
  exclude?: Set<string>;
  allowRemove?: boolean;
  /** 有給時：點卡先顯示比較（例如換上後的隊伍數值），按「換上」才確定 */
  preview?: (uid: string) => Child;
}

export function pickCard(title: string, opts: PickCardOptions, onPick: (uid: string | null) => void): void {
  // 星靈遠行中的卡不能編隊、也不能當養成目標
  const away = expeditionUids(getSave());
  const all = getSave().inventory.cards.filter((c) => growth.card(c.cardId)?.race !== 'material' && !opts.exclude?.has(c.uid) && !away.has(c.uid));
  const grid = h('div', { class: 'picker-grid' });
  const show = (attr: string) => {
    const list: OwnedCard[] = sortCards(attr === 'all' ? all : all.filter((c) => growth.card(c.cardId)?.attribute === attr), growth, 'rarity');
    grid.replaceChildren(
      ...(list.length
        ? list.map((c) => cardThumb(growth.card(c.cardId)!, { level: c.level, size: 60, selected: c.uid === chosen, onClick: () => choose(c.uid) }))
        : [h('p', { class: 'small-text dim' }, '沒有可以選的卡片')]),
    );
  };
  let chosen: string | null = null;
  let attrTab = 'all';
  const previewHost = h('div', { class: 'picker-preview' }, opts.preview && h('p', { class: 'small-text dim', style: { margin: '0' } }, '點一張卡查看換上後的變化'));
  const confirm = button('換上', { variant: 'primary', disabled: true, onClick: () => { if (chosen) { dlg.close(); onPick(chosen); } } });
  // 沒有比較功能時點了就選；有的話先顯示比較，再點同一張或按「換上」確定
  function choose(uid: string) {
    if (!opts.preview || chosen === uid) { dlg.close(); onPick(uid); return; }
    chosen = uid;
    confirm.disabled = false;
    previewHost.replaceChildren(h('div', null, opts.preview(uid)));
    show(attrTab);
  }
  show('all');
  const dlg = openDialog(title, h('div', null,
    opts.preview && previewHost,
    tabs([{ id: 'all', label: '全部' }, ...(['fire', 'water', 'wood', 'light', 'dark'] as const).map((a) => ({ id: a, label: ATTRIBUTE_NAMES[a] }))], 'all', (a) => { attrTab = a; show(a); }),
    grid,
  ), [
    ...(opts.allowRemove ? [button('移出隊伍', { variant: 'danger', onClick: () => { dlg.close(); onPick(null); } })] : []),
    ...(opts.preview ? [confirm] : []),
    button(LABEL.close, { variant: 'ghost', sound: 'back', onClick: () => dlg.close() }),
  ]);
}
