// 劇情自動播放的停留時間與回顧紀錄的整理。純邏輯。
import type { StoryLine } from '../core/types';

/** 打字完成後停留多久再換下一句：基本 1.2 秒，每個字加 70 毫秒，上限 5 秒 */
export function autoDelayMs(text: string): number {
  return Math.min(5000, 1200 + [...text].length * 70);
}

/** 回顧紀錄：到目前這句為止（含）的對白；連續同一人說話時省略重複的名字 */
export function storyLog(lines: StoryLine[], upTo: number): { speaker?: string; text: string }[] {
  const out: { speaker?: string; text: string }[] = [];
  let last: string | undefined;
  for (const line of lines.slice(0, Math.max(0, upTo + 1))) {
    out.push({ speaker: line.speaker && line.speaker !== last ? line.speaker : undefined, text: line.text });
    last = line.speaker;
  }
  return out;
}
