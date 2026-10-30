// 劇情：播放 data/story.json 的對白（#/story/<劇情id>?next=<之後要去的畫面>），沒有 id 時是劇情回顧列表
import { h, svg } from '../dom';
import { gameData } from '../../data/load';
import { starfieldSvg } from '../art/scenery';
import { userAsset } from '../assets';
import { button, emptyState, icon, listItem, panel, tabs } from '../components/basic';
import { openDialog } from '../components/overlay';
import { collectedLorePages, isVolumeComplete, loreSecretById, loreSecretId, type LoreData, type LorePage } from '../../progression/lore';
import '../lore.css';
import { storyBox } from '../components/story';
import { commit, getSave } from '../state';
import { type Navigator, type ScreenDef } from '../router';

export function markStorySeen(id: string): void {
  const save = getSave();
  if (save.progress.storySeen.includes(id)) return;
  commit({ ...save, progress: { ...save.progress, storySeen: [...save.progress.storySeen, id] } });
}

const lore: LoreData = gameData.lore ?? { volumes: [] };

const PART_NAMES: Record<string, string> = { open: '開場', mid: '途中', mid2: '途中・二', boss: '決戰前', end: '尾聲', stars: '星章' };

/** 劇情 id 轉成回顧列表上的標題 */
export function storyTitle(id: string): string {
  if (id === 'prologue') return '序章';
  const secret = loreSecretById(lore, id);
  if (secret) return `星骸殘頁・${secret.secret.title}`;
  let m = /^ch(\d+)-(\w+)$/.exec(id);
  if (m) return `第 ${m[1]} 章・${PART_NAMES[m[2]] ?? m[2]}`;
  m = /^tower-(\d+)$/.exec(id);
  if (m) return `挑戰之塔・第 ${m[1]} 層`;
  m = /^side-harbor-(\w+)$/.exec(id);
  if (m) return `外傳・灰燈港夜話・${m[1] === 'end' ? '尾聲' : `第 ${m[1]} 話`}`;
  m = /^ev-[a-z]+-(\w+)$/.exec(id);
  if (m) return `活動・${m[1] === 'end' ? '尾聲' : `第 ${m[1]} 話`}`;
  return id;
}

/** 播完後去哪：next=back 回上一頁；next=<hash 路徑> 回到（或換到）該畫面；沒給就回上一頁 */
function goNext(nav: Navigator, next: string | undefined): void {
  if (!next || next === 'back') return nav.back();
  nav.backTo(next);
}

function player(id: string, next: string | undefined, nav: Navigator): HTMLElement {
  // 星骸殘頁集滿一卷後解鎖的隱藏對話也用這個播放器
  const lines = gameData.story[id] ?? loreSecretById(lore, id)?.secret.lines ?? [];
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

/** 殘頁從哪一關拿到（未收集時的提示） */
function pageHint(page: LorePage): string {
  const stage = gameData.stages.find((s) => s.id === page.stage);
  if (!stage) return '尚未收集';
  if (stage.kind === 'main') return `第 ${stage.chapter} 章・${stage.name} 首次通關`;
  if (stage.kind === 'tower') return `挑戰之塔第 ${gameData.stages.filter((s) => s.kind === 'tower').indexOf(stage) + 1} 層 首次通關`;
  return `${stage.name} 首次通關`;
}

function readPage(page: LorePage): void {
  const dlg = openDialog(page.title, h('div', { class: 'lore-text' }, page.text.map((t) => h('p', null, t))), [
    button('闔上', { variant: 'primary', sound: 'back', onClick: () => dlg.close() }),
  ]);
}

function lorePanel(nav: Navigator): HTMLElement {
  const collected = collectedLorePages(getSave(), lore);
  const have = new Set(collected);
  if (!lore.volumes.length) return emptyState('scroll', '還沒有星骸殘頁');
  return h('div', null,
    h('p', { class: 'small-text dim lore-intro' }, '擊敗各章 Boss、挑戰之塔每 10 層與活動最後一關，首次通關時可以拾得記錄「七曜星座為何碎裂」的殘頁。集滿一卷就能閱讀隱藏對話。'),
    lore.volumes.map((v) => {
      const got = v.pages.filter((p) => have.has(p.id)).length;
      const done = isVolumeComplete(collected, v);
      return panel({ title: `${v.name}（${got} / ${v.pages.length}）`, gold: done },
        h('div', { class: 'lore-pages' }, v.pages.map((p) => have.has(p.id)
          ? h('button', { type: 'button', class: 'lore-page', onClick: () => readPage(p) }, h('strong', null, p.title), h('span', null, p.text[0]))
          : h('div', { class: 'lore-page silhouette', 'aria-label': '未收集的殘頁' }, h('strong', null, '？？？'), h('span', null, pageHint(p))))),
        listItem({
          leading: icon('scroll'),
          title: done ? `隱藏對話・${v.secret.title}` : '隱藏對話（未解鎖）',
          sub: done ? '已解鎖・點一下播放' : `再收集 ${v.pages.length - got} 頁殘頁`,
          locked: !done,
          onClick: () => nav.go('story', [loreSecretId(v)]),
        }));
    }));
}

type StoriesTab = 'story' | 'lore';

export const storiesScreen: ScreenDef = {
  name: 'stories',
  title: '劇情回顧',
  chrome: 'sub',
  parent: 'home',
  render({ nav, route }) {
    const seen = new Set(getSave().progress.storySeen);
    const ids = Object.keys(gameData.story).filter((k) => k === 'prologue' || seen.has(k));
    const body = h('div');
    const show = (tab: StoriesTab) => body.replaceChildren(tab === 'lore'
      ? lorePanel(nav)
      : ids.length
        ? h('div', { class: 'list' }, ids.map((k) => listItem({ leading: icon('scroll'), title: storyTitle(k), sub: gameData.story[k][0]?.text, onClick: () => nav.go('story', [k]) })))
        : emptyState('scroll', '還沒有看過的劇情'));
    const initial: StoriesTab = route.args[0] === 'lore' ? 'lore' : 'story';
    show(initial);
    return h('div', null,
      tabs<StoriesTab>([{ id: 'story', label: '劇情' }, { id: 'lore', label: '星骸殘頁' }], initial, (tab) => {
        // 記在網址上，看完隱藏對話返回時停在同一個分頁
        nav.replace('stories', tab === 'lore' ? ['lore'] : []);
      }),
      body);
  },
};
