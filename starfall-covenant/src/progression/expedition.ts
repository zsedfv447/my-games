// 星靈遠行：把沒上場的卡派到已通關章節的星座，經過真實時間後帶回金幣、塵靈與少量星核。純邏輯，操作 SaveData。
// 用開始時間戳記結算（離線也算，跟體力一樣）；改裝置時間的問題不處理。
import type { Attribute, CardDef, ChapterDef, GameConfig, Race, Reward, SaveData, StageDef } from '../core/types';
import { createRng } from '../core/rng';
import { expeditionUids, teamUids } from '../growth/save-ops';
import { grantReward } from './rewards';

export interface Expedition {
  id: string;
  chapter: number;
  uids: string[];
  hours: number;
  startedAt: number;
}

export const EXPEDITION = {
  hours: [2, 4, 8],
  maxParties: 3,
  maxMembers: 3,
  /** 每多一位隊員，收穫 +25% */
  perExtraMember: 0.25,
  /** 種族對上星座的比例 × 50% */
  raceBonus: 0.5,
  /** 每「單位」（小時 × 人數加成 × 種族加成）的收穫期望值 */
  perUnit: { coin: 35, dust: 0.03, glow: 0.01, flare: 0.002, core: 0.004 },
} as const;

const HOUR = 3_600_000;

/** 各屬性的塵靈（微光／燭光／烈光）與星核卡號 */
const MATERIALS: Record<Attribute, { dust: string; glow: string; flare: string; core: string }> = {
  fire: { dust: 'c901', glow: 'c902', flare: 'c903', core: 'c916' },
  water: { dust: 'c904', glow: 'c905', flare: 'c906', core: 'c917' },
  wood: { dust: 'c907', glow: 'c908', flare: 'c909', core: 'c918' },
  light: { dust: 'c910', glow: 'c911', flare: 'c912', core: 'c919' },
  dark: { dust: 'c913', glow: 'c914', flare: 'c915', core: 'c920' },
};

export const expeditionsOf = (save: SaveData): Expedition[] => save.expeditions ?? [];

export const returnAt = (e: Expedition): number => e.startedAt + e.hours * HOUR;
export const hasReturned = (e: Expedition, now: number): boolean => now >= returnAt(e);

/** 可以去的章節：該章最後一關主線已通過 */
export function openChapters(save: SaveData, chapters: ChapterDef[], stages: StageDef[]): ChapterDef[] {
  const cleared = new Set(save.progress.clearedStages);
  return chapters.filter((c) => {
    const list = stages.filter((s) => s.kind === 'main' && s.chapter === c.chapter);
    return list.length > 0 && cleared.has(list[list.length - 1].id);
  });
}

export type DispatchProblem =
  | 'chapterLocked' | 'badHours' | 'tooManyParties' | 'memberCount'
  | 'cardNotFound' | 'duplicated' | 'locked' | 'inTeam' | 'onExpedition' | 'material';

export const DISPATCH_TEXT: Record<DispatchProblem, string> = {
  chapterLocked: '通過這一章後才能前往',
  badHours: '遠行時間只能選 2、4、8 小時',
  tooManyParties: `最多同時 ${EXPEDITION.maxParties} 隊遠行`,
  memberCount: `每隊 1～${EXPEDITION.maxMembers} 張卡`,
  cardNotFound: '找不到這張卡',
  duplicated: '同一張卡選了兩次',
  locked: '上鎖的卡不能遠行',
  inTeam: '隊伍中的卡不能遠行',
  onExpedition: '這張卡已經在遠行中',
  material: '素材卡不能遠行',
};

export interface DispatchInput {
  chapter: number;
  uids: string[];
  hours: number;
}

/** 能不能出發；可以時回傳 null */
export function dispatchProblem(
  save: SaveData, input: DispatchInput, chapters: ChapterDef[], stages: StageDef[], card: (id: string) => CardDef | undefined,
): DispatchProblem | null {
  if (!openChapters(save, chapters, stages).some((c) => c.chapter === input.chapter)) return 'chapterLocked';
  if (!(EXPEDITION.hours as readonly number[]).includes(input.hours)) return 'badHours';
  if (expeditionsOf(save).length >= EXPEDITION.maxParties) return 'tooManyParties';
  if (input.uids.length < 1 || input.uids.length > EXPEDITION.maxMembers) return 'memberCount';
  if (new Set(input.uids).size !== input.uids.length) return 'duplicated';
  const inTeam = teamUids(save);
  const away = expeditionUids(save);
  for (const uid of input.uids) {
    const owned = save.inventory.cards.find((c) => c.uid === uid);
    if (!owned) return 'cardNotFound';
    if (card(owned.cardId)?.race === 'material') return 'material';
    if (owned.locked) return 'locked';
    if (inTeam.has(uid)) return 'inTeam';
    if (away.has(uid)) return 'onExpedition';
  }
  return null;
}

