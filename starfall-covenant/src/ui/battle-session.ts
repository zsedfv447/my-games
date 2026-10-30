// 關卡戰鬥的存檔流程（中斷續戰）：出戰寫入入場券、開打或還原、每次行動後存快照、離開時清掉
import { resumeBattle, startBattle, type Battle } from '../battle/battle-state';
import { bus } from '../core/events';
import { createRng } from '../core/rng';
import type { StageDef } from '../core/types';
import { gameData } from '../data/load';
import {
  activeBattleFor, beginActiveBattle, clearActiveBattle, dropSeed, recordBattleSnapshot,
} from '../progression/active-battle';
import { confirmDialog } from './components/overlay';
import type { Navigator } from './router';
import { buildSortieTeam } from './sortie';
import { commit, getSave, growth } from './state';

/** 出戰確認扣過體力後呼叫：把隊伍與亂數種子寫進存檔，當作這一關的入場券 */
export function armBattle(stageId: string): void {
  const stage = gameData.stages.find((s) => s.id === stageId);
  if (!stage) return;
  const team = buildSortieTeam(stage, getSave(), growth.card);
  const seed = Math.floor(Math.random() * 2 ** 32);
  commit(beginActiveBattle(getSave(), { stageId, seed, members: team.members, helper: team.helper }, Date.now()));
}

export interface StageBattle {
  battle: Battle;
  /** 出戰的玩家卡 uid（不含助戰、借用隊伍為空） */
  memberUids: string[];
  /** 結算掉落用的亂數種子 */
  dropSeed: number;
  /** 從中斷的戰鬥還原 */
  resumed: boolean;
}

/** 開打或還原這一關的戰鬥；沒有入場券或快照壞掉時回傳錯誤訊息 */
export function openStageBattle(stage: StageDef): StageBattle | string {
  const active = activeBattleFor(getSave(), stage.id);
  if (!active) return '戰鬥已中斷，請重新出發';
  try {
    const battle = active.snapshot
      ? resumeBattle(stage, active.snapshot, gameData)
      : startBattle(stage, active.members, active.helper, createRng(active.seed), gameData);
    if (!active.snapshot) saveBattle(battle);
    return { battle, memberUids: active.members.flatMap((m) => (m.uid ? [m.uid] : [])), dropSeed: dropSeed(active), resumed: !!active.snapshot };
  } catch {
    commit(clearActiveBattle(getSave()));
    return '遊戲資料已更新，無法繼續這場戰鬥';
  }
}

/** 每次行動結算完（動畫之前）就存，重新整理不能反悔或重骰 */
export function saveBattle(battle: Battle): void {
  commit(recordBattleSnapshot(getSave(), battle.snapshot()));
}

/** 撤退、放棄或結算後清掉 */
export function endBattle(): void {
  commit(clearActiveBattle(getSave()));
}

/** 進主城時發現有沒打完的戰鬥：詢問要繼續還是放棄。有詢問時回傳 true */
export function maybeOfferResume(nav: Navigator): boolean {
  const active = getSave().activeBattle;
  const stage = active && gameData.stages.find((s) => s.id === active.stageId);
  if (!active || !stage) return false;
  void confirmDialog('有未完成的戰鬥', `要繼續「${stage.name}」嗎？放棄會視為失敗，已消耗的體力不會退還。`, '繼續', '放棄').then((go) => {
    if (go) return nav.go('battle', [stage.id]);
    endBattle();
    bus.emit('stageFailed', { stageId: stage.id });
  });
  return true;
}
