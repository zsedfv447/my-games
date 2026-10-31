// 稱號推算需要的外部資料：成就進度（任務模組）與殘頁張數（殘頁模組）
import type { SaveData } from '../core/types';
import { gameData } from '../data/load';
import { questProgress } from '../progression/quests';
import { allLorePages, collectedLorePages, type LoreData } from '../progression/lore';
import type { TitleContext } from '../progression/titles';
import { questDerived } from './economy';

export function titleContext(save: SaveData): TitleContext {
  const derived = questDerived(save);
  const lore: LoreData = gameData.lore ?? { volumes: [] };
  return {
    achievementDone: (id) => {
      const q = gameData.quests.find((x) => x.id === id);
      return !!q && questProgress(save, q, derived).done;
    },
    lorePages: { collected: collectedLorePages(save, lore).length, total: allLorePages(lore).length },
  };
}
