// 任務（每日／每週）與成就：顯示進度、領取獎勵、一鍵全部領取
import type { QuestDef } from '../../core/types';
import { gameData } from '../../data/load';
import { claimAllQuests, claimableQuests, claimQuest, questProgress, resetQuestsIfNeeded } from '../../progression/quests';
import { mergeRewards } from '../../progression/rewards';
import { badge, bar, button, emptyState, icon, listItem, panel, tabs } from '../components/basic';
import { cardThumb } from '../components/card-thumb';
import { nurtureSteps, nurtureTarget } from '../../progression/nurture';
import { toast } from '../components/overlay';
import { rewardChips, screenBanner } from '../components/rewards';
import { revealReward } from '../components/reward-reveal';
import { clear, h } from '../dom';
import { questDerived, sortQuests } from '../economy';
import type { Navigator, ScreenDef } from '../router';
import { questDestination } from '../quest-goto';
import { commit, getSave } from '../state';
import type { IconName } from '../art/icons';
import { weeklyChecklist, type ChecklistId } from '../weekly-checklist';

/** journey：養成之路（新手契約領完後出現，全部領完後隱藏）；contract：本週契約（各系統本週進度的總覽，不是任務） */
type QuestTab = 'starter' | 'journey' | 'daily' | 'weekly' | 'contract';
let questTab: QuestTab | null = null;

const BANNER_SUB: Record<QuestTab, string> = {
  starter: '一步步熟悉契約的每個角落，完成可領星晶（只能領一次）',
  journey: '挑一位夥伴，走一次強化、滿級、收集素材到進化（只能領一次）',
  daily: '每日任務於午夜 00:00 重置',
  weekly: '每週任務於週一 00:00 重置',
  contract: '克星週、星淵、遠行、誓約碑、謎題的本週進度，點一下前往',
};

/** 本週契約清單：每一列點了前往該畫面 */
function contractList(nav: Navigator): HTMLElement[] {
  const rows = weeklyChecklist(getSave(), Date.now(), gameData);
  return rows.map((r) => listItem({
    leading: icon(CONTRACT_ICON[r.id]),
    title: h('span', { class: 'row between' }, h('span', null, r.title), h('strong', { class: ['contract-progress', r.done && 'done'] }, r.open ? r.progress : '未開放')),
    sub: r.hint,
    locked: !r.open,
    trailing: r.done ? badge('完成', 'gold') : undefined,
    onClick: () => nav.go(r.to[0], r.to[1]),
  }));
}

const CONTRACT_ICON: Record<ChecklistId, IconName> = {
  nemesis: 'trophy', abyss: 'tower', expedition: 'adventure', oath: 'scroll', puzzle: 'puzzle',
};

/** 養成之路：新手契約領完後出現，四步都領完後隱藏 */
function journeyOpen(): boolean {
  const claimed = new Set(getSave().quests.claimed);
  return gameData.quests.some((q) => q.kind === 'journey' && !claimed.has(q.id));
}

/** 養成之路分頁上方：這張卡的整條進化路線（目前等級、素材、金幣） */
function journeyPath(): HTMLElement | null {
  const save = getSave();
  const line = nurtureTarget(save, gameData.cards, gameData.stages);
  if (!line) return null;
  const steps = nurtureSteps(save, line);
  const cardOf = (id: string) => gameData.cards.find((c) => c.id === id);
  const sourceStage = line.source ? gameData.stages.find((s) => s.id === line.source) : undefined;
  return panel({ title: '養成之路' },
    h('div', { class: 'journey-path' },
      h('div', { class: 'journey-card' }, cardThumb(line.base, { size: 56, level: line.owned?.level }), h('small', null, `${line.base.rarity}★ ${line.base.name}`)),
      h('span', { class: 'journey-arrow' }, '→'),
      h('div', { class: ['journey-card', !steps.evolved && 'pending'] }, cardThumb(line.to, { size: 56 }), h('small', null, `${line.to.rarity}★ ${line.to.name}`))),
    h('div', { class: 'journey-needs small-text' },
      h('span', null, line.owned ? `等級 ${steps.evolved ? '已進化' : `${line.owned.level} / ${line.base.maxLevel}`}` : sourceStage ? `還沒有這張卡：通過「${sourceStage.name}」可以拿到` : '還沒有這張卡'),
      line.materials.map((m) => h('span', null, `${cardOf(m.card)?.name ?? m.card} ${steps.evolved ? m.need : m.have}/${m.need}`)),
      h('span', null, `金幣 ${line.coin.toLocaleString()}`)));
}

/** 新手契約還有沒領完的（全部領完後分頁隱藏） */
function starterOpen(): boolean {
  const claimed = new Set(getSave().quests.claimed);
  return gameData.quests.some((q) => q.kind === 'starter' && !claimed.has(q.id));
}

/** 一鍵領取（規則在 progression/quests.ts 的 claimAllQuests）；回傳領取數 */
export function claimAll(kinds: QuestDef['kind'][]): number {
  const { save, claimed } = claimAllQuests(getSave(), kinds, gameData.quests, gameData.config, Date.now(), questDerived);
  if (!claimed.length) return 0;
  commit(save);
  const total = mergeRewards(...claimed.map((q) => q.reward));
  void revealReward('任務獎勵', total, `領取 ${claimed.length} 項`);
  return claimed.length;
}

function claimOne(q: QuestDef): void {
  const now = Date.now();
  const save = getSave();
  const r = claimQuest(save, q, gameData.quests, gameData.config, now, questDerived(save));
  if (!r.ok) {
    toast(r.reason === 'alreadyClaimed' ? '已經領過了' : '尚未達成');
    return;
  }
  commit(r.save);
  void revealReward(q.kind === 'achievement' ? '成就達成' : '任務完成', q.reward, q.name);
}

