// 敵人圖片來源：有專屬圖用專屬圖；跟別的敵人共用同一張（或只換色）的，改用 enemySvg 程式產生的圖（提案 48）
import type { EnemyDef } from '../../core/types';
import shared from '../../../assets/user/enemy-art-shared.json';
import { resolveArtPath, userAsset } from '../assets';

export interface SharedArtGroup {
  /** 保留這張圖的敵人 */
  owner: string;
  /** 圖片和 owner 相同或只換色、改用程式產生圖的敵人 */
  borrowers: string[];
  minSimilarity: number;
}

export const SHARED_ENEMY_ART: SharedArtGroup[] = shared.groups;

const borrowed = new Set(SHARED_ENEMY_ART.flatMap((g) => g.borrowers));

/** 沒有專屬圖時回傳 undefined，呼叫端畫 enemySvg */
export function enemyArtUrl(e: Pick<EnemyDef, 'id' | 'art'>): string | undefined {
  if (borrowed.has(e.id)) return undefined;
  return userAsset('enemies', e.id) ?? resolveArtPath(e.art.sprite);
}
