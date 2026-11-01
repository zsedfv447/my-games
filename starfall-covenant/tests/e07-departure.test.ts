// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { prepareScreen } from '../src/ui/screens/prepare';
import { commit, getSave } from '../src/ui/state';
import { createNewSave } from '../src/save/save';
import { gameData } from '../src/data/load';
import { beginActiveBattle } from '../src/progression/active-battle';
import { confirmNewBattle } from '../src/ui/battle-session';
import { setOverlayHost } from '../src/ui/components/overlay';
import { closeRouteScoped } from '../src/ui/route-scope';
import type { Navigator } from '../src/ui/router';
import { bus } from '../src/core/events';

const NOW = 1793487600000;
const stage = gameData.stages.find(s => s.id === 'st-1-1')!;
const settle = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
let host: HTMLElement;
let leave: (() => void)[];
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(NOW);
  closeRouteScoped(); document.body.replaceChildren();
  host = document.createElement('div'); document.body.append(host); setOverlayHost(host); leave = [];
  const save = createNewSave(gameData.config, NOW);
  save.tutorial = { step: 'done', giftGiven: true }; save.progress.tutorialDone = true;
  save.progress.storySeen = Object.keys(gameData.story);
  commit(save);
});
afterEach(() => { leave.forEach(fn => fn()); closeRouteScoped(); vi.useRealTimers(); vi.restoreAllMocks(); });
function oldBattle(id = 'st-1-2') {
  const s = getSave();
  commit(beginActiveBattle(s, { stageId: id, seed: 123, members: [{ cardId: s.inventory.cards[0].cardId, level: 1, uid: s.inventory.cards[0].uid }], helper: null, drops: { stageId: id, drops: [] } }, NOW));
}
function render() {
  const nav: Navigator = { go: vi.fn(), replace: vi.fn(), back: vi.fn(), backTo: vi.fn() };
  const root = prepareScreen.render({ route: { name: 'prepare', args: [stage.id], query: {} }, nav, onLeave: fn => leave.push(fn) });
  host.append(root);
  const button = root.querySelector<HTMLButtonElement>('[data-tut="sortie"] button')!;
  expect(button.disabled).toBe(false);
  return { root, button, nav };
}
function answer(label: string): HTMLButtonElement {
  const el = [...host.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')].find(b => b.textContent === label);
  expect(el, label).toBeDefined(); return el!;
}
function dispose() { leave.forEach(fn => fn()); closeRouteScoped(); }

describe('出發只結算一次且受畫面生命週期限制', () => {
  it('同一 task 真實 DOM 連點只扣一次、arm 一張入場券、導航一次', async () => {
    const { button, nav } = render(); const before = getSave().stamina.current;
    const writes: unknown[] = []; const off = bus.on('saveWritten', e => writes.push(e));
    button.click(); button.click(); await settle(); off();
    expect(before - getSave().stamina.current).toBe(stage.stamina);
    expect(getSave().activeBattle?.stageId).toBe(stage.id);
    // 一次入場扣款 commit + 一次 armBattle commit，不是兩套交易。
    expect(writes).toHaveLength(2);
    expect(nav.go).toHaveBeenCalledTimes(1);
    const ticket = JSON.stringify(getSave());
    button.click(); await settle();
    expect(JSON.stringify(getSave())).toBe(ticket);
    expect(nav.go).toHaveBeenCalledTimes(1);
  });
  it('確認未回答時不開重複對話框；取消後仍可重新出發', async () => {
    oldBattle(); const before = JSON.stringify(getSave());
    const { button, nav } = render();
    button.click(); button.click();
    expect(host.querySelectorAll('[role="dialog"]')).toHaveLength(1);
    answer('取消').click(); await settle(); vi.advanceTimersByTime(200);
    expect(JSON.stringify(getSave())).toBe(before); expect(nav.go).not.toHaveBeenCalled();
    button.click(); expect(host.querySelectorAll('[role="dialog"]')).toHaveLength(1);
    answer('放棄並出發').click(); await settle();
    expect(getSave().activeBattle?.stageId).toBe(stage.id); expect(nav.go).toHaveBeenCalledTimes(1);
  });
  it('體力不足不鎖死，補足後可以重試且只扣一次', async () => {
    commit({ ...getSave(), stamina: { current: 0, lastUpdate: NOW } });
    const { button, nav } = render(); button.click(); await settle();
    expect(getSave().activeBattle).toBeNull(); expect(nav.go).not.toHaveBeenCalled();
    commit({ ...getSave(), stamina: { current: 30, lastUpdate: NOW } });
    button.click(); button.click(); await settle();
    expect(getSave().stamina.current).toBe(30 - stage.stamina); expect(nav.go).toHaveBeenCalledTimes(1);
  });
  it('沒有舊戰鬥也會在 await 後重查離頁，不扣款或導航', async () => {
    const { button, nav } = render(); const before = JSON.stringify(getSave());
    button.click(); dispose(); await settle();
    expect(JSON.stringify(getSave())).toBe(before); expect(nav.go).not.toHaveBeenCalled();
    button.click(); await settle(); expect(JSON.stringify(getSave())).toBe(before);
  });
  it('未回答便離頁，殘留確認按鈕 callback 不放棄原戰鬥', async () => {
    oldBattle(); const { button, nav } = render(); const before = JSON.stringify(getSave());
    button.click(); const stale = answer('放棄並出發'); dispose(); stale.click(); await settle();
    expect(JSON.stringify(getSave())).toBe(before); expect(nav.go).not.toHaveBeenCalled();
  });
  it('確認後微任務尚未結算便離頁，不放棄舊戰鬥或扣款', async () => {
    oldBattle(); const { button, nav } = render(); const before = JSON.stringify(getSave());
    button.click(); answer('放棄並出發').click(); dispose(); await settle();
    expect(JSON.stringify(getSave())).toBe(before); expect(nav.go).not.toHaveBeenCalled();
  });
  it('同關重新出發連點只記一次失敗和一次扣款', async () => {
    oldBattle(stage.id); const { button, nav } = render(); const before = getSave().stamina.current;
    const failures: string[] = []; const off = bus.on('stageFailed', e => failures.push(e.stageId));
    button.click(); button.click(); answer('重新出發').click(); await settle(); off();
    expect(failures).toEqual([stage.id]); expect(before - getSave().stamina.current).toBe(stage.stamina);
    expect(nav.go).toHaveBeenCalledTimes(1);
  });
  it('無舊戰鬥確認同步回 start 後，同 task 新 ticket 不得被覆蓋', async () => {
    const { button, nav } = render();
    button.click(); oldBattle(); const before = JSON.stringify(getSave());
    await settle();
    expect(JSON.stringify(getSave())).toBe(before); expect(nav.go).not.toHaveBeenCalled();
    expect(button.disabled).toBe(false);
  });
  it('確認放棄後 stageFailed listener 建立的新 ticket 不被後續出發覆蓋', async () => {
    oldBattle(); const { button, nav } = render();
    let afterListener = '';
    const off = bus.on('stageFailed', () => { oldBattle('st-1-3'); afterListener = JSON.stringify(getSave()); });
    button.click(); answer('放棄並出發').click(); await settle(); off();
    expect(afterListener).not.toBe('');
    expect(JSON.stringify(getSave())).toBe(afterListener); expect(nav.go).not.toHaveBeenCalled();
    expect(button.disabled).toBe(false);
  });
  it('helper 回 resume 到 caller 接續之間的 microtask 替換 ticket 不導航舊關卡', async () => {
    oldBattle(stage.id); const { button, nav } = render();
    button.click(); answer('繼續').click();
    let replacement = '';
    // helper 的 await 先恢復並回 resume，這個 microtask 再換 ticket，最後 caller 才接續。
    queueMicrotask(() => { oldBattle('st-1-2'); replacement = JSON.stringify(getSave()); });
    await settle();
    expect(replacement).not.toBe(''); expect(JSON.stringify(getSave())).toBe(replacement);
    expect(nav.go).not.toHaveBeenCalled(); expect(button.disabled).toBe(false);
  });
  it('原 helper 無 lifecycle 呼叫仍保留 start／cancel／resume 語意', async () => {
    expect(await confirmNewBattle(stage.id)).toBe('start');
    oldBattle(); const before = JSON.stringify(getSave());
    const canceled = confirmNewBattle(stage.id); answer('取消').click();
    expect(await canceled).toBe('cancel'); expect(JSON.stringify(getSave())).toBe(before);
    vi.advanceTimersByTime(200);
    oldBattle(stage.id); const resumed = confirmNewBattle(stage.id); answer('繼續').click();
    expect(await resumed).toBe('resume'); expect(getSave().activeBattle?.seed).toBe(123);
  });
});
