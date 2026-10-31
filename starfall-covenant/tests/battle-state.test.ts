import { describe, expect, it } from 'vitest';
import gameConfig from '../data/config.json';
import { findMatches, type Board, type Pos } from '../src/battle/board';
import { startBattle, statsAtLevel, type BattleData } from '../src/battle/battle-state';
import { createRng } from '../src/core/rng';
import type { CardDef, EnemyDef, GameConfig, StageDef } from '../src/core/types';

const card = (id: string, attribute: CardDef['attribute'], extra: Partial<CardDef> = {}): CardDef => ({
  id,
  name: id,
  attribute,
  race: 'human',
  rarity: 4,
  maxLevel: 50,
  stats: { hp: [500, 1000], atk: [200, 400], rcv: [50, 100] },
  growthCurve: 1,
  cost: 5,
  expValue: 100,
  sellValue: 100,
  archetypes: [],
  art: {},
  flavor: '',
  ...extra,
});

const enemy = (id: string, hp: number, atk = 100, cd = 2): EnemyDef => ({
  id, name: id, attribute: 'light', hp, atk, def: 0, cd, abilities: [], art: {},
});

const data: BattleData = {
  config: gameConfig as GameConfig,
  cards: [
    card('c-fire', 'fire', { leaderSkill: 'ls-fire' }),
    card('c-water', 'water'),
    card('c-helper', 'wood', { leaderSkill: 'ls-hp' }),
  ],
  skills: [],
  leaderSkills: [
    { id: 'ls-fire', name: '焰', description: '', rules: [{ conditions: [{ type: 'always' }], effects: [{ type: 'atkMultiplier', value: 2 }] }] },
    { id: 'ls-hp', name: '生命', description: '', rules: [{ conditions: [{ type: 'always' }], effects: [{ type: 'hpMultiplier', value: 2 }, { type: 'enemyCooldownPlus', turns: 1 }] }] },
  ],
  enemies: [enemy('slime', 1, 50), enemy('boss', 1_000_000, 300, 1)],
};

const stage = (waves: string[][]): StageDef => ({
  id: 's-test',
  kind: 'main',
  name: '測試',
  stamina: 5,
  unlockAfter: null,
  waves: waves.map((enemies) => ({ enemies })),
  rewards: { coin: 0, playerExp: 0 },
  drops: [],
});

/** 找一步能造成消除的相鄰交換，模擬簡單的 AI 轉珠 */
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

describe('statsAtLevel', () => {
  it('Lv1 與 LvMax 對應數值範圍兩端', () => {
    const c = card('x', 'fire');
    expect(statsAtLevel(c, 1)).toEqual({ hp: 500, atk: 200, rcv: 50 });
    expect(statsAtLevel(c, 50)).toEqual({ hp: 1000, atk: 400, rcv: 100 });
  });
});

