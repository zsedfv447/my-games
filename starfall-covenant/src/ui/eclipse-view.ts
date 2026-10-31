// 星蝕難度在畫面上的接線：用關卡 id 找關卡（星蝕 id 即時轉換）、戰鬥用的敵人資料、星蝕版的紀錄
import './eclipse.css';
import type { StageDef } from '../core/types';
import { gameData } from '../data/load';
import type { BattleData } from '../battle/battle-state';
import { eclipseEnemies, eclipseStarsOf, isEclipseCleared, isEclipseId, resolveStage } from '../progression/eclipse';
import type { SaveData } from '../core/types';

/** 關卡 id → 關卡（包含星蝕版） */
export const stageById = (id: string): StageDef | undefined => resolveStage(id, gameData);

/** 這一關的戰鬥資料：星蝕關卡補上星蝕版敵人 */
export const battleDataFor = (stage: StageDef): BattleData =>
  isEclipseId(stage.id) ? { ...gameData, enemies: eclipseEnemies(stage, gameData.enemies) } : gameData;

/** 通關過了沒（星蝕版看 save.eclipse） */
export const stageCleared = (save: SaveData, stage: StageDef): boolean =>
  isEclipseId(stage.id) ? isEclipseCleared(save, stage.id) : save.progress.clearedStages.includes(stage.id);

/** 已拿到的星章（星蝕版看 save.eclipse） */
export const stageStars = (save: SaveData, stage: StageDef): boolean[] =>
  isEclipseId(stage.id) ? eclipseStarsOf(save, stage.id) : save.progress.stars[stage.id] ?? [];
