import { describe, expect, it } from 'vitest';
import gameConfig from '../data/config.json';
import { boardFromStrings, countOrbs, findMatches } from '../src/battle/board';
import { startBattle, type BattleData, type BattleState } from '../src/battle/battle-state';
import { buffAttackMultipliers, skyfallOptions, teamWithRcvToAtk } from '../src/battle/skills/buffs';
import { fillMissingOrbs } from '../src/battle/board';
import { cooldownAtLevel } from '../src/battle/skills/active';
import { defenseProfile, STATUS_INFO } from '../src/battle/skills/status';
import { createRng } from '../src/core/rng';
import {
  STATUS_IDS,
  type CardDef,
  type EnemyAbility,
  type EnemyDef,
  type GameConfig,
  type LeaderSkillDef,
  type PassiveEffect,
  type SkillEffect,
  type StageDef,
} from '../src/core/types';

const card = (id: string, attribute: CardDef['attribute'], extra: Partial<CardDef> = {}): CardDef => ({
  id,
  name: id,
  attribute,
  race: 'human',
  rarity: 4,
  maxLevel: 1,
  stats: { hp: [5000, 5000], atk: [1000, 1000], rcv: [500, 500] },
  growthCurve: 1,
  cost: 5,
  expValue: 0,
  sellValue: 0,
  archetypes: [],
  art: {},
  flavor: '',
  ...extra,
});

interface Setup {
  /** 隊長（焰）的主動技 */
  effects?: SkillEffect[];
  /** 第二位隊員（潮）的主動技 */
  effects2?: SkillEffect[];
  leader?: LeaderSkillDef['rules'];
  enemy?: Partial<EnemyDef>;
  abilities?: EnemyAbility[];
  enemyCount?: number;
  awakenings?: PassiveEffect[];
  skillLevel?: number;
  seed?: number;
}

function setup(o: Setup = {}) {
  const enemy: EnemyDef = {
    id: 'e', name: '測試敵人', attribute: 'light', hp: 1_000_000, atk: 1000, def: 0, cd: 1,
    abilities: o.abilities ?? [], art: {}, ...o.enemy,
  };
  const data: BattleData = {
    config: gameConfig as GameConfig,
    cards: [
      card('a', 'fire', { activeSkill: 's1', leaderSkill: o.leader ? 'ls' : undefined, awakenings: o.awakenings }),
      card('b', 'water', { activeSkill: 's2' }),
    ],
    skills: [
      { id: 's1', name: '技一', cooldown: { max: 5, min: 2 }, effects: o.effects ?? [], description: '' },
      { id: 's2', name: '技二', cooldown: { max: 4, min: 4 }, effects: o.effects2 ?? [], description: '' },
    ],
    leaderSkills: o.leader ? [{ id: 'ls', name: '隊長', description: '', rules: o.leader }] : [],
    enemies: [enemy],
  };
  const stage: StageDef = {
    id: 's', kind: 'main', name: '測試', stamina: 0, unlockAfter: null,
    waves: [{ enemies: Array(o.enemyCount ?? 1).fill('e') }], rewards: { coin: 0, playerExp: 0 }, drops: [],
  };
  const battle = startBattle(
    stage,
    [{ cardId: 'a', level: 1, skillLevel: o.skillLevel, awakened: o.awakenings?.length }, { cardId: 'b', level: 1 }],
    null,
    createRng(o.seed ?? 1),
    data,
  );
  return { battle, data };
}

/** 讓隊長的技能可以馬上施放：用技能循環的隊長技開場充滿 */
const charged: LeaderSkillDef['rules'] = [{ conditions: [{ type: 'always' }], effects: [{ type: 'skillCooldownStart', charged: true }] }];

function cast(effects: SkillEffect[], extra: Setup = {}) {
  const s = setup({ effects, leader: charged, ...extra });
  const before = s.battle.getState();
  const r = s.battle.useSkill(0);
  if (!r.ok) throw new Error(r.reason);
  return { ...s, before, after: s.battle.getState(), used: r.skill };
}

const NO_MATCH: never[] = [];

