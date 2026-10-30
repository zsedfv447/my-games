// 畫面路由：以網址 hash 表示目前畫面（#/stage-list/1?from=map），方便返回鍵與重新整理後回到原畫面
export interface Route {
  name: string;
  args: string[];
  query: Record<string, string>;
}

export const DEFAULT_ROUTE = 'title';

export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#\/?/, '');
  const [pathPart, queryPart = ''] = raw.split('?');
  const segments = pathPart.split('/').filter(Boolean).map(decodeURIComponent);
  const query: Record<string, string> = {};
  for (const pair of queryPart.split('&')) {
    if (!pair) continue;
    const [k, v = ''] = pair.split('=');
    query[decodeURIComponent(k)] = decodeURIComponent(v);
  }
  return { name: segments[0] ?? DEFAULT_ROUTE, args: segments.slice(1), query };
}

export function buildHash(name: string, args: (string | number)[] = [], query: Record<string, string | number> = {}): string {
  const path = [name, ...args].map((s) => encodeURIComponent(String(s))).join('/');
  const qs = Object.entries(query)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
  return `#/${path}${qs ? `?${qs}` : ''}`;
}

/** 底部導覽的六個分頁（GDD 2.5 主選單） */
export const TABS = ['home', 'adventure', 'team', 'cards', 'summon', 'shop'] as const;
export type TabId = (typeof TABS)[number];

/**
 * full：頂列資源＋底部導覽（主城、各分頁首頁）
 * sub：頂列含返回鍵，沒有底部導覽（子畫面）
 * bare：全螢幕（標題、戰鬥、劇情、抽卡演出）
 */
export type Chrome = 'full' | 'sub' | 'bare';

export interface Navigator {
  go(name: string, args?: (string | number)[], query?: Record<string, string | number>): void;
  replace(name: string, args?: (string | number)[], query?: Record<string, string | number>): void;
  back(): void;
}

export interface ScreenContext {
  route: Route;
  nav: Navigator;
  /** 離開畫面時要清掉的東西（計時器、事件訂閱、音樂） */
  onLeave(fn: () => void): void;
}

export interface ScreenDef {
  name: string;
  title: string;
  chrome: Chrome;
  /** 底部導覽要亮哪一格 */
  tab?: TabId;
  /** 沒有瀏覽紀錄時按返回要去的畫面 */
  parent?: string;
  render(ctx: ScreenContext): HTMLElement;
}

/** 決定返回鍵要去哪：有站內紀錄就退一步，否則回到上層畫面 */
export function backTarget(screen: ScreenDef | undefined, depth: number): 'history' | string {
  if (depth > 0) return 'history';
  return screen?.parent ?? 'home';
}

export class Router implements Navigator {
  private screens = new Map<string, ScreenDef>();
  private leaveFns: (() => void)[] = [];
  /** 站內瀏覽紀錄，用來判斷 history.back() 會不會離開遊戲 */
  private stack: string[] = [];
  private current?: ScreenDef;

  constructor(
    private mount: (screen: ScreenDef, el: HTMLElement, route: Route) => void,
    private fallback = 'home',
  ) {}

  register(...defs: ScreenDef[]): this {
    for (const d of defs) this.screens.set(d.name, d);
    return this;
  }

  has(name: string): boolean {
    return this.screens.has(name);
  }

  start(): void {
    window.addEventListener('hashchange', () => this.render());
    this.render();
  }

  go(name: string, args: (string | number)[] = [], query: Record<string, string | number> = {}): void {
    const hash = buildHash(name, args, query);
    if (hash === location.hash) return;
    this.stack.push(location.hash);
    location.hash = hash;
  }

  replace(name: string, args: (string | number)[] = [], query: Record<string, string | number> = {}): void {
    history.replaceState(null, '', buildHash(name, args, query));
    this.render();
  }

  back(): void {
    const target = backTarget(this.current, this.stack.length);
    if (target === 'history') {
      history.back();
    } else {
      this.replace(target);
    }
  }

  private render(): void {
    // 使用者按瀏覽器／手機返回鍵時，同步站內紀錄
    if (this.stack.length && this.stack[this.stack.length - 1] === location.hash) this.stack.pop();
    const route = parseHash(location.hash);
    const screen = this.screens.get(route.name) ?? this.screens.get(this.fallback)!;
    this.leaveFns.splice(0).forEach((fn) => fn());
    this.current = screen;
    const el = screen.render({ route, nav: this, onLeave: (fn) => this.leaveFns.push(fn) });
    this.mount(screen, el, route);
  }
}
