// 戰鬥暫停選單（提案 10）：繼續、戰鬥設定、星章條件、撤退
import type { StarCondition } from '../../core/types';
import { button, slider, toggle } from '../components/basic';
import { openDialog } from '../components/overlay';
import { h } from '../dom';
import { starText } from '../screens/prepare';
import { getSettings, updateSettings } from '../state';

export interface PauseOptions {
  stars: StarCondition[];
  onResume: () => void;
  /** 撤退：關掉暫停選單後走原本的撤退流程 */
  onRetreat: () => void;
}

export function openPauseMenu(opts: PauseOptions): void {
  const s = getSettings();
  const dlg = openDialog('暫停', h('div', { class: 'list pause-menu' },
    toggle('戰鬥加速 ×2', s.battleSpeed === 2, (v) => updateSettings({ battleSpeed: v ? 2 : 1 })),
    toggle('顯示轉珠倒數', s.showMoveTimer, (v) => updateSettings({ showMoveTimer: v })),
    toggle('技能與攻擊演出', s.battleFx, (v) => updateSettings({ battleFx: v })),
    slider({ label: '背景音樂', value: s.bgm, onInput: (v) => updateSettings({ bgm: v }) }),
    slider({ label: '音效', value: s.sfx, onInput: (v) => updateSettings({ sfx: v }) }),
    opts.stars.length > 0 && h('div', { class: 'pause-stars' },
      h('strong', { class: 'small-text' }, '星章條件'),
      opts.stars.map((c) => h('div', { class: 'row small-text' }, h('span', { class: 'stars' }, '★'), starText(c)))),
  ), [
    button('撤退', { variant: 'ghost', sound: 'back', onClick: () => { dlg.close(); opts.onRetreat(); } }),
    button('繼續', { variant: 'primary', onClick: () => { dlg.close(); opts.onResume(); } }),
  ], { dismissible: false });
}
