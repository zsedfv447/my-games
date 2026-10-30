import { describe, expect, it } from 'vitest';
import gameConfig from '../data/config.json';
import { applyHits, percentHitAmount, type EnemyTarget, type Hit } from '../src/battle/damage';
import { checkLeaderEvolution, checkLeaderTier, evaluateLeaderTurn, leaderSkillProfile, lintLeaderSkill, LEADER_TIERS } from '../src/battle/leader';
import { startBattle, type BattleData } from '../src/battle/battle-state';
import { createRng } from '../src/core/rng';
import type { CardDef, EnemyDef, GameConfig, LeaderSkillDef, StageDef } from '../src/core/types';
import { gameData } from '../src/data/load';
import { validateGameData } from '../src/data/validate';

const config = (gameConfig as GameConfig).battle;
const ctx = { combo: 1, config };
/** 3% 最大生命、每次最多 60,000 點的追打 */
const pct = (extra: Partial<Hit> = {}): Hit => ({ member: -1, target: 'single', amount: 60000, fixed: true, percentMaxHp: 3, cap: 60000, ...extra });
const enemy = (extra: Partial<EnemyTarget> = {}): EnemyTarget => ({ attribute: 'fire', def: 0, hp: 100_000, maxHp: 100_000, ...extra });
const dealt = (hit: Hit, e: EnemyTarget, combo = 1) => applyHits([hit], [e], 0, { combo, config }).results[0]?.damage ?? 0;

describe('百分比傷害的基礎數值', () => {
  it('依目標最大生命取整，最多 cap 點；沒填 cap 不設上限', () => {
    expect(percentHitAmount({ percentMaxHp: 3, cap: 60000 }, { hp: 100_000, maxHp: 100_000 })).toBe(3000);
    expect(percentHitAmount({ percentMaxHp: 3, cap: 60000 }, { hp: 4_000_000, maxHp: 4_000_000 })).toBe(60000);
    expect(percentHitAmount({ percentMaxHp: 2.5 }, { hp: 1, maxHp: 1_000_001 })).toBe(25000);
    // 看最大生命，不是剩餘生命
    expect(percentHitAmount({ percentMaxHp: 3, cap: 60000 }, { hp: 10, maxHp: 100_000 })).toBe(3000);
  });
});

describe('百分比傷害與敵人的互動（視同固定傷害）', () => {
  it('一般敵人：無視防禦，不吃屬性剋制與屬性減傷', () => {
    expect(dealt(pct(), enemy({ def: 5000 }))).toBe(3000);
    expect(dealt(pct({ attribute: 'water' }), enemy())).toBe(3000);
    expect(dealt(pct(), enemy({ attributeShield: { attributes: ['fire', 'water', 'wood', 'light', 'dark'], percent: 90 } }))).toBe(3000);
  });

  it('Boss：百萬生命被上限壓住，不會秒殺', () => {
    expect(dealt(pct(), enemy({ hp: 4_000_000, maxHp: 4_000_000, def: 1500 }))).toBe(60000);
  });

  it('剩餘生命不夠時只扣到 0', () => {
    expect(dealt(pct(), enemy({ hp: 1000 }))).toBe(1000);
  });

  it('一般護盾照常減免；完全護盾擋下；ignoreShield 可穿透', () => {
    expect(dealt(pct(), enemy({ shieldPercent: 50 }))).toBe(1500);
    expect(dealt(pct(), enemy({ shieldPercent: 100 }))).toBe(0);
    expect(dealt(pct({ ignoreShield: true }), enemy({ shieldPercent: 100 }))).toBe(3000);
  });

  it('不受 Combo 盾影響', () => {
    expect(dealt(pct(), enemy({ comboShield: 8 }), 1)).toBe(3000);
  });

  it('不受傷害吸收影響，也不計入吸收門檻', () => {
    const r = applyHits([pct(), pct()], [enemy({ damageAbsorb: 2000 })], 0, ctx);
    expect(r.results.map((x) => x.damage)).toEqual([3000, 3000]);
    expect(r.taken).toEqual([0]);
  });

  it('全體：每個目標依自己的最大生命計算', () => {
    const r = applyHits([pct({ target: 'all' })], [enemy(), enemy({ hp: 2_000_000, maxHp: 2_000_000 })], 0, ctx);
    expect(r.results.map((x) => x.damage)).toEqual([3000, 60000]);
  });
});

