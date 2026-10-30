// 關卡列表：#/stages/<章節> 或 #/stages/daily|event|tower|side
import { eventBanner } from '../components/event-banner';
import { h } from '../dom';
import { gameData } from '../../data/load';
import type { StageDef } from '../../core/types';
import { chapterRewardStatus, chapterStars, claimChapterStarReward, periodFirstClearClaimed } from '../../progression/stages';
import { isSeriesStage, nemesisView } from '../nemesis';
import { badge, bar, button, emptyState, icon, listItem, panel } from '../components/basic';
import { rewardChips } from '../components/rewards';
import { toast } from '../components/overlay';
import { isPlayable, lockText, stageContext, takeJustUnlocked, stageRow, weekdayText, type StageRow } from '../stage-nav';
import { commit, getSave } from '../state';
import type { ChapterDef } from '../../core/types';
import type { Navigator, ScreenDef } from '../router';
import type { IconName } from '../art/icons';
import { firstClearChip, revealReward } from '../components/reward-reveal';
import { chapterConstellation } from '../components/constellation-view';

function row(r: StageRow, nav: Navigator, leading: IconName, fresh = new Set<string>()): HTMLElement {
  const s = r.stage;
  const playable = isPlayable(r.status);
  const sub: string[] = [];
  if (s.stamina > 0) sub.push(`體力 ${s.stamina}`);
  else sub.push('不耗體力');
  if (s.kind === 'daily') sub.push(weekdayText(s.weekdays));
  if (!playable) sub.push(lockText(r, gameData.stages));
  const trailing = h('div', { class: 'row', style: { gap: '4px' } },
    s.rewards.periodFirstClear
      ? firstClearChip(s.rewards.periodFirstClear, periodFirstClearClaimed(getSave(), s, gameData.events, Date.now()), '本週首通')
      : firstClearChip(s.rewards.firstClear, getSave().progress.clearedStages.includes(s.id)),
    r.stars.length > 0 && h('span', { class: 'stars small-text' }, r.stars.map((g) => h('span', { style: { opacity: g ? '1' : '0.25' } }, '★'))),
    r.status === 'cleared' ? badge('通過', 'gold') : r.status === 'open' ? badge('NEW') : icon('lock'),
  );
  const item = listItem({
    leading: icon(s.waves.some((w) => w.boss) ? 'trophy' : leading),
    title: s.name,
    sub: sub.join('・'),
    trailing,
    onClick: () => (playable ? nav.go('prepare', [s.id]) : toast(lockText(r, gameData.stages))),
  });
  if (!playable) item.classList.add('dimmed');
  if (fresh.has(s.id)) item.classList.add('just-unlocked');
  return item;
}

/** 章節星章進度與獎勵；領取後原地重畫 */
function chapterReward(info: ChapterDef): HTMLElement {
  const save = getSave();
  const stars = chapterStars(save, info.chapter, gameData.stages, gameData.chapters);
  const status = chapterRewardStatus(save, info.chapter, gameData.stages, gameData.chapters);
  const el: HTMLElement = h('div', { class: ['chapter-reward', status] },
    h('div', { class: 'chapter-reward-bar' }, bar({ value: stars.got, max: stars.total, variant: 'gold', label: `星章 ${stars.got}/${stars.total}` })),
    h('div', { class: 'row between' },
      rewardChips(info.starReward),
      status === 'claimable'
        ? button('領取', { small: true, variant: 'primary', sound: false, onClick: () => claim() })
        : badge(status === 'claimed' ? '已領取' : '集滿可領', status === 'claimed' ? undefined : 'gold')),
  );
  const claim = () => {
    const r = claimChapterStarReward(getSave(), info.chapter, gameData.chapters, gameData.stages, gameData.config, Date.now());
    if (!r.ok) return toast(r.reason === 'alreadyClaimed' ? '已經領過了' : '星章還沒集滿');
    commit(r.save);
    void revealReward('星章獎勵', r.reward!, `第 ${info.chapter} 章・${info.name}`);
    el.parentElement?.querySelector('.constellation-box.claimable')?.classList.remove('claimable');
    el.replaceWith(chapterReward(info));
  };
  return el;
}

