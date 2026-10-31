import { describe, expect, it } from 'vitest';
import gameConfig from '../data/config.json';
import { applyHits, type EnemyTarget, type Hit } from '../src/battle/damage';
import { resumeBattle, startBattle, type BattleData, type BattleSnapshot } from '../src/battle/battle-state';
import { breakRingSlots, ringDefense, ringOf } from '../src/battle/skills/ring';
import { defenseProfile } from '../src/battle/skills/status';
import type { EnemyState, StatusInstance } from '../src/battle/runtime';
import { createRng } from '../src/core/rng';
import type { CardDef, EnemyAbility, EnemyDef, GameConfig, StageDef } from '../src/core/types';
import { gameData } from '../src/data/load';
import { statusChip } from '../src/ui/status-labels';

const config = (gameConfig as GameConfig).battle;
const ringStatus = (params: Record<string, string | number> = {}, value?: number): StatusInstance => ({ id: 'ringShield', turns: null, value, params });
const holder = (s: StatusInstance) => ({ statuses: [s] });

describe('七曜環：格子', () => {
  it('預設六格（五屬＋心）、減傷 75%、碎裂後易傷 ×2', () => {
    expect(ringOf(holder(ringStatus()))).toEqual({
      slots: ['fire', 'water', 'wood', 'light', 'dark', 'heart'], broken: [], reduction: 75, vulnerable: 2, shattered: false,
    });
    expect(ringOf({ statuses: [] })).toBeNull();
  });

  it('屬性攻擊點掉對應格子，心格要消除心珠；碎裂後不再變動', () => {
    const e = holder(ringStatus({ slots: 'fire,water,heart' }));
    expect(breakRingSlots(e, ['fire', 'light'], false)).toEqual({ broken: ['fire'], shattered: false });
    expect(breakRingSlots(e, ['fire'], false)).toEqual({ broken: [], shattered: false });
    expect(breakRingSlots(e, ['water'], true)).toEqual({ broken: ['water', 'heart'], shattered: true });
    expect(ringOf(e)!.shattered).toBe(true);
    expect(breakRingSlots(e, ['fire'], true)).toEqual({ broken: [], shattered: false });
  });

  it('不會改到敵人資料本身的 params', () => {
    const params = { slots: 'fire,water' };
    const e = holder({ id: 'ringShield', turns: null, params });
    breakRingSlots(e, ['fire'], false);
    expect(params).toEqual({ slots: 'fire,water' });
    expect(e.statuses[0].params?.broken).toBe('fire');
  });
});

describe('七曜環：傷害', () => {
  const base: EnemyTarget = { attribute: 'light', def: 0, hp: 1e9, maxHp: 1e9 };
  const atk = (extra: Partial<Hit> = {}): Hit => ({ member: 0, attribute: 'fire', target: 'single', amount: 10000, ...extra });
  const dealt = (hit: Hit, e: EnemyTarget) => applyHits([hit], [e], 0, { combo: 1, config }).results[0].damage;

  it('環還在：所有傷害減少 75%（含固定與百分比），ignoreShield 可穿透', () => {
    const ring = { ...base, ...ringDefense(holder(ringStatus())) };
    expect(dealt(atk(), ring)).toBe(2500);
    expect(dealt(atk({ fixed: true, attribute: undefined }), ring)).toBe(2500);
    expect(dealt({ member: -1, target: 'single', amount: 0, fixed: true, percentMaxHp: 1, cap: 1e9 }, { ...ring, hp: 1_000_000, maxHp: 1_000_000 })).toBe(2500);
    expect(dealt(atk({ ignoreShield: true }), ring)).toBe(10000);
  });

  it('碎裂後：屬性攻擊 ×2；固定與百分比傷害不吃易傷，百分比上限仍是硬上限', () => {
    const broken = { ...base, ...ringDefense(holder(ringStatus({ slots: 'fire', broken: 'fire' }))) };
    expect(dealt(atk(), broken)).toBe(20000);
    expect(dealt(atk({ fixed: true, attribute: undefined }), broken)).toBe(10000);
    expect(dealt({ member: -1, target: 'single', amount: 0, fixed: true, percentMaxHp: 3, cap: 60000 }, { ...broken, hp: 4e6, maxHp: 4e6 })).toBe(60000);
  });

  it('defenseProfile 依環的狀態帶出減傷或易傷', () => {
    const e = { def: { attribute: 'light', def: 0 }, statuses: [ringStatus()], turnsOnField: 0 } as unknown as EnemyState;
    expect(defenseProfile(e).ringReduction).toBe(75);
    e.statuses[0] = ringStatus({ slots: 'fire', broken: 'fire' });
    expect(defenseProfile(e)).toMatchObject({ vulnerable: 2 });
    expect(defenseProfile(e).ringReduction).toBeUndefined();
  });
});

