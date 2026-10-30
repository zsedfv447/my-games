// 略過新手教學（引路人、教學戰鬥、設定共用）：還沒領過召喚贈禮就補發並播領獎演出
import { gameData } from '../../data/load';
import { pullCost } from '../../progression/gacha';
import { revealReward } from '../components/reward-reveal';
import { commit, getSave } from '../state';
import { skipTutorialWithGift } from './flow';

/** 教學送的星晶：剛好夠第一個卡池單抽一次 */
export const tutorialGiftGems = (): number => {
  const pool = gameData.gachaPools[0];
  return pool ? pullCost(pool, 1) : 0;
};

export async function skipTutorialNow(): Promise<void> {
  const r = skipTutorialWithGift(getSave(), tutorialGiftGems());
  commit(r.save);
  if (r.granted) await revealReward('見面禮', { gems: r.granted }, '略過教學也送你一次單抽的星晶，到「召喚」試試手氣吧');
}
