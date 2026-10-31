// 星蝕難度在畫面上的接線：星蝕版的通關與星章紀錄（找關卡與戰鬥資料走 stage-lookup.ts）
import './eclipse.css';
import type { SaveData, StageDef } from '../core/types';
import { eclipseStarsOf, isEclipseCleared, isEclipseId } from '../progression/eclipse';

/** 通關過了沒（星蝕版看 save.eclipse） */
export const stageCleared = (save: SaveData, stage: StageDef): boolean =>
  isEclipseId(stage.id) ? isEclipseCleared(save, stage.id) : save.progress.clearedStages.includes(stage.id);

/** 已拿到的星章（星蝕版看 save.eclipse） */
export const stageStars = (save: SaveData, stage: StageDef): boolean[] =>
  isEclipseId(stage.id) ? eclipseStarsOf(save, stage.id) : save.progress.stars[stage.id] ?? [];
