// 用法：npm run sim -- [--runs 20] [--stage sim-normal] [--archetype combo] [--json out.json]
import { writeFileSync } from 'node:fs';
import { benchmarkStages, fixtureData, starterTeams } from './fixtures';
import { formatReport, simulateMatrix } from './simulate';

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const runs = Number(flag('runs') ?? 20);
const stageFilter = flag('stage');
const archetypeFilter = flag('archetype');
const stages = benchmarkStages.filter((s) => !stageFilter || s.id === stageFilter);
const teams = starterTeams().filter((t) => !archetypeFilter || t.archetype === archetypeFilter);

const started = Date.now();
const results = simulateMatrix(stages, teams, fixtureData, runs);
const names = Object.fromEntries(stages.map((s) => [s.id, s.name]));
console.log(`# 流派模擬報表（每格 ${runs} 場：勝率／勝場平均回合）\n`);
console.log(formatReport(results, names));
console.log(`\n共 ${results.length * runs} 場，耗時 ${((Date.now() - started) / 1000).toFixed(1)} 秒`);
const out = flag('json');
if (out) writeFileSync(out, JSON.stringify(results, null, 2));
