// --progress 的執行與報表：每關依進度估算各流派的隊伍再模擬
import type { StageDef } from '../../src/core/types';
import { gameData } from '../../src/data/load';
import { createGrowthContext } from '../../src/growth';
import { gameStageData, starterTeams } from './fixtures';
import {
  archetypeFiveStars, buildProgressTeam, describeAssumptions, estimateProgress, progressHelper, type ProgressTeam,
} from './progress';
import { formatReport, simulateMatrix, type CellResult } from './simulate';
import { STRATEGIES } from './strategies';

/** 助戰名單每天輪替；報表固定用這一天，結果才能重現 */
const HELPER_DATE = Date.UTC(2026, 9, 31);

export function runProgress(stages: StageDef[], runs: number, archetypeFilter?: string): void {
  const ctx = createGrowthContext(gameData);
  const pool = gameData.gachaPools.find((p) => !p.period) ?? gameData.gachaPools[0];
  const poolIds = Object.values(pool?.cards ?? {}).flat();
  const teams = starterTeams().filter((t) => !archetypeFilter || t.archetype === archetypeFilter);
  const started = Date.now();

  console.log('# 流派模擬報表：main（--progress，依主線進度估算養成）\n');
  console.log('## 假設\n');
  for (const line of describeAssumptions()) console.log(`- ${line}`);
  console.log('');

  const results: CellResult[] = [];
  const rows: string[] = [];
  const detail: string[] = [];
  for (const stage of stages) {
    const helper = progressHelper(stage, gameData.stages, ctx, HELPER_DATE);
    const built: (ProgressTeam & { archetype: string })[] = [];
    let level = 0;
    let limit = 0;
    for (const t of teams) {
      const leaderAttr = ctx.card(t.members[0].cardId)!.attribute;
      const p = estimateProgress(stage, gameData.stages, ctx, leaderAttr);
      level = p.playerLevel;
      limit = p.teamCostLimit;
      const pt = buildProgressTeam(t.archetype, t.members.map((m) => m.cardId), archetypeFiveStars(t.archetype, poolIds, ctx), p, ctx);
      pt.team.helper = helper;
      built.push({ ...pt, archetype: t.archetype });
      results.push(...simulateMatrix([stage], [pt.team], gameStageData, runs));
    }
    const avg = (f: (b: ProgressTeam) => number) => built.reduce((n, b) => n + f(b), 0) / Math.max(1, built.length);
    const cardLv = avg((b) => b.members.reduce((n, m) => n + m.level, 0) / b.members.length);
    rows.push(`| ${stage.id} | ${level} | ${limit} | ${cardLv.toFixed(1)} | ${avg((b) => b.members.filter((m) => m.evolved).length).toFixed(1)} | ${built.filter((b) => b.members[0].awakened > 0).length}/${built.length} | ${avg((b) => b.fiveStars).toFixed(1)} | ${avg((b) => b.cost).toFixed(1)} | ${helper ? `${ctx.card(helper.cardId)?.name ?? helper.cardId} Lv${helper.level}` : '—'} |`);
    detail.push(`- ${stage.id}：${built.map((b) => `${STRATEGIES[b.archetype as keyof typeof STRATEGIES].name} ${b.cost}/${b.limit}［${b.members.map((m) => `${m.cardId}${m.evolved ? '↑' : ''} Lv${m.level}${m.awakened ? '✦' : ''}`).join('、')}］`).join('；')}`);
  }

  console.log('## 估算的養成程度\n');
  console.log('| 關卡 | 玩家 Lv | 隊伍空間 | 隊員平均 Lv | 進化張數 | 隊長覺醒 | 5★ 張數 | 隊伍 Cost | 助戰 |');
  console.log('|---|---|---|---|---|---|---|---|---|');
  for (const r of rows) console.log(r);
  console.log('\n（各流派平均；↑＝已進化，✦＝隊長已覺醒）\n');
  console.log('<details><summary>各流派隊伍明細</summary>\n');
  for (const d of detail) console.log(d);
  console.log('\n</details>\n');

  console.log(`## 結果（每格 ${runs} 場：勝率／勝場平均回合）\n`);
  console.log(formatReport(results));
  console.log(`\n共 ${results.length * runs} 場，耗時 ${((Date.now() - started) / 1000).toFixed(1)} 秒`);
}
