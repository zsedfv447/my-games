// 契約週報的回顧卡（progression/weekly-report.ts）：主城自動跳出（每週一次）或從手札重看；可以存成分享圖
import { h } from '../dom';
import { gameData } from '../../data/load';
import type { WeeklyReport } from '../../progression/weekly-report';
import { equippedTitle } from '../../progression/titles';
import { getSave, growth } from '../state';
import { titleContext } from '../economy';
import { weeklySharePlan } from '../share-plan';
import { victoryLine } from '../victory-line';
import { button } from './basic';
import { cardThumb } from './card-thumb';
import { openDialog } from './overlay';
import { openSharePreview } from './share-card';
import '../convenience.css';

const fmt = (n: number) => n.toLocaleString();

/** 回顧卡的文字列（畫面與分享圖共用） */
export function weeklyLines(r: WeeklyReport): string[] {
  const lines: string[] = [];
  const leader = r.topLeader && growth.card(r.topLeader.cardId);
  if (leader) lines.push(`最常並肩：${leader.name}（${r.topLeader!.clears} 次）`);
  if (r.stats.abyssBest) lines.push(`星淵回廊最高第 ${r.stats.abyssBest} 層`);
  if (r.stats.nemesisClears) lines.push(`流派克星週通關 ${r.stats.nemesisClears} 次`);
  if (r.newCards.length) lines.push(`新收星靈 ${r.newCards.length} 位`);
  if (r.puzzleStreak) lines.push(`謎題連續 ${r.puzzleStreak} 天`);
  if (r.stats.maxTurnDamage) lines.push(`單回合最高傷害 ${fmt(r.stats.maxTurnDamage)}`);
  return lines;
}

function share(r: WeeklyReport): void {
  const save = getSave();
  const members = [r.topLeader?.cardId, ...r.newCards].filter((id, i, all): id is string => !!id && all.indexOf(id) === i)
    .flatMap((cardId) => { const c = growth.card(cardId); return c ? [{ cardId, name: c.name }] : []; });
  void openSharePreview(weeklySharePlan({
    week: r.week, range: r.range, wins: r.stats.wins, battles: r.stats.battles, maxCombo: r.stats.maxCombo, puzzleDays: r.puzzleDays,
    lines: weeklyLines(r), members, playerName: save.player.name, playerLevel: save.player.level,
    title: equippedTitle(save, titleContext(save))?.name,
  }));
}

/** 打開回顧卡；onClose 在玩家關掉時呼叫（換頁自動關閉時不呼叫） */
export function openWeeklyReport(r: WeeklyReport, onClose?: () => void): void {
  const leader = r.topLeader && growth.card(r.topLeader.cardId);
  const stat = (label: string, value: string) => h('div', { class: 'note-stat' }, h('small', null, label), h('strong', null, value));
  const body = h('div', { class: 'weekly-report' },
    h('p', { class: 'small-text dim', style: { margin: '0 0 8px', textAlign: 'center' } }, r.range),
    h('div', { class: 'note-stats' },
      stat('出戰', `${r.stats.battles} 場`),
      stat('勝場', `${r.stats.wins} 場`),
      stat('最高 Combo', r.stats.maxCombo ? `${r.stats.maxCombo}` : '—'),
      stat('星淵回廊', r.stats.abyssBest ? `${r.stats.abyssBest} 層` : '—'),
      stat('克星週', `${r.stats.nemesisClears} 勝`),
      stat('謎題', `${r.puzzleDays} 天`)),
    leader && h('div', { class: 'row weekly-leader' },
      cardThumb(leader, { size: 52 }),
      h('div', { class: 'grow' },
        h('div', { class: 'small-text' }, h('strong', null, leader.name), h('span', { class: 'dim' }, `　上週並肩 ${r.topLeader!.clears} 次`)),
        h('p', { class: 'note-quote' }, `「${victoryLine(leader)}」`))),
    r.newCards.length > 0 && h('div', null,
      h('p', { class: 'small-text', style: { margin: '10px 0 4px' } }, '上週新收的星靈'),
      h('div', { class: 'row wrap', style: { gap: '6px' } }, r.newCards.map((id) => { const c = gameData.cards.find((x) => x.id === id); return c ? cardThumb(c, { size: 44 }) : null; }))),
    r.puzzleStreak > 0 && h('p', { class: 'small-text dim', style: { margin: '8px 0 0' } }, `星紋謎題連續 ${r.puzzleStreak} 天`),
  );
  const dlg = openDialog('契約週報', body, [
    button('關閉', { variant: 'ghost', sound: 'back', onClick: () => { dlg.close(); onClose?.(); } }),
    button('存成分享圖', { variant: 'primary', onClick: () => share(r) }),
  ], { scope: 'route' });
}
