// 隊伍編成：5 組隊伍切換、換人、Cost 上限、流派提示（growth/archetype.ts 的 analyzeTeam）
import { h } from '../dom';
import { gameData } from '../../data/load';
import { analyzeTeam, ROLE_LABEL, skillCooldown } from '../../growth';
import { teamCostLimit } from '../../progression/player';
import { badge, bar, button, panel, tabs } from '../components/basic';
import { cardThumb, emptySlot } from '../components/card-thumb';
import { pickCard } from '../components/card-picker';
import { openDialog, toast } from '../components/overlay';
import { commit, getSave, growth } from '../state';
import type { ScreenDef } from '../router';
import { overCostText, suggestSwapOut } from '../team-cost-hint';
import { previewSwap } from '../team-compare';
import { cleanTeamName, leaderHighlights, TEAM_NAME_MAX, teamTotals } from '../team-summary';
import '../convenience.css';
import { LABEL } from '../wording';

const archetypeName = (id: string | null) => (id ? gameData.archetypes.find((a) => a.id === id)?.name ?? id : '未定');

export function teamCost(uids: (string | null)[]): number {
  const save = getSave();
  return uids.reduce((sum, uid) => {
    const c = uid ? save.inventory.cards.find((x) => x.uid === uid) : undefined;
    return sum + (c ? growth.card(c.cardId)?.cost ?? 0 : 0);
  }, 0);
}

