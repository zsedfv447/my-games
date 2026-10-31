// 圖鑑：全部卡片的收集狀態（擁有過／見過／未見過）、篩選、卡片資料與收集獎勵
import { h } from '../dom';
import { gameData } from '../../data/load';
import { ARCHETYPE_IDS, ATTRIBUTES, RACES, type ArchetypeId, type Attribute, type Race } from '../../core/types';
import {
  cardSources, claimAllCollectionRewards, claimableCollection, claimCollectionReward, collectionEntries, collectionReward,
  collectionStatus, collectionSummary, ROLE_LABEL, type CollectionFilter, type CollectionStatus,
} from '../../growth';
import { ATTRIBUTE_NAMES, RACE_NAMES } from '../art/palette';
import { badge, bar, button, emptyState, panel, stars, tabs } from '../components/basic';
import { cardPortrait, cardThumb } from '../components/card-thumb';
import { toast } from '../components/overlay';
import { revealReward } from '../components/reward-reveal';
import { commit, getSave, growth } from '../state';
import type { ScreenDef } from '../router';
import { claimQuest, questProgress } from '../../progression/quests';
import { questDerived } from '../economy';
import { rewardChips } from '../components/rewards';
import '../collection-helper.css';

const STATUS_LABEL: Record<CollectionStatus, string> = { owned: '已取得', seen: '見過', unseen: '未發現' };
const archetypeName = (id: string) => gameData.archetypes.find((a) => a.id === id)?.name ?? id;

// 篩選條件在這次遊玩中保留，從卡片詳情返回時不用重選
let filter: CollectionFilter = {};

function select<T extends string>(label: string, value: T | undefined, options: { id: T; label: string }[], onChange: (v: T | undefined) => void): HTMLElement {
  const el = h('select', { class: 'codex-select', 'aria-label': label },
    h('option', { value: '' }, `${label}：全部`),
    options.map((o) => h('option', { value: o.id, selected: o.id === value }, o.label)));
  el.addEventListener('change', () => onChange((el.value || undefined) as T | undefined));
  return el;
}

function claimAll(after: () => void): void {
  const r = claimAllCollectionRewards(getSave(), growth);
  if (!r.ok || !r.cards.length) return toast('目前沒有可以領取的圖鑑獎勵');
  commit(r.save);
  void revealReward('圖鑑獎勵', { gems: r.gems }, `領取 ${r.cards.length} 張卡的圖鑑獎勵`);
  after();
}

/** 圖鑑完成度里程碑（quests.json 裡 counter 為 collectionPercent 的成就）：25%、50%、75%、100% 各領一次 */
const MILESTONES = gameData.quests.filter((q) => q.counter === 'collectionPercent').sort((a, b) => a.target - b.target);

function milestones(after: () => void): HTMLElement | null {
  if (!MILESTONES.length) return null;
  const save = getSave();
  const derived = questDerived(save);
  return h('div', { class: 'codex-milestones' }, MILESTONES.map((q) => {
    const p = questProgress(save, q, derived);
    const claim = () => {
      const r = claimQuest(getSave(), q, gameData.quests, gameData.config, Date.now(), questDerived(getSave()));
      if (!r.ok) return toast(r.reason === 'alreadyClaimed' ? '已經領過了' : '完成度還不夠');
      commit(r.save);
      void revealReward('圖鑑里程碑', q.reward, q.name);
      after();
    };
    return h('div', { class: ['codex-milestone', p.done && !p.claimed && 'ready', p.claimed && 'claimed'] },
      h('strong', null, `${q.target}%`),
      rewardChips(q.reward),
      p.claimed
        ? badge('已領取')
        : button(p.done ? '領取' : `${derived.collectionPercent ?? 0}%`, { small: true, variant: p.done ? 'primary' : 'ghost', disabled: !p.done, sound: false, onClick: claim }));
  }));
}

