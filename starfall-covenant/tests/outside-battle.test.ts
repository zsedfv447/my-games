import { describe, expect, it } from 'vitest';
import type { CardDef, EnemyDef, LeaderSkillDef } from '../src/core/types';
import { gameData } from '../src/data/load';
import { startBattle } from '../src/battle/battle-state';
import { createRng } from '../src/core/rng';
import { abilityText, stageIntel } from '../src/ui/stage-intel';
import { cleanTeamName, leaderHighlights, teamTotals } from '../src/ui/team-summary';
import { defeatAdvice, waveProgressText } from '../src/ui/defeat-advice';
import { formatCountdown, staminaFullText, staminaNextText } from '../src/ui/countdown';
import { autoDelayMs, storyLog } from '../src/ui/story-auto';

const config = gameData.config.battle;
const leaderOf = (c: CardDef) => gameData.leaderSkills.find((l) => l.id === c.leaderSkill);
const enemy = (over: Partial<EnemyDef>): EnemyDef => ({ id: 'x', name: '測試敵人', attribute: 'fire', hp: 1, atk: 1, def: 0, cd: 1, abilities: [], art: {}, ...over });

describe('關卡情報', () => {
  it('列出每波敵人與能力，Boss 波標記', () => {
    const intel = stageIntel({ waves: [{ enemies: ['e0001', 'e0001'] }, { enemies: ['e0019'], boss: true }] }, gameData.enemies, config);
    expect(intel.waves).toHaveLength(2);
    expect(intel.waves[0].enemies[0].abilities).toEqual(['開場：護盾']);
    expect(intel.waves[1].boss).toBe(true);
    expect(intel.waves[1].enemies[0].abilities[0]).toContain('7 Combo');
    expect(intel.enemyAttributes).toEqual(['fire', 'water']);
  });

  it('建議屬性：剋制最多敵人，Boss 加倍', () => {
    // 2 隻焰（潮剋）＋ Boss 森（焰剋，算 2）→ 平手時照屬性順序：焰在潮之前
    const enemies = [enemy({ id: 'f', attribute: 'fire' }), enemy({ id: 'w', attribute: 'wood' })];
    const intel = stageIntel({ waves: [{ enemies: ['f', 'f'] }, { enemies: ['w'], boss: true }] }, enemies, config);
    expect(intel.suggested).toEqual(['fire', 'water']);
    const lone = stageIntel({ waves: [{ enemies: ['f'] }] }, enemies, config);
    expect(lone.suggested).toEqual(['water']);
  });

  it('找不到的敵人略過，不會壞掉', () => {
    expect(stageIntel({ waves: [{ enemies: ['nope'] }] }, gameData.enemies, config).waves[0].enemies).toEqual([]);
  });

  it('能力文字涵蓋觸發條件與參數', () => {
    expect(abilityText({ status: 'enrage', trigger: 'hpBelow', value: 2, params: { percent: 30 } })).toBe('生命低於 30%：狂怒（攻擊 ×2）');
    expect(abilityText({ status: 'heartSeal', trigger: 'everyNTurns', params: { n: 3 } })).toBe('每 3 回合：心珠封印');
    expect(abilityText({ status: 'attributeShield', trigger: 'onStart', value: 50, params: { attribute: 'water' } })).toBe('開場：潮屬性減傷 50%');
    expect(abilityText({ status: 'attributeShield', trigger: 'onStart', value: 70, params: { attribute: 'rotate' } })).toContain('輪替');
  });

  it('所有關卡的敵人都能產生情報', () => {
    for (const s of gameData.stages) {
      const intel = stageIntel(s, gameData.enemies, config);
      expect(intel.waves.flatMap((w) => w.enemies).length).toBeGreaterThan(0);
      for (const w of intel.waves) for (const e of w.enemies) for (const a of e.abilities) expect(a).not.toMatch(/undefined/);
    }
  });
});

describe('隊伍總數值', () => {
  const leader = gameData.cards.find((c) => c.leaderSkill === 'l101')!;
  const others = gameData.cards.filter((c) => c.id !== leader.id).slice(0, 4);

  it('和戰鬥開場的總生命一致（含隊長技生命倍率）', () => {
    const members = [leader, ...others].map((c, i) => ({ card: c, level: 1 + i * 3 }));
    const totals = teamTotals(members, leaderOf);
    const battle = startBattle(gameData.stages[0], members.map((m) => ({ cardId: m.card.id, level: m.level })), null, createRng(1));
    expect(totals.hp).toBe(battle.getState().maxHp);
    expect(totals.hp).toBeGreaterThan(totals.baseHp);
  });

  it('助戰的隊長技也會算進去', () => {
    const members = [{ card: others[0], level: 10 }];
    const solo = teamTotals(members, leaderOf);
    const withHelper = teamTotals(members, leaderOf, { card: leader, level: 10 });
    const battle = startBattle(gameData.stages[0], [{ cardId: others[0].id, level: 10 }], { cardId: leader.id, level: 10 }, createRng(1));
    expect(withHelper.hp).toBe(battle.getState().maxHp);
    expect(withHelper.atk).toBeGreaterThan(solo.atk);
  });

  it('隊伍改名：去空白、限 10 字、空的不改', () => {
    expect(cleanTeamName('  焰之  隊 ')).toBe('焰之 隊');
    expect(cleanTeamName('一二三四五六七八九十十一')).toBe('一二三四五六七八九十');
    expect(cleanTeamName('   ')).toBeNull();
  });

  it('空隊伍是 0', () => {
    expect(teamTotals([], leaderOf)).toEqual({ hp: 0, atk: 0, rcv: 0, baseHp: 0, baseRcv: 0 });
  });

  it('隊長技重點標籤', () => {
    const l101 = gameData.leaderSkills.find((l) => l.id === 'l101')!;
    expect(leaderHighlights(l101)).toEqual(['攻擊最高 ×4.55', '生命 ×1.3']);
    const def: LeaderSkillDef = { id: 't', name: 't', description: '', rules: [{ conditions: [{ type: 'always' }], effects: [{ type: 'damageReduction', percent: 20 }, { type: 'extendMoveTime', seconds: 1 }] }] } as LeaderSkillDef;
    expect(leaderHighlights(def)).toEqual(['減傷 20%', '轉珠 +1 秒']);
  });
});

