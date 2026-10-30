// 任務（每日／每週）與成就：顯示進度、領取獎勵、一鍵全部領取
import type { QuestDef } from '../../core/types';
import { gameData } from '../../data/load';
import { claimAllQuests, claimableQuests, claimQuest, questProgress, resetQuestsIfNeeded } from '../../progression/quests';
import { mergeRewards } from '../../progression/rewards';
import { badge, bar, button, emptyState, tabs } from '../components/basic';
import { toast } from '../components/overlay';
import { rewardChips, screenBanner } from '../components/rewards';
import { revealReward } from '../components/reward-reveal';
import { clear, h } from '../dom';
import { questDerived, sortQuests } from '../economy';
import type { Navigator, ScreenDef } from '../router';
import { questDestination } from '../quest-goto';
import { commit, getSave } from '../state';

type QuestTab = 'daily' | 'weekly';
let questTab: QuestTab = 'daily';

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
  const dest = questDestination(q, getSave(), gameData.stages, Date.now());
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
  const rows = sortQuests(gameData.quests.filter((q) => kinds.includes(q.kind)).map((q) => ({ q, ...questProgress(save, q, derived) })));
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
  render({ nav }) {
    const banner = h('div');
    const body = h('div', { class: 'quest-list' });
    const footer = h('div');
    const refresh = () => {
      clear(banner);
      clear(body);
      clear(footer);
      banner.append(screenBanner('quest-banner', '契印師的日課', questTab === 'daily' ? '每日任務於午夜 00:00 重置' : '每週任務於週一 00:00 重置'));
      body.append(...questList([questTab], refresh, nav));
      footer.append(claimAllButton([questTab], refresh));
    };
    refresh();
    return h('div', { class: 'economy-screen' },
      banner,
      tabs([{ id: 'daily', label: '每日任務' }, { id: 'weekly', label: '每週任務' }], questTab, (id) => { questTab = id; refresh(); }),
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
