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
    const out = migrate(v2(), undefined, 3);
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
    expect(r.save.version).toBe(CURRENT_SAVE_VERSION);
    expect(r.save.progress.chapterRewardsClaimed).toEqual([]);
    const again = importSaveCode(exportSaveCode(r.save), config, NOW);
    expect(again).toEqual({ ok: true, save: r.save });
  });
  it('凍結的 v2 舊匯出碼：校驗碼通過、升到 v3、其他進度原樣保留', () => {
    // 由 v2 版本格式手寫的存檔產生，不經過現在的 createNewSave，用來防止格式變動弄壞舊存檔碼
    const OLD_V2_CODE = 'eyJkYXRhIjp7InZlcnNpb24iOjIsInBsYXllciI6eyJuYW1lIjoi6IiK546p5a62IiwibGV2ZWwiOjcsImV4cCI6MTIsImNvaW4iOjM0NTYsImdlbXMiOjIxLCJ0b2tlbnMiOnt9fSwic3RhbWluYSI6eyJjdXJyZW50IjoyMCwibGFzdFVwZGF0ZSI6MTc5MzMwMDAwMDAwMH0sImludmVudG9yeSI6eyJjYXBhY2l0eSI6MTAwLCJjYXJkcyI6W3sidWlkIjoidTEiLCJjYXJkSWQiOiJjMTA2IiwibGV2ZWwiOjE1LCJleHAiOjkwMCwic2tpbGxMZXZlbCI6MSwibGltaXRCcmVhayI6MCwiYXdha2VuZWQiOjAsImxvY2tlZCI6ZmFsc2UsIm9idGFpbmVkQXQiOjE3OTMzMDAwMDAwMDB9XX0sInRlYW1zIjpbeyJuYW1lIjoi6ZqK5LyNMSIsIm1lbWJlcnMiOlsidTEiLG51bGwsbnVsbCxudWxsLG51bGxdfV0sImFjdGl2ZVRlYW0iOjAsInByb2dyZXNzIjp7ImNsZWFyZWRTdGFnZXMiOlsic3QtMS0xIiwic3QtMS0yIl0sInN0YXJzIjp7InN0LTEtMSI6W3RydWUsdHJ1ZSxmYWxzZV19LCJ0b3dlckZsb29yIjozLCJ0dXRvcmlhbERvbmUiOnRydWUsInN0b3J5U2VlbiI6WyJwcm9sb2d1ZSJdfSwidHV0b3JpYWwiOnsic3RlcCI6ImRvbmUiLCJnaWZ0R2l2ZW4iOnRydWV9LCJnYWNoYSI6eyJwaXR5Q291bnRlciI6e30sImhpc3RvcnkiOltdfSwiY29sbGVjdGlvbiI6eyJzZWVuIjpbImMxMDYiXSwib3duZWQiOlsiYzEwNiJdLCJjbGFpbWVkIjpbXX0sInF1ZXN0cyI6eyJjb3VudGVycyI6e30sImNsYWltZWQiOltdLCJkYWlseVJlc2V0QXQiOiIiLCJ3ZWVrbHlSZXNldEF0IjoiIn0sImRhaWx5Ijp7ImxvZ2luRGF5IjoyLCJsYXN0TG9naW4iOiIyMDI2LTEwLTMwIiwic2hvcFB1cmNoYXNlcyI6e319LCJzZXR0aW5ncyI6eyJiZ20iOjAuOCwic2Z4IjowLjgsImJhdHRsZVNwZWVkIjoxfX0sImNoZWNrc3VtIjoiYmM3ZTYxNjkifQ==';
    const r = importSaveCode(OLD_V2_CODE, config, NOW);
    expect(r.ok && r.migratedFrom).toBe(2);
    if (!r.ok) return;
    expect(r.save.version).toBe(CURRENT_SAVE_VERSION);
    expect(r.save.player).toMatchObject({ name: '舊玩家', level: 7, coin: 3456, gems: 21 });
    expect(r.save.progress).toEqual({
      clearedStages: ['st-1-1', 'st-1-2'], stars: { 'st-1-1': [true, true, false] }, towerFloor: 3, tutorialDone: true,
      storySeen: ['prologue'], chapterRewardsClaimed: [],
    });
    expect(r.save.tutorial).toEqual({ step: 'done', giftGiven: true });
    expect(r.save.inventory.cards[0]).toMatchObject({ uid: 'u1', cardId: 'c106', level: 15, exp: 900 });
  });

  it('冪等：v3 存檔再跑遷移不會改變任何東西', () => {
    const v3 = createNewSave(config, NOW);
    v3.progress.chapterRewardsClaimed = [1, 2];
    expect(migrate(v3 as unknown as Record<string, unknown>)).toEqual(v3);
  });
});

