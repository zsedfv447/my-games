import type { SaveData } from '../core/types';

export type GrowthErrorCode =
  | 'cardNotFound' | 'unknownCard' | 'cardLocked' | 'cardInTeam'
  | 'noMaterials' | 'tooManyMaterials' | 'materialNotFound' | 'materialIsTarget'
  | 'materialDuplicated' | 'materialLocked' | 'materialInTeam' | 'wrongMaterial'
  | 'notEnoughCoin' | 'notEnoughGems'
  | 'maxLevel' | 'notMaxLevel' | 'cannotEvolve'
  | 'noActiveSkill' | 'maxSkillLevel' | 'maxLimitBreak'
  | 'noAwakening' | 'maxAwakening' | 'limitBreakRequired'
  | 'inventoryFull' | 'capacityMax' | 'notOwned' | 'alreadyClaimed';

export interface GrowthError {
  code: GrowthErrorCode;
  /** 給玩家看的繁體中文說明 */
  message: string;
  /** 出問題的卡片 uid 或卡號 */
  subject?: string;
}

/** 所有會改存檔的操作都回傳這個：成功時帶新存檔與結果細節，失敗時帶原因，原存檔不變 */
export type GrowthResult<D extends object = object> =
  | ({ ok: true; save: SaveData } & D)
  | { ok: false; error: GrowthError };

export type GrowthFailure = { ok: false; error: GrowthError };

export const fail = (code: GrowthErrorCode, message: string, subject?: string): GrowthFailure => ({
  ok: false,
  error: subject === undefined ? { code, message } : { code, message, subject },
});
