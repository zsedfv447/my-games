// 劇情：播放 data/story.json 的對白（#/story/<劇情id>?next=<之後要去的畫面>），沒有 id 時是劇情回顧列表
import { h, svg } from '../dom';
import { gameData } from '../../data/load';
import { starfieldSvg } from '../art/scenery';
import { userAsset } from '../assets';
import { emptyState, icon, listItem } from '../components/basic';
import { storyBox } from '../components/story';
import { commit, getSave } from '../state';
import { parseHash, type Navigator, type ScreenDef } from '../router';

export function markStorySeen(id: string): void {
  const save = getSave();
  if (save.progress.storySeen.includes(id)) return;
  commit({ ...save, progress: { ...save.progress, storySeen: [...save.progress.storySeen, id] } });
}

const PART_NAMES: Record<string, string> = { open: '開場', mid: '途中', boss: '決戰前', end: '尾聲', stars: '星章' };

/** 劇情 id 轉成回顧列表上的標題 */
export function storyTitle(id: string): string {
  if (id === 'prologue') return '序章';
  let m = /^ch(\d+)-(\w+)$/.exec(id);
  if (m) return `第 ${m[1]} 章・${PART_NAMES[m[2]] ?? m[2]}`;
  m = /^tower-(\d+)$/.exec(id);
  if (m) return `挑戰之塔・第 ${m[1]} 層`;
  m = /^ev-[a-z]+-(\w+)$/.exec(id);
  if (m) return `活動・${m[1] === 'end' ? '尾聲' : `第 ${m[1]} 話`}`;
  return id;
}

/** 播完後去哪：next=back 回上一頁；next=<hash 路徑> 換到該畫面；沒給就回上一頁 */
function goNext(nav: Navigator, next: string | undefined): void {
  if (!next || next === 'back') return nav.back();
  const r = parseHash(`#/${next}`);
  nav.replace(r.name, r.args, r.query);
}

function player(id: string, next: string | undefined, nav: Navigator): HTMLElement {
  const lines = gameData.story[id] ?? [];
  const bg = userAsset('backgrounds', `story-${id}`) ?? userAsset('backgrounds', 'story') ?? userAsset('backgrounds', 'title');
  const done = () => {
    markStorySeen(id);
    goNext(nav, next);
  };
  if (!lines.length) {
    queueMicrotask(done);
    return h('div');
  }
  return h(
    'div',
    { style: { background: 'radial-gradient(80% 50% at 50% 35%, #2a3a85, #060a1f)' } },
    bg ? h('img', { src: bg, alt: '', style: { position: 'absolute', inset: '0', width: '100%', height: '100%', objectFit: 'cover' } }) : svg(starfieldSvg()),
    h('div', { class: 'story-chapter' }, storyTitle(id)),
    h('button', { type: 'button', class: 'btn small ghost', style: { position: 'absolute', right: '12px', top: 'calc(12px + var(--safe-top, 0px))' }, onClick: done }, '略過'),
    storyBox(lines, done),
  );
}

export const storyScreen: ScreenDef = {
  name: 'story',
  title: '劇情',
  chrome: 'bare',
  parent: 'stories',
  render({ route, nav }) {
    return player(route.args[0] ?? 'prologue', route.query.next, nav);
  },
};

export const storiesScreen: ScreenDef = {
  name: 'stories',
  title: '劇情回顧',
  chrome: 'sub',
  parent: 'home',
  render({ nav }) {
    const seen = new Set(getSave().progress.storySeen);
    const ids = Object.keys(gameData.story).filter((k) => k === 'prologue' || seen.has(k));
    return h(
      'div',
      null,
      ids.length
        ? h('div', { class: 'list' }, ids.map((k) => listItem({ leading: icon('scroll'), title: storyTitle(k), sub: gameData.story[k][0]?.text, onClick: () => nav.go('story', [k]) })))
        : emptyState('scroll', '還沒有看過的劇情'),
    );
  },
};
