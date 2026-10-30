// 介面讀寫玩家資料的入口：存檔放在記憶體，操作後透過 commit() 寫回 localStorage 並通知畫面更新。
// 規則全部在 save/、progression/、growth/ 的純函式；這裡只負責保存目前的存檔與時間。
import type { SaveData } from '../core/types';
import { gameData } from '../data/load';
import { createGrowthContext, type GrowthContext } from '../growth';
import { maxStamina } from '../progression/player';
import { msUntilNextStamina, regenStamina } from '../progression/stamina';
import {
  createNewSave, exportSaveCode, importSaveCode, loadSave, resetSave, writeSave, type LoadResult, type SaveStorage,
} from '../save/save';
import { audio } from './audio';

/** 只影響介面、不屬於存檔規格的偏好 */
interface UiPrefs {
  showMoveTimer: boolean;
  /** 主動技施放演出與隊員攻擊演出 */
  battleFx: boolean;
  /** 轉珠與受擊時的震動回饋（navigator.vibrate） */
  vibration: boolean;
  /** 低特效：關掉閃光、震畫面等較耗效能的效果 */
  lowFx: boolean;
}

const UI_PREF_KEYS: (keyof UiPrefs)[] = ['showMoveTimer', 'battleFx', 'vibration', 'lowFx'];

export interface PlayerView {
  name: string;
  level: number;
  coin: number;
  gems: number;
  stamina: number;
  staminaMax: number;
  /** 下一點體力回復的毫秒數；滿了為 0 */
  staminaNextMs: number;
}

const PREFS_KEY = 'starfall.ui-prefs';
const listeners = new Set<() => void>();

/** localStorage 不能用（無痕模式、權限）時退回記憶體，遊戲照玩，只是不會留存 */
function pickStorage(): SaveStorage {
  try {
    const probe = '__starfall_probe__';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return localStorage;
  } catch {
    const mem = new Map<string, string>();
    return { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => void mem.set(k, v), removeItem: (k) => void mem.delete(k) };
  }
}

const storage = pickStorage();
const config = gameData.config;

let save: SaveData;
/** 讀檔失敗（校驗碼不符、格式壞掉）時的原因；畫面據此詢問玩家要不要重置 */
let loadProblem: Exclude<LoadResult, { ok: true }>['reason'] | null = null;

{
  const loaded = loadSave(storage, config, Date.now());
  if (loaded.ok) {
    save = withStarterCards(loaded.save);
  } else {
    loadProblem = loaded.reason;
    // 不覆蓋壞掉的存檔，先用新存檔在記憶體裡玩，等玩家決定
    save = resetSaveInMemory();
  }
}

/**
 * 開發早期（還沒有卡片資料時）建立的存檔沒有起始卡，正式關卡無法出戰。
 * 背包是空的、也還沒通過任何關卡時，補發新玩家起始卡並編入隊伍 1。
 */
function withStarterCards(s: SaveData): SaveData {
  if (s.inventory.cards.length || s.progress.clearedStages.length || !config.newPlayer.starterCards.length) return s;
  const fresh = createNewSave(config, Date.now());
  return { ...s, inventory: fresh.inventory, teams: fresh.teams, collection: fresh.collection };
}

function resetSaveInMemory(): SaveData {
  const mem = new Map<string, string>();
  return resetSave({ getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => void mem.set(k, v), removeItem: () => {} }, config, Date.now());
}

let prefs: UiPrefs = { showMoveTimer: true, battleFx: true, vibration: true, lowFx: false };
try {
  prefs = { ...prefs, ...JSON.parse(storage.getItem(PREFS_KEY) ?? '{}') };
} catch {
  // 偏好壞掉就用預設
}
audio.setVolumes(save.settings.bgm, save.settings.sfx);

export const growth: GrowthContext = createGrowthContext(gameData);

/** 目前存檔（已結算體力回復）；請當作唯讀 */
export function getSave(): SaveData {
  const regen = regenStamina(save, config, Date.now());
  if (regen !== save) save = regen;
  return save;
}

/** 寫入新的存檔：關鍵操作（戰鬥結算、抽卡、強化、購買）後立即存檔（GDD 2.4） */
export function commit(next: SaveData): void {
  save = next;
  if (!loadProblem) writeSave(storage, save, Date.now());
  notify();
}

export function getLoadProblem() {
  return loadProblem;
}

export function getPlayer(): PlayerView {
  const s = getSave();
  const now = Date.now();
  return {
    name: s.player.name,
    level: s.player.level,
    coin: s.player.coin,
    gems: s.player.gems,
    stamina: s.stamina.current,
    staminaMax: maxStamina(s.player.level, config),
    staminaNextMs: msUntilNextStamina(s, config, now),
  };
}

export type Settings = SaveData['settings'] & UiPrefs;

export function getSettings(): Readonly<Settings> {
  return { ...getSave().settings, ...prefs };
}

export function updateSettings(patch: Partial<Settings>): void {
  const saved: Partial<SaveData['settings']> = {};
  const ui: Partial<UiPrefs> = {};
  for (const [k, v] of Object.entries(patch)) {
    if ((UI_PREF_KEYS as string[]).includes(k)) Object.assign(ui, { [k]: v });
    else Object.assign(saved, { [k]: v });
  }
  if (Object.keys(ui).length) {
    prefs = { ...prefs, ...ui };
    try {
      storage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {
      // 存不了就只在本次有效
    }
  }
  const s = getSave();
  const settings = { ...s.settings, ...saved };
  audio.setVolumes(settings.bgm, settings.sfx);
  if (Object.keys(saved).length) commit({ ...s, settings });
  else notify();
}

export function exportCode(): string {
  return exportSaveCode(getSave());
}

const LOAD_ERRORS: Record<Exclude<LoadResult, { ok: true }>['reason'], string> = {
  empty: '存檔碼是空的',
  corrupt: '存檔碼格式不正確',
  checksum: '存檔碼內容被改動過，無法讀取',
  tooNew: '這是較新版本遊戲的存檔，請先更新遊戲',
};

export function loadErrorText(reason: keyof typeof LOAD_ERRORS): string {
  return LOAD_ERRORS[reason];
}

/** 匯入存檔碼；成功回傳 null，失敗回傳原因文字 */
export function importCode(code: string): string | null {
  const result = importSaveCode(code, config, Date.now());
  if (!result.ok) return LOAD_ERRORS[result.reason];
  loadProblem = null;
  commit(result.save);
  return null;
}

export function resetAll(): void {
  loadProblem = null;
  save = resetSave(storage, config, Date.now());
  notify();
}

export function onStateChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function notify(): void {
  listeners.forEach((fn) => fn());
}
