// 養成測試用的小型資料集（正式 cards.json 由創意顧問填寫中，測試不依賴它）
import type { CardDef, OwnedCard, SaveData } from '../../src/core/types';
import { gameData } from '../../src/data/load';
import { createGrowthContext, type GrowthData } from '../../src/growth';

const card = (c: Partial<CardDef> & Pick<CardDef, 'id' | 'attribute' | 'rarity'>): CardDef => ({
  name: c.id,
  race: 'human',
  maxLevel: 50,
  stats: { hp: [1000, 3000], atk: [300, 900], rcv: [100, 300] },
  growthCurve: 1,
  cost: 10,
  expValue: 100,
  sellValue: 200,
  archetypes: [],
  art: {},
  flavor: '',
  ...c,
});

export const cards: CardDef[] = [
  // 焰 5★ → 6★：背水隊長＋長串核心，有主動技與 3 個覺醒
  card({
    id: 'c102', attribute: 'fire', rarity: 5, race: 'dragon', maxLevel: 90, activeSkill: 's1', leaderSkill: 'l-berserk',
    evolution: { to: 'c103', materials: ['c905', 'c905', 'c915'], coin: 50000 },
    awakenings: [
      { type: 'orbDamageUp', orb: 'fire', percent: 5 },
      { type: 'statUp', stat: 'atk', value: 100 },
      { type: 'moveTimeUp', seconds: 0.5 },
    ],
    archetypes: [{ id: 'berserk', role: 'leader' }, { id: 'chain', role: 'core' }],
  }),
  card({
    id: 'c103', attribute: 'fire', rarity: 6, race: 'dragon', maxLevel: 99, activeSkill: 's1b', leaderSkill: 'l-berserk',
    awakenings: [{ type: 'orbDamageUp', orb: 'fire', percent: 8 }, { type: 'statUp', stat: 'hp', value: 500 }],
    archetypes: [{ id: 'berserk', role: 'leader' }, { id: 'chain', role: 'core' }],
  }),
  // 焰 4★ 免抽單屬隊長
  card({ id: 'c106', attribute: 'fire', rarity: 4, leaderSkill: 'l-mono-fire', archetypes: [{ id: 'mono', role: 'leader' }] }),
  // 焰 4★ 長串核心
  card({ id: 'c107', attribute: 'fire', rarity: 4, activeSkill: 's2', archetypes: [{ id: 'chain', role: 'core' }] }),
  // 焰 4★ 延遲輔助（通用）
  card({ id: 'c108', attribute: 'fire', rarity: 4, archetypes: [{ id: 'control', role: 'support' }] }),
  // 潮 4★ 連擊隊長
  card({ id: 'c206', attribute: 'water', rarity: 4, archetypes: [{ id: 'combo', role: 'leader' }] }),
  // 潮 4★ 連擊核心
  card({ id: 'c211', attribute: 'water', rarity: 4, archetypes: [{ id: 'combo', role: 'core' }] }),
  // 素材
  card({ id: 'c905', attribute: 'fire', rarity: 3, race: 'material', maxLevel: 1, expValue: 1000, sellValue: 50 }),
  card({ id: 'c906', attribute: 'water', rarity: 3, race: 'material', maxLevel: 1, expValue: 1000, sellValue: 50 }),
  card({ id: 'c915', attribute: 'fire', rarity: 4, race: 'material', maxLevel: 1, expValue: 300, sellValue: 100 }),
  card({ id: 'c916', name: '焰星核', attribute: 'fire', rarity: 4, race: 'material', maxLevel: 1, expValue: 300, sellValue: 100 }),
];

export const data: GrowthData = {
  config: gameData.config,
  archetypes: gameData.archetypes,
  cards,
  skills: [
    { id: 's1', name: '技', cooldown: { max: 10, min: 6 }, effects: [], description: '' },
    { id: 's1b', name: '技', cooldown: { max: 8, min: 6 }, effects: [], description: '' },
    { id: 's2', name: '技', cooldown: { max: 5, min: 5 }, effects: [], description: '' },
  ],
  leaderSkills: [
    {
      id: 'l-mono-fire', name: '焰', description: '',
      rules: [{ conditions: [{ type: 'always' }], effects: [{ type: 'atkMultiplier', target: { attribute: 'fire' }, value: 3 }] }],
    },
    {
      id: 'l-berserk', name: '背水', description: '',
      rules: [{ conditions: [{ type: 'hpBelow', percent: 30 }], effects: [{ type: 'atkMultiplier', value: 5 }] }],
    },
  ],
  stages: [{
    id: 'st-1-1', kind: 'main', name: '關', stamina: 3, unlockAfter: null, waves: [{ enemies: [] }],
    rewards: { coin: 0, playerExp: 0, firstClear: { cards: [{ card: 'c108', count: 1 }] } },
    drops: [{ card: 'c106', rate: 0.2 }, { card: 'c905', rate: 0.5 }],
  }],
  shop: [],
  quests: [],
  gachaPools: [{
    id: 'pool', name: '池', cost: { gems: 5 }, rates: { 5: 0.1, 4: 0.9 }, pity: { rarity: 5, after: 80 },
    tenPullGuarantee: { minRarity: 4 }, cards: { 5: ['c102'], 4: ['c107', 'c206', 'c211'] }, period: null,
  }],
};

export const ctx = createGrowthContext(data);

export function owned(uid: string, cardId: string, extra: Partial<OwnedCard> = {}): OwnedCard {
  return { uid, cardId, level: 1, exp: 0, skillLevel: 1, limitBreak: 0, awakened: 0, locked: false, obtainedAt: 0, ...extra };
}

export function makeSave(cards: OwnedCard[] = [], player: Partial<SaveData['player']> = {}): SaveData {
  return {
    version: 1,
    player: { name: '契印師', level: 1, exp: 0, coin: 1_000_000, gems: 100, tokens: {}, ...player },
    stamina: { current: 30, lastUpdate: 0 },
    inventory: { capacity: 50, cards },
    teams: [{ name: '隊伍1', members: [null, null, null, null, null] }],
    activeTeam: 0,
    progress: { clearedStages: [], stars: {}, towerFloor: 0, tutorialDone: false, storySeen: [] },
    gacha: { pityCounter: {}, history: [] },
    collection: { seen: [], owned: cards.map((c) => c.cardId), claimed: [] },
    quests: { counters: {}, claimed: [], dailyResetAt: '', weeklyResetAt: '' },
    daily: { loginDay: 1, lastLogin: '', shopPurchases: {} },
    settings: { bgm: 0.8, sfx: 0.8, battleSpeed: 1 },
  };
}
