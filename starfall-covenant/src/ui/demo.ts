// 「練習戰」用的展示資料：正式卡片與敵人資料完成前，讓戰鬥畫面可以實際操作。
// 名稱標明「示範」，不是正式角色；正式資料由創意顧問提案、總監審核後寫入 data/。
import type { ActiveSkillDef, CardDef, EnemyDef, LeaderSkillDef, StageDef } from '../core/types';
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

export type PracticeMode = 'normal' | 'darkOrbs' | 'attributeSeal';

/** 練習用的機制敵人：正式資料裡的示範敵人（e0046 幕紗星蛾、e0047 封紋司祭，不在任何關卡），生命與攻擊調低方便看效果 */
const MECHANIC_ENEMIES: Record<Exclude<PracticeMode, 'normal'>, string> = { darkOrbs: 'e0046', attributeSeal: 'e0047' };

export const PRACTICE_MODES: { id: PracticeMode; label: string }[] = [
  { id: 'normal', label: '一般' },
  { id: 'darkOrbs', label: '隱藏珠' },
  { id: 'attributeSeal', label: '星紋封印' },
];

export const isPracticeMode = (v: string | undefined): v is PracticeMode => PRACTICE_MODES.some((m) => m.id === v);

/** 練習場的關卡與資料；機制模式換成一隻會放該機制的示範敵人 */
export function practiceSetup(mode: PracticeMode = 'normal'): { stage: StageDef; data: BattleData } {
  const def = mode === 'normal' ? undefined : gameData.enemies.find((e) => e.id === MECHANIC_ENEMIES[mode]);
  if (!def) return { stage: DEMO_STAGE, data: DEMO_DATA };
  return {
    stage: { ...DEMO_STAGE, name: `練習場・${PRACTICE_MODES.find((m) => m.id === mode)!.label}`, waves: [{ enemies: [def.id], boss: true }] },
    data: { ...DEMO_DATA, enemies: [...DEMO_DATA.enemies, { ...def, hp: 60000, atk: 300 }] },
  };
}
