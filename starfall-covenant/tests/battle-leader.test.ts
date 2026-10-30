import { describe, expect, it } from 'vitest';
import gameConfig from '../data/config.json';
import { boardFromStrings, resolveBoard, type MatchGroup } from '../src/battle/board';
import { applyHits, computeAttacks, computeHeal, incomingDamage, type BattleMember } from '../src/battle/damage';
import {
  evaluateLeaderStatic,
  evaluateLeaderTurn,
  lintLeaderSkill,
  type LeaderTurnContext,
} from '../src/battle/leader';
import { createRng } from '../src/core/rng';
import type { Attribute, LeaderSkillDef, OrbType, Race } from '../src/core/types';

const config = gameConfig.battle;

const member = (attribute: Attribute, race: Race = 'human', atk = 1000): BattleMember => ({
  cardId: 'test',
  attribute,
  race,
  hp: 2000,
  atk,
  rcv: 300,
});

function group(orb: OrbType, size = 3, enhancedCount = 0): MatchGroup {
  return { orb, cells: Array.from({ length: size }, (_, i) => i), enhancedCount, poisonCount: 0, cascade: 0 };
}

const leader = (rules: LeaderSkillDef['rules']): LeaderSkillDef => ({ id: 'ls', name: '測試', rules, description: '' });

function ctx(partial: Partial<LeaderTurnContext>): LeaderTurnContext {
  const groups = partial.groups ?? [];
  return { team: [], groups, combo: groups.length, hpPercent: 100, skillUsedThisTurn: false, ...partial };
}

