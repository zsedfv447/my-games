// 星蝕難度：章節全部滿星後開放的高難度版。執行時把既有關卡與敵人轉換成星蝕版，不複製關卡資料。
// 星蝕關卡的 id 是「原關卡 id@eclipse」，敵人 id 是「原敵人 id@eclipse」；紀錄存在 save.eclipse（選填欄位，不升存檔版本）。
import type {
  Attribute, CardDef, ChapterDef, EnemyAbility, EnemyDef, GameConfig, Reward, SaveData, StageDef,
} from '../core/types';
import type { Rng } from '../core/rng';
import { fail, ok, type SaveResult } from './result';
import { grantReward } from './rewards';
import { chapterStars, completeStage, enterStage, type BattleSummary, type StageClearResult, type StageContext } from './stages';

/** 星蝕的係數與獎勵；調整難度只改這裡 */
export const ECLIPSE = {
  /**
   * 敵人生命、攻擊、防禦倍率，依章節分開設定：前面章節的敵人原本很弱，要乘比較多才有挑戰；
   * 後面章節原本就接近老手隊的極限，只能小幅加強。沒列到的章節用 default。
   */
  byChapter: {
    1: { hp: 5, atk: 5, def: 3 },
    2: { hp: 3.5, atk: 4, def: 2.5 },
    3: { hp: 2.5, atk: 3, def: 2 },
    4: { hp: 2, atk: 2.2, def: 1.5 },
    5: { hp: 1.1, atk: 1.5, def: 1.2 },
    6: { hp: 0.85, atk: 1.3, def: 1.1 },
  } as Record<number, { hp: number; atk: number; def: number }>,
  default: { hp: 1.5, atk: 1.3, def: 1.2 },
  /** 額外機制：Boss 生命低於 percent% 時狂暴（攻擊 × value），原本已有狂暴的 Boss 不再加 */
  bossEnrage: { percent: 30, value: 1.5 },
  /** 體力倍率（無條件進位） */
  stamina: 1.5,
  /** 每次通關的金幣、玩家經驗、卡片經驗倍率 */
  rewards: 1.5,
  /** 首通獎勵：一般關／Boss 關；core 是星核張數（依 Boss 波第一隻敵人的屬性） */
  firstClear: {
    normal: { gems: 1, core: 1 },
    boss: { gems: 3, core: 2 },
  },
  /** 星輝結晶 c921：每章只有最後一關（章節 Boss）首通給，一次性，不能重複刷 */
  finalBossCrystal: 1,
  /** 星蝕版章節星章全滿的獎勵（只給星晶） */
  chapterReward: { gems: 10 },
} as const;

export const ECLIPSE_SUFFIX = '@eclipse';
/** 星輝結晶（growth-screens 新增；資料裡還沒有這張卡時，獎勵會自動略過）。只當一次性首通獎勵 */
export const ECLIPSE_CRYSTAL = 'c921';
const STAR_CORE: Record<Attribute, string> = { fire: 'c916', water: 'c917', wood: 'c918', light: 'c919', dark: 'c920' };

export const isEclipseId = (id: string) => id.endsWith(ECLIPSE_SUFFIX);
export const eclipseIdOf = (id: string) => (isEclipseId(id) ? id : id + ECLIPSE_SUFFIX);
export const baseIdOf = (id: string) => (isEclipseId(id) ? id.slice(0, -ECLIPSE_SUFFIX.length) : id);

/** save.eclipse 的完整形狀（讀取一律經過 eclipseOf 補預設值） */
export interface EclipseRecord {
  /** 通關過的星蝕關卡（存原關卡 id） */
  cleared: string[];
  /** 星蝕版的星章（鍵是原關卡 id） */
  stars: Record<string, boolean[]>;
  /** 已領取星蝕星章獎勵的章節 */
  chapterRewardsClaimed: number[];
}

export function eclipseOf(save: SaveData): EclipseRecord {
  const e = save.eclipse;
  return { cleared: e?.cleared ?? [], stars: e?.stars ?? {}, chapterRewardsClaimed: e?.chapterRewardsClaimed ?? [] };
}

// ---------- 轉換（純函式） ----------

/** 章節的星蝕倍率 */
export const eclipseScale = (chapter?: number) => (chapter !== undefined && ECLIPSE.byChapter[chapter]) || ECLIPSE.default;

export function eclipseEnemy(enemy: EnemyDef, boss = false, chapter?: number): EnemyDef {
  const k = eclipseScale(chapter);
  const abilities: EnemyAbility[] = [...enemy.abilities];
  if (boss && !abilities.some((a) => a.status === 'enrage')) {
    abilities.push({ status: 'enrage', trigger: 'hpBelow', value: ECLIPSE.bossEnrage.value, turns: 0, params: { percent: ECLIPSE.bossEnrage.percent } });
  }
  return {
    ...enemy,
    id: eclipseIdOf(enemy.id),
    name: `星蝕・${enemy.name}`,
    hp: Math.round(enemy.hp * k.hp),
    atk: Math.round(enemy.atk * k.atk),
    def: Math.round(enemy.def * k.def),
    abilities,
  };
}

