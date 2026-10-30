// 存檔：建立新存檔、版本遷移、校驗碼、匯出匯入存檔碼、讀寫與重置。
// 全部是純函式；實際的 localStorage 由呼叫端以 SaveStorage 注入，方便測試。
import type { GameConfig, SaveData } from '../core/types';
import { bus } from '../core/events';

export const SAVE_KEY = 'starfall.save';
export const CURRENT_SAVE_VERSION = 2;

/** 寫入 localStorage 的外層：存檔本體＋校驗碼（校驗碼只防手動改壞，不防作弊） */
interface SaveEnvelope {
  data: SaveData;
  checksum: string;
}

export type LoadResult =
  | { ok: true; save: SaveData; migratedFrom?: number }
  | { ok: false; reason: 'empty' | 'corrupt' | 'checksum' | 'tooNew' };

/** 與 Storage 介面相容的最小子集，瀏覽器直接傳 window.localStorage */
export interface SaveStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function createNewSave(config: GameConfig, now: number): SaveData {
  const cards = config.newPlayer.starterCards.map((cardId, i) => ({
    uid: `u${i + 1}`, cardId, level: 1, exp: 0, skillLevel: 1, limitBreak: 0, awakened: 0, locked: false, obtainedAt: now,
  }));
  const starterIds = [...new Set(config.newPlayer.starterCards)];
  return {
    version: CURRENT_SAVE_VERSION,
    player: { name: '契印師', level: 1, exp: 0, coin: config.newPlayer.coin, gems: config.newPlayer.gems, tokens: {} },
    stamina: { current: config.stamina.baseMax, lastUpdate: now },
    inventory: { capacity: config.inventory.baseCapacity, cards },
    teams: Array.from({ length: 5 }, (_, i) => ({
      name: `隊伍${i + 1}`,
      members: i === 0 ? [0, 1, 2, 3, 4].map((j) => cards[j]?.uid ?? null) : [null, null, null, null, null],
    })),
    activeTeam: 0,
    progress: { clearedStages: [], stars: {}, towerFloor: 0, tutorialDone: false, storySeen: [] },
    tutorial: { step: 'battle', giftGiven: false },
    gacha: { pityCounter: {}, history: [] },
    collection: { seen: starterIds, owned: starterIds, claimed: [] },
    quests: { counters: {}, claimed: [], dailyResetAt: '', weeklyResetAt: '' },
    daily: { loginDay: 0, lastLogin: '', shopPurchases: {} },
    settings: { bgm: 0.8, sfx: 0.8, battleSpeed: 1 },
  };
}

// ---------- 版本遷移 ----------
/** MIGRATIONS[n] 把 version n 的存檔升到 n+1。新增欄位時加一條，並把 CURRENT_SAVE_VERSION +1。 */
type Migration = (old: Record<string, unknown>) => Record<string, unknown>;
const MIGRATIONS: Record<number, Migration> = {
  // v1 → v2：加入新手教學進度。已經打過關的舊存檔視為老玩家，不再強制教學（之後可在設定重看）
  1: (old) => {
    const progress = (old.progress ?? {}) as Record<string, unknown>;
    const cleared = Array.isArray(progress.clearedStages) && progress.clearedStages.length > 0;
    const done = cleared || progress.tutorialDone === true;
    return {
      ...old,
      progress: { ...progress, tutorialDone: done },
      tutorial: { step: done ? 'done' : 'battle', giftGiven: false },
    };
  },
};

export function migrate(
  raw: Record<string, unknown>,
  migrations: Record<number, Migration> = MIGRATIONS,
  target = CURRENT_SAVE_VERSION,
): Record<string, unknown> {
  let data = raw;
  let v = typeof data.version === 'number' ? data.version : 0;
  while (v < target) {
    const step = migrations[v];
    if (!step) throw new Error(`缺少版本 ${v} → ${v + 1} 的遷移`);
    data = { ...step(data), version: v + 1 };
    v += 1;
  }
  return data;
}

/** 用預設值補齊缺漏欄位（舊存檔、手改存檔少了欄位時不會當機） */
function fillDefaults<T>(value: unknown, defaults: T): T {
  if (Array.isArray(defaults)) return (Array.isArray(value) ? value : defaults) as T;
  if (defaults !== null && typeof defaults === 'object') {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return defaults;
    const out: Record<string, unknown> = { ...(value as Record<string, unknown>) };
    for (const [k, d] of Object.entries(defaults as Record<string, unknown>)) out[k] = fillDefaults(out[k], d);
    return out as T;
  }
  return (typeof value === typeof defaults ? value : defaults) as T;
}

// ---------- 校驗碼 ----------
/** FNV-1a 32 位元雜湊，輸出 8 碼十六進位 */
export function checksum(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export function serializeSave(save: SaveData): string {
  const envelope: SaveEnvelope = { data: save, checksum: checksum(JSON.stringify(save)) };
  return JSON.stringify(envelope);
}

export function parseSave(text: string | null, config: GameConfig, now: number): LoadResult {
  if (!text) return { ok: false, reason: 'empty' };
  let envelope: SaveEnvelope;
  try {
    envelope = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'corrupt' };
  }
  if (!envelope || typeof envelope !== 'object' || !envelope.data || typeof envelope.data !== 'object') {
    return { ok: false, reason: 'corrupt' };
  }
  if (checksum(JSON.stringify(envelope.data)) !== envelope.checksum) return { ok: false, reason: 'checksum' };

  const from = typeof envelope.data.version === 'number' ? envelope.data.version : 0;
  if (from > CURRENT_SAVE_VERSION) return { ok: false, reason: 'tooNew' };
  let migrated: Record<string, unknown>;
  try {
    migrated = migrate(envelope.data as unknown as Record<string, unknown>);
  } catch {
    return { ok: false, reason: 'corrupt' };
  }
  const save = fillDefaults(migrated, createNewSave(config, now));
  return from < CURRENT_SAVE_VERSION ? { ok: true, save, migratedFrom: from } : { ok: true, save };
}

// ---------- 匯出匯入存檔碼（Base64，支援中文） ----------
export function exportSaveCode(save: SaveData): string {
  const bytes = new TextEncoder().encode(serializeSave(save));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export function importSaveCode(code: string, config: GameConfig, now: number): LoadResult {
  let text: string;
  try {
    const bin = atob(code.trim());
    text = new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
  } catch {
    return { ok: false, reason: 'corrupt' };
  }
  return parseSave(text, config, now);
}

// ---------- 讀寫 ----------
export function writeSave(storage: SaveStorage, save: SaveData, now: number): void {
  storage.setItem(SAVE_KEY, serializeSave(save));
  bus.emit('saveWritten', { at: now });
}

/** 讀檔；沒有存檔時回傳新存檔。讀檔失敗時不覆蓋原存檔，交給介面詢問玩家是否重置。 */
export function loadSave(storage: SaveStorage, config: GameConfig, now: number): LoadResult {
  const result = parseSave(storage.getItem(SAVE_KEY), config, now);
  if (!result.ok && result.reason === 'empty') return { ok: true, save: createNewSave(config, now) };
  return result;
}

export function resetSave(storage: SaveStorage, config: GameConfig, now: number): SaveData {
  storage.removeItem(SAVE_KEY);
  const save = createNewSave(config, now);
  writeSave(storage, save, now);
  return save;
}
