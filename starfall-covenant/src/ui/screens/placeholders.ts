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
  { name: 'stages', title: '關卡列表', chrome: 'sub', parent: 'adventure', icon: 'adventure', waitsFor: '關卡資料（progression）' },
  { name: 'helper', title: '選擇助戰', chrome: 'sub', parent: 'adventure', icon: 'team', waitsFor: 'NPC 助戰名單（progression）' },
  { name: 'prepare', title: '出戰確認', chrome: 'sub', parent: 'adventure', icon: 'sword', waitsFor: '關卡情報與隊伍（progression、battle）' },
  { name: 'battle', title: '戰鬥', chrome: 'bare', parent: 'adventure', icon: 'sword', waitsFor: '戰鬥狀態機與盤面繪製（battle）' },
  { name: 'result', title: '結算', chrome: 'bare', parent: 'adventure', icon: 'trophy', waitsFor: '戰鬥結算（battle、progression）' },
  { name: 'daily', title: '每日關卡', chrome: 'sub', parent: 'adventure', icon: 'history', waitsFor: '每日關卡資料（progression）' },
  { name: 'event', title: '限時活動', chrome: 'sub', parent: 'adventure', icon: 'event', waitsFor: '活動資料與兌換商店（progression）' },
  { name: 'tower', title: '挑戰之塔', chrome: 'sub', parent: 'adventure', icon: 'tower', waitsFor: '塔樓層資料（progression）' },
  { name: 'team', title: '隊伍編成', chrome: 'full', tab: 'team', parent: 'home', icon: 'team', waitsFor: '存檔與卡片資料（save、growth）' },
  { name: 'cards', title: '卡片背包', chrome: 'full', tab: 'cards', parent: 'home', icon: 'cards', waitsFor: '背包（growth）' },
  { name: 'card', title: '卡片詳情', chrome: 'sub', parent: 'cards', icon: 'cards', waitsFor: '卡片資料（growth）' },
  { name: 'enhance', title: '強化', chrome: 'sub', parent: 'cards', icon: 'cards', waitsFor: '強化（growth）' },
  { name: 'evolve', title: '進化', chrome: 'sub', parent: 'cards', icon: 'cards', waitsFor: '進化（growth）' },
  { name: 'summon', title: '召喚', chrome: 'full', tab: 'summon', parent: 'home', icon: 'summon', waitsFor: '卡池與召喚（progression）' },
  { name: 'summon-rates', title: '機率說明', chrome: 'sub', parent: 'summon', icon: 'summon', waitsFor: '卡池資料（progression）' },
  { name: 'summon-history', title: '召喚紀錄', chrome: 'sub', parent: 'summon', icon: 'history', waitsFor: '召喚紀錄（progression）' },
  { name: 'shop', title: '商店', chrome: 'full', tab: 'shop', parent: 'home', icon: 'shop', waitsFor: '商店資料（progression）' },
  { name: 'login-bonus', title: '每日登入', chrome: 'sub', parent: 'home', icon: 'gift', waitsFor: '登入獎勵（progression）' },
  { name: 'quests', title: '任務', chrome: 'sub', parent: 'home', icon: 'quest', waitsFor: '任務計數（progression）' },
  { name: 'achievements', title: '成就', chrome: 'sub', parent: 'home', icon: 'trophy', waitsFor: '成就（progression）' },
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
