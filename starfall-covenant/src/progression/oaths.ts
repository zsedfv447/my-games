// 誓約碑（提案 97）：已通關的主線關卡，出戰前自選 1～3 條限制（誓約），通關後依點數拿額外獎勵。純邏輯。
//
// 規則：
// - 每條誓約都用既有的戰鬥積木實作：我方或敵人身上的永久狀態（技能封印、轉珠縮短、心珠封印、星紋封印、狂暴、Combo 盾），
//   或出戰隊伍的組成（不帶助戰、只帶 4 人、單一屬性）。誓約在戰鬥中是「強制生效」的，玩家不可能違反。
// - 唯一會破壞誓約的是**續戰**：用了續戰仍可以通關，但不給誓約獎勵（誓約破除）。
// - 獎勵每週重置：同一關這週打出更高的誓約點數，才補發「新點數獎勵 − 這週已拿的點數獎勵」的差額。
//   內容是金幣、星核（依關卡 Boss 屬性）與少量星晶；每週星晶最多 WEEKLY_GEM_CAP 顆，不給星輝結晶。
// - 適用：已通關的主線關卡（kind = main）；星淵回廊（abyss）、活動、每日、塔、外傳都不適用。
// - 紀錄放 SaveData.oaths（選填），讀取經過 oathsOf 補預設值。

import type { Attribute, CardDef, EnemyDef, Reward, SaveData, StageDef } from '../core/types';
import type { BattleModifiers } from '../battle/battle-state';
import type { StatusInstance } from '../battle/runtime';
import { weekKey } from './time';

export type OathId =
  | 'noSkill' | 'shortMove' | 'noHearts' | 'sealLeader' | 'enemyRage' | 'comboWall'
  | 'noHelper' | 'fourMembers' | 'monoAttribute';

export interface OathDef {
  id: OathId;
  name: string;
  description: string;
  points: number;
}

export const OATHS: OathDef[] = [
  { id: 'noSkill', name: '靜默之誓', description: '整場不能施放主動技', points: 2 },
  { id: 'shortMove', name: '疾手之誓', description: '轉珠時間 −2 秒', points: 2 },
  { id: 'noHearts', name: '無癒之誓', description: '消除心珠不回復，也不算進隊長技條件', points: 2 },
  { id: 'sealLeader', name: '縛星之誓', description: '開場 3 回合隊長屬性被星紋封印', points: 1 },
  { id: 'enemyRage', name: '怒潮之誓', description: '所有敵人攻擊 ×1.5', points: 2 },
  { id: 'comboWall', name: '連星之誓', description: '所有敵人帶 Combo 盾：未達 4 Combo 時屬性攻擊無效', points: 3 },
  { id: 'noHelper', name: '孤行之誓', description: '不帶助戰出發', points: 1 },
  { id: 'fourMembers', name: '少數之誓', description: '只帶前 4 名隊員出發（不含助戰）', points: 1 },
  { id: 'monoAttribute', name: '一色之誓', description: '隊員與助戰都要和隊長同屬性', points: 2 },
];

export const MAX_OATHS = 3;
export const WEEKLY_GEM_CAP = 10;

const byId = new Map(OATHS.map((o) => [o.id, o]));
export const oathDef = (id: OathId) => byId.get(id)!;
export const isOathId = (v: unknown): v is OathId => typeof v === 'string' && byId.has(v as OathId);

/** 選擇是否合法：1～3 條、不重複、都存在；合法回傳 null */
export function oathSelectionProblem(ids: readonly string[]): string | null {
  if (ids.length === 0) return '至少選 1 條誓約';
  if (ids.length > MAX_OATHS) return `最多選 ${MAX_OATHS} 條誓約`;
  if (new Set(ids).size !== ids.length) return '誓約不能重複';
  if (!ids.every(isOathId)) return '有不存在的誓約';
  return null;
}

export const oathPoints = (ids: readonly OathId[]): number => ids.reduce((n, id) => n + (byId.get(id)?.points ?? 0), 0);

/** 這一關能不能刻誓約：已通關的主線關卡 */
export function oathEligible(stage: Pick<StageDef, 'id' | 'kind'>, save: Pick<SaveData, 'progress'>): boolean {
  return stage.kind === 'main' && save.progress.clearedStages.includes(stage.id);
}

// ---------- 戰鬥中的效果（用既有的狀態積木） ----------

const forever = (s: Omit<StatusInstance, 'turns'> & { turns?: number | null }): StatusInstance => ({ turns: null, ...s });

/** 誓約轉成開戰時的狀態：我方開場就有、敵人每一波出場時就有 */
export function oathModifiers(ids: readonly OathId[]): BattleModifiers {
  const team: StatusInstance[] = [];
  const enemy: StatusInstance[] = [];
  for (const id of ids) {
    switch (id) {
      case 'noSkill': team.push(forever({ id: 'skillSeal' })); break;
      case 'shortMove': team.push(forever({ id: 'moveTimeDown', value: 2 })); break;
      case 'noHearts': team.push(forever({ id: 'heartSeal' })); break;
      case 'sealLeader': team.push({ id: 'attributeSeal', turns: 3, params: { attribute: 'leader' } }); break;
      case 'enemyRage': enemy.push(forever({ id: 'enrage', value: 1.5 })); break;
      case 'comboWall': enemy.push(forever({ id: 'comboShield', value: 4 })); break;
      // 隊伍組成類在出戰時處理（applyOathTeam）
    }
  }
  return { teamStatuses: team, enemyStatuses: enemy, oaths: [...ids] };
}

