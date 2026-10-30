// 任務與成就：把 bus 事件累加成計數器，每日／每週自動重置，達標後領獎
import type { GameConfig, QuestDef, SaveData } from '../core/types';
import type { EventBus, GameEvents } from '../core/events';
import { fail, ok, type SaveResult } from './result';
import { grantReward } from './rewards';
import { dateKey, weekKey } from './time';
import { puzzleOf } from './puzzle';

/**
 * 計數器名稱（QuestDef.counter 只能用這些）：
 * - stageClear：通關次數；stageClear:main / :daily / :event / :tower / :trial / :side 依關卡種類
 * - stageClear3Stars：拿滿該關全部星章的通關次數
 * - stageFail：失敗次數
 * - comboTotal：累計 Combo；comboBest：單回合最高 Combo（取最大值）
 * - combo5 / combo8 / combo10：單回合達到該 Combo 的次數
 * - orbsCleared：累計消除珠數
 * - gachaPull：召喚次數（十連算 10）
 * - cardObtained、cardEnhance、cardEvolve
 * - login：領取每日登入獎勵的天數；shopPurchase：商店購買次數；questClaim:daily：領取每日任務的個數
 *   （這三個不是 bus 事件，由介面在領取／購買成功後呼叫 addQuestCounters）
 * - 成就專用、由存檔推算的數值（見 derivedCounters）：playerLevel、cardsOwned、towerFloor、mainCleared、trialCleared
 * - 新手契約另外可用的推算數值：teamEdited（隊伍跟開新存檔時不同）、helperClears（帶流浪契印師通關次數）、
 *   puzzleSolved（解過的每日謎題天數）、chapterRewards（領過的章節星章獎勵數）、
 *   summoned（召喚紀錄筆數）、evolvedOwned（圖鑑裡擁有過的進化後型態張數）
 * 新手契約（kind starter）跟成就一樣用終身計數、不重置；推算數值讓老玩家讀檔時就能直接算達成
 */
export const COMBO_THRESHOLDS = [5, 8, 10] as const;
const MAX_COUNTERS = new Set(['comboBest']);

const KNOWN_COUNTERS = new Set([
  'stageClear', 'stageClear3Stars', 'stageFail', 'comboTotal', 'comboBest', 'orbsCleared',
  'gachaPull', 'cardObtained', 'cardEnhance', 'cardEvolve',
  ...COMBO_THRESHOLDS.map((t) => `combo${t}`),
  ...['main', 'daily', 'event', 'tower', 'trial', 'side'].map((k) => `stageClear:${k}`),
  'login', 'shopPurchase', 'questClaim:daily',
]);

/** 由存檔直接推算、不靠事件累加的數值；舊存檔也能立即反映，只給成就使用 */
export const DERIVED_COUNTERS = [
  'playerLevel', 'cardsOwned', 'towerFloor', 'mainCleared', 'trialCleared',
  'teamEdited', 'helperClears', 'puzzleSolved', 'chapterRewards', 'summoned', 'evolvedOwned',
] as const;
export type DerivedCounters = Partial<Record<(typeof DERIVED_COUNTERS)[number], number>>;

/** evolvedForms：所有「進化後型態」的卡號（由呼叫端依卡片資料提供；沒給時 evolvedOwned 為 0） */
export function derivedCounters(
  save: SaveData,
  stageKindOf: (stageId: string) => string | undefined,
  evolvedForms: ReadonlySet<string> = new Set(),
): DerivedCounters {
  const cleared = (kind: string) => save.progress.clearedStages.filter((id) => stageKindOf(id) === kind).length;
  return {
    playerLevel: save.player.level,
    cardsOwned: save.collection.owned.length,
    towerFloor: save.progress.towerFloor,
    mainCleared: cleared('main'),
    trialCleared: cleared('trial'),
    teamEdited: teamEdited(save) ? 1 : 0,
    helperClears: Object.values(save.helperBond ?? {}).reduce((a, b) => a + b, 0),
    puzzleSolved: puzzleOf(save).solvedDays.length,
    chapterRewards: save.progress.chapterRewardsClaimed.length,
    summoned: save.gacha.history.length,
    evolvedOwned: save.collection.owned.filter((id) => evolvedForms.has(id)).length,
  };
}

