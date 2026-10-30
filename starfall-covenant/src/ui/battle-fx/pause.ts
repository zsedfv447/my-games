// 戰鬥暫停選單（提案 10）：繼續、戰鬥設定、星章條件、撤退
import type { StarCondition } from '../../core/types';
import type { LiveStarStatus } from '../../progression/stages';
import { button, slider, toggle } from '../components/basic';
import { openDialog } from '../components/overlay';
import { h } from '../dom';
import { starText } from '../screens/prepare';
import { getSettings, updateSettings } from '../state';

const STATUS_TEXT: Record<LiveStarStatus, string> = { done: '已達成', failed: '已失敗', pending: '進行中' };

export interface PauseOptions {
  /** 星章條件與目前狀態（和頂部 HUD 同一套 liveStarStatus） */
  stars: { cond: StarCondition; status: LiveStarStatus }[];
  onResume: () => void;
  /** 撤退：關掉暫停選單後走原本的撤退流程 */
  onRetreat: () => void;
  /** 現在能不能撤退（結算動畫播放中為 false）；不給視為可以 */
  canRetreat?: boolean;
}

/** 撤退按鈕的狀態：不能撤退時停用，旁邊顯示原因 */
export function retreatControl(canRetreat = true): { disabled: boolean; note: string | null } {
  return canRetreat ? { disabled: false, note: null } : { disabled: true, note: '結算中無法撤退' };
}

export function openPauseMenu(opts: PauseOptions): void {
  const s = getSettings();
  const retreat = retreatControl(opts.canRetreat);
  const dlg = openDialog('暫停', h('div', { class: 'list pause-menu' },
    toggle('戰鬥加速 ×2', s.battleSpeed === 2, (v) => updateSettings({ battleSpeed: v ? 2 : 1 })),
    toggle('顯示轉珠倒數', s.showMoveTimer, (v) => updateSettings({ showMoveTimer: v })),
    toggle('技能與攻擊演出', s.battleFx, (v) => updateSettings({ battleFx: v })),
    slider({ label: '背景音樂', value: s.bgm, onInput: (v) => updateSettings({ bgm: v }) }),
    slider({ label: '音效', value: s.sfx, onInput: (v) => updateSettings({ sfx: v }) }),
    opts.stars.length > 0 && h('div', { class: 'pause-stars' },
      h('strong', { class: 'small-text' }, '星章條件'),
      opts.stars.map(({ cond, status }) => h('div', { class: `row small-text pause-star ${status}` },
        h('span', { class: 'pause-star-icon', 'aria-hidden': 'true' }, '★'),
        h('span', { class: 'pause-star-text' }, starText(cond)),
        h('span', { class: 'pause-star-status' }, STATUS_TEXT[status])))),
    retreat.note && h('p', { class: 'small-text dim pause-retreat-note' }, retreat.note),
  ), [
    button('撤退', { variant: 'ghost', sound: 'back', disabled: retreat.disabled, onClick: () => { dlg.close(); opts.onRetreat(); } }),
    button('繼續', { variant: 'primary', onClick: () => { dlg.close(); opts.onResume(); } }),
  ], { dismissible: false });
}
