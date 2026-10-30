// 預覽每日謎題：npx vite-node tools/puzzle-preview.ts [天數]
import { boardToStrings } from '../src/battle/board';
import { dailyPuzzle, judgePuzzle } from '../src/progression/puzzle';
import { dateKey } from '../src/progression/time';

const days = Number(process.argv[2] ?? 10);
const t0 = performance.now();
const kinds: Record<string, number> = {};
for (let i = 0; i < days; i++) {
  const day = dateKey(new Date(2026, 10, 1 + i, 12).getTime());
  const p = dailyPuzzle(day);
  kinds[p.goal.kind] = (kinds[p.goal.kind] ?? 0) + 1;
  const j = judgePuzzle(p, p.solution);
  console.log(day, JSON.stringify(p.goal), `步數上限 ${p.maxSteps}`, `參考解 ${p.solution.length - 1} 步`, j.solved ? '可解' : '無解！');
  if (i === 0) console.log(boardToStrings(p.board).join('\n'));
}
console.log(kinds, `平均 ${((performance.now() - t0) / days).toFixed(1)} ms/題`);
