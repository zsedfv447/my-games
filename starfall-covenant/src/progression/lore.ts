// 星骸殘頁：每章 Boss、挑戰之塔每 10 層、活動最後一關首次通關各得一頁（data/lore.json），
// 集滿一卷的殘頁就解鎖該卷的隱藏對話。只看首次通關，重打不會再掉。
import type { SaveData, StoryLine } from '../core/types';

export interface LorePage {
  id: string;
  /** 首次通關這一關時獲得 */
  stage: string;
  title: string;
  text: string[];
}

export interface LoreVolume {
  id: string;
  name: string;
  pages: LorePage[];
  /** 集滿本卷殘頁後解鎖的隱藏對話 */
  secret: { title: string; lines: StoryLine[] };
}

export interface LoreData {
  volumes: LoreVolume[];
}

export const allLorePages = (lore: LoreData): LorePage[] => lore.volumes.flatMap((v) => v.pages);

/**
 * 已收集的殘頁 id。存檔沒有 lorePages（這個功能之前的存檔）時，
 * 以已通關的關卡補上：通關過就代表首次通關時該拿到那一頁。
 */
export function collectedLorePages(save: SaveData, lore: LoreData): string[] {
  if (save.lorePages) return save.lorePages;
  const cleared = new Set(save.progress.clearedStages);
  return allLorePages(lore).filter((p) => cleared.has(p.stage)).map((p) => p.id);
}

export function isVolumeComplete(collected: string[], volume: LoreVolume): boolean {
  const have = new Set(collected);
  return volume.pages.every((p) => have.has(p.id));
}

/** 隱藏對話已解鎖的卷 */
export function unlockedSecrets(save: SaveData, lore: LoreData): LoreVolume[] {
  const collected = collectedLorePages(save, lore);
  return lore.volumes.filter((v) => isVolumeComplete(collected, v));
}

export interface LoreGain {
  save: SaveData;
  /** 這次拿到的殘頁 */
  page?: LorePage;
  /** 這一頁讓整卷集滿、剛解鎖隱藏對話的卷 */
  unlocked?: LoreVolume;
}

/**
 * 通關結算後呼叫：首次通關、而且這一關有殘頁時收進存檔。
 * firstClear 由呼叫端在結算前判斷（completeStage 會把關卡加進已通關）。
 */
export function grantLorePage(save: SaveData, stageId: string, firstClear: boolean, lore: LoreData): LoreGain {
  const page = allLorePages(lore).find((p) => p.stage === stageId);
  if (!firstClear || !page || save.lorePages?.includes(page.id)) return { save };
  // 舊存檔沒有欄位時，從通關紀錄補上其他頁（這一關剛通關，所以排除它自己）
  const before = (save.lorePages ?? collectedLorePages(save, lore)).filter((id) => id !== page.id);
  const after = [...before, page.id];
  const volume = lore.volumes.find((v) => v.pages.some((p) => p.id === page.id));
  const unlocked = volume && isVolumeComplete(after, volume) ? volume : undefined;
  return { save: { ...save, lorePages: after }, page, ...(unlocked ? { unlocked } : {}) };
}

/** 結算畫面的提示文字（reward-reveal 的 notes） */
export function loreNotes(gain: LoreGain): { text: string; big?: boolean }[] {
  if (!gain.page) return [];
  const notes: { text: string; big?: boolean }[] = [{ text: `獲得星骸殘頁「${gain.page.title}」` }];
  if (gain.unlocked) notes.push({ text: `集滿${gain.unlocked.name}！隱藏對話「${gain.unlocked.secret.title}」已在劇情回顧解鎖`, big: true });
  return notes;
}

/** 隱藏對話在劇情播放器裡的 id */
export const loreSecretId = (volume: LoreVolume): string => `lore-${volume.id}`;

export function loreSecretById(lore: LoreData, id: string): LoreVolume | undefined {
  return lore.volumes.find((v) => loreSecretId(v) === id);
}
