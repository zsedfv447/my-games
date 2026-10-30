// 介面元件展示：給總監和美術檢查主題、卡框、珠子與敵人的樣子
import { h, svg } from '../dom';
import { ATTRIBUTES, ORB_TYPES, type Rarity } from '../../core/types';
import { orbSvg } from '../art/orbs';
import { enemySvg } from '../art/enemy';
import { ATTRIBUTE_NAMES } from '../art/palette';
import type { CardFaceInput } from '../art/card-face';
import { badge, bar, button, panel, sectionTitle, tabs } from '../components/basic';
import { cardPortrait, cardThumb, emptySlot } from '../components/card-thumb';
import { confirmDialog, toast } from '../components/overlay';
import type { ScreenDef } from '../router';

const RACES_CYCLE = ['beast', 'dragon', 'machina', 'sylph', 'nether'] as const;

/** 展示用假卡（不是正式角色） */
function demoCard(i: number, rarity: Rarity): CardFaceInput {
  const attribute = ATTRIBUTES[i % 5];
  return { id: `demo-${i}-${rarity}`, name: `示範・${ATTRIBUTE_NAMES[attribute]}${rarity}`, attribute, race: RACES_CYCLE[i % 5], rarity };
}

export const galleryScreen: ScreenDef = {
  name: 'gallery',
  title: '介面元件展示',
  chrome: 'sub',
  parent: 'settings',
  render() {
    const portraitHost = h('div');
    const showPortrait = (rarity: Rarity, i: number) => {
      portraitHost.replaceChildren(cardPortrait(demoCard(i, rarity)));
    };
    showPortrait(5, 0);

    return h(
      'div',
      null,
      sectionTitle('星紋珠（含色弱符號）'),
      panel(
        null,
        h('div', { class: 'orb-row' }, ORB_TYPES.map((o) => svg(orbSvg(o)))),
        h('p', { class: 'small-text dim', style: { margin: '6px 0' } }, '強化珠／鎖定珠／毒珠／隱藏珠'),
        h('div', { class: 'orb-row' }, svg(orbSvg('fire', { enhanced: true })), svg(orbSvg('water', { enhanced: true })), svg(orbSvg('wood', { locked: true })), svg(orbSvg('poison')), svg(orbSvg('hidden')), svg(orbSvg('heart', { enhanced: true }))),
      ),
      sectionTitle('卡框（1★–6★）'),
      panel(
        null,
        h('div', { class: 'grid-3' }, ([1, 2, 3, 4, 5, 6] as Rarity[]).map((r, i) => cardThumb(demoCard(i, r), { level: r * 10, size: 100, locked: r === 6, onClick: () => showPortrait(r, i) }))),
        h('p', { class: 'small-text dim', style: { margin: '8px 0' } }, '點頭像看立繪版本'),
        portraitHost,
      ),
      sectionTitle('隊伍列'),
      panel(null, h('div', { class: 'grid-5' }, [0, 1, 2, 3].map((i) => cardThumb(demoCard(i, 4), { level: 50 })), emptySlot())),
      sectionTitle('敵人'),
      panel(
        null,
        h('div', { class: 'enemy-row' }, ATTRIBUTES.slice(0, 3).map((a, i) => svg(enemySvg({ id: `demo-e${i}`, name: '示範敵人', attribute: a })))),
        h('div', { class: 'enemy-row' }, svg(enemySvg({ id: 'demo-boss', name: '示範 Boss', attribute: 'dark', boss: true })), svg(enemySvg({ id: 'demo-e9', name: '示範敵人', attribute: 'light' }))),
      ),
      sectionTitle('進度條'),
      panel(
        null,
        h('div', { class: 'list' },
          bar({ value: 8200, max: 10000, variant: 'hp', label: true, previous: 9400 }),
          bar({ value: 4000, max: 10000, variant: 'hp', label: true }),
          bar({ value: 1500, max: 10000, variant: 'hp', label: true }),
          bar({ value: 320, max: 1000, variant: 'exp', label: 'EXP 32%' }),
          bar({ value: 24, max: 30, variant: 'gold', label: '體力 24/30' }),
        ),
      ),
      sectionTitle('按鈕與標籤'),
      panel(
        null,
        h('div', { class: 'list' },
          tabs([{ id: 'a', label: '全部' }, { id: 'b', label: '焰' }, { id: 'c', label: '潮' }], 'a', () => {}),
          h('div', { class: 'row wrap' }, button('主要', { variant: 'primary' }), button('一般'), button('危險', { variant: 'danger' }), button('次要', { variant: 'ghost' })),
          h('div', { class: 'row wrap' },
            button('十連召喚', { variant: 'primary', cost: { kind: 'gem', amount: 50 } }),
            button('提示訊息', { small: true, onClick: () => toast('這是一則提示訊息') }),
            button('確認視窗', { small: true, onClick: () => void confirmDialog('確認販賣', '要販賣這 3 張卡片嗎？').then((ok) => toast(ok ? '已確定' : '已取消')) }),
          ),
          h('div', { class: 'row wrap' }, ATTRIBUTES.map((a) => badge(ATTRIBUTE_NAMES[a], `attr-${a}`)), badge('NEW', 'gold')),
        ),
      ),
    );
  },
};