// ---------- 實際戰鬥 ----------

const card = (id: string, attribute: CardDef['attribute'], extra: Partial<CardDef> = {}): CardDef => ({
  id, name: id, attribute, race: 'human', rarity: 4, maxLevel: 1, stats: { hp: [9000, 9000], atk: [1000, 1000], rcv: [300, 300] },
  growthCurve: 1, cost: 5, expValue: 0, sellValue: 0, archetypes: [], art: {}, flavor: '', ...extra,
});
const ring: EnemyAbility = { status: 'ringShield', trigger: 'onStart', value: 75, params: { slots: 'fire,water,heart', vulnerable: 2 } };
function setup(seed = 1) {
  const enemy: EnemyDef = { id: 'core', name: '環心', attribute: 'light', hp: 1e8, atk: 1, def: 0, cd: 99, abilities: [ring], art: {} };
  const skill = (id: string, attribute: CardDef['attribute']) => ({ id, name: id, cooldown: { max: 1, min: 1 }, effects: [{ type: 'damage' as const, target: 'single' as const, mode: 'multiplier' as const, value: 5, attribute }], description: '' });
  const data: BattleData = {
    config: gameConfig as GameConfig,
    cards: [card('f', 'fire', { activeSkill: 'sf', leaderSkill: 'charge' }), card('w', 'water', { activeSkill: 'sw' })],
    skills: [skill('sf', 'fire'), skill('sw', 'water')],
    leaderSkills: [{ id: 'charge', name: '充能', description: '', rules: [{ conditions: [{ type: 'always' }], effects: [{ type: 'skillCooldownStart', charged: true }] }] }],
    enemies: [enemy],
  };
  const stage: StageDef = { id: 's-ring', kind: 'main', name: '環心', stamina: 0, unlockAfter: null, waves: [{ enemies: ['core'], boss: true }], rewards: { coin: 0, playerExp: 0 }, drops: [] };
  return { battle: startBattle(stage, [{ cardId: 'f', level: 1 }, { cardId: 'w', level: 1 }], null, createRng(seed), data), data, stage };
}
const viaJson = (s: BattleSnapshot): BattleSnapshot => JSON.parse(JSON.stringify(s));

