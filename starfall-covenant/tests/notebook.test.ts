import { describe, expect, it } from 'vitest';
import type { SaveData } from '../src/core/types';
import { gameData } from '../src/data/load';
import { createNewSave, parseSave, serializeSave } from '../src/save/save';
import {
  applyBattleRecord, archetypeCounts, emptyRecords, favoriteLeader, leaderRanking, recordsOf, recordText, starCount, turnDamage, winRate,
} from '../src/progression/records';
import { DEFAULT_VICTORY, leaderLineOf, victoryLine } from '../src/ui/victory-line';
import { validateGameData, VICTORY_LINE_MAX } from '../src/data/validate';

const NOW = new Date(2026, 10, 2, 12).getTime();
const fresh = (): SaveData => createNewSave(gameData.config, NOW);
const entry = (over: Partial<Parameters<typeof applyBattleRecord>[1]> = {}) => ({ stageId: 'st-1-1', won: true, turns: 5, maxCombo: 4, maxTurnDamage: 3000, leaderCardId: 'c106', archetype: 'mono', ...over });

describe('契印師手札：戰績', () => {
  it('舊存檔沒有 records 時補預設值', () => {
    expect(recordsOf(fresh())).toEqual(emptyRecords());
    expect(recordsOf({ records: { maxCombo: 3 } as never })).toMatchObject({ maxCombo: 3, battles: 0, leaderClears: {} });
  });

  it('記錄勝利：次數、最高值、最快回合、隊長與流派', () => {
    const { save, newRecords } = applyBattleRecord(fresh(), entry());
    const r = recordsOf(save);
    expect(r).toMatchObject({ battles: 1, wins: 1, maxCombo: 4, maxTurnDamage: 3000, fastestTurns: { 'st-1-1': 5 }, leaderClears: { c106: 1 }, archetypeClears: { mono: 1 } });
    // 第一次留下數值不算新紀錄
    expect(newRecords).toEqual([]);
  });

  it('打破既有紀錄才算新紀錄', () => {
    let save = applyBattleRecord(fresh(), entry()).save;
    const same = applyBattleRecord(save, entry());
    expect(same.newRecords).toEqual([]);
    save = same.save;
    const better = applyBattleRecord(save, entry({ maxCombo: 7, maxTurnDamage: 9000, turns: 3 }));
    expect(better.newRecords).toEqual(['maxCombo', 'maxTurnDamage', 'fastest']);
    expect(recordsOf(better.save)).toMatchObject({ battles: 3, wins: 3, maxCombo: 7, fastestTurns: { 'st-1-1': 3 }, leaderClears: { c106: 3 } });
  });

  it('失敗只加出戰次數與最高值，不記最快、隊長、流派', () => {
    const base = applyBattleRecord(fresh(), entry()).save;
    const { save, newRecords } = applyBattleRecord(base, entry({ won: false, turns: 1, maxCombo: 9 }));
    const r = recordsOf(save);
    expect(r).toMatchObject({ battles: 2, wins: 1, maxCombo: 9, fastestTurns: { 'st-1-1': 5 }, leaderClears: { c106: 1 } });
    expect(newRecords).toEqual(['maxCombo']);
    expect(winRate(r)).toBe(0.5);
  });

  it('借用隊伍（沒有流派）不計流派', () => {
    const r = recordsOf(applyBattleRecord(fresh(), entry({ archetype: null })).save);
    expect(r.archetypeClears).toEqual({});
  });

  it('不改到原本的存檔物件', () => {
    const save = fresh();
    applyBattleRecord(save, entry());
    expect(save.records).toBeUndefined();
  });

  it('單回合傷害：負數（被吸收）不算', () => {
    expect(turnDamage({ hits: [{ damage: 1200 }, { damage: -500 }, { damage: 300 }] })).toBe(1500);
    expect(turnDamage({ hits: [] })).toBe(0);
  });

  it('排行與統計', () => {
    const r = { ...emptyRecords(), leaderClears: { c201: 2, c106: 5, c101: 2 }, archetypeClears: { mono: 3 } };
    expect(leaderRanking(r, 2)).toEqual([{ cardId: 'c106', clears: 5 }, { cardId: 'c101', clears: 2 }]);
    expect(favoriteLeader(r)).toEqual({ cardId: 'c106', clears: 5 });
    expect(favoriteLeader(emptyRecords())).toBeUndefined();
    expect(archetypeCounts(r, ['mono', 'chain'])).toEqual([{ id: 'mono', clears: 3 }, { id: 'chain', clears: 0 }]);
    const save = fresh();
    expect(starCount({ progress: { ...save.progress, stars: { a: [true, false, true], b: [true] } } })).toBe(3);
  });

  it('新紀錄文字', () => {
    const e = { maxCombo: 9, maxTurnDamage: 123456.4, turns: 4 };
    expect(recordText('maxCombo', e)).toBe('新紀錄！最高 Combo 9');
    expect(recordText('maxTurnDamage', e)).toBe('新紀錄！單回合傷害 123,456');
    expect(recordText('fastest', e)).toBe('新紀錄！本關最快 4 回合通關');
  });

  it('戰績會跟著存檔寫入與讀回', () => {
    const { save } = applyBattleRecord(fresh(), entry());
    const loaded = parseSave(serializeSave(save), gameData.config, NOW);
    expect(loaded.ok && recordsOf(loaded.save)).toEqual(recordsOf(save));
  });
});

describe('隊長勝利台詞', () => {
  const battleCards = gameData.cards.filter((c) => c.archetypes.length > 0);

  it('4★ 以上的戰鬥卡都有專屬台詞（目前全部戰鬥卡都有）', () => {
    for (const c of battleCards.filter((x) => x.rarity >= 4)) expect(c.lines?.victory, c.id).toBeTruthy();
    for (const c of battleCards) expect(c.lines?.victory, c.id).toBeTruthy();
  });

  it('validate 檢查台詞字數上限', () => {
    expect(validateGameData(gameData)).toEqual([]);
    const card = { ...gameData.cards[0], lines: { victory: '長'.repeat(VICTORY_LINE_MAX + 1) } };
    const issues = validateGameData({ ...gameData, cards: [card, ...gameData.cards.slice(1)] });
    expect(issues.some((i) => i.includes('勝利台詞'))).toBe(true);
    const blank = { ...gameData.cards[0], lines: { victory: '  ' } };
    expect(validateGameData({ ...gameData, cards: [blank, ...gameData.cards.slice(1)] }).some((i) => i.includes('勝利台詞'))).toBe(true);
  });

  it('沒有專屬台詞時用屬性預設句', () => {
    expect(victoryLine({ attribute: 'water' })).toBe(DEFAULT_VICTORY.water);
    const rosy = gameData.cards.find((c) => c.id === 'c106')!;
    expect(victoryLine(rosy)).toBe('看到沒？我們的火，比誰都旺！');
  });

  it('結算台詞由第一位非助戰成員說', () => {
    const helper = gameData.cards.find((c) => c.id === 'c101')!;
    const leader = gameData.cards.find((c) => c.id === 'c201')!;
    expect(leaderLineOf({ team: [{ card: helper, isHelper: true }, { card: leader, isHelper: false }] })?.card.id).toBe('c201');
    expect(leaderLineOf({ team: [] })).toBeUndefined();
  });
});
