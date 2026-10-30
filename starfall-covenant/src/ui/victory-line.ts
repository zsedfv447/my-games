// 隊長勝利台詞（cards.json 的 lines.victory）：結算第一幕由隊長說一句；沒有專屬台詞就用屬性預設句。純邏輯。
import type { Attribute, CardDef } from '../core/types';

export const DEFAULT_VICTORY: Record<Attribute, string> = {
  fire: '火還沒熄。下一場，也交給我吧。',
  water: '潮水退去了。大家都平安。',
  wood: '新芽冒出來了。我們繼續前進。',
  light: '星光還在。這條路沒有走錯。',
  dark: '黑夜過去了。……暫時，安全了。',
};

export function victoryLine(card: Pick<CardDef, 'attribute' | 'lines'>): string {
  return card.lines?.victory || DEFAULT_VICTORY[card.attribute];
}

export interface LeaderLine {
  card: CardDef;
  text: string;
  /** 說話的人；沒給就用卡名（流浪契印師的感謝台詞用 NPC 名字） */
  speaker?: string;
}

/** 結算第一幕的隊長台詞：隊伍裡第一位不是助戰的成員 */
export function leaderLineOf(state: { team: { card: CardDef; isHelper: boolean }[] }): LeaderLine | undefined {
  const leader = state.team.find((m) => !m.isHelper)?.card;
  return leader && { card: leader, text: victoryLine(leader) };
}
