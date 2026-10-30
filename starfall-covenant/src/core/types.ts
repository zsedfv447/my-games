// 《星骸契約》共用型別。所有模組只透過這裡的型別與 data/*.json 溝通。
// 修改本檔需經總監審核。
import type { BattleSnapshot, TeamMemberInput } from '../battle/battle-state';
import type { DropPlan } from '../progression/drops';

// ---------- 基本列舉 ----------
export const ATTRIBUTES = ['fire', 'water', 'wood', 'light', 'dark'] as const;
export type Attribute = (typeof ATTRIBUTES)[number];

export const ORB_TYPES = [...ATTRIBUTES, 'heart'] as const;
export type OrbType = (typeof ORB_TYPES)[number];

export const RACES = ['beast', 'dragon', 'machina', 'sylph', 'nether', 'human', 'material'] as const;
export type Race = (typeof RACES)[number];

export const ARCHETYPE_IDS = [
  'mono', 'rainbow', 'combo', 'chain', 'heart', 'race',
  'enhance', 'control', 'berserk', 'dual', 'skillcycle', 'fixed',
] as const;
export type ArchetypeId = (typeof ARCHETYPE_IDS)[number];
export type ArchetypeRole = 'leader' | 'core' | 'support';

export type Rarity = 1 | 2 | 3 | 4 | 5 | 6;

/** 效果與條件的「目標篩選」：不填的欄位代表不限 */
export interface UnitFilter {
  attribute?: Attribute | Attribute[];
  race?: Race | Race[];
}

// ---------- 卡片 ----------
export interface StatRange {
  /** [Lv1, LvMax] */
  hp: [number, number];
  atk: [number, number];
  rcv: [number, number];
}

export interface CardDef {
  id: string;
  name: string;
  attribute: Attribute;
  race: Race;
  rarity: Rarity;
  maxLevel: number;
  stats: StatRange;
  growthCurve: number;
  cost: number;
  activeSkill?: string;
  leaderSkill?: string;
  /** 星紋覺醒被動，依序解鎖 */
  awakenings?: PassiveEffect[];
  evolution?: { to: string; materials: string[]; coin: number };
  expValue: number;
  sellValue: number;
  archetypes: { id: ArchetypeId; role: ArchetypeRole }[];
  art: { portrait?: string; icon?: string };
  flavor: string;
  /** 角色台詞（選填）；victory 是結算時的隊長勝利台詞，沒有就用屬性預設句 */
  lines?: { victory?: string };
}

// ---------- 主動技效果積木 ----------
export type OrbSource = OrbType | OrbType[] | 'all';

export type SkillEffect =
  | { type: 'convertOrbs'; from: OrbSource; to: OrbType }
  | { type: 'refreshBoard' }
  | { type: 'balanceBoard' }
  | { type: 'enhanceOrbs'; orbs: OrbSource }
  | { type: 'setSkyfallRate'; orb: OrbType; rate: number; turns: number }
  | {
      type: 'damage';
      target: 'single' | 'all';
      /** mode=multiplier 時 value 為自身攻擊倍率；mode=fixed 時為固定數值 */
      mode: 'multiplier' | 'fixed';
      value: number;
      attribute?: Attribute;
      ignoreDefense?: boolean;
      ignoreShield?: boolean;
    }
  | { type: 'damageOverTime'; target: 'single' | 'all'; multiplier: number; turns: number }
  | { type: 'heal'; mode: 'rcvMultiplier' | 'percentMaxHp'; value: number }
  | { type: 'selfDamage'; percentCurrentHp: number }
  | { type: 'surviveOnce'; turns: number }
  | { type: 'buffAttack'; target?: UnitFilter; multiplier: number; turns: number }
  | { type: 'rcvToAtk'; ratio: number; turns: number }
  | { type: 'reduceDamage'; percent: number; turns: number }
  | { type: 'delayEnemy'; turns: number }
  | { type: 'lockEnemy'; turns: number }
  | { type: 'extendMoveTime'; seconds: number; turns: number }
  | { type: 'noSkyfallCombo'; turns: number }
  | { type: 'reduceAllyCooldown'; turns: number }
  | { type: 'chainOnSkill'; multiplier: number; turns: number }
  | { type: 'cleanse' }
  /** 盤面上缺少的屬性（五屬，不含心）各補 count 顆（提案 001，用於七彩齊攻） */
  | { type: 'fillMissingOrbs'; count: number }
  /** turns 回合內天降珠為強化珠的機率（0–1）（提案 001，用於強化珠增幅） */
  | { type: 'setEnhancedSkyfallRate'; rate: number; turns: number };