// 以 GDD 2.0 的 12 個流派「典型隊長技」檢查效果積木是否表達得出來
describe('十二流派的典型隊長技', () => {
  const fireTeam = [member('fire'), member('fire'), member('water')];

  it('單屬爆發：焰屬性攻擊 ×3.5', () => {
    const ls = leader([{ conditions: [{ type: 'always' }], effects: [{ type: 'atkMultiplier', target: { attribute: 'fire' }, value: 3.5 }] }]);
    expect(evaluateLeaderTurn([ls], ctx({ team: fireTeam })).atkMultipliers).toEqual([3.5, 3.5, 1]);
  });

  it('七彩齊攻：4 色 ×4、5 色 ×6', () => {
    const ls = leader([{
      conditions: [{ type: 'attributesMatched', count: 4 }],
      effects: [{ type: 'atkMultiplier', value: 4, perStep: 2, maxValue: 6 }],
    }]);
    const team = [member('fire')];
    const three = [group('fire'), group('water'), group('wood'), group('heart')];
    const four = [...three, group('light')];
    const five = [...four, group('dark')];
    expect(evaluateLeaderTurn([ls], ctx({ team, groups: three })).atkMultipliers).toEqual([1]);
    expect(evaluateLeaderTurn([ls], ctx({ team, groups: four })).atkMultipliers).toEqual([4]);
    expect(evaluateLeaderTurn([ls], ctx({ team, groups: five })).atkMultipliers).toEqual([6]);
  });

  it('連擊狂潮：Combo ≥ 6 起 ×2，每多 1 Combo +0.5，最高 ×4', () => {
    const ls = leader([{
      conditions: [{ type: 'comboAtLeast', combo: 6 }],
      effects: [{ type: 'atkMultiplier', value: 2, perStep: 0.5, maxValue: 4 }],
    }]);
    const team = [member('water')];
    const at = (combo: number) => evaluateLeaderTurn([ls], ctx({ team, combo })).atkMultipliers[0];
    expect([at(5), at(6), at(8), at(12)]).toEqual([1, 2, 3, 4]);
  });

  it('長串貫穿：單串 ≥ 6 顆時 ×3 並無視防禦', () => {
    const ls = leader([{
      conditions: [{ type: 'orbsInOneMatch', count: 6 }],
      effects: [{ type: 'atkMultiplier', value: 3 }, { type: 'ignoreDefense' }],
    }]);
    const team = [member('dark')];
    const short = evaluateLeaderTurn([ls], ctx({ team, groups: [group('dark', 5)] }));
    const long = evaluateLeaderTurn([ls], ctx({ team, groups: [group('dark', 7)] }));
    expect([short.atkMultipliers[0], short.ignoreDefense]).toEqual([1, false]);
    expect([long.atkMultipliers[0], long.ignoreDefense]).toEqual([3, true]);
  });

  it('心之守護：消除 2 組心珠時回復 ×3、減傷 30%', () => {
    const ls = leader([
      { conditions: [{ type: 'always' }], effects: [{ type: 'damageReduction', percent: 30 }] },
      { conditions: [{ type: 'heartsMatched', count: 2 }], effects: [{ type: 'rcvMultiplier', value: 3 }] },
    ]);
    const team = [member('wood')];
    const turn = evaluateLeaderTurn([ls], ctx({ team, groups: [group('heart'), group('heart')] }));
    expect(turn.rcvMultipliers).toEqual([3]);
    expect(incomingDamage(1000, turn.damageReductions)).toBe(700);
  });

  it('種族羈絆：龍嗣生命、攻擊、回復提升，全隊龍嗣再加成', () => {
    const ls = leader([
      {
        conditions: [{ type: 'always' }],
        effects: [
          { type: 'hpMultiplier', target: { race: 'dragon' }, value: 1.5 },
          { type: 'rcvMultiplier', target: { race: 'dragon' }, value: 1.5 },
          { type: 'atkMultiplier', target: { race: 'dragon' }, value: 2.5 },
        ],
      },
      { conditions: [{ type: 'teamAll', filter: { race: 'dragon' } }], effects: [{ type: 'atkMultiplier', value: 1.5 }] },
    ]);
    const mixed = [member('light', 'dragon'), member('fire', 'beast')];
    const pure = [member('light', 'dragon'), member('fire', 'dragon')];
    const stat = evaluateLeaderStatic([ls], mixed);
    expect(stat.hpMultipliers).toEqual([1.5, 1]);
    expect(stat.rcvMultipliers).toEqual([1.5, 1]);
    // 無條件的回復倍率已計入面板，回合計算不重複
    expect(evaluateLeaderTurn([ls], ctx({ team: mixed })).rcvMultipliers).toEqual([1, 1]);
    expect(evaluateLeaderTurn([ls], ctx({ team: mixed })).atkMultipliers).toEqual([2.5, 1]);
    expect(evaluateLeaderTurn([ls], ctx({ team: pure })).atkMultipliers).toEqual([3.75, 3.75]);
  });

  it('強化珠增幅：消除 3 顆強化珠 ×2.5，每多 1 顆 +0.25', () => {
    const ls = leader([{
      conditions: [{ type: 'enhancedOrbsMatched', count: 3 }],
      effects: [{ type: 'atkMultiplier', value: 2.5, perStep: 0.25 }],
    }]);
    const turn = evaluateLeaderTurn([ls], ctx({ team: [member('wood')], groups: [group('wood', 6, 5)] }));
    expect(turn.atkMultipliers).toEqual([3]);
  });

  it('時之控場：敵人 CD +1、全隊減傷', () => {
    const ls = leader([{
      conditions: [{ type: 'always' }],
      effects: [{ type: 'enemyCooldownPlus', turns: 1 }, { type: 'damageReduction', percent: 20 }],
    }]);
    expect(evaluateLeaderStatic([ls], [member('water')]).enemyCooldownPlus).toBe(1);
    expect(evaluateLeaderTurn([ls], ctx({ team: [member('water')] })).damageReductions).toEqual([20]);
  });

  it('背水一戰：生命 < 30% 時攻擊 ×5', () => {
    const ls = leader([{ conditions: [{ type: 'hpBelow', percent: 30 }], effects: [{ type: 'atkMultiplier', value: 5 }] }]);
    const team = [member('fire')];
    expect(evaluateLeaderTurn([ls], ctx({ team, hpPercent: 30 })).atkMultipliers).toEqual([1]);
    expect(evaluateLeaderTurn([ls], ctx({ team, hpPercent: 29 })).atkMultipliers).toEqual([5]);
  });

  it('雙屬共鳴：同時消除潮與蝕時 ×4', () => {
    const ls = leader([{
      conditions: [{ type: 'attributesMatched', count: 2, attributes: ['water', 'dark'] }],
      effects: [{ type: 'atkMultiplier', value: 4 }],
    }]);
    const team = [member('water')];
    expect(evaluateLeaderTurn([ls], ctx({ team, groups: [group('water'), group('fire')] })).atkMultipliers).toEqual([1]);
    expect(evaluateLeaderTurn([ls], ctx({ team, groups: [group('water'), group('dark')] })).atkMultipliers).toEqual([4]);
  });

  it('技能循環：開場冷卻全滿，施放技能的回合 ×3', () => {
    const ls = leader([
      { conditions: [{ type: 'always' }], effects: [{ type: 'skillCooldownStart', charged: true }] },
      { conditions: [{ type: 'skillUsedThisTurn' }], effects: [{ type: 'atkMultiplier', value: 3 }] },
    ]);
    const team = [member('light')];
    expect(evaluateLeaderStatic([ls], team).skillsStartCharged).toBe(true);
    expect(evaluateLeaderTurn([ls], ctx({ team, skillUsedThisTurn: true })).atkMultipliers).toEqual([3]);
  });

  it('固定傷害：每消除 1 組心珠追打 5000 固定傷害', () => {
    const ls = leader([1, 2, 3].map((n) => ({
      conditions: [{ type: 'heartsMatched' as const, count: n }],
      effects: [{ type: 'followUpDamage' as const, mode: 'fixed' as const, value: 5000 }],
    })));
    const turn = evaluateLeaderTurn([ls], ctx({ team: [member('dark')], groups: [group('heart'), group('heart')] }));
    expect(turn.followUps).toHaveLength(2);
    const { hp } = applyHits(turn.followUps, [{ attribute: 'light', def: 99999, hp: 50000 }], 0, { combo: 2, config });
    expect(hp).toEqual([40000]);
  });
});

