// 戰術課：戰鬥中收集過關判定需要的紀錄（progression/drills.ts 的 DrillLog）
import type { Battle } from '../battle/battle-state';
import { emptyDrillLog, type DrillLog } from '../progression/drills';

export function trackDrill(battle: Battle): { log: () => DrillLog; dispose: () => void } {
  const log = emptyDrillLog();
  const turns = () => battle.getState().turns;
  const wave = () => battle.getState().wave;
  const offs = [
    battle.events.on('waveStart', (e) => { if (e.wave > 0) log.waveStartTurns[e.wave] = turns(); }),
    battle.events.on('skillUsed', (e) => { log.skills.push({ skillId: e.skillId, wave: wave(), turn: turns() }); }),
    battle.events.on('enemyAttack', (e) => {
      const enemyId = battle.getState().enemies[e.enemy]?.def.id;
      if (enemyId) log.attacks.push({ enemyId, wave: wave(), damage: e.damage });
    }),
    battle.events.on('continued', (e) => { log.continues = e.continues; }),
    battle.events.on('battleEnd', ({ result }) => { log.won = result.outcome === 'win'; }),
  ];
  return { log: () => structuredClone(log), dispose: () => offs.forEach((off) => off()) };
}
