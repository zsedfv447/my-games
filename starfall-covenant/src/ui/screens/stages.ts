// 關卡列表：#/stages/<章節> 或 #/stages/daily|event|tower
import { h } from '../dom';
import { gameData } from '../../data/load';
import type { StageDef } from '../../core/types';
import { chapterStars } from '../../progression/stages';
import { badge, emptyState, icon, listItem, panel } from '../components/basic';
import { toast } from '../components/overlay';
import { isPlayable, LOCK_TEXT, stageContext, stageRow, weekdayText, type StageRow } from '../stage-nav';
import { getSave } from '../state';
import type { Navigator, ScreenDef } from '../router';
import type { IconName } from '../art/icons';
import { firstClearChip } from '../components/reward-reveal';

function row(r: StageRow, nav: Navigator, leading: IconName): HTMLElement {
  const s = r.stage;
  const playable = isPlayable(r.status);
  const sub: string[] = [];
  if (s.stamina > 0) sub.push(`體力 ${s.stamina}`);
  else sub.push('不耗體力');
  if (s.kind === 'daily') sub.push(weekdayText(s.weekdays));
  if (!playable) sub.push(LOCK_TEXT[r.status as keyof typeof LOCK_TEXT]);
  const trailing = h('div', { class: 'row', style: { gap: '4px' } },
    firstClearChip(s.rewards.firstClear, getSave().progress.clearedStages.includes(s.id)),
    r.stars.length > 0 && h('span', { class: 'stars small-text' }, r.stars.map((g) => h('span', { style: { opacity: g ? '1' : '0.25' } }, '★'))),
    r.status === 'cleared' ? badge('通過', 'gold') : r.status === 'open' ? badge('NEW') : icon('lock'),
  );
  const item = listItem({
    leading: icon(s.waves.some((w) => w.boss) ? 'trophy' : leading),
    title: s.name,
    sub: sub.join('・'),
    trailing,
    onClick: () => (playable ? nav.go('prepare', [s.id]) : toast(LOCK_TEXT[r.status as keyof typeof LOCK_TEXT])),
  });
  if (!playable) item.classList.add('dimmed');
  return item;
}

const GROUPS: Record<string, { title: string; kind: StageDef['kind']; icon: IconName }> = {
  daily: { title: '每日關卡', kind: 'daily', icon: 'history' },
  event: { title: '限時活動', kind: 'event', icon: 'event' },
  tower: { title: '挑戰之塔', kind: 'tower', icon: 'tower' },
};

export const stagesScreen: ScreenDef = {
  name: 'stages',
  title: '關卡列表',
  chrome: 'sub',
  parent: 'adventure',
  render({ route, nav }) {
    const save = getSave();
    const now = Date.now();
    const ctx = stageContext(gameData.stages);
    const key = route.args[0] ?? '1';
    const group = GROUPS[key];

    if (group) {
      let list = gameData.stages.filter((s) => s.kind === group.kind);
      let rows = list.map((s) => stageRow(save, s, ctx, now));
      // 每日關卡把今天開放的排前面；塔從高樓層往下排，目前樓層在最上面
      if (group.kind === 'daily') rows = [...rows.filter((r) => r.status !== 'wrongDay'), ...rows.filter((r) => r.status === 'wrongDay')];
      if (group.kind === 'tower') {
        const shown = Math.min(rows.length, save.progress.towerFloor + 3);
        rows = rows.slice(0, shown).reverse();
        list = list.slice(0, shown);
      }
      return h(
        'div',
        null,
        h('h2', { class: 'section-title' }, group.title),
        group.kind === 'tower' && panel(null, h('p', { class: 'small-text dim' }, `目前到達第 ${save.progress.towerFloor} 層，共 ${gameData.stages.filter((s) => s.kind === 'tower').length} 層。每 10 層有星晶獎勵。`)),
        rows.length ? h('div', { class: 'list' }, rows.map((r) => row(r, nav, group.icon))) : emptyState(group.icon, '目前沒有關卡'),
      );
    }

    const chapter = Number(key);
    const info = gameData.chapters.find((c) => c.chapter === chapter);
    const rows = gameData.stages.filter((s) => s.kind === 'main' && s.chapter === chapter).map((s) => stageRow(save, s, ctx, now));
    const stars = chapterStars(save, chapter, gameData.stages);
    return h(
      'div',
      null,
      panel(
        { gold: true },
        h('div', { class: 'row between' }, h('h2', { style: { margin: '0' } }, `第 ${chapter} 章・${info?.name ?? ''}`), info && badge(info.constellation, 'gold')),
        h('p', { class: 'small-text dim', style: { marginTop: '6px' } }, `星章 ${stars.got}/${stars.total}・集滿可得章節獎勵`),
      ),
      h('div', { class: 'list' }, rows.map((r) => row(r, nav, 'adventure'))),
    );
  },
};