// ---------- 戰鬥中 ----------

const card = (id: string, extra: Partial<CardDef> = {}): CardDef => ({
  id, name: id, attribute: 'light', race: 'human', rarity: 6, maxLevel: 1,
  stats: { hp: [5000, 5000], atk: [1, 1], rcv: [1, 1] }, growthCurve: 1, cost: 5, expValue: 0, sellValue: 0, archetypes: [], art: {}, flavor: '', ...extra,
});
const boss: EnemyDef = { id: 'boss', name: 'Boss', attribute: 'fire', hp: 4_000_000, atk: 1, def: 1500, cd: 99, abilities: [], art: {} };
const stage: StageDef = { id: 's', kind: 'main', name: 's', stamina: 0, unlockAfter: null, waves: [{ enemies: ['boss'], boss: true }], rewards: { coin: 0, playerExp: 0 }, drops: [] };
const pctLeader: LeaderSkillDef = {
  id: 'ls-pct', name: '星骸裂斬', description: '',
  rules: [{ conditions: [{ type: 'always' }], effects: [{ type: 'followUpDamage', mode: 'percentMaxHp', value: 3, cap: 60000 }] }],
};

describe('戰鬥中的百分比追打與主動技', () => {
  it('隊長技追打：一次轉珠後依 Boss 最大生命追打，被上限壓住', () => {
    const turn = evaluateLeaderTurn([pctLeader], { team: [], groups: [], combo: 0, hpPercent: 100, skillUsedThisTurn: false });
    expect(turn.followUps).toEqual([{ member: -1, target: 'single', amount: 60000, fixed: true, percentMaxHp: 3, cap: 60000 }]);
    const data: BattleData = { config: gameConfig as GameConfig, cards: [card('a', { leaderSkill: 'ls-pct' })], skills: [], leaderSkills: [pctLeader], enemies: [boss] };
    const battle = startBattle(stage, [{ cardId: 'a', level: 1 }], null, createRng(1), data);
    const r = battle.submitMove([]);
    if (!r.ok) throw new Error(r.reason);
    expect(r.summary.hits.filter((h) => h.hit.percentMaxHp).map((h) => h.damage)).toEqual([60000]);
    expect(battle.getState().enemies[0].hp).toBe(4_000_000 - 60000);
  });

  it('主動技積木：造成目標最大生命 N% 的傷害（無視防禦，有上限）', () => {
    const data: BattleData = {
      config: gameConfig as GameConfig,
      cards: [card('a', { activeSkill: 's', leaderSkill: 'charge' })],
      skills: [{ id: 's', name: '星骸裂斬', cooldown: { max: 1, min: 1 }, effects: [{ type: 'damage', target: 'single', mode: 'percentMaxHp', value: 10, cap: 200000 }], description: '' }],
      leaderSkills: [{ id: 'charge', name: '充能', description: '', rules: [{ conditions: [{ type: 'always' }], effects: [{ type: 'skillCooldownStart', charged: true }] }] }],
      enemies: [boss],
    };
    const battle = startBattle(stage, [{ cardId: 'a', level: 1 }], null, createRng(1), data);
    const r = battle.useSkill(0);
    if (!r.ok) throw new Error(r.reason);
    expect(r.skill.hits.map((h) => h.damage)).toEqual([200000]);
  });
});

