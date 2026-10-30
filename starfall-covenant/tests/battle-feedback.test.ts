import { describe, expect, it } from 'vitest';
import gameConfig from '../data/config.json';
import { findMatches, type Board, type Pos } from '../src/battle/board';
import { startBattle, type BattleData, type BattleState, type EnemyState } from '../src/battle/battle-state';
import {
  comboBonusText,
  comboTier,
  enemyAbilityList,
  matchup,
  newlyReadySkills,
  predictEnemyIntent,
  strikesByMember,
  weakTo,
} from '../src/battle/feedback';
import type { HitResult } from '../src/battle/damage';
import { createRng } from '../src/core/rng';
import type { CardDef, EnemyDef, GameConfig, StageDef } from '../src/core/types';

const config = (gameConfig as GameConfig).battle;

const enemyDef = (extra: Partial<EnemyDef> = {}): EnemyDef => ({
  id: 'e', name: '測試敵', attribute: 'fire', hp: 1000, atk: 900, def: 0, cd: 2, abilities: [], art: {}, ...extra,
});

const enemyState = (extra: Partial<EnemyState> = {}): EnemyState => ({
  def: enemyDef(), hp: 1000, maxHp: 1000, cooldown: 2, maxCooldown: 2, statuses: [], dots: [], lockedTurns: 0, turnsOnField: 0, triggered: [], ...extra,
});

const stateWith = (enemies: EnemyState[], extra: Partial<BattleState> = {}): BattleState =>
  ({ enemies, buffs: [], team: [], ...extra }) as unknown as BattleState;

describe('屬性剋制提示', () => {
  it('剋制、被剋、無關', () => {
    expect(matchup('water', 'fire', config)).toBe('advantage');
    expect(matchup('wood', 'fire', config)).toBe('disadvantage');
    expect(matchup('light', 'fire', config)).toBe('neutral');
    expect(matchup('dark', 'light', config)).toBe('advantage');
    expect(matchup(undefined, 'fire', config)).toBe('neutral');
  });
  it('名牌的弱點屬性', () => {
    expect(weakTo('fire', config)).toEqual(['water']);
    expect(weakTo('wood', config)).toEqual(['fire']);
    expect(weakTo('light', config)).toEqual(['dark']);
  });
});

describe('predictEnemyIntent', () => {
  it('冷卻未到：不攻擊，回報還有幾回合', () => {
    const intent = predictEnemyIntent(stateWith([enemyState({ cooldown: 3 })]), 0)!;
    expect(intent.attack).toBeNull();
    expect(intent.turnsUntilAttack).toBe(3);
  });

  it('CD 1：預估傷害含狂暴、連擊段數與主動技減傷，並列出攻擊時觸發的技能', () => {
    const e = enemyState({
      cooldown: 1,
      statuses: [{ id: 'enrage', turns: 2, value: 2 }, { id: 'multiHit', turns: null, value: 3 }],
      def: enemyDef({ abilities: [{ status: 'skillSeal', trigger: 'onAttack', turns: 2 }, { status: 'shield', trigger: 'hpBelow', params: { percent: 50 } }] }),
    });
    const intent = predictEnemyIntent(stateWith([e], { buffs: [{ kind: 'reduceDamage', percent: 50, turns: 1 }] }), 0)!;
    // 900 × 2 ÷ 3 = 600，減傷 50% → 300，三段
    expect(intent.attack).toEqual({ damage: 900, hits: 3 });
    expect(intent.abilities.map((a) => a.status)).toEqual(['skillSeal']);
    expect(predictEnemyIntent(stateWith([e]), 0, [50])!.attack!.damage).toBe(900);
  });

  it('被鎖定時不攻擊，但 everyNTurns 照樣倒數', () => {
    const e = enemyState({
      cooldown: 1, lockedTurns: 2, turnsOnField: 2,
      def: enemyDef({ abilities: [{ status: 'poisonOrbs', trigger: 'everyNTurns', params: { n: 3 } }] }),
    });
    const intent = predictEnemyIntent(stateWith([e]), 0)!;
    expect(intent.locked).toBe(true);
    expect(intent.attack).toBeNull();
    expect(intent.turnsUntilAttack).toBe(3);
    expect(intent.abilities.map((a) => a.status)).toEqual(['poisonOrbs']);
    expect(predictEnemyIntent(stateWith([{ ...e, turnsOnField: 0 }]), 0)!.abilities).toEqual([]);
  });

  it('倒下的敵人沒有預告', () => {
    expect(predictEnemyIntent(stateWith([enemyState({ hp: 0 })]), 0)).toBeNull();
    expect(predictEnemyIntent(stateWith([]), 0)).toBeNull();
  });

  it('和實際戰鬥結算一致', () => {
    const card = (id: string, attribute: CardDef['attribute']): CardDef => ({
      id, name: id, attribute, race: 'human', rarity: 4, maxLevel: 50,
      stats: { hp: [5000, 5000], atk: [1, 1], rcv: [1, 1] }, growthCurve: 1, cost: 5, expValue: 1, sellValue: 1, archetypes: [], art: {}, flavor: '',
    });
    const data: BattleData = {
      config: gameConfig as GameConfig,
      cards: [card('c1', 'fire')],
      skills: [],
      leaderSkills: [],
      enemies: [enemyDef({ id: 'boss', hp: 1e9, atk: 777, cd: 1, abilities: [{ status: 'enrage', trigger: 'everyNTurns', value: 2, turns: 3, params: { n: 2 } }] })],
    };
    const stage: StageDef = { id: 's', kind: 'main', name: 's', stamina: 0, unlockAfter: null, waves: [{ enemies: ['boss'] }], rewards: { coin: 0, playerExp: 0 }, drops: [] };
    const battle = startBattle(stage, [{ cardId: 'c1', level: 1 }], null, createRng(3), data);
    const move = (board: Board): Pos[] => {
      for (let i = 0; i + 1 < board.cells.length; i++) {
        const cells = board.cells.slice();
        [cells[i], cells[i + 1]] = [cells[i + 1], cells[i]];
        if ((i + 1) % board.cols && findMatches({ ...board, cells }).length) return [{ row: Math.floor(i / board.cols), col: i % board.cols }, { row: Math.floor(i / board.cols), col: (i % board.cols) + 1 }];
      }
      return [{ row: 0, col: 0 }, { row: 0, col: 1 }];
    };
    for (let turn = 0; turn < 3; turn++) {
      const s = battle.getState();
      const intent = predictEnemyIntent(s, 0)!;
      const r = battle.submitMove(move(s.board));
      if (!r.ok) throw new Error(r.reason);
      expect(r.enemyAttacks.map((a) => a.damage)).toEqual(intent.attack ? [intent.attack.damage] : []);
      const enraged = battle.getState().enemies[0].statuses.some((x) => x.id === 'enrage');
      if (intent.abilities.some((a) => a.status === 'enrage')) expect(enraged).toBe(true);
    }
  });

  it('技能列表標出已觸發的一次性技能', () => {
    const e = enemyState({ triggered: [1], def: enemyDef({ abilities: [{ status: 'skillSeal', trigger: 'onAttack' }, { status: 'shield', trigger: 'hpBelow' }] }) });
    expect(enemyAbilityList(e).map((a) => a.done)).toEqual([false, true]);
  });
});

