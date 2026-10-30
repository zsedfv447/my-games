import { describe, expect, it } from 'vitest';
import gameConfig from '../data/config.json';
import { startBattle, type BattleData } from '../src/battle/battle-state';
import {
  effectiveMultiplier, effectiveMultipliers, effectiveWeakTo, liveReductions, plannedReductions, reducedWeaknesses, type AttributeReduction,
} from '../src/battle/feedback';
import { createRng } from '../src/core/rng';
import type { CardDef, EnemyAbility, EnemyDef, GameConfig, StageDef } from '../src/core/types';
import { gameData } from '../src/data/load';
import { stageIntel } from '../src/ui/stage-intel';

const config = (gameConfig as GameConfig).battle;
const waterHalf: AttributeReduction = { attributes: ['water'], percent: 50, kind: 'attributeShield' };

describe('有效倍率 = 剋制 × (1 − 減傷)', () => {
  it('只算涵蓋該屬性的減傷，多個減傷相乘', () => {
    expect(effectiveMultiplier('water', 'fire', [], config)).toBe(1.5);
    expect(effectiveMultiplier('water', 'fire', [waterHalf], config)).toBe(0.75);
    expect(effectiveMultiplier('wood', 'fire', [waterHalf], config)).toBe(0.5);
    expect(effectiveMultiplier('water', 'fire', [waterHalf, { attributes: 'all', percent: 50, kind: 'shield' }], config)).toBe(0.375);
    expect(effectiveMultiplier('water', 'fire', [{ attributes: 'all', percent: 100, kind: 'shield' }], config)).toBe(0);
    expect(effectiveMultipliers('fire', [waterHalf], config)).toEqual({ fire: 1, water: 0.75, wood: 0.5, light: 1, dark: 1 });
  });

  it('剋制但被減到 1 倍以下就不算弱點', () => {
    expect(effectiveWeakTo('fire', [], config)).toEqual(['water']);
    expect(effectiveWeakTo('fire', [waterHalf], config)).toEqual([]);
    expect(reducedWeaknesses('fire', [waterHalf], config)).toEqual(['water']);
    // 減傷 20% 時 1.5 × 0.8 = 1.2 > 1，仍算弱點
    expect(effectiveWeakTo('fire', [{ ...waterHalf, percent: 20 }], config)).toEqual(['water']);
    // 剛好 1 倍不算
    expect(effectiveWeakTo('fire', [{ ...waterHalf, percent: 100 / 3 }], config)).toEqual([]);
  });
});

describe('減傷來源', () => {
  it('出戰前：只算開場就有、一直持續的減傷；暫時護盾不算；輪替平均分給五屬', () => {
    const abilities: EnemyAbility[] = [
      { status: 'shield', trigger: 'onStart', turns: 1 },
      { status: 'attributeShield', trigger: 'onStart', value: 50, turns: 0, params: { attribute: 'water,wood' } },
      { status: 'attributeShield', trigger: 'hpBelow', value: 90, params: { attribute: 'fire' } },
    ];
    expect(plannedReductions({ abilities })).toEqual([{ attributes: ['water', 'wood'], percent: 50, kind: 'attributeShield' }]);
    expect(plannedReductions({ abilities: [{ status: 'attributeShield', trigger: 'onStart', value: 90, params: { attribute: 'rotate' } }] }))
      .toEqual([{ attributes: 'all', percent: 18, kind: 'rotate' }]);
    expect(plannedReductions({ abilities: [{ status: 'shield', trigger: 'onStart' }] })).toEqual([{ attributes: 'all', percent: 100, kind: 'shield' }]);
  });

  it('戰鬥中：目前的護盾與屬性減傷；輪替取這一回合輪到的屬性', () => {
    expect(liveReductions({ turnsOnField: 0, statuses: [{ id: 'shield', turns: 1 }] })).toEqual([{ attributes: 'all', percent: 100, kind: 'shield' }]);
    expect(liveReductions({ turnsOnField: 1, statuses: [{ id: 'attributeShield', turns: null, value: 80, params: { attribute: 'rotate' } }] }))
      .toEqual([{ attributes: ['water'], percent: 80, kind: 'rotate' }]);
    expect(liveReductions({ turnsOnField: 0, statuses: [{ id: 'enrage', turns: null, value: 2 }] })).toEqual([]);
  });

  it('戰鬥中：開場護盾期間沒有弱點，護盾到期後恢復', () => {
    const card = (id: string, attribute: CardDef['attribute']): CardDef => ({
      id, name: id, attribute, race: 'human', rarity: 4, maxLevel: 1, stats: { hp: [5000, 5000], atk: [1, 1], rcv: [1, 1] },
      growthCurve: 1, cost: 5, expValue: 0, sellValue: 0, archetypes: [], art: {}, flavor: '',
    });
    const enemy: EnemyDef = { id: 'e', name: '狼', attribute: 'fire', hp: 1e9, atk: 1, def: 0, cd: 99, abilities: [{ status: 'shield', trigger: 'onStart', turns: 1 }], art: {} };
    const data: BattleData = { config: gameConfig as GameConfig, cards: [card('a', 'water')], skills: [], leaderSkills: [], enemies: [enemy] };
    const stage: StageDef = { id: 's', kind: 'main', name: 's', stamina: 0, unlockAfter: null, waves: [{ enemies: ['e'] }], rewards: { coin: 0, playerExp: 0 }, drops: [] };
    const battle = startBattle(stage, [{ cardId: 'a', level: 1 }], null, createRng(1), data);
    const weak = () => { const e = battle.getState().enemies[0]; return effectiveWeakTo(e.def.attribute, liveReductions(e), config); };
    expect(weak()).toEqual([]);
    battle.submitMove([]);
    expect(weak()).toEqual(['water']);
  });
});

describe('出戰確認的建議屬性', () => {
  it('1-9：Boss 開場對潮減傷 50%，潮不再因 Boss 加分，並附上說明', () => {
    const st = gameData.stages.find((s) => s.id === 'st-1-9')!;
    const intel = stageIntel(st, gameData.enemies, config);
    expect(intel.notes).toEqual(['Boss 開場對潮減傷 50%']);
    // 沒扣減傷時潮會因為 Boss（加倍）穩居第一
    const raw = stageIntel({ waves: st.waves }, gameData.enemies.map((e) => ({ ...e, abilities: [] })), config);
    expect(raw.suggested[0]).toBe('water');
    expect(raw.notes).toEqual([]);
  });

  it('剋制被減到 1 倍以下的屬性不計分', () => {
    const enemies: EnemyDef[] = [
      { id: 'b', name: '炎王', attribute: 'fire', hp: 1, atk: 1, def: 0, cd: 1, art: {}, abilities: [{ status: 'attributeShield', trigger: 'onStart', value: 50, turns: 0, params: { attribute: 'water' } }] },
      { id: 'g', name: '森兵', attribute: 'wood', hp: 1, atk: 1, def: 0, cd: 1, art: {}, abilities: [] },
    ];
    const intel = stageIntel({ waves: [{ enemies: ['g'] }, { enemies: ['b'], boss: true }] }, enemies, config);
    expect(intel.suggested).toEqual(['fire']);
    expect(intel.notes).toEqual(['Boss 開場對潮減傷 50%']);
  });
});