export const collectionScreen: ScreenDef = {
  name: 'collection',
  title: '圖鑑',
  chrome: 'sub',
  parent: 'home',
  render({ nav }) {
    const summaryHost = h('div');
    const grid = h('div', { class: 'card-grid codex-grid' });
    const count = h('span', { class: 'small-text dim' });

    const drawSummary = () => {
      const save = getSave();
      const sum = collectionSummary(save, growth);
      const claimable = claimableCollection(save, growth);
      const gems = claimable.reduce((n, id) => n + collectionReward(growth, id), 0);
      summaryHost.replaceChildren(panel(
        { gold: true },
        h('div', { class: 'row between' }, h('strong', null, `收集 ${sum.owned} / ${sum.total}`), h('span', { class: 'small-text dim' }, `見過 ${sum.seen}`)),
        bar({ value: sum.owned, max: sum.total, variant: 'gold' }),
        milestones(draw),
        h('div', { class: 'row wrap codex-rarity' },
          Object.entries(sum.byRarity).map(([r, b]) => h('span', { class: 'small-text' }, h('span', { class: 'stars' }, `${r}★`), ` ${b.owned}/${b.total}`)),
          h('span', { class: 'small-text' }, `素材 ${sum.materials.owned}/${sum.materials.total}`)),
        button(gems ? `全部領取（${claimable.length} 張）` : '沒有可領取的獎勵', {
          variant: 'primary', block: true, icon: 'gift', disabled: !gems,
          cost: gems ? { kind: 'gem', amount: gems } : undefined,
          onClick: () => claimAll(draw),
        }),
      ));
    };

    const drawGrid = () => {
      const list = collectionEntries(getSave(), growth, filter);
      count.textContent = `符合 ${list.length} 張`;
      grid.replaceChildren(...(list.length
        ? list.map(({ card, status, claimable }) => {
          const el = cardThumb(card, { size: 64, onClick: () => nav.go('collection-card', [card.id]) });
          el.classList.add(`codex-${status}`);
          el.title = status === 'unseen' ? '？？？' : card.name;
          if (status === 'unseen') el.setAttribute('aria-label', `${card.id} 未發現`);
          el.appendChild(h('span', { class: 'codex-no' }, card.id.replace(/^c/, 'No.')));
          if (claimable) el.appendChild(h('span', { class: 'codex-claim' }, `+${claimable}`));
          return el;
        })
        : [emptyState('book', '沒有符合條件的卡片')]));
    };

    const draw = () => { drawSummary(); drawGrid(); };
    const setFilter = (patch: Partial<CollectionFilter>) => { filter = { ...filter, ...patch }; drawGrid(); };
    draw();

    return h(
      'div',
      null,
      summaryHost,
      tabs<'all' | CollectionStatus>(
        [{ id: 'all', label: '全部' }, ...(['owned', 'seen', 'unseen'] as const).map((s) => ({ id: s, label: STATUS_LABEL[s] }))],
        filter.status ?? 'all',
        (id) => setFilter({ status: id === 'all' ? undefined : id }),
      ),
      h('div', { class: 'codex-filters' },
        select<Attribute>('屬性', filter.attribute, ATTRIBUTES.map((a) => ({ id: a, label: ATTRIBUTE_NAMES[a] })), (v) => setFilter({ attribute: v })),
        select<Race>('種族', filter.race, RACES.map((r) => ({ id: r, label: RACE_NAMES[r] })), (v) => setFilter({ race: v })),
        select<ArchetypeId>('流派', filter.archetype, ARCHETYPE_IDS.map((a) => ({ id: a, label: archetypeName(a) })), (v) => setFilter({ archetype: v }))),
      h('div', { class: 'row between' }, count, h('span', { class: 'small-text faint' }, '彩色＝已取得・灰＝見過・剪影＝未發現')),
      grid,
    );
  },
};

function sourceLines(cardId: string): string[] {
  const s = cardSources(growth, cardId);
  const stageName = (id: string) => gameData.stages.find((x) => x.id === id)?.name ?? id;
  const lines: string[] = [];
  if (s.stages.length) lines.push(`關卡：${s.stages.slice(0, 4).map(stageName).join('、')}${s.stages.length > 4 ? ` 等 ${s.stages.length} 關` : ''}`);
  if (s.gacha.length) lines.push(`召喚：${s.gacha.map((id) => gameData.gachaPools.find((p) => p.id === id)?.name ?? id).join('、')}`);
  if (s.shop.length) lines.push('商店兌換');
  if (s.quests.length) lines.push('任務／成就獎勵');
  if (s.evolvesFrom) lines.push(`由「${growth.card(s.evolvesFrom)?.name ?? s.evolvesFrom}」進化`);
  return lines;
}