export function dispatch(
  save: SaveData, input: DispatchInput, chapters: ChapterDef[], stages: StageDef[], card: (id: string) => CardDef | undefined, now: number,
): { ok: true; save: SaveData; expedition: Expedition } | { ok: false; reason: DispatchProblem } {
  const problem = dispatchProblem(save, input, chapters, stages, card);
  if (problem) return { ok: false, reason: problem };
  const expedition: Expedition = { id: `ex-${now.toString(36)}-${expeditionsOf(save).length}`, chapter: input.chapter, uids: [...input.uids], hours: input.hours, startedAt: now };
  return { ok: true, save: { ...save, expeditions: [...expeditionsOf(save), expedition] }, expedition };
}

/** 收穫單位：小時 ×（1 + 25% × 多出的隊員）×（1 + 50% × 種族對上星座的比例） */
export function expeditionUnits(hours: number, races: Race[], chapterRace: Race | undefined): number {
  const n = races.length;
  if (n === 0) return 0;
  const match = chapterRace ? races.filter((r) => r === chapterRace).length : 0;
  return hours * (1 + EXPEDITION.perExtraMember * (n - 1)) * (1 + (EXPEDITION.raceBonus * match) / n);
}

/** 期望值的整數部分一定給，小數部分擲骰（用開始時間當種子，同一趟遠行結果固定） */
function roll(ev: number, rng: () => number): number {
  const base = Math.floor(ev);
  return base + (rng() < ev - base ? 1 : 0);
}

/** 這一趟遠行的收穫；塵靈與星核依第一張卡（隊長）的屬性 */
export function expeditionReward(e: Expedition, members: CardDef[], chapterRace: Race | undefined): Reward {
  if (!members.length) return {};
  const units = expeditionUnits(e.hours, members.map((m) => m.race), chapterRace);
  const rng = createRng(e.startedAt ^ (e.chapter * 7919) ^ (e.uids.length * 104729));
  const next = () => rng.next();
  const mat = MATERIALS[members[0].attribute];
  const p = EXPEDITION.perUnit;
  const counts: [string, number][] = [
    [mat.dust, roll(units * p.dust, next)],
    [mat.glow, roll(units * p.glow, next)],
    [mat.flare, roll(units * p.flare, next)],
    [mat.core, roll(units * p.core, next)],
  ];
  const cards = counts.filter(([, n]) => n > 0).map(([card, count]) => ({ card, count }));
  return { coin: Math.round(units * p.coin), ...(cards.length ? { cards } : {}) };
}

/** 領回：時間到了才能領，領完這一隊解散、卡片回到可用狀態 */
export function finishExpedition(save: SaveData, id: string, now: number): { ok: true; save: SaveData; expedition: Expedition } | { ok: false; reason: 'notFound' | 'notReturned' } {
  const e = expeditionsOf(save).find((x) => x.id === id);
  if (!e) return { ok: false, reason: 'notFound' };
  if (!hasReturned(e, now)) return { ok: false, reason: 'notReturned' };
  return { ok: true, save: { ...save, expeditions: expeditionsOf(save).filter((x) => x.id !== id) }, expedition: e };
}

/** 提前召回：沒有收穫，卡片立刻回來 */
export function recallExpedition(save: SaveData, id: string): SaveData {
  return { ...save, expeditions: expeditionsOf(save).filter((x) => x.id !== id) };
}

/** 領回並發放收穫（finishExpedition＋expeditionReward＋grantReward） */
export function claimExpedition(
  save: SaveData, id: string, now: number, chapters: ChapterDef[], card: (id: string) => CardDef | undefined, config: GameConfig,
): { ok: true; save: SaveData; reward: Reward } | { ok: false; reason: 'notFound' | 'notReturned' } {
  const done = finishExpedition(save, id, now);
  if (!done.ok) return done;
  const members = done.expedition.uids.flatMap((uid) => {
    const owned = save.inventory.cards.find((c) => c.uid === uid);
    const def = owned && card(owned.cardId);
    return def ? [def] : [];
  });
  const reward = expeditionReward(done.expedition, members, chapters.find((c) => c.chapter === done.expedition.chapter)?.race);
  return { ok: true, save: grantReward(done.save, reward, config, now).save, reward };
}