export interface ActiveSkillDef {
  id: string;
  name: string;
  cooldown: { max: number; min: number };
  effects: SkillEffect[];
  description: string;
}

// ---------- 隊長技 ----------
export type LeaderCondition =
  | { type: 'always' }
  | { type: 'comboAtLeast'; combo: number }
  | { type: 'attributesMatched'; count: number; attributes?: OrbType[] }
  | { type: 'orbsInOneMatch'; orb?: OrbType; count: number }
  | { type: 'heartsMatched'; count: number }
  | { type: 'enhancedOrbsMatched'; count: number }
  | { type: 'hpBelow'; percent: number }
  | { type: 'hpAbove'; percent: number }
  | { type: 'teamAll'; filter: UnitFilter }
  | { type: 'skillUsedThisTurn' };

export type LeaderEffect =
  | { type: 'atkMultiplier'; target?: UnitFilter; value: number; /** 每超過條件 1 級再加的倍率 */ perStep?: number; maxValue?: number }
  | { type: 'hpMultiplier'; target?: UnitFilter; value: number }
  | { type: 'rcvMultiplier'; target?: UnitFilter; value: number }
  | { type: 'damageReduction'; percent: number }
  | { type: 'extendMoveTime'; seconds: number }
  | { type: 'followUpDamage'; mode: 'multiplier' | 'fixed'; value: number }
  | { type: 'ignoreDefense' }
  | { type: 'enemyCooldownPlus'; turns: number }
  | { type: 'skillCooldownStart'; charged: boolean }
  /** 每回合全隊技能冷卻額外減少 turns（提案 001，用於技能循環） */
  | { type: 'allyCooldownPerTurn'; turns: number }
  | { type: 'boardSize'; cols: number; rows: number };

export interface LeaderSkillDef {
  id: string;
  name: string;
  /** 每一條規則：條件全部成立時套用效果 */
  rules: { conditions: LeaderCondition[]; effects: LeaderEffect[] }[];
  description: string;
}

/** 星紋覺醒等被動效果 */
export type PassiveEffect =
  | { type: 'orbDamageUp'; orb: OrbType; percent: number }
  | { type: 'moveTimeUp'; seconds: number }
  | { type: 'statUp'; stat: 'hp' | 'atk' | 'rcv'; value: number }
  | { type: 'resistStatus'; status: StatusId; percent: number };

// ---------- 敵人 ----------
export const STATUS_IDS = [
  'poison', 'skillSeal', 'orbLock', 'moveTimeDown', 'shield', 'attributeShield',
  'comboShield', 'heartSeal', 'darkOrbs', 'poisonOrbs', 'lockedOrbs',
  'damageAbsorb', 'enrage', 'delayImmune', 'multiHit', 'attributeSeal',
] as const;
export type StatusId = (typeof STATUS_IDS)[number];

export interface EnemyAbility {
  status: StatusId;
  /** 觸發時機 */
  trigger: 'onStart' | 'onAttack' | 'hpBelow' | 'everyNTurns';
  value?: number;
  turns?: number;
  params?: Record<string, number | string>;
}

export interface EnemyDef {
  id: string;
  name: string;
  attribute: Attribute;
  hp: number;
  atk: number;
  def: number;
  cd: number;
  abilities: EnemyAbility[];
  art: { sprite?: string };
}

// ---------- 關卡 ----------
export type StageKind = 'main' | 'daily' | 'event' | 'tower' | 'trial' | 'side';