describe('主動技積木', () => {
  it('convertOrbs：轉珠', () => {
    const { after } = cast([{ type: 'convertOrbs', from: 'all', to: 'fire' }]);
    expect(countOrbs(after.board).fire).toBe(30);
  });

  it('refreshBoard：重整後不會自動消除', () => {
    const { before, after, used } = cast([{ type: 'refreshBoard' }]);
    expect(used.boardChanged).toBe(true);
    expect(after.board).not.toEqual(before.board);
    expect(findMatches(after.board)).toEqual([]);
  });

  it('balanceBoard：六色各 5 顆', () => {
    const { after } = cast([{ type: 'balanceBoard' }]);
    expect(Object.values(countOrbs(after.board))).toEqual([5, 5, 5, 5, 5, 5]);
  });

  it('enhanceOrbs：強化指定顏色', () => {
    const { after } = cast([{ type: 'enhanceOrbs', orbs: 'fire' }]);
    expect(after.board.cells.filter((o) => o.type === 'fire').every((o) => o.enhanced)).toBe(true);
    expect(after.board.cells.filter((o) => o.type !== 'fire').some((o) => o.enhanced)).toBe(false);
  });

  it('fillMissingOrbs：缺的屬性各補 count 顆，心珠不算缺色', () => {
    const board = boardFromStrings(['ffffff', 'wwwwww', 'gggggg', 'ffffff', 'wwwwww']);
    const filled = fillMissingOrbs(board, createRng(1), 3);
    const counts = countOrbs(filled);
    expect([counts.light, counts.dark, counts.heart]).toEqual([3, 3, 0]);
    expect(counts.fire + counts.water + counts.wood).toBe(24);
    // 經由主動技施放也會生效
    const { after } = cast([{ type: 'convertOrbs', from: ['light', 'dark'], to: 'fire' }, { type: 'fillMissingOrbs', count: 2 }]);
    expect(countOrbs(after.board).light).toBe(2);
    expect(countOrbs(after.board).dark).toBe(2);
  });

  it('setSkyfallRate／setEnhancedSkyfallRate／noSkyfallCombo：改變天降設定，到期後恢復', () => {
    const { battle, after } = cast([
      { type: 'setSkyfallRate', orb: 'heart', rate: 0.4, turns: 2 },
      { type: 'setEnhancedSkyfallRate', rate: 0.3, turns: 1 },
      { type: 'noSkyfallCombo', turns: 1 },
    ]);
    expect(skyfallOptions(after)).toEqual({ rates: { heart: 0.4 }, enhancedChance: 0.3, skyfallCombo: false });
    battle.submitMove(NO_MATCH);
    expect(skyfallOptions(battle.getState())).toEqual({ rates: { heart: 0.4 }, enhancedChance: 0, skyfallCombo: true });
    battle.submitMove(NO_MATCH);
    expect(battle.getState().buffs).toEqual([]);
  });

  it('damage：倍率傷害吃剋制，固定傷害不吃防禦', () => {
    const multi = cast([{ type: 'damage', target: 'single', mode: 'multiplier', value: 10, attribute: 'dark' }], { enemy: { def: 1000 } });
    expect(multi.used.hits[0].damage).toBe(1000 * 10 * 1.5 - 1000);
    const fixed = cast([{ type: 'damage', target: 'all', mode: 'fixed', value: 30000 }], { enemy: { def: 99999 }, enemyCount: 2 });
    expect(fixed.used.hits.map((h) => h.damage)).toEqual([30000, 30000]);
  });

  it('damage：打倒最後一隻敵人即勝利', () => {
    const { battle } = cast([{ type: 'damage', target: 'all', mode: 'fixed', value: 1_000_000 }]);
    expect(battle.getResult()?.outcome).toBe('win');
    expect(battle.getResult()?.usedActiveSkill).toBe(true);
  });

  it('damageOverTime：每回合結算，持續指定回合', () => {
    const { battle } = cast([{ type: 'damageOverTime', target: 'all', multiplier: 3, turns: 2 }], { enemy: { attribute: 'fire' } });
    const r1 = battle.submitMove(NO_MATCH);
    expect(r1.ok && r1.summary.dotHits.map((h) => h.damage)).toEqual([3000]);
    const r2 = battle.submitMove(NO_MATCH);
    expect(r2.ok && r2.summary.dotHits).toHaveLength(1);
    const r3 = battle.submitMove(NO_MATCH);
    expect(r3.ok && r3.summary.dotHits).toHaveLength(0);
  });

  it('selfDamage 與 heal', () => {
    const { after, used } = cast([
      { type: 'selfDamage', percentCurrentHp: 50 },
      { type: 'heal', mode: 'percentMaxHp', value: 10 },
    ]);
    expect(used.selfDamage).toBe(5000);
    expect(after.hp).toBe(5000 + 1000);
  });

  it('surviveOnce：致命攻擊留 1 點生命', () => {
    const { battle } = cast([{ type: 'surviveOnce', turns: 1 }], { enemy: { atk: 999_999 } });
    const r = battle.submitMove(NO_MATCH);
    expect(r.ok && r.enemyAttacks[0].survived).toBe(true);
    expect(battle.getState().hp).toBe(1);
    expect(battle.getState().phase).toBe('player');
  });

  it('buffAttack 與 rcvToAtk', () => {
    const { after } = cast([
      { type: 'buffAttack', target: { attribute: 'fire' }, multiplier: 2, turns: 1 },
      { type: 'rcvToAtk', ratio: 2, turns: 2 },
    ]);
    expect(buffAttackMultipliers(after)).toEqual([2, 1]);
    expect(teamWithRcvToAtk(after, after.team).map((m) => m.atk)).toEqual([2000, 2000]);
  });

  it('reduceDamage：敵人攻擊減傷，與隊長技減傷相乘', () => {
    const { battle } = cast([{ type: 'reduceDamage', percent: 50, turns: 1 }], {
      leader: [...charged, { conditions: [{ type: 'always' }], effects: [{ type: 'damageReduction', percent: 20 }] }],
    });
    const r = battle.submitMove(NO_MATCH);
    expect(r.ok && r.enemyAttacks[0].damage).toBe(400);
  });

  it('delayEnemy：延遲敵人；不受延遲的敵人無效', () => {
    const { after } = cast([{ type: 'delayEnemy', turns: 2 }]);
    expect(after.enemies[0].cooldown).toBe(3);
    const immune = cast([{ type: 'delayEnemy', turns: 2 }], { abilities: [{ status: 'delayImmune', trigger: 'onStart' }] });
    expect(immune.after.enemies[0].cooldown).toBe(1);
    expect(immune.used.delayed).toEqual([]);
  });

  it('lockEnemy：鎖定期間敵人不攻擊', () => {
    const { battle } = cast([{ type: 'lockEnemy', turns: 2 }]);
    const attacks = [1, 2, 3].map(() => {
      const r = battle.submitMove(NO_MATCH);
      return r.ok ? r.enemyAttacks.length : -1;
    });
    expect(attacks).toEqual([0, 0, 1]);
  });

  it('extendMoveTime：延長轉珠時間，到期恢復', () => {
    const { battle, before, after } = cast([{ type: 'extendMoveTime', seconds: 2, turns: 1 }]);
    expect(before.moveTimeSeconds).toBe(5);
    expect(after.moveTimeSeconds).toBe(7);
    battle.submitMove(NO_MATCH);
    expect(battle.getState().moveTimeSeconds).toBe(5);
  });

  it('reduceAllyCooldown：只減其他隊友，施放者重新冷卻', () => {
    const { after } = cast([{ type: 'reduceAllyCooldown', turns: 3 }]);
    expect(after.team.map((m) => m.skillCooldown)).toEqual([5, 0]);
  });

  it('chainOnSkill：之後每施放 1 次主動技追加傷害', () => {
    const { battle, used } = cast([{ type: 'chainOnSkill', multiplier: 5, turns: 2 }, { type: 'reduceAllyCooldown', turns: 9 }]);
    expect(used.hits).toEqual([]);
    const r = battle.useSkill(1);
    expect(r.ok && r.skill.hits.map((h) => [h.hit.member, h.damage])).toEqual([[0, 5000]]);
  });

  it('cleanse：解除我方異常狀態與干擾珠', () => {
    const { after } = cast([{ type: 'cleanse' }], {
      abilities: [
        { status: 'poison', trigger: 'onStart', value: 10, turns: 5 },
        { status: 'orbLock', trigger: 'onStart', value: 5, turns: 3 },
      ],
    });
    expect(after.teamStatuses).toEqual([]);
    expect(after.board.cells.some((o) => o.locked)).toBe(false);
  });

  it('技能等級降低冷卻，最低到 min', () => {
    const skill = { id: 'x', name: '', description: '', effects: [], cooldown: { max: 12, min: 7 } };
    expect([1, 3, 6, 10].map((lv) => cooldownAtLevel(skill, lv))).toEqual([12, 10, 7, 7]);
    const { battle } = setup({ skillLevel: 3 });
    expect(battle.getState().team[0].skillMaxCooldown).toBe(3);
  });

  it('冷卻中、沒有主動技時不能施放', () => {
    const { battle } = setup();
    const r = battle.useSkill(0);
    expect(r.ok).toBe(false);
    expect(battle.useSkill(5).ok).toBe(false);
  });
});

