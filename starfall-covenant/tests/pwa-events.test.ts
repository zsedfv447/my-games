import { describe, expect, it } from 'vitest';
import manifest from '../public/manifest.webmanifest?raw';
import { gameData } from '../src/data/load';
import { validateGameData } from '../src/data/validate';
import { eventStatusText, eventWindow, formatCountdown, isEventOpen, openEventIds, type EventDef } from '../src/progression/events';
import { stageLockReason } from '../src/progression/stages';
import { createNewSave } from '../src/save/save';
import { buildVersion, cacheableSize, entriesToTrim, keysToDelete, RUNTIME_CACHE_LIMIT, shellFiles, strategyFor } from '../src/pwa/strategy';
import { stageContext } from '../src/ui/stage-nav';

const at = (s: string) => new Date(s).getTime();
const DAY = 86_400_000;
const ev = (period: EventDef['period']): EventDef => ({ id: 'ev', name: '測試活動', summary: '', period });

describe('活動期間', () => {
  it('單一檔期：開始前、期間、結束後', () => {
    const e = ev({ start: '2026-11-01T00:00:00', end: '2026-11-08T00:00:00' });
    expect(eventWindow(e, at('2026-10-31T12:00:00')).state).toBe('upcoming');
    expect(isEventOpen(e, at('2026-11-03T00:00:00'))).toBe(true);
    expect(eventWindow(e, at('2026-11-08T00:00:00')).state).toBe('ended');
  });

  it('循環檔期：14 天開放、休 7 天後再開', () => {
    const e = ev({ start: '2026-10-26T00:00:00', end: '2026-11-09T00:00:00', repeatDays: 21 });
    expect(isEventOpen(e, at('2026-11-08T23:00:00'))).toBe(true);
    const rest = eventWindow(e, at('2026-11-10T00:00:00'));
    expect(rest).toEqual({ state: 'upcoming', start: at('2026-11-16T00:00:00'), end: at('2026-11-30T00:00:00') });
    expect(isEventOpen(e, at('2026-11-16T00:00:00') + 1)).toBe(true);
    expect(isEventOpen(e, at('2026-10-26T00:00:00') + 100 * DAY)).toBe(isEventOpen(e, at('2026-10-26T00:00:00') + 16 * DAY));
  });

  it('沒有檔期就是常駐', () => {
    expect(eventStatusText(ev(null), 0)).toBe('常駐開放');
    expect(isEventOpen(ev(null), at('2099-01-01T00:00:00'))).toBe(true);
  });

  it('倒數文字', () => {
    expect(formatCountdown(3 * DAY + 4 * 3600_000 + 5000)).toBe('3 天 4 小時');
    expect(formatCountdown(5 * 3600_000 + 12 * 60_000 + 9000)).toBe('05:12:09');
    expect(formatCountdown(-1)).toBe('00:00:00');
    const e = ev({ start: '2026-11-01T00:00:00', end: '2026-11-08T00:00:00' });
    expect(eventStatusText(e, at('2026-11-07T23:00:00'))).toBe('剩餘 01:00:00');
    expect(eventStatusText(e, at('2026-10-31T23:00:00'))).toBe('01:00:00 後開放');
  });

  it('活動關卡只在檔期內能進', () => {
    const stage = gameData.stages.find((s) => s.kind === 'event')!;
    const save = createNewSave(gameData.config, 0);
    const [beast] = gameData.events;
    // 現有活動設很長的檔期：v0.1 期間不會被關掉
    const open = at('2026-11-12T12:00:00');
    const closed = at('2028-01-02T00:00:00');
    expect(openEventIds(gameData.events, open).has(beast.id)).toBe(true);
    expect(stageLockReason(save, stage, stageContext(gameData.stages, gameData.events, open), open)).toBeNull();
    expect(stageLockReason(save, stage, stageContext(gameData.stages, gameData.events, closed), closed)).toBe('eventClosed');
  });

  it('資料驗證：活動關卡要對應 events.json', () => {
    const broken = structuredClone(gameData);
    broken.events = [];
    expect(validateGameData(broken).some((e) => e.includes('不在 events.json'))).toBe(true);
  });
});

