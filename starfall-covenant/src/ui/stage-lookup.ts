// 找關卡：stages.json 的固定關卡，或星淵回廊依週與層數產生的關卡（不在 gameData.stages 裡）
import type { StageDef } from '../core/types';
import { gameData } from '../data/load';
import type { GameData } from '../data/validate';
import { abyssFloor, parseAbyssId } from '../progression/abyss';

export function findStage(id: string): StageDef | undefined {
  const fixed = gameData.stages.find((s) => s.id === id);
  if (fixed) return fixed;
  const abyss = parseAbyssId(id);
  return abyss ? abyssFloor(abyss.week, abyss.floor, gameData.enemies).stage : undefined;
}

/** 戰鬥用的資料：星淵回廊的關卡要把這一層產生的敵人加進 enemies */
export function battleDataFor(stage: StageDef): GameData {
  const abyss = stage.kind === 'abyss' ? parseAbyssId(stage.id) : null;
  if (!abyss) return gameData;
  return { ...gameData, enemies: [...gameData.enemies, ...abyssFloor(abyss.week, abyss.floor, gameData.enemies).enemies] };
}