describe('失敗引導', () => {
  const stage = gameData.stages.find((s) => s.id === 'st-1-1')!;
  const intel = stageIntel(stage, gameData.enemies, config);
  const wood = gameData.cards.find((c) => c.attribute === 'wood' && c.maxLevel > 1)!;
  const water = gameData.cards.find((c) => c.attribute === 'water' && c.maxLevel > 1)!;
  const base = { stage, intel, hasHelper: false, helperAllowed: true, primaryArchetype: null, archetypeName: (id: string) => id };

  it('建議強化最落後的隊員、換剋制屬性、借助戰', () => {
    const advice = defeatAdvice({ ...base, members: [{ uid: 'u1', card: wood, level: wood.maxLevel }, { uid: 'u2', card: wood, level: 1 }] });
    expect(advice.map((a) => a.kind)).toEqual(['enhance', 'team', 'helper']);
    expect(advice[0].go).toEqual({ screen: 'enhance', args: ['u2'], label: '前往強化' });
    expect(advice[1].text).toContain('潮');
    expect(advice[2].go?.args).toEqual([stage.id]);
  });

  it('已帶剋制屬性、已滿級、有助戰時只給對策提示', () => {
    const advice = defeatAdvice({ ...base, stage: { ...stage, recommendedArchetypes: [] }, hasHelper: true, members: [{ uid: 'u1', card: water, level: water.maxLevel }] });
    expect(advice.every((a) => a.kind === 'tip')).toBe(true);
    expect(advice.length).toBeGreaterThan(0);
  });

  it('借用隊伍不建議強化或換隊', () => {
    const advice = defeatAdvice({ ...base, stage: { ...stage, fixedTeam: {} }, helperAllowed: false, members: [] });
    expect(advice.some((a) => a.kind === 'enhance' || a.kind === 'team' || a.kind === 'helper')).toBe(false);
  });

  it('依敵人能力給對策，最多 2 條', () => {
    const boss = gameData.stages.find((s) => s.waves.some((w) => w.enemies.includes('e0037')))!;
    const advice = defeatAdvice({ ...base, stage: boss, intel: stageIntel(boss, gameData.enemies, config), hasHelper: true, members: [] });
    const tips = advice.filter((a) => a.kind === 'tip');
    expect(tips.length).toBeLessThanOrEqual(2);
    expect(tips.some((t) => t.text.includes('Combo 盾'))).toBe(true);
  });

  it('波數文字', () => {
    expect(waveProgressText(1, 3)).toBe('打到第 2 / 3 波');
    expect(waveProgressText(5, 3)).toBe('打到第 3 / 3 波');
  });
});

describe('體力倒數', () => {
  it('格式', () => {
    expect(formatCountdown(272_000)).toBe('04:32');
    expect(formatCountdown(4_320_000)).toBe('1:12:00');
    expect(formatCountdown(1)).toBe('00:01');
    expect(formatCountdown(-5)).toBe('00:00');
  });
  it('滿了不顯示', () => {
    expect(staminaNextText(0)).toBeNull();
    expect(staminaNextText(61_000)).toBe('+1 01:01');
    expect(staminaFullText(0)).toBe('體力已滿');
    expect(staminaFullText(3_600_000)).toBe('全滿還要 1:00:00');
  });
});

describe('劇情自動播放與紀錄', () => {
  it('停留時間依句子長度，有上下限', () => {
    expect(autoDelayMs('')).toBe(1200);
    expect(autoDelayMs('一二三四五')).toBe(1550);
    expect(autoDelayMs('長'.repeat(200))).toBe(5000);
  });
  it('紀錄到目前這句，連續同一人省略名字', () => {
    const lines = [{ speaker: '甲', text: '1' }, { speaker: '甲', text: '2' }, { text: '旁白' }, { speaker: '甲', text: '3' }];
    expect(storyLog(lines, 1)).toEqual([{ speaker: '甲', text: '1' }, { speaker: undefined, text: '2' }]);
    expect(storyLog(lines, 3).map((l) => l.speaker)).toEqual(['甲', undefined, undefined, '甲']);
    expect(storyLog(lines, -1)).toEqual([]);
  });
});
