// 用法：npm run sim -- [--set bench|main|daily|event|tower|trial] [--teams starter|veteran] [--runs 20] [--stage id] [--archetype id] [--json out.json]
// bench＝基準關卡；其他＝data/stages.json 對應種類的關卡（敵人用 data/enemies.json）
// teams：starter＝免抽入門隊（預設）；veteran＝同一批卡進化到最終型態、滿等、覺醒全開
import { writeFileSync } from 'node:fs';
import { gameData } from '../../src/data/load';
import type { StageDef } from '../../src/core/types';
import { benchmarkStages, fixedTeamOf, fixtureData, gameStageData, starterTeams, veteranTeams } from './fixtures';
import { formatReport, simulateMatrix, type CellResult } from './simulate';

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
const stages = pool.filter((s) => !stageFilter || s.id === stageFilter);
const data = set === 'bench' ? fixtureData : gameStageData;
const teamSet = flag('teams') ?? 'starter';
const teams = (teamSet === 'veteran' ? veteranTeams() : starterTeams()).filter((t) => !archetypeFilter || t.archetype === archetypeFilter);

const started = Date.now();
let results: CellResult[];
if (set === 'trial') {
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
