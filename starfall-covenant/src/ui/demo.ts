// 「練習戰」用的展示資料：正式卡片與敵人資料完成前，讓戰鬥畫面可以實際操作。
// 名稱標明「示範」，不是正式角色；正式資料由創意顧問提案、總監審核後寫入 data/。
import { ORB_TYPES, type ActiveSkillDef, type CardDef, type EnemyDef, type LeaderSkillDef, type StageDef } from '../core/types';
import { boardFromStrings } from '../battle/board';
import type { Rng } from '../core/rng';
import { DRILLS, DRILL_IDS, isDrillId, type DrillId } from '../progression/drills';
import { scriptedBoardRng } from './tutorial/flow';
import type { BattleData, TeamMemberInput } from '../battle/battle-state';
import { gameData } from '../data/load';

const card = (id: string, name: string, attribute: CardDef['attribute'], race: CardDef['race'], rarity: CardDef['rarity'], atk: number, leader?: string, active?: string): CardDef => ({
  id, name, attribute, race, rarity, maxLevel: 50, activeSkill: active,
  stats: { hp: [600, 1800], atk: [atk * 0.4, atk], rcv: [120, 360] },
  growthCurve: 1, cost: 8, leaderSkill: leader, expValue: 100, sellValue: 100,
  archetypes: [], art: {}, flavor: '練習戰用的示範卡。',
});

const enemy = (id: string, name: string, attribute: EnemyDef['attribute'], hp: number, atk: number, cd: number): EnemyDef => ({
  id, name, attribute, hp, atk, def: 20, cd, abilities: [], art: {},
});

const leader: LeaderSkillDef = {
  id: 'demo-l1', name: '示範誓約', description: '全隊攻擊力 1.5 倍',
  rules: [{ conditions: [{ type: 'always' }], effects: [{ type: 'atkMultiplier', value: 1.5 }] }],
};

const skills: ActiveSkillDef[] = [
  {
    id: 'demo-s1', name: '示範・焰擊', cooldown: { max: 3, min: 2 },
    effects: [
      { type: 'damage', target: 'single', mode: 'multiplier', value: 8 },
      { type: 'damageOverTime', target: 'single', multiplier: 0.5, turns: 3 },
    ],
    description: '對目標造成自身攻擊力 8 倍的傷害，並附加 3 回合持續傷害',
  },
  {
    id: 'demo-s2', name: '示範・潮幕', cooldown: { max: 4, min: 2 },
    effects: [
      { type: 'convertOrbs', from: 'wood', to: 'water' },
      { type: 'reduceDamage', percent: 50, turns: 2 },
    ],
    description: '森紋珠轉為潮紋珠，2 回合內受到的傷害減半',
  },
  {
    id: 'demo-s3', name: '示範・時停', cooldown: { max: 5, min: 3 },
    effects: [{ type: 'delayEnemy', turns: 2 }, { type: 'extendMoveTime', seconds: 2, turns: 2 }],
    description: '敵人攻擊延後 2 回合，2 回合內轉珠時間 +2 秒',
  },
];

export const DEMO_DATA: BattleData = {
  config: gameData.config,
  cards: [
    card('demo-c1', '示範・焰紋見習', 'fire', 'human', 4, 1100, 'demo-l1', 'demo-s1'),
    card('demo-c2', '示範・潮紋見習', 'water', 'sylph', 3, 900, undefined, 'demo-s2'),
    card('demo-c3', '示範・森紋見習', 'wood', 'beast', 3, 900),
    card('demo-c4', '示範・輝紋見習', 'light', 'machina', 3, 900),
    card('demo-c5', '示範・蝕紋見習', 'dark', 'nether', 3, 900, undefined, 'demo-s3'),
    card('demo-c6', '示範・流浪契印師', 'light', 'dragon', 4, 1000, 'demo-l1'),
  ],
  skills,
  leaderSkills: [leader],
  enemies: [
    enemy('demo-e1', '灰燼蟲', 'fire', 3000, 400, 2),
    enemy('demo-e2', '苔背蜥', 'wood', 3600, 350, 3),
    enemy('demo-e3', '潮沫水母', 'water', 4500, 500, 2),
    enemy('demo-e4', '碎光雀', 'light', 4000, 600, 3),
    enemy('demo-e5', '墜域之影', 'dark', 16000, 900, 3),
  ],
};

