// 第 7 章終 Boss 前的「並肩之光」：依存檔裡的羈絆與情誼，在劇情後面多加幾句（只讀存檔，不影響戰鬥數值）
// 名稱刻意不用「誓約」，避免跟誓約碑（progression/oaths.ts）混淆
import type { StoryLine } from '../core/types';
import { CARD_BOND_TIERS } from '../progression/card-bond';
import { BOND_TIERS } from '../progression/helper-bond';

/** 會在這段劇情後面加上並肩之光的劇情 id */
export const COMPANION_LIGHT_STORY_ID = 'ch7-boss';
/** 卡片羈絆達到第一個門檻（出戰通關 10 場）才會亮起 */
export const COMPANION_CARD_BOND = CARD_BOND_TIERS[0];
/** 助戰情誼達到第一個門檻（5 點）才會開口 */
export const COMPANION_HELPER_BOND = BOND_TIERS[0];
/** 最多列出幾位隊員，避免劇情太長 */
export const COMPANION_MAX_MEMBERS = 4;

export interface CompanionLightInput {
  /** 出戰的玩家隊員（不含助戰）：卡名與該卡家族的羈絆點數 */
  members: { name: string; bond: number }[];
  /** 帶來助戰卡的流浪契印師與情誼點數；借用隊伍或沒帶助戰時省略 */
  helper?: { name: string; bond: number };
}

export function companionLightLines(input: CompanionLightInput): StoryLine[] {
  const bonded = input.members.filter((m) => m.bond >= COMPANION_CARD_BOND).slice(0, COMPANION_MAX_MEMBERS);
  const helper = input.helper && input.helper.bond >= COMPANION_HELPER_BOND ? input.helper : undefined;
  const lines: StoryLine[] = bonded.map((m) => ({ text: `${m.name}的星紋，在燈座的光裡亮了起來。` }));
  if (helper) lines.push({ speaker: helper.name, text: '這一仗，我也站在你旁邊。' });
  const count = bonded.length + (helper ? 1 : 0);
  lines.push({ text: count ? `${count} 道光連成一圈。瑟隆身上的環，輕輕晃了一下。` : '燈座的光映出你們每一個人的臉。瑟隆身上的環，輕輕晃了一下。' });
  return lines;
}
