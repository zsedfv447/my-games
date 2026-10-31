// 契印師手札：稱號與個人戰績（progression/records.ts）——出戰與勝率、最高 Combo、單回合最高傷害、最常用的隊長、各流派通關次數
import { h } from '../dom';
import { gameData } from '../../data/load';
import { archetypeCounts, favoriteLeader, leaderRanking, recordsOf, starCount, winRate } from '../../progression/records';
import { badge, bar, emptyState, panel } from '../components/basic';
import { equippedTitle, newTitles, TITLES, unlockedTitles } from '../../progression/titles';
import { titleContext } from '../title-context';
import { cardThumb } from '../components/card-thumb';
import { getSave, growth } from '../state';
import { victoryLine } from '../victory-line';
import type { ScreenDef } from '../router';
import '../convenience.css';

const fmt = (n: number) => n.toLocaleString();

export const notebookScreen: ScreenDef = {
  name: 'notebook',
  title: '契印師手札',
  chrome: 'sub',
  parent: 'home',
  render({ nav }) {
    const save = getSave();
    const r = recordsOf(save);
    const fav = favoriteLeader(r);
    const favCard = fav && growth.card(fav.cardId);
    const ranking = leaderRanking(r, 5);
    const archetypes = archetypeCounts(r, gameData.archetypes.map((a) => a.id));
    const topArch = Math.max(1, ...archetypes.map((a) => a.clears));
    const tctx = titleContext(save);
    const title = equippedTitle(save, tctx);
    const unlocked = unlockedTitles(save, tctx).length;
    const freshTitles = newTitles(save, tctx).length;
    const stat = (label: string, value: string) => h('div', { class: 'note-stat' }, h('small', null, label), h('strong', null, value));

    return h(
      'div',
      null,
      panel(
        { gold: true },
        h('div', { class: 'row between' }, h('h2', { style: { margin: '0' } }, save.player.name || '契印師'), h('span', { class: 'small-text dim' }, `Lv.${save.player.level}`)),
        // 稱號：點了到稱號列表換一個；有新解鎖的稱號時標 NEW
        h('button', { type: 'button', class: 'note-title', onClick: () => nav.go('titles') },
          title ? h('span', { class: 'gold-text' }, `「${title.name}」`) : h('span', { class: 'dim' }, '尚未選擇稱號'),
          h('span', { class: 'small-text dim' }, `稱號 ${unlocked}/${TITLES.length} ›`),
          freshTitles > 0 && badge('NEW', 'gold')),
        h('div', { class: 'note-stats' },
          stat('出戰', `${fmt(r.battles)} 場`),
          stat('勝利', `${fmt(r.wins)} 場`),
          stat('勝率', r.battles ? `${Math.round(winRate(r) * 100)}%` : '—'),
          stat('最高 Combo', r.maxCombo ? fmt(r.maxCombo) : '—'),
          stat('單回合最高傷害', r.maxTurnDamage ? fmt(r.maxTurnDamage) : '—'),
          stat('通關／星章', `${save.progress.clearedStages.length} 關・${starCount(save)} ★`)),
      ),
      panel(
        { title: '最常並肩的隊長' },
        favCard
          ? h('div', { class: 'row', style: { alignItems: 'flex-start', gap: '10px' } },
            cardThumb(favCard, { size: 64, onClick: () => nav.go('collection-card', [favCard.id]) }),
            h('div', { class: 'grow' },
              h('div', null, h('strong', null, favCard.name), h('span', { class: 'small-text dim' }, `　通關 ${fav!.clears} 次`)),
              h('p', { class: 'note-quote' }, `「${victoryLine(favCard)}」`)))
          : emptyState('team', '還沒有通關紀錄', '贏下一場戰鬥，隊長就會記在這裡。'),
        ranking.length > 1 && h('div', { class: 'list', style: { marginTop: '10px' } }, ranking.map((x, i) => {
          const c = growth.card(x.cardId);
          return h('div', { class: 'row small-text note-rank' }, h('span', { class: 'note-rank-no' }, `${i + 1}`), h('span', { class: 'grow' }, c?.name ?? x.cardId), h('span', { class: 'dim' }, `${x.clears} 次`));
        })),
      ),
      panel(
        { title: '各流派通關次數' },
        h('p', { class: 'small-text dim', style: { margin: '0 0 6px' } }, '依出戰隊伍的主流派計算；借用隊伍不列入。'),
        h('div', { class: 'list' }, archetypes.map((a) => h('div', { class: 'note-arch' },
          h('span', { class: 'small-text' }, gameData.archetypes.find((x) => x.id === a.id)?.name ?? a.id),
          bar({ value: a.clears, max: topArch, variant: 'gold', label: `${a.clears}` })))),
      ),
    );
  },
};
