import { describe, expect, it } from 'vitest';
import gameConfig from '../data/config.json';
import { applyPath, findMatches, type Board, type Pos } from '../src/battle/board';
import { resumeBattle, startBattle, type BattleData, type BattleSnapshot } from '../src/battle/battle-state';
import { attributeSealMultipliers, sealedAttributes } from '../src/battle/skills/status';
import { createRng } from '../src/core/rng';
import type { CardDef, EnemyAbility, EnemyDef, GameConfig, OrbType, StageDef } from '../src/core/types';

// 星紋封印（attributeSeal）與隱藏珠（darkOrbs）在中途續戰的快照與還原

const card = (id: string, attribute: CardDef['attribute']): CardDef => ({
  id, name: id, attribute, race: 'human', rarity: 4, maxLevel: 1,
  stats: { hp: [5000, 5000], atk: [1000, 1000], rcv: [500, 500] }, growthCurve: 1, cost: 5, expValue: 0, sellValue: 0,
  archetypes: [], art: {}, flavor: '',
});

function setup(abilities: EnemyAbility[], seed: number) {
  const enemy: EnemyDef = { id: 'e', name: '測試敵人', attribute: 'light', hp: 10_000_000, atk: 10, def: 0, cd: 99, abilities, art: {} };
  const data: BattleData = { config: gameConfig as GameConfig, cards: [card('a', 'fire'), card('b', 'water')], skills: [], leaderSkills: [], enemies: [enemy] };
  const stage: StageDef = {
    id: 's-mech', kind: 'main', name: '機制', stamina: 0, unlockAfter: null,
    waves: [{ enemies: ['e'] }], rewards: { coin: 0, playerExp: 0 }, drops: [],
  };
  const battle = startBattle(stage, [{ cardId: 'a', level: 1 }, { cardId: 'b', level: 1 }], null, createRng(seed), data);
  return { battle, data, stage };
}

/** 直線拖曳能消除某色的路徑；找不到回傳 null */
function tryMoveFor(board: Board, orb: OrbType): Pos[] | null {
  for (let i = 0; i < board.cells.length; i++) {
    const a = { row: Math.floor(i / board.cols), col: i % board.cols };
    for (const [dr, dc] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
      const path = [a];
      for (let k = 1; ; k++) {
        const p = { row: a.row + dr * k, col: a.col + dc * k };
        if (p.row < 0 || p.col < 0 || p.row >= board.rows || p.col >= board.cols) break;
        path.push(p);
        if (findMatches(applyPath(board, path).board).some((g) => g.orb === orb)) return [...path];
      }
    }
  }
  return null;
}
/** 能消除任何顏色就用，否則原地不動（照樣經過一回合） */
const anyMove = (board: Board): Pos[] => (['water', 'wood', 'light', 'dark', 'heart', 'fire'] as OrbType[]).map((o) => tryMoveFor(board, o)).find(Boolean) ?? [];
/** 模擬寫進存檔再讀回來 */
const viaJson = (s: BattleSnapshot): BattleSnapshot => JSON.parse(JSON.stringify(s));

const abilities: EnemyAbility[] = [
  { status: 'attributeSeal', trigger: 'onStart', turns: 3, params: { attribute: 'fire' } },
  { status: 'darkOrbs', trigger: 'onStart', value: 6, turns: 3 },
];

