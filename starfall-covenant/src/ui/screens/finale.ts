// 穹頂篇片尾卡：第 7 章結尾劇情後第一次自動播放，之後可以從劇情回顧重看（#/finale?next=<之後要去的畫面>）
import { h, svg } from '../dom';
import { gameData } from '../../data/load';
import { starfieldSvg } from '../art/scenery';
import { button } from '../components/basic';
import { finaleRecap, FINALE_ID } from '../finale-plan';
import { getSave, growth } from '../state';
import type { ScreenDef } from '../router';
import { markStorySeen } from './story';
import '../finale.css';

export const finaleScreen: ScreenDef = {
  name: 'finale',
  title: '穹頂篇 完',
  chrome: 'bare',
  parent: 'stories',
  render({ route, nav }) {
    const recap = finaleRecap(getSave(), gameData.stages, (id) => growth.card(id)?.name);
    markStorySeen(FINALE_ID);
    const next = route.query.next;
    const leave = () => (!next || next === 'back' ? nav.back() : nav.backTo(next));
    return h('div', { class: 'finale' },
      svg(starfieldSvg()),
      h('div', { class: 'finale-card' },
        h('h1', { class: 'finale-title' }, recap.title),
        h('div', { class: 'finale-lines' }, recap.lines.map((t, i) => h('p', { style: { animationDelay: `${600 + i * 500}ms` } }, t))),
        h('p', { class: 'finale-closing', style: { animationDelay: `${900 + recap.lines.length * 500}ms` } }, recap.closing),
        h('div', { class: 'finale-actions', style: { animationDelay: `${1400 + recap.lines.length * 500}ms` } },
          button('繼續', { variant: 'primary', onClick: leave }))));
  },
};
