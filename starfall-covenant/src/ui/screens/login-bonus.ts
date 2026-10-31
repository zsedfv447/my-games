// 7 日登入：主城每天第一次進入時自動跳出，也可以從主城捷徑打開
import { gameData } from '../../data/load';
import type { SaveData } from '../../core/types';
import { claimLoginReward, canClaimLogin } from '../../progression/login';
import { dateKey } from '../../progression/time';
import { addQuestCounters } from '../../progression/quests';
import { button, panel } from '../components/basic';
import { openDialog, toast } from '../components/overlay';
import { rewardArt, rewardChips, screenBanner } from '../components/rewards';
import { revealReward } from '../components/reward-reveal';
import { clear, h } from '../dom';
import { loginCalendar, loginRewards } from '../economy';
import type { ScreenDef } from '../router';
import { commit, getSave } from '../state';
import { isTutorialActive } from '../tutorial/flow';
import { LABEL } from '../wording';

/** 領取今天的登入獎勵並存檔；成功回傳 true */
export function claimToday(): boolean {
  const now = Date.now();
  const r = claimLoginReward(getSave(), loginRewards, gameData.config, now);
  if (!r.ok) {
    toast(r.reason === 'alreadyClaimed' ? '今天已經領過了' : '沒有可領的獎勵');
    return false;
  }
  commit(addQuestCounters(r.save, { login: 1 }, gameData.quests, now));
  void revealReward('七日星約', r.reward, `第 ${r.day} 天登入獎勵`);
  return true;
}

export function loginGrid(): HTMLElement {
  return h('div', { class: 'login-grid' }, loginCalendar(getSave(), Date.now()).map((d) =>
    h('div', { class: ['login-day', d.state, d.day === loginRewards.length && 'big'] },
      h('span', { class: 'login-day-no' }, `第 ${d.day} 天`),
      rewardArt(d.reward, d.day === loginRewards.length ? 'login-chest' : undefined),
      rewardChips(d.reward),
      (d.state === 'claimed' || d.state === 'claimedToday') && h('span', { class: 'login-stamp' }, '已領'))));
}

function claimButton(after: () => void): HTMLButtonElement {
  const can = canClaimLogin(getSave(), Date.now());
  return button(can ? '領取今日獎勵' : '明天再來', {
    variant: 'primary', block: true, disabled: !can, icon: 'gift', sound: false,
    onClick: () => { if (claimToday()) after(); },
  });
}

/** 主城一個遊戲階段只自動跳一次，玩家關掉後不再打擾 */
let popupShownFor = '';

/**
 * 主城要不要自動跳出登入獎勵：今天還沒領、這一天還沒跳過，而且新手教學已經結束或略過
 * （教學中不打斷引導，紅點仍會提示）。以前用「打過任何關卡」判斷，新存檔走完或略過教學後、
 * 還沒通關前每天都不會跳。
 */
export function shouldAutoShowLogin(save: SaveData, now: number, shownFor: string): boolean {
  return !isTutorialActive(save) && canClaimLogin(save, now) && shownFor !== dateKey(now);
}

/** 回傳這次有沒有跳出（主城用來決定要不要接著跳契約週報） */
export function maybeShowLoginPopup(onClaimed?: () => void): boolean {
  const now = Date.now();
  if (!shouldAutoShowLogin(getSave(), now, popupShownFor)) return false;
  popupShownFor = dateKey(now);
  const body = h('div', { class: 'login-popup' }, loginGrid());
  const dlg = openDialog('七日星約', body, [
    button(LABEL.later, { variant: 'ghost', sound: 'back', onClick: () => dlg.close() }),
    button('領取', { variant: 'primary', icon: 'gift', sound: false, onClick: () => { if (claimToday()) { dlg.close(); onClaimed?.(); } } }),
  ], { scope: 'route' });
  return true;
}

export const loginBonusScreen: ScreenDef = {
  name: 'login-bonus',
  title: '每日登入',
  chrome: 'sub',
  parent: 'home',
  render() {
    const root = h('div', { class: 'economy-screen' });
    const draw = () => {
      clear(root);
      root.append(
        screenBanner('login-banner', '七日星約', '每天第一次登入可領一次，第 7 天後重新開始；中斷不會重置'),
        loginGrid(),
        claimButton(draw),
        panel(null, h('p', { class: 'small-text dim' }, '每天午夜 00:00（裝置時間）可再領一次。領取登入獎勵也會計入每日、每週任務。')),
      );
    };
    draw();
    return root;
  },
};
