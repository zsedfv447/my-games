// 離線快取規則（service worker 與測試共用，不碰瀏覽器 API）
//
// - 頁面（index.html）、manifest 等沒有雜湊檔名的檔案：先上網拿最新版，離線才用快取 → 更新版本不會卡在舊版
// - assets/ 底下 Vite 產生的雜湊檔名：內容不會變，先用快取
// - Google Fonts：先回快取、背景更新
// - 音樂的 Range 分段請求、其他網站、非 GET：不經過快取

export type CacheStrategy = 'network-first' | 'cache-first' | 'stale-while-revalidate' | 'bypass';

export interface RequestInfo {
  url: string;
  method: string;
  mode?: string;
  hasRange?: boolean;
}

const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];
/** Vite 輸出的雜湊檔名，例如 assets/index-BSa9PQLK.js、assets/home-R2Pj61o_.m4a */
const HASHED = /\/assets\/[^/]+-[\w-]{8}\.[a-z0-9]+$/i;

export function strategyFor(req: RequestInfo, scope: string): CacheStrategy {
  if (req.method !== 'GET' || req.hasRange) return 'bypass';
  const url = new URL(req.url);
  if (FONT_HOSTS.includes(url.hostname)) return 'stale-while-revalidate';
  if (!req.url.startsWith(scope)) return 'bypass';
  if (url.pathname.endsWith('/sw.js')) return 'bypass';
  if (req.mode === 'navigate') return 'network-first';
  return HASHED.test(url.pathname) ? 'cache-first' : 'network-first';
}

/** 安裝時一定要先存好的檔案（沒有就不能離線開啟）；其他圖片在背景補齊，音樂播放過才存 */
export function splitPrecache(files: string[]): { core: string[]; warm: string[] } {
  const core: string[] = [];
  const warm: string[] = [];
  for (const f of files) {
    if (/\.(html|js|css|webmanifest)$/.test(f) || f.startsWith('icons/')) core.push(f);
    else if (/\.(png|webp|jpe?g|avif|svg|gif)$/.test(f)) warm.push(f);
  }
  return { core, warm };
}

/** 版本字串：檔名（含內容雜湊）有任何變動就換新版本，舊快取會在新版啟用時清掉 */
export function buildVersion(files: string[], salt = ''): string {
  let h = 2166136261;
  for (const ch of [...files].sort().join('\n') + salt) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}
