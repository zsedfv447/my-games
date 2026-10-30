import type { SaveData } from '../core/types';

/** 操作存檔的純函式統一回傳：成功給新存檔，失敗給原因代碼（介面再翻成文字） */
export type SaveResult<R extends string = string> = { ok: true; save: SaveData } | { ok: false; reason: R };

export const ok = (save: SaveData): { ok: true; save: SaveData } => ({ ok: true, save });
export const fail = <R extends string>(reason: R): { ok: false; reason: R } => ({ ok: false, reason });
