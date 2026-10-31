// 星淵回廊：主線通關後的每週塔（提案 89）。每週一（裝置當地時間）重置，從第 1 層爬到第 30 層。
// 關卡不寫在 stages.json：依「週種子＋層數」從 enemies.json 挑敵人、套用強度係數與本週星象，全部是純函式，
// 同一週同一層的結果固定，重新整理、中途續戰都會得到同一個關卡。
import { createRng, type Rng } from '../core/rng';
import type {
  Attribute, CardDef, EnemyAbility, EnemyDef, GameConfig, Reward, SaveData, StageDef,
} from '../core/types';
import { ATTRIBUTES } from '../core/types';
import { completeStage, type BattleSummary, type StageClearResult, type StageContext } from './stages';
import { grantReward } from './rewards';
import { weekKey } from './time';

export const ABYSS_FLOORS = 30;
/** 開放條件：主線通關 */
export const ABYSS_UNLOCK_STAGE = 'st-5-9';
/** 每 10 層的星輝結晶（growth 的進化素材）；資料還沒有這張卡時改發星核 */
export const ABYSS_CRYSTAL = 'c921';
const STAR_CORES: Record<Attribute, string> = { fire: 'c916', water: 'c917', wood: 'c918', light: 'c919', dark: 'c920' };

const ID_PREFIX = 'abyss_';
export const abyssStageId = (week: string, floor: number) => `${ID_PREFIX}${week}_${floor}`;

/** 從關卡 id 讀回週與層數；不是星淵回廊的關卡回傳 null */
export function parseAbyssId(id: string): { week: string; floor: number } | null {
  const m = /^abyss_(\d{4}-\d{2}-\d{2})_(\d+)$/.exec(id);
  if (!m) return null;
  const floor = Number(m[2]);
  return floor >= 1 && floor <= ABYSS_FLOORS ? { week: m[1], floor } : null;
}

