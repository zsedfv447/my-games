// 流派圖鑑（GDD 2.0）：先顯示流派說明，收集進度等卡片資料完成後再接上
import { h } from '../dom';
import { gameData } from '../../data/load';
import { panel, badge } from '../components/basic';
import type { ScreenDef } from '../router';

export const archetypesScreen: ScreenDef = {
  name: 'archetypes',
  title: '流派圖鑑',
  chrome: 'sub',
  parent: 'home',
  render() {
    return h(
      'div',
      null,
      h('p', { class: 'dim small-text', style: { margin: '0 2px' } }, '同一盤珠，不同隊伍會用完全不同的轉法。找到你喜歡的流派吧。'),
      gameData.archetypes.map((a, i) => {
        const count = gameData.cards.filter((c) => c.archetypes.some((x) => x.id === a.id)).length;
        return panel(
          null,
          h('div', { class: 'row between' }, h('h3', { style: { margin: '0' } }, `${i + 1}. ${a.name}`), badge(`${count} 張卡`, 'gold')),
          h('p', { style: { marginTop: '6px' } }, a.summary),
          h('p', { class: 'small-text' }, h('strong', null, '轉法：'), a.howToPlay),
          h('p', { class: 'small-text dim' }, h('strong', null, '弱點：'), a.weakness),
          h('p', { class: 'small-text dim' }, h('strong', null, '入門：'), a.starterPath),
        );
      }),
    );
  },
};