export type StarCondition =
  | { type: 'clearWithinTurns'; turns: number }
  | { type: 'noActiveSkill' }
  | { type: 'teamAll'; filter: UnitFilter }
  | { type: 'maxCombo'; combo: number }
  | { type: 'noContinue' };

export interface DropDef { card: string; rate: number; level?: number }

/** 進場時對玩家隊伍的限制（不填的欄位代表不限） */
export interface TeamRule {
  /** 每位隊員都要符合 */
  filter?: UnitFilter;
  /** 每位隊員都要帶有這個流派標籤 */
  archetype?: ArchetypeId;
  /** 隊伍必須包含的卡號 */
  requiredCards?: string[];
  maxMembers?: number;
  noHelper?: boolean;
}

/** 關卡借給玩家的固定隊伍（流派試煉用，玩家不需擁有這些卡） */
export interface FixedTeam {
  members: { card: string; level: number; skillLevel?: number }[];
  helper?: { card: string; level: number; skillLevel?: number };
}

/** 劇情對白一句；沒有 speaker 的是旁白 */
export interface StoryLine {
  speaker?: string;
  text: string;
}

/** data/story.json：劇情 id → 對白 */
export type StoryData = Record<string, StoryLine[]>;

export interface StageDef {
  id: string;
  kind: StageKind;
  chapter?: number;
  name: string;
  stamina: number;
  unlockAfter: string | null;
  /** 每日關卡：開放的星期（0=週日） */
  weekdays?: number[];
  /** 活動關卡：所屬活動 id */
  event?: string;
  recommendedArchetypes?: ArchetypeId[];
  /** 流派試煉：本關考驗的流派 */
  archetype?: ArchetypeId;
  teamRule?: TeamRule;
  fixedTeam?: FixedTeam;
  waves: { enemies: string[]; boss?: boolean }[];
  /** tokens：每次通關都給的活動代幣（循環活動每一期都能賺） */
  rewards: { coin: number; playerExp: number; cardExp?: number; tokens?: Record<string, number>; firstClear?: Reward };
  stars?: StarCondition[];
  drops: DropDef[];
  story?: { before?: string; beforeBoss?: string; after?: string };
}

/** 主線章節：每章對應一個星座與種族，集滿章節星章領 starReward */
export interface ChapterDef {
  chapter: number;
  name: string;
  constellation: string;
  race: Race;
  starReward: Reward;
  /** 預定的關數；章節分批上線時，星章總數以它計算（還沒上線的關卡算未取得），避免提早領到章節獎勵 */
  stageCount?: number;
}

/** 中斷續戰用：出戰時就決定好隊伍與亂數種子，重新整理不能重骰開場盤面或掉落 */
export interface ActiveBattle {
  stageId: string;
  /** 開場盤面與掉落用的種子 */
  seed: number;
  members: TeamMemberInput[];
  helper: TeamMemberInput | null;
  startedAt: number;
  /** 進場時骰好的掉落（提案 13）；重新整理與續戰都沿用，不重骰 */
  drops: DropPlan;
  /** 還沒開打（例如還在看開場劇情）時為 null */
  snapshot: BattleSnapshot | null;
}

// ---------- 經濟 ----------
export interface Reward {
  coin?: number;
  gems?: number;
  stamina?: number;
  tokens?: Record<string, number>;
  cards?: { card: string; count: number }[];
}

export interface GachaPoolDef {
  id: string;
  name: string;
  cost: { gems: number };
  tenPullCost?: { gems: number };
  rates: Partial<Record<Rarity, number>>;
  pity: { rarity: Rarity; after: number };
  tenPullGuarantee: { minRarity: Rarity };
  cards: Partial<Record<Rarity, string[]>>;
  /** 限定池權重提升 */
  rateUp?: { card: string; share: number }[];
  period: { start: string; end: string } | null;
}

export interface ShopItemDef {
  id: string;
  name: string;
  price: { gems?: number; coin?: number; tokens?: Record<string, number> };
  reward: Reward | { type: 'refillStamina' } | { type: 'expandInventory'; amount: number };
  limit?: { count: number; per: 'day' | 'week' | 'forever' | 'event' };
}

