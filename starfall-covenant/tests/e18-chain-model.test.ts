import { describe, expect, it } from 'vitest';
import { gameData } from '../src/data/load';
import { buildChainTactics } from '../src/ui/chain-tactics';
const copy = () => structuredClone(gameData);
describe('actual chain borrowed-team content', () => {
  it('uses the exact corrected central text', () => {
    const chain = gameData.archetypes.find(a => a.id === 'chain')!;
    expect(chain.summary).toBe('靠長串觸發隊長加成；全體攻擊與無視防禦是不同效果，不是所有長串隊都能破防。');
    expect(chain.howToPlay).toBe('一組 5 顆以上本色珠的傷害打全體，其他組仍依各自珠數判定；依隊長門檻安排長串，開轉珠技前先確認要保留的顏色與施放順序。');
  });
  it('uses real roster levels, true positions, full skill text without mutation', () => {
    const data = copy(), before = JSON.stringify(data), model = buildChainTactics(data)!;
    expect(model.members.map(m => [m.card.id, m.level, m.leader, m.helper])).toEqual([
      ['c509',35,true,false],['c107',49,false,false],['c506',49,false,false],['c511',35,false,false],['c508',49,false,false],['c509',35,true,true],
    ]);
    for (const member of model.members) {
      expect(member.activeDescription).toBe(data.skills.find(s => s.id === member.card.activeSkill)!.description);
      expect(member.leaderDescription).toBe(member.leader ? data.leaderSkills.find(s => s.id === member.card.leaderSkill)!.description : undefined);
    }
    expect(model.mechanics.join('')).toContain('4 倍');
    expect(model.comparisons.map(c => c.id)).toEqual(['c510','c501']);
    expect(model.orderExample.rows.map(row => [row.dark,row.fire])).toEqual([[0,18],[6,12]]);
    expect(model.orderExample.note).toContain('不是即時傷害預測');
    expect(JSON.stringify(data)).toBe(before);
  });
  it('missing trial returns null; missing original leader never promotes the next member', () => {
    const missing = copy(); missing.stages = []; expect(buildChainTactics(missing)).toBeNull();
    const data = copy(); data.cards = data.cards.filter(c => c.id !== 'c509');
    const model = buildChainTactics(data)!;
    expect(model.members[0].card.id).toBe('c107'); expect(model.members[0].leader).toBe(false);
    expect(model.members.every(m => !m.leaderDescription)).toBe(true);
    expect(model.mechanics.join('')).not.toContain('4 倍');
  });
  it('duplicate c509 ordinary member is not a leader and changed roster levels remain data-backed', () => {
    const data = copy(); const team = data.stages.find(s => s.id === 'trial-chain')!.fixedTeam!;
    team.members = [{card:'c509',level:12},{card:'c509',level:34}];
    const model = buildChainTactics(data)!;
    expect(model.members.map(m => [m.level,m.leader,m.helper])).toEqual([[12,true,false],[34,false,false],[35,true,true]]);
    expect(model.members[1].leaderDescription).toBeUndefined();
  });
  it('missing skill/leader description uses generic fallback and does not fabricate the order or multiplier', () => {
    const data = copy(); data.skills = []; data.leaderSkills = [];
    const model = buildChainTactics(data)!;
    expect(model.members.every(m => m.activeDescription === '暫無主動技說明。')).toBe(true);
    expect(model.members.every(m => m.role.includes('不推測'))).toBe(true);
    expect(model.mechanics.join('')).not.toContain('4 倍'); expect(model.orderExample.rows).toEqual([]);
  });
});

it.each(['c509','c107','s509','s107','l509'])('missing %s cannot claim unavailable converter order or dual multiplier', id => {
  const data = copy();
  data.cards = data.cards.filter(card => card.id !== id);
  data.skills = data.skills.filter(skill => skill.id !== id);
  data.leaderSkills = data.leaderSkills.filter(skill => skill.id !== id);
  const model = buildChainTactics(data)!;
  if (id !== 'l509') expect(model.orderExample.rows).toEqual([]);
  if (id === 'c509' || id === 'l509') expect(model.mechanics.join('')).not.toContain('4 倍');
});

it('comparison prose never invents a name unrelated to the linked comparison cards', () => {
  const model = buildChainTactics(gameData)!;
  expect(model.mechanics.join('')).not.toContain('黑契守門人');
  expect(model.mechanics.join('')).toContain('下方比較卡片的實際隊長技');
  expect(model.comparisons.map(card => card.name)).toEqual(['蝕晶龍・蓋布瑞', '深淵吞星者・莫爾德']);
});
