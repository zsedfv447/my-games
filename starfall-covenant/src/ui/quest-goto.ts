// 任務「前往」：依任務的 counter 決定要帶玩家去哪個畫面（純函式，方便測試）
import type { CardDef, QuestDef, SaveData, StageDef } from '../core/types';
import { nurtureTarget } from '../progression/nurture';
import { nextMainStage, stageContext } from './stage-nav';

export interface QuestDestination {
  name: string;
  args: string[];
}

/** 戰鬥類任務：主線的下一關；主線全破就到冒險地圖 */
function nextBattle(save: SaveData, stages: StageDef[], now: number): QuestDestination {
  const next = nextMainStage(save, stageContext(stages), now);
  return next ? { name: 'prepare', args: [next.id] } : { name: 'adventure', args: [] };
}

/** 沒有對應畫面時回傳 null（按鈕維持「進行中」） */
export function questDestination(quest: QuestDef, save: SaveData, stages: StageDef[], now: number, cards: CardDef[] = []): QuestDestination | null {
  switch (quest.counter) {
    // 養成之路：直接到目標卡的強化／進化畫面；還沒有這張卡時，先去拿得到它的關卡
    case 'journeyEnhanced':
    case 'journeyMaxLevel':
    case 'journeyEvolved': {
      const line = nurtureTarget(save, cards, stages);
      if (line?.owned) return { name: quest.counter === 'journeyEvolved' ? 'evolve' : 'enhance', args: [line.owned.uid] };
      if (line?.source) return { name: 'prepare', args: [line.source] };
      return { name: 'cards', args: [] };
    }
    case 'journeyMaterials':
      return { name: 'stages', args: ['daily'] };
    case 'stageClear:daily':
      return { name: 'stages', args: ['daily'] };
    case 'stageClear:event':
      return { name: 'stages', args: ['event'] };
    case 'towerFloor':
      return { name: 'stages', args: ['tower'] };
    case 'trialCleared':
      return { name: 'archetypes', args: [] };
    case 'gachaPull':
    case 'summoned':
    case 'cardsOwned':
      return { name: 'summon', args: [] };
    case 'cardEnhance':
    case 'cardEvolve':
    case 'evolvedOwned':
    case 'maxCardLevel':
    case 'awakenedCards':
      return { name: 'cards', args: [] };
    case 'shopPurchase':
      return { name: 'shop', args: [] };
    case 'login':
      return { name: 'login-bonus', args: [] };
    case 'teamEdited':
      return { name: 'team', args: [] };
    case 'puzzleSolved':
    case 'puzzleBestStreak':
      return { name: 'puzzle', args: [] };
    case 'collectionPercent':
      return { name: 'collection', args: [] };
    case 'lorePages':
      return { name: 'stories', args: [] };
    case 'nemesisCleared':
      return { name: 'adventure', args: [] };
    case 'chapterRewards':
      return { name: 'adventure', args: [] };
    case 'stageClear':
    case 'stageClear3Stars':
    case 'starsEarned':
    case 'mainCleared':
    case 'playerLevel':
    case 'helperClears':
    case 'helperBondTiers':
    case 'cardBondScenes':
    case 'stageFail':
    case 'orbsCleared':
    case 'comboBest':
    case 'comboTotal':
      return nextBattle(save, stages, now);
    default:
      // combo5、combo10… 這類單場連擊任務也是去打下一關
      return /^combo\d+$/.test(quest.counter) ? nextBattle(save, stages, now) : null;
  }
}