describe('隊長技強度評估', () => {
  it('profile 記下百分比與上限；上限就是對超高生命 Boss 的等效固定追打', () => {
    const p = leaderSkillProfile(pctLeader);
    expect(p.percentFollowUp).toBe(3);
    expect(p.percentFollowUpCap).toBe(60000);
    expect(p.fixedFollowUp).toBe(0);
  });

  it('依星數檢查百分比與上限；3★ 不能有百分比追打', () => {
    expect(checkLeaderTier(pctLeader, 6)).toEqual([]);
    expect(checkLeaderTier(pctLeader, 5)).toEqual(['百分比追打 % 3 超過 5★ 上限 2', '百分比追打上限 60000 超過 5★ 上限 30000']);
    expect(checkLeaderTier(pctLeader, 3).length).toBe(2);
    expect(LEADER_TIERS[3].percentFollowUp).toBe(0);
    for (const r of [3, 4, 5, 6] as const) expect(LEADER_TIERS[r].percentFollowUpCap).toBeGreaterThanOrEqual(LEADER_TIERS[r].fixedFollowUp);
  });

  it('沒填上限：lint 與星數檢查都會擋', () => {
    const noCap: LeaderSkillDef = { ...pctLeader, rules: [{ conditions: [{ type: 'always' }], effects: [{ type: 'followUpDamage', mode: 'percentMaxHp', value: 1 }] }] };
    expect(lintLeaderSkill(noCap)).toEqual(['rule 0：百分比追打一定要有上限 cap，否則會秒殺 Boss']);
    expect(checkLeaderTier(noCap, 6)).toEqual(['百分比追打沒有上限 cap']);
  });

  it('進化後百分比追打不能變弱', () => {
    const weaker: LeaderSkillDef = { ...pctLeader, rules: [{ conditions: [{ type: 'always' }], effects: [{ type: 'followUpDamage', mode: 'percentMaxHp', value: 2, cap: 60000 }] }] };
    expect(checkLeaderEvolution(pctLeader, weaker)).toContain('進化後 percentFollowUp 變弱（3 → 2）');
  });
});

describe('資料驗證', () => {
  it('主動技的最大生命百分比傷害沒填上限會被擋下；正式資料目前沒有用到新模式', () => {
    const bad = { id: 'sk-bad', name: '壞', cooldown: { max: 5, min: 3 }, description: '', effects: [{ type: 'damage' as const, target: 'single' as const, mode: 'percentMaxHp' as const, value: 5 }] };
    expect(validateGameData({ ...gameData, skills: [...gameData.skills, bad] })).toContain('skills/sk-bad: 最大生命百分比傷害一定要有上限 cap');
    // heal 本來就有 percentMaxHp（回復最大生命 %），這裡只看傷害與追打
    const damageUses = gameData.skills.flatMap((x) => x.effects).filter((e) => e.type === 'damage' && e.mode === 'percentMaxHp');
    const followUses = gameData.leaderSkills.flatMap((l) => l.rules.flatMap((r) => r.effects)).filter((e) => e.type === 'followUpDamage' && e.mode === 'percentMaxHp');
    expect([...damageUses, ...followUses]).toEqual([]);
  });
});

describe('練習場示範', async () => {
  const { practiceSetup, PRACTICE_MODES } = await import('../src/ui/demo');
  it('百分比追打模式：隊長追打 3%（上限 60,000）對 400 萬生命 Boss，每次轉珠穩定削 60,000', () => {
    expect(PRACTICE_MODES.map((m) => m.id)).toContain('percentFollowUp');
    const { stage, data } = practiceSetup('percentFollowUp');
    const battle = startBattle(stage, [{ cardId: 'demo-c1', level: 30 }], null, createRng(1), data);
    const r = battle.submitMove([]);
    if (!r.ok) throw new Error(r.reason);
    expect(r.summary.hits.filter((h) => h.hit.percentMaxHp).map((h) => h.damage)).toEqual([60000]);
    // 正式卡片資料沒有被改到
    expect(gameData.cards.some((c) => c.leaderSkill === 'demo-l-pct')).toBe(false);
  });
});
