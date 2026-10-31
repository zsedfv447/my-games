// 星淵回廊（#/abyss）：本週星象、最高層、每層的本週首通獎勵；點可挑戰的層直接出戰（不耗體力、不帶助戰）
import { h } from '../dom';
import { userAsset } from '../assets';
import { gameData } from '../../data/load';
import {
  ABYSS_FLOORS, ABYSS_UNLOCK_STAGE, abyssFloor, abyssFloorReward, abyssOmen, abyssProgress, abyssRewardProgress, abyssWeeklyTotal, isAbyssOpen,
} from '../../progression/abyss';
import { formatCountdown } from '../../progression/events';
import { badge, bar, button, emptyState, icon, listItem, panel } from '../components/basic';
import { firstClearChip } from '../components/reward-reveal';
import { toast } from '../components/overlay';
import { armBattle, confirmNewBattle } from '../battle-session';
import { getSave } from '../state';
import type { Navigator, ScreenDef } from '../router';

/** 每週一 00:00（裝置當地時間）重置：週鍵是本週一的日期 */
function resetsAt(week: string): number {
  const [y, m, d] = week.split('-').map(Number);
  return new Date(y, m - 1, d + 7).getTime();
}

async function challenge(stageId: string, nav: Navigator): Promise<void> {
  const check = await confirmNewBattle(stageId);
  if (check === 'cancel') return;
  if (check === 'start') armBattle(stageId);
  nav.go('battle', [stageId]);
}

export const abyssScreen: ScreenDef = {
  name: 'abyss',
  title: '星淵回廊',
  chrome: 'sub',
  parent: 'adventure',
  render({ nav }) {
    const save = getSave();
    if (!isAbyssOpen(save)) return h('div', null, emptyState('tower', '星淵回廊尚未開放', `通過主線「${gameData.stages.find((s) => s.id === ABYSS_UNLOCK_STAGE)?.name ?? ABYSS_UNLOCK_STAGE}」後開放。`));
    const now = Date.now();
    const p = abyssProgress(save, now);
    const omen = abyssOmen(p.week);
    const total = abyssWeeklyTotal(p.week, gameData.cards);
    const cardName = (id: string) => gameData.cards.find((c) => c.id === id)?.name ?? id;
    const totalText = [`星晶 ${total.gems}`, ...Object.entries(total.cards).map(([id, n]) => `${cardName(id)} ×${n}`)].join('、');
    const next = p.best + 1;
    const endless = next > ABYSS_FLOORS;
    const rewards = abyssRewardProgress(p.week, p.claimed);
    /** 一層的列：已通過可以再挑戰；next 是目前要挑戰的層 */
    const floorRow = (floor: number) => {
      const boss = floor % 5 === 0;
      const reward = abyssFloorReward(p.week, floor, gameData.cards);
      const cleared = floor <= p.best;
      return listItem({
        leading: icon(boss ? 'trophy' : 'tower'),
        title: `第 ${floor} 層${boss ? '・Boss' : ''}${floor > ABYSS_FLOORS ? '・無盡' : ''}`,
        sub: cleared ? '本週已通過・可以再挑戰' : floor > ABYSS_FLOORS ? '無盡層：不給獎勵，只記最高層' : '不耗體力',
        trailing: h('div', { class: 'row', style: { gap: '4px' } },
          reward && firstClearChip(reward, p.claimed.includes(floor), '本週首通'),
          cleared ? badge('通過', 'gold') : badge('挑戰')),
        onClick: () => void challenge(abyssFloor(p.week, floor, gameData.enemies).stage.id, nav),
      });
    };
    // 未開放的層收成一列（「第 N+1～30 層」），鎖定提示是「先通過第 N 層」
    const lockedRow = !endless && next < ABYSS_FLOORS && listItem({
      leading: icon('lock'),
      title: `第 ${next + 1}～${ABYSS_FLOORS} 層`,
      sub: `先通過第 ${next} 層・之後還有無盡層`,
      trailing: icon('lock'),
      onClick: () => toast(`先通過第 ${next} 層`),
    });
    if (lockedRow) lockedRow.classList.add('dimmed');
    // 已通過的層也收合，點了才展開（由高到低）
    const clearedList = h('div', { class: 'list', hidden: true });
    const clearedRow = p.best > 0 && listItem({
      leading: icon('history'),
      title: `已通過 第 1～${p.best} 層`,
      sub: '點一下展開，可以再挑戰',
      onClick: () => {
        clearedList.hidden = !clearedList.hidden;
        if (!clearedList.childElementCount) clearedList.append(...Array.from({ length: p.best }, (_, i) => floorRow(p.best - i)));
      },
    });
    return h('div', { class: 'scene-abyss' },
      h('div', { class: 'scene-art-banner' }, h('img', { src: userAsset('backgrounds', 'pack-abyss'), alt: '', loading: 'lazy' })),
      panel({ gold: true },
        h('div', { class: 'row between' }, h('h2', { style: { margin: '0' } }, '星淵回廊'),
          badge(endless ? `本週 ${ABYSS_FLOORS}/${ABYSS_FLOORS}・無盡 ${p.best} 層` : `本週 ${p.best}/${ABYSS_FLOORS} 層`, 'gold')),
        h('div', { style: { margin: '8px 0 4px' } }, bar({ value: rewards.got, max: rewards.total, variant: 'gold', label: `本週獎勵 ${rewards.got}/${rewards.total}` })),
        h('p', { class: 'small-text dim' }, `歷來最高 ${p.allTimeBest} 層・每週一 00:00 重置（剩 ${formatCountdown(Math.max(0, resetsAt(p.week) - now))}）`),
        button(endless ? `挑戰第 ${next} 層（無盡）` : `挑戰第 ${next} 層`, { variant: 'primary', block: true, icon: 'sword', onClick: () => void challenge(abyssFloor(p.week, next, gameData.enemies).stage.id, nav) }),
        h('p', { class: 'small-text', style: { marginTop: '8px' } }, h('strong', null, `本週星象「${omen.name}」`), `：${omen.text}`),
        h('p', { class: 'small-text dim' }, `第 1～${ABYSS_FLOORS} 層第一次通過有獎勵，一週最多：${totalText}。第 ${ABYSS_FLOORS} 層之後是無盡層，不給獎勵，只記最高層。不耗體力，不帶助戰。`)),
      h('div', { class: 'list' }, floorRow(next), lockedRow, clearedRow),
      clearedList,
    );
  },
};
