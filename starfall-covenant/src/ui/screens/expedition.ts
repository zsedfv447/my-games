// 星靈遠行：派沒上場的卡到已通關章節的星座，經過真實時間後回來領金幣、塵靈與少量星核（規則在 progression/expedition.ts）
import { h } from '../dom';
import { userAsset } from '../assets';
import { gameData } from '../../data/load';
import type { OwnedCard } from '../../core/types';
import {
  claimExpedition, dispatch, DISPATCH_TEXT, EXPEDITION, expeditionsOf, expeditionUnits, hasReturned, openChapters, recallExpedition, returnAt,
  type Expedition,
} from '../../progression/expedition';
import { expeditionUids, teamUids } from '../../growth/save-ops';
import { sortCards } from '../../growth';
import { RACE_NAMES } from '../art/palette';
import { badge, button, emptyState, panel, tabs } from '../components/basic';
import { cardThumb } from '../components/card-thumb';
import { confirmDialog, openDialog, toast } from '../components/overlay';
import { revealReward } from '../components/reward-reveal';
import { formatCountdown } from '../countdown';
import { commit, getSave, growth } from '../state';
import type { ScreenDef } from '../router';
import '../collection-helper.css';

const chapterOf = (n: number) => gameData.chapters.find((c) => c.chapter === n);

/** 可以派出的卡：不是素材、沒上鎖、不在隊伍裡、不在遠行中 */
function idleCards(): OwnedCard[] {
  const save = getSave();
  const inTeam = teamUids(save);
  const away = expeditionUids(save);
  const list = save.inventory.cards.filter((c) => growth.card(c.cardId)?.race !== 'material' && !c.locked && !inTeam.has(c.uid) && !away.has(c.uid));
  return sortCards(list, growth, 'rarity');
}

/** 選最多 3 張卡的對話框 */
function pickMembers(current: string[], onDone: (uids: string[]) => void): void {
  const chosen = new Set(current);
  const grid = h('div', { class: 'picker-grid' });
  const draw = () => {
    const list = idleCards();
    grid.replaceChildren(...(list.length
      ? list.map((c) => cardThumb(growth.card(c.cardId)!, {
        level: c.level, size: 60, selected: chosen.has(c.uid),
        onClick: () => {
          if (chosen.has(c.uid)) chosen.delete(c.uid);
          else if (chosen.size >= EXPEDITION.maxMembers) return toast(`每隊最多 ${EXPEDITION.maxMembers} 張卡`);
          else chosen.add(c.uid);
          draw();
        },
      }))
      : [h('p', { class: 'small-text dim' }, '沒有可以派出的卡：隊伍中、上鎖和素材卡不能遠行')]));
  };
  draw();
  const dlg = openDialog('選擇遠行的卡（最多 3 張）', grid, [
    button('取消', { variant: 'ghost', sound: 'back', onClick: () => dlg.close() }),
    button('決定', { variant: 'primary', onClick: () => { dlg.close(); onDone([...chosen]); } }),
  ]);
}

function partyPanel(e: Expedition, now: number, redraw: () => void): HTMLElement {
  const save = getSave();
  const chapter = chapterOf(e.chapter);
  const back = hasReturned(e, now);
  const members = e.uids.map((uid) => save.inventory.cards.find((c) => c.uid === uid)).filter((c): c is OwnedCard => !!c);
  const claim = () => {
    const r = claimExpedition(getSave(), e.id, Date.now(), gameData.chapters, growth.card, gameData.config);
    if (!r.ok) return toast(r.reason === 'notReturned' ? '還在路上，再等一下' : '找不到這支隊伍');
    commit(r.save);
    void revealReward('星靈歸來', r.reward, `${chapter?.constellation ?? ''}的旅途收穫`);
    redraw();
  };
  const recall = async () => {
    if (!(await confirmDialog('提前召回', '現在召回不會有任何收穫，卡片會立刻回來。確定嗎？', '召回'))) return;
    commit(recallExpedition(getSave(), e.id));
    redraw();
  };
  return panel(
    { gold: back },
    h('div', { class: 'row between' },
      h('strong', null, `${chapter?.constellation ?? `第 ${e.chapter} 章`}・${e.hours} 小時`),
      back ? badge('已歸來', 'gold') : h('span', { class: 'small-text dim', dataset: { returnAt: String(returnAt(e)) } }, `剩餘 ${formatCountdown(returnAt(e) - now)}`)),
    h('div', { class: 'row', style: { gap: '6px', margin: '8px 0' } },
      members.map((c) => cardThumb(growth.card(c.cardId)!, { level: c.level, size: 48 }))),
    back
      ? button('領取收穫', { variant: 'primary', block: true, icon: 'gift', sound: false, onClick: claim })
      : button('提前召回', { variant: 'ghost', block: true, sound: 'back', onClick: () => void recall() }),
  );
}