/** 未完成的任務：有對應畫面就「前往」，沒有就維持「進行中」 */
function goButton(q: QuestDef, nav: Navigator): HTMLButtonElement {
  const dest = questDestination(q, getSave(), gameData.stages, Date.now(), gameData.cards);
  if (!dest) return button('進行中', { small: true, variant: 'ghost', disabled: true, sound: false });
  return button('前往', { small: true, variant: 'ghost', onClick: () => nav.go(dest.name, dest.args) });
}

function questRow(q: QuestDef, p: ReturnType<typeof questProgress>, refresh: () => void, nav: Navigator): HTMLElement {
  return h('div', { class: ['quest-row', p.done && !p.claimed && 'ready', p.claimed && 'claimed'] },
    h('div', { class: 'quest-row-main' },
      h('strong', null, q.name),
      rewardChips(q.reward),
      bar({ value: p.value, max: q.target, variant: p.done ? 'gold' : 'exp', label: `${p.value.toLocaleString()} / ${q.target.toLocaleString()}` })),
    p.claimed
      ? badge('已領取')
      : p.done
        ? button('領取', { small: true, variant: 'primary', sound: false, onClick: () => { claimOne(q); refresh(); } })
        : goButton(q, nav));
}

function questList(kinds: QuestDef['kind'][], refresh: () => void, nav: Navigator): HTMLElement[] {
  const save = resetQuestsIfNeeded(getSave(), gameData.quests, Date.now());
  const derived = questDerived(save);
  const all = gameData.quests.filter((q) => kinds.includes(q.kind)).map((q) => ({ q, ...questProgress(save, q, derived) }));
  // 養成之路是依序的步驟，照資料順序排；其他分頁可領的排前面
  const rows = kinds.includes('journey') ? all : sortQuests(all);
  if (!rows.length) return [emptyState('quest', '目前沒有任務')];
  return rows.map(({ q, ...p }) => questRow(q, p, refresh, nav));
}

function claimAllButton(kinds: QuestDef['kind'][], refresh: () => void): HTMLButtonElement {
  const save = getSave();
  const n = claimableQuests(save, gameData.quests, Date.now(), questDerived(save)).filter((q) => kinds.includes(q.kind)).length;
  return button(n ? `全部領取（${n}）` : '沒有可領取的獎勵', { variant: 'primary', block: true, disabled: !n, sound: false, onClick: () => { claimAll(kinds); refresh(); } });
}

export const questsScreen: ScreenDef = {
  name: 'quests',
  title: '任務',
  chrome: 'sub',
  parent: 'home',
  render({ nav, route }) {
    if (route.args[0] === 'contract') questTab = 'contract';
    const banner = h('div');
    const tabBar = h('div');
    const body = h('div', { class: 'quest-list' });
    const footer = h('div');
    const refresh = () => {
      clear(banner);
      clear(tabBar);
      clear(body);
      clear(footer);
      // 新手契約全部領完就隱藏分頁；沒選過分頁時，新手先看新手契約
      const starter = starterOpen();
      const journey = !starter && journeyOpen();
      const fallback: QuestTab = starter ? 'starter' : journey ? 'journey' : 'daily';
      const tab: QuestTab = (questTab === 'starter' && !starter) || (questTab === 'journey' && !journey) ? fallback : questTab ?? fallback;
      banner.append(screenBanner('quest-banner', '契印師的日課', BANNER_SUB[tab]));
      tabBar.append(tabs([
        ...(starter ? [{ id: 'starter' as const, label: '新手契約' }] : []),
        ...(journey ? [{ id: 'journey' as const, label: '養成之路' }] : []),
        { id: 'daily' as const, label: '每日任務' },
        { id: 'weekly' as const, label: '每週任務' },
        { id: 'contract' as const, label: '本週' },
      ], tab, (id) => { questTab = id; refresh(); }));
      if (tab === 'contract') {
        body.append(...contractList(nav));
        return;
      }
      if (tab === 'journey') { const path = journeyPath(); if (path) body.append(path); }
      body.append(...questList([tab], refresh, nav));
      footer.append(claimAllButton([tab], refresh));
    };
    refresh();
    return h('div', { class: 'economy-screen' },
      banner,
      tabBar,
      footer,
      body,
      button('查看成就', { variant: 'ghost', block: true, icon: 'trophy', onClick: () => nav.go('achievements') }));
  },
};

export const achievementsScreen: ScreenDef = {
  name: 'achievements',
  title: '成就',
  chrome: 'sub',
  parent: 'home',
  render({ nav }) {
    const head = h('div');
    const body = h('div', { class: 'quest-list' });
    const refresh = () => {
      clear(head);
      clear(body);
      const save = getSave();
      const all = gameData.quests.filter((q) => q.kind === 'achievement');
      const derived = questDerived(save);
      const done = all.filter((q) => questProgress(save, q, derived).done).length;
      head.append(
        h('div', { class: 'achievement-summary' }, h('span', null, '達成'), h('strong', null, `${done} / ${all.length}`)),
        bar({ value: done, max: all.length, variant: 'gold' }),
        claimAllButton(['achievement'], refresh),
      );
      body.append(...questList(['achievement'], refresh, nav));
    };
    refresh();
    return h('div', { class: 'economy-screen' }, screenBanner('quest-banner', '星痕紀錄', '一生只能領一次的榮耀'), head, body);
  },
};
