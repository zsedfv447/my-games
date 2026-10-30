import { h } from '../dom';
import { sceneBackdrop } from '../backdrop';
import { audio } from '../audio';
import type { IconName } from '../art/icons';
import { button, icon } from '../components/basic';
import type { ScreenDef } from '../router';

const SHORTCUTS: { label: string; icon: IconName; to: string }[] = [
  { label: '任務', icon: 'quest', to: 'quests' },
  { label: '成就', icon: 'trophy', to: 'achievements' },
  { label: '圖鑑', icon: 'book', to: 'collection' },
  { label: '流派圖鑑', icon: 'constellation', to: 'archetypes' },
  { label: '每日登入', icon: 'gift', to: 'login-bonus' },
  { label: '活動', icon: 'event', to: 'event' },
  { label: '挑戰之塔', icon: 'tower', to: 'tower' },
  { label: '劇情回顧', icon: 'scroll', to: 'stories' },
];

export const homeScreen: ScreenDef = {
  name: 'home',
  title: '主城',
  chrome: 'full',
  tab: 'home',
  render({ nav }) {
    audio.playBgm('home');
    return h(
      'div',
      { class: 'home' },
      sceneBackdrop('home'),
      h(
        'div',
        { class: 'home-hero' },
        h('div', { class: 'caption' }, h('div', { class: 'place' }, '灰燈港'), h('div', { class: 'small-text dim' }, '見習契印師的起點')),
      ),
      button('出發冒險', { variant: 'primary', block: true, icon: 'sword', onClick: () => nav.go('adventure') }),
      h(
        'div',
        { class: 'home-tiles' },
        SHORTCUTS.map((s) => h('button', { type: 'button', class: 'tile', onClick: () => { audio.play('tap'); nav.go(s.to); } }, icon(s.icon), s.label)),
      ),
    );
  },
};
