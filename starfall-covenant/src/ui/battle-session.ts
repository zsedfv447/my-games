// 關卡戰鬥的存檔流程（中斷續戰）：出戰寫入入場券、開打或還原、每次行動後存快照、離開時清掉
import { resumeBattle, startBattle, type Battle } from '../battle/battle-state';
import { bus } from '../core/events';
import { createRng } from '../core/rng';
import type { StageDef } from '../core/types';
import { battleDataFor, findStage } from './stage-lookup';
import {
  abandonActiveBattle, activeBattleFor, beginActiveBattle, clearActiveBattle, dropSeed, recordBattleSnapshot,
} from '../progression/active-battle';
import { planDrops, planMatches, type DropPlan } from '../progression/drops';
import { applyOathTeam, isOathId, oathModifiers, type OathId } from '../progression/oaths';
import { codexEnemies, markEnemiesSeen } from '../progression/bestiary';
import { gameData } from '../data/load';
import { confirmDialog, confirmOnScreen } from './components/overlay';
import type { Navigator } from './router';
import { buildSortieTeam } from './sortie';
import { commit, getSave, growth } from './state';

let codexIds: Set<string> | undefined;
const codexEnemyIds = () => (codexIds ??= new Set(codexEnemies(gameData.enemies, gameData.stages).map((e) => e.id)));

/** 出戰確認扣過體力後呼叫：把隊伍、亂數種子、骰好的掉落與刻下的誓約寫進存檔，當作這一關的入場券 */
export function armBattle(stageId: string, drops?: DropPlan, oaths: readonly OathId[] = []): void {
  const stage = findStage(stageId);
  if (!stage) return;
  // 誓約碑：不帶助戰、只帶 4 人在這裡套用
  const team = applyOathTeam(buildSortieTeam(stage, getSave(), growth.card), oaths);
  const seed = Math.floor(Math.random() * 2 ** 32);
  const plan = drops && planMatches(drops, stage) ? drops : planDrops(stage, createRng(dropSeed({ seed })));
  const armed = beginActiveBattle(getSave(), { stageId, seed, members: team.members, helper: team.helper, drops: plan, oaths: [...oaths] }, Date.now());
  // 星骸觀測錄：開戰就記下這一關的敵人
  commit(markEnemiesSeen(armed, stage, codexEnemyIds()));
}

export interface StageBattle {
  battle: Battle;
  /** 出戰的玩家卡 uid（不含助戰、借用隊伍為空） */
  memberUids: string[];
  /** 結算用的亂數種子 */
  dropSeed: number;
  /** 進場時骰好的掉落 */
  drops: DropPlan;
  /** 從中斷的戰鬥還原 */
  resumed: boolean;
  /** 刻下的誓約（誓約碑） */
  oaths: OathId[];
}

/** 開打或還原這一關的戰鬥；沒有入場券或快照壞掉時回傳錯誤訊息 */
export function openStageBattle(stage: StageDef): StageBattle | string {
  const active = activeBattleFor(getSave(), stage.id);
  if (!active) return '戰鬥已中斷，請重新出發';
  try {
    const oaths = (active.oaths ?? []).filter(isOathId);
    // 續戰快照自己帶著誓約的狀態；新開的戰鬥照入場券上的誓約加上
    const battle = active.snapshot
      ? resumeBattle(stage, active.snapshot, battleDataFor(stage))
      : startBattle(stage, active.members, active.helper, createRng(active.seed), battleDataFor(stage), undefined, oathModifiers(oaths));
    if (!active.snapshot) saveBattle(battle);
    const drops = planMatches(active.drops, stage) ? active.drops : { stageId: stage.id, drops: [] };
    return { battle, memberUids: active.members.flatMap((m) => (m.uid ? [m.uid] : [])), dropSeed: dropSeed(active), drops, resumed: !!active.snapshot, oaths };
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

/** 在戰鬥畫面以外放棄進行中的戰鬥：視為失敗（手札記一場、任務計數），體力不退 */
export function abandonBattle(): void {
  const r = abandonActiveBattle(getSave());
  if (!r) return;
  commit(r.save);
  bus.emit('stageFailed', { stageId: r.stageId });
}

/** 出戰前檢查：已有進行中的戰鬥時詢問。回傳 'resume' 直接回到那場戰鬥、'start' 可以出發、'cancel' 不出發 */
export async function confirmNewBattle(stageId: string): Promise<'resume' | 'start' | 'cancel'> {
  const active = getSave().activeBattle;
  if (!active) return 'start';
  const name = findStage(active.stageId)?.name ?? active.stageId;
  if (active.stageId === stageId) {
    const go = await confirmDialog('有未完成的戰鬥', `「${name}」還有沒打完的戰鬥，要直接繼續嗎？重新出發會視為放棄，並再次消耗體力。`, '繼續', '重新出發');
    if (go) return 'resume';
  } else if (!(await confirmDialog('放棄進行中的戰鬥？', `「${name}」還沒打完。放棄會視為失敗，已消耗的體力不會退還。`, '放棄並出發', '取消'))) {
    return 'cancel';
  }
  abandonBattle();
  return 'start';
}

/** 進主城時發現有沒打完的戰鬥：詢問要繼續還是放棄。有詢問時回傳 true */
export function maybeOfferResume(nav: Navigator): boolean {
  const active = getSave().activeBattle;
  const stage = active && findStage(active.stageId);
  if (!active || !stage) return false;
  // 還沒選就換了畫面：不繼續也不放棄，下次回主城再問
  void confirmOnScreen('有未完成的戰鬥', `要繼續「${stage.name}」嗎？放棄會視為失敗，已消耗的體力不會退還。`, '繼續', '放棄').then((go) => {
    if (go === null) return;
    if (go) return nav.go('battle', [stage.id]);
    abandonBattle();
  });
  return true;
}
