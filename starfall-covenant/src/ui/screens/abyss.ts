// 星淵回廊（#/abyss）：本週星象、最高層、每層的本週首通獎勵；點可挑戰的層直接出戰（不耗體力、不帶助戰）
import { h } from '../dom';
import { gameData } from '../../data/load';
import {
  ABYSS_FLOORS, ABYSS_UNLOCK_STAGE, abyssFloor, abyssFloorReward, abyssLock, abyssOmen, abyssProgress, abyssWeeklyTotal, isAbyssOpen,
} from '../../progression/abyss';
import { formatCountdown } from '../../progression/events';
import { badge, button, emptyState, icon, listItem, panel } from '../components/basic';
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
    const rows = Array.from({ length: ABYSS_FLOORS }, (_, i) => i + 1).reverse().map((floor) => {
      const { stage } = abyssFloor(p.week, floor, gameData.enemies);
      const lock = abyssLock(save, p.week, floor, now);
      const cleared = floor <= p.best;
      const boss = floor % 5 === 0;
      const reward = abyssFloorReward(p.week, floor, gameData.cards);
      const item = listItem({
        leading: icon(boss ? 'trophy' : 'tower'),
        title: `第 ${floor} 層${boss ? '・Boss' : ''}`,
        sub: lock ? '先通過下一層' : cleared ? '本週已通過・可以再挑戰' : '不耗體力',
        trailing: h('div', { class: 'row', style: { gap: '4px' } },
          reward && firstClearChip(reward, p.claimed.includes(floor), '本週首通'),
          cleared ? badge('通過', 'gold') : !lock ? badge('挑戰') : icon('lock')),
        onClick: () => (lock ? toast('先通過下一層') : void challenge(stage.id, nav)),
      });
      if (lock) item.classList.add('dimmed');
      return item;
    });
    return h('div', null,
      panel({ gold: true },
        h('div', { class: 'row between' }, h('h2', { style: { margin: '0' } }, '星淵回廊'), badge(`最高 ${p.best} 層`, 'gold')),
        h('p', { class: 'small-text dim' }, `每週一 00:00 重置・剩 ${formatCountdown(Math.max(0, resetsAt(p.week) - now))}`),
        h('p', { class: 'small-text' }, h('strong', null, `本週星象「${omen.name}」`), `：${omen.text}`),
        h('p', { class: 'small-text dim' }, `每層第一次通過有獎勵，一週最多：${totalText}。不耗體力，不帶助戰。`),
        // 樓層由高到低排，下一層在最下面；這裡直接給「挑戰下一層」
        p.best < ABYSS_FLOORS
          ? button(`挑戰第 ${p.best + 1} 層`, { variant: 'primary', block: true, icon: 'sword', onClick: () => void challenge(abyssFloor(p.week, p.best + 1, gameData.enemies).stage.id, nav) })
          : h('p', { class: 'gold-text' }, '本週已登頂！下週一重新開始。')),
      h('div', { class: 'list' }, rows),
    );
  },
};
