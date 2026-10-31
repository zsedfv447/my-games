import { describe, expect, it } from 'vitest';
import gameConfig from '../data/config.json';
import { resumeBattle, startBattle, type BattleData, type BattleSnapshot } from '../src/battle/battle-state';
import { isMemberSealed } from '../src/battle/skills/status';
import { createRng } from '../src/core/rng';
import type { CardDef, EnemyDef, GameConfig, SaveData, StageDef } from '../src/core/types';
import { gameData } from '../src/data/load';
import {
  MAX_OATHS, OATHS, WEEKLY_GEM_CAP, applyOathTeam, oathCoreCard, oathEligible, oathModifiers, oathPoints, oathRewardFor,
  oathSelectionProblem, oathTeamProblem, oathsOf, settleOath, type OathId,
} from '../src/progression/oaths';
import { createNewSave } from '../src/save/save';

const MON = new Date(2026, 10, 2, 12).getTime();
const NEXT_WEEK = new Date(2026, 10, 9, 12).getTime();

const card = (id: string, attribute: CardDef['attribute'], extra: Partial<CardDef> = {}): CardDef => ({
  id, name: id, attribute, race: 'human', rarity: 4, maxLevel: 1, stats: { hp: [5000, 5000], atk: [1000, 1000], rcv: [500, 500] },
  growthCurve: 1, cost: 5, expValue: 0, sellValue: 0, archetypes: [], art: {}, flavor: '', ...extra,
});
const enemy = (id: string, extra: Partial<EnemyDef> = {}): EnemyDef => ({ id, name: id, attribute: 'light', hp: 1e8, atk: 1000, def: 0, cd: 1, abilities: [], art: {}, ...extra });
const data: BattleData = {
  config: gameConfig as GameConfig,
  cards: [card('a', 'fire', { activeSkill: 's', leaderSkill: 'charge' }), card('b', 'water')],
  skills: [{ id: 's', name: '技', cooldown: { max: 1, min: 1 }, effects: [{ type: 'damage', target: 'single', mode: 'fixed', value: 100 }], description: '' }],
  leaderSkills: [{ id: 'charge', name: '充能', description: '', rules: [{ conditions: [{ type: 'always' }], effects: [{ type: 'skillCooldownStart', charged: true }] }] }],
  enemies: [enemy('e1'), enemy('e2', { hp: 1 })],
};
const stage: StageDef = {
  id: 's-oath', kind: 'main', name: '誓約', stamina: 0, unlockAfter: null,
  waves: [{ enemies: ['e2'] }, { enemies: ['e1'] }], rewards: { coin: 0, playerExp: 0 }, drops: [],
};
const fight = (ids: OathId[], seed = 1) => startBattle(stage, [{ cardId: 'a', level: 1 }, { cardId: 'b', level: 1 }], null, createRng(seed), data, undefined, oathModifiers(ids));
const viaJson = (s: BattleSnapshot): BattleSnapshot => JSON.parse(JSON.stringify(s));

describe('誓約清單與選擇', () => {
  it('至少 8 條，id 不重複，都有點數與說明', () => {
    expect(OATHS.length).toBeGreaterThanOrEqual(8);
    expect(new Set(OATHS.map((o) => o.id)).size).toBe(OATHS.length);
    for (const o of OATHS) {
      expect(o.points).toBeGreaterThan(0);
      expect(o.description.length).toBeGreaterThan(4);
    }
  });
  it('選 1～3 條、不重複、都要存在', () => {
    expect(MAX_OATHS).toBe(3);
    expect(oathSelectionProblem([])).toBe('至少選 1 條誓約');
    expect(oathSelectionProblem(['noSkill', 'shortMove', 'noHearts', 'enemyRage'])).toBe('最多選 3 條誓約');
    expect(oathSelectionProblem(['noSkill', 'noSkill'])).toBe('誓約不能重複');
    expect(oathSelectionProblem(['nope'])).toBe('有不存在的誓約');
    expect(oathSelectionProblem(['noSkill', 'comboWall'])).toBeNull();
    expect(oathPoints(['noSkill', 'comboWall'])).toBe(5);
  });
  it('只有已通關的主線關卡可以刻誓約', () => {
    const save = { progress: { clearedStages: ['st-1-1'] } } as Pick<SaveData, 'progress'>;
    expect(oathEligible({ id: 'st-1-1', kind: 'main' }, save)).toBe(true);
    expect(oathEligible({ id: 'st-1-2', kind: 'main' }, save)).toBe(false);
    for (const kind of ['abyss', 'event', 'daily', 'tower', 'side', 'trial'] as const) expect(oathEligible({ id: 'st-1-1', kind }, save)).toBe(false);
  });
});

