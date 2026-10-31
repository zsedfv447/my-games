// 星骸觀測錄（敵人圖鑑）：圖鑑頁的「敵人」分頁＋單隻敵人詳情
import { h, svg } from '../dom';
import { gameData } from '../../data/load';
import type { EnemyAbility, EnemyDef } from '../../core/types';
import { bestiaryEntries, type BestiaryEntry } from '../../progression/bestiary';
import { ATTRIBUTE_NAMES } from '../art/palette';
import { enemySvg } from '../art/enemy';
import { enemyArtUrl } from '../art/enemy-art';
import { badge, bar, emptyState, listItem, panel, tabs } from '../components/basic';
import { getSave } from '../state';
import { statusDetail, statusName } from '../status-labels';
import type { Navigator, ScreenDef } from '../router';
import '../bestiary.css';

/** 圖鑑頁上方的「卡片／敵人」切換 */
export function codexSwitch(active: 'cards' | 'enemies', nav: Navigator): HTMLElement {
  return tabs<'cards' | 'enemies'>([{ id: 'cards', label: '卡片' }, { id: 'enemies', label: '敵人・星骸觀測錄' }], active,
    (id) => { if (id !== active) nav.replace(id === 'cards' ? 'collection' : 'bestiary'); });
}

const entries = () => bestiaryEntries(getSave(), gameData.enemies, gameData.stages);
const isBoss = (e: BestiaryEntry) => e.boss;

function enemyArt(e: EnemyDef, boss: boolean): HTMLElement {
  const url = enemyArtUrl(e);
  return h('div', { class: 'enemy-art' }, url ? h('img', { src: url, alt: e.name, loading: 'lazy', draggable: 'false' }) : svg(enemySvg({ ...e, boss })));
}

const TRIGGER_TEXT: Record<EnemyAbility['trigger'], (a: EnemyAbility) => string> = {
  onStart: () => '登場時',
  onAttack: () => '攻擊時',
  hpBelow: (a) => `生命低於 ${a.params?.percent ?? '?'}% 時`,
  everyNTurns: (a) => `每 ${a.params?.n ?? '?'} 回合`,
};

/** 能力名稱；有指定屬性的（屬性減傷等）帶上屬性名，星紋封印由 statusName 處理 */
function abilityName(a: EnemyAbility): string {
  const name = statusName(a.status, a.params);
  const attr = a.params?.attribute;
  if (a.status === 'attributeSeal' || typeof attr !== 'string') return name;
  const names = attr.split(',').map((x) => ATTRIBUTE_NAMES[x.trim() as keyof typeof ATTRIBUTE_NAMES]).filter(Boolean);
  return names.length ? `${name}・${names.join('')}` : name;
}

export function abilityLines(e: EnemyDef): { title: string; detail: string }[] {
  return e.abilities.map((a) => ({
    title: `${TRIGGER_TEXT[a.trigger](a)}・${abilityName(a)}${a.value !== undefined ? ` ${a.value}` : ''}${a.turns ? `（${a.turns} 回合）` : ''}`,
    detail: statusDetail(a.status),
  }));
}

export const bestiaryScreen: ScreenDef = {
  name: 'bestiary',
  title: '圖鑑',
  chrome: 'sub',
  parent: 'home',
  render({ nav }) {
    const list = entries();
    const seen = list.filter((e) => e.seen).length;
    return h('div', null,
      codexSwitch('enemies', nav),
      panel({ gold: true },
        h('div', { class: 'row between' }, h('strong', null, `觀測 ${seen} / ${list.length}`), h('span', { class: 'small-text dim' }, '開戰就會記錄')),
        bar({ value: seen, max: list.length, variant: 'gold' })),
      list.length
        ? h('div', { class: 'card-grid bestiary-grid' }, list.map((e) => h('button', {
          type: 'button',
          class: ['bestiary-cell', !e.seen && 'unseen', `card-attr-${e.enemy.attribute}`],
          'aria-label': e.seen ? e.enemy.name : `${e.enemy.id} 未觀測`,
          onClick: () => nav.go('bestiary-enemy', [e.enemy.id]),
        },
        enemyArt(e.enemy, isBoss(e)),
        h('span', { class: 'bestiary-no' }, e.enemy.id.replace(/^e0*/, 'No.')),
        isBoss(e) && h('span', { class: 'bestiary-boss' }, 'BOSS'),
        h('span', { class: 'bestiary-name' }, e.seen ? e.enemy.name : '？？？'))))
        : emptyState('book', '還沒有可以觀測的敵人'));
  },
};

export const bestiaryEnemyScreen: ScreenDef = {
  name: 'bestiary-enemy',
  title: '星骸觀測錄',
  chrome: 'sub',
  parent: 'bestiary',
  render({ route, nav }) {
    const e = entries().find((x) => x.enemy.id === route.args[0]);
    if (!e) return h('div', null, emptyState('book', '圖鑑裡沒有這隻敵人'));
    const stageName = (id: string) => gameData.stages.find((s) => s.id === id)?.name ?? id;
    const where = panel({ title: '出現的關卡' }, e.stages.map((s) => listItem({
      title: s.name, sub: s.id,
      onClick: () => { if (s.kind === 'main' && s.chapter) nav.go('stages', [s.chapter]); },
    })));
    if (!e.seen) {
      return h('div', { class: 'bestiary-detail' },
        h('div', { class: 'unseen' }, enemyArt(e.enemy, isBoss(e))),
        panel(null, h('h2', { style: { margin: '0' } }, '？？？'), h('p', { class: 'small-text dim' }, `在下列關卡開戰後就會記錄。`)),
        where);
    }
    return h('div', { class: 'bestiary-detail' },
      enemyArt(e.enemy, isBoss(e)),
      panel(null,
        h('div', { class: 'row between' }, h('h2', { style: { margin: '0' } }, e.enemy.name), isBoss(e) && badge('BOSS', 'gold')),
        h('div', { class: 'row wrap', style: { gap: '4px', margin: '6px 0' } },
          badge(`${ATTRIBUTE_NAMES[e.enemy.attribute]}屬性`, `attr-${e.enemy.attribute}`), badge(`攻擊間隔 ${e.enemy.cd} 回合`)),
        e.echoOf && h('button', { type: 'button', class: 'bestiary-echo', onClick: () => nav.go('bestiary-enemy', [e.echoOf!.id]) },
          `原 Boss：${e.echoOf.name} →`)),
      panel({ title: '能力' }, e.enemy.abilities.length
        ? abilityLines(e.enemy).map((a) => h('div', { class: 'bestiary-ability' }, h('strong', null, a.title), a.detail && h('p', { class: 'small-text dim' }, a.detail)))
        : h('p', { class: 'small-text dim' }, '沒有特殊能力')),
      where,
      h('p', { class: 'small-text faint' }, `最早出現：${stageName(e.stages[0]?.id ?? '')}`),
    );
  },
};
