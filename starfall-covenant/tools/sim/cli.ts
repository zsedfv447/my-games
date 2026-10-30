// 用法：npm run sim -- [--set bench|main|daily|event|tower|trial] [--runs 20] [--stage id] [--archetype id] [--team newbie] [--teams starter|veteran] [--json out.json]
//                     [--progress] [--chapter-stages 1,5,9]（--progress 只用於 --set main，見 progress.ts）
// bench＝基準關卡；其他＝data/stages.json 對應種類的關卡（敵人用 data/enemies.json）
// teams：starter＝免抽入門隊（預設）；veteran＝同一批卡進化到最終型態、滿等、覺醒全開
import { writeFileSync } from 'node:fs';
import { gameData } from '../../src/data/load';
import type { StageDef } from '../../src/core/types';
import { benchmarkStages, fixedTeamOf, fixtureData, gameStageData, newbieTeams, starterTeams, veteranTeams } from './fixtures';
import { formatReport, simulateMatrix, type CellResult } from './simulate';
import { runProgress } from './progress-run';

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const set = flag('set') ?? 'bench';
const runs = Number(flag('runs') ?? 20);
const stageFilter = flag('stage');
const archetypeFilter = flag('archetype');
const pool: StageDef[] = set === 'bench' ? benchmarkStages : gameData.stages.filter((s) => s.kind === set);
// --chapter-stages 1,5,9：只跑每章第 1、5、9 關（依關卡 id 的最後一段）
const chapterStages = flag('chapter-stages')?.split(',').map(Number);
const stages = pool.filter((s) => (!stageFilter || s.id === stageFilter)
  && (!chapterStages || chapterStages.includes(Number(s.id.split('-').pop()))));
const data = set === 'bench' ? fixtureData : gameStageData;
const teamSet = flag('teams') ?? 'starter';
const teams = (teamSet === 'veteran' ? veteranTeams() : starterTeams()).filter((t) => !archetypeFilter || t.archetype === archetypeFilter);

const started = Date.now();
let results: CellResult[];
if (args.includes('--progress')) {
  // 依關卡位置估算玩家當時的養成程度，每個流派組出放得下隊伍空間的隊伍
  if (set !== 'main') throw new Error('--progress 只支援 --set main');
  runProgress(stages, runs, archetypeFilter);
  process.exit(0);
} else if (flag('team') === 'newbie') {
  // 新存檔入門隊（Lv1）逐一搭配每個助戰，看新手實際打起來幾回合
  for (const stage of stages) {
    console.log(`## ${stage.id}（每隊 ${runs} 場：勝率／勝場平均回合）\n`);
    for (const team of newbieTeams(stage)) {
      const [r] = simulateMatrix([stage], [team], data, runs);
      console.log(`- ${team.label}：${Math.round(r.winRate * 100)}%／${r.avgTurns?.toFixed(1) ?? '—'} 回合`);
    }
    console.log('');
  }
  process.exit(0);
} else if (set === 'trial') {
  // 流派試煉只用關卡借的隊伍打
  results = stages.flatMap((s) => {
    const team = fixedTeamOf(s);
    return team ? simulateMatrix([s], [team], data, runs) : [];
  });
} else {
  results = simulateMatrix(stages, teams, data, runs);
}
const names = Object.fromEntries(stages.map((s) => [s.id, s.id]));
console.log(`# 流派模擬報表：${set}${teamSet === 'veteran' ? '（老手隊）' : ''}（每格 ${runs} 場：勝率／勝場平均回合）\n`);
console.log(formatReport(results, names));
console.log(`\n共 ${results.length * runs} 場，耗時 ${((Date.now() - started) / 1000).toFixed(1)} 秒`);
const out = flag('json');
if (out) writeFileSync(out, JSON.stringify(results, null, 2));