export const DEMO_STAGE: StageDef = {
  id: 'practice', kind: 'main', name: '練習場', stamina: 0, unlockAfter: null,
  waves: [{ enemies: ['demo-e1', 'demo-e2'] }, { enemies: ['demo-e3', 'demo-e4'] }, { enemies: ['demo-e5'], boss: true }],
  rewards: { coin: 0, playerExp: 0 },
  drops: [],
};

export const DEMO_TEAM: TeamMemberInput[] = ['demo-c1', 'demo-c2', 'demo-c3', 'demo-c4', 'demo-c5'].map((cardId) => ({ cardId, level: 30 }));
export const DEMO_HELPER: TeamMemberInput = { cardId: 'demo-c6', level: 40 };

// ---------- 練習場：敵人機制（隱藏珠、星紋封印） ----------

export type PracticeMode = 'normal' | 'darkOrbs' | 'attributeSeal' | 'percentFollowUp' | 'ringShield' | DrillId;

/** 練習用的機制敵人：正式資料裡的示範敵人（e0046 幕紗星蛾、e0047 封紋司祭，不在任何關卡），生命與攻擊在練習場另外調整 */
const MECHANIC_ENEMIES: Record<Exclude<PracticeMode, 'normal' | 'percentFollowUp' | 'ringShield' | DrillId>, string> = { darkOrbs: 'e0046', attributeSeal: 'e0047' };

/**
 * 機制示範敵人在練習場的生命：開場觸發一次、之後每 3 回合再觸發。
 * tools/practice-sim.ts 模擬示範隊伍：打得好的一回合約 1～3 萬，12 萬生命大約撐 4～12 回合，至少看得到 2～3 次機制。
 */
export const PRACTICE_MECHANIC_HP = 120_000;

export const PRACTICE_MODES: { id: PracticeMode; label: string; description: string }[] = [
  { id: 'normal', label: '一般', description: '三波示範敵人，熟悉轉珠、Combo 與主動技。' },
  { id: 'darkOrbs', label: '隱藏珠', description: '敵人用星幕蓋住部分珠子，看不到顏色但照常消除；每 3 回合再蓋一次。' },
  { id: 'attributeSeal', label: '星紋封印', description: '敵人封印隊長的屬性：被封印的隊員轉珠攻擊無效、不能施放主動技。' },
  { id: 'percentFollowUp', label: '百分比追打', description: '隊長每次轉珠追打 Boss 最大生命 3%（上限 60,000），對上 400 萬生命的巨像。' },
  { id: 'ringShield', label: '七曜環', description: '環心帶著六色的環：用各屬性攻擊、消除心珠點掉格子，全部點掉後環碎、傷害加倍。' },
  // 戰術課：固定開場盤面、一句目標，第一次過關有少量金幣（progression/drills.ts）
  ...DRILLS.map((d) => ({ id: d.id, label: d.label, description: d.goal })),
];

export const isPracticeMode = (v: string | undefined): v is PracticeMode => PRACTICE_MODES.some((m) => m.id === v);

export interface PracticeSetup {
  stage: StageDef;
  data: BattleData;
  /** 戰術課：固定開場盤面的亂數（之後的天降照常隨機） */
  rng?: (fallback: Rng) => Rng;
}