export const collectionCardScreen: ScreenDef = {
  name: 'collection-card',
  title: '圖鑑資料',
  chrome: 'sub',
  parent: 'collection',
  render({ route, nav }) {
    const def = growth.card(route.args[0] ?? '');
    if (!def) return h('div', null, emptyState('book', '找不到這張卡片'));
    const save = getSave();
    const status = collectionStatus(save, def.id);
    const sources = sourceLines(def.id);
    const sourcePanel = sources.length > 0 && panel({ title: '取得途徑' }, h('ul', { class: 'small-text codex-list' }, sources.map((l) => h('li', null, l))));

    if (status === 'unseen') {
      return h(
        'div',
        { class: 'codex-detail' },
        h('div', { class: 'codex-unseen-art' }, cardPortrait(def)),
        panel(null, h('div', { class: 'row between' }, h('h2', { style: { margin: '0' } }, '？？？'), stars(def.rarity)),
          h('p', { class: 'small-text dim' }, `${def.id.replace(/^c/, 'No.')}・還沒見過這張卡。在召喚卡池、關卡或取得後就會登錄到圖鑑。`)),
        sourcePanel,
      );
    }

    const skill = def.activeSkill ? growth.skill(def.activeSkill) : undefined;
    const leader = def.leaderSkill ? growth.leaderSkill(def.leaderSkill) : undefined;
    const reward = collectionReward(growth, def.id);
    const claimed = save.collection.claimed.includes(def.id);
    const evoFrom = growth.evolvesFrom(def.id);
    const evoTo = def.evolution?.to;
    const stat = (label: string, [lv1, max]: [number, number]) =>
      h('div', null, h('span', { class: 'dim' }, label), h('strong', null, max.toLocaleString()), h('span', { class: 'faint small-text' }, `Lv1 ${lv1.toLocaleString()}`));
    const evoLink = (id: string, prefix: string) => {
      const c = growth.card(id);
      if (!c) return null;
      const known = collectionStatus(save, id) !== 'unseen';
      return button(`${prefix}${known ? c.name : '？？？'}`, { small: true, variant: 'ghost', onClick: () => nav.replace('collection-card', [id]) });
    };

    return h(
      'div',
      { class: 'codex-detail' },
      h('div', { class: status === 'seen' ? 'codex-seen-art' : undefined }, cardPortrait(def)),
      panel(
        null,
        h('div', { class: 'row between' }, h('h2', { style: { margin: '0' } }, def.name), stars(def.rarity)),
        h('div', { class: 'row wrap', style: { gap: '4px', margin: '6px 0' } },
          badge(STATUS_LABEL[status], status === 'owned' ? 'gold' : undefined),
          badge(`${ATTRIBUTE_NAMES[def.attribute]}屬性`, `attr-${def.attribute}`), badge(RACE_NAMES[def.race]), badge(`Cost ${def.cost}`),
          def.archetypes.map((a) => badge(`${archetypeName(a.id)}・${ROLE_LABEL[a.role]}`, 'gold'))),
        def.race !== 'material' && h('div', { class: 'stat-row' },
          h('div', null, h('span', { class: 'dim' }, '最大等級'), h('strong', null, String(def.maxLevel))),
          stat('生命', def.stats.hp), stat('攻擊', def.stats.atk), stat('回復', def.stats.rcv)),
      ),
      skill && panel({ title: `主動技・${skill.name}` }, h('p', null, skill.description), h('p', { class: 'small-text dim' }, `冷卻 ${skill.cooldown.max} 回合（最短 ${skill.cooldown.min}）`)),
      leader && panel({ title: `隊長技・${leader.name}` }, h('p', null, leader.description)),
      def.flavor && panel({ title: '背景故事' }, h('p', { class: 'small-text', style: { lineHeight: '1.7' } }, def.flavor)),
      (evoFrom || evoTo) && panel({ title: '進化' }, h('div', { class: 'row wrap' }, evoFrom && evoLink(evoFrom, '← '), evoTo && evoLink(evoTo, '→ '))),
      sourcePanel,
      reward > 0 && panel(
        { title: '收集獎勵' },
        h('p', { class: 'small-text dim' }, `取得過這張卡就能領取星晶 ×${reward}。`),
        button(claimed ? '已領取' : status === 'owned' ? '領取' : '尚未取得', {
          variant: 'primary', block: true, disabled: claimed || status !== 'owned', cost: { kind: 'gem', amount: reward },
          onClick: () => {
            const r = claimCollectionReward(getSave(), growth, def.id);
            if (!r.ok) return toast(r.error.message);
            commit(r.save);
            void revealReward('圖鑑獎勵', { gems: r.gems }, def.name);
            nav.replace('collection-card', [def.id]);
          },
        }),
      ),
    );
  },
};