describe('七曜環：戰鬥中', () => {
  it('主動技的屬性攻擊點掉格子並發出 ringBroken；全部點掉後易傷', () => {
    const { battle } = setup();
    const log: unknown[] = [];
    battle.events.on('ringBroken', (e) => log.push(e));
    const first = battle.useSkill(0);
    if (!first.ok) throw new Error(first.reason);
    // 環還在：5000 × 25%
    expect(first.skill.hits[0].damage).toBe(1250);
    expect(ringOf(battle.getState().enemies[0])!.broken).toEqual(['fire']);
    battle.useSkill(1);
    expect(log).toEqual([{ enemy: 0, broken: ['fire'], shattered: false }, { enemy: 0, broken: ['water'], shattered: false }]);
    // 心格要消除心珠：用一個只剩心格的環來測整個回合
    const s = battle.getState().enemies[0];
    expect(ringOf(s)!.shattered).toBe(false);
  });

  it('消除心珠點掉心格；三格全部點掉後環碎裂', () => {
    for (let seed = 1; seed <= 40; seed++) {
      if (tryHeartTurn(seed)) return;
    }
    throw new Error('40 個種子都湊不出心珠消除');
  });

  const tryHeartTurn = (seed: number): boolean => {
    const { battle } = setup(seed);
    battle.useSkill(0);
    battle.useSkill(1);
    const board = battle.getState().board;
    // 找一條會消除心珠的相鄰交換
    let path: { row: number; col: number }[] = [];
    outer: for (let i = 0; i < board.cells.length; i++) {
      for (const d of [1, board.cols]) {
        const j = i + d;
        if (j >= board.cells.length || (d === 1 && j % board.cols === 0)) continue;
        const cells = board.cells.slice();
        [cells[i], cells[j]] = [cells[j], cells[i]];
        const hearts = (k: number) => cells[k].type === 'heart';
        const rows = board.rows; const cols = board.cols;
        const line = (k: number) => {
          const r = Math.floor(k / cols); const c = k % cols;
          const h3 = c + 2 < cols && hearts(k) && hearts(k + 1) && hearts(k + 2);
          const v3 = r + 2 < rows && hearts(k) && hearts(k + cols) && hearts(k + 2 * cols);
          return h3 || v3;
        };
        if (cells.some((_, k) => line(k))) { path = [{ row: Math.floor(i / board.cols), col: i % board.cols }, { row: Math.floor(j / board.cols), col: j % board.cols }]; break outer; }
      }
    }
    if (!path.length) return false;
    const r = battle.submitMove(path);
    if (!r.ok) throw new Error(r.reason);
    expect(r.summary.groups.some((g) => g.orb === 'heart')).toBe(true);
    expect(ringOf(battle.getState().enemies[0])!.shattered).toBe(true);
    return true;
  };

  it('固定傷害與百分比傷害不能破環', () => {
    const e = holder(ringStatus({ slots: 'fire' }));
    const results = applyHits([{ member: -1, target: 'single', amount: 500, fixed: true }], [{ attribute: 'light', def: 0, hp: 1e6, maxHp: 1e6, ...ringDefense(e) }], 0, { combo: 1, config }).results;
    expect(results[0].damage).toBeGreaterThan(0);
    // 戰鬥裡只把「有屬性、非固定、非百分比」的命中交給 breakRingSlots
    const attrs = results.filter((r) => r.hit.attribute && !r.hit.fixed && r.hit.percentMaxHp === undefined).map((r) => r.hit.attribute!);
    expect(breakRingSlots(e, attrs, false).broken).toEqual([]);
  });
});

describe('七曜環：中途續戰', () => {
  it('已點掉的格子存進快照、讀回後一樣，之後照常破環', () => {
    const { battle, data, stage } = setup(5);
    battle.useSkill(0);
    const resumed = resumeBattle(stage, viaJson(battle.snapshot()), data);
    expect(ringOf(resumed.getState().enemies[0])).toEqual(ringOf(battle.getState().enemies[0]));
    expect(ringOf(resumed.getState().enemies[0])!.broken).toEqual(['fire']);
    const r = resumed.useSkill(1);
    if (!r.ok) throw new Error(r.reason);
    expect(ringOf(resumed.getState().enemies[0])!.broken).toEqual(['fire', 'water']);
  });
});

describe('標籤與資料', () => {
  it('狀態標籤顯示剩幾格；碎裂後顯示易傷', () => {
    expect(statusChip(ringStatus({ slots: 'fire,water,heart', broken: 'fire' }), 'enemy').text).toBe('七曜環 2/3');
    expect(statusChip(ringStatus({ slots: 'fire', broken: 'fire' }), 'enemy').text).toBe('環碎・易傷×2');
  });
  it('七曜環只出現在第 7 章（提案 96 的環心）', () => {
    const ids = new Set(gameData.enemies.filter((e) => e.abilities.some((a) => a.status === 'ringShield')).map((e) => e.id));
    for (const st of gameData.stages) for (const w of st.waves) for (const e of w.enemies) if (ids.has(e)) expect(st.chapter, st.id).toBe(7);
  });
});