describe('敵人技能與異常狀態', () => {
  const withAbility = (ability: EnemyAbility, extra: Setup = {}) => setup({ abilities: [ability], ...extra });

  it('15 種異常狀態都有名稱與作用對象', () => {
    expect(Object.keys(STATUS_INFO).sort()).toEqual([...STATUS_IDS].sort());
  });

  it('poison：每回合扣最大生命 %', () => {
    const { battle } = withAbility({ status: 'poison', trigger: 'onStart', value: 10, turns: 2 }, { enemy: { cd: 99 } });
    const ticks: number[] = [];
    battle.events.on('poisonTick', ({ damage }) => ticks.push(damage));
    [1, 2, 3].forEach(() => battle.submitMove(NO_MATCH));
    expect(ticks).toEqual([1000, 1000]);
  });

  it('skillSeal：封印期間不能施放主動技', () => {
    const { battle } = withAbility({ status: 'skillSeal', trigger: 'onStart', turns: 1 }, { leader: charged, enemy: { cd: 99 } });
    const r = battle.useSkill(0);
    expect(!r.ok && r.reason).toBe('主動技被封印');
    battle.submitMove(NO_MATCH);
    expect(battle.useSkill(0).ok).toBe(true);
  });

  it('orbLock：隨機 value 顆珠不能移動，到期解鎖', () => {
    const { battle } = withAbility({ status: 'orbLock', trigger: 'onStart', value: 4, turns: 1 }, { enemy: { cd: 99 } });
    const locked = (s: BattleState) => s.board.cells.filter((o) => o.locked).length;
    expect(locked(battle.getState())).toBe(4);
    battle.submitMove(NO_MATCH);
    expect(locked(battle.getState())).toBe(0);
  });

  it('lockedOrbs：指定珠種不能消除', () => {
    const run = (sealed: boolean) => {
      const { battle } = setup({
        effects: [{ type: 'convertOrbs', from: 'all', to: 'fire' }],
        leader: charged,
        abilities: sealed ? [{ status: 'lockedOrbs', trigger: 'onStart', turns: 2, params: { orb: 'fire' } }] : [],
        enemy: { cd: 99 },
      });
      battle.useSkill(0);
      const r = battle.submitMove(NO_MATCH);
      return r.ok ? r.summary.combo : -1;
    };
    expect(run(false)).toBeGreaterThan(0);
    expect(run(true)).toBe(0);
  });

  it('moveTimeDown：縮短轉珠時間', () => {
    const { battle } = withAbility({ status: 'moveTimeDown', trigger: 'onStart', value: 2, turns: 1 }, { enemy: { cd: 99 } });
    expect(battle.getState().moveTimeSeconds).toBe(3);
    battle.submitMove(NO_MATCH);
    expect(battle.getState().moveTimeSeconds).toBe(5);
  });

  it('heartSeal：心珠不回復', () => {
    const run = (sealed: boolean) => {
      const { battle } = setup({
        effects: [{ type: 'selfDamage', percentCurrentHp: 50 }, { type: 'convertOrbs', from: 'all', to: 'heart' }],
        leader: charged,
        abilities: sealed ? [{ status: 'heartSeal', trigger: 'onStart', turns: 3 }] : [],
        enemy: { cd: 99 },
      });
      battle.useSkill(0);
      const r = battle.submitMove(NO_MATCH);
      return r.ok ? r.summary.heal : -1;
    };
    expect(run(false)).toBeGreaterThan(0);
    expect(run(true)).toBe(0);
  });

  it('darkOrbs／poisonOrbs：盤面出現干擾珠，暗珠到期恢復顯示', () => {
    const { battle } = setup({
      enemy: { cd: 99 },
      abilities: [
        { status: 'darkOrbs', trigger: 'onStart', value: 4, turns: 1 },
        { status: 'poisonOrbs', trigger: 'onStart', value: 3 },
      ],
    });
    const cells = battle.getState().board.cells;
    expect(cells.filter((o) => o.hidden)).toHaveLength(4);
    expect(cells.filter((o) => o.poison)).toHaveLength(3);
    battle.submitMove(NO_MATCH);
    expect(battle.getState().board.cells.filter((o) => o.hidden)).toHaveLength(0);
    expect(battle.getState().board.cells.filter((o) => o.poison)).toHaveLength(3);
  });

  it('shield 不填 value 為完全免疫，固定傷害要 ignoreShield 才能穿透', () => {
    const { battle } = setup({
      effects: [
        { type: 'damage', target: 'single', mode: 'fixed', value: 1000 },
        { type: 'damage', target: 'single', mode: 'fixed', value: 1000, ignoreShield: true },
      ],
      leader: charged,
      abilities: [{ status: 'shield', trigger: 'onStart' }],
    });
    const r = battle.useSkill(0);
    expect(r.ok && r.skill.hits.map((h) => h.damage)).toEqual([0, 1000]);
  });

  it('attributeShield rotate：每回合輪換屬性', () => {
    const { battle } = withAbility({ status: 'attributeShield', trigger: 'onStart', value: 80, params: { attribute: 'rotate' } }, { enemy: { cd: 99 } });
    const shielded = () => defenseProfile(battle.getState().enemies[0]).attributeShield?.attributes;
    expect(shielded()).toEqual(['fire']);
    battle.submitMove(NO_MATCH);
    expect(shielded()).toEqual(['water']);
  });

  it('shield／attributeShield／comboShield／damageAbsorb：組成敵人防禦', () => {
    const { battle } = setup({
      abilities: [
        { status: 'shield', trigger: 'onStart', value: 50 },
        { status: 'attributeShield', trigger: 'onStart', value: 80, params: { attribute: 'fire,dark' } },
        { status: 'comboShield', trigger: 'onStart', value: 5 },
        { status: 'damageAbsorb', trigger: 'onStart', value: 100000 },
      ],
    });
    expect(defenseProfile(battle.getState().enemies[0])).toEqual({
      attribute: 'light',
      def: 0,
      shieldPercent: 50,
      attributeShield: { attributes: ['fire', 'dark'], percent: 80 },
      comboShield: 5,
      damageAbsorb: 100000,
    });
  });

  it('護盾有回合數時會到期', () => {
    const { battle } = withAbility({ status: 'shield', trigger: 'onStart', value: 50, turns: 1 }, { enemy: { cd: 99 } });
    const expired: string[] = [];
    battle.events.on('statusExpired', ({ status }) => expired.push(status.id));
    battle.submitMove(NO_MATCH);
    expect(expired).toEqual(['shield']);
    expect(battle.getState().enemies[0].statuses).toEqual([]);
  });

  it('enrage 與 multiHit：攻擊倍率；連擊總傷不變、拆成多段', () => {
    const { battle } = setup({
      abilities: [
        { status: 'enrage', trigger: 'onStart', value: 2 },
        { status: 'multiHit', trigger: 'onStart', value: 3 },
      ],
    });
    const r = battle.submitMove(NO_MATCH);
    expect(r.ok && r.enemyAttacks[0]).toMatchObject({ damage: 666 * 3, hits: 3 });
  });

  it('multiHit：瀕死保命只擋一段', () => {
    const { battle } = cast([{ type: 'surviveOnce', turns: 1 }], {
      enemy: { atk: 2_000_000 },
      abilities: [{ status: 'multiHit', trigger: 'onStart', value: 2 }],
    });
    battle.submitMove(NO_MATCH);
    expect(battle.getState().phase).toBe('lost');
  });

  it('hpBelow：生命低於門檻觸發一次', () => {
    const { battle } = setup({
      effects: [{ type: 'damage', target: 'single', mode: 'fixed', value: 600_000 }],
      leader: charged,
      abilities: [{ status: 'enrage', trigger: 'hpBelow', value: 3, params: { percent: 50 } }],
    });
    const applied: string[] = [];
    battle.events.on('statusApplied', ({ status }) => applied.push(status.id));
    battle.useSkill(0);
    expect(applied).toEqual(['enrage']);
    const r = battle.submitMove(NO_MATCH);
    expect(r.ok && r.enemyAttacks[0].damage).toBe(3000);
  });

  it('onAttack 與 everyNTurns', () => {
    const { battle } = setup({
      enemy: { cd: 2 },
      abilities: [
        { status: 'poison', trigger: 'onAttack', value: 1, turns: 1 },
        { status: 'darkOrbs', trigger: 'everyNTurns', value: 1, params: { n: 3 } },
      ],
    });
    const applied: string[] = [];
    battle.events.on('statusApplied', ({ status }) => applied.push(status.id));
    [1, 2, 3].forEach(() => battle.submitMove(NO_MATCH));
    expect(applied).toEqual(['poison', 'darkOrbs']);
  });

  it('星紋覺醒 resistStatus：100% 抵抗', () => {
    const { battle } = setup({
      awakenings: [{ type: 'resistStatus', status: 'skillSeal', percent: 100 }],
      abilities: [{ status: 'skillSeal', trigger: 'onStart', turns: 5 }],
    });
    expect(battle.getState().teamStatuses).toEqual([]);
  });

  it('續戰會解除我方異常狀態', () => {
    const { battle } = setup({
      enemy: { atk: 999_999 },
      abilities: [{ status: 'skillSeal', trigger: 'onStart', turns: 9 }],
    });
    battle.submitMove(NO_MATCH);
    expect(battle.getState().phase).toBe('lost');
    battle.continueBattle();
    expect(battle.getState().teamStatuses).toEqual([]);
  });
});

