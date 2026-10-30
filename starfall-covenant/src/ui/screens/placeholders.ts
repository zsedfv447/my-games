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
  { name: 'enhance', title: '強化', chrome: 'sub', parent: 'cards', icon: 'cards', waitsFor: '強化（growth）' },
  { name: 'evolve', title: '進化', chrome: 'sub', parent: 'cards', icon: 'cards', waitsFor: '進化（growth）' },
  { name: 'shop', title: '商店', chrome: 'full', tab: 'shop', parent: 'home', icon: 'shop', waitsFor: '商店資料（progression）' },
  { name: 'login-bonus', title: '每日登入', chrome: 'sub', parent: 'home', icon: 'gift', waitsFor: '登入獎勵（progression）' },
  { name: 'quests', title: '任務', chrome: 'sub', parent: 'home', icon: 'quest', waitsFor: '任務計數（progression）' },
  { name: 'achievements', title: '成就', chrome: 'sub', parent: 'home', icon: 'trophy', waitsFor: '成就（progression）' },
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
