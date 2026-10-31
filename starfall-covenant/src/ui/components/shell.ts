// 版面骨架：頂列（資源或返回鍵）＋畫面區＋底部導覽，依畫面的 chrome 設定切換
import { h, svg, clear } from '../dom';
import { starfieldSvg } from '../art/scenery';
import { TABS, type Navigator, type Route, type ScreenDef, type TabId } from '../router';
import { getPlayer, getSave, onStateChange } from '../state';
import { gameData } from '../../data/load';
import { msUntilFullStamina } from '../../progression/stamina';
import { staminaFullText, staminaNextText } from '../countdown';
import { button } from './basic';
import { openDialog } from './overlay';
import '../convenience.css';
import { audio } from '../audio';
import { iconButton, resource } from './basic';
import { ICONS, type IconName } from '../art/icons';
import { setOverlayHost } from './overlay';
import { LABEL } from '../wording';
import { homeBadges } from '../economy';

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
  private staminaTimer?: HTMLElement;
  private shownStamina = -1;

  constructor(private stage: HTMLElement) {
    stage.append(svg(starfieldSvg()), this.top, this.main, this.bottom);
    // 舞台本身不該捲動（不支援 overflow: clip 的瀏覽器在 focus 時仍可能被捲走），被捲了就拉回來
    stage.addEventListener('scroll', () => {
      if (stage.scrollTop || stage.scrollLeft) stage.scrollTop = stage.scrollLeft = 0;
    });
    setOverlayHost(stage);
    onStateChange(() => {
      if (!this.screen) return;
      this.renderTop(this.screen);
      // 領完獎勵後，底部「冒險」分頁的紅點也要跟著更新
      this.renderBottom(this.screen);
    });
    // 體力回復倒數：每秒更新；回復了一點就重畫資源列
    window.setInterval(() => this.tickStamina(), 1000);
  }

  private tickStamina(): void {
    if (!this.screen || !this.staminaTimer) return;
    const p = getPlayer();
    if (p.stamina !== this.shownStamina) return this.renderTop(this.screen);
    const text = staminaNextText(p.staminaNextMs);
    this.staminaTimer.textContent = text ?? '';
    this.staminaTimer.hidden = !text;
  }

  private showStaminaInfo(): void {
    const p = getPlayer();
    const full = msUntilFullStamina(getSave(), gameData.config, Date.now());
    const next = staminaNextText(p.staminaNextMs);
    const dlg = openDialog('體力', h('div', { class: 'list' },
      h('div', { class: 'row between' }, h('span', null, '目前體力'), h('strong', null, `${p.stamina} / ${p.staminaMax}`)),
      next && h('div', { class: 'row between' }, h('span', null, '下一點'), h('strong', null, next.replace('+1 ', ''))),
      h('div', { class: 'row between' }, h('span', null, staminaFullText(full))),
      h('p', { class: 'small-text dim', style: { margin: '0' } }, `每 ${gameData.config.stamina.regenMinutes} 分鐘回復 1 點，離線也會回復。`)), [
      button(LABEL.close, { variant: 'ghost', sound: 'back', onClick: () => dlg.close() }),
      button('去商店補充', { variant: 'primary', icon: 'shop', onClick: () => { dlg.close(); this.nav.go('shop'); } }),
    ]);
  }

  attach(nav: Navigator): void {
    this.nav = nav;
  }

  mount = (screen: ScreenDef, el: HTMLElement, _route: Route): void => {
    this.screen = screen;
    if (screen.chrome !== 'bare') audio.playBgm(screen.name.startsWith('summon') ? 'summon' : 'home');
    this.renderTop(screen);
    this.renderBottom(screen);
    el.classList.add('screen', 'screen-enter');
    el.dataset.screen = screen.name;
    if (screen.chrome === 'bare') el.classList.add('bare');
    clear(this.main);
    this.main.appendChild(el);
    el.scrollTop = 0;
    this.stage.scrollTop = 0;
  };

  private renderTop(screen: ScreenDef): void {
    clear(this.top);
    this.top.hidden = screen.chrome === 'bare';
    if (screen.chrome === 'bare') return;
    const p = getPlayer();
    this.shownStamina = p.stamina;
    const next = staminaNextText(p.staminaNextMs);
    this.staminaTimer = h('small', { class: 'stamina-timer', hidden: !next }, next ?? '');
    const stamina = h('button', { type: 'button', class: 'stamina-button', 'aria-label': '體力回復時間', onClick: () => this.showStaminaInfo() },
      resource('stamina', `${p.stamina}/${p.staminaMax}`), this.staminaTimer);
    const resources = [
      stamina,
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
        h('div', { class: 'player-rank' }, h('small', null, 'RANK'), h('strong', null, p.level)),
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
    const adventureDot = homeBadges(getSave(), Date.now()).adventure;
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
          svg(ICONS[info.icon]),
          info.label,
          // 冒險頁上有任何紅點（可領的獎勵、新開放的內容）就在分頁上亮一顆
          tab === 'adventure' && adventureDot && h('span', { class: 'badge dot', 'aria-label': '冒險頁有可領取或新開放的內容' }),
        ),
      );
    }
    this.bottom.appendChild(bar);
  }
}
