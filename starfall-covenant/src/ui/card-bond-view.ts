// 卡片詳情頁的「羈絆」區塊：場數、下一個門檻、已解鎖的小劇場（點了重播）。沒有小劇場的角色不顯示
import type { CardDef } from '../core/types';
import { CARD_BOND_TIERS, cardBondDef, cardBondLevel, cardBondPoints, nextCardBondTier } from '../progression/card-bond';
import { nextBondTitle } from '../progression/titles';
import { audio } from './audio';
import { playBondStory } from './bond-story';
import { badge, icon, listItem, panel } from './components/basic';
import { h } from './dom';
import { getSave, growth } from './state';

/** 小劇場全部解鎖後的長期目標：下一個羈絆稱號（progression/titles.ts） */
function afterCap(points: number): string {
  const goal = nextBondTitle('cardBond', points);
  return goal ? `小劇場全部解鎖・下一個目標：稱號「${goal.title.name}」（${goal.atLeast} 場）` : '小劇場與羈絆稱號全部解鎖';
}

export function cardBondPanel(def: CardDef): HTMLElement | null {
  const family = growth.family(def.id);
  const bond = cardBondDef(family);
  if (!bond) return null;
  const points = cardBondPoints(getSave(), family);
  const level = cardBondLevel(points);
  const next = nextCardBondTier(points);
  return panel({ title: '羈絆' },
    h('div', { class: 'row between' },
      h('span', null, h('span', { class: 'helper-bond-heart' }, '♥'), ` 一起通關 ${points} 場`),
      h('span', { class: 'small-text dim' }, next === null ? afterCap(points) : `下一段小劇場：${next} 場`)),
    h('div', { class: 'list', style: { marginTop: '8px' } }, bond.scenes.map((scene, i) => i < level
      ? listItem({ leading: icon('book'), title: scene.title, sub: `小劇場 ${i + 1}`, onClick: () => { audio.play('confirm'); playBondStory(scene.lines); } })
      : listItem({ leading: icon('lock'), title: '？？？', sub: `一起通關 ${CARD_BOND_TIERS[i]} 場後解鎖`, trailing: badge('未解鎖') }))));
}
