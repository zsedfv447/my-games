// 商店：星晶（補體力、擴背包、金幣袋）、金幣（素材每日／每週限購）、活動兌換
import type { ShopItemDef } from '../../core/types';
import { gameData } from '../../data/load';
import { addQuestCounters } from '../../progression/quests';
import { buyItem, remainingPurchases } from '../../progression/shop';
import { audio } from '../audio';
import { button, emptyState, icon, resource, resourceIcon, tabs } from '../components/basic';
import { confirmDialog, toast } from '../components/overlay';
import { rewardArt, screenBanner } from '../components/rewards';
import { eventBanner } from '../components/event-banner';
import { clear, h } from '../dom';
import { limitText, SHOP_FAIL_TEXT, shopItemDetail, shopPrice, shopTab, tokenName, type ShopTab } from '../economy';
import type { ScreenDef } from '../router';
import { commit, getSave } from '../state';

const TABS: { id: ShopTab; label: string }[] = [
  { id: 'gems', label: '星晶' },
  { id: 'coin', label: '金幣' },
  { id: 'event', label: '活動兌換' },
];

/** 商品圖：特殊商品用 assets/user/ui 的圖，卡片用卡面 */
const ITEM_ART: Record<string, string> = {
  'gem-refill': 'pack-shop-refill',
  'gem-expand': 'pack-shop-expand',
  'gem-coin': 'pack-shop-coin',
  'ev-gems': 'pack-shop-gems',
};

let activeTab: ShopTab = 'gems';

/** 購買並存檔；成功回傳 true */
export function purchase(item: ShopItemDef): boolean {
  const now = Date.now();
  const r = buyItem(getSave(), item, gameData.config, now, gameData.events);
  if (!r.ok) {
    toast(SHOP_FAIL_TEXT[r.reason]);
    return false;
  }
  commit(addQuestCounters(r.save, { shopPurchase: 1 }, gameData.quests, now));
  audio.play('confirm');
  toast(`已購買「${item.name}」`);
  return true;
}

function itemCard(item: ShopItemDef, refresh: () => void): HTMLElement {
  const save = getSave();
  const now = Date.now();
  const left = remainingPurchases(save, item, now, gameData.events);
  const price = shopPrice(item);
  const soldOut = left <= 0;
  const special = 'type' in item.reward ? item.reward.type : null;
  const reward = 'type' in item.reward ? {} : item.reward;
  return h('div', { class: ['shop-item', soldOut && 'sold-out'] },
    rewardArt(reward, ITEM_ART[item.id], special === 'refillStamina' ? resourceIcon('stamina') : special === 'expandInventory' ? icon('cards') : undefined),
    h('div', { class: 'shop-item-copy' },
      h('strong', null, item.name),
      h('small', null, shopItemDetail(item)),
      h('small', { class: 'shop-limit' }, limitText(item, left))),
    button(soldOut ? '售罄' : '購買', {
      small: true,
      variant: 'primary',
      disabled: soldOut,
      cost: { kind: price.icon, amount: price.amount },
      sound: 'tap',
      onClick: async () => {
        const unit = price.token ? tokenName(price.token) : price.icon === 'gem' ? '星晶' : '金幣';
        if (!(await confirmDialog('確認購買', `花費 ${unit} ${price.amount.toLocaleString()} 購買「${item.name}」？`, '購買'))) return;
        purchase(item);
        refresh();
      },
    }));
}

export const shopScreen: ScreenDef = {
  name: 'shop',
  title: '商店',
  chrome: 'full',
  tab: 'shop',
  render({ route, nav, onLeave }) {
    if (TABS.some((t) => t.id === route.args[0])) activeTab = route.args[0] as ShopTab;
    // 兌換分頁依活動分組：活動橫幅（倒數）→ 該活動代幣持有數 → 用該代幣標價的商品
    const banners = new Map(gameData.events.filter((e) => e.token).map((e) => [e.id, eventBanner(e, { nav, onLeave, showShop: false })]));
    const list = h('div', { class: 'shop-list' });
    const refresh = () => {
      clear(list);
      const save = getSave();
      const items = gameData.shop.filter((i) => shopTab(i) === activeTab);
      if (!items.length) list.append(emptyState('shop', '目前沒有商品'));
      if (activeTab !== 'event') {
        list.append(...items.map((i) => itemCard(i, refresh)));
        return;
      }
      for (const e of gameData.events) {
        const own = items.filter((i) => e.token && i.price.tokens?.[e.token] !== undefined);
        if (!own.length) continue;
        list.append(banners.get(e.id)!, h('div', { class: 'shop-wallet' }, resource('token', `${tokenName(e.token!)} ${(save.player.tokens[e.token!] ?? 0).toLocaleString()}`)));
        list.append(...own.map((i) => itemCard(i, refresh)));
      }
    };
    refresh();
    return h('div', { class: 'economy-screen' },
      screenBanner('shop-banner', '星骸商會', '每日限購於午夜 00:00 重置'),
      tabs(TABS, activeTab, (id) => { activeTab = id; refresh(); }),
      list);
  },
};
