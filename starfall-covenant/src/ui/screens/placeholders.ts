// 尚未串接的畫面：路由先建好，等各系統的公開函式完成後逐一換成正式畫面
import { h } from '../dom';
import { button, emptyState } from '../components/basic';
import type { IconName } from '../art/icons';
import type { Chrome, ScreenDef, TabId } from '../router';

interface Stub {
  name: string;
  title: string;
  chrome: Chrome;
  tab?: TabId;
  parent?: string;
  icon: IconName;
  /** 等待哪個模組 */
  waitsFor: string;
}

const STUBS: Stub[] = [
  { name: 'helper', title: '選擇助戰', chrome: 'sub', parent: 'adventure', icon: 'team', waitsFor: 'NPC 助戰名單（progression）' },
  { name: 'collection', title: '圖鑑', chrome: 'sub', parent: 'home', icon: 'book', waitsFor: '圖鑑（growth）' },
];

function stubScreen(s: Stub): ScreenDef {
  return {
    name: s.name,
    title: s.title,
    chrome: s.chrome,
    tab: s.tab,
    parent: s.parent,
    render({ nav }) {
      return h(
        'div',
        { style: s.chrome === 'bare' ? { justifyContent: 'center', padding: '24px' } : undefined },
        emptyState('construction', `${s.title}・建置中`, `等待：${s.waitsFor}`),
        s.chrome === 'bare' && button('返回', { block: true, sound: 'back', onClick: () => nav.back() }),
      );
    },
  };
}

export const placeholderScreens: ScreenDef[] = STUBS.map(stubScreen);
