// 找關卡：stages.json 的固定關卡、星淵回廊依週與層數產生的關卡，或主線關卡的星蝕版（後兩者不在 gameData.stages 裡）
import type { StageDef } from '../core/types';
import { gameData } from '../data/load';
import type { GameData } from '../data/validate';
import { abyssFloor, parseAbyssId } from '../progression/abyss';
import { eclipseEnemies, isEclipseId, resolveStage } from '../progression/eclipse';

export function findStage(id: string): StageDef | undefined {
  const fixed = gameData.stages.find((s) => s.id === id);
  if (fixed) return fixed;
  // 星蝕：「原關卡 id@eclipse」即時轉換（progression/eclipse.ts）
  if (isEclipseId(id)) return resolveStage(id, gameData);
  const abyss = parseAbyssId(id);
  return abyss ? abyssFloor(abyss.week, abyss.floor, gameData.enemies).stage : undefined;
}

/** 戰鬥用的資料：星淵回廊的關卡要把這一層產生的敵人加進 enemies；星蝕關卡補上星蝕版敵人 */
export function battleDataFor(stage: StageDef): GameData {
  if (isEclipseId(stage.id)) return { ...gameData, enemies: eclipseEnemies(stage, gameData.enemies) };
  const abyss = stage.kind === 'abyss' ? parseAbyssId(stage.id) : null;
  if (!abyss) return gameData;
  const enemies = abyssFloor(abyss.week, abyss.floor, gameData.enemies).enemies;
  return { ...gameData, enemies: [...gameData.enemies, ...(abyssDebugWeak() ? enemies.map((e) => ({ ...e, hp: 1, abilities: [] })) : enemies)] };
}

/** 開發模式除錯：localStorage「debug.abyssWeak」=1 時星淵敵人生命變 1，用來實測發獎與進度（正式版不生效） */
function abyssDebugWeak(): boolean {
  if (!import.meta.env?.DEV) return false;
  try {
    return localStorage.getItem('debug.abyssWeak') === '1';
  } catch {
    return false;
  }
}
