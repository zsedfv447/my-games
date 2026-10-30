// 結算畫面的星座與「契約回憶」分享資料（battle.ts 只呼叫這裡，避免把結算細節塞進戰鬥畫面）
import type { StageDef } from '../core/types';
import type { StageClearResult } from '../progression/stages';
import { gameData } from '../data/load';
import { clearConstellation } from './components/constellation-view';
import { openShareCard } from './components/share-card';
import { getSave } from './state';
import type { ShareMember } from './share-plan';

const KIND_PLACE: Record<StageDef['kind'], string> = { main: '主線', daily: '每日關卡', event: '限時活動', tower: '挑戰之塔', trial: '流派試煉' };

/** 主線關卡結算時顯示的章節星座（只點亮這次新拿到的星章） */
export function resultConstellation(stage: StageDef, clear: StageClearResult | null): HTMLElement | null {
  const info = stage.kind === 'main' ? gameData.chapters.find((c) => c.chapter === stage.chapter) : undefined;
  if (!info || !clear) return null;
  return clearConstellation(info, stage.id, clear.newStars);
}

/** 打開分享圖預覽。team 是戰鬥中的隊員（含助戰），memberUids 用來查自己卡片的等級 */
export function shareClear(
  stage: StageDef,
  team: { cardId: string; card: { name: string }; isHelper: boolean }[],
  memberUids: string[],
  battle: { turns: number; maxCombo: number },
  clear: StageClearResult | null,
  firstClear: boolean,
  starTexts: string[],
): void {
  const save = getSave();
  const owned = save.inventory.cards.filter((c) => memberUids.includes(c.uid));
  const members: ShareMember[] = team.map((m) => {
    const i = m.isHelper ? -1 : owned.findIndex((c) => c.cardId === m.cardId);
    const level = i >= 0 ? owned.splice(i, 1)[0].level : undefined;
    return { cardId: m.cardId, name: m.card.name, level, isHelper: m.isHelper };
  });
  const info = stage.kind === 'main' ? gameData.chapters.find((c) => c.chapter === stage.chapter) : undefined;
  void openShareCard({
    stageName: stage.name,
    place: info ? `第 ${info.chapter} 章・${info.name}` : KIND_PLACE[stage.kind],
    constellation: info?.constellation,
    turns: battle.turns,
    maxCombo: battle.maxCombo,
    stars: clear?.stars ?? [],
    starTexts: clear ? starTexts : [],
    team: members,
    playerName: save.player.name,
    playerLevel: save.player.level,
    at: Date.now(),
    firstClear,
  }, info?.chapter);
}
