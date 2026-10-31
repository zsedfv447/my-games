// 哪些戰鬥會影響存檔：正式關卡才扣體力、發獎勵、寫手札、計任務、存續戰；練習場與新手教學都不會（提案 85）。
// 純邏輯，battle.ts 依這份規則決定要不要做這些事，測試直接檢查規則。

export interface BattlePolicy {
  /** 進場扣體力（正式關卡在出戰確認扣，練習場與教學不經過出戰確認） */
  costsStamina: boolean;
  /** 勝利時結算金幣、經驗、掉落、首通與星章 */
  grantsRewards: boolean;
  /** 寫入契印師手札（最高 Combo、通關次數…） */
  recordsNotebook: boolean;
  /** 發出 stageCleared／stageFailed，讓任務與成就計數 */
  emitsStageEvents: boolean;
  /** 每次行動後存進續戰存檔 */
  savesProgress: boolean;
  /** 續戰要付星晶 */
  paidContinue: boolean;
}

export function battlePolicy(kind: { practice: boolean; tutorial?: boolean }): BattlePolicy {
  const official = !kind.practice && !kind.tutorial;
  return {
    costsStamina: official,
    grantsRewards: official,
    recordsNotebook: official,
    emitsStageEvents: official,
    savesProgress: official,
    paidContinue: official,
  };
}
