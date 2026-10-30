// 卡片背包與卡片詳情
import { append, clear, h } from '../dom';
import { gameData } from '../../data/load';
import {
  computeStats, filterCards, inventoryUsage, inventoryWarning, previewSell, ROLE_LABEL, sellCards, setLocked, sortCards, type SortKey,
} from '../../growth';
import { teamUids } from '../../growth/save-ops';
import { ATTRIBUTE_NAMES, RACE_NAMES } from '../art/palette';
import { badge, button, emptyState, panel, stars, tabs } from '../components/basic';
import { cardPortrait, cardThumb } from '../components/card-thumb';
import { confirmDialog, toast } from '../components/overlay';
import { commit, getSave, growth } from '../state';
import type { ScreenDef } from '../router';
import {
  activeFilterCount, ATTRIBUTE_CHIPS, emptyBagFilter, RACE_CHIPS, RARITY_CHIPS, toCardFilter, toggleValues, type BagFilterState,
} from './bag-view';
import '../bag.css';

let sortKey: SortKey = 'obtainedAt';
// 篩選條件跨畫面保留（從卡片詳情返回時不會被清掉）
let filter: BagFilterState = emptyBagFilter();

const BLOCK_TEXT = { locked: '上鎖的卡不能販賣', inTeam: '隊伍中的卡不能販賣' } as const;

