import { describe, expect, it } from 'vitest';
import { createRng } from '../src/core/rng';
import gameConfig from '../data/config.json';
import {
  applyInterference,
  applyPath,
  balanceBoard,
  boardFromStrings,
  boardToStrings,
  convertOrbs,
  countOrbs,
  createBoard,
  dropAndFill,
  enhanceOrbs,
  findMatches,
  resolveBoard,
  rollOrbType,
} from '../src/battle/board';

describe('createBoard', () => {
  it('依 config 決定盤面大小，且開場沒有可消除的組', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const board = createBoard(gameConfig.board, createRng(seed));
      expect(board.cols).toBe(gameConfig.board.cols);
      expect(board.rows).toBe(gameConfig.board.rows);
      expect(board.cells).toHaveLength(gameConfig.board.cols * gameConfig.board.rows);
      expect(findMatches(board)).toEqual([]);
    }
  });

  it('支援隊長技改變盤面大小（7×6）', () => {
    const board = createBoard({ cols: 7, rows: 6 }, createRng(3));
    expect(board.cells).toHaveLength(42);
    expect(findMatches(board)).toEqual([]);
  });

  it('相同種子產生相同盤面', () => {
    expect(boardToStrings(createBoard(gameConfig.board, createRng(9)))).toEqual(
      boardToStrings(createBoard(gameConfig.board, createRng(9))),
    );
  });
});

describe('findMatches', () => {
  it('橫直 3 顆以上消除，L 形相連同色算同一組', () => {
    const board = boardFromStrings([
      'fffwgl',
      'fwdlgh',
      'fdwlgh',
      'whdwhd',
      'dlwhdl',
    ]);
    const groups = findMatches(board);
    expect(groups.map((g) => [g.orb, g.cells.length])).toEqual([
      ['fire', 5],
      ['wood', 3],
    ]);
  });

  it('十字形算 1 組；同色但不相連算 2 組', () => {
    const board = boardFromStrings([
      'wfwhhh',
      'fffdld',
      'wfwlwl',
      'dldlwd',
      'lhhhwl',
    ]);
    const groups = findMatches(board);
    expect(groups.map((g) => [g.orb, g.cells.length])).toEqual([
      ['fire', 5],
      ['heart', 3],
      ['water', 3],
      ['heart', 3],
    ]);
  });

  it('只是相鄰但沒有 3 連的同色珠不會被併入', () => {
    const board = boardFromStrings([
      'fffw',
      'fwdl',
      'lwdl',
    ]);
    const groups = findMatches(board);
    expect(groups).toHaveLength(1);
    // 下方第 2 列的 f 與 3 連相鄰，但它本身不在任何 3 連裡
    expect(groups[0].cells).toEqual([0, 1, 2]);
  });

  it('計算強化珠數量', () => {
    const board = boardFromStrings(['FfFw', 'wlwl', 'lwlw']);
    expect(findMatches(board)[0].enhancedCount).toBe(2);
  });
});

describe('applyPath', () => {
  const board = boardFromStrings([
    'fwgl',
    'dhfw',
    'glhd',
  ]);

  it('手上的珠沿路徑與經過的珠交換，可斜向', () => {
    const result = applyPath(board, [
      { row: 0, col: 0 },
      { row: 1, col: 1 },
      { row: 1, col: 2 },
    ]);
    expect(result.completed).toBe(true);
    expect(boardToStrings(result.board)).toEqual(['hwgl', 'dffw', 'glhd']);
  });

  it('不相鄰的步驟會中止', () => {
    const result = applyPath(board, [
      { row: 0, col: 0 },
      { row: 2, col: 2 },
    ]);
    expect(result.completed).toBe(false);
    expect(boardToStrings(result.board)).toEqual(boardToStrings(board));
  });

  it('封鎖珠無法經過，路徑停在前一格', () => {
    const locked = boardFromStrings(['fwgl', 'dhfw', 'glhd']);
    locked.cells[5].locked = true;
    const result = applyPath(locked, [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 1, col: 1 },
    ]);
    expect(result.completed).toBe(false);
    expect(result.path).toHaveLength(2);
    expect(boardToStrings(result.board)[0]).toBe('wfgl');
  });
});

