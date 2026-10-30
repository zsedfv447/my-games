// 角色羈絆的結算接線：出戰的玩家角色通關後各 +1，跨過門檻時回傳解鎖小劇場的結算提示（battle.ts 只呼叫這裡）
import type { StageDef } from '../core/types';
import { addCardBondsOnClear, CARD_BOND_TIERS, cardBondDef, teamFamilies } from '../progression/card-bond';
import type { ResultNote } from './components/reward-reveal';
import { commit, getSave, growth } from './state';

/** 正式關卡勝利、存檔已寫入後呼叫；uids 是出戰的玩家卡（借用隊伍時為空，不加點） */
export function cardBondOnClear(stage: StageDef, uids: string[]): ResultNote[] {
  if (stage.fixedTeam || !uids.length) return [];
  const r = addCardBondsOnClear(getSave(), teamFamilies(getSave(), uids, growth.family));
  commit(r.save);
  // 沒有小劇場的角色只累計點數，不提示
  return r.gains.flatMap((g) => {
    const def = cardBondDef(g.family);
    if (!def) return [];
    const name = growth.card(g.family)?.name ?? g.family;
    return g.unlocked.map((t) => ({
      text: `與${name}的羈絆達到 ${CARD_BOND_TIERS[t]} 場：解鎖小劇場〈${def.scenes[t].title}〉`,
      chip: `♥ 羈絆 ${CARD_BOND_TIERS[t]}`,
      play: def.scenes[t].lines,
    }));
  });
}
