import { openCardQuickView } from '../components/card-quickview';
// 隊伍編成：5 組隊伍切換、換人、Cost 上限、流派提示（growth/archetype.ts 的 analyzeTeam）
import { h } from '../dom';
import { expeditionUids } from '../../growth/save-ops';
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
import { CAPABILITIES, CAPABILITY_LABEL, teamCapabilities } from '../team-capabilities';
import { LABEL } from '../wording';
import { presentTeamFit } from '../team-fit-presentation';

const archetypeName = (id: string | null) => (id ? gameData.archetypes.find((a) => a.id === id)?.name ?? id : '未定');

export function teamCost(uids: (string | null)[]): number {
  const save = getSave();
  return uids.reduce((sum, uid) => {
    const c = uid ? save.inventory.cards.find((x) => x.uid === uid) : undefined;
    return sum + (c ? growth.card(c.cardId)?.cost ?? 0 : 0);
  }, 0);
}

function renameTeam(index: number, done: () => void, isCurrent: () => boolean): () => void {
  let closed = false;
  const originalName = getSave().teams[index].name;
  const input = h('input', { class: 'text-input', type: 'text', maxlength: String(TEAM_NAME_MAX), value: getSave().teams[index].name, 'aria-label': '隊伍名稱' }) as HTMLInputElement;
  const save = () => {
    if (closed || !isCurrent() || getSave().teams[index].name !== originalName) return;
    const name = cleanTeamName(input.value);
    if (!name) return;
    dlg.close();
    const s = getSave();
    commit({ ...s, teams: s.teams.map((t, i) => (i === index ? { ...t, name } : t)) });
    done();
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
  const dlg = openDialog('隊伍名稱', h('div', null, input, h('p', { class: 'small-text dim' }, `最多 ${TEAM_NAME_MAX} 個字`)), [
    button('取消', { variant: 'ghost', sound: 'back', onClick: () => dlg.close() }),
    button(LABEL.ok, { variant: 'primary', onClick: save }),
  ], { scope: 'route', onClose: () => { closed = true; } });
  setTimeout(() => { if (!closed && isCurrent()) { input.focus(); input.select(); } }, 50);
  return dlg.close;
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

function capabilityRow(uids: (string | null)[]): HTMLElement {
  const save = getSave();
  // Preserve slot zero: null is empty, undefined is an unresolved UID/card.
  const cards = uids.map((uid) => {
    if (uid === null) return null;
    const owned = save.inventory.cards.find((card) => card.uid === uid);
    return owned ? growth.card(owned.cardId) : undefined;
  });
  // This team editor has no selected battle helper; omitted helper remains unknown.
  const r = teamCapabilities(cards, (id) => growth.skill(id), (id) => growth.leaderSkill(id));
  const statuses = {
    'available-method': '主動技手段（須能施放）',
    unconditional: '常駐規則',
    conditional: '條件待確認',
    'blocked-lineup': '目前編成不符',
  };
  const sources = { active: '主動技', leader: '隊長技', helper: '助戰隊長技' };
  return h('div', { class: 'team-caps', 'data-team-capabilities': '' },
    h('p', { class: 'small-text dim' }, '能力來源索引，不代表當下已生效；主動技須能施放，隊長規則仍以條件與目標為準。'),
    r.incomplete && h('p', { class: 'small-text dim' }, '部分卡片資料不完整，未列出的效果不能視為不存在。'),
    CAPABILITIES.map(cap => h('details', { 'data-capability': cap, style: { marginTop: '6px' } },
      h('summary', { style: { cursor: 'pointer' } }, `${CAPABILITY_LABEL[cap]}：${r.details[cap].length ? `${r.details[cap].length} 項來源` : '未列出此類效果'}${r.details[cap].some(d => d.status === 'blocked-lineup') ? '・含編成不符' : ''}${r.details[cap].some(d => d.status === 'conditional') ? '・含待確認條件' : ''}`),
      r.details[cap].map(detail => h('div', {
        'data-capability-source': detail.source,
        'data-capability-status': detail.status,
        'data-capability-card': detail.cardId,
        style: { margin: '8px 0', overflowWrap: 'anywhere' },
      },
      h('strong', { class: 'small-text' }, `${detail.cardName}・${sources[detail.source]}・${statuses[detail.status]}`),
      h('p', { class: 'small-text', style: { margin: '4px 0' } }, detail.explanation),
      h('p', { class: 'small-text dim', style: { margin: '4px 0' } }, detail.skillDescription))))));
}

export const teamScreen: ScreenDef = {
  name: 'team',
  title: '隊伍編成',
  chrome: 'full',
  tab: 'team',
  parent: 'home',
  render({ nav, onLeave }) {
    let disposed = false;
    // A newer team action owns consent; closed or detached controls cannot reclaim it.
    let operation = 0;
    let closePending: (() => void) | undefined;
    const begin = () => { closePending?.(); closePending = undefined; return ++operation; };
    onLeave(() => { disposed = true; begin(); });
    const host = h('div', { style: { display: 'contents' } });
    const draw = () => {
      if (disposed) return;
      begin();
      const save = getSave();
      const index = save.activeTeam;
      const team = save.teams[index];
      const originalMembers = [...team.members];
      const current = () => !disposed && getSave().activeTeam === index && getSave().teams[index].members.length === originalMembers.length && getSave().teams[index].members.every((uid, i) => uid === originalMembers[i]);
      const limit = teamCostLimit(save.player.level);
      const cost = teamCost(team.members);
      const report = analyzeTeam(save, growth, team.members);
      const fit = new Map(report.members.map((m) => [m.uid, m]));

      const setMember = (slot: number, uid: string | null) => {
        if (!current()) return;
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
        if (!current()) return;
        const s = getSave();
        const away = expeditionUids(s);
        if (!members[0] || members.some((uid) => uid && (!s.inventory.cards.some((c) => c.uid === uid && growth.card(c.cardId)?.race !== 'material') || away.has(uid))) || teamCost(members) > teamCostLimit(s.player.level)) return;
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
        const token = begin();
        let closed = false;
        const dlg = openDialog('隊伍空間不足', h('p', null, `${text}。`), [
          button('取消', { variant: 'ghost', sound: 'back', onClick: () => dlg.close() }),
          button('換下並放入', { variant: 'primary', onClick: () => {
            if (closed || token !== operation || !current()) return;
            dlg.close();
            const next = [...members];
            next[swap.slot] = null;
            saveMembers(next);
          } }),
        ], { scope: 'route', onClose: () => { closed = true; } });
        closePending = dlg.close;
      };

      host.replaceChildren(
        tabs(save.teams.map((_, i) => ({ id: String(i), label: `隊伍 ${i + 1}` })), String(index), (id) => {
          commit({ ...getSave(), activeTeam: Number(id) });
          draw();
        }),
        panel(
          null,
          h('button', { type: 'button', class: 'team-name', 'aria-label': '修改隊伍名稱', onClick: () => { if (!current()) return; const token = begin(); closePending = renameTeam(index, draw, () => current() && token === operation); } }, h('h3', null, team.name), h('span', { class: 'team-name-hint small-text' }, '改名')),
          h('div', { class: 'team-slots' },
            team.members.map((uid, slot) => {
              const owned = uid ? save.inventory.cards.find((c) => c.uid === uid) : undefined;
              const def = owned && growth.card(owned.cardId);
              const pick = () => { if (!current()) return; const token = begin(); closePending = pickCard(slot === 0 ? '選擇隊長' : `選擇第 ${slot + 1} 位隊員`, { isCurrent: () => current() && token === operation, exclude: new Set(team.members.filter((u): u is string => !!u && u !== uid)), allowRemove: !!uid && slot > 0, preview: (cand) => swapPreview(team.members, slot, cand, limit) }, (picked) => { if (current() && token === operation) setMember(slot, picked); }); };
              const el = def ? cardThumb(def, { level: owned!.level, size: 60, onClick: pick }) : emptySlot(pick, 60);
              const f = uid ? fit.get(uid) : undefined;
              if (presentTeamFit(def, report).warning) el.classList.add('misfit');
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
            badge(`流派參考契合 ${Math.round(report.completion * 100)}%`)),
          h('p', { class: 'small-text dim' }, '僅供編隊參考，不代表實際戰鬥倍率；加成以隊長技條件為準'),
          report.missingRoles.length > 0 && h('p', { class: 'small-text', style: { marginTop: '8px' } }, `還缺：${report.missingRoles.map((r) => ROLE_LABEL[r]).join('、')}卡`),
          // 能力檢查（team-capabilities.ts）：有哪幾類能力、缺的給一行提醒；只提醒，不限制混搭
          capabilityRow(team.members),
          report.members.map((m) => {
            const card = growth.card(m.cardId);
            const advice = presentTeamFit(card, report);
            if (advice.kind === 'none') return null;
            return h('p', { class: 'small-text dim', 'data-fit-advice': advice.kind },
              `${card?.name}：`,
              advice.warning && '不符合隊長技的隊員篩選條件，請查看上方隊長技說明。',
              advice.tagMismatch && '未列入此流派標籤，可自由混搭');
          }),
          report.suggestions.length > 0 && h('div', null,
            h('p', { class: 'small-text', style: { margin: '8px 0 4px' } }, '背包裡適合換上的卡'),
            h('div', { class: 'row wrap', style: { gap: '6px' } }, report.suggestions.map((uid) => {
              const c = save.inventory.cards.find((x) => x.uid === uid)!;
              return cardThumb(growth.card(c.cardId)!, { level: c.level, size: 48, onClick: () => openCardQuickView(c.cardId, nav) });
            }))),
        ),
      );
    };
    draw();
    return h('div', null, host);
  },
};
