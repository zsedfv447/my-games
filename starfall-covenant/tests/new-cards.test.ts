import { describe, expect, it } from 'vitest';
import { gameData } from '../src/data/load';
import { checkLeaderTier, leaderSkillProfile } from '../src/battle/leader';

const NEW_IDS = ['c606', 'c701', 'c702', 'c703', 'c704', 'c705', 'c706', 'c707', 'c708', 'c709', 'c710', 'c711'];
const card = (id: string) => gameData.cards.find((c) => c.id === id)!;
const leaderOf = (id: string) => gameData.leaderSkills.find((l) => l.id === card(id).leaderSkill)!;
const skillOf = (id: string) => gameData.skills.find((s) => s.id === card(id).activeSkill)!;

describe('第 60 項新卡', () => {
  it('12 張都在，台詞與背景都有', () => {
    for (const id of NEW_IDS) {
      const c = card(id);
      expect(c, id).toBeDefined();
      expect(c.flavor.length, id).toBeGreaterThan(10);
      expect(c.lines?.victory, id).toBeTruthy();
    }
  });

  it('補齊種族缺口：獸裔、冥裔各 12 張，人傑 +4', () => {
    const battle = gameData.cards.filter((c) => c.race !== 'material');
    const count = (race: string) => battle.filter((c) => c.race === race).length;
    expect(count('beast')).toBe(12);
    expect(count('nether')).toBe(12);
    expect(NEW_IDS.filter((id) => card(id).race === 'human')).toHaveLength(4);
  });

  it('種族羈絆有核心與輔助卡，雙屬共鳴多了核心卡', () => {
    const roles = (arch: string, role: string) => gameData.cards.filter((c) => c.archetypes.some((a) => a.id === arch && a.role === role)).length;
    expect(roles('race', 'core')).toBeGreaterThanOrEqual(4);
    expect(roles('race', 'support')).toBeGreaterThanOrEqual(2);
    expect(roles('dual', 'core')).toBeGreaterThanOrEqual(3);
  });

  it('隊長技符合星數分級，而且不超過同星數既有卡的最高攻擊倍率', () => {
    const old = gameData.cards.filter((c) => c.race !== 'material' && !NEW_IDS.includes(c.id) && c.leaderSkill);
    for (const id of NEW_IDS) {
      const c = card(id);
      expect(checkLeaderTier(leaderOf(id), c.rarity), id).toEqual([]);
      const best = Math.max(...old.filter((o) => o.rarity === c.rarity).map((o) => leaderSkillProfile(gameData.leaderSkills.find((l) => l.id === o.leaderSkill)!).peakAtk));
      expect(leaderSkillProfile(leaderOf(id)).peakAtk, id).toBeLessThanOrEqual(best + 1e-9);
    }
  });

  it('新積木 twoColorBoard、rowToOrb 各至少 2 張新卡使用', () => {
    const using = (type: string) => NEW_IDS.filter((id) => skillOf(id).effects.some((e) => e.type === type));
    expect(using('twoColorBoard').length).toBeGreaterThanOrEqual(2);
    expect(using('rowToOrb').length).toBeGreaterThanOrEqual(2);
  });

  it('取得方式：常駐池依稀有度，c606 是第 6 章星章獎勵；機率不變', () => {
    const pool = gameData.gachaPools.find((p) => p.id === 'pool-standard')!;
    const pooled = Object.entries(pool.cards).flatMap(([r, ids]) => ids.map((id) => ({ id, r: Number(r) })));
    for (const id of NEW_IDS.filter((x) => x !== 'c606')) {
      const hit = pooled.find((p) => p.id === id);
      expect(hit, id).toBeDefined();
      expect(hit!.r, id).toBe(card(id).rarity);
    }
    expect(pool.rates).toEqual({ '6': 0.01, '5': 0.02, '4': 0.17, '3': 0.8 });
    expect(gameData.chapters.find((c) => c.chapter === 6)?.starReward.cards).toEqual([{ card: 'c606', count: 1 }]);
  });
});
