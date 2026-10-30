// 卡片背包與卡片詳情
import { h } from '../dom';
import { gameData } from '../../data/load';
import { computeStats, inventoryUsage, ROLE_LABEL, setLocked, sortCards, type SortKey } from '../../growth';
import { ATTRIBUTE_NAMES, RACE_NAMES } from '../art/palette';
import { badge, button, emptyState, panel, stars, tabs } from '../components/basic';
import { cardPortrait, cardThumb } from '../components/card-thumb';
import { toast } from '../components/overlay';
import { commit, getSave, growth } from '../state';
import type { ScreenDef } from '../router';

let sortKey: SortKey = 'obtainedAt';

export const cardsScreen: ScreenDef = {
  name: 'cards',
  title: '卡片背包',
  chrome: 'full',
  tab: 'cards',
  parent: 'home',
  render({ nav }) {
    const grid = h('div', { class: 'card-grid' });
    const draw = () => {
      const save = getSave();
      const list = sortCards(save.inventory.cards, growth, sortKey);
      grid.replaceChildren(...list.map((c) => {
        const def = growth.card(c.cardId);
        return def ? cardThumb(def, { level: c.level, locked: c.locked, size: 70, onClick: () => nav.go('card', [c.uid]) }) : null;
      }).filter((x): x is HTMLElement => !!x));
    };
    draw();
    const usage = inventoryUsage(getSave());
    return h(
      'div',
      null,
      h('div', { class: 'row between' }, h('span', { class: 'small-text dim' }, `背包 ${usage.used} / ${usage.capacity}`)),
      tabs<SortKey>([
        { id: 'obtainedAt', label: '新取得' }, { id: 'rarity', label: '稀有度' }, { id: 'level', label: '等級' }, { id: 'attribute', label: '屬性' },
      ], sortKey, (k) => { sortKey = k; draw(); }),
      usage.used ? grid : emptyState('cards', '背包是空的', '通關關卡或召喚可以取得卡片'),
    );
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