describe('隊長技 allyCooldownPerTurn', () => {
  it('每回合技能冷卻額外減少', () => {
    const { battle } = setup({
      leader: [{ conditions: [{ type: 'always' }], effects: [{ type: 'allyCooldownPerTurn', turns: 1 }] }],
      enemy: { cd: 99 },
    });
    expect(battle.getState().team.map((m) => m.skillCooldown)).toEqual([5, 4]);
    battle.submitMove(NO_MATCH);
    expect(battle.getState().team.map((m) => m.skillCooldown)).toEqual([3, 2]);
  });
});

describe('星紋封印 attributeSeal（#59）', () => {
  /** 把整個盤面轉成焰珠，下一次送出就全部消除，只有焰屬性的隊長會打出傷害 */
  const fireTurn = (abilities: EnemyAbility[]) => {
    const s = cast([{ type: 'convertOrbs', from: 'all', to: 'fire' }], { abilities, enemy: { cd: 99 } });
    const r = s.battle.submitMove(NO_MATCH);
    if (!r.ok) throw new Error(r.reason);
    return { ...s, dealt: r.summary.hits.reduce((n, h) => n + h.damage, 0) };
  };

  it('封印焰屬性：焰隊員的轉珠攻擊無效；封印別的屬性不受影響', () => {
    expect(fireTurn([]).dealt).toBeGreaterThan(0);
    expect(fireTurn([{ status: 'attributeSeal', trigger: 'onStart', turns: 2, params: { attribute: 'fire' } }]).dealt).toBe(0);
    expect(fireTurn([{ status: 'attributeSeal', trigger: 'onStart', turns: 2, params: { attribute: 'water,wood' } }]).dealt).toBeGreaterThan(0);
  });

  it('leader：封印我方隊長的屬性', () => {
    const { battle, dealt } = fireTurn([{ status: 'attributeSeal', trigger: 'onStart', turns: 2, params: { attribute: 'leader' } }]);
    expect(dealt).toBe(0);
    expect(battle.getState().teamStatuses.map((s) => s.id)).toContain('attributeSeal');
  });

  it('回合到期後解除；星紋覺醒 resistStatus 可以抵抗', () => {
    const { battle } = fireTurn([{ status: 'attributeSeal', trigger: 'onStart', turns: 1, params: { attribute: 'fire' } }]);
    expect(battle.getState().teamStatuses.map((s) => s.id)).not.toContain('attributeSeal');
    const immune = cast([{ type: 'convertOrbs', from: 'all', to: 'fire' }], {
      abilities: [{ status: 'attributeSeal', trigger: 'onStart', turns: 3, params: { attribute: 'fire' } }],
      awakenings: [{ type: 'resistStatus', status: 'attributeSeal', percent: 100 }],
      enemy: { cd: 99 },
    });
    expect(immune.battle.getState().teamStatuses.map((s) => s.id)).not.toContain('attributeSeal');
  });
});