/** 編過隊：有卡片不在開新存檔時的位置（第一隊第 j 格是 u{j+1}，其他隊伍全空） */
function teamEdited(save: SaveData): boolean {
  return save.teams.some((t, i) => t.members.some((uid, j) => uid !== null && uid !== (i === 0 ? `u${j + 1}` : null)));
}

/** 不重置、用終身計數的任務種類 */
const LIFETIME_KINDS: QuestDef['kind'][] = ['achievement', 'starter'];

/** quests.json 的 counter 只能用上面列出的名稱 */
export const isKnownCounter = (name: string, kind: QuestDef['kind'] = 'achievement') =>
  KNOWN_COUNTERS.has(name) || (LIFETIME_KINDS.includes(kind) && (DERIVED_COUNTERS as readonly string[]).includes(name));

export type QuestCounterDelta = Record<string, number>;

/** 每次事件該加的計數。stageKind 由呼叫端查關卡資料後傳入。 */
export function countersForEvent<K extends keyof GameEvents>(
  type: K,
  payload: GameEvents[K],
  extra: { stageKind?: string } = {},
): QuestCounterDelta {
  const p = payload as never as Record<string, unknown>;
  switch (type) {
    case 'comboResolved': {
      const combo = p.combo as number;
      const out: QuestCounterDelta = { comboTotal: combo, comboBest: combo, orbsCleared: p.orbsCleared as number };
      for (const t of COMBO_THRESHOLDS) if (combo >= t) out[`combo${t}`] = 1;
      return out;
    }
    case 'stageCleared': {
      const stars = p.stars as boolean[];
      return {
        stageClear: 1,
        ...(extra.stageKind ? { [`stageClear:${extra.stageKind}`]: 1 } : {}),
        ...(stars.length > 0 && stars.every(Boolean) ? { stageClear3Stars: 1 } : {}),
      };
    }
    case 'stageFailed': return { stageFail: 1 };
    case 'gachaPulled': return { gachaPull: p.count as number };
    case 'cardObtained': return { cardObtained: 1 };
    case 'cardEnhanced': return { cardEnhance: 1 };
    case 'cardEvolved': return { cardEvolve: 1 };
    default: return {};
  }
}

/** 存檔裡的計數鍵：成就與新手契約用原名（終身累計），每日加 d: 前綴，每週加 w: 前綴 */
const keyFor = (kind: QuestDef['kind'], counter: string) =>
  kind === 'daily' ? `d:${counter}` : kind === 'weekly' ? `w:${counter}` : counter;

/** 跨日／跨週時清除每日、每週的計數與已領紀錄 */
export function resetQuestsIfNeeded(save: SaveData, quests: QuestDef[], now: number): SaveData {
  const today = dateKey(now);
  const week = weekKey(now);
  const resetDaily = save.quests.dailyResetAt !== today;
  const resetWeekly = save.quests.weeklyResetAt !== week;
  if (!resetDaily && !resetWeekly) return save;
  const kindOf = new Map(quests.map((q) => [q.id, q.kind]));
  const counters: Record<string, number> = {};
  for (const [k, v] of Object.entries(save.quests.counters)) {
    if ((resetDaily && k.startsWith('d:')) || (resetWeekly && k.startsWith('w:'))) continue;
    counters[k] = v;
  }
  const claimed = save.quests.claimed.filter((id) => {
    const kind = kindOf.get(id);
    return !((resetDaily && kind === 'daily') || (resetWeekly && kind === 'weekly'));
  });
  return { ...save, quests: { counters, claimed, dailyResetAt: today, weeklyResetAt: week } };
}

export function addQuestCounters(save: SaveData, delta: QuestCounterDelta, quests: QuestDef[], now: number): SaveData {
  const s = resetQuestsIfNeeded(save, quests, now);
  const counters = { ...s.quests.counters };
  for (const [name, n] of Object.entries(delta)) {
    for (const key of [name, `d:${name}`, `w:${name}`]) {
      counters[key] = MAX_COUNTERS.has(name) ? Math.max(counters[key] ?? 0, n) : (counters[key] ?? 0) + n;
    }
  }
  return { ...s, quests: { ...s.quests, counters } };
}

