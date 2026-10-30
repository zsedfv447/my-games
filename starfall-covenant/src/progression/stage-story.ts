// 關卡劇情什麼時候自動播：只在第一次挑戰（或第一次通關）這一關、而且還沒看過時播。
// 重打、或是在接上劇情前就已經通關的老玩家都不補播，免得一進遊戲就跳一串劇情；想看可以去劇情回顧。
import type { StageDef, StoryData } from '../core/types';

export type StageStorySlot = 'before' | 'beforeBoss' | 'after';

/**
 * 這一關在 slot 時機要播的劇情 id，不用播時回傳 undefined。
 * firstTime：before／beforeBoss 傳「這關還沒通關過」，after 傳「這次是首次通關」。
 */
export function stageStoryToPlay(stage: Pick<StageDef, 'story'>, slot: StageStorySlot, story: StoryData, seen: string[], firstTime: boolean): string | undefined {
  const id = stage.story?.[slot];
  if (!firstTime || !id || !story[id]?.length || seen.includes(id)) return undefined;
  return id;
}

/** 領取章節星章獎勵後要播的劇情（例如 ch4-stars：艾嵐加入）；沒寫或看過就不播 */
export function chapterStarStoryToPlay(chapter: number, story: StoryData, seen: string[]): string | undefined {
  const id = `ch${chapter}-stars`;
  return story[id]?.length && !seen.includes(id) ? id : undefined;
}
