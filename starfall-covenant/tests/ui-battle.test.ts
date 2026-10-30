import { describe, expect, it } from 'vitest';
import { cellAt, remainingMs, stepsBetween } from '../src/battle/view/drag';
import { startBattle } from '../src/battle/battle-state';
import { createRng } from '../src/core/rng';
import type { CardDef, SaveData, StageDef } from '../src/core/types';
import { createNewSave } from '../src/save/save';
import { gameData } from '../src/data/load';
import { DEMO_DATA, DEMO_HELPER, DEMO_STAGE, DEMO_TEAM } from '../src/ui/demo';
import { buildSortieTeam, describeTeamRule, sortieProblem } from '../src/ui/sortie';

describe('拖曳轉珠座標', () => {
  const size = { cols: 6, rows: 5 };
  it('格子中心才算進入，邊緣是不感應區', () => {
    expect(cellAt(95, 30, 63, size)).toEqual({ row: 0, col: 1 });
    expect(cellAt(64, 30, 63, size)).toBeNull();
    expect(cellAt(-5, 30, 63, size)).toBeNull();
    expect(cellAt(400, 30, 63, size)).toBeNull();
  });
  it('一次跳好幾格時拆成連續的八方向步伐', () => {
    expect(stepsBetween({ row: 0, col: 0 }, { row: 2, col: 3 })).toEqual([
      { row: 1, col: 1 }, { row: 2, col: 2 }, { row: 2, col: 3 },
    ]);
    expect(stepsBetween({ row: 1, col: 1 }, { row: 1, col: 1 })).toEqual([]);
  });
  it('第一次移動前不倒數', () => {
    expect(remainingMs(null, 9999, 5000)).toBe(5000);
    expect(remainingMs(1000, 3000, 5000)).toBe(3000);
    expect(remainingMs(1000, 9000, 5000)).toBe(0);
  });
});

describe('練習戰展示資料', () => {
  it('可以開戰並打完一回合', () => {
    const b = startBattle(DEMO_STAGE, DEMO_TEAM, DEMO_HELPER, createRng(2), DEMO_DATA);
    const res = b.submitMove([0, 1, 2, 3, 4, 5].map((col) => ({ row: 0, col })));
    expect(res.ok).toBe(true);
    expect(b.getState().turns).toBe(1);
  });
});

describe('出戰隊伍', () => {
  const cards = DEMO_DATA.cards;
  const byId = (id: string) => cards.find((c) => c.id === id);
  const save = (): SaveData => {
    const s = createNewSave(gameData.config, 0);
    s.inventory.cards = cards.slice(0, 3).map((c, i) => ({
      uid: `u${i}`, cardId: c.id, level: 10, exp: 0, skillLevel: 1, limitBreak: 0, awakened: 0, locked: false, obtainedAt: 0,
    }));
    s.teams[0].members = ['u0', 'u1', 'u2', null, null];
    return s;
  };
  const stage = (extra: Partial<StageDef>): StageDef => ({ ...DEMO_STAGE, id: 'x', ...extra });

  it('一般關卡用目前隊伍，並檢查隊伍限制', () => {
    const team = buildSortieTeam(stage({ teamRule: { filter: { attribute: 'fire' } } }), save(), byId);
    expect(team.borrowed).toBe(false);
    expect(team.members.map((m) => m.cardId)).toEqual(['demo-c1', 'demo-c2', 'demo-c3']);
    expect(sortieProblem(stage({ teamRule: { filter: { attribute: 'fire' } } }), team)).toBe('teamFilter');
    expect(sortieProblem(stage({}), team)).toBeNull();
  });

  it('流派試煉用借用隊伍，不檢查玩家隊伍', () => {
    const st = stage({ kind: 'trial', fixedTeam: { members: [{ card: 'demo-c4', level: 30 }], helper: { card: 'demo-c6', level: 40 } }, teamRule: { maxMembers: 0 } });
    const team = buildSortieTeam(st, save(), byId);
    expect(team.borrowed).toBe(true);
    expect(team.members).toEqual([{ cardId: 'demo-c4', level: 30, skillLevel: undefined }]);
    expect(team.helperCard?.id).toBe('demo-c6');
    expect(sortieProblem(st, team)).toBeNull();
  });

  it('空隊伍不能出發', () => {
    const s = save();
    s.teams[0].members = [null, null, null, null, null];
    expect(sortieProblem(stage({}), buildSortieTeam(stage({}), s, byId))).toBe('emptyTeam');
  });

  it('隊伍限制翻成文字', () => {
    const lines = describeTeamRule(
      { filter: { attribute: ['fire', 'water'], race: 'dragon' }, archetype: 'combo', requiredCards: ['demo-c1'], maxMembers: 4, noHelper: true },
      (id) => (id === 'combo' ? '連擊狂潮' : id),
      (id) => (byId(id) as CardDef).name,
    );
    expect(lines).toEqual([
      '全隊必須是焰／潮屬性的龍嗣',
      '全隊必須屬於「連擊狂潮」流派',
      '隊伍必須包含：示範・焰紋見習',
      '最多 4 名隊員',
      '不能帶助戰',
    ]);
  });
});
