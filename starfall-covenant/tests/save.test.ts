import { describe, expect, it } from 'vitest';
import { gameData } from '../src/data/load';
import {
  SAVE_KEY, CURRENT_SAVE_VERSION, checksum, createNewSave, exportSaveCode, importSaveCode, loadSave, migrate,
  parseSave, resetSave, serializeSave, writeSave, type SaveStorage,
} from '../src/save/save';

const config = gameData.config;
const NOW = Date.UTC(2026, 9, 30, 6, 0, 0);

function memoryStorage(): SaveStorage & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

describe('存檔', () => {
  it('新存檔使用 config 的初始值', () => {
    const save = createNewSave({ ...config, newPlayer: { coin: 123, gems: 7, starterCards: ['a', 'b'] } }, NOW);
    expect(save.version).toBe(CURRENT_SAVE_VERSION);
    expect(save.player).toMatchObject({ level: 1, coin: 123, gems: 7 });
    expect(save.stamina).toEqual({ current: config.stamina.baseMax, lastUpdate: NOW });
    expect(save.inventory.cards.map((c) => c.cardId)).toEqual(['a', 'b']);
    expect(save.teams[0].members).toEqual(['u1', 'u2', null, null, null]);
    expect(save.collection.owned).toEqual(['a', 'b']);
  });

  it('寫入後讀回內容相同', () => {
    const storage = memoryStorage();
    const save = createNewSave(config, NOW);
    save.player.name = '星之旅人';
    writeSave(storage, save, NOW);
    expect(loadSave(storage, config, NOW)).toEqual({ ok: true, save });
  });

  it('沒有存檔時給新存檔', () => {
    const result = loadSave(memoryStorage(), config, NOW);
    expect(result.ok && result.save.player.level).toBe(1);
  });

  it('手動改壞的存檔被校驗碼擋下，且不覆蓋原存檔', () => {
    const storage = memoryStorage();
    writeSave(storage, createNewSave(config, NOW), NOW);
    const tampered = storage.map.get(SAVE_KEY)!.replace('"gems":50', '"gems":99999');
    storage.setItem(SAVE_KEY, tampered);
    expect(loadSave(storage, config, NOW)).toEqual({ ok: false, reason: 'checksum' });
    expect(storage.map.get(SAVE_KEY)).toBe(tampered);
  });

  it('不是 JSON 的內容回報 corrupt', () => {
    expect(parseSave('{oops', config, NOW)).toEqual({ ok: false, reason: 'corrupt' });
  });

  it('比遊戲版本新的存檔拒絕讀取', () => {
    const save = { ...createNewSave(config, NOW), version: CURRENT_SAVE_VERSION + 1 };
    expect(parseSave(serializeSave(save), config, NOW)).toEqual({ ok: false, reason: 'tooNew' });
  });

  it('缺欄位的存檔用預設值補齊', () => {
    const partial = { version: CURRENT_SAVE_VERSION, player: { name: '舊玩家', level: 5, exp: 0, coin: 1, gems: 2 } };
    const text = JSON.stringify({ data: partial, checksum: checksum(JSON.stringify(partial)) });
    const result = parseSave(text, config, NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.save.player).toMatchObject({ name: '舊玩家', level: 5, tokens: {} });
    expect(result.save.gacha).toEqual({ pityCounter: {}, history: [] });
    expect(result.save.settings.battleSpeed).toBe(1);
  });

  it('遷移依序執行每一步', () => {
    const steps = {
      0: (d: Record<string, unknown>) => ({ ...d, a: 1 }),
      1: (d: Record<string, unknown>) => ({ ...d, b: (d.a as number) + 1 }),
    };
    expect(migrate({ version: 0 }, steps, 2)).toEqual({ version: 2, a: 1, b: 2 });
    expect(() => migrate({ version: 0 }, {}, 1)).toThrow();
  });

  it('存檔碼可以匯出再匯入（含中文）', () => {
    const save = createNewSave(config, NOW);
    save.player.name = '灰燈港的見習契印師';
    const code = exportSaveCode(save);
    expect(code).toMatch(/^[A-Za-z0-9+/=]+$/);
    expect(importSaveCode(`  ${code}\n`, config, NOW)).toEqual({ ok: true, save });
    expect(importSaveCode('不是存檔碼', config, NOW)).toEqual({ ok: false, reason: 'corrupt' });
  });

  it('重置存檔', () => {
    const storage = memoryStorage();
    const save = createNewSave(config, NOW);
    save.player.level = 30;
    writeSave(storage, save, NOW);
    expect(resetSave(storage, config, NOW).player.level).toBe(1);
    const reloaded = loadSave(storage, config, NOW);
    expect(reloaded.ok && reloaded.save.player.level).toBe(1);
  });
});

describe('存檔 v2 → v3 遷移（章節星章獎勵）', () => {
  const v2 = (): Record<string, unknown> => {
    const save = createNewSave(config, NOW);
    const { chapterRewardsClaimed: _drop, ...progress } = save.progress;
    return { ...save, version: 2, progress: { ...progress, clearedStages: ['st-1-1'], stars: { 'st-1-1': [true, true, true] } } };
  };

  it('補上空的已領取清單，其他進度不變', () => {
    const out = migrate(v2());
    expect(out.version).toBe(3);
    expect(out.progress).toMatchObject({ clearedStages: ['st-1-1'], stars: { 'st-1-1': [true, true, true] }, chapterRewardsClaimed: [] });
  });

  it('已經有清單的（手改或重複遷移）保留原值', () => {
    const old = v2();
    const out = migrate({ ...old, progress: { ...(old.progress as object), chapterRewardsClaimed: [1] } });
    expect((out.progress as { chapterRewardsClaimed: number[] }).chapterRewardsClaimed).toEqual([1]);
  });

  it('v2 存檔碼匯入後遷移成 v3；再存讀一次不會再遷移', () => {
    const r = importSaveCode(exportSaveCode(v2() as never), config, NOW);
    expect(r.ok && r.migratedFrom).toBe(2);
    if (!r.ok) return;
    expect(r.save.version).toBe(3);
    expect(r.save.progress.chapterRewardsClaimed).toEqual([]);
    const again = importSaveCode(exportSaveCode(r.save), config, NOW);
    expect(again).toEqual({ ok: true, save: r.save });
  });
});
