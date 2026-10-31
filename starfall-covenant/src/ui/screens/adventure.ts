// 冒險地圖：主線章節、每日關卡、活動、挑戰之塔、流派試煉、練習場
import { h } from '../dom';
import { gameData } from '../../data/load';
import { RACE_NAMES } from '../art/palette';
import { badge, bar, icon, listItem, sectionTitle } from '../components/basic';
import { chapterRewardStatus, type StageContext } from '../../progression/stages';
import type { SaveData } from '../../core/types';
import { chapterProgress, nextMainStage, sideStoryProgress, stageContext } from '../stage-nav';
import { getSave } from '../state';
import { userAsset } from '../assets';
import { eventStatusText } from '../../progression/events';
import { nemesisLock, nemesisView } from '../nemesis';
import { puzzleEntrySub } from './puzzle';
import type { Navigator, ScreenDef } from '../router';
import type { IconName } from '../art/icons';
import { audio } from '../audio';
import { solvedToday } from '../../progression/puzzle';
import { openLimitedEvents } from '../event-order';
import '../flow-polish.css';

/** 冒險頁「其他」區的小卡（兩欄）；新增入口時用同一個格式 */
export interface AdventureTile {
  icon: IconName;
  title: string;
  sub: string;
  to: [string, string[]];
  /** 右上角標籤，例如 NEW */
  badge?: string;
  /** 右上角紅點（今天還沒做、限時活動開放中） */
  dot?: boolean;
  /** 還沒開放：變灰，sub 寫開放條件 */
  locked?: boolean;
}

export function adventureTile(t: AdventureTile, nav: Navigator): HTMLElement {
  return h('button', { type: 'button', class: ['adv-tile', t.locked && 'locked'], onClick: () => { audio.play('tap'); nav.go(t.to[0], t.to[1]); } },
    h('span', { class: 'adv-tile-icon' }, icon(t.icon)),
    h('strong', null, t.title),
    h('span', { class: 'adv-tile-sub' }, t.sub),
    t.badge && badge(t.badge, 'gold adv-tile-badge'),
    t.dot && !t.badge && h('span', { class: 'badge dot', 'aria-label': '有新內容' }));
}