export function questProgress(
  save: SaveData,
  quest: QuestDef,
  derived: DerivedCounters = {},
): { value: number; done: boolean; claimed: boolean } {
  const fromSave = LIFETIME_KINDS.includes(quest.kind) ? derived[quest.counter as keyof DerivedCounters] : undefined;
  const value = Math.min(quest.target, fromSave ?? save.quests.counters[keyFor(quest.kind, quest.counter)] ?? 0);
  return { value, done: value >= quest.target, claimed: save.quests.claimed.includes(quest.id) };
}

export function claimQuest(
  save: SaveData,
  quest: QuestDef,
  quests: QuestDef[],
  config: GameConfig,
  now: number,
  derived: DerivedCounters = {},
): SaveResult<'notDone' | 'alreadyClaimed'> {
  const s = resetQuestsIfNeeded(save, quests, now);
  const p = questProgress(s, quest, derived);
  if (p.claimed) return fail('alreadyClaimed');
  if (!p.done) return fail('notDone');
  const granted = grantReward(s, quest.reward, config, now).save;
  const claimed = { ...granted, quests: { ...granted.quests, claimed: [...granted.quests.claimed, quest.id] } };
  return ok(quest.kind === 'daily' ? addQuestCounters(claimed, { 'questClaim:daily': 1 }, quests, now) : claimed);
}

/** 目前可以領取（達標但未領）的任務；用於紅點與「全部領取」 */
export function claimableQuests(save: SaveData, quests: QuestDef[], now: number, derived: DerivedCounters = {}): QuestDef[] {
  const s = resetQuestsIfNeeded(save, quests, now);
  return quests.filter((q) => {
    const p = questProgress(s, q, derived);
    return p.done && !p.claimed;
  });
}

/**
 * 一次領取所有已達標的任務（只限 kinds 指定的種類）。
 * 會重複檢查幾輪：領取每日任務會推進「領取 N 個每日任務」，讓它在同一次操作中也能領到。
 * derive 依目前存檔重新推算成就數值（領卡片獎勵可能改變收集數）。
 */
export function claimAllQuests(
  save: SaveData,
  kinds: QuestDef['kind'][],
  quests: QuestDef[],
  config: GameConfig,
  now: number,
  derive: (save: SaveData) => DerivedCounters = () => ({}),
): { save: SaveData; claimed: QuestDef[] } {
  let s = resetQuestsIfNeeded(save, quests, now);
  const claimed: QuestDef[] = [];
  for (;;) {
    const ready = claimableQuests(s, quests, now, derive(s)).filter((q) => kinds.includes(q.kind));
    const before = claimed.length;
    for (const q of ready) {
      const r = claimQuest(s, q, quests, config, now, derive(s));
      if (r.ok) { s = r.save; claimed.push(q); }
    }
    if (claimed.length === before) break;
  }
  return { save: s, claimed };
}

/**
 * 把任務計數接到事件匯流排。update 由持有存檔的一方（介面）提供：收到函式後套用到目前存檔並存檔。
 * 回傳取消訂閱的函式。
 */
export function subscribeQuestCounters(
  bus: EventBus<GameEvents>,
  update: (fn: (save: SaveData) => SaveData) => void,
  quests: QuestDef[],
  stageKindOf: (stageId: string) => string | undefined,
  now: () => number = Date.now,
): () => void {
  const types: (keyof GameEvents)[] = [
    'comboResolved', 'stageCleared', 'stageFailed', 'gachaPulled', 'cardObtained', 'cardEnhanced', 'cardEvolved',
  ];
  const offs = types.map((type) =>
    bus.on(type, (payload) => {
      const stageId = (payload as { stageId?: string }).stageId;
      const delta = countersForEvent(type, payload, { stageKind: stageId ? stageKindOf(stageId) : undefined });
      if (Object.keys(delta).length > 0) update((s) => addQuestCounters(s, delta, quests, now()));
    }),
  );
  return () => offs.forEach((off) => off());
}
