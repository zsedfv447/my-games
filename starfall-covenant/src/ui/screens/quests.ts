// 任務（每日／每週）與成就：顯示進度、領取獎勵、一鍵全部領取
import type { QuestDef } from '../../core/types';
import { gameData } from '../../data/load';
import { claimableQuests, claimQuest, questProgress, resetQuestsIfNeeded } from '../../progression/quests';
import { mergeRewards } from '../../progression/rewards';
import { audio } from '../audio';
import { badge, bar, button, emptyState, tabs } from '../components/basic';
import { toast } from '../components/overlay';
import { rewardChips, screenBanner } from '../components/rewards';
import { clear, h } from '../dom';
import { questDerived, rewardParts, sortQuests } from '../economy';
import type { ScreenDef } from '../router';
import { commit, getSave } from '../state';

type QuestTab = 'daily' | 'weekly';
let questTab: QuestTab = 'daily';

/** 領取多個任務（逐一套用；後面的任務可能因前面的領取而達標，例如「領取 5 個每日任務」） */
export function claimAll(kinds: QuestDef['kind'][]): number {
  const now = Date.now();
  let save = resetQuestsIfNeeded(getSave(), gameData.quests, now);
  const got: QuestDef[] = [];
  for (let guard = 0; guard < 3; guard++) {
    const ready = claimableQuests(save, gameData.quests, now, questDerived(save)).filter((q) => kinds.includes(q.kind));
    if (!ready.length) break;
    for (const q of ready) {
      const r = claimQuest(save, q, gameData.quests, gameData.config, now, questDerived(save));
      if (r.ok) { save = r.save; got.push(q); }
    }
  }
  if (!got.length) return 0;
  commit(save);
  audio.play('confirm');
  const total = mergeRewards(...got.map((q) => q.reward));
  toast(`領取 ${got.length} 項：${rewardParts(total).map((p) => p.label).join('、')}`, 2600);
  return got.length;
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
  audio.play('confirm');
  toast(`獲得 ${rewardParts(q.reward).map((p) => p.label).join('、')}`);
}

function questRow(q: QuestDef, p: ReturnType<typeof questProgress>, refresh: () => void): HTMLElement {
  return h('div', { class: ['quest-row', p.done && !p.claimed && 'ready', p.claimed && 'claimed'] },
    h('div', { class: 'quest-row-main' },
      h('strong', null, q.name),
      rewardChips(q.reward),
      bar({ value: p.value, max: q.target, variant: p.done ? 'gold' : 'exp', label: `${p.value.toLocaleString()} / ${q.target.toLocaleString()}` })),
    p.claimed
      ? badge('已領取')
      : button(p.done ? '領取' : '進行中', { small: true, variant: p.done ? 'primary' : 'ghost', disabled: !p.done, sound: false, onClick: () => { claimOne(q); refresh(); } }));
}

function questList(kinds: QuestDef['kind'][], refresh: () => void): HTMLElement[] {
  const save = resetQuestsIfNeeded(getSave(), gameData.quests, Date.now());
  const derived = questDerived(save);
  const rows = sortQuests(gameData.quests.filter((q) => kinds.includes(q.kind)).map((q) => ({ q, ...questProgress(save, q, derived) })));
  if (!rows.length) return [emptyState('quest', '目前沒有任務')];
  return rows.map(({ q, ...p }) => questRow(q, p, refresh));
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
      body.append(...questList([questTab], refresh));
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
  render() {
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
      body.append(...questList(['achievement'], refresh));
    };
    refresh();
    return h('div', { class: 'economy-screen' }, screenBanner('quest-banner', '星痕紀錄', '一生只能領一次的榮耀'), head, body);
  },
};