describe('隊長與助戰', () => {
  it('兩個隊長技的倍率相乘', () => {
    const a = leader([{ conditions: [{ type: 'always' }], effects: [{ type: 'atkMultiplier', target: { attribute: 'fire' }, value: 3 }] }]);
    const b = leader([{ conditions: [{ type: 'always' }], effects: [{ type: 'atkMultiplier', value: 2 }, { type: 'hpMultiplier', value: 1.2 }] }]);
    const team = [member('fire'), member('water')];
    expect(evaluateLeaderTurn([a, b], ctx({ team })).atkMultipliers).toEqual([6, 2]);
    expect(evaluateLeaderStatic([a, b], team).hpMultipliers).toEqual([1.2, 1.2]);
  });

  it('沒有隊長技（undefined）時倍率為 1', () => {
    expect(evaluateLeaderTurn([undefined, undefined], ctx({ team: [member('fire')] })).atkMultipliers).toEqual([1]);
  });

  it('盤面大小與轉珠時間', () => {
    const ls = leader([{
      conditions: [{ type: 'always' }],
      effects: [{ type: 'boardSize', cols: 7, rows: 6 }, { type: 'extendMoveTime', seconds: 1 }],
    }]);
    const stat = evaluateLeaderStatic([ls, ls], [member('fire')]);
    expect(stat.boardSize).toEqual({ cols: 7, rows: 6 });
    expect(stat.moveTimeBonus).toBe(2);
  });
});

describe('lintLeaderSkill', () => {
  it('提醒寫了但不會生效的組合', () => {
    const ls = leader([
      { conditions: [{ type: 'comboAtLeast', combo: 5 }], effects: [{ type: 'hpMultiplier', value: 2 }] },
      { conditions: [{ type: 'always' }], effects: [{ type: 'atkMultiplier', value: 2, perStep: 1 }] },
      { conditions: [], effects: [] },
    ]);
    expect(lintLeaderSkill(ls)).toHaveLength(3);
  });
});

describe('整合：轉珠 → 隊長技 → 傷害', () => {
  it('連擊隊打出 Combo 後，隊長倍率反映到傷害', () => {
    const board = boardFromStrings([
      'wgldhf',
      'gwhlfd',
      'wlllgh',
      'gwhdfw',
      'hhgfff',
    ]);
    const { groups, combo } = resolveBoard(board, createRng(1));
    const team = [member('fire'), member('light')];
    const ls = leader([{ conditions: [{ type: 'comboAtLeast', combo: 2 }], effects: [{ type: 'atkMultiplier', value: 2 }] }]);
    const turn = evaluateLeaderTurn([ls], ctx({ team, groups, combo }));
    const hits = computeAttacks({ team, groups, combo, config, atkMultipliers: turn.atkMultipliers });
    const noLeader = computeAttacks({ team, groups, combo, config });
    expect(hits.length).toBeGreaterThan(0);
    hits.forEach((h, i) => expect(h.amount).toBeCloseTo(noLeader[i].amount * 2));
    expect(computeHeal({ team, groups, combo, config, rcvMultipliers: turn.rcvMultipliers })).toBeGreaterThanOrEqual(0);
  });
});
