import { h, svg } from '../dom';
import { APP_VERSION } from '../version';
import { logoSvg } from '../art/scenery';
import { userAsset } from '../assets';
import { audio } from '../audio';
import type { ScreenDef } from '../router';

export const titleScreen: ScreenDef = {
  name: 'title',
  title: '標題',
  chrome: 'bare',
  render({ nav }) {
    audio.playBgm('title');
    const bg = userAsset('backgrounds', 'title');
    const logo = userAsset('ui', 'logo');
    const el = h(
      'div',
      null,
      bg && h('img', { src: bg, alt: '', style: { position: 'absolute', inset: '0', width: '100%', height: '100%', objectFit: 'cover', opacity: '0.7' } }),
      h(
        'div',
        { class: 'title-screen', role: 'button', 'aria-label': '點擊開始' },
        logo ? h('img', { class: 'logo', src: logo, alt: '' }) : svg(logoSvg()),
        h('h1', null, '星骸契約'),
        h('p', { class: 'en' }, 'STARFALL COVENANT'),
        h('p', { class: 'tap' }, '點擊畫面開始'),
        h('p', { class: 'ver' }, `v${APP_VERSION}・原創作品`),
      ),
    );
    el.addEventListener('click', () => {
      audio.unlock();
      audio.play('confirm');
      nav.replace('home');
    }, { once: true });
    return el;
  },
};