describe('每條誓約在戰鬥中真的生效（強制，不可能違反）', () => {
  it('靜默之誓：主動技被封印', () => {
    expect(fight([]).useSkill(0).ok).toBe(true);
    expect(fight(['noSkill']).useSkill(0)).toEqual({ ok: false, reason: '主動技被封印' });
  });
  it('疾手之誓：轉珠時間少 2 秒', () => {
    expect(fight(['shortMove']).getState().moveTimeSeconds).toBe(fight([]).getState().moveTimeSeconds - 2);
  });
  it('無癒之誓：心珠封印，轉珠回復為 0', () => {
    const b = fight(['noHearts']);
    expect(b.getState().teamStatuses.map((s) => s.id)).toContain('heartSeal');
    const r = b.submitMove([]);
    expect(r.ok && r.summary.heal).toBe(0);
  });
  it('縛星之誓：開場 3 回合隊長被星紋封印，之後解除', () => {
    const b = fight(['sealLeader']);
    expect(isMemberSealed(b.getState(), 0)).toBe(true);
    for (let i = 0; i < 3; i++) b.submitMove([]);
    expect(isMemberSealed(b.getState(), 0)).toBe(false);
  });
  it('怒潮之誓：敵人攻擊 ×1.5', () => {
    const hit = (ids: OathId[]) => { const b = fight(ids); b.submitMove([]); const r = b.submitMove([]); return r.ok ? r.enemyAttacks[0]?.damage : -1; };
    expect(hit(['enemyRage'])).toBe(Math.floor(hit([])! * 1.5));
  });
  it('連星之誓：每一波敵人都帶 Combo 盾 4', () => {
    const b = fight(['comboWall']);
    expect(b.getState().enemies[0].statuses).toContainEqual({ id: 'comboShield', turns: null, value: 4 });
    b.useSkill(0); // 固定傷害打倒第一波
    expect(b.getState().wave).toBe(1);
    expect(b.getState().enemies[0].statuses).toContainEqual({ id: 'comboShield', turns: null, value: 4 });
  });
  it('孤行之誓、少數之誓：出戰隊伍不帶助戰、只帶前 4 人', () => {
    const team = { members: [1, 2, 3, 4, 5], helper: 6 };
    expect(applyOathTeam(team, ['noHelper'])).toEqual({ members: [1, 2, 3, 4, 5], helper: null });
    expect(applyOathTeam(team, ['fourMembers'])).toEqual({ members: [1, 2, 3, 4], helper: 6 });
    expect(applyOathTeam(team, [])).toEqual(team);
  });
  it('一色之誓：隊員與助戰都要和隊長同屬性才能出發', () => {
    const fire = { attribute: 'fire' as const };
    const water = { attribute: 'water' as const };
    expect(oathTeamProblem(['monoAttribute'], [fire, fire], fire)).toBeNull();
    expect(oathTeamProblem(['monoAttribute'], [fire, water], null)).toBe('一色之誓：隊員與助戰都要和隊長同屬性');
    expect(oathTeamProblem(['monoAttribute'], [fire], water)).not.toBeNull();
    // 同時刻了孤行之誓就不看助戰
    expect(oathTeamProblem(['monoAttribute', 'noHelper'], [fire], water)).toBeNull();
    expect(oathTeamProblem([], [fire, water], null)).toBeNull();
  });
  it('續戰後誓約的限制照樣保留', () => {
    const b = startBattle(stage, [{ cardId: 'a', level: 1 }], null, createRng(1), { ...data, enemies: [enemy('e1', { atk: 1e9 }), enemy('e2', { hp: 1, atk: 1e9 })] }, undefined, oathModifiers(['noSkill']));
    b.submitMove([]);
    expect(b.getState().phase).toBe('lost');
    b.continueBattle();
    expect(b.getState().teamStatuses.map((s) => s.id)).toEqual(['skillSeal']);
    expect(b.getState().continues).toBe(1);
  });
});

describe('中途續戰還原誓約', () => {
  it('快照帶著誓約：讀回後限制還在，之後的新一波敵人也照樣加上', () => {
    const b = fight(['noSkill', 'comboWall']);
    const snap = viaJson(b.snapshot());
    expect(snap.modifiers?.oaths).toEqual(['noSkill', 'comboWall']);
    const r = resumeBattle(stage, snap, data);
    expect(r.useSkill(0)).toEqual({ ok: false, reason: '主動技被封印' });
    expect(r.getState().enemies[0].statuses).toContainEqual({ id: 'comboShield', turns: null, value: 4 });
  });
  it('沒有誓約的快照不帶 modifiers，舊快照照樣能讀', () => {
    const snap = viaJson(fight([]).snapshot());
    expect('modifiers' in snap).toBe(false);
    expect(resumeBattle(stage, snap, data).useSkill(0).ok).toBe(true);
  });
});