describe('星紋封印與隱藏珠：中途續戰', () => {
  it('快照存進存檔再讀回：封印與隱藏珠都還在，封印照常生效', () => {
    const { battle, data, stage } = setup(abilities, 7);
    battle.submitMove(anyMove(battle.getState().board));
    const resumed = resumeBattle(stage, viaJson(battle.snapshot()), data);
    const a = battle.getState();
    const b = resumed.getState();
    expect(b.teamStatuses).toEqual(a.teamStatuses);
    expect(b.teamStatuses.find((s) => s.id === 'attributeSeal')).toMatchObject({ turns: a.teamStatuses.find((s) => s.id === 'attributeSeal')!.turns, params: { attribute: 'fire' } });
    expect(sealedAttributes(b)).toEqual(['fire']);
    expect(attributeSealMultipliers(b)).toEqual([0, 1]);
    expect(b.board.cells.map((o) => o.hidden)).toEqual(a.board.cells.map((o) => o.hidden));
    expect(b.board.cells.some((o) => o.hidden)).toBe(true);
  });

  it('還原後接著打：封印的焰隊員仍然不攻擊', () => {
    const seed = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].find((n) => tryMoveFor(setup(abilities, n).battle.getState().board, 'fire'))!;
    const { battle, data, stage } = setup(abilities, seed);
    const resumed = resumeBattle(stage, viaJson(battle.snapshot()), data);
    const r = resumed.submitMove(tryMoveFor(resumed.getState().board, 'fire')!);
    if (!r.ok) throw new Error(r.reason);
    expect(r.summary.groups.some((g) => g.orb === 'fire')).toBe(true);
    expect(r.summary.hits.filter((h) => h.hit.member === 0).reduce((n, h) => n + h.damage, 0)).toBe(0);
  });

  it('還原後每回合結果與沒中斷時完全相同，並在同一回合到期解除與揭開', () => {
    const { battle, data, stage } = setup(abilities, 11);
    battle.submitMove(anyMove(battle.getState().board));
    const resumed = resumeBattle(stage, viaJson(battle.snapshot()), data);
    for (let t = 0; t < 3; t++) {
      const path = anyMove(battle.getState().board);
      expect(resumed.submitMove(path)).toEqual(battle.submitMove(path));
      expect(resumed.getState().board).toEqual(battle.getState().board);
      expect(resumed.getState().teamStatuses).toEqual(battle.getState().teamStatuses);
    }
    expect(resumed.getState().teamStatuses).toEqual([]);
    expect(sealedAttributes(resumed.getState())).toEqual([]);
    expect(resumed.getState().board.cells.filter((o) => o.hidden)).toHaveLength(0);
  });

  it('leader 封印存讀後仍指向隊長屬性', () => {
    const { battle, data, stage } = setup([{ status: 'attributeSeal', trigger: 'onStart', turns: 2, params: { attribute: 'leader' } }], 3);
    const resumed = resumeBattle(stage, viaJson(battle.snapshot()), data);
    expect(sealedAttributes(resumed.getState())).toEqual(['fire']);
  });

  it('沒有這些狀態的舊快照照樣能讀', () => {
    const { battle, data, stage } = setup([], 5);
    const snap = viaJson(battle.snapshot());
    expect(snap.state.teamStatuses).toEqual([]);
    expect(sealedAttributes(resumeBattle(stage, snap, data).getState())).toEqual([]);
  });
});

describe('練習場的機制切換', async () => {
  const { PRACTICE_MODES, isPracticeMode, practiceSetup } = await import('../src/ui/demo');
  it('每個模式都有對應的示範敵人；一般模式是原本的練習場', () => {
    expect(PRACTICE_MODES.map((m) => m.id)).toEqual(['normal', 'darkOrbs', 'attributeSeal']);
    expect(practiceSetup('normal').stage.id).toBe('practice');
    for (const mode of ['darkOrbs', 'attributeSeal'] as const) {
      const { stage, data } = practiceSetup(mode);
      const ids = stage.waves.flatMap((w) => w.enemies);
      const defs = ids.map((id) => data.enemies.find((e) => e.id === id)!);
      expect(defs.every((d) => d.abilities.some((a) => a.status === mode))).toBe(true);
      // 用這份資料真的能開戰，開場就看得到效果
      const b = startBattle(stage, [{ cardId: 'demo-c1', level: 30 }, { cardId: 'demo-c2', level: 30 }], null, createRng(1), data).getState();
      if (mode === 'darkOrbs') expect(b.board.cells.some((o) => o.hidden)).toBe(true);
      else expect(sealedAttributes(b)).toEqual(['fire']);
    }
    expect(isPracticeMode('darkOrbs')).toBe(true);
    expect(isPracticeMode('x')).toBe(false);
  });
});
