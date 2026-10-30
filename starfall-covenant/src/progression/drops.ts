// 戰鬥中看得到的掉落：付體力進場時就把掉落骰好、分配給某一波的某隻敵人。
// 這份 DropPlan 跟著入場券走，撤退或重新整理都不會重骰；通關時 completeStage 直接用它發卡。
// 純 JSON，可以原樣存進存檔。

import type { Rng } from '../core/rng';
import type { StageDef } from '../core/types';
import { rollDrops } from './stages';

export interface PlannedDrop {
  cardId: string;
  level?: number;
  /** 帶著這份掉落的敵人：第幾波（0 起算）、該波第幾隻 */
  wave: number;
  enemy: number;
}

export interface DropPlan {
  stageId: string;
  drops: PlannedDrop[];
}

/** 進場時骰掉落（機率與結算時相同），每份掉落隨機交給一隻敵人（每隻敵人機會相同） */
export function planDrops(stage: StageDef, rng: Rng): DropPlan {
  const slots = stage.waves.flatMap((w, wave) => w.enemies.map((_, enemy) => ({ wave, enemy })));
  const drops = rollDrops(stage, rng).flatMap((d) => {
    if (!slots.length) return [];
    const slot = slots[Math.floor(rng.next() * slots.length)];
    return [{ cardId: d.card, ...(d.level !== undefined ? { level: d.level } : {}), ...slot }];
  });
  return { stageId: stage.id, drops };
}

/** 這份計畫是不是這一關的（入場券和關卡對不上時不能拿來發卡） */
export function planMatches(plan: DropPlan | null | undefined, stage: StageDef): plan is DropPlan {
  return !!plan && plan.stageId === stage.id && plan.drops.every((d) => stage.waves[d.wave]?.enemies[d.enemy] !== undefined);
}

/** 某隻敵人身上帶著幾份掉落 */
export function dropsOn(plan: DropPlan | null | undefined, wave: number, enemy: number): PlannedDrop[] {
  return plan?.drops.filter((d) => d.wave === wave && d.enemy === enemy) ?? [];
}

/** 結算用：轉成 completeStage 要的掉落清單 */
export function plannedCards(plan: DropPlan): { cardId: string; level?: number }[] {
  return plan.drops.map(({ cardId, level }) => (level !== undefined ? { cardId, level } : { cardId }));
}
