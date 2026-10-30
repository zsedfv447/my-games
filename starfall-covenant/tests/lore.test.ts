import { describe, expect, it } from 'vitest';
import { gameData } from '../src/data/load';
import { validateGameData } from '../src/data/validate';
import { CURRENT_SAVE_VERSION, createNewSave, parseSave, serializeSave } from '../src/save/save';
import {
  allLorePages, collectedLorePages, grantLorePage, loreNotes, loreSecretById, loreSecretId, unlockedSecrets, type LoreData,
} from '../src/progression/lore';
import type { SaveData } from '../src/core/types';

const lore = gameData.lore as LoreData;
const config = gameData.config;
const NOW = Date.UTC(2026, 9, 31, 6, 0, 0);
const fresh = () => createNewSave(config, NOW);
const cleared = (save: SaveData, ...ids: string[]): SaveData => ({ ...save, progress: { ...save.progress, clearedStages: [...save.progress.clearedStages, ...ids] } });
/** 模擬結算：completeStage 先記通關，再發殘頁 */
const clearStage = (save: SaveData, stageId: string) => {
  const first = !save.progress.clearedStages.includes(stageId);
  return grantLorePage(cleared(save, ...(first ? [stageId] : [])), stageId, first, lore);
};

describe('星骸殘頁資料', () => {
  it('每章 Boss、塔每 10 層、活動最後一關各一頁，約 8 頁', () => {
    const stages = allLorePages(lore).map((p) => p.stage).sort();
    expect(stages).toEqual(['ev-beast-5', 'st-1-9', 'st-2-9', 'st-3-9', 'st-4-9', 'st-5-9', 'tw-10', 'tw-20', 'tw-30']);
  });

  it('validate 檢查殘頁的關卡存在、不重複', () => {
    expect(validateGameData(gameData)).toEqual([]);
    const bad: LoreData = { volumes: [{ ...lore.volumes[0], pages: [{ ...lore.volumes[0].pages[0], stage: 'st-9-99' }, lore.volumes[0].pages[0]] }] };
    const errors = validateGameData({ ...gameData, lore: bad }).join('\n');
    expect(errors).toContain('st-9-99 不存在');
    expect(errors).toContain('重複');
  });
});

describe('收集殘頁', () => {
  it('首次通關 Boss 關拿到一頁；重打不會再掉、也不重複', () => {
    const first = clearStage(fresh(), 'st-1-9');
    expect(first.page?.stage).toBe('st-1-9');
    expect(first.save.lorePages).toEqual([first.page!.id]);
    const again = clearStage(first.save, 'st-1-9');
    expect(again.page).toBeUndefined();
    expect(again.save.lorePages).toEqual([first.page!.id]);
  });

  it('沒有殘頁的關卡、或不是首次通關，都不會拿到', () => {
    expect(clearStage(fresh(), 'st-1-1').page).toBeUndefined();
    expect(grantLorePage(fresh(), 'st-1-9', false, lore).page).toBeUndefined();
  });

  it('集滿一卷才解鎖該卷的隱藏對話', () => {
    const [v] = lore.volumes;
    let save = fresh();
    for (const [i, p] of v.pages.entries()) {
      expect(unlockedSecrets(save, lore)).toEqual([]);
      const r = clearStage(save, p.stage);
      expect(r.unlocked?.id).toBe(i === v.pages.length - 1 ? v.id : undefined);
      save = r.save;
    }
    expect(unlockedSecrets(save, lore).map((x) => x.id)).toEqual([v.id]);
    expect(loreSecretById(lore, loreSecretId(v))?.secret.lines.length).toBeGreaterThan(0);
  });

  it('結算提示：獲得殘頁；集滿時多一行大提示', () => {
    const [v] = lore.volumes;
    let save = fresh();
    for (const p of v.pages.slice(0, -1)) save = clearStage(save, p.stage).save;
    const last = clearStage(save, v.pages.at(-1)!.stage);
    const notes = loreNotes(last);
    expect(notes[0].text).toContain('獲得星骸殘頁');
    expect(notes[1]).toMatchObject({ big: true });
    expect(loreNotes({ save })).toEqual([]);
  });
});

describe('存檔', () => {
  it('新存檔沒有殘頁；這功能之前的舊存檔依通關紀錄補上', () => {
    expect(collectedLorePages(fresh(), lore)).toEqual([]);
    const old = cleared(fresh(), 'st-1-1', 'st-1-9', 'tw-10');
    expect(old.lorePages).toBeUndefined();
    expect(collectedLorePages(old, lore).sort()).toEqual(['page-beast', 'page-shield-1']);
  });

  it('舊存檔第一次拿新頁時，之前通關的頁一併寫進存檔，且這次的提示正確', () => {
    const old = cleared(fresh(), 'st-1-9');
    const r = clearStage(old, 'st-2-9');
    expect(r.page?.id).toBe('page-artisan');
    expect(r.save.lorePages?.sort()).toEqual(['page-artisan', 'page-beast']);
  });

  it('lorePages 會存檔讀回，存檔版本不變', () => {
    const s = clearStage(fresh(), 'st-1-9').save;
    const r = parseSave(serializeSave(s), config, NOW);
    expect(r.ok && r.save.lorePages).toEqual(['page-beast']);
    expect(r.ok && r.save.version).toBe(CURRENT_SAVE_VERSION);
    expect(r.ok && r.migratedFrom).toBeUndefined();
  });
});
