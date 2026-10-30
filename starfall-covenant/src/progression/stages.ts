// 關卡：解鎖、進場（扣體力）、星章判定、掉落、結算發獎
import type {
  Attribute, CardDef, DropDef, GameConfig, Race, Reward, SaveData, StageDef, StarCondition, TeamRule, UnitFilter,
} from '../core/types';
import type { Rng } from '../core/rng';
import { addPlayerExp, type LevelUpInfo } from './player';
import { fail, ok, type SaveResult } from './result';
import { addCards, grantReward } from './rewards';
import { spendStamina } from './stamina';
import { weekday } from './time';

/** 戰鬥模組在結算時交給關卡模組的摘要 */
export interface BattleSummary {
  turns: number;
  usedActiveSkill: boolean;
  maxCombo: number;
  continues: number;
  /** 出戰隊員（含助戰）的屬性與種族 */
  team: { attribute: Attribute; race: Race }[];
}

export interface StageContext {
  stages: StageDef[];
  /** 目前開放中的活動 id */
  openEvents?: ReadonlySet<string>;
}

export type StageLockReason = 'locked' | 'wrongDay' | 'eventClosed' | 'unknownStage';

export function stageLockReason(save: SaveData, stage: StageDef, ctx: StageContext, now: number): StageLockReason | null {
  if (stage.unlockAfter && !save.progress.clearedStages.includes(stage.unlockAfter)) return 'locked';
  if (stage.kind === 'daily' && stage.weekdays && !stage.weekdays.includes(weekday(now))) return 'wrongDay';
  if (stage.kind === 'event' && stage.event && !ctx.openEvents?.has(stage.event)) return 'eventClosed';
  return null;
}

export const isStageUnlocked = (save: SaveData, stage: StageDef, ctx: StageContext, now: number) =>
  stageLockReason(save, stage, ctx, now) === null;

export type TeamRuleViolation = 'teamFilter' | 'teamArchetype' | 'teamMissingCard' | 'teamTooLarge' | 'helperNotAllowed';

/** 檢查玩家隊伍是否符合關卡限制；members 不含助戰 */
export function checkTeamRule(rule: TeamRule | undefined, members: CardDef[], helper?: CardDef): TeamRuleViolation | null {
  if (!rule) return null;
  if (rule.noHelper && helper) return 'helperNotAllowed';
  if (rule.maxMembers !== undefined && members.length > rule.maxMembers) return 'teamTooLarge';
  const all = helper ? [...members, helper] : members;
  if (rule.filter && !all.every((c) => matchesFilter(c, rule.filter!))) return 'teamFilter';
  if (rule.archetype && !all.every((c) => c.archetypes.some((a) => a.id === rule.archetype))) return 'teamArchetype';
  if (rule.requiredCards?.some((id) => !members.some((c) => c.id === id))) return 'teamMissingCard';
  return null;
}

/**
 * 進場：檢查解鎖、隊伍限制與背包空間，扣體力。
 * 有 fixedTeam 的關卡（流派試煉）用關卡借的隊伍，不檢查玩家隊伍。
 */
export function enterStage(
  save: SaveData,
  stage: StageDef,
  ctx: StageContext,
  config: GameConfig,
  now: number,
  team?: { members: CardDef[]; helper?: CardDef },
): SaveResult<StageLockReason | TeamRuleViolation | 'inventoryFull' | 'notEnoughStamina'> {
  const lock = stageLockReason(save, stage, ctx, now);
  if (lock) return fail(lock);
  if (!stage.fixedTeam && team) {
    const violation = checkTeamRule(stage.teamRule, team.members, team.helper);
    if (violation) return fail(violation);
  }
  if (save.inventory.cards.length >= save.inventory.capacity) return fail('inventoryFull');
  if (stage.stamina <= 0) return ok(save);
  return spendStamina(save, stage.stamina, config, now);
}

function matchesFilter(unit: { attribute: Attribute; race: Race }, filter: UnitFilter): boolean {
  const has = <T>(v: T | T[] | undefined, x: T) => v === undefined || (Array.isArray(v) ? v.includes(x) : v === x);
  return has(filter.attribute, unit.attribute) && has(filter.race, unit.race);
}

