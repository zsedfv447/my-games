// 把一場正式戰鬥寫進契印師手札：勝利時（battleEnd）或放棄／撤退時（bus 的 stageFailed）各記一次
import { bus } from '../core/events';
import type { Battle } from '../battle/battle-state';
import { analyzeTeam } from '../growth';
import { applyBattleRecord, recordText, turnDamage } from '../progression/records';
import { commit, getSave, growth } from './state';

export interface BattleRecordTracker {
  /** 勝利時刷新的紀錄文字（「新紀錄！最高 Combo 9」），給結算畫面顯示 */
  newRecordTexts(): string[];
  dispose(): void;
}

/** memberUids：出戰的玩家卡（借用隊伍時是空陣列，不計流派） */
export function trackBattleRecords(battle: Battle, stageId: string, memberUids: string[]): BattleRecordTracker {
  let maxTurnDamage = 0;
  let done = false;
  let texts: string[] = [];
  const state = battle.getState();
  const leaderCardId = state.team.find((m) => !m.isHelper)?.cardId;
  const archetype = memberUids.length ? analyzeTeam(getSave(), growth, memberUids).primary : null;

  const record = (won: boolean) => {
    if (done) return;
    done = true;
    const result = battle.getResult();
    const entry = { stageId, won, turns: result?.turns ?? battle.getState().turns, maxCombo: result?.maxCombo ?? battle.getState().maxCombo, maxTurnDamage, leaderCardId, archetype, at: Date.now() };
    const applied = applyBattleRecord(getSave(), entry);
    commit(applied.save);
    texts = applied.newRecords.map((k) => recordText(k, entry));
  };
  const offs = [
    battle.events.on('turnResolved', (s) => { maxTurnDamage = Math.max(maxTurnDamage, turnDamage(s)); }),
    battle.events.on('battleEnd', ({ result }) => { if (result.outcome === 'win') record(true); }),
    bus.on('stageFailed', (e) => { if (e.stageId === stageId) record(false); }),
  ];
  return {
    newRecordTexts: () => texts,
    dispose: () => offs.forEach((off) => off()),
  };
}
