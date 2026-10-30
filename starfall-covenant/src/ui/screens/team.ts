// 隊伍編成：5 組隊伍切換、換人、Cost 上限、流派提示（growth/archetype.ts 的 analyzeTeam）
import { h } from '../dom';
import { gameData } from '../../data/load';
import { analyzeTeam, ROLE_LABEL } from '../../growth';
import { teamCostLimit } from '../../progression/player';
import { badge, bar, panel, tabs } from '../components/basic';
import { cardThumb, emptySlot } from '../components/card-thumb';
import { pickCard } from '../components/card-picker';
import { toast } from '../components/overlay';
import { commit, getSave, growth } from '../state';
import type { ScreenDef } from '../router';

const archetypeName = (id: string | null) => (id ? gameData.archetypes.find((a) => a.id === id)?.name ?? id : '未定');

export function teamCost(uids: (string | null)[]): number {
  const save = getSave();
  return uids.reduce((sum, uid) => {
    const c = uid ? save.inventory.cards.find((x) => x.uid === uid) : undefined;
    return sum + (c ? growth.card(c.cardId)?.cost ?? 0 : 0);
  }, 0);
}

export const teamScreen: ScreenDef = {
  name: 'team',
  title: '隊伍編成',
  chrome: 'full',
  tab: 'team',
  parent: 'home',
  render() {
    const host = h('div', { style: { display: 'contents' } });
    const draw = () => {
      const save = getSave();
      const index = save.activeTeam;
      const team = save.teams[index];
      const limit = teamCostLimit(save.player.level);
      const cost = teamCost(team.members);
      const report = analyzeTeam(save, growth, team.members);
      const fit = new Map(report.members.map((m) => [m.uid, m]));

      const setMember = (slot: number, uid: string | null) => {
        if (slot === 0 && !uid) return toast('隊長不能留空');
        const s = getSave();
        const members = [...s.teams[index].members];
        const from = uid ? members.indexOf(uid) : -1;
        if (from >= 0) members[from] = members[slot];
        members[slot] = uid;
        if (teamCost(members) > limit) return toast(`超過隊伍空間上限 ${limit}`);
        const teams = s.teams.map((t, i) => (i === index ? { ...t, members } : t));
        commit({ ...s, teams });
        draw();
      };

      host.replaceChildren(
        tabs(save.teams.map((_, i) => ({ id: String(i), label: `隊伍 ${i + 1}` })), String(index), (id) => {
          commit({ ...getSave(), activeTeam: Number(id) });
          draw();
        }),
        panel(
          { title: team.name },
          h('div', { class: 'team-slots' },
            team.members.map((uid, slot) => {
              const owned = uid ? save.inventory.cards.find((c) => c.uid === uid) : undefined;
              const def = owned && growth.card(owned.cardId);
              const pick = () => pickCard(slot === 0 ? '選擇隊長' : `選擇第 ${slot + 1} 位隊員`, { exclude: new Set(team.members.filter((u): u is string => !!u && u !== uid)), allowRemove: !!uid && slot > 0 }, (picked) => setMember(slot, picked));
              const el = def ? cardThumb(def, { level: owned!.level, size: 60, onClick: pick }) : emptySlot(pick, 60);
              const f = uid ? fit.get(uid) : undefined;
              if (f && !f.fits) el.classList.add('misfit');
              return h('div', { class: 'team-slot' }, el, h('span', { class: 'small-text dim' }, slot === 0 ? '隊長' : f?.role ? ROLE_LABEL[f.role] : ''));
            })),
          h('div', { style: { marginTop: '8px' } }, bar({ value: cost, max: limit, variant: cost > limit ? 'hp' : 'gold', label: `隊伍空間 ${cost} / ${limit}` })),
        ),
        panel(
          { title: '流派分析' },
          h('div', { class: 'row wrap', style: { gap: '6px' } },
            badge(`主流派：${archetypeName(report.primary)}`, 'gold'),
            report.secondary && badge(`混搭：${archetypeName(report.secondary)}`),
            badge(`契合度 ${Math.round(report.completion * 100)}%`)),
          report.missingRoles.length > 0 && h('p', { class: 'small-text', style: { marginTop: '8px' } }, `還缺：${report.missingRoles.map((r) => ROLE_LABEL[r]).join('、')}卡`),
          report.members.filter((m) => !m.fits).map((m) => h('p', { class: 'small-text dim' }, `${growth.card(m.cardId)?.name}：${m.reasons.join('；')}`)),
          report.suggestions.length > 0 && h('div', null,
            h('p', { class: 'small-text', style: { margin: '8px 0 4px' } }, '背包裡適合換上的卡'),
            h('div', { class: 'row wrap', style: { gap: '6px' } }, report.suggestions.map((uid) => {
              const c = save.inventory.cards.find((x) => x.uid === uid)!;
              return cardThumb(growth.card(c.cardId)!, { level: c.level, size: 48 });
            }))),
        ),
      );
    };
    draw();
    return h('div', null, host);
  },
};