/** Boss 波第一隻敵人的屬性，決定首通給哪種星核 */
function bossAttribute(stage: StageDef, enemies: EnemyDef[]): Attribute | undefined {
  const wave = stage.waves.find((w) => w.boss) ?? stage.waves[stage.waves.length - 1];
  return enemies.find((e) => e.id === wave?.enemies[0])?.attribute;
}

/** 章節最後一關：同章沒有其他關卡以它為解鎖條件 */
const isChapterFinal = (stage: StageDef, stages: StageDef[]) =>
  !stages.some((s) => s.kind === 'main' && s.chapter === stage.chapter && s.unlockAfter === stage.id);

function eclipseFirstClear(stage: StageDef, stages: StageDef[], enemies: EnemyDef[], cardIds: ReadonlySet<string>): Reward {
  const boss = stage.waves.some((w) => w.boss);
  const r = boss ? ECLIPSE.firstClear.boss : ECLIPSE.firstClear.normal;
  const attr = bossAttribute(stage, enemies);
  const cards: { card: string; count: number }[] = [];
  if (attr && r.core > 0) cards.push({ card: STAR_CORE[attr], count: r.core });
  if (boss && isChapterFinal(stage, stages)) cards.push({ card: ECLIPSE_CRYSTAL, count: ECLIPSE.finalBossCrystal });
  const owned = cards.filter((c) => cardIds.has(c.card));
  return { gems: r.gems, ...(owned.length ? { cards: owned } : {}) };
}

/**
 * 主線關卡 → 星蝕版。同章前一關的星蝕版是解鎖條件（第一關沒有條件，靠 eclipseLockReason 檢查章節滿星）。
 * 不掉落卡片、不播劇情；星章條件沿用原關卡。
 */
export function eclipseStage(stage: StageDef, stages: StageDef[], enemies: EnemyDef[], cardIds: ReadonlySet<string>): StageDef {
  const prev = stage.unlockAfter ? stages.find((s) => s.id === stage.unlockAfter) : undefined;
  const sameChapter = prev && prev.kind === 'main' && prev.chapter === stage.chapter;
  const mul = (n: number) => Math.round(n * ECLIPSE.rewards);
  return {
    ...stage,
    id: eclipseIdOf(stage.id),
    name: `星蝕・${stage.name}`,
    stamina: Math.ceil(stage.stamina * ECLIPSE.stamina),
    unlockAfter: sameChapter ? eclipseIdOf(prev.id) : null,
    waves: stage.waves.map((w) => ({ ...w, enemies: w.enemies.map(eclipseIdOf) })),
    rewards: {
      coin: mul(stage.rewards.coin),
      playerExp: mul(stage.rewards.playerExp),
      ...(stage.rewards.cardExp ? { cardExp: mul(stage.rewards.cardExp) } : {}),
      firstClear: eclipseFirstClear(stage, stages, enemies, cardIds),
    },
    drops: [],
    story: undefined,
  };
}

export interface EclipseData {
  stages: StageDef[];
  enemies: EnemyDef[];
  cards: CardDef[];
}

/** 用關卡 id 找關卡：星蝕 id 就即時轉換；找不到回傳 undefined */
export function resolveStage(id: string, data: EclipseData): StageDef | undefined {
  const base = data.stages.find((s) => s.id === baseIdOf(id));
  if (!base || !isEclipseId(id)) return base;
  if (base.kind !== 'main') return undefined;
  return eclipseStage(base, data.stages, data.enemies, new Set(data.cards.map((c) => c.id)));
}

/** 戰鬥用的敵人清單：原本的敵人加上這一關需要的星蝕版敵人 */
export function eclipseEnemies(stage: StageDef, enemies: EnemyDef[]): EnemyDef[] {
  if (!isEclipseId(stage.id)) return enemies;
  const bossIds = new Set(stage.waves.filter((w) => w.boss).flatMap((w) => w.enemies));
  const needed = new Set(stage.waves.flatMap((w) => w.enemies).filter(isEclipseId));
  const extra = enemies.filter((e) => needed.has(eclipseIdOf(e.id)) && !isEclipseId(e.id))
    .map((e) => eclipseEnemy(e, bossIds.has(eclipseIdOf(e.id)), stage.chapter));
  return [...enemies, ...extra];
}

/** 這一關的星蝕版（主線才有）列表 */
export function eclipseChapterStages(chapter: number, data: EclipseData): StageDef[] {
  const ids = new Set(data.cards.map((c) => c.id));
  return data.stages.filter((s) => s.kind === 'main' && s.chapter === chapter).map((s) => eclipseStage(s, data.stages, data.enemies, ids));
}

// ---------- 解鎖與紀錄 ----------