export const cardsScreen: ScreenDef = {
  name: 'cards',
  title: '卡片背包',
  chrome: 'full',
  tab: 'cards',
  parent: 'home',
  render({ nav }) {
    let selling = false;
    let showFilter = activeFilterCount(filter) > 0;
    let selected = new Set<string>();
    let busy = false;
    const root = h('div', { class: 'bag-screen' });

    const chip = (label: string, on: boolean, onClick: () => void, cls?: string) =>
      h('button', { type: 'button', class: ['filter-chip', on && 'on', cls], 'aria-pressed': String(on), onClick }, label);

    const sell = async () => {
      if (busy) return;
      const p = previewSell(getSave(), growth, [...selected]);
      if (!p.sellable.length) return toast('請先選擇要販賣的卡片');
      busy = true;
      try {
        if (!await confirmDialog('批次販賣', `販賣 ${p.sellable.length} 張卡片，獲得 ${p.coin.toLocaleString()} 金幣？`, '販賣')) return;
        if (p.needsConfirm) {
          const save = getSave();
          const ok = await confirmDialog('包含高星卡片', h('div', null,
            h('p', { style: { margin: '0 0 8px' } }, `其中有 ${p.highRarity.length} 張 ${growth.rules.sellConfirmRarity}★ 以上的卡，賣掉後無法復原。確定要賣嗎？`),
            h('div', { class: 'row wrap', style: { gap: '6px' } }, p.highRarity.map((uid) => {
              const c = save.inventory.cards.find((x) => x.uid === uid)!;
              return cardThumb(growth.card(c.cardId)!, { level: c.level, size: 44 });
            }))), '確定販賣');
          if (!ok) return;
        }
        const r = sellCards(getSave(), growth, p.sellable, { confirmHighRarity: p.needsConfirm });
        if (!r.ok) return toast(r.error.message);
        commit(r.save);
        toast(`獲得 ${r.coin.toLocaleString()} 金幣`);
        selected = new Set();
        selling = false;
        draw();
      } finally {
        busy = false;
      }
    };

    const draw = () => {
      const save = getSave();
      const usage = inventoryUsage(save);
      const warn = inventoryWarning(save, growth);
      const inTeam = teamUids(save);
      const list = sortCards(filterCards(save, growth, toCardFilter(filter)), growth, sortKey);
      for (const uid of selected) if (!list.some((c) => c.uid === uid)) selected.delete(uid);
      const preview = previewSell(save, growth, [...selected]);
      const nFilter = activeFilterCount(filter);
      const setFilter = (next: BagFilterState) => { filter = next; draw(); };

      const grid = h('div', { class: ['card-grid', selling && 'selling'] }, list.map((c) => {
        const def = growth.card(c.cardId);
        if (!def) return null;
        const blocked = selling && (c.locked ? 'locked' : inTeam.has(c.uid) ? 'inTeam' : null);
        const el = cardThumb(def, {
          level: c.level, locked: c.locked, size: 70, selected: selected.has(c.uid),
          onClick: () => {
            if (!selling) return nav.go('card', [c.uid]);
            if (blocked) return toast(BLOCK_TEXT[blocked]);
            if (selected.has(c.uid)) selected.delete(c.uid); else selected.add(c.uid);
            draw();
          },
        });
        if (blocked) el.classList.add('unsellable');
        return h('div', { class: 'bag-cell' }, el, inTeam.has(c.uid) && h('span', { class: 'team-mark' }, '隊'));
      }));

      clear(root);
      append(root, [
        h('div', { class: 'row between' },
          h('span', { class: ['small-text', warn ? 'bag-warn-text' : 'dim'] }, `背包 ${usage.used} / ${usage.capacity}`),
          h('div', { class: 'row', style: { gap: '6px' } },
            button(nFilter ? `篩選（${nFilter}）` : '篩選', { small: true, variant: showFilter || nFilter ? undefined : 'ghost', onClick: () => { showFilter = !showFilter; draw(); } }),
            button(selling ? '取消販賣' : '批次販賣', { small: true, variant: selling ? 'ghost' : undefined, onClick: () => { selling = !selling; selected = new Set(); draw(); } }))),
        warn && h('div', { class: ['bag-warning', warn] },
          h('span', null, warn === 'full' ? '背包已滿，新取得的卡片會放不下。' : `背包快滿了，只剩 ${usage.free} 格。`),
          button('擴充', { small: true, onClick: () => nav.go('shop') })),
        showFilter && h('div', { class: 'bag-filter panel' },
          h('div', { class: 'chip-row' }, h('span', { class: 'chip-label' }, '屬性'),
            ATTRIBUTE_CHIPS.map((a) => chip(ATTRIBUTE_NAMES[a], filter.attribute.includes(a), () => setFilter({ ...filter, attribute: toggleValues(filter.attribute, [a]) }), `attr-${a}`))),
          h('div', { class: 'chip-row' }, h('span', { class: 'chip-label' }, '稀有'),
            RARITY_CHIPS.map((r) => chip(r.label, r.values.every((v) => filter.rarity.includes(v)), () => setFilter({ ...filter, rarity: toggleValues(filter.rarity, r.values) })))),
          h('div', { class: 'chip-row' }, h('span', { class: 'chip-label' }, '種族'),
            RACE_CHIPS.map((r) => chip(RACE_NAMES[r], filter.race.includes(r), () => setFilter({ ...filter, race: toggleValues(filter.race, [r]) })))),
          h('div', { class: 'chip-row' }, h('span', { class: 'chip-label' }, '流派'),
            gameData.archetypes.map((a) => chip(a.name, filter.archetype.includes(a.id), () => setFilter({ ...filter, archetype: toggleValues(filter.archetype, [a.id]) })))),
          nFilter > 0 && h('div', { class: 'row between' },
            h('span', { class: 'small-text dim' }, `符合 ${list.length} 張`),
            button('清除篩選', { small: true, variant: 'ghost', onClick: () => setFilter(emptyBagFilter()) }))),
        tabs<SortKey>([
          { id: 'obtainedAt', label: '新取得' }, { id: 'rarity', label: '稀有度' }, { id: 'level', label: '等級' }, { id: 'attribute', label: '屬性' },
        ], sortKey, (k) => { sortKey = k; draw(); }),
        !usage.used ? emptyState('cards', '背包是空的', '通關關卡或召喚可以取得卡片')
          : list.length ? grid : emptyState('cards', '沒有符合篩選的卡片'),
        selling && h('div', { class: 'bag-sell-bar' },
          h('div', { class: 'small-text' }, `已選 ${preview.sellable.length} 張・可得 `, h('strong', { class: 'gold-text' }, `${preview.coin.toLocaleString()} 金幣`),
            preview.needsConfirm && h('span', { class: 'bag-warn-text' }, `（含 ${preview.highRarity.length} 張高星）`)),
          h('div', { class: 'row', style: { gap: '6px' } },
            button('全選', { small: true, onClick: () => { selected = new Set(previewSell(save, growth, list.map((c) => c.uid)).sellable); draw(); } }),
            button('清除', { small: true, variant: 'ghost', disabled: !selected.size, onClick: () => { selected = new Set(); draw(); } }),
            button('販賣', { small: true, variant: 'danger', disabled: !preview.sellable.length, onClick: () => void sell() }))),
      ]);
    };
    draw();
    return root;
  },
};

