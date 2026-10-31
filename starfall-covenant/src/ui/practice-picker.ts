// 練習場入口：先選練習模式（一般／機制示範／戰術課），每種附一句說明。練習不扣體力、不寫入手札與任務計數；戰術課第一次過關有少量金幣。
import { button, listItem } from './components/basic';
import { openDialog } from './components/overlay';
import { h } from './dom';
import { PRACTICE_MODES } from './demo';
import { drillById, drillRewardClaimed, isDrillId } from '../progression/drills';
import { getSave } from './state';
import type { Navigator } from './router';

export function openPracticePicker(nav: Navigator): void {
  const dlg = openDialog('練習場', h('div', { class: 'list practice-picker' },
    h('p', { class: 'small-text dim' }, '用示範隊伍練習，不耗體力，也不計入手札與任務；戰術課第一次過關有少量金幣。戰鬥中可從暫停選單切換模式。'),
    PRACTICE_MODES.map((m) => listItem({
      title: m.label,
      sub: drillSub(m.id, m.description),
      onClick: () => { dlg.close(); nav.go('battle', ['practice', m.id]); },
    })),
  ), [button('取消', { variant: 'ghost', sound: 'back', onClick: () => dlg.close() })]);
}

/** 戰術課在目標後面附上獎勵狀態 */
function drillSub(id: string, description: string): string {
  if (!isDrillId(id)) return description;
  return drillRewardClaimed(getSave(), id) ? `${description}（已過關）` : `${description}（第一次過關：金幣 ${drillById(id)!.coin}）`;
}
