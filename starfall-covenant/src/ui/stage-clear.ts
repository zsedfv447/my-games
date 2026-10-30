// 勝利結算的關卡流程：發卡片經驗、新關卡／新章節開放提示、「下一關」按鈕（battle.ts 只呼叫這裡）
import type { SaveData, StageDef } from '../core/types';
import { gameData } from '../data/load';
import { grantBattleExp, type CardExpGain } from '../growth';
import { isStageUnlocked, nextStageAfter, stagesUnlockedBy } from '../progression/stages';
import { h } from './dom';
import { button } from './components/basic';
import { markJustUnlocked, stageContext, stageListPath } from './stage-nav';
import type { ResultNote } from './components/reward-reveal';
import { growth } from './state';

/** 出戰的玩家卡 uid（不含助戰；借用隊伍時為空） */
export function sortieUids(team: { borrowed: boolean; members: { uid?: string }[] }): string[] {
  return team.borrowed ? [] : team.members.flatMap((m) => (m.uid ? [m.uid] : []));
}

/** 發卡片經驗給出戰隊員，回傳新存檔與結算要顯示的列 */
export function grantClearExp(save: SaveData, uids: string[], cardExp: number): { save: SaveData; gains: CardExpGain[]; rows: HTMLElement[] } {
  const r = grantBattleExp(save, growth, uids, cardExp);
  if (!r.gains.length) return { ...r, rows: [] };
  const rows = [h('div', { class: 'row between' }, h('span', null, '隊員經驗'), h('strong', null, `各 +${cardExp}`))];
  // 升級的隊員併成一行，避免結算視窗太長把按鈕擠出畫面
  const ups = r.gains.filter((g) => g.levelAfter > g.levelBefore).map((g) => `${growth.card(g.cardId)?.name ?? g.cardId} Lv.${g.levelAfter}`);
  if (ups.length) rows.push(h('div', { class: 'gold-text small-text' }, `升級！${ups.join('、')}`));
  return { ...r, rows };
}

/**
 * 首次通關時的開放提示：標記關卡列表要閃的關卡，回傳要放在結算最上面的提示列與文字（結算演出用 text）；
 * chapter 有值代表開放了新章節（呼叫端可播橫幅）。
 */
export function unlockNotice(stage: StageDef): { row: HTMLElement | null; text?: string; chapter?: number; note?: ResultNote } {
  const opened = stagesUnlockedBy(stage.id, gameData.stages);
  markJustUnlocked(opened.map((s) => s.id));
  const newChapter = opened.find((s) => s.kind === 'main' && s.chapter !== undefined && s.chapter !== stage.chapter);
  const chapter = newChapter && gameData.chapters.find((c) => c.chapter === newChapter.chapter);
  if (chapter) {
    // 同時開放的外傳章也一起提一句
    const side = opened.some((s) => s.kind === 'side') ? '外傳「灰燈港夜話」也開放了' : '';
    const text = `第 ${chapter.chapter} 章「${chapter.name}」開放！${side && `　${side}`}`;
    const note: ResultNote = { text, big: true, chip: `★ 第 ${chapter.chapter} 章開放`, go: `stages/${chapter.chapter}` };
    return { row: h('div', { class: 'unlock-note gold-text' }, text), text, chapter: chapter.chapter, note };
  }
  if (opened.length) {
    const text = `新關卡開放：${opened.map((s) => s.name).join('、')}`;
    const note: ResultNote = { text, chip: '🔓 新關卡', go: stageListPath(opened[0]) };
    return { row: h('div', { class: 'unlock-note small-text' }, text), text, note };
  }
  return { row: null };
}

/** 「下一關」：下一關目前可以進才給按鈕，點了用 go 前往它的出戰確認（hash 路徑） */
export function nextStageButton(stage: StageDef, save: SaveData, go: (path: string) => void): HTMLButtonElement | null {
  const next = nextStageAfter(stage, gameData.stages);
  if (!next || !isStageUnlocked(save, next, stageContext(gameData.stages, gameData.events), Date.now())) return null;
  return button('下一關', { variant: 'primary', onClick: () => go(`prepare/${next.id}`) });
}
