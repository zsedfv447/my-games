import { h, svg } from '../dom';
import { harborSvg } from '../art/scenery';
import { userAsset } from '../assets';
import { audio } from '../audio';
import type { IconName } from '../art/icons';
import { button, icon } from '../components/basic';
import type { ScreenDef } from '../router';
import { gameData } from '../../data/load';
import { getSave, growth } from '../state';
import { cardPortraitUrl, cardThumb, emptySlot } from '../components/card-thumb';
import { chapterProgress, nextMainStage, stageContext } from '../stage-nav';
import { homeBadges, type HomeBadges } from '../economy';
import { maybeShowLoginPopup } from './login-bonus';

/** 捷徑上的紅點：有可領的登入、任務或成就獎勵 */
const BADGE_OF: Record<string, keyof HomeBadges> = { 'login-bonus': 'login', quests: 'quests', achievements: 'achievements' };

const SHORTCUTS: { label: string; icon: IconName; to: string; args?: string[] }[] = [
  { label: '任務', icon: 'quest', to: 'quests' },
  { label: '成就', icon: 'trophy', to: 'achievements' },
  { label: '圖鑑', icon: 'book', to: 'collection' },
  { label: '流派圖鑑', icon: 'constellation', to: 'archetypes' },
  { label: '每日登入', icon: 'gift', to: 'login-bonus' },
  { label: '活動', icon: 'event', to: 'stages', args: ['event'] },
  { label: '挑戰之塔', icon: 'tower', to: 'stages', args: ['tower'] },
  { label: '劇情回顧', icon: 'scroll', to: 'stories' },
  { label: '手札', icon: 'history', to: 'notebook' },
];

export const homeScreen: ScreenDef = {
  name: 'home',
  title: '主城',
  chrome: 'full',
  tab: 'home',
  render({ nav, onLeave }) {
    audio.playBgm('home');
    // 每天第一次回到主城自動跳出登入獎勵（等畫面掛上後再開）
    const popup = setTimeout(() => maybeShowLoginPopup(() => root.querySelectorAll('[data-badge="login"]').forEach((el) => el.remove())), 350);
    onLeave(() => clearTimeout(popup));
    const bg = userAsset('backgrounds', 'home');
    const save = getSave();
    const members = save.teams[save.activeTeam].members.map((uid) => save.inventory.cards.find((c) => c.uid === uid));
    const leader = members[0] && growth.card(members[0].cardId);
    const portrait = leader && cardPortraitUrl(leader);
    const ctx = stageContext(gameData.stages, gameData.events);
    const next = nextMainStage(save, ctx, Date.now());
    const chapter = gameData.chapters.find((c) => c.chapter === next?.chapter);
    const progress = chapter && chapterProgress(save, chapter.chapter, ctx, Date.now());
    const badges = homeBadges(save, Date.now());
    const dot = (to: string) => BADGE_OF[to] && badges[BADGE_OF[to]] && h('span', { class: 'badge dot', dataset: { badge: BADGE_OF[to] }, 'aria-label': '有可領取的獎勵' });
    const root = h(
      'div',
      { class: 'sanctuary' },
      h(
        'div',
        { class: 'home-hero' },
        bg ? h('img', { src: bg, alt: '' }) : svg(harborSvg()),
        h('div', { class: 'home-heading' }, h('span', null, 'STARFALL COVENANT'), h('h1', null, '星骸契約')),
        portrait && h('button', { class: 'home-leader', type: 'button', 'aria-label': `查看隊長 ${leader!.name}`, onClick: () => nav.go('team') }, h('img', { src: portrait, alt: leader!.name, draggable: 'false' })),
        h('div', { class: 'home-side-links' }, SHORTCUTS.slice(0, 3).map((s) => h('button', { type: 'button', onClick: () => { audio.play('tap'); nav.go(s.to, s.args); } }, icon(s.icon), h('span', null, s.label), dot(s.to)))),
        h('div', { class: 'caption' }, h('div', { class: 'place' }, '契約之門'), h('div', { class: 'small-text dim' }, leader?.name ?? '見習契印師的起點')),
      ),
      h('button', { type: 'button', class: 'quest-banner', onClick: () => nav.go('adventure') },
        h('span', { class: 'quest-seal' }, icon('tower')),
        h('span', { class: 'quest-copy' }, h('small', null, chapter ? `第 ${chapter.chapter} 章 · ${chapter.name}` : '星骸遠征'), h('strong', null, next?.name ?? '踏上新的冒險'), h('small', null, progress ? `章節進度 ${progress.cleared} / ${progress.total}` : '探索關卡與挑戰之塔')),
        h('span', { class: 'quest-arrow' }, '›'),
        badges.chapters && h('span', { class: 'badge dot', dataset: { badge: 'chapters' }, 'aria-label': '有可領取的章節獎勵' })),
      h('div', { class: 'home-party' }, h('div', { class: 'home-section-label' }, h('span', null, '出戰隊伍'), h('button', { type: 'button', onClick: () => nav.go('team') }, '編成 ›')),
        h('div', { class: 'home-party-cards' }, members.map((owned) => {
          const def = owned && growth.card(owned.cardId);
          return def ? cardThumb(def, { level: owned!.level, size: 59, onClick: () => nav.go('team') }) : emptySlot(() => nav.go('team'), 59);
        }))),
      h(
        'div',
        { class: 'home-tiles' },
        SHORTCUTS.slice(3).map((s) => h('button', { type: 'button', class: 'tile', onClick: () => { audio.play('tap'); nav.go(s.to, s.args); } }, icon(s.icon), s.label, dot(s.to))),
      ),
      button('練習轉珠', { variant: 'ghost', block: true, onClick: () => nav.go('battle', ['practice']) }),
    );
    return root;
  },
};
