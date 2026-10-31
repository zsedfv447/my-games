// 結算的「🏷 新稱號」提示：戰鬥開始時記下已解鎖的稱號，勝利結算時比對（progression/titles.ts）
import type { SaveData } from '../core/types';
import { titlesGained, unlockedTitles } from '../progression/titles';
import type { ResultNote } from './components/reward-reveal';
import { titleContext } from './economy';

export function unlockedTitleIds(save: SaveData): string[] {
  return unlockedTitles(save, titleContext(save)).map((t) => t.id);
}

/** 新解鎖的稱號合成一個標籤，點開後可以前往稱號列表選用 */
export function newTitleNotes(before: string[], save: SaveData): ResultNote[] {
  const gained = titlesGained(before, save, titleContext(save));
  if (!gained.length) return [];
  const names = gained.map((t) => `「${t.name}」`).join('、');
  return [{ text: `解鎖新稱號：${names}，可以到稱號列表選用`, chip: gained.length > 1 ? `🏷 新稱號 ×${gained.length}` : '🏷 新稱號', go: 'titles' }];
}
