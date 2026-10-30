// 練習場機制示範的生命調整用（PRACTICE_MECHANIC_HP）：用簡單的貪心轉珠（找一步能做出最多 Combo 的直線拖曳）模擬，看每回合大約打多少、幾回合打倒
//   npx vite-node tools/practice-sim.ts
import { applyPath, findMatches, type Board, type Pos } from '../src/battle/board';
import { startBattle } from '../src/battle/battle-state';
import { createRng } from '../src/core/rng';
import { DEMO_HELPER, DEMO_TEAM, practiceSetup, type PracticeMode } from '../src/ui/demo';

function greedyMove(board: Board): Pos[] {
  let best: Pos[] = [];
  let bestCombo = 0;
  for (let i = 0; i < board.cells.length; i++) {
    const a = { row: Math.floor(i / board.cols), col: i % board.cols };
    for (const [dr, dc] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
      const path = [a];
      for (let k = 1; k <= 4; k++) {
        const p = { row: a.row + dr * k, col: a.col + dc * k };
        if (p.row < 0 || p.col < 0 || p.row >= board.rows || p.col >= board.cols) break;
        path.push(p);
        const combo = findMatches(applyPath(board, path).board).length;
        if (combo > bestCombo) { bestCombo = combo; best = [...path]; }
      }
    }
  }
  return best;
}

for (const mode of ['darkOrbs', 'attributeSeal'] as PracticeMode[]) {
  const { stage, data } = practiceSetup(mode);
  const enemyId = stage.waves[0].enemies[0];
  const def = data.enemies.find((e) => e.id === enemyId)!;
  const turns: number[] = [];
  const triggers: number[] = [];
  for (let seed = 1; seed <= 40; seed++) {
    const b = startBattle(stage, DEMO_TEAM, DEMO_HELPER, createRng(seed), data);
    let applied = 0;
    b.events.on('statusApplied', (e) => { if (e.status.id === mode) applied++; });
    let t = 0;
    while (b.getState().phase === 'player' && t < 40) { b.submitMove(greedyMove(b.getState().board)); t++; }
    turns.push(t);
    triggers.push(applied + 1); // 開場那次在訂閱前就觸發了
  }
  const avg = (xs: number[]) => (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1);
  console.log(mode, `生命 ${def.hp.toLocaleString()}`, `平均 ${avg(turns)} 回合打倒（最少 ${Math.min(...turns)}）`, `機制觸發平均 ${avg(triggers)} 次（最少 ${Math.min(...triggers)}）`);
}

// 每回合傷害分布（取 90 百分位當作「打得好的一回合」）
for (const mode of ['darkOrbs', 'attributeSeal'] as PracticeMode[]) {
  const { stage, data } = practiceSetup(mode);
  const dmg: number[] = [];
  for (let seed = 1; seed <= 40; seed++) {
    const big = { ...data, enemies: data.enemies.map((e) => ({ ...e, hp: 1e9 })) };
    const b = startBattle(stage, DEMO_TEAM, DEMO_HELPER, createRng(seed), big);
    for (let t = 0; t < 8 && b.getState().phase === 'player'; t++) {
      const r = b.submitMove(greedyMove(b.getState().board));
      if (r.ok) dmg.push(r.summary.hits.reduce((n, h) => n + h.damage, 0));
    }
  }
  dmg.sort((a, b) => a - b);
  const q = (p: number) => dmg[Math.floor((dmg.length - 1) * p)].toLocaleString();
  console.log(mode, `每回合傷害 中位數 ${q(0.5)}、90% ${q(0.9)}、最高 ${q(1)}`);
}