export interface QuestDef {
  id: string;
  kind: 'daily' | 'weekly' | 'achievement';
  name: string;
  /** 由 progression 模組定義的計數器名稱，例如 'combo10'、'stageClear' */
  counter: string;
  target: number;
  reward: Reward;
}

export interface ArchetypeDef {
  id: ArchetypeId;
  name: string;
  summary: string;
  howToPlay: string;
  weakness: string;
  starterPath: string;
}

export interface GameConfig {
  board: { cols: number; rows: number; moveTimeSeconds: number };
  battle: {
    attributeAdvantage: number;
    attributeDisadvantage: number;
    extraOrbBonus: number;
    comboBonus: number;
    fullAttackOrbCount: number;
    enhancedOrbBonus: number;
  };
  stamina: { regenMinutes: number; baseMax: number; maxPerLevel: number };
  inventory: { baseCapacity: number; expandStep: number; expandCostGems: number };
  newPlayer: { coin: number; gems: number; starterCards: string[] };
}

// ---------- 存檔 ----------
export interface OwnedCard {
  uid: string;
  cardId: string;
  level: number;
  exp: number;
  skillLevel: number;
  /** 突破階數 0–5 */
  limitBreak: number;
  /** 已解鎖的星紋覺醒數 */
  awakened: number;
  locked: boolean;
  obtainedAt: number;
}

/** 新手教學的關卡：教學戰鬥 → 編隊 → 召喚 → 第一章第一關 → 完成 */
export const TUTORIAL_STEPS = ['battle', 'team', 'summon', 'stage', 'done'] as const;
export type TutorialStep = (typeof TUTORIAL_STEPS)[number];

export interface SaveData {
  version: number;
  player: { name: string; level: number; exp: number; coin: number; gems: number; tokens: Record<string, number> };
  stamina: { current: number; lastUpdate: number };
  inventory: { capacity: number; cards: OwnedCard[] };
  teams: { name: string; members: (string | null)[] }[];
  activeTeam: number;
  progress: {
    clearedStages: string[];
    stars: Record<string, boolean[]>;
    towerFloor: number;
    tutorialDone: boolean;
    storySeen: string[];
    /** 已領取星章獎勵的章節（存檔 v3 起） */
    chapterRewardsClaimed: number[];
  };
  /** 進行中的關卡戰鬥（存檔 v4 起，讀檔時一定會補上）：出戰時寫入，每次行動後更新快照，結算或放棄時清掉 */
  activeBattle?: ActiveBattle | null;
  /** 新手教學進度（存檔 v2 起，讀檔時一定會補上）；step 為 done 時 progress.tutorialDone 也是 true */
  tutorial?: { step: TutorialStep; giftGiven: boolean };
  gacha: { pityCounter: Record<string, number>; history: { pool: string; card: string; at: number }[] };
  collection: { seen: string[]; owned: string[]; claimed: string[] };
  quests: { counters: Record<string, number>; claimed: string[]; dailyResetAt: string; weeklyResetAt: string };
  daily: { loginDay: number; lastLogin: string; shopPurchases: Record<string, number> };
  settings: { bgm: number; sfx: number; battleSpeed: 1 | 2 };
  /** 契印師手札的個人戰績（可選；讀取一律經過 progression/records.ts 的 recordsOf 補預設值） */
  records?: import('../progression/records').PlayerRecords;
  /** 星紋謎題每日一題的紀錄（可選；讀取一律經過 progression/puzzle.ts 的 puzzleOf 補預設值） */
  puzzle?: import('../progression/puzzle').PuzzleRecord;
  /** 已收集的星骸殘頁 id（可選；讀取一律經過 progression/lore.ts 的 collectedLorePages 補預設值） */
  lorePages?: string[];
  /** 流浪契印師的同行情誼：NPC id → 點數（可選；讀取一律經過 progression/helper-bond.ts 的 bondPoints 補預設值） */
  helperBond?: Record<string, number>;
}
