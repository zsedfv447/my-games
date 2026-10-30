// 同行情誼的結算接線：借用 NPC 助戰通關後加點，跨過門檻時回傳結算提示與感謝台詞（battle.ts 只呼叫這裡）
import type { CardDef, StageDef } from '../core/types';
import { addBondOnClear, BOND_FRAME_TIER, BOND_TIERS, bondDef, npcForHelperCard } from '../progression/helper-bond';
import { HELPER_NPCS } from '../progression/helpers';
import type { ResultNote } from './components/reward-reveal';
import { commit, getSave } from './state';
import type { LeaderLine } from './victory-line';

export interface BondClear {
  notes: ResultNote[];
  /** 這次跨過門檻才有：NPC 的感謝台詞，結算時取代隊長台詞（兩句不會同時出現） */
  thanks?: LeaderLine;
}

/** 正式關卡勝利、存檔已寫入後呼叫；借用隊伍（流派試煉）的助戰不是 NPC，不加點 */
export function helperBondOnClear(stage: StageDef, helperCard: CardDef | undefined): BondClear {
  if (!helperCard || stage.fixedTeam) return { notes: [] };
  const npc = npcForHelperCard(helperCard.id, HELPER_NPCS);
  if (!npc) return { notes: [] };
  const gain = addBondOnClear(getSave(), npc.id);
  commit(gain.save);
  const def = bondDef(npc.id);
  if (!gain.unlocked.length || !def) return { notes: [] };
  const notes: ResultNote[] = gain.unlocked.map((t) => ({
    text: `與${npc.name}的情誼達到 ${BOND_TIERS[t]}：解鎖回憶〈${def.stories[t].title}〉`,
    big: t === BOND_FRAME_TIER,
  }));
  if (gain.unlocked.includes(BOND_FRAME_TIER)) notes.push({ text: `獲得${npc.name}的星契頭像框`, big: true });
  const last = gain.unlocked[gain.unlocked.length - 1];
  return { notes, thanks: { card: helperCard, text: def.thanks[last], speaker: npc.name } };
}