function renameTeam(index: number, done: () => void): void {
  const input = h('input', { class: 'text-input', type: 'text', maxlength: String(TEAM_NAME_MAX), value: getSave().teams[index].name, 'aria-label': '隊伍名稱' }) as HTMLInputElement;
  const save = () => {
    const name = cleanTeamName(input.value);
    dlg.close();
    if (!name) return;
    const s = getSave();
    commit({ ...s, teams: s.teams.map((t, i) => (i === index ? { ...t, name } : t)) });
    done();
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
  const dlg = openDialog('隊伍名稱', h('div', null, input, h('p', { class: 'small-text dim' }, `最多 ${TEAM_NAME_MAX} 個字`)), [
    button('取消', { variant: 'ghost', sound: 'back', onClick: () => dlg.close() }),
    button(LABEL.ok, { variant: 'primary', onClick: save }),
  ]);
  setTimeout(() => { input.focus(); input.select(); }, 50);
}

const fmt = (n: number) => n.toLocaleString();

const signed = (n: number) => (n > 0 ? `+${fmt(n)}` : n < 0 ? `−${fmt(-n)}` : '±0');

/** 選卡時的比較：換上後隊伍總生命／回復／Cost 的增減、主動技 CD、吃不吃得到隊長技 */
function swapPreview(uids: (string | null)[], slot: number, candUid: string, limit: number): HTMLElement {
  const save = getSave();
  const toMember = (uid: string | null) => {
    const c = uid ? save.inventory.cards.find((x) => x.uid === uid) : undefined;
    const card = c && growth.card(c.cardId);
    return c && card ? { card, level: c.level, awakened: c.awakened, skillLevel: c.skillLevel } : null;
  };
  const cand = toMember(candUid)!;
  const leaderOf = (card: { leaderSkill?: string }) => (card.leaderSkill ? growth.leaderSkill(card.leaderSkill) : undefined);
  const p = previewSwap(uids.map(toMember), slot, cand, leaderOf, (card, lv) => skillCooldown(card, lv, growth));
  const skill = cand.card.activeSkill ? growth.skill(cand.card.activeSkill) : undefined;
  const delta = (label: string, value: number, d: number, bad = false) => h('div', { class: 'team-stat' },
    h('small', null, label), h('strong', null, fmt(value)),
    h('span', { class: ['swap-delta', d > 0 ? (bad ? 'down' : 'up') : d < 0 ? (bad ? 'up' : 'down') : ''] }, signed(d)));
  return h('div', { class: 'swap-preview' },
    h('div', { class: 'small-text' }, h('strong', null, cand.card.name), ` Lv${cand.level}`),
    h('div', { class: 'team-stats' },
      delta('總生命', p.hp, p.dHp), delta('總回復', p.rcv, p.dRcv), delta(`Cost（上限 ${limit}）`, p.cost, p.dCost, true)),
    h('div', { class: 'row wrap', style: { gap: '4px', marginTop: '6px' } },
      skill ? badge(`主動技・${skill.name}　CD ${p.cooldown}`) : badge('沒有主動技'),
      p.leader.boosts.length ? p.leader.boosts.map((b) => badge(`吃隊長技 ${b}`, 'gold')) : badge(slot === 0 ? '隊長技沒有加成自己' : '吃不到隊長技的加成'),
      p.leader.breaksTeamAll > 0 && badge('會讓「全隊」條件的隊長技失效', 'danger'),
      p.cost > limit && badge('超過隊伍空間', 'danger')),
    skill && h('p', { class: 'small-text dim', style: { margin: '4px 0 0' } }, skill.description));
}

/** 隊伍總生命／攻擊／回復與隊長技文字 */
function statsPanel(uids: (string | null)[]): HTMLElement {
  const save = getSave();
  const members = uids.flatMap((uid) => {
    const c = uid ? save.inventory.cards.find((x) => x.uid === uid) : undefined;
    const card = c && growth.card(c.cardId);
    return c && card ? [{ card, level: c.level, awakened: c.awakened }] : [];
  });
  const leaderOf = (card: { leaderSkill?: string }) => (card.leaderSkill ? growth.leaderSkill(card.leaderSkill) : undefined);
  const totals = teamTotals(members, leaderOf);
  const leader = members[0] && leaderOf(members[0].card);
  const stat = (label: string, value: number, base?: number) => h('div', { class: 'team-stat' },
    h('small', null, label),
    h('strong', null, fmt(value)),
    base !== undefined && value > base ? h('span', { class: 'team-stat-bonus' }, `隊長技 +${fmt(value - base)}`) : null);
  return panel(
    { title: '隊伍數值' },
    h('div', { class: 'team-stats' }, stat('總生命', totals.hp, totals.baseHp), stat('總攻擊', totals.atk), stat('總回復', totals.rcv, totals.baseRcv)),
    h('div', { class: 'team-leader' },
      leader
        ? [
          h('div', { class: 'small-text' }, h('strong', { class: 'gold-text' }, `隊長技・${leader.name}`)),
          h('p', { class: 'small-text', style: { margin: '4px 0' } }, leader.description),
          h('div', { class: 'row wrap', style: { gap: '4px' } }, leaderHighlights(leader).map((t) => badge(t))),
        ]
        : h('p', { class: 'small-text dim', style: { margin: '0' } }, '隊長沒有隊長技。'),
      h('p', { class: 'small-text dim', style: { margin: '6px 0 0' } }, '攻擊依隊長技條件在戰鬥中另外加乘；出戰時助戰的隊長技也會一起生效。')),
  );
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
        const total = teamCost(members);
        if (total > limit) return offerSwap(slot, members, total);
        saveMembers(members);
      };

      const saveMembers = (members: (string | null)[]) => {
        const s = getSave();
        const teams = s.teams.map((t, i) => (i === index ? { ...t, members } : t));
        commit({ ...s, teams });
        draw();
      };

      // 超過上限：說明幾級可以放入，並建議換下 Cost 最高、最不合流派的隊員
      const offerSwap = (slot: number, members: (string | null)[], total: number) => {
        const cards = getSave().inventory.cards;
        const swap = suggestSwapOut(members.map((uid) => {
          const c = uid ? cards.find((x) => x.uid === uid) : undefined;
          return c && uid ? { uid, cost: growth.card(c.cardId)?.cost ?? 0, fits: fit.get(uid)?.fits ?? true } : null;
        }), slot, total, limit);
        const swapCard = swap && growth.card(cards.find((c) => c.uid === swap.uid)!.cardId);
        const text = overCostText(total, limit, swapCard ? { name: swapCard.name, cost: swapCard.cost } : undefined);
        if (!swap || !swapCard) return toast(text, 3500);
        const dlg = openDialog('隊伍空間不足', h('p', null, `${text}。`), [
          button('取消', { variant: 'ghost', sound: 'back', onClick: () => dlg.close() }),
          button('換下並放入', { variant: 'primary', onClick: () => {
            dlg.close();
            const next = [...members];
            next[swap.slot] = null;
            saveMembers(next);
          } }),
        ]);
      };

      host.replaceChildren(
        tabs(save.teams.map((_, i) => ({ id: String(i), label: `隊伍 ${i + 1}` })), String(index), (id) => {
          commit({ ...getSave(), activeTeam: Number(id) });
          draw();
        }),
        panel(
          null,
          h('button', { type: 'button', class: 'team-name', 'aria-label': '修改隊伍名稱', onClick: () => renameTeam(index, draw) }, h('h3', null, team.name), h('span', { class: 'team-name-hint small-text' }, '改名')),
          h('div', { class: 'team-slots' },
            team.members.map((uid, slot) => {
              const owned = uid ? save.inventory.cards.find((c) => c.uid === uid) : undefined;
              const def = owned && growth.card(owned.cardId);
              const pick = () => pickCard(slot === 0 ? '選擇隊長' : `選擇第 ${slot + 1} 位隊員`, { exclude: new Set(team.members.filter((u): u is string => !!u && u !== uid)), allowRemove: !!uid && slot > 0, preview: (cand) => swapPreview(team.members, slot, cand, limit) }, (picked) => setMember(slot, picked));
              const el = def ? cardThumb(def, { level: owned!.level, size: 60, onClick: pick }) : emptySlot(pick, 60);
              const f = uid ? fit.get(uid) : undefined;
              if (f && !f.fits) el.classList.add('misfit');
              return h('div', { class: 'team-slot' }, el, h('span', { class: 'small-text dim' }, slot === 0 ? '隊長' : f?.role ? ROLE_LABEL[f.role] : ''));
            })),
          h('div', { style: { marginTop: '8px' } }, bar({ value: cost, max: limit, variant: cost > limit ? 'hp' : 'gold', label: `隊伍空間 ${cost} / ${limit}` })),
        ),
        statsPanel(team.members),
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