/** 週種子：週鍵（例如 2026-10-26）的 FNV 雜湊 */
export function abyssSeed(week: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < week.length; i++) {
    h ^= week.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// ---------- 星象：每週一個修正，全部沿用既有的敵人狀態積木 ----------

export interface AbyssOmen {
  id: string;
  name: string;
  text: string;
  /** 每一波第一隻敵人加上的技能 */
  lead?: EnemyAbility[];
  /** 所有敵人加上的技能 */
  all?: EnemyAbility[];
  /** Boss 加上的技能 */
  boss?: EnemyAbility[];
}

const ATTR_NAMES: Record<Attribute, string> = { fire: '焰', water: '潮', wood: '森', light: '輝', dark: '蝕' };

export function abyssOmen(week: string): AbyssOmen {
  const rng = createRng(abyssSeed(`${week}#omen`));
  const attr = ATTRIBUTES[rng.int(ATTRIBUTES.length)];
  const omens: AbyssOmen[] = [
    { id: 'veil', name: '星幕', text: '每一波登場時蓋住 4 顆珠 2 回合', lead: [{ status: 'darkOrbs', trigger: 'onStart', value: 4, turns: 2 }] },
    { id: 'haste', name: '疾時', text: '轉珠時間 −1 秒', lead: [{ status: 'moveTimeDown', trigger: 'onStart', value: 1, turns: 99 }] },
    { id: `ward-${attr}`, name: `${ATTR_NAMES[attr]}紋護壁`, text: `敵人受到${ATTR_NAMES[attr]}屬性的傷害 −50%`, all: [{ status: 'attributeShield', trigger: 'onStart', value: 50, params: { attribute: attr } }] },
    { id: 'fury', name: '狂星', text: '敵人生命低於 50% 時攻擊 ×1.5', all: [{ status: 'enrage', trigger: 'hpBelow', value: 1.5, params: { percent: 50 } }] },
    { id: 'seal', name: '封紋', text: 'Boss 每 3 回合封印隊長屬性 1 回合', boss: [{ status: 'attributeSeal', trigger: 'everyNTurns', turns: 1, params: { n: 3, attribute: 'leader' } }] },
    { id: 'combo', name: '連星盾', text: 'Boss 要 4 Combo 以上才會受傷', boss: [{ status: 'comboShield', trigger: 'onStart', value: 4 }] },
  ];
  return omens[rng.int(omens.length)];
}

/** 本週星核的屬性（每 5 層的獎勵） */
export const abyssCoreAttribute = (week: string): Attribute => ATTRIBUTES[createRng(abyssSeed(`${week}#core`)).int(ATTRIBUTES.length)];

// ---------- 強度 ----------

/** 第 floor 層一般敵人的數值（Boss 另外乘倍率）；全部只看層數，所以強度一定隨層數上升 */
export function abyssScale(floor: number): { hp: number; atk: number; def: number } {
  const f = floor - 1;
  return {
    hp: Math.round(60000 * 1.05 ** f),
    atk: Math.round(2400 * 1.04 ** f),
    def: Math.round(300 * 1.03 ** f),
  };
}
const BOSS_HP = 5;
const BOSS_ATK = 1.6;
const BOSS_DEF = 1.5;

/** 這一層的總強度（測試用）：所有敵人生命×攻擊的總和 */
export function abyssStrength(stage: StageDef, enemies: EnemyDef[]): number {
  const byId = new Map(enemies.map((e) => [e.id, e]));
  return stage.waves.flatMap((w) => w.enemies).reduce((n, id) => {
    const e = byId.get(id)!;
    return n + e.hp * e.atk;
  }, 0);
}

/** 可以拿來當星淵敵人的原型：去掉傷害吸收、完全免疫的護盾與 Combo 盾，避免數值放大後打不動 */
function usable(e: EnemyDef): boolean {
  return !e.abilities.some((a) => a.status === 'damageAbsorb' || (a.status === 'shield' && !a.value) || a.status === 'comboShield');
}

export interface AbyssFloor {
  stage: StageDef;
  /** 這一層用到的敵人（id 為 abyss_週_層_序號，戰鬥時要加進 BattleData.enemies） */
  enemies: EnemyDef[];
}

/** 產生第 floor 層：一般層 2 波各 2 隻，每 5 層是 Boss 層（再加 1 波 Boss） */
export function abyssFloor(week: string, floor: number, base: EnemyDef[]): AbyssFloor {
  const rng: Rng = createRng(abyssSeed(`${week}#${floor}`));
  const omen = abyssOmen(week);
  const pool = base.filter(usable);
  const bosses = pool.filter((e) => e.hp >= 300000);
  const scale = abyssScale(floor);
  const enemies: EnemyDef[] = [];
  const make = (proto: EnemyDef, boss: boolean, lead: boolean): string => {
    const id = `${abyssStageId(week, floor)}_${enemies.length}`;
    const abilities = [
      ...proto.abilities,
      ...(omen.all ?? []),
      ...(lead ? omen.lead ?? [] : []),
      ...(boss ? omen.boss ?? [] : []),
    ];
    enemies.push({
      ...proto,
      id,
      name: boss ? `星淵・${proto.name}` : proto.name,
      hp: Math.round(scale.hp * (boss ? BOSS_HP : 1)),
      atk: Math.round(scale.atk * (boss ? BOSS_ATK : 1)),
      def: Math.round(scale.def * (boss ? BOSS_DEF : 1)),
      abilities,
    });
    return id;
  };
  const waves: StageDef['waves'] = [0, 1].map(() => ({ enemies: [make(rng.pick(pool), false, true), make(rng.pick(pool), false, false)] }));
  if (floor % 5 === 0) waves.push({ enemies: [make(rng.pick(bosses.length ? bosses : pool), true, true)], boss: true });
  const stage: StageDef = {
    id: abyssStageId(week, floor),
    kind: 'abyss',
    name: `星淵回廊・第 ${floor} 層`,
    stamina: 0,
    unlockAfter: null,
    waves,
    rewards: { coin: 300 + 20 * floor, playerExp: 30 + floor, cardExp: 200 + 10 * floor },
    drops: [],
  };
  return { stage, enemies };
}

// ---------- 獎勵 ----------

/**
 * 每層本週第一次通關的獎勵：每 5 層一顆本週屬性的星核，每 10 層 3 星晶＋星輝結晶，第 30 層再加 1 星晶。
 * 一週最多：星晶 10、星核 6、星輝結晶 3。
 */
export function abyssFloorReward(week: string, floor: number, cards: Pick<CardDef, 'id'>[]): Reward | undefined {
  const reward: Reward = {};
  const cardList: { card: string; count: number }[] = [];
  const core = STAR_CORES[abyssCoreAttribute(week)];
  if (floor % 5 === 0) cardList.push({ card: core, count: 1 });
  if (floor % 10 === 0) {
    reward.gems = 3;
    // 星輝結晶還沒上線時先發星核代替
    cardList.push({ card: cards.some((c) => c.id === ABYSS_CRYSTAL) ? ABYSS_CRYSTAL : core, count: 1 });
  }
  if (floor === ABYSS_FLOORS) reward.gems = (reward.gems ?? 0) + 1;
  if (cardList.length) reward.cards = cardList;
  return reward.gems || reward.cards ? reward : undefined;
}

/** 一週全部爬完能拿到的總量（報告與說明用） */
export function abyssWeeklyTotal(week: string, cards: Pick<CardDef, 'id'>[]): { gems: number; cards: Record<string, number> } {
  const total = { gems: 0, cards: {} as Record<string, number> };
  for (let f = 1; f <= ABYSS_FLOORS; f++) {
    const r = abyssFloorReward(week, f, cards);
    total.gems += r?.gems ?? 0;
    for (const c of r?.cards ?? []) total.cards[c.card] = (total.cards[c.card] ?? 0) + c.count;
  }
  return total;
}

// ---------- 進度（存檔的選填欄位，換週時重置） ----------

export interface AbyssProgress {
  week: string;
  /** 本週通過的最高層 */
  best: number;
  /** 本週已領首通獎勵的層 */
  claimed: number[];
}

/** 目前這週的進度；存檔沒有或是上週的，就從 0 開始 */
export function abyssProgress(save: SaveData, now: number): AbyssProgress {
  const week = weekKey(now);
  const a = save.abyss;
  return a && a.week === week ? { week, best: a.best, claimed: [...a.claimed] } : { week, best: 0, claimed: [] };
}

export const isAbyssOpen = (save: SaveData) => save.progress.clearedStages.includes(ABYSS_UNLOCK_STAGE);

/** 可以挑戰的層：主線通關、而且是本週已通過的層或下一層 */
export function abyssLock(save: SaveData, week: string, floor: number, now: number): 'locked' | 'previous' | 'wrongWeek' | null {
  if (!isAbyssOpen(save)) return 'locked';
  const p = abyssProgress(save, now);
  if (week !== p.week) return 'wrongWeek';
  if (floor > p.best + 1) return 'previous';
  return null;
}

/**
 * 星淵回廊通關：金幣、經驗、升級照一般關卡（completeStage），但不寫進 clearedStages（每週的關卡 id 都不同），
 * 本週首通獎勵放在 periodFirstClear，結算畫面會標「本週首通」。
 */
export function completeAbyssFloor(
  save: SaveData, stage: StageDef, summary: BattleSummary, ctx: StageContext, config: GameConfig, now: number, cards: Pick<CardDef, 'id'>[],
): { save: SaveData; result: StageClearResult } {
  const parsed = parseAbyssId(stage.id);
  if (!parsed) throw new Error(`不是星淵回廊的關卡：${stage.id}`);
  const done = completeStage(save, stage, summary, ctx, config, createRng(0), now, []);
  let s: SaveData = { ...done.save, progress: { ...done.save.progress, clearedStages: save.progress.clearedStages } };
  const p = abyssProgress(save, now);
  // 週一跨過去才結算：獎勵照發，但不算進新一週的進度
  if (parsed.week !== p.week) return { save: s, result: done.result };
  const first = !p.claimed.includes(parsed.floor);
  const reward = first ? abyssFloorReward(parsed.week, parsed.floor, cards) : undefined;
  if (reward) s = grantReward(s, reward, config, now).save;
  s = { ...s, abyss: { week: p.week, best: Math.max(p.best, parsed.floor), claimed: first ? [...p.claimed, parsed.floor] : p.claimed } };
  return { save: s, result: { ...done.result, ...(reward ? { periodFirstClear: reward } : {}) } };
}
