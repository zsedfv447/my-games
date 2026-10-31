// 第一次遇到某個戰鬥機制時，由引路人說明一次（七曜環、隱藏珠、星紋封印）。
// 看過的記在存檔的 hintsSeen，之後不再出現；練習場一樣會提示。
import type { BattleState } from '../../battle/battle-state';
import { ringOf } from '../../battle/skills/ring';
import { sealedAttributes } from '../../battle/skills/status';
import type { SaveData } from '../../core/types';
import { LABEL } from '../wording';
import { GuideLayer } from './guide-ui';

export const MECHANIC_HINTS = {
  ringShield: [
    '這個敵人帶著「七曜環」！名牌下方的每一格對應一種顏色，環還在的時候，它受到的傷害會大幅減少。',
    '用那個屬性的珠攻擊就能點掉同色的格子；心色的格子要消除心珠才會點掉。',
    '格子全部點掉，環就會碎裂，之後受到的屬性攻擊會加倍。固定傷害點不掉格子，破環要靠轉珠攻擊。',
  ],
  hiddenOrbs: [
    '盤面上出現了「隱藏珠」：看不出顏色，但它還是原本的顏色，連成一線一樣會消除。',
    '用轉換珠子的主動技把它換掉，就能讓它現形。',
  ],
  starSeal: [
    '隊伍中了「星紋封印」：被封印屬性的隊員，這段期間轉珠攻擊無效，也不能施放主動技。',
    '封印的回合數結束就會解除，先靠其他屬性的隊員撐過去吧。',
  ],
} as const satisfies Record<string, readonly string[]>;

export type MechanicHint = keyof typeof MECHANIC_HINTS;

/** 目前盤面與敵我狀態裡出現了哪些需要說明的機制 */
export function mechanicsIn(state: Pick<BattleState, 'enemies' | 'board' | 'teamStatuses' | 'team'>): MechanicHint[] {
  const out: MechanicHint[] = [];
  if (state.enemies.some((e) => e.hp > 0 && ringOf(e) && !ringOf(e)!.shattered)) out.push('ringShield');
  if (state.board.cells.some((o) => o.hidden)) out.push('hiddenOrbs');
  if (sealedAttributes(state as BattleState).length > 0) out.push('starSeal');
  return out;
}

export const hintsSeenOf = (save: SaveData): string[] => save.hintsSeen ?? [];

/** 這次要說明、而且還沒看過的機制 */
export function newMechanics(save: SaveData, state: Parameters<typeof mechanicsIn>[0]): MechanicHint[] {
  const seen = new Set(hintsSeenOf(save));
  return mechanicsIn(state).filter((m) => !seen.has(m));
}

export function markHintsSeen(save: SaveData, ids: readonly string[]): SaveData {
  const seen = hintsSeenOf(save);
  const add = ids.filter((id) => !seen.includes(id));
  return add.length ? { ...save, hintsSeen: [...seen, ...add] } : save;
}

/** 依序說明每個機制，玩家按下「確定」後才結束 */
export async function showMechanicHints(root: HTMLElement, hints: MechanicHint[]): Promise<void> {
  if (!hints.length) return;
  const layer = new GuideLayer(root);
  for (const id of hints) {
    await new Promise<void>((resolve) => {
      layer.say({ lines: [...MECHANIC_HINTS[id]], placement: 'top', actions: [{ label: LABEL.ok, onClick: resolve }] });
    });
  }
  layer.destroy();
}
