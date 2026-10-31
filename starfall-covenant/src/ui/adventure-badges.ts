// 冒險頁各入口的紅點（單一來源）：冒險頁的章節列與小卡、底部導覽的「冒險」分頁都讀這裡，不各自重算。
import type { SaveData } from '../core/types';
import { gameData } from '../data/load';
import { ABYSS_FLOORS, abyssProgress, isAbyssOpen } from '../progression/abyss';
import { eclipseRewardStatus } from '../progression/eclipse';
import { expeditionsOf, hasReturned } from '../progression/expedition';
import { solvedToday } from '../progression/puzzle';
import { claimableChapterRewards } from '../progression/stages';
import { openLimitedEvents } from './event-order';

export interface AdventureDots {
  /** 有章節星章集滿、還沒領獎的章節 */
  chapters: number[];
  /** 有星蝕章節獎勵可以領的章節 */
  eclipse: number[];
  /** 有開放中的限時活動 */
  event: boolean;
  /** 今天的星紋謎題還沒解 */
  puzzle: boolean;
  /** 星淵回廊本週還沒登頂 */
  abyss: boolean;
  /** 有星靈遠行的隊伍已經歸來 */
  expedition: boolean;
}

export function adventureDots(save: SaveData, now: number): AdventureDots {
  return {
    chapters: claimableChapterRewards(save, gameData.chapters, gameData.stages),
    eclipse: gameData.chapters.filter((c) => eclipseRewardStatus(save, c.chapter, gameData.stages) === 'claimable').map((c) => c.chapter),
    event: openLimitedEvents(gameData.events, now).length > 0,
    puzzle: !solvedToday(save, now),
    abyss: isAbyssOpen(save) && abyssProgress(save, now).best < ABYSS_FLOORS,
    expedition: expeditionsOf(save).some((e) => hasReturned(e, now)),
  };
}

/** 冒險頁上只要有一個紅點，底部導覽的「冒險」分頁就亮 */
export const anyAdventureDot = (d: AdventureDots): boolean =>
  d.chapters.length > 0 || d.eclipse.length > 0 || d.event || d.puzzle || d.abyss || d.expedition;
