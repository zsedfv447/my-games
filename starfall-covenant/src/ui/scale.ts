// 以 390×844 為設計基準等比縮放；較細長的手機把多出來的高度留給畫面，不留黑邊
export const DESIGN_WIDTH = 390;
export const DESIGN_HEIGHT = 844;

export interface StageFit {
  scale: number;
  /** 舞台在設計座標下的高度（≥ 844 時代表畫面比設計稿更細長） */
  height: number;
}

export function fitStage(viewportW: number, viewportH: number): StageFit {
  const scale = Math.min(viewportW / DESIGN_WIDTH, viewportH / DESIGN_HEIGHT);
  // 寬度先頂滿時，剩下的高度換算回設計座標
  const height = Math.max(DESIGN_HEIGHT, Math.floor(viewportH / scale));
  return { scale, height };
}

/** 讀取瀏海安全區（px），換算成設計座標 */
function readSafeArea(scale: number): { top: number; bottom: number } {
  const probe = document.createElement('div');
  probe.style.cssText =
    'position:fixed;visibility:hidden;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)';
  document.body.appendChild(probe);
  const cs = getComputedStyle(probe);
  const top = parseFloat(cs.paddingTop) || 0;
  const bottom = parseFloat(cs.paddingBottom) || 0;
  probe.remove();
  return { top: top / scale, bottom: bottom / scale };
}

export function installStageScaling(app: HTMLElement): () => void {
  const apply = () => {
    const vw = window.visualViewport?.width ?? window.innerWidth;
    const vh = window.visualViewport?.height ?? window.innerHeight;
    const { scale, height } = fitStage(vw, vh);
    const safe = readSafeArea(scale);
    app.style.setProperty('--stage-scale', String(scale));
    app.style.setProperty('--stage-height', `${height}px`);
    app.style.setProperty('--safe-top', `${safe.top}px`);
    app.style.setProperty('--safe-bottom', `${safe.bottom}px`);
  };
  apply();
  window.addEventListener('resize', apply);
  window.visualViewport?.addEventListener('resize', apply);
  return () => {
    window.removeEventListener('resize', apply);
    window.visualViewport?.removeEventListener('resize', apply);
  };
}

/** 把畫面座標換成設計座標（給 Canvas 盤面拖曳用） */
export function toDesignPoint(app: HTMLElement, clientX: number, clientY: number): { x: number; y: number } {
  const rect = app.getBoundingClientRect();
  const scale = rect.width / DESIGN_WIDTH;
  return { x: (clientX - rect.left) / scale, y: (clientY - rect.top) / scale };
}
