import { describe, expect, it } from 'vitest';
import { gameData } from '../src/data/load';
import { checkLeaderTier } from '../src/battle/leader';

const card = (n: number) => gameData.cards.find(c => c.id === `c${n}`)!;
const skill = (n: number) => gameData.skills.find(s => s.id === card(n).activeSkill)!;
const leader = (n: number) => gameData.leaderSkills.find(s => s.id === card(n).leaderSkill)!;
const ids = Array.from({ length: 15 }, (_, i) => 801 + i);

describe('第一批經典角色資料', () => {
  it('15 位本體有獨立卡號、技能、素材且不加入進化鏈', () => {
    const names = ['勝利海神費雷', '獨臂戰神提爾', '妙曼愛神費蕾雅', '轟天雷神索爾', '黃昏號角洛基', '海神波塞頓', '奧林火神赫淮斯托斯', '智慧女神雅典娜', '光明之神阿波羅', '月之狩獵女神阿提密斯', '饕餮渾沌魔君', '惡魔巴風特', '朱雀陵光神君', '玄武執明神君', '白虎監兵神君'];
    expect(ids.map(n => card(n).name)).toEqual(names);
    for (const n of ids) {
      expect(gameData.cards.filter(c => c.id === `c${n}`)).toHaveLength(1);
      expect(card(n).race).toBe(n <= 810 ? 'god' : 'beast');
      expect(card(n).rarity).toBe(n <= 810 ? 6 : 5);
      expect(card(n).evolution).toBeUndefined();
      expect(card(n).art.portrait).toBe(`assets/user/cards/c${n}.png`);
      expect(card(n).art.icon).toBe(`assets/user/cards/c${n}_i.png`);
      expect(skill(n)).toBeDefined();
      expect(checkLeaderTier(leader(n), card(n).rarity), String(n)).toEqual([]);
    }
  });

  it('北歐五神只強化本色，希臘五神具有真正的同色連動與持續印記', () => {
    for (let i = 0; i < 5; i++) {
      const north = card(801 + i);
      expect(skill(801 + i).effects).toEqual([{ type: 'enhanceOrbs', orbs: north.attribute }]);
      const greek = card(806 + i);
      expect(skill(806 + i).effects).toEqual([{ type: 'markAttack', attribute: greek.attribute, initialMultiplier: 1.4, step: 0.2, maxMultiplier: 2.2 }]);
      expect(leader(806 + i).rules.flatMap(r => r.effects)).toContainEqual({ type: 'matchedOrbSkyfall', orb: greek.attribute, count: 3, spawn: 1 });
    }
  });

  it('黑狗、魔羊接力保留轉心／轉暗，玄武減傷、白虎降防不互相冒充', () => {
    expect(skill(811).effects).toEqual([{ type: 'convertOrbs', from: 'light', to: 'heart' }]);
    expect(skill(812).effects).toEqual([{ type: 'convertOrbs', from: 'heart', to: 'dark' }]);
    expect(skill(813).effects).toEqual([{ type: 'convertOrbs', from: 'wood', to: 'heart' }]);
    expect(skill(814).effects).toEqual([{ type: 'reduceDamage', percent: 50, turns: 3 }]);
    expect(skill(815).name).toBe('護牆崩壞');
    expect(skill(815).effects).toEqual([{ type: 'reduceEnemyDefense', percent: 90, turns: 3 }]);
  });

  it('三個新流派有隊長與支援，原本流派標籤仍可用', () => {
    for (const id of ['norse', 'greek', 'classicbeast']) {
      expect(gameData.archetypes.some(a => a.id === id)).toBe(true);
      expect(gameData.cards.some(c => c.archetypes.some(a => a.id === id && a.role === 'leader'))).toBe(true);
      expect(gameData.cards.some(c => c.archetypes.some(a => a.id === id && a.role !== 'leader'))).toBe(true);
    }
    expect(card(801).archetypes).toContainEqual({ id: 'mono', role: 'leader' });
    expect(card(806).archetypes).toContainEqual({ id: 'enhance', role: 'leader' });
    expect(card(811).archetypes).toContainEqual({ id: 'race', role: 'leader' });
  });
});