export const expeditionScreen: ScreenDef = {
  name: 'expedition',
  title: '星靈遠行',
  chrome: 'sub',
  parent: 'adventure',
  render({ onLeave }) {
    const root = h('div', { class: 'expedition-screen' });
    let chapterNo: number | undefined;
    let hours: number = EXPEDITION.hours[EXPEDITION.hours.length - 1];
    let members: string[] = [];

    const draw = () => {
      const save = getSave();
      const now = Date.now();
      const parties = expeditionsOf(save);
      const chapters = openChapters(save, gameData.chapters, gameData.stages);
      if (chapterNo === undefined || !chapters.some((c) => c.chapter === chapterNo)) chapterNo = chapters[chapters.length - 1]?.chapter;
      // 選好的卡如果已經不能派（例如被編進隊伍），就拿掉
      const idle = new Set(idleCards().map((c) => c.uid));
      members = members.filter((uid) => idle.has(uid));

      const intro = panel(null,
        h('div', { class: 'row between' }, h('strong', null, '星靈遠行'), h('span', { class: 'small-text dim' }, `遠行中 ${parties.length} / ${EXPEDITION.maxParties}`)),
        h('p', { class: 'small-text dim', style: { margin: '6px 0 0' } },
          '派沒有上場的卡到已通關章節的星座旅行，時間到了回來領金幣、塵靈與少量星核。種族對上星座時收穫 +50%。遠行中的卡不能編隊、養成或販賣。'));

      let form: HTMLElement;
      if (!chapters.length) {
        form = emptyState('constellation', '通過第 1 章後就能出發', '星靈只會前往已經淨化過的星座。');
      } else if (parties.length >= EXPEDITION.maxParties) {
        form = h('p', { class: 'small-text dim' }, `已經有 ${EXPEDITION.maxParties} 隊在遠行，等他們回來再出發吧。`);
      } else {
        const chapter = chapterOf(chapterNo!)!;
        const select = h('select', { class: 'codex-select', 'aria-label': '目的地' },
          chapters.map((c) => h('option', { value: String(c.chapter), selected: c.chapter === chapterNo }, `第 ${c.chapter} 章・${c.constellation}（${RACE_NAMES[c.race]}）`)));
        select.addEventListener('change', () => { chapterNo = Number(select.value); draw(); });
        const owned = members.map((uid) => save.inventory.cards.find((c) => c.uid === uid)!).filter(Boolean);
        const races = owned.map((c) => growth.card(c.cardId)!.race);
        const units = expeditionUnits(hours, races, chapter.race);
        const match = races.filter((r) => r === chapter.race).length;
        const go = () => {
          const r = dispatch(getSave(), { chapter: chapter.chapter, uids: members, hours }, gameData.chapters, gameData.stages, growth.card, Date.now());
          if (!r.ok) return toast(DISPATCH_TEXT[r.reason]);
          commit(r.save);
          members = [];
          toast(`出發了！${hours} 小時後回來`);
          draw();
        };
        form = panel({ title: '派出新隊伍' },
          h('label', { class: 'small-text dim' }, '目的地'),
          select,
          h('div', { style: { margin: '8px 0' } },
            tabs(EXPEDITION.hours.map((x) => ({ id: String(x), label: `${x} 小時` })), String(hours), (id) => { hours = Number(id); draw(); })),
          h('div', { class: 'row wrap', style: { gap: '6px', alignItems: 'center' } },
            owned.map((c) => cardThumb(growth.card(c.cardId)!, { level: c.level, size: 52 })),
            button(owned.length ? '更換' : '選擇卡片', { small: true, onClick: () => pickMembers(members, (uids) => { members = uids; draw(); }) })),
          owned.length > 0 && h('p', { class: 'small-text', style: { margin: '8px 0' } },
            `預計約 ${Math.round(units * EXPEDITION.perUnit.coin).toLocaleString()} 金幣與一些塵靈`,
            match > 0 && h('span', { class: 'gold-text' }, `・${RACE_NAMES[chapter.race]}加成 ×${match}`)),
          button('出發', { variant: 'primary', block: true, disabled: !owned.length, onClick: go }));
      }

      const scenery = h('div', { class: 'scene-art-banner' },
        h('img', { src: userAsset('backgrounds', 'pack-expedition'), alt: '', loading: 'lazy' }));
      root.replaceChildren(scenery, intro, ...parties.map((e) => partyPanel(e, now, draw)), form);
    };

    draw();
    // 倒數每秒更新；有隊伍剛好回來時整頁重畫
    const timer = window.setInterval(() => {
      const now = Date.now();
      let arrived = false;
      root.querySelectorAll<HTMLElement>('[data-return-at]').forEach((el) => {
        const left = Number(el.dataset.returnAt) - now;
        if (left <= 0) arrived = true;
        else el.textContent = `剩餘 ${formatCountdown(left)}`;
      });
      if (arrived) draw();
    }, 1000);
    onLeave(() => window.clearInterval(timer));
    return root;
  },
};

/** 冒險頁小卡的副標：已歸來幾隊、遠行中幾隊 */
export function expeditionTileSub(now: number): { sub: string; dot: boolean; locked: boolean } {
  const save = getSave();
  if (!openChapters(save, gameData.chapters, gameData.stages).length) return { sub: '通過第 1 章後開放', dot: false, locked: true };
  const parties = expeditionsOf(save);
  const back = parties.filter((e) => hasReturned(e, now)).length;
  if (back) return { sub: `${back} 隊已歸來，可以領取收穫`, dot: true, locked: false };
  if (parties.length) return { sub: `遠行中 ${parties.length} / ${EXPEDITION.maxParties} 隊`, dot: false, locked: false };
  return { sub: '派沒上場的卡去星座旅行', dot: false, locked: false };
}
