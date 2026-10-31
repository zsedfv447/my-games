import { describe, expect, it } from 'vitest';
import type { ActiveSkillDef, CardDef, LeaderSkillDef } from '../src/core/types';
import { gameData } from '../src/data/load';
import { CAPABILITIES, teamCapabilities } from '../src/ui/team-capabilities';
import { chapterPreview } from '../src/progression/chapter-preview';

const card = (id: string, extra: Partial<CardDef> = {}): CardDef => ({
  id, name: id, attribute: 'fire', race: 'human', rarity: 4, maxLevel: 1, stats: { hp: [1, 1], atk: [1, 1], rcv: [1, 1] },
  growthCurve: 1, cost: 1, expValue: 0, sellValue: 0, archetypes: [], art: {}, flavor: '', ...extra,
});
const skills: ActiveSkillDef[] = [
  { id: 's-heal', name: '', cooldown: { max: 5, min: 2 }, effects: [{ type: 'heal', mode: 'percentMaxHp', value: 20 }], description: '' },
  { id: 's-board', name: '', cooldown: { max: 5, min: 2 }, effects: [{ type: 'convertOrbs', from: 'heart', to: 'fire' }, { type: 'buffAttack', multiplier: 1.5, turns: 1 }], description: '' },
  { id: 's-delay', name: '', cooldown: { max: 5, min: 2 }, effects: [{ type: 'delayEnemy', turns: 1 }], description: '' },
];
const leaders: LeaderSkillDef[] = [
  { id: 'l-def', name: '', description: '', rules: [{ conditions: [{ type: 'always' }], effects: [{ type: 'damageReduction', percent: 20 }, { type: 'rcvMultiplier', value: 1 }] }] },
  { id: 'l-rcv', name: '', description: '', rules: [{ conditions: [{ type: 'always' }], effects: [{ type: 'rcvMultiplier', value: 1.5 }] }] },
];
const skillOf = (id: string) => skills.find((s) => s.id === id);
const leaderOf = (id: string) => leaders.find((l) => l.id === id);

describe('隊伍能力檢查', () => {
  it('依主動技與隊長技分類，列出缺少的能力', () => {
    const r = teamCapabilities([card('A', { activeSkill: 's-board', leaderSkill: 'l-def' }), card('B', { activeSkill: 's-delay' })], skillOf, leaderOf);
    expect(r.sources).toEqual({ heal: [], board: ['A'], burst: ['A'], control: ['B'], defense: ['A'] });
    expect(r.missing).toEqual(['heal']);
  });

  it('隊長技只看隊長與助戰；回復倍率 1 倍不算回血', () => {
    const team = [card('A'), card('B', { leaderSkill: 'l-rcv' })];
    expect(teamCapabilities(team, skillOf, leaderOf).sources.heal).toEqual([]);
    expect(teamCapabilities(team, skillOf, leaderOf, card('H', { leaderSkill: 'l-rcv' })).sources.heal).toEqual(['H']);
    expect(teamCapabilities([card('A', { activeSkill: 's-heal' })], skillOf, leaderOf).sources.heal).toEqual(['A']);
  });

  it('空隊伍不提醒；正式資料的隊伍都能分類', () => {
    expect(teamCapabilities([], skillOf, leaderOf).missing).toEqual([]);
    const real = gameData.cards.filter((c) => c.race !== 'material').slice(0, 5);
    const r = teamCapabilities(real, (id) => gameData.skills.find((s) => s.id === id), (id) => gameData.leaderSkills.find((l) => l.id === id));
    expect(Object.keys(r.sources)).toEqual(CAPABILITIES);
  });
});

describe('章節先展示獎勵', () => {
  it('第 1 章：首通卡、下一章、外傳以外的開放項目', () => {
    const p = chapterPreview(1, gameData.stages, gameData.chapters);
    const firstClearCards = gameData.stages.filter((s) => s.kind === 'main' && s.chapter === 1).flatMap((s) => s.rewards.firstClear?.cards?.map((c) => c.card) ?? []);
    expect(p.cards.map((c) => c.cardId)).toEqual([...new Set(firstClearCards)]);
    expect(p.unlocks.some((u) => u.startsWith('第 2 章'))).toBe(true);
    expect(p.unlocks).toContain('星蝕：集滿本章星章後開放');
  });

  it('第 3 章開放外傳，第 5 章開放星淵回廊', () => {
    expect(chapterPreview(3, gameData.stages, gameData.chapters).unlocks.some((u) => u.startsWith('外傳'))).toBe(true);
    expect(chapterPreview(5, gameData.stages, gameData.chapters).unlocks).toContain('星淵回廊');
  });

  it('沒有關卡的章節是空的', () => {
    expect(chapterPreview(99, gameData.stages, gameData.chapters)).toEqual({ cards: [], unlocks: [] });
  });
});