export const adventureScreen: ScreenDef = {
  name: 'adventure',
  title: '冒險',
  chrome: 'full',
  tab: 'adventure',
  parent: 'home',
  render({ nav }) {
    const save = getSave();
    const now = Date.now();
    const ctx = stageContext(gameData.stages, gameData.events);
    const next = nextMainStage(save, ctx, now);
    const side = sideStoryProgress(save, ctx, now);
    const trialsOpen = gameData.stages.filter((s) => s.kind === 'trial' && (!s.unlockAfter || save.progress.clearedStages.includes(s.unlockAfter))).length;
    const chapters = gameData.chapters.map((c) => ({ c, p: chapterProgress(save, c.chapter, ctx, now, c.stageCount) }));
    const unlockedChapters = chapters.filter((x) => x.p.unlocked);
    const lockedChapters = chapters.filter((x) => !x.p.unlocked).map((x) => x.c);
    const limited = openLimitedEvents(gameData.events, now)[0];
    // 小卡的順序：每天會用的在前。之後的新入口（例如克星週）照同樣格式加進這個陣列
    const nemesis = nemesisTile(save, ctx, now);
    const otherTiles: AdventureTile[] = [
      { icon: 'history', title: '每日關卡', sub: '素材、進化素材、金幣關', to: ['stages', ['daily']] },
      { icon: 'event', title: '活動', sub: limited ? `${limited.name}・${eventStatusText(limited, now)}` : '活動 Boss 與兌換商店', to: ['stages', ['event']], dot: !!limited },
      { icon: 'puzzle', title: '星紋謎題', sub: puzzleEntrySub(now), to: ['puzzle', []], dot: !solvedToday(save, now) },
      ...(nemesis ? [nemesis] : []),
      { icon: 'tower', title: '挑戰之塔', sub: `不耗體力・第 ${save.progress.towerFloor} 層`, to: ['stages', ['tower']] },
      {
        icon: 'scroll', title: '外傳・灰燈港夜話',
        sub: side.open ? `劇情小章・通關 ${side.cleared}/${side.total}` : side.lock,
        to: ['stages', ['side']], badge: side.open && side.cleared < side.total ? 'NEW' : undefined,
      },
      { icon: 'constellation', title: '流派試煉', sub: `借現成隊伍體驗流派・已開放 ${trialsOpen} 關`, to: ['archetypes', []] },
      { icon: 'sword', title: '練習場', sub: '示範隊伍練轉珠，不耗體力', to: ['battle', ['practice']] },
    ];

    return h(
      'div',
      null,
      next && listItem({
        leading: icon('sword'),
        title: `繼續主線：${next.name}`,
        sub: `第 ${next.chapter} 章・體力 ${next.stamina}`,
        onClick: () => nav.go('prepare', [next.id]),
      }),
      sectionTitle('主線'),
      h(
        'div',
        { class: 'list' },
        unlockedChapters.map(({ c, p }) => h(
          'button',
          { type: 'button', class: 'chapter-card', onClick: () => nav.go('stages', [c.chapter]) },
          userAsset('backgrounds', `chapter-${c.chapter}`) && h('img', { class: 'chapter-art', src: userAsset('backgrounds', `chapter-${c.chapter}`), alt: '', loading: 'lazy' }),
          h('div', { class: 'row between' },
            h('div', null, h('div', { class: 'chapter-no' }, `第 ${c.chapter} 章`), h('div', { class: 'chapter-name' }, c.name)),
            h('div', { class: 'row', style: { gap: '4px' } }, badge(c.constellation, 'gold'), badge(RACE_NAMES[c.race]))),
          h('div', { class: 'row', style: { gap: '8px', marginTop: '8px' } },
            h('div', { style: { flex: '1' } }, bar({ value: p.cleared, max: p.total, variant: 'gold', label: `通關 ${p.cleared}/${p.total}` })),
            h('span', { class: 'stars small-text' }, `★ ${p.stars}/${p.maxStars}`)),
          chapterRewardStatus(save, c.chapter, gameData.stages, gameData.chapters) === 'claimable' && h('span', { class: 'badge dot', 'aria-label': '星章集滿，可領取章節獎勵' }),
        )),
        // 還沒開放的章節合成一列，不再各佔一整張卡
        lockedChapters.length > 0 && h('div', { class: 'chapter-locked-row' }, icon('lock'),
          h('div', null,
            h('strong', null, lockedChapters.length === 1 ? `第 ${lockedChapters[0].chapter} 章・${lockedChapters[0].name}` : `第 ${lockedChapters[0].chapter}～${lockedChapters.at(-1)!.chapter} 章`),
            h('div', { class: 'small-text faint' }, '通過上一章後開放'))),
      ),
      sectionTitle('其他'),
      h('div', { class: 'adv-tiles' }, otherTiles.map((t) => adventureTile(t, nav))),
    );
  },
};

/** 「其他」區的流派克星週小卡：本週主題、剩餘時間、推薦流派；還沒開放時寫開放條件並變灰 */
function nemesisTile(save: SaveData, ctx: StageContext, now: number): AdventureTile | null {
  const week = nemesisView(gameData.events, gameData.stages, (id) => gameData.archetypes.find((a) => a.id === id)?.name ?? id, now);
  if (!week) return null;
  const lock = nemesisLock(save, week, ctx, now);
  return {
    icon: 'trophy',
    title: `克星週・${week.event.name.replace(/^流派克星週・/, '')}`,
    sub: lock || `${week.status}・推薦 ${week.archetypes.join('、')}`,
    to: ['stages', ['nemesis']],
    locked: !!lock,
  };
}
