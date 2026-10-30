// Service worker：建置時由 tools/pwa-plugin.ts 打包成 dist/sw.js，並填入版本與檔案清單
import { splitPrecache, strategyFor } from './strategy';

declare const __SW_VERSION__: string;
declare const __SW_FILES__: string[];

// tsconfig 只帶 DOM 型別，這裡自己宣告 service worker 用到的部分
interface ExtendableEvent extends Event { waitUntil(p: Promise<unknown>): void }
interface FetchEvent extends ExtendableEvent { request: Request; respondWith(r: Promise<Response>): void }
interface SwScope {
  registration: { scope: string };
  skipWaiting(): Promise<void>;
  clients: { claim(): Promise<void> };
  addEventListener(type: 'install' | 'activate', fn: (e: ExtendableEvent) => void): void;
  addEventListener(type: 'fetch', fn: (e: FetchEvent) => void): void;
}

const sw = self as unknown as SwScope;
const CACHE = `starfall-${__SW_VERSION__}`;
const FONT_CACHE = 'starfall-fonts';
const scope = sw.registration.scope;
const { core, warm } = splitPrecache(__SW_FILES__);
const url = (f: string) => new URL(f, scope).href;
// 伺服器可能回 Vary: Origin，而模組腳本請求會帶 Origin 標頭；比對快取時忽略 Vary，否則離線時會找不到
const MATCH = { ignoreVary: true };

sw.addEventListener('install', (e) => {
  // 新版下載完就直接接手；頁面會在玩家回到主城時重新整理（見 src/pwa/register.ts）
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll([scope, ...core.map(url)])).then(() => sw.skipWaiting()));
});

sw.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith('starfall-') && key !== CACHE && key !== FONT_CACHE) await caches.delete(key);
    await sw.clients.claim();
    // 圖片在背景補齊，失敗的等實際用到時再存
    const c = await caches.open(CACHE);
    for (const f of warm) {
      if (!(await c.match(url(f), MATCH))) await c.add(url(f)).catch(() => undefined);
    }
  })());
});

async function networkFirst(req: Request, navigate: boolean): Promise<Response> {
  const c = await caches.open(CACHE);
  try {
    const res = await fetch(req, { cache: 'no-cache' });
    if (res.ok) await c.put(navigate ? scope : req, res.clone());
    return res;
  } catch {
    return (await c.match(navigate ? scope : req, MATCH)) ?? Response.error();
  }
}

async function cacheFirst(req: Request): Promise<Response> {
  const c = await caches.open(CACHE);
  const hit = await c.match(req, MATCH);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) await c.put(req, res.clone());
  return res;
}

async function staleWhileRevalidate(req: Request): Promise<Response> {
  const c = await caches.open(FONT_CACHE);
  const hit = await c.match(req, MATCH);
  const fresh = fetch(req).then((res) => {
    if (res.ok || res.type === 'opaque') void c.put(req, res.clone());
    return res;
  });
  return hit ?? fresh;
}

sw.addEventListener('fetch', (e) => {
  const req = e.request;
  const strategy = strategyFor({ url: req.url, method: req.method, mode: req.mode, hasRange: req.headers.has('range') }, scope);
  if (strategy === 'bypass') return;
  if (strategy === 'network-first') e.respondWith(networkFirst(req, req.mode === 'navigate'));
  else if (strategy === 'cache-first') e.respondWith(cacheFirst(req));
  else e.respondWith(staleWhileRevalidate(req));
});
