// 註冊 service worker（只在正式版）。新版本接手後，等玩家回到主城才重新整理，避免打斷戰鬥或抽卡演出。
let updateReady = false;

export const isUpdateReady = () => updateReady;

export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // 第一次安裝不算更新
    if (hadController) updateReady = true;
  });
  window.addEventListener('load', () => {
    // updateViaCache: 'none'：檢查 sw.js 時不吃瀏覽器 HTTP 快取，部署後能立刻發現新版
    navigator.serviceWorker.register(new URL('sw.js', document.baseURI), { updateViaCache: 'none' })
      .then((reg) => {
        // 長時間開著的分頁每小時檢查一次，切回前景時也檢查
        setInterval(() => void reg.update().catch(() => undefined), 3_600_000);
        document.addEventListener('visibilitychange', () => { if (!document.hidden) void reg.update().catch(() => undefined); });
      })
      .catch(() => undefined);
  });
}

/** 路由切到主城時呼叫：有新版本就重新整理（存檔在每次操作後都已寫入） */
export function applyUpdateIfReady(screen: string): boolean {
  if (!updateReady || screen !== 'home') return false;
  location.reload();
  return true;
}
