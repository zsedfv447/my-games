// 稱號列表：已解鎖的可以選來顯示在主城與手札；未解鎖的顯示條件與進度（progression/titles.ts）
import { h } from '../dom';
import { equipTitle, markTitlesSeen, newTitles, titleProgress, TITLES, titleStateOf, type TitleDef } from '../../progression/titles';
import { badge, bar, panel } from '../components/basic';
import { toast } from '../components/overlay';
import { audio } from '../audio';
import { commit, getSave } from '../state';
import { titleContext } from '../title-context';
import type { ScreenDef } from '../router';
import '../convenience.css';

export const titlesScreen: ScreenDef = {
  name: 'titles',
  title: '契印師稱號',
  chrome: 'sub',
  parent: 'notebook',
  render() {
    const host = h('div', { style: { display: 'contents' } });
    // 進畫面時記下哪些是新的，再標成已看過（這次仍顯示 NEW）
    const first = getSave();
    const fresh = new Set(newTitles(first, titleContext(first)).map((t) => t.id));
    if (fresh.size) commit(markTitlesSeen(first, [...fresh]));

    const draw = () => {
      const save = getSave();
      const ctx = titleContext(save);
      const equipped = titleStateOf(save).equipped;
      const rows = TITLES.map((def) => ({ def, p: titleProgress(save, def, ctx) }));
      const unlocked = rows.filter((r) => r.p.unlocked);
      const locked = rows.filter((r) => !r.p.unlocked);
      const pick = (id: string | null) => {
        const r = equipTitle(getSave(), id, titleContext(getSave()));
        if (!r.ok) return toast(r.reason === 'locked' ? '還沒解鎖這個稱號' : '找不到這個稱號');
        audio.play('confirm');
        commit(r.save);
        draw();
      };
      const item = (def: TitleDef, p: { value: number; target: number; unlocked: boolean }) => h(
        'button',
        { type: 'button', class: ['title-item', p.unlocked && 'unlocked', equipped === def.id && 'equipped'], disabled: !p.unlocked, onClick: () => pick(def.id) },
        h('div', { class: 'row between' },
          h('strong', { class: 'title-name' }, `「${def.name}」`),
          equipped === def.id ? badge('使用中', 'gold') : fresh.has(def.id) ? badge('NEW', 'gold') : null),
        h('div', { class: 'small-text dim' }, def.description),
        !p.unlocked && p.target > 1 && h('div', { style: { marginTop: '4px' } }, bar({ value: p.value, max: p.target, variant: 'gold', label: `${p.value.toLocaleString()} / ${p.target.toLocaleString()}` })),
      );
      host.replaceChildren(
        panel(
          { title: `已解鎖 ${unlocked.length} / ${TITLES.length}` },
          h('p', { class: 'small-text dim', style: { margin: '0 0 8px' } }, '選一個稱號，顯示在主城與契印師手札。'),
          unlocked.length
            ? h('div', { class: 'title-list' }, unlocked.map((r) => item(r.def, r.p)))
            : h('p', { class: 'small-text dim' }, '還沒有稱號。贏下第一場正式關卡就會解鎖第一個。'),
          equipped && h('button', { type: 'button', class: 'btn small ghost', style: { marginTop: '8px' }, onClick: () => pick(null) }, '不顯示稱號'),
        ),
        ...(locked.length ? [panel({ title: '尚未解鎖' }, h('div', { class: 'title-list' }, locked.map((r) => item(r.def, r.p))))] : []),
      );
    };
    draw();
    return h('div', null, host);
  },
};
