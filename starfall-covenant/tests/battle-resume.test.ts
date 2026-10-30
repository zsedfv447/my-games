import { describe, expect, it } from 'vitest';
import gameConfig from '../data/config.json';
import { findMatches, type Board, type Pos } from '../src/battle/board';
import { resumeBattle, startBattle, type Battle, type BattleData, type BattleSnapshot } from '../src/battle/battle-state';
import { createRng } from '../src/core/rng';
import type { CardDef, EnemyDef, GameConfig, StageDef } from '../src/core/types';

const card = (id: string, attribute: CardDef['attribute'], extra: Partial<CardDef> = {}): CardDef => ({
  id, name: id, attribute, race: 'human', rarity: 4, maxLevel: 50,
  stats: { hp: [500, 1000], atk: [200, 400], rcv: [50, 100] }, growthCurve: 1, cost: 5, expValue: 100, sellValue: 100,
  archetypes: [], art: {}, flavor: '很長的卡片介紹文字，不應該被寫進快照', ...extra,
});
const enemy = (id: string, hp: number, atk = 100, cd = 2): EnemyDef => ({
  id, name: id, attribute: 'light', hp, atk, def: 0, cd, abilities: [], art: {},
});

const data: BattleData = {
  config: gameConfig as GameConfig,
  cards: [card('c-fire', 'fire', { leaderSkill: 'ls-fire' }), card('c-water', 'water'), card('c-helper', 'wood')],
  skills: [],
  leaderSkills: [{ id: 'ls-fire', name: '焰', description: '', rules: [{ conditions: [{ type: 'always' }], effects: [{ type: 'atkMultiplier', value: 2 }] }] }],
  enemies: [enemy('tank', 400_000, 300, 2), enemy('slime', 1, 50), enemy('killer', 1_000_000, 999_999, 1)],
};
const stage = (waves: string[][]): StageDef => ({
  id: 's-resume', kind: 'main', name: '續戰', stamina: 5, unlockAfter: null,
  waves: waves.map((enemies) => ({ enemies })), rewards: { coin: 0, playerExp: 0 }, drops: [],
});
const team = [{ cardId: 'c-fire', level: 50, uid: 'u1' }, { cardId: 'c-water', level: 30, uid: 'u2' }];
const helper = { cardId: 'c-helper', level: 40 };

/** 找一步能造成消除的相鄰交換；找不到就原地不動 */
function findMove(board: Board): Pos[] {
  for (let i = 0; i < board.cells.length; i++) {
    const a = { row: Math.floor(i / board.cols), col: i % board.cols };
    for (const [dr, dc] of [[0, 1], [1, 0]]) {
      const b = { row: a.row + dr, col: a.col + dc };
      if (b.row >= board.rows || b.col >= board.cols) continue;
      const cells = board.cells.slice();
      const ib = b.row * board.cols + b.col;
      [cells[i], cells[ib]] = [cells[ib], cells[i]];
      if (findMatches({ ...board, cells }).length) return [a, b];
    }
  }
  return [];
}

const play = (b: Battle, turns: number) => {
  const log: unknown[] = [];
  for (let i = 0; i < turns && b.getState().phase === 'player'; i++) log.push(b.submitMove(findMove(b.getState().board)));
  return log;
};
/** 模擬寫進存檔再讀回來 */
const viaJson = (s: BattleSnapshot): BattleSnapshot => JSON.parse(JSON.stringify(s));

describe('戰鬥中斷續戰', () => {
  it('還原後接著打，盤面、天降、傷害與結果都和沒中斷時完全相同', () => {
    const st = stage([['tank', 'slime'], ['tank']]);
    const a = startBattle(st, team, helper, createRng(42), data);
    play(a, 3);
    const snap = viaJson(a.snapshot());
    const b = resumeBattle(st, snap, data);
    expect(b.getState()).toEqual(a.getState());
    const logA = play(a, 6);
    const logB = play(b, 6);
    expect(logB).toEqual(logA);
    expect(b.getState()).toEqual(a.getState());
    expect(b.getState().turns).toBe(9);
  });

  it('重新整理不能重骰：同一份快照還原兩次，下一步結果一樣', () => {
    const st = stage([['tank']]);
    const snap = viaJson(startBattle(st, team, null, createRng(7), data).snapshot());
    const one = resumeBattle(st, snap, data);
    const two = resumeBattle(st, snap, data);
    expect(one.getState().board).toEqual(two.getState().board);
    const move = findMove(one.getState().board);
    expect(one.submitMove(move)).toEqual(two.submitMove(move));
    expect(one.getState()).toEqual(two.getState());
  });

  it('快照是純 JSON，只存卡片與敵人 id，不帶整份資料', () => {
    const st = stage([['tank']]);
    const snap = startBattle(st, team, helper, createRng(1), data).snapshot();
    const text = JSON.stringify(snap);
    expect(viaJson(snap)).toEqual(snap);
    expect(text).not.toContain('不應該被寫進快照');
    expect(snap.state.enemies[0]).toMatchObject({ defId: 'tank' });
    expect(snap.team).toEqual(team);
    expect(snap.helper).toEqual(helper);
  });

  it('失敗畫面中斷：還原後仍是失敗，可以續戰；勝利後的快照保留結算結果', () => {
    const lose = stage([['killer']]);
    const a = startBattle(lose, [team[1]], null, createRng(3), data);
    a.submitMove([]);
    expect(a.getState().phase).toBe('lost');
    const b = resumeBattle(lose, viaJson(a.snapshot()), data);
    expect(b.getState().phase).toBe('lost');
    expect(b.getResult()?.outcome).toBe('lose');
    expect(b.continueBattle().ok).toBe(true);
    expect(b.getState()).toMatchObject({ phase: 'player', continues: 1 });

    const win = stage([['slime']]);
    const w = startBattle(win, team, null, createRng(5), data);
    play(w, 50);
    expect(w.getState().phase).toBe('won');
    const r = resumeBattle(win, viaJson(w.snapshot()), data);
    expect(r.getResult()).toEqual(w.getResult());
    expect(r.submitMove([]).ok).toBe(false);
  });

  it('還原時不發開場的 waveStart（敵人開場技能不會再觸發一次）', async () => {
    const st = stage([['tank']]);
    const b = resumeBattle(st, viaJson(startBattle(st, team, null, createRng(9), data).snapshot()), data);
    const seen: string[] = [];
    b.events.on('battleStart', () => seen.push('battleStart'));
    b.events.on('waveStart', () => seen.push('waveStart'));
    await Promise.resolve();
    expect(seen).toEqual(['battleStart']);
  });

  it('關卡或隊伍和快照對不上時丟出錯誤', () => {
    const st = stage([['tank'], ['tank']]);
    const snap = viaJson(startBattle(st, team, null, createRng(1), data).snapshot());
    expect(() => resumeBattle({ ...st, id: 'other' }, snap, data)).toThrow();
    expect(() => resumeBattle(st, { ...snap, v: 99 }, data)).toThrow();
    expect(() => resumeBattle(st, { ...snap, team: [team[1], team[0]] }, data)).toThrow();
    expect(() => resumeBattle(st, { ...snap, state: { ...snap.state, wave: 5 } }, data)).toThrow();
    expect(() => resumeBattle(stage([['tank']]), { ...snap, state: { ...snap.state, wave: 1 } }, data)).toThrow();
  });
});
