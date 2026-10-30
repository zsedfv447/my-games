// 冒險地圖：主線章節、每日關卡、活動、挑戰之塔、流派試煉、練習場
import { h } from '../dom';
import { gameData } from '../../data/load';
import { RACE_NAMES } from '../art/palette';
import { badge, bar, icon, listItem, sectionTitle } from '../components/basic';
import { chapterRewardStatus } from '../../progression/stages';
import { chapterProgress, nextMainStage, sideStoryProgress, stageContext } from '../stage-nav';
import { getSave } from '../state';
import { userAsset } from '../assets';
import { eventStatusText } from '../../progression/events';
import { nemesisView } from '../nemesis';
import { puzzleEntrySub } from './puzzle';
import type { Navigator, ScreenDef } from '../router';

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
        gameData.chapters.map((c) => {
          const p = chapterProgress(save, c.chapter, ctx, now, c.stageCount);
          return h(
            'button',
            { type: 'button', class: ['chapter-card', !p.unlocked && 'locked'], disabled: !p.unlocked, onClick: () => nav.go('stages', [c.chapter]) },
            userAsset('backgrounds', `chapter-${c.chapter}`) && h('img', { class: 'chapter-art', src: userAsset('backgrounds', `chapter-${c.chapter}`), alt: '', loading: 'lazy' }),
            h('div', { class: 'row between' },
              h('div', null, h('div', { class: 'chapter-no' }, `第 ${c.chapter} 章`), h('div', { class: 'chapter-name' }, c.name)),
              h('div', { class: 'row', style: { gap: '4px' } }, badge(c.constellation, 'gold'), badge(RACE_NAMES[c.race]))),
            p.unlocked
              ? h('div', { class: 'row', style: { gap: '8px', marginTop: '8px' } },
                h('div', { style: { flex: '1' } }, bar({ value: p.cleared, max: p.total, variant: 'gold', label: `通關 ${p.cleared}/${p.total}` })),
                h('span', { class: 'stars small-text' }, `★ ${p.stars}/${p.maxStars}`))
              : h('div', { class: 'small-text faint', style: { marginTop: '6px' } }, '通過上一章後開放'),
            chapterRewardStatus(save, c.chapter, gameData.stages, gameData.chapters) === 'claimable' && h('span', { class: 'badge dot', 'aria-label': '星章集滿，可領取章節獎勵' }),
          );
        }),
      ),
      sectionTitle('其他'),
      h(
        'div',
        { class: 'list' },
        listItem({ leading: icon('history'), title: '每日關卡', sub: '素材、進化素材、金幣關每日輪替', onClick: () => nav.go('stages', ['daily']) }),
        listItem({ leading: icon('event'), title: '限時活動', sub: gameData.events.filter((e) => !e.series).map((e) => `${e.name}・${eventStatusText(e, Date.now())}`).join('／') || '活動 Boss 與兌換商店', onClick: () => nav.go('stages', ['event']) }),
        nemesisEntry(nav),
        listItem({
          leading: icon('scroll'),
          title: '外傳・灰燈港夜話',
          sub: side.open ? `劇情小章・低體力・通關 ${side.cleared}/${side.total}` : side.lock,
          trailing: side.open && side.cleared < side.total ? badge('NEW') : undefined,
          onClick: () => nav.go('stages', ['side']),
        }),
        listItem({ leading: icon('tower'), title: '挑戰之塔', sub: `不耗體力・目前第 ${save.progress.towerFloor} 層`, onClick: () => nav.go('stages', ['tower']) }),
        listItem({ leading: icon('constellation'), title: '流派試煉', sub: `借一支現成隊伍體驗各流派・已開放 ${trialsOpen} 關`, onClick: () => nav.go('archetypes') }),
        listItem({ leading: icon('sword'), title: '練習場', sub: '用示範隊伍練習轉珠，不耗體力', onClick: () => nav.go('battle', ['practice']) }),
        listItem({ leading: icon('constellation'), title: '星紋謎題', sub: puzzleEntrySub(), onClick: () => nav.go('puzzle') }),
      ),
    );
  },
};

/** 「其他」區的流派克星週入口：本週主題、剩餘時間、推薦流派 */
function nemesisEntry(nav: Navigator): HTMLElement | null {
  const week = nemesisView(gameData.events, gameData.stages, (id) => gameData.archetypes.find((a) => a.id === id)?.name ?? id, Date.now());
  if (!week) return null;
  return listItem({
    leading: icon('constellation'),
    title: `流派克星週・${week.event.name.replace(/^流派克星週・/, '')}`,
    sub: `${week.status}・推薦 ${week.archetypes.join('、')}`,
    onClick: () => nav.go('stages', ['nemesis']),
  });
}
