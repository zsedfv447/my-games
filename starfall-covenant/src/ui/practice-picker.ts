// 練習場入口：先選練習模式（一般／機制示範），每種附一句說明。練習不扣體力、不給獎勵、不寫入手札與任務計數。
import { listItem } from './components/basic';
import { openDialog } from './components/overlay';
import { button } from './components/basic';
import { h } from './dom';
import { PRACTICE_MODES } from './demo';
import type { Navigator } from './router';

export function openPracticePicker(nav: Navigator): void {
  const dlg = openDialog('練習場', h('div', { class: 'list practice-picker' },
    h('p', { class: 'small-text dim' }, '用示範隊伍練習，不耗體力、沒有獎勵，也不計入手札與任務。戰鬥中可從暫停選單切換模式。'),
    PRACTICE_MODES.map((m) => listItem({
      title: m.label,
      sub: m.description,
      onClick: () => { dlg.close(); nav.go('battle', ['practice', m.id]); },
    })),
  ), [button('取消', { variant: 'ghost', sound: 'back', onClick: () => dlg.close() })]);
}