describe('PWA 快取規則', () => {
  const scope = 'https://example.github.io/my-games/starfall-covenant/';
  const get = (path: string, extra: Partial<{ mode: string; hasRange: boolean; method: string }> = {}) =>
    strategyFor({ url: path.startsWith('http') ? path : scope + path, method: 'GET', ...extra }, scope);

  it('頁面與沒有雜湊的檔案先上網，更新版本不會卡在舊版', () => {
    expect(get('', { mode: 'navigate' })).toBe('network-first');
    expect(get('index.html', { mode: 'navigate' })).toBe('network-first');
    expect(get('manifest.webmanifest')).toBe('network-first');
    expect(get('icons/icon-192.png')).toBe('network-first');
  });

  it('雜湊檔名先用快取；音樂分段請求、sw.js、其他網站不經快取', () => {
    expect(get('assets/index-BSa9PQLK.js')).toBe('cache-first');
    expect(get('assets/c102_i-khV72pYb.webp')).toBe('cache-first');
    expect(get('assets/home-R2Pj61o_.m4a', { hasRange: true })).toBe('bypass');
    expect(get('sw.js')).toBe('bypass');
    expect(get('https://example.github.io/other-repo/x.js')).toBe('bypass');
    expect(get('assets/index-BSa9PQLK.js', { method: 'POST' })).toBe('bypass');
    expect(get('https://fonts.gstatic.com/s/notosanstc/v1/a.woff2')).toBe('stale-while-revalidate');
  });

  it('安裝時只存外殼（頁面、程式、樣式、manifest、圖示），不存 BGM 與立繪', () => {
    expect(shellFiles(['index.html', 'assets/index-a.js', 'assets/index-b.css', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/sources.json', 'assets/c101-x.webp', 'assets/home-y.m4a']))
      .toEqual(['index.html', 'assets/index-a.js', 'assets/index-b.css', 'manifest.webmanifest', 'icons/icon-192.png']);
  });

  it('執行時快取有上限：超過數量刪最舊的，太大的檔案（BGM）不存', () => {
    const keys = Array.from({ length: RUNTIME_CACHE_LIMIT.entries + 3 }, (_, i) => i);
    expect(entriesToTrim(keys)).toEqual([0, 1, 2]);
    expect(entriesToTrim([1, 2])).toEqual([]);
    expect(cacheableSize('2600000', '/assets/home-x.m4a')).toBe(false);
    expect(cacheableSize('40000', '/assets/tap-x.m4a')).toBe(true);
    expect(cacheableSize(null, '/assets/home-x.m4a')).toBe(false);
    expect(cacheableSize(null, '/assets/c101-x.webp')).toBe(true);
  });

  it('改版時保留上一版外殼一次，再上一版才刪', () => {
    expect(keysToDelete(['starfall-shell-a', 'starfall-shell-b', 'starfall-11tfkbl'], 'starfall-shell-b')).toEqual(['starfall-shell-a', 'starfall-11tfkbl']);
    expect(keysToDelete([], undefined)).toEqual([]);
  });

  it('檔案或內容改變就換版本（舊快取會被清掉）', () => {
    const v = buildVersion(['a.js', 'b.css'], 'html');
    expect(buildVersion(['b.css', 'a.js'], 'html')).toBe(v);
    expect(buildVersion(['a2.js', 'b.css'], 'html')).not.toBe(v);
    expect(buildVersion(['a.js', 'b.css'], 'html2')).not.toBe(v);
  });

  it('manifest 用相對路徑，部署在 GitHub Pages 子路徑也能用', () => {
    const m = JSON.parse(manifest);
    expect(m.start_url.startsWith('./')).toBe(true);
    expect(m.scope).toBe('./');
    for (const icon of m.icons) expect(icon.src.startsWith('/')).toBe(false);
    expect(m.icons.some((i: { purpose: string }) => i.purpose === 'maskable')).toBe(true);
  });
});
