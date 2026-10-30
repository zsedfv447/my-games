import { describe, expect, it } from 'vitest';
import gameConfig from '../data/config.json';
import { boardFromStrings, boardToStrings, countOrbs, findMatches } from '../src/battle/board';
import { startBattle, type BattleData } from '../src/battle/battle-state';
import { rowToOrb, twoColorBoard } from '../src/battle/skills/board-ops';
import { createRng } from '../src/core/rng';
import type { CardDef, GameConfig, SkillEffect, StageDef } from '../src/core/types';

const BOARD = ['fwglhd', 'wglhdf', 'glhdfw', 'lhdfwg', 'hdfwgl'];

describe('盤面積木：twoColorBoard', () => {
  it('心珠保留，其餘轉成兩色且數量平均', () => {
    const out = twoColorBoard(boardFromStrings(BOARD), ['fire', 'light']);
    const c = countOrbs(out);
    expect(c.heart).toBe(5);
    expect(c.water + c.wood + c.dark).toBe(0);
    expect(c.fire + c.light).toBe(25);
    expect(Math.abs(c.fire - c.light)).toBeLessThanOrEqual(1);
  });

  it('keep 可以多保留一色（例如保留蝕珠）', () => {
    const out = twoColorBoard(boardFromStrings(BOARD), ['fire', 'light'], ['heart', 'dark']);
    const c = countOrbs(out);
    expect([c.heart, c.dark]).toEqual([5, 5]);
    expect(c.fire + c.light).toBe(20);
  });

  it('結果固定、不改原盤面、清除毒與暗但保留強化與封鎖', () => {
    const board = boardFromStrings(['FWglhd', 'wglhdf', 'glhdfw', 'lhdfwg', 'hdfwgl']);
    board.cells[3] = { ...board.cells[3], poison: true, locked: true };
    const before = boardToStrings(board);
    const a = twoColorBoard(board, ['water', 'wood']);
    expect(boardToStrings(board)).toEqual(before);
    expect(twoColorBoard(board, ['water', 'wood'])).toEqual(a);
    expect(a.cells[0].enhanced).toBe(true);
    expect(a.cells[3].poison).toBe(false);
    expect(a.cells[3].locked).toBe(true);
  });
});

describe('盤面積木：rowToOrb', () => {
  it('最下排（−1）整排轉色，形成 6 顆一串', () => {
    const out = rowToOrb(boardFromStrings(BOARD), -1, 'dark');
    expect(boardToStrings(out)[4]).toBe('dddddd');
    expect(boardToStrings(out).slice(0, 4)).toEqual(BOARD.slice(0, 4));
    expect(findMatches(out).some((g) => g.cells.length === 6 && g.orb === 'dark')).toBe(true);
  });

  it('0 是最上排；超出範圍時盤面不變', () => {
    expect(boardToStrings(rowToOrb(boardFromStrings(BOARD), 0, 'water'))[0]).toBe('wwwwww');
    expect(boardToStrings(rowToOrb(boardFromStrings(BOARD), 9, 'water'))).toEqual(BOARD);
    expect(boardToStrings(rowToOrb(boardFromStrings(BOARD), -6, 'water'))).toEqual(BOARD);
  });
});

describe('經由主動技施放', () => {
  const card = (id: string, extra: Partial<CardDef> = {}): CardDef => ({
    id, name: id, attribute: 'fire', race: 'human', rarity: 4, maxLevel: 1,
    stats: { hp: [5000, 5000], atk: [1000, 1000], rcv: [500, 500] }, growthCurve: 1, cost: 5,
    expValue: 0, sellValue: 0, archetypes: [], art: {}, flavor: '', ...extra,
  });
  const cast = (effects: SkillEffect[]) => {
    const data: BattleData = {
      config: gameConfig as GameConfig,
      cards: [card('a', { activeSkill: 's1', leaderSkill: 'ls' })],
      skills: [{ id: 's1', name: '技', cooldown: { max: 5, min: 2 }, effects, description: '' }],
      leaderSkills: [{ id: 'ls', name: '隊長', description: '', rules: [{ conditions: [{ type: 'always' }], effects: [{ type: 'skillCooldownStart', charged: true }] }] }],
      enemies: [{ id: 'e', name: '敵', attribute: 'light', hp: 1_000_000, atk: 1, def: 0, cd: 9, abilities: [], art: {} }],
    };
    const stage: StageDef = { id: 's', kind: 'main', name: '測', stamina: 0, unlockAfter: null, waves: [{ enemies: ['e'] }], rewards: { coin: 0, playerExp: 0 }, drops: [] };
    const battle = startBattle(stage, [{ cardId: 'a', level: 1 }], null, createRng(3), data);
    const r = battle.useSkill(0);
    if (!r.ok) throw new Error(r.reason);
    return { used: r.skill, board: battle.getState().board };
  };

  it('twoColorBoard', () => {
    const { used, board } = cast([{ type: 'twoColorBoard', colors: ['fire', 'light'] }]);
    expect(used.boardChanged).toBe(true);
    const c = countOrbs(board);
    expect(c.water + c.wood + c.dark).toBe(0);
  });

  it('rowToOrb', () => {
    const { used, board } = cast([{ type: 'rowToOrb', row: -1, to: 'wood' }]);
    expect(used.boardChanged).toBe(true);
    expect(boardToStrings(board)[board.rows - 1]).toMatch(/^g+$/i);
  });
});