export function checkStar(cond: StarCondition, s: BattleSummary): boolean {
  switch (cond.type) {
    case 'clearWithinTurns': return s.turns <= cond.turns;
    case 'noActiveSkill': return !s.usedActiveSkill;
    case 'teamAll': return s.team.length > 0 && s.team.every((u) => matchesFilter(u, cond.filter));
    case 'maxCombo': return s.maxCombo >= cond.combo;
    case 'noContinue': return s.continues === 0;
  }
}

/** 掉落：每個掉落項獨立判定 */
export function rollDrops(stage: StageDef, rng: Rng): DropDef[] {
  return stage.drops.filter((d) => rng.next() < d.rate);
}

export interface StageClearResult {
  coin: number;
  playerExp: number;
  /** 給出戰隊員的卡片經驗，由養成模組發放 */
  cardExp: number;
  firstClear?: Reward;
  drops: { cardId: string; uid: string }[];
  stars: boolean[];
  /** 這次新拿到的星章（之前沒拿過） */
  newStars: boolean[];
  levelUp?: LevelUpInfo;
}

export function completeStage(
  save: SaveData,
  stage: StageDef,
  summary: BattleSummary,
  ctx: StageContext,
  config: GameConfig,
  rng: Rng,
  now: number,
): { save: SaveData; result: StageClearResult } {
  const firstTime = !save.progress.clearedStages.includes(stage.id);
  const stars = (stage.stars ?? []).map((c) => checkStar(c, summary));
  const prev = save.progress.stars[stage.id] ?? [];
  const merged = stars.map((got, i) => got || !!prev[i]);
  const newStars = stars.map((got, i) => got && !prev[i]);

  let towerFloor = save.progress.towerFloor;
  if (stage.kind === 'tower') {
    const floor = ctx.stages.filter((s) => s.kind === 'tower').findIndex((s) => s.id === stage.id) + 1;
    towerFloor = Math.max(towerFloor, floor);
  }

  let s: SaveData = {
    ...save,
    player: { ...save.player, coin: save.player.coin + stage.rewards.coin },
    progress: {
      ...save.progress,
      clearedStages: firstTime ? [...save.progress.clearedStages, stage.id] : save.progress.clearedStages,
      stars: stars.length > 0 ? { ...save.progress.stars, [stage.id]: merged } : save.progress.stars,
      towerFloor,
    },
  };

  const firstClear = firstTime ? stage.rewards.firstClear : undefined;
  if (firstClear) s = grantReward(s, firstClear, config, now).save;

  const dropped = addCards(s, rollDrops(stage, rng).map((d) => ({ cardId: d.card, level: d.level })), now);
  s = dropped.save;

  const leveled = addPlayerExp(s, stage.rewards.playerExp, config, now);
  s = leveled.save;

  return {
    save: s,
    result: {
      coin: stage.rewards.coin,
      playerExp: stage.rewards.playerExp,
      cardExp: stage.rewards.cardExp ?? 0,
      ...(firstClear ? { firstClear } : {}),
      drops: dropped.added.map((c) => ({ cardId: c.cardId, uid: c.uid })),
      stars,
      newStars,
      ...(leveled.levelUp ? { levelUp: leveled.levelUp } : {}),
    },
  };
}

/** 章節星章進度（集滿領獎用） */
export function chapterStars(save: SaveData, chapter: number, stages: StageDef[]): { got: number; total: number } {
  let got = 0;
  let total = 0;
  for (const st of stages) {
    if (st.kind !== 'main' || st.chapter !== chapter) continue;
    total += st.stars?.length ?? 0;
    got += (save.progress.stars[st.id] ?? []).filter(Boolean).length;
  }
  return { got, total };
}

/** 依卡片資料把隊伍 uid 轉成星章判定需要的屬性與種族 */
export function teamUnits(save: SaveData, uids: (string | null)[], cards: CardDef[]): { attribute: Attribute; race: Race }[] {
  const byId = new Map(cards.map((c) => [c.id, c]));
  return uids.flatMap((uid) => {
    const owned = uid ? save.inventory.cards.find((c) => c.uid === uid) : undefined;
    const def = owned ? byId.get(owned.cardId) : undefined;
    return def ? [{ attribute: def.attribute, race: def.race }] : [];
  });
}
