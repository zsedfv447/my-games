// 介面進入點：舞台縮放＋版面骨架＋畫面路由
import './theme.css';
import { installStageScaling } from './scale';
import { Shell } from './components/shell';
import { Router } from './router';
import { SCREENS } from './screens';
import { audio } from './audio';
import { button } from './components/basic';
import { openDialog } from './components/overlay';
import { commit, getLoadProblem, getSave, loadErrorText, resetAll } from './state';
import { bus } from '../core/events';
import { gameData } from '../data/load';
import { subscribeQuestCounters } from '../progression/quests';

export function startApp(stage: HTMLElement): Router {
  installStageScaling(stage);
  const shell = new Shell(stage);
  const router = new Router(shell.mount).register(...SCREENS);
  shell.attach(router);
  // 任何第一次點擊都解鎖音效（瀏覽器規定）
  window.addEventListener('pointerdown', () => audio.unlock(), { once: true });
  // 任務與成就計數：戰鬥、抽卡、強化等事件累加到存檔
  subscribeQuestCounters(bus, (fn) => commit(fn(getSave())), gameData.quests, (id) => gameData.stages.find((s) => s.id === id)?.kind);
  router.start();
  warnBrokenSave();
  return router;
}

/** 存檔讀不出來時不自動覆蓋，讓玩家決定要重置還是先去設定匯入備份 */
function warnBrokenSave(): void {
  const problem = getLoadProblem();
  if (!problem) return;
  const dlg = openDialog('存檔讀取失敗', `${loadErrorText(problem)}。目前的遊玩進度不會存檔，你可以重置存檔，或到設定匯入存檔碼。`, [
    button('稍後再說', { variant: 'ghost', onClick: () => dlg.close() }),
    button('重置存檔', { variant: 'danger', onClick: () => { resetAll(); dlg.close(); } }),
  ], { dismissible: false });
}
