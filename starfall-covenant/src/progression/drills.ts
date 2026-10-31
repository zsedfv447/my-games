// 練習場「戰術課」：每課一個目標，教的是策略（留敵存技能、留心珠撐大招、先轉色再強化、先處理快出手的敵人），
// 不是高 Combo。這裡只放過關判定與一次性獎勵（純函式）；盤面、隊伍與敵人在 ui/demo.ts。
// 領獎紀錄記在 save.quests.counters 的「drill:課程 id」（不會被每日／每週重置清掉），不需要新的存檔欄位。
import type { SaveData } from '../core/types';

/** 戰鬥中收集的紀錄，交給過關判定 */
export interface DrillLog {
  won: boolean;
  continues: number;
  /** 每一波開始時已經轉過幾次珠（第 0 波是 0） */
  waveStartTurns: number[];
  /** 依施放順序：主動技 id、當時第幾波、已經轉過幾次珠 */
  skills: { skillId: string; wave: number; turn: number }[];
  /** 敵人出手：敵人 id、第幾波、傷害 */
  attacks: { enemyId: string; wave: number; damage: number }[];
}

export const emptyDrillLog = (): DrillLog => ({ won: false, continues: 0, waveStartTurns: [0], skills: [], attacks: [] });

export type DrillId = 'drill-reserve' | 'drill-hearts' | 'drill-convert' | 'drill-threat';

/** 戰術課用到的技能與敵人 id（ui/demo.ts 的示範資料用同一組 id） */
export const DRILL_IDS = {
  fireStrike: 'demo-s1',
  convert: 'drill-s-convert',
  enhance: 'drill-s-enhance',
  charger: 'drill-charger',
  assassin: 'drill-assassin',
} as const;

export interface DrillDef {
  id: DrillId;
  label: string;
  /** 一句目標，開場與結算都顯示 */
  goal: string;
  /** 過關的一次性金幣 */
  coin: number;
  passed: (log: DrillLog) => boolean;
}

export const DRILLS: DrillDef[] = [
  {
    id: 'drill-reserve',
    label: '戰術課・留敵存技能',
    goal: '第 1 波先留著小怪，等焰紋見習的「焰擊」充能；Boss 出場的第一回合就施放焰擊，再打倒 Boss。',
    coin: 300,
    passed: (log) => {
      const boss = log.waveStartTurns.length - 1;
      return log.won && boss > 0
        && log.skills.some((s) => s.skillId === DRILL_IDS.fireStrike && s.wave === boss && s.turn === log.waveStartTurns[boss]);
    },
  },
  {
    id: 'drill-hearts',
    label: '戰術課・留心珠撐大招',
    goal: '蓄力之影每 3 回合放一次大招，生命不滿就撐不住。先留著心珠，在大招前把生命補滿，不續戰撐過去並獲勝。',
    coin: 300,
    passed: (log) => log.won && log.continues === 0 && log.attacks.some((a) => a.enemyId === DRILL_IDS.charger),
  },
  {
    id: 'drill-convert',
    label: '戰術課・先轉色再強化',
    goal: '同一回合先用「引火」把森珠轉成焰珠，再用「淬火」強化全部焰珠，最後轉珠打倒森屬性的 Boss。順序反了強化會浪費。',
    coin: 300,
    passed: (log) => {
      if (!log.won) return false;
      return log.skills.some((c, i) => c.skillId === DRILL_IDS.convert
        && log.skills.slice(i + 1).some((e) => e.skillId === DRILL_IDS.enhance && e.turn === c.turn && e.wave === c.wave));
    },
  },
  {
    id: 'drill-threat',
    label: '戰術課・先打快出手的敵人',
    goal: '刺客 2 回合後就會出手，傷害很高。點一下刺客設為目標，在它出手前打倒它，再收拾大個子。',
    coin: 300,
    passed: (log) => log.won && !log.attacks.some((a) => a.enemyId === DRILL_IDS.assassin),
  },
];

export const drillById = (id: string): DrillDef | undefined => DRILLS.find((d) => d.id === id);
export const isDrillId = (id: string | undefined): id is DrillId => DRILLS.some((d) => d.id === id);

const claimKey = (id: DrillId) => `drill:${id}`;
export const drillRewardClaimed = (save: SaveData, id: DrillId): boolean => (save.quests.counters[claimKey(id)] ?? 0) > 0;

/** 過關結算：第一次過關給金幣並記下；之後過關不再給 */
export function settleDrill(save: SaveData, id: DrillId, log: DrillLog): { save: SaveData; passed: boolean; coin: number } {
  const def = drillById(id);
  if (!def || !def.passed(log)) return { save, passed: false, coin: 0 };
  if (drillRewardClaimed(save, id)) return { save, passed: true, coin: 0 };
  return {
    save: {
      ...save,
      player: { ...save.player, coin: save.player.coin + def.coin },
      quests: { ...save.quests, counters: { ...save.quests.counters, [claimKey(id)]: 1 } },
    },
    passed: true,
    coin: def.coin,
  };
}
