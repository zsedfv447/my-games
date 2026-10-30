// 介面讀取玩家資料的入口。
// 存檔模組（src/save/）完成前先用新玩家預設值；之後只需要把 getSave／saveSettings 接到存檔模組，畫面不用改。
import type { SaveData } from '../core/types';
import { gameData } from '../data/load';
import { audio } from './audio';

type Settings = SaveData['settings'] & { showMoveTimer: boolean };

export interface PlayerView {
  name: string;
  level: number;
  coin: number;
  gems: number;
  stamina: number;
  staminaMax: number;
}

const SETTINGS_KEY = 'starfall.ui-settings';
const listeners = new Set<() => void>();

function loadSettings(): Settings {
  const defaults: Settings = { bgm: 0.8, sfx: 0.8, battleSpeed: 1, showMoveTimer: true };
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') };
  } catch {
    return defaults;
  }
}

let settings = loadSettings();
audio.setVolumes(settings.bgm, settings.sfx);

export function getPlayer(): PlayerView {
  const { newPlayer, stamina } = gameData.config;
  return { name: '契印師', level: 1, coin: newPlayer.coin, gems: newPlayer.gems, stamina: stamina.baseMax, staminaMax: stamina.baseMax };
}

export function getSettings(): Readonly<Settings> {
  return settings;
}

export function updateSettings(patch: Partial<Settings>): void {
  settings = { ...settings, ...patch };
  audio.setVolumes(settings.bgm, settings.sfx);
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // 無痕模式等情況存不了，設定只在本次有效
  }
  notify();
}

export function onStateChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function notify(): void {
  listeners.forEach((fn) => fn());
}
