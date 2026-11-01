import { describe, expect, it } from 'vitest';
import { gameData } from '../src/data/load';
import { buildFixedTactics } from '../src/ui/fixed-tactics';

const copy = () => structuredClone(gameData);

describe('固定借隊教學純內容', () => {
  it('集中修正固定傷害的盾界線，其他說明不自行覆寫', () => {
    const fixed = gameData.archetypes.find(a => a.id === 'fixed')!;
    expect(fixed.summary).toBe('造成不看攻擊力的固定傷害，可無視防禦與 Combo 盾；不代表能無視所有護盾。');
    expect(fixed.howToPlay).toBe('消除心珠觸發追打；面對高防禦可發揮優勢，遇到減傷盾或七曜環仍要處理護盾。');
  });
  it('借用成員、順序、等級與助手均來自實際試煉資料', () => {
    const model = buildFixedTactics(gameData)!; expect(model).not.toBeNull();
    expect(model.trial.id).toBe('trial-fixed');
    expect(model.members.map(m => [m.card.id, m.level, m.helper])).toEqual([
      ['c307', 49, false], ['c208', 49, false], ['c306', 49, false], ['c308', 49, false], ['c408', 49, false], ['c307', 49, true],
    ]);
    const changed = copy();
    const trial = changed.stages.find(s => s.id === 'trial-fixed')!;
    trial.fixedTeam!.members = [{ card: 'c306', level: 12 }, { card: 'c307', level: 34 }];
    trial.fixedTeam!.helper = { card: 'c208', level: 56 };
    expect(buildFixedTactics(changed)!.members.map(m => [m.card.id, m.level, m.helper])).toEqual([
      ['c306', 12, false], ['c307', 34, false], ['c208', 56, true],
    ]);
  });
  it('技能說明直接取資料，只有真正隊長或助手顯示隊長技', () => {
    const changed = copy();
    changed.skills.find(s => s.id === 's307')!.description = '資料更新的主動技';
    changed.leaderSkills.find(s => s.id === 'l307')!.description = '資料更新的隊長技';
    const model = buildFixedTactics(changed)!; expect(model).not.toBeNull();
    expect(model.members[0].activeDescription).toBe('資料更新的主動技');
    expect(model.members[0].leaderDescription).toBe('資料更新的隊長技');
    expect(model.members[5].leaderDescription).toBe('資料更新的隊長技');
    for (const member of model.members.slice(1, 5)) {
      expect(member.leaderDescription).toBeUndefined();
      expect(member.activeDescription).toBe(changed.skills.find(s => s.id === member.card.activeSkill)!.description);
    }
    changed.stages.find(s => s.id === 'trial-fixed')!.fixedTeam!.members.reverse();
    const moved = buildFixedTactics(changed)!;
    expect(moved.members.find(m => m.card.id === 'c307' && !m.helper)!.leaderDescription).toBeUndefined();
    expect(moved.members.find(m => m.card.id === 'c307' && !m.helper)!.role).not.toContain('消除心珠');
  });
  it('角色建議包含機率限制，不將普通隊員隊長效果當作啟動', () => {
    const model = buildFixedTactics(gameData)!; expect(model).not.toBeNull();
    const role = (id: string) => model.members.find(m => m.card.id === id)!.role;
    expect(role('c307')).toContain('上限');
    expect(role('c208')).toContain('不保證');
    expect(role('c306')).toContain('蝕珠');
    expect(role('c308')).toContain('減傷');
    expect(role('c408')).toContain('解除');
    expect(model.steps.join('')).toMatch(/倒數/);
    expect(model.steps.join('')).toMatch(/來源/);
    expect(model.defenses.map(d => d.detail).join('')).toContain('技能明確標示「無視護盾」');
  });
  it('缺失試煉、安全未知成員與缺少技能說明的回退，不借用其他流派資料', () => {
    const missing = copy(); missing.stages = [];
    expect(buildFixedTactics(missing)).toBeNull();
    const noTeam = copy(); delete noTeam.stages.find(s => s.id === 'trial-fixed')!.fixedTeam;
    expect(buildFixedTactics(noTeam)).toBeNull();
    const changed = copy();
    changed.stages.find(s => s.id === 'trial-fixed')!.fixedTeam!.members = [{ card: 'unknown', level: 1 }, { card: 'c101', level: 2 }];
    changed.stages.find(s => s.id === 'trial-fixed')!.fixedTeam!.helper = undefined;
    changed.skills = []; changed.leaderSkills = [];
    const model = buildFixedTactics(changed)!; expect(model).not.toBeNull();
    expect(model.members).toHaveLength(1);
    expect(model.members[0]).toMatchObject({ level: 2, helper: false, activeDescription: '暫無主動技說明。' });
    expect(model.members[0].leaderDescription).toBeUndefined();
    expect(model.members[0].role).toContain('技能說明');
  });
  it('同卡重複放隊員時不誤標為隊長；位置旗標與助戰獨立', () => {
    const data = copy();
    data.stages.find(s => s.id === 'trial-fixed')!.fixedTeam!.members = [{ card: 'c307', level: 49 }, { card: 'c307', level: 20 }];
    const members = buildFixedTactics(data)!.members;
    expect(members.map(m => [m.leader, m.helper])).toEqual([[true, false], [false, false], [true, true]]);
    expect(members[1].leaderDescription).toBeUndefined();
    expect(members[1].role).not.toContain('消除心珠');
    expect(members[2].role).toContain('助戰');
  });
  it('已知角色若缺少技能資料也不臆造主動或隊長效果', () => {
    const data = copy(); data.skills = []; data.leaderSkills = [];
    const member = buildFixedTactics(data)!.members[0];
    expect(member.activeDescription).toBe('暫無主動技說明。');
    expect(member.leaderDescription).toBeUndefined();
    expect(member.role).not.toContain('追打');
    expect(member.role).not.toContain('單體固定傷害');
  });
  it('只讀 GameData，不需要持有卡片、解鎖試煉或存檔參數，也不改資料', () => {
    const data = copy(); const before = JSON.stringify(data);
    const model = buildFixedTactics(data)!; expect(model).not.toBeNull();
    expect(model.members).toHaveLength(6);
    expect(model.trial.unlockAfter).toBe('st-4-9');
    expect(JSON.stringify(data)).toBe(before);
  });
});