/** 練習場的關卡與資料；機制模式換成一隻會放該機制的示範敵人 */
export function practiceSetup(mode: PracticeMode = 'normal'): PracticeSetup {
  if (isDrillId(mode)) return drillSetup(mode);
  if (mode === 'percentFollowUp') return percentFollowUpPractice();
  if (mode === 'ringShield') return ringShieldPractice();
  const def = mode === 'normal' ? undefined : gameData.enemies.find((e) => e.id === MECHANIC_ENEMIES[mode]);
  if (!def) return { stage: DEMO_STAGE, data: DEMO_DATA };
  return {
    stage: { ...DEMO_STAGE, name: `練習場・${PRACTICE_MODES.find((m) => m.id === mode)!.label}`, waves: [{ enemies: [def.id], boss: true }] },
    data: { ...DEMO_DATA, enemies: [...DEMO_DATA.enemies, { ...def, hp: PRACTICE_MECHANIC_HP, atk: 300 }] },
  };
}

/**
 * 百分比追打示範：隊長技換成「每次轉珠追打目標最大生命 3%（每次最多 60,000）」，
 * 對上 400 萬生命的示範 Boss，看得到固定追打打不動、百分比追打靠上限穩定削血。正式卡片資料不變。
 */
function percentFollowUpPractice(): { stage: StageDef; data: BattleData } {
  const percentLeader: LeaderSkillDef = {
    id: 'demo-l-pct', name: '示範・星骸裂斬', description: '每次轉珠追打目標最大生命 3% 的傷害（每次最多 60,000，無視防禦）',
    rules: [{ conditions: [{ type: 'always' }], effects: [{ type: 'followUpDamage', mode: 'percentMaxHp', value: 3, cap: 60000 }] }],
  };
  const titan: EnemyDef = { ...enemy('demo-titan', '示範・百萬星骸巨像', 'light', 4_000_000, 300, 4), def: 1500 };
  return {
    stage: { ...DEMO_STAGE, name: '練習場・百分比追打', waves: [{ enemies: [titan.id], boss: true }] },
    data: {
      ...DEMO_DATA,
      cards: DEMO_DATA.cards.map((c) => (c.id === 'demo-c1' ? { ...c, leaderSkill: percentLeader.id } : c)),
      leaderSkills: [...DEMO_DATA.leaderSkills, percentLeader],
      enemies: [...DEMO_DATA.enemies, titan],
    },
  };
}

/**
 * 七曜環示範（第 7 章「環心」的機制）：示範敵人開場帶六色環（減傷 75%），全部點掉後易傷 ×2。
 * 只在練習場使用，不在任何正式關卡。示範隊伍五屬齊全，正好練「七彩齊攻」。
 */
function ringShieldPractice(): { stage: StageDef; data: BattleData } {
  const core: EnemyDef = {
    ...enemy('demo-ring', '示範・環心之影', 'light', 150_000, 300, 3),
    abilities: [{ status: 'ringShield', trigger: 'onStart', value: 75, params: { slots: 'fire,water,wood,light,dark,heart', vulnerable: 2 } }],
  };
  return {
    stage: { ...DEMO_STAGE, name: '練習場・七曜環', waves: [{ enemies: [core.id], boss: true }] },
    data: { ...DEMO_DATA, enemies: [...DEMO_DATA.enemies, core] },
  };
}


// ---------- 戰術課 ----------

/** 戰術課用的固定開場盤面（f 焰 w 潮 g 森 l 輝 d 蝕 h 心），開場不會直接消除 */
export const DRILL_BOARDS: Record<DrillId, string[]> = {
  'drill-reserve': ['fwghld', 'hdlfwg', 'glhdfw', 'whfgdl', 'dgwlhf'],
  'drill-hearts': ['hwghld', 'hdlhwg', 'glhdfh', 'whfgdl', 'dhwlhf'],
  'drill-convert': ['gwgdgl', 'hgwgld', 'gdgwgh', 'lgdglw', 'gwlgdg'],
  'drill-threat': ['fwghld', 'hdlfwg', 'glhdfw', 'whfgdl', 'dgwlhf'],
};

/** 大招的傷害約是示範隊伍生命上限的 85%：生命不滿就撐不住 */
export const DRILL_CHARGER_ATK = 6800;