describe('Combo 演出', () => {
  it('分級與稱號', () => {
    expect(comboTier(4)).toEqual({ tier: 0 });
    expect(comboTier(5).tier).toBe(1);
    expect(comboTier(8)).toEqual({ tier: 2, title: '流星雨' });
    expect(comboTier(12)).toEqual({ tier: 3, title: '星河連綴' });
  });
  it('加成倍率文字依 GDD 公式', () => {
    expect(comboBonusText(1, config)).toBe('×1');
    expect(comboBonusText(6, config)).toBe('×2.25');
    expect(comboBonusText(0, config)).toBe('×0');
  });
});

describe('技能就緒', () => {
  const m = (index: number, skillCooldown: number | null) => ({ index, skillCooldown }) as BattleState['team'][number];
  it('只回報這回合剛冷卻完的隊員', () => {
    expect(newlyReadySkills([m(0, 1), m(1, 0), m(2, 2), m(3, null)], [m(0, 0), m(1, 0), m(2, 1), m(3, null)])).toEqual([0]);
  });
});

describe('隊員傷害拆分', () => {
  it('依隊員與屬性分組，標出剋制與全體攻擊', () => {
    const enemies = [{ def: enemyDef({ attribute: 'fire' }) }, { def: enemyDef({ attribute: 'wood' }) }];
    const hits: HitResult[] = [
      { hit: { member: 0, attribute: 'water', target: 'single', amount: 1 }, enemy: 0, damage: 300 },
      { hit: { member: 1, attribute: 'fire', target: 'all', amount: 1 }, enemy: 0, damage: 50 },
      { hit: { member: 1, attribute: 'fire', target: 'all', amount: 1 }, enemy: 1, damage: 200 },
      { hit: { member: 0, attribute: 'water', target: 'single', amount: 1 }, enemy: 0, damage: 100 },
      { hit: { member: -1, target: 'single', amount: 1, fixed: true }, enemy: 1, damage: 10 },
    ];
    const s = strikesByMember(hits, enemies, config);
    expect(s.map((x) => [x.member, x.total, x.sweep])).toEqual([[0, 400, false], [1, 250, true], [-1, 10, false]]);
    expect(s[0].targets).toEqual([{ enemy: 0, damage: 400, matchup: 'advantage' }]);
    expect(s[1].targets.map((t) => t.matchup)).toEqual(['neutral', 'advantage']);
    expect(s[2].targets[0].matchup).toBe('neutral');
  });
});
