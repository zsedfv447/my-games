// 介面進入點：舞台縮放＋版面骨架＋畫面路由
import './theme.css';
import { installStageScaling } from './scale';
import { Shell } from './components/shell';
import { Router } from './router';
import { SCREENS } from './screens';
import { audio } from './audio';

export function startApp(stage: HTMLElement): Router {
  installStageScaling(stage);
  const shell = new Shell(stage);
  const router = new Router(shell.mount).register(...SCREENS);
  shell.attach(router);
  // 任何第一次點擊都解鎖音效（瀏覽器規定）
  window.addEventListener('pointerdown', () => audio.unlock(), { once: true });
  router.start();
  return router;
}