const archetypeName = (id: string) => gameData.archetypes.find((a) => a.id === id)?.name ?? id;

const GROUPS: Record<string, { title: string; kind: StageDef['kind']; icon: IconName }> = {
  daily: { title: '每日關卡', kind: 'daily', icon: 'history' },
  event: { title: '限時活動', kind: 'event', icon: 'event' },
  nemesis: { title: '流派克星週', kind: 'event', icon: 'constellation' },
  tower: { title: '挑戰之塔', kind: 'tower', icon: 'tower' },
  side: { title: '外傳・灰燈港夜話', kind: 'side', icon: 'scroll' },
};

export const stagesScreen: ScreenDef = {
  name: 'stages',
  title: '關卡列表',
  chrome: 'sub',
  parent: 'adventure',
  render({ route, nav, onLeave }) {
    const save = getSave();
    const now = Date.now();
    const ctx = stageContext(gameData.stages, gameData.events);
    const key = route.args[0] ?? '1';
    const group = GROUPS[key];

    if (group) {
      const week = key === 'nemesis' ? nemesisView(gameData.events, gameData.stages, archetypeName, now) : null;
      // 限時活動不含系列活動（流派克星週）；克星週只列本週主題的 3 關
      let list = key === 'nemesis'
        ? (week?.stages ?? [])
        : gameData.stages.filter((s) => s.kind === group.kind && !(key === 'event' && isSeriesStage(s, gameData.events)));
      let rows = list.map((s) => stageRow(save, s, ctx, now));
      // 每日關卡把今天開放的排前面；塔從高樓層往下排，目前樓層在最上面
      if (group.kind === 'daily') rows = [...rows.filter((r) => r.status !== 'wrongDay'), ...rows.filter((r) => r.status === 'wrongDay')];
      if (group.kind === 'tower') {
        const shown = Math.min(rows.length, save.progress.towerFloor + 3);
        rows = rows.slice(0, shown).reverse();
        list = list.slice(0, shown);
      }
      const fresh = takeJustUnlocked(rows.map((r) => r.stage.id));
      return h(
        'div',
        null,
        h('h2', { class: 'section-title' }, group.title),
        key === 'event' && gameData.events.filter((e) => !e.series).map((e) => eventBanner(e, { nav, onLeave })),
        week && eventBanner(week.event, { nav, onLeave }),
        week && panel(null, h('p', { class: 'small-text', style: { margin: '0' } }, `本週推薦流派：${week.archetypes.join('、')}。每週一 00:00 換主題，每關每週第一次通關都有星晶，中級以上另有星核。`)),
        group.kind === 'side' && panel(null, h('p', { class: 'small-text dim', style: { margin: '0' } }, '第一部開始前的那個晚上，灰燈港的燈一盞一盞熄滅。港口的海豹提米和鐵匠赫姆，度過了漫長的一夜。')),
        group.kind === 'tower' && panel(null, h('p', { class: 'small-text dim' }, `目前到達第 ${save.progress.towerFloor} 層，共 ${gameData.stages.filter((s) => s.kind === 'tower').length} 層。每 10 層有星晶獎勵。`)),
        rows.length ? h('div', { class: 'list' }, rows.map((r) => row(r, nav, group.icon, fresh))) : emptyState(group.icon, '目前沒有關卡'),
      );
    }

    const chapter = Number(key);
    const info = gameData.chapters.find((c) => c.chapter === chapter);
    const rows = gameData.stages.filter((s) => s.kind === 'main' && s.chapter === chapter).map((s) => stageRow(save, s, ctx, now));
    const fresh = takeJustUnlocked(rows.map((r) => r.stage.id));
    return h(
      'div',
      null,
      panel(
        { gold: true },
        h('div', { class: 'row between' }, h('h2', { style: { margin: '0' } }, `第 ${chapter} 章・${info?.name ?? ''}`), info && badge(info.constellation, 'gold')),
        info && chapterConstellation(info, { claimable: chapterRewardStatus(save, info.chapter, gameData.stages, gameData.chapters) === 'claimable' }),
        info && chapterReward(info),
      ),
      h('div', { class: 'list' }, rows.map((r) => row(r, nav, 'adventure', fresh))),
    );
  },
};
