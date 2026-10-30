// 流派圖鑑（GDD 2.0）：流派說明、收集進度、免抽入門、流派試煉入口
import { h } from '../dom';
import { gameData } from '../../data/load';
import { archetypeCodex, ROLE_LABEL, type CodexEntry } from '../../growth';
import { badge, bar, button, panel } from '../components/basic';
import { cardThumb } from '../components/card-thumb';
import { getSave, growth } from '../state';
import type { Navigator, ScreenDef } from '../router';

function codexCards(entry: CodexEntry): HTMLElement | null {
  if (!entry.cards.length) return null;
  return h(
    'div',
    { class: 'row wrap', style: { gap: '6px', margin: '6px 0' } },
    entry.cards.map((c) => {
      const def = growth.card(c.cardId);
      if (!def) return null;
      const el = cardThumb(def, { size: 48 });
      el.title = `${def.name}・${ROLE_LABEL[c.role]}${c.free ? '・免抽' : ''}`;
      if (!c.owned) el.classList.add('unowned');
      return el;
    }),
  );
}

function trialButtons(archetype: string, nav: Navigator): HTMLElement | null {
  const trials = gameData.stages.filter((s) => s.kind === 'trial' && s.archetype === archetype);
  if (!trials.length) return null;
  const cleared = new Set(getSave().progress.clearedStages);
  return h(
    'div',
    { class: 'row wrap', style: { marginTop: '6px' } },
    trials.map((s) =>
      button(cleared.has(s.id) ? `${s.name}（已通過）` : s.name, {
        small: true,
        variant: cleared.has(s.id) ? 'ghost' : 'primary',
        icon: 'sword',
        onClick: () => nav.go('prepare', [s.id]),
      }),
    ),
  );
}

export const archetypesScreen: ScreenDef = {
  name: 'archetypes',
  title: '流派圖鑑',
  chrome: 'sub',
  parent: 'home',
  render({ nav }) {
    const codex = new Map(archetypeCodex(getSave(), growth).map((e) => [e.id, e]));
    return h(
      'div',
      null,
      h('p', { class: 'dim small-text', style: { margin: '0 2px' } }, '同一盤珠，不同隊伍會用完全不同的轉法。用「流派試煉」借一支現成隊伍先玩玩看。'),
      gameData.archetypes.map((a, i) => {
        const entry = codex.get(a.id);
        return panel(
          entry?.playable ? { gold: true } : null,
          h(
            'div',
            { class: 'row between' },
            h('h3', { style: { margin: '0' } }, `${i + 1}. ${a.name}`),
            h('div', { class: 'row', style: { gap: '4px' } },
              entry?.playable && badge('可組隊', 'gold'),
              entry?.hasFreeLeader && badge('免抽入門'),
            ),
          ),
          h('p', { style: { marginTop: '6px' } }, a.summary),
          h('p', { class: 'small-text' }, h('strong', null, '轉法：'), a.howToPlay),
          h('p', { class: 'small-text dim' }, h('strong', null, '弱點：'), a.weakness),
          h('p', { class: 'small-text dim' }, h('strong', null, '入門：'), a.starterPath),
          entry && entry.total > 0 && h('div', null,
            bar({ value: entry.owned, max: entry.total, variant: 'gold', label: `收集 ${entry.owned} / ${entry.total}` }),
            codexCards(entry),
          ),
          trialButtons(a.id, nav),
        );
      }),
    );
  },
};