describe('resolveBoard', () => {
  it('落下連鎖也計入 Combo，結算後盤面沒有可消除的組', () => {
    const board = boardFromStrings([
      'wgldhf',
      'gwhlfd',
      'wlllgh',
      'gwhdfw',
      'hhgfff',
    ]);
    for (let seed = 1; seed <= 20; seed++) {
      const result = resolveBoard(board, createRng(seed));
      expect(result.combo).toBeGreaterThanOrEqual(2);
      expect(result.groups.filter((g) => g.cascade === 0)).toHaveLength(2);
      expect(findMatches(result.board)).toEqual([]);
    }
  });

  it('落下時保留原本的珠，只從上方補新珠', () => {
    const board = boardFromStrings([
      'wgl',
      'ghd',
      'fff',
    ]);
    const next = dropAndFill(board, [6, 7, 8], createRng(1));
    expect(boardToStrings(next).slice(1)).toEqual(['wgl', 'ghd']);
  });

  it('天降不消除時，新補的珠不會自己組成消除', () => {
    const board = boardFromStrings([
      'fff',
      'fff',
      'fff',
    ]);
    for (let seed = 1; seed <= 30; seed++) {
      const next = dropAndFill(board, board.cells.map((_, i) => i), createRng(seed), { skyfallCombo: false });
      expect(findMatches(next)).toEqual([]);
    }
  });
});

describe('天降與盤面操作', () => {
  it('指定天降機率', () => {
    const rng = createRng(5);
    let hearts = 0;
    for (let i = 0; i < 5000; i++) if (rollOrbType(rng, { heart: 0.5 }) === 'heart') hearts++;
    expect(hearts / 5000).toBeGreaterThan(0.45);
    expect(hearts / 5000).toBeLessThan(0.55);
  });

  it('轉珠與強化珠', () => {
    const board = boardFromStrings(['fwgl', 'dhfw']);
    const converted = convertOrbs(board, ['water', 'wood'], 'fire');
    expect(countOrbs(converted).fire).toBe(5);
    const enhanced = enhanceOrbs(converted, 'fire');
    expect(enhanced.cells.filter((o) => o.enhanced)).toHaveLength(5);
  });

  it('盤面平均：六種珠各 5 顆', () => {
    const board = balanceBoard(createBoard(gameConfig.board, createRng(1)), createRng(2));
    expect(Object.values(countOrbs(board))).toEqual([5, 5, 5, 5, 5, 5]);
  });

  it('干擾珠', () => {
    const board = applyInterference(createBoard(gameConfig.board, createRng(1)), createRng(2), 'poison', 4);
    expect(board.cells.filter((o) => o.poison)).toHaveLength(4);
  });
});

describe('逐段結算（給介面播放）', () => {
  const board = boardFromStrings([
    'wgldhf',
    'gwhlfd',
    'wlllgh',
    'gwhdfw',
    'hhgfff',
  ]);

  it('每一段的 after 是下一段的 before，最後一段的 after 是最終盤面', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const r = resolveBoard(board, createRng(seed));
      expect(r.steps.length).toBeGreaterThanOrEqual(1);
      expect(r.steps[0].before).toBe(board);
      r.steps.forEach((s, i) => {
        expect(s.cascade).toBe(i);
        if (i > 0) expect(s.before).toBe(r.steps[i - 1].after);
      });
      expect(r.steps[r.steps.length - 1].after).toBe(r.board);
      expect(r.steps.flatMap((s) => s.groups)).toEqual(r.groups);
    }
  });

  it('drops 描述每顆珠從哪裡落到哪裡', () => {
    const r = resolveBoard(board, createRng(1));
    for (const step of r.steps) {
      const { cols } = step.before;
      const cleared = new Set(step.groups.flatMap((g) => g.cells));
      const moved = new Set(step.drops.map((d) => d.to * cols + d.col));
      for (const d of step.drops) {
        if (d.isNew) {
          expect(d.from).toBeLessThan(0);
          continue;
        }
        expect(cleared.has(d.from * cols + d.col)).toBe(false);
        expect(step.after.cells[d.to * cols + d.col]).toEqual(step.before.cells[d.from * cols + d.col]);
      }
      // 沒列在 drops 的格子原地不動
      step.after.cells.forEach((o, i) => {
        if (!moved.has(i)) expect(o).toEqual(step.before.cells[i]);
      });
      // 新珠數量 = 消除數量
      expect(step.drops.filter((d) => d.isNew)).toHaveLength(cleared.size);
    }
  });

  it('沒有消除時沒有任何一段', () => {
    expect(resolveBoard(boardFromStrings(['fwg', 'wgf', 'gfw']), createRng(1)).steps).toEqual([]);
  });
});