function drillSetup(mode: DrillId): PracticeSetup {
  const def = DRILLS.find((d) => d.id === mode)!;
  const board = boardFromStrings(DRILL_BOARDS[def.id]);
  const rng = (fallback: Rng) => scriptedBoardRng(board, ORB_TYPES, fallback);
  const stage = (waves: StageDef['waves']): StageDef => ({ ...DEMO_STAGE, name: `練習場・${def.label.replace('戰術課・', '')}`, waves });
  switch (def.id) {
    case 'drill-reserve': {
      // 小怪一下就打倒了，要留著它（只消心珠等等）讓焰擊充能
      const imp = { ...enemy('drill-imp', '示範・慢吞吞的灰燼蟲', 'fire', 2500, 80, 3), def: 0 };
      const boss = enemy('drill-boss', '示範・墜域之影', 'dark', 60000, 500, 4);
      return { stage: stage([{ enemies: [imp.id] }, { enemies: [boss.id], boss: true }]), data: { ...DEMO_DATA, enemies: [...DEMO_DATA.enemies, imp, boss] }, rng };
    }
    case 'drill-hearts': {
      const minion = enemy('drill-minion', '示範・碎光雀', 'light', 12000, 1200, 1);
      const charger = enemy(DRILL_IDS.charger, '示範・蓄力之影', 'dark', 90000, DRILL_CHARGER_ATK, 3);
      return { stage: stage([{ enemies: [minion.id, charger.id], boss: true }]), data: { ...DEMO_DATA, enemies: [...DEMO_DATA.enemies, minion, charger] }, rng };
    }
    case 'drill-convert': {
      // 開場兩個技能都已充能：引火（森 → 焰）、淬火（強化焰珠）
      const charged: LeaderSkillDef = {
        id: 'drill-l-charged', name: '示範・備戰', description: '開場全員技能冷卻已滿；全隊攻擊力 1.5 倍',
        rules: [{ conditions: [{ type: 'always' }], effects: [{ type: 'skillCooldownStart', charged: true }, { type: 'atkMultiplier', value: 1.5 }] }],
      };
      const drillSkills: ActiveSkillDef[] = [
        { id: DRILL_IDS.convert, name: '示範・引火', cooldown: { max: 8, min: 8 }, effects: [{ type: 'convertOrbs', from: 'wood', to: 'fire' }], description: '森珠轉為焰珠' },
        { id: DRILL_IDS.enhance, name: '示範・淬火', cooldown: { max: 8, min: 8 }, effects: [{ type: 'enhanceOrbs', orbs: 'fire' }], description: '強化全部焰珠' },
      ];
      const boss = enemy('drill-tree', '示範・枯木巨像', 'wood', 45000, 300, 5);
      return {
        stage: stage([{ enemies: [boss.id], boss: true }]),
        data: {
          ...DEMO_DATA,
          cards: DEMO_DATA.cards.map((c) => (c.id === 'demo-c1' ? { ...c, leaderSkill: charged.id }
            : c.id === 'demo-c3' ? { ...c, activeSkill: DRILL_IDS.convert }
              : c.id === 'demo-c4' ? { ...c, activeSkill: DRILL_IDS.enhance } : c)),
          skills: [...DEMO_DATA.skills, ...drillSkills],
          leaderSkills: [...DEMO_DATA.leaderSkills, charged],
          enemies: [...DEMO_DATA.enemies, boss],
        },
        rng,
      };
    }
    case 'drill-threat': {
      // 預設目標是左邊的大個子；刺客要手動點選
      const tank = enemy('drill-tank', '示範・苔背巨蜥', 'water', 30000, 500, 6);
      const assassin = { ...enemy(DRILL_IDS.assassin, '示範・夜爪刺客', 'dark', 6000, 4500, 2), def: 0 };
      return { stage: stage([{ enemies: [tank.id, assassin.id] }]), data: { ...DEMO_DATA, enemies: [...DEMO_DATA.enemies, tank, assassin] }, rng };
    }
  }
}
