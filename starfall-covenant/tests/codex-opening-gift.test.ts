// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { gameData } from '../src/data/load';
import { createNewSave, parseSave, serializeSave } from '../src/save/save';
import { claimQuest, derivedCounters, resetQuestsIfNeeded } from '../src/progression/quests';
import { collectionScreen } from '../src/ui/screens/collection';
import { commit, getSave } from '../src/ui/state';

// Animation is unrelated to currency persistence; the real claim/commit/storage paths remain active.
vi.mock('../src/ui/components/reward-reveal', () => ({ revealReward: vi.fn(async () => {}) }));
const ID = 'a-codex-opening';
const now = 1793473200000;
const fresh = () => createNewSave(gameData.config, now);
const derived = (save: ReturnType<typeof fresh>) => derivedCounters(save, () => undefined);
const nav = { go() {}, replace() {}, back() {}, backTo() {} };
const screen = () => collectionScreen.render({ route: { name: 'collection', args: [], query: {} }, nav, onLeave() {} });
beforeEach(() => commit(fresh()));

describe('圖鑑開放紀念一次性20星晶', () => {
  it('有命名的終身成就，新舊玩家均可領，沒有卡片獎勵', () => {
    const q = gameData.quests.find(q => q.id === ID);
    expect(q).toMatchObject({ name: '圖鑑開放紀念', kind: 'achievement', counter: 'playerLevel', target: 1, reward: { gems: 20 } });
    for (const level of [1, 35]) {
      const save = fresh(); save.player.level = level; save.quests.claimed = ['a-existing'];
      const before = structuredClone(save);
      const r = claimQuest(save, q!, gameData.quests, gameData.config, now, derived(save));
      expect(r.ok).toBe(true); if (!r.ok) throw new Error(r.reason);
      expect(r.save.player.gems).toBe(save.player.gems + 20);
      expect(r.save.inventory).toEqual(save.inventory);
      expect(r.save.collection).toEqual(save.collection);
      expect(r.save.quests.claimed).toEqual(['a-existing', ID]);
      expect(save).toEqual(before);
      const reload = parseSave(serializeSave(r.save), gameData.config, now + 8 * 86400000);
      expect(reload.ok).toBe(true); if (!reload.ok) throw new Error(reload.reason);
      const next = resetQuestsIfNeeded(reload.save, gameData.quests, now + 8 * 86400000);
      expect(claimQuest(next, q!, gameData.quests, gameData.config, now + 8 * 86400000, derived(next))).toEqual({ ok: false, reason: 'alreadyClaimed' });
      expect(next.player.gems).toBe(save.player.gems + 20);
    }
  });
  it('圖鑑頂端明示20；同時開兩個面板連點也只領一次並立即寫入存檔', () => {
    const before = structuredClone(getSave());
    const first = screen(), stale = screen();
    expect(first.textContent).toContain('圖鑑開放紀念');
    const find = (root: HTMLElement) => root.querySelector<HTMLButtonElement>('[data-codex-gift]');
    expect(find(first)?.textContent).toContain('20');
    find(first)!.click(); find(first)!.click(); find(stale)!.click();
    expect(getSave().player.gems).toBe(before.player.gems + 20);
    expect(getSave().quests.claimed.filter(id => id === ID)).toHaveLength(1);
    expect(getSave().inventory).toEqual(before.inventory);
    expect(getSave().collection).toEqual(before.collection);
    expect(find(screen())?.disabled).toBe(true);
    const persisted = Object.values(localStorage).find(s => typeof s === 'string' && s.includes(ID));
    expect(persisted).toBeDefined();
    const q = gameData.quests.find(q => q.id === ID)!;
    expect(claimQuest(getSave(), q, gameData.quests, gameData.config, now, derived(getSave()))).toEqual({ ok: false, reason: 'alreadyClaimed' });
  });
  it('先由既有成就機制領取，圖鑑入口立即變成已領取，不會再發', () => {
    const q = gameData.quests.find(q => q.id === ID);
    expect(q).toBeDefined();
    const save = getSave(), r = claimQuest(save, q!, gameData.quests, gameData.config, now, derived(save));
    expect(r.ok).toBe(true); if (!r.ok) throw new Error(r.reason);
    commit(r.save);
    const root = screen(), button = root.querySelector<HTMLButtonElement>('[data-codex-gift]');
    expect(button?.disabled).toBe(true); expect(button?.textContent).toContain('已領取');
    button!.click();
    expect(getSave().player.gems).toBe(save.player.gems + 20);
  });
});