describe('誓約獎勵', () => {
  const base = () => createNewSave(gameData.config, MON);
  const won = { won: true, continues: 0 };

  it('點數越高獎勵越多；星晶 5 點 1 顆、7 點 2 顆；每 3 點 1 個星核', () => {
    expect(oathRewardFor(2)).toEqual({ coin: 800, cores: 0, gems: 0 });
    expect(oathRewardFor(5)).toEqual({ coin: 2000, cores: 1, gems: 1 });
    expect(oathRewardFor(7)).toEqual({ coin: 2800, cores: 2, gems: 2 });
  });

  it('通關給獎勵；同週同關要更高點數才補差額；換週重置', () => {
    const first = settleOath(base(), { id: 'st-1-1' }, ['noSkill', 'comboWall'], won, 'c916', MON);
    if (!first.ok) throw new Error(first.reason);
    expect(first.reward).toEqual({ coin: 2000, gems: 1, cards: [{ card: 'c916', count: 1 }] });
    expect(first.newHighest).toBe(true);
    const same = settleOath(first.save, { id: 'st-1-1' }, ['noSkill', 'comboWall'], won, 'c916', MON);
    expect(same).toMatchObject({ ok: false, reason: 'notBetter' });
    const higher = settleOath(first.save, { id: 'st-1-1' }, ['noSkill', 'comboWall', 'enemyRage'], won, 'c916', MON);
    if (!higher.ok) throw new Error(higher.reason);
    expect(higher.reward).toEqual({ coin: 800, gems: 1, cards: [{ card: 'c916', count: 1 }] });
    // 別關另算
    expect(settleOath(higher.save, { id: 'st-1-2' }, ['noSkill'], won, 'c916', MON).ok).toBe(true);
    // 下週同一關又可以拿；歷來最高保留
    const next = settleOath(higher.save, { id: 'st-1-1' }, ['noSkill', 'comboWall'], won, 'c916', NEXT_WEEK);
    expect(next.ok).toBe(true);
    expect(oathsOf(next.save, NEXT_WEEK).highest).toBe(7);
  });

  it('續戰＝誓約破除，不給獎勵；沒贏或沒刻誓約也不給', () => {
    expect(settleOath(base(), { id: 'st-1-1' }, ['noSkill'], { won: true, continues: 1 }, null, MON)).toMatchObject({ ok: false, reason: 'broken' });
    expect(settleOath(base(), { id: 'st-1-1' }, ['noSkill'], { won: false, continues: 0 }, null, MON)).toMatchObject({ ok: false, reason: 'notWon' });
    expect(settleOath(base(), { id: 'st-1-1' }, [], won, null, MON)).toMatchObject({ ok: false, reason: 'noOaths' });
  });

  it('每週星晶最多 10 顆；不給星輝結晶', () => {
    let s = base();
    let gems = 0;
    for (let i = 0; i < 12; i++) {
      const r = settleOath(s, { id: `st-x-${i}` }, ['noSkill', 'comboWall', 'enemyRage'], won, 'c916', MON);
      if (!r.ok) throw new Error(r.reason);
      gems += r.reward.gems ?? 0;
      expect(JSON.stringify(r.reward)).not.toContain('c921');
      s = r.save;
    }
    expect(gems).toBe(WEEKLY_GEM_CAP);
    expect(oathsOf(s, MON).gems).toBe(WEEKLY_GEM_CAP);
  });

  it('星核依關卡 Boss 的屬性', () => {
    const st = gameData.stages.find((x) => x.id === 'st-1-9')!;
    const id = oathCoreCard(st, gameData.enemies, gameData.cards)!;
    const boss = gameData.enemies.find((e) => e.id === st.waves.at(-1)!.enemies[0])!;
    const core = gameData.cards.find((c) => c.id === id)!;
    expect(core.name.endsWith('星核')).toBe(true);
    expect(core.attribute).toBe(boss.attribute);
  });

  it('舊存檔沒有誓約紀錄時補預設值', () => {
    expect(oathsOf(base(), MON)).toEqual({ week: expect.any(String), best: {}, gems: 0, highest: 0 });
  });
});
