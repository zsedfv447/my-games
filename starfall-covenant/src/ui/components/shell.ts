// 版面骨架：頂列（資源或返回鍵）＋畫面區＋底部導覽，依畫面的 chrome 設定切換
import { h, svg, clear } from '../dom';
import { starfieldSvg } from '../art/scenery';
import { TABS, type Navigator, type Route, type ScreenDef, type TabId } from '../router';
import { getPlayer, onStateChange } from '../state';
import { audio } from '../audio';
import { icon, iconButton, resource } from './basic';
import type { IconName } from '../art/icons';
import { setOverlayHost } from './overlay';

const TAB_INFO: Record<TabId, { label: string; icon: IconName }> = {
  home: { label: '主城', icon: 'home' },
  adventure: { label: '冒險', icon: 'adventure' },
  team: { label: '隊伍', icon: 'team' },
  cards: { label: '卡片', icon: 'cards' },
  summon: { label: '召喚', icon: 'summon' },
  shop: { label: '商店', icon: 'shop' },
};

export class Shell {
  private top = h('header', { class: 'shell-top safe-top' });
  private main = h('main', { class: 'shell-main' });
  private bottom = h('nav', { class: 'shell-bottom safe-bottom', 'aria-label': '主選單' });
  private nav!: Navigator;
  private screen?: ScreenDef;

  constructor(stage: HTMLElement) {
    stage.append(svg(starfieldSvg()), this.top, this.main, this.bottom);
    setOverlayHost(stage);
    onStateChange(() => this.screen && this.renderTop(this.screen));
  }

  attach(nav: Navigator): void {
    this.nav = nav;
  }

  mount = (screen: ScreenDef, el: HTMLElement, _route: Route): void => {
    this.screen = screen;
    this.renderTop(screen);
    this.renderBottom(screen);
    el.classList.add('screen', 'screen-enter');
    if (screen.chrome === 'bare') el.classList.add('bare');
    clear(this.main);
    this.main.appendChild(el);
    el.scrollTop = 0;
  };

  private renderTop(screen: ScreenDef): void {
    clear(this.top);
    this.top.hidden = screen.chrome === 'bare';
    if (screen.chrome === 'bare') return;
    const p = getPlayer();
    const resources = [
      resource('stamina', `${p.stamina}/${p.staminaMax}`),
      resource('coin', p.coin.toLocaleString()),
      resource('gem', p.gems.toLocaleString()),
    ];
    const bar = h('div', { class: 'topbar' });
    if (screen.chrome === 'sub') {
      bar.append(
        iconButton('back', '返回', () => { audio.play('back'); this.nav.back(); }),
        h('div', { class: 'title' }, screen.title),
        ...resources.slice(1),
      );
    } else {
      bar.append(
        h('span', { class: 'badge gold' }, `Lv.${p.level}`),
        ...resources,
        h('div', { class: 'spacer' }),
        iconButton('gear', '設定', () => this.nav.go('settings')),
      );
    }
    this.top.appendChild(bar);
  }

  private renderBottom(screen: ScreenDef): void {
    clear(this.bottom);
    this.bottom.hidden = screen.chrome !== 'full';
    if (screen.chrome !== 'full') return;
    const bar = h('div', { class: 'navbar' });
    for (const tab of TABS) {
      const info = TAB_INFO[tab];
      bar.appendChild(
        h(
          'button',
          {
            type: 'button',
            class: tab === screen.tab ? 'active' : '',
            'aria-current': tab === screen.tab ? 'page' : undefined,
            // 分頁之間切換用 replace，返回鍵才不會在分頁間來回跳
            onClick: () => { if (tab !== screen.tab) { audio.play('tap'); this.nav.replace(tab); } },
          },
          icon(info.icon),
          info.label,
        ),
      );
    }
    this.bottom.appendChild(bar);
  }
}