describe('startBattle', () => {
  it('開場：隊長＋助戰隊長技生效、盤面讀 config、敵人 CD 加成', async () => {
    const battle = startBattle(
      stage([['slime']]),
      [{ cardId: 'c-fire', level: 50 }, { cardId: 'c-water', level: 50 }],
      { cardId: 'c-helper', level: 50 },
      createRng(1),
      data,
    );
    const started: string[] = [];
    battle.events.on('battleStart', () => started.push('battleStart'));
    battle.events.on('waveStart', () => started.push('waveStart'));
    await Promise.resolve();
    expect(started).toEqual(['battleStart', 'waveStart']);

    const s = battle.getState();
    expect(s.board.cols).toBe(6);
    expect(s.board.rows).toBe(5);
    expect(s.maxHp).toBe(6000);
    expect(s.team.map((m) => m.isHelper)).toEqual([false, false, true]);
    expect(s.enemies[0].maxCooldown).toBe(3);
  });

  it('打完所有波次即勝利，並回傳結算結果', () => {
    const battle = startBattle(stage([['slime'], ['slime', 'slime']]), [{ cardId: 'c-fire', level: 50 }], null, createRng(2), data);
    const log: string[] = [];
    battle.events.on('waveCleared', ({ wave }) => log.push(`clear${wave}`));
    battle.events.on('battleEnd', ({ result }) => log.push(result.outcome));
    // 史萊姆生命 1，只要有任何攻擊命中就倒下；最多跑 50 回合
    for (let i = 0; i < 50 && battle.getState().phase === 'player'; i++) {
      const r = battle.submitMove(findMove(battle.getState().board));
      expect(r.ok).toBe(true);
    }
    expect(battle.getState().phase).toBe('won');
    expect(log).toEqual(['clear0', 'clear1', 'win']);
    expect(battle.getResult()).toMatchObject({ stageId: 's-test', outcome: 'win', continues: 0, teamCardIds: ['c-fire'] });
  });

  it('生命歸零失敗，續戰回滿生命', () => {
    const weak = { ...data, enemies: [enemy('boss', 1_000_000, 999_999, 1)] };
    const battle = startBattle(stage([['boss']]), [{ cardId: 'c-water', level: 1 }], null, createRng(3), weak);
    const r = battle.submitMove([]);
    expect(r.ok && r.enemyAttacks).toHaveLength(1);
    expect(battle.getState().phase).toBe('lost');
    expect(battle.getResult()?.outcome).toBe('lose');
    expect(battle.submitMove([]).ok).toBe(false);

    expect(battle.continueBattle().ok).toBe(true);
    const s = battle.getState();
    expect([s.phase, s.hp, s.continues]).toEqual(['player', s.maxHp, 1]);
    expect(battle.getResult()).toBeNull();
  });

  it('getState 回傳快照，修改不影響戰鬥', () => {
    const battle = startBattle(stage([['boss']]), [{ cardId: 'c-fire', level: 1 }], null, createRng(4), data);
    const s = battle.getState();
    s.hp = 0;
    s.board.cells[0].type = 'heart';
    expect(battle.getState().hp).toBeGreaterThan(0);
  });

  it('相同種子與操作得到相同結果（模擬器可重現）', () => {
    const run = () => {
      const battle = startBattle(stage([['boss']]), [{ cardId: 'c-fire', level: 30 }], null, createRng(7), data);
      for (let i = 0; i < 5; i++) battle.submitMove(findMove(battle.getState().board));
      return battle.getState();
    };
    expect(run()).toEqual(run());
  });

  it('找不到資料時直接報錯', () => {
    expect(() => startBattle(stage([['nobody']]), [{ cardId: 'c-fire', level: 1 }], null, createRng(1), data)).toThrow('找不到敵人');
  });
});

describe('TurnSummary.steps', () => {
  it('隊長技的強化珠天降：天降的新珠依機率變成強化珠', () => {
    const sky = (rate: number): BattleData => ({
      ...data,
      leaderSkills: [...data.leaderSkills, { id: 'ls-sky', name: '天降', description: '', rules: [{ conditions: [{ type: 'always' }], effects: [{ type: 'enhancedSkyfall', rate }] }] }],
      cards: [card('c-sky', 'fire', { leaderSkill: 'ls-sky' })],
    });
    const enhancedAfterMove = (rate: number) => {
      const battle = startBattle(stage([['boss']]), [{ cardId: 'c-sky', level: 50 }], null, createRng(3), sky(rate));
      expect(battle.getState().board.cells.some((o) => o.enhanced)).toBe(false);
      battle.submitMove(findMove(battle.getState().board));
      return battle.getState().board.cells.filter((o) => o.enhanced).length;
    };
    expect(enhancedAfterMove(1)).toBeGreaterThanOrEqual(3);
    expect(enhancedAfterMove(0)).toBe(0);
  });

  it('轉珠結算附上放手後的盤面與逐段消除', () => {
    const battle = startBattle(stage([['boss']]), [{ cardId: 'c-fire', level: 1 }], null, createRng(5), data);
    const before = battle.getState().board;
    const path = findMove(before);
    const r = battle.submitMove(path);
    if (!r.ok) throw new Error(r.reason);
    expect(r.summary.steps.length).toBeGreaterThan(0);
    expect(r.summary.steps[0].before).toBe(r.summary.movedBoard);
    expect(r.summary.steps.flatMap((s) => s.groups)).toEqual(r.summary.groups);
    expect(r.summary.steps[r.summary.steps.length - 1].after).toEqual(battle.getState().board);
  });
});
