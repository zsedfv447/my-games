// 離線快取規則（service worker 與測試共用，不碰瀏覽器 API）
//
// - 頁面（index.html）、manifest 等沒有雜湊檔名的檔案：先上網拿最新版，離線才用快取 → 更新版本不會卡在舊版
// - assets/ 底下 Vite 產生的雜湊檔名：內容不會變，先用快取（外殼以外的素材用到才存，有上限）
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

/** 安裝時只先存「外殼」：頁面、程式、樣式、manifest、圖示；立繪、音樂等素材在用到時才存（有數量與大小上限） */
export function shellFiles(files: string[]): string[] {
  return files.filter((f) => /\.(html|js|css|webmanifest)$/.test(f) || /^icons\/.+\.png$/.test(f));
}

/** 執行時快取的上限：最多幾個檔案、單檔多大（BGM 約 2–3MB，不存） */
export const RUNTIME_CACHE_LIMIT = { entries: 200, bytes: 1_000_000 };

/** 超過上限時要刪掉的最舊項目（keys 依存入順序） */
export function entriesToTrim<T>(keys: readonly T[], max = RUNTIME_CACHE_LIMIT.entries): T[] {
  return keys.length > max ? keys.slice(0, keys.length - max) : [];
}

/** 回應能不能進執行時快取：太大的（BGM）或不知道大小的音樂不存 */
export function cacheableSize(contentLength: string | null, path: string): boolean {
  const n = contentLength === null ? NaN : Number(contentLength);
  if (Number.isFinite(n)) return n <= RUNTIME_CACHE_LIMIT.bytes;
  return !/\.(m4a|mp3|ogg|wav)$/i.test(path);
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
