import { afterEach, describe, expect, it, vi } from 'vitest';
import { bindToRoute, closeRouteScoped, routeScopedCount } from '../src/ui/route-scope';
import { Router, type ScreenDef } from '../src/ui/router';

describe('綁定畫面的彈窗', () => {
  it('換畫面時全部關掉；自己先關掉的會取消登記，不會被關第二次', () => {
    const closed: string[] = [];
    bindToRoute(() => closed.push('login'));
    const unbind = bindToRoute(() => closed.push('resume'));
    unbind();
    expect(routeScopedCount()).toBe(1);
    closeRouteScoped();
    expect(closed).toEqual(['login']);
    expect(routeScopedCount()).toBe(0);
    closeRouteScoped();
    expect(closed).toEqual(['login']);
  });

  describe('Router 換畫面時關閉', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('主城跳出的彈窗在換到下一個畫面時關閉，而且在新畫面 render 之前', () => {
      let hash = '#/home';
      let onHash = () => {};
      vi.stubGlobal('location', { get hash() { return hash; }, set hash(v: string) { hash = v; onHash(); } });
      vi.stubGlobal('history', { replaceState: (_: unknown, __: string, url: string) => { hash = url; } });
      vi.stubGlobal('window', { addEventListener: (_: string, fn: () => void) => { onHash = fn; } });

      const log: string[] = [];
      const screen = (name: string): ScreenDef => ({
        name, title: name, chrome: 'sub',
        render: () => {
          log.push(`render ${name}`);
          if (name === 'home') bindToRoute(() => log.push('close popup'));
          return {} as HTMLElement;
        },
      });
      const r = new Router(() => {}).register(screen('home'), screen('stages'));
      r.start();
      r.go('stages');
      expect(log).toEqual(['render home', 'close popup', 'render stages']);
      expect(routeScopedCount()).toBe(0);
    });
  });
});