/** 出戰隊伍套用誓約：不帶助戰、只帶前 4 人 */
export function applyOathTeam<M, H>(team: { members: M[]; helper: H | null }, ids: readonly OathId[]): { members: M[]; helper: H | null } {
  return {
    members: ids.includes('fourMembers') ? team.members.slice(0, 4) : team.members,
    helper: ids.includes('noHelper') ? null : team.helper,
  };
}

/** 隊伍不符合誓約時的原因（一色之誓）；沒問題回傳 null */
export function oathTeamProblem(ids: readonly OathId[], members: Pick<CardDef, 'attribute'>[], helper: Pick<CardDef, 'attribute'> | null): string | null {
  if (!ids.includes('monoAttribute') || members.length === 0) return null;
  const lead = members[0].attribute;
  const all = helper && !ids.includes('noHelper') ? [...members, helper] : members;
  return all.every((m) => m.attribute === lead) ? null : '一色之誓：隊員與助戰都要和隊長同屬性';
}

// ---------- 獎勵 ----------

/** 這個點數能拿的獎勵總量（每週補差額） */
export function oathRewardFor(points: number): { coin: number; cores: number; gems: number } {
  return { coin: 400 * points, cores: Math.floor(points / 3), gems: points >= 7 ? 2 : points >= 5 ? 1 : 0 };
}

export interface OathRecord {
  /** 這筆紀錄屬於哪一週（weekKey） */
  week: string;
  /** 本週每一關打出的最高誓約點數 */
  best: Record<string, number>;
  /** 本週已拿的星晶 */
  gems: number;
  /** 歷來最高誓約點數（手札） */
  highest: number;
}

export function oathsOf(save: Pick<SaveData, 'oaths'>, now: number): OathRecord {
  const week = weekKey(now);
  const r = save.oaths;
  if (!r) return { week, best: {}, gems: 0, highest: 0 };
  // 換週：本週紀錄歸零，歷來最高保留
  return r.week === week ? { ...r, best: { ...r.best } } : { week, best: {}, gems: 0, highest: r.highest ?? 0 };
}

/** 星核：依關卡 Boss（最後一波第一隻）的屬性挑對應的星核素材卡 */
export function oathCoreCard(stage: Pick<StageDef, 'waves'>, enemies: Pick<EnemyDef, 'id' | 'attribute'>[], cards: Pick<CardDef, 'id' | 'name' | 'race' | 'attribute'>[]): string | null {
  const bossId = stage.waves.at(-1)?.enemies[0];
  const attr: Attribute | undefined = enemies.find((e) => e.id === bossId)?.attribute;
  return cards.find((c) => c.race === 'material' && c.name.endsWith('星核') && c.attribute === attr)?.id ?? null;
}

export type OathClaim =
  | { ok: true; save: SaveData; reward: Reward; points: number; newHighest: boolean }
  | { ok: false; reason: 'notWon' | 'broken' | 'noOaths' | 'notBetter'; save: SaveData };

/**
 * 通關後結算誓約：沒贏、用過續戰（誓約破除）、或本週這關已經拿過同點數以上，都不給。
 * 給的是新點數與本週已拿點數獎勵的差額；星晶受每週上限限制。回傳的 reward 由呼叫端用 grantReward 發放。
 */
export function settleOath(
  save: SaveData,
  stage: Pick<StageDef, 'id'>,
  ids: readonly OathId[],
  outcome: { won: boolean; continues: number },
  coreCardId: string | null,
  now: number,
): OathClaim {
  if (!ids.length) return { ok: false, reason: 'noOaths', save };
  if (!outcome.won) return { ok: false, reason: 'notWon', save };
  if (outcome.continues > 0) return { ok: false, reason: 'broken', save };
  const record = oathsOf(save, now);
  const points = oathPoints(ids);
  const prev = record.best[stage.id] ?? 0;
  const highest = Math.max(record.highest, points);
  const newHighest = points > record.highest;
  if (points <= prev) return { ok: false, reason: 'notBetter', save: { ...save, oaths: { ...record, highest } } };
  const now_ = oathRewardFor(points);
  const was = oathRewardFor(prev);
  const gems = Math.max(0, Math.min(now_.gems - was.gems, WEEKLY_GEM_CAP - record.gems));
  const cores = now_.cores - was.cores;
  const reward: Reward = { coin: now_.coin - was.coin };
  if (gems > 0) reward.gems = gems;
  if (cores > 0 && coreCardId) reward.cards = [{ card: coreCardId, count: cores }];
  const next: OathRecord = { ...record, best: { ...record.best, [stage.id]: points }, gems: record.gems + gems, highest };
  return { ok: true, save: { ...save, oaths: next }, reward, points, newHighest };
}