/** 章節的原版星章全部到手（分批上線的章節要等全部上線並滿星）才開放星蝕 */
export function eclipseUnlocked(save: SaveData, chapter: number, stages: StageDef[], chapters?: ChapterDef[]): boolean {
  const { got, total } = chapterStars(save, chapter, stages, chapters);
  return total > 0 && got >= total;
}

export type EclipseLockReason = 'chapterNotStarred' | 'locked';

export function eclipseLockReason(save: SaveData, stage: StageDef, stages: StageDef[], chapters?: ChapterDef[]): EclipseLockReason | null {
  if (stage.chapter === undefined || !eclipseUnlocked(save, stage.chapter, stages, chapters)) return 'chapterNotStarred';
  if (stage.unlockAfter && !eclipseOf(save).cleared.includes(baseIdOf(stage.unlockAfter))) return 'locked';
  return null;
}

export const isEclipseCleared = (save: SaveData, id: string) => eclipseOf(save).cleared.includes(baseIdOf(id));
export const eclipseStarsOf = (save: SaveData, id: string) => eclipseOf(save).stars[baseIdOf(id)] ?? [];

/**
 * 星蝕關卡結算：沿用 completeStage 發金幣、經驗與首通獎勵，但通關與星章記在 save.eclipse，
 * 不動原版的 progress.clearedStages／stars。
 */
export function completeEclipseStage(
  save: SaveData,
  stage: StageDef,
  summary: BattleSummary,
  ctx: StageContext,
  config: GameConfig,
  rng: Rng,
  now: number,
): { save: SaveData; result: StageClearResult } {
  const record = eclipseOf(save);
  const asProgress: SaveData = {
    ...save,
    progress: {
      ...save.progress,
      clearedStages: record.cleared.map(eclipseIdOf),
      stars: Object.fromEntries(Object.entries(record.stars).map(([k, v]) => [eclipseIdOf(k), v])),
    },
  };
  const done = completeStage(asProgress, stage, summary, ctx, config, rng, now, []);
  const cleared = done.save.progress.clearedStages.map(baseIdOf);
  const stars = Object.fromEntries(Object.entries(done.save.progress.stars).map(([k, v]) => [baseIdOf(k), v]));
  return {
    save: {
      ...done.save,
      progress: { ...done.save.progress, clearedStages: save.progress.clearedStages, stars: save.progress.stars },
      eclipse: { ...record, cleared, stars },
    },
    result: done.result,
  };
}

// ---------- 星蝕星章獎勵 ----------

export function eclipseChapterStars(save: SaveData, chapter: number, stages: StageDef[]): { got: number; total: number } {
  const record = eclipseOf(save);
  let got = 0;
  let total = 0;
  for (const s of stages) {
    if (s.kind !== 'main' || s.chapter !== chapter) continue;
    total += s.stars?.length ?? 0;
    got += (record.stars[s.id] ?? []).filter(Boolean).length;
  }
  return { got, total };
}

/** 星蝕星章全滿的章節獎勵；星輝結晶只放在章節 Boss 首通，這裡不給 */
export function eclipseChapterReward(): Reward {
  return { gems: ECLIPSE.chapterReward.gems };
}

export type EclipseRewardStatus = 'claimable' | 'claimed' | 'incomplete';

export function eclipseRewardStatus(save: SaveData, chapter: number, stages: StageDef[]): EclipseRewardStatus {
  if (eclipseOf(save).chapterRewardsClaimed.includes(chapter)) return 'claimed';
  const { got, total } = eclipseChapterStars(save, chapter, stages);
  return total > 0 && got >= total ? 'claimable' : 'incomplete';
}

export function claimEclipseChapterReward(
  save: SaveData, chapter: number, stages: StageDef[], config: GameConfig, now: number,
): SaveResult<'alreadyClaimed' | 'notComplete'> & { reward?: Reward } {
  const status = eclipseRewardStatus(save, chapter, stages);
  if (status === 'claimed') return fail('alreadyClaimed');
  if (status === 'incomplete') return fail('notComplete');
  const reward = eclipseChapterReward();
  const granted = grantReward(save, reward, config, now).save;
  const record = eclipseOf(granted);
  return { ...ok({ ...granted, eclipse: { ...record, chapterRewardsClaimed: [...record.chapterRewardsClaimed, chapter] } }), reward };
}

/** 星蝕關卡進場：先檢查章節滿星與前一關，再照一般關卡扣體力、檢查隊伍（一般的解鎖條件看原版紀錄，所以拿掉） */
export function enterEclipseStage(
  save: SaveData,
  stage: StageDef,
  ctx: StageContext,
  config: GameConfig,
  now: number,
  team: Parameters<typeof enterStage>[5],
  chapters?: ChapterDef[],
): ReturnType<typeof enterStage> | SaveResult<EclipseLockReason> {
  const lock = eclipseLockReason(save, stage, ctx.stages, chapters);
  if (lock) return fail(lock);
  return enterStage(save, { ...stage, unlockAfter: null }, ctx, config, now, team);
}
