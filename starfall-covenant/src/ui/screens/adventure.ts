import { h } from '../dom';
import { gameData } from '../../data/load';
import { emptyState, icon, listItem, sectionTitle } from '../components/basic';
import type { ScreenDef } from '../router';

export const adventureScreen: ScreenDef = {
  name: 'adventure',
  title: '冒險',
  chrome: 'full',
  tab: 'adventure',
  parent: 'home',
  render({ nav }) {
    const chapters = [...new Set(gameData.stages.filter((s) => s.kind === 'main').map((s) => s.chapter ?? 1))].sort((a, b) => a - b);
    return h(
      'div',
      null,
      sectionTitle('主線'),
      chapters.length
        ? h('div', { class: 'list' }, chapters.map((c) => listItem({ leading: icon('adventure'), title: `第 ${c} 章`, onClick: () => nav.go('stages', [c]) })))
        : emptyState('adventure', '主線關卡準備中', '關卡資料完成後會出現在這裡'),
      sectionTitle('其他'),
      h(
        'div',
        { class: 'list' },
        listItem({ leading: icon('history'), title: '每日關卡', sub: '素材、進化素材、金幣關每日輪替', onClick: () => nav.go('daily') }),
        listItem({ leading: icon('event'), title: '限時活動', sub: '活動 Boss 與兌換商店', onClick: () => nav.go('event') }),
        listItem({ leading: icon('tower'), title: '挑戰之塔', sub: '不耗體力，共 30 層', onClick: () => nav.go('tower') }),
      ),
    );
  },
};
