import { describe, expect, it } from 'vitest';
import { cellAt, nextStep, remainingMs, samplePoints } from '../src/battle/view/drag';
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
  /** 沿著取樣點走一遍，回傳經過的格子 */
  const walk = (start: { row: number; col: number }, from: { x: number; y: number }, to: { x: number; y: number }, s = 100) => {
    const path = [start];
    for (const q of samplePoints(from, to, s * 0.05)) {
      for (let step = nextStep(path.at(-1)!, q.x, q.y, s, size); step; step = nextStep(path.at(-1)!, q.x, q.y, s, size)) path.push(step);
    }
    return path;
  };
  it('越過格線一段距離才換格，換過去後不會在格線上來回抖', () => {
    expect(nextStep({ row: 0, col: 0 }, 110, 50, 100, size)).toBeNull();
    expect(nextStep({ row: 0, col: 0 }, 116, 50, 100, size)).toEqual({ row: 0, col: 1 });
    expect(nextStep({ row: 0, col: 1 }, 90, 50, 100, size)).toBeNull();
    expect(nextStep({ row: 0, col: 5 }, 650, 50, 100, size)).toBeNull();
  });
  it('一次滑很遠時逐格走直線，不會亂插斜向', () => {
    const path = walk({ row: 0, col: 0 }, { x: 50, y: 50 }, { x: 550, y: 50 });
    expect(path.map((p) => p.col)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(path.every((p) => p.row === 0)).toBe(true);
    const lShape = walk({ row: 0, col: 0 }, { x: 50, y: 50 }, { x: 50, y: 350 });
    expect(lShape.at(-1)).toEqual({ row: 3, col: 0 });
    expect(lShape).toHaveLength(4);
  });
  it('沿格線滑動停在原本那一列', () => {
    const path = walk({ row: 0, col: 0 }, { x: 50, y: 50 }, { x: 50, y: 104 });
    expect(path).toEqual([{ row: 0, col: 0 }]);
    const along = walk({ row: 0, col: 0 }, { x: 50, y: 104 }, { x: 450, y: 104 });
    expect(along.every((p) => p.row === 0)).toBe(true);
  });
  it('穿過格子角落才算斜轉', () => {
    expect(walk({ row: 0, col: 0 }, { x: 50, y: 50 }, { x: 350, y: 350 })).toEqual([
      { row: 0, col: 0 }, { row: 1, col: 1 }, { row: 2, col: 2 }, { row: 3, col: 3 },
    ]);
    const offCorner = walk({ row: 0, col: 0 }, { x: 50, y: 50 }, { x: 150, y: 110 });
    expect(offCorner).toEqual([{ row: 0, col: 0 }, { row: 0, col: 1 }]);
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

import { buffChip, enemyChips, statusChip, teamChips } from '../src/ui/status-labels';
import { storyTitle } from '../src/ui/screens/story';

describe('狀態標籤', () => {
  it('異常狀態顯示名稱與剩餘回合', () => {
    expect(statusChip({ id: 'comboShield', turns: 2, value: 6 }, 'enemy').text).toBe('Combo≥6 2');
    expect(statusChip({ id: 'attributeShield', turns: null, params: { attribute: 'fire' } }, 'enemy').text).toBe('焰減傷');
    expect(statusChip({ id: 'poison', turns: 3 }, 'debuff').detail).toContain('剩 3 回合');
  });
  it('增益與敵人的定身、持續傷害', () => {
    expect(buffChip({ kind: 'reduceDamage', percent: 50, turns: 2 }).text).toBe('減傷50% 2');
    expect(teamChips({ buffs: [{ kind: 'surviveOnce', turns: 1 }], teamStatuses: [{ id: 'skillSeal', turns: 2 }] }).map((c) => c.tone)).toEqual(['buff', 'debuff']);
    const e = { statuses: [], lockedTurns: 2, dots: [{ amount: 500, attribute: 'fire', turns: 3 }] } as never;
    expect(enemyChips(e).map((c) => c.text)).toEqual(['定身 2', '持續傷害 3']);
  });
  it('練習戰的主動技可以施放', () => {
    const b = startBattle(DEMO_STAGE, DEMO_TEAM, DEMO_HELPER, createRng(3), DEMO_DATA);
    for (let t = 0; t < 3; t++) b.submitMove([{ row: 4, col: 0 }, { row: 4, col: 1 }]);
    const r = b.useSkill(0);
    expect(r.ok).toBe(true);
    expect(b.getState().enemies[0].dots.length + (b.getState().enemies[0].hp <= 0 ? 1 : 0)).toBeGreaterThan(0);
  });
});

describe('劇情標題', () => {
  it('劇情 id 轉成回顧標題', () => {
    expect(storyTitle('prologue')).toBe('序章');
    expect(storyTitle('ch2-boss')).toBe('第 2 章・決戰前');
    expect(storyTitle('tower-30')).toBe('挑戰之塔・第 30 層');
    expect(storyTitle('ev-beast-end')).toBe('活動・尾聲');
    expect(storyTitle('ev-beast-2')).toBe('活動・第 2 話');
  });
});
