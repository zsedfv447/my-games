// 穹頂篇片尾卡的回顧文字（第 7 章通關後）：純資料，不碰 DOM，方便測試
import type { SaveData, StageDef } from '../core/types';
import { recordsOf } from '../progression/records';

/** 片尾卡記在 progress.storySeen 裡的 id（不另開存檔欄位）；看過才會出現在劇情回顧 */
export const FINALE_ID = 'finale-dome';
/** 播完這段劇情後接片尾卡 */
export const FINALE_AFTER_STORY = 'ch7-end';

export interface FinaleRecap {
  title: string;
  lines: string[];
  closing: string;
}

/** 回顧：主線通關數與星章、勝場、最高 Combo、最常並肩的隊長（隊長通關次數最多的那張卡） */
export function finaleRecap(save: SaveData, stages: StageDef[], cardName: (id: string) => string | undefined): FinaleRecap {
  const main = stages.filter((s) => s.kind === 'main');
  const cleared = main.filter((s) => save.progress.clearedStages.includes(s.id)).length;
  const starsTotal = main.reduce((n, s) => n + (s.stars?.length ?? 0), 0);
  const starsGot = main.reduce((n, s) => n + (save.progress.stars[s.id] ?? []).filter(Boolean).length, 0);
  const rec = recordsOf(save);
  const lines = [`走過主線 ${cleared}／${main.length} 關，點亮星章 ${starsGot}／${starsTotal} 顆`];
  if (rec.wins > 0) lines.push(`一路贏下 ${rec.wins} 場戰鬥，最高 ${rec.maxCombo} Combo`);
  const top = Object.entries(rec.leaderClears).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  const name = top && cardName(top[0]);
  if (top && name) lines.push(`最常並肩的隊長：${name}（${top[1]} 場）`);
  return { title: '穹頂篇　完', lines, closing: '後續篇章，敬請期待' };
}

/** 劇情播完後要不要接片尾卡：只有 ch7-end、而且還沒看過片尾卡 */
export function shouldPlayFinale(storyId: string, storySeen: string[]): boolean {
  return storyId === FINALE_AFTER_STORY && !storySeen.includes(FINALE_ID);
}
