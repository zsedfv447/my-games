import { afterEach, describe, expect, it, vi } from 'vitest';
import { Router, type ScreenDef } from '../src/ui/router';

// 最小的瀏覽器替身：hash 用陣列模擬瀏覽紀錄，history.go 會觸發 hashchange
function fakeBrowser(start: string) {
  const entries = [start];
  let index = 0;
  let onHash: () => void = () => {};
  const location = {
    get hash() { return entries[index]; },
    set hash(v: string) { entries.splice(index + 1); entries.push(v); index++; onHash(); },
  };
  const history = {
    replaceState: (_: unknown, __: string, url: string) => { entries[index] = url; },
    back: () => history.go(-1),
    go: (n: number) => { index += n; onHash(); },
  };
  vi.stubGlobal('location', location);
  vi.stubGlobal('history', history);
  vi.stubGlobal('window', { addEventListener: (_: string, fn: () => void) => { onHash = fn; } });
  return { entries: () => entries.slice(0, index + 1) };
}

const screen = (name: string): ScreenDef => ({ name, title: name, chrome: 'sub', render: () => ({}) as HTMLElement });

describe('Router.backTo', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('紀錄裡有目標就退回去，中間的出戰確認一起丟掉', () => {
    const b = fakeBrowser('#/stages/1');
    const shown: string[] = [];
    const r = new Router((s, _el, route) => shown.push([s.name, ...route.args].join('/'))).register(screen('stages'), screen('prepare'), screen('battle'), screen('home'));
    r.start();
    r.go('prepare', ['st-1-1']);
    r.go('battle', ['st-1-1']);
    r.backTo('stages/1');
    expect(shown.at(-1)).toBe('stages/1');
    expect(b.entries()).toEqual(['#/stages/1']);
    // 再按返回不會回到出戰確認，而是上層畫面
    r.back();
    expect(shown.at(-1)).toBe('home');
  });

  it('紀錄裡沒有目標就原地換成它', () => {
    const b = fakeBrowser('#/home');
    const shown: string[] = [];
    const r = new Router((s, _el, route) => shown.push([s.name, ...route.args].join('/'))).register(screen('stages'), screen('prepare'), screen('home'));
    r.start();
    r.go('prepare', ['st-2-1']);
    r.backTo('stages/2');
    expect(shown.at(-1)).toBe('stages/2');
    expect(b.entries()).toEqual(['#/home', '#/stages/2']);
  });
});