export const cardScreen: ScreenDef = {
  name: 'card',
  title: '卡片詳情',
  chrome: 'sub',
  parent: 'cards',
  render({ route, nav }) {
    const owned = getSave().inventory.cards.find((c) => c.uid === route.args[0]);
    const def = owned && growth.card(owned.cardId);
    if (!owned || !def) return h('div', null, emptyState('cards', '找不到這張卡片'));
    const st = computeStats(def, owned, growth.rules);
    const skill = def.activeSkill ? growth.skill(def.activeSkill) : undefined;
    const leader = def.leaderSkill ? growth.leaderSkill(def.leaderSkill) : undefined;
    const lockBtn = button(owned.locked ? '解除上鎖' : '上鎖', {
      small: true, icon: 'lock',
      onClick: () => {
        const r = setLocked(getSave(), owned.uid, !owned.locked);
        if (!r.ok) return toast(r.error.message);
        commit(r.save);
        nav.replace('card', [owned.uid]);
      },
    });
    return h(
      'div',
      null,
      cardPortrait(def),
      panel(
        null,
        h('div', { class: 'row between' }, h('h2', { style: { margin: '0' } }, def.name), stars(def.rarity)),
        h('div', { class: 'row wrap', style: { gap: '4px', margin: '6px 0' } },
          badge(`${ATTRIBUTE_NAMES[def.attribute]}屬性`, `attr-${def.attribute}`), badge(RACE_NAMES[def.race]), badge(`Cost ${def.cost}`),
          def.archetypes.map((a) => badge(`${gameData.archetypes.find((x) => x.id === a.id)?.name ?? a.id}・${ROLE_LABEL[a.role]}`, 'gold'))),
        h('div', { class: 'stat-row' },
          h('div', null, h('span', { class: 'dim' }, '等級'), h('strong', null, `${owned.level} / ${def.maxLevel}`)),
          h('div', null, h('span', { class: 'dim' }, '生命'), h('strong', null, st.hp.toLocaleString())),
          h('div', null, h('span', { class: 'dim' }, '攻擊'), h('strong', null, st.atk.toLocaleString())),
          h('div', null, h('span', { class: 'dim' }, '回復'), h('strong', null, st.rcv.toLocaleString()))),
      ),
      skill && panel({ title: `主動技・${skill.name}` }, h('p', null, skill.description), h('p', { class: 'small-text dim' }, `冷卻 ${skill.cooldown.max} 回合（技能等級 ${owned.skillLevel}）`)),
      leader && panel({ title: `隊長技・${leader.name}` }, h('p', null, leader.description)),
      def.flavor && panel(null, h('p', { class: 'small-text dim' }, def.flavor)),
      h('div', { class: 'row' }, lockBtn, button('強化', { small: true, onClick: () => nav.go('enhance', [owned.uid]) }), def.evolution && button('進化', { small: true, onClick: () => nav.go('evolve', [owned.uid]) })),
    );
  },
};