describe('存檔 v3 → v4 遷移（中斷續戰）', () => {
  it('補上 activeBattle: null，其他欄位不變', () => {
    const { activeBattle: _drop, ...rest } = createNewSave(config, NOW);
    const v3 = { ...rest, version: 3 };
    const out = migrate(v3);
    expect(out.version).toBe(4);
    expect(out).toEqual({ ...v3, version: 4, activeBattle: null });
  });

  it('凍結的 v3 舊匯出碼：升到 v4，沒有進行中的戰鬥，其他進度原樣保留', () => {
    // 由 v3 版本格式手寫的存檔產生，不經過現在的 createNewSave
    const OLD_V3_CODE = 'eyJkYXRhIjp7InZlcnNpb24iOjMsInBsYXllciI6eyJuYW1lIjoidjPnjqnlrrYiLCJsZXZlbCI6MTIsImV4cCI6NSwiY29pbiI6OTAwMCwiZ2VtcyI6NDAsInRva2VucyI6e319LCJzdGFtaW5hIjp7ImN1cnJlbnQiOjE4LCJsYXN0VXBkYXRlIjoxNzkzMzAwMDAwMDAwfSwiaW52ZW50b3J5Ijp7ImNhcGFjaXR5IjoxMDAsImNhcmRzIjpbeyJ1aWQiOiJ1MSIsImNhcmRJZCI6ImMxMDYiLCJsZXZlbCI6MjAsImV4cCI6MTUwMCwic2tpbGxMZXZlbCI6MiwibGltaXRCcmVhayI6MCwiYXdha2VuZWQiOjAsImxvY2tlZCI6dHJ1ZSwib2J0YWluZWRBdCI6MTc5MzMwMDAwMDAwMH1dfSwidGVhbXMiOlt7Im5hbWUiOiLpmorkvI0xIiwibWVtYmVycyI6WyJ1MSIsbnVsbCxudWxsLG51bGwsbnVsbF19XSwiYWN0aXZlVGVhbSI6MCwicHJvZ3Jlc3MiOnsiY2xlYXJlZFN0YWdlcyI6WyJzdC0xLTEiXSwic3RhcnMiOnsic3QtMS0xIjpbdHJ1ZSx0cnVlLHRydWVdfSwidG93ZXJGbG9vciI6MCwidHV0b3JpYWxEb25lIjp0cnVlLCJzdG9yeVNlZW4iOltdLCJjaGFwdGVyUmV3YXJkc0NsYWltZWQiOlsxXX0sInR1dG9yaWFsIjp7InN0ZXAiOiJkb25lIiwiZ2lmdEdpdmVuIjp0cnVlfSwiZ2FjaGEiOnsicGl0eUNvdW50ZXIiOnt9LCJoaXN0b3J5IjpbXX0sImNvbGxlY3Rpb24iOnsic2VlbiI6WyJjMTA2Il0sIm93bmVkIjpbImMxMDYiXSwiY2xhaW1lZCI6W119LCJxdWVzdHMiOnsiY291bnRlcnMiOnt9LCJjbGFpbWVkIjpbXSwiZGFpbHlSZXNldEF0IjoiIiwid2Vla2x5UmVzZXRBdCI6IiJ9LCJkYWlseSI6eyJsb2dpbkRheSI6MywibGFzdExvZ2luIjoiMjAyNi0xMC0zMSIsInNob3BQdXJjaGFzZXMiOnt9fSwic2V0dGluZ3MiOnsiYmdtIjowLjgsInNmeCI6MC44LCJiYXR0bGVTcGVlZCI6MX19LCJjaGVja3N1bSI6IjUxMTQwZGQ1In0=';
    const r = importSaveCode(OLD_V3_CODE, config, NOW);
    expect(r.ok && r.migratedFrom).toBe(3);
    if (!r.ok) return;
    expect(r.save.version).toBe(4);
    expect(r.save.activeBattle).toBeNull();
    expect(r.save.player).toMatchObject({ name: 'v3玩家', level: 12, coin: 9000, gems: 40 });
    expect(r.save.progress.chapterRewardsClaimed).toEqual([1]);
    expect(r.save.inventory.cards[0]).toMatchObject({ uid: 'u1', level: 20, exp: 1500, skillLevel: 2, locked: true });
  });

  it('冪等：已有進行中戰鬥的 v4 存檔，再存讀一次完全不變', () => {
    const save = {
      ...createNewSave(config, NOW),
      activeBattle: { stageId: 'st-1-1', seed: 123, members: [{ cardId: 'c106', level: 5, uid: 'u1' }], helper: null, startedAt: NOW, snapshot: null },
    };
    expect(migrate(save as unknown as Record<string, unknown>)).toEqual(save);
    const r = importSaveCode(exportSaveCode(save), config, NOW);
    expect(r).toEqual({ ok: true, save });
  });
});
