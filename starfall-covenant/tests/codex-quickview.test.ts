// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { archetypesScreen } from '../src/ui/screens/archetypes';
import { collectionCardScreen, collectionScreen } from '../src/ui/screens/collection';
import { bestiaryScreen } from '../src/ui/screens/bestiary';
import { teamScreen } from '../src/ui/screens/team';
import { prepareScreen } from '../src/ui/screens/prepare';
import { Router, type ScreenDef } from '../src/ui/router';
import { gameData } from '../src/data/load';
import { commit, getSave } from '../src/ui/state';
import { createNewSave } from '../src/save/save';
import { closeRouteScoped } from '../src/ui/route-scope';

const routers: Router[] = [];
const nav = { go: vi.fn(), replace: vi.fn(), back: vi.fn(), backTo: vi.fn() };
function render(screen: ScreenDef, args: string[] = []) {
  const el = screen.render({ route: { name: screen.name, args, query: {} }, nav, onLeave() {} });
  document.body.replaceChildren(el); return el;
}
const modal = () => document.querySelector<HTMLElement>('[data-card-quickview]');
beforeEach(() => { closeRouteScoped(); vi.clearAllMocks(); history.replaceState(null, '', '#/archetypes'); commit(createNewSave(gameData.config, Date.now())); });
afterEach(() => { routers.splice(0).forEach(r => r.stop()); closeRouteScoped(); document.body.replaceChildren(); });

describe('圖鑑與流派共用只讀快速介紹', () => {
  it('展示頭像即開介紹、不換頁、不寫存檔，重複點擊不疊窗', async () => {
    const root = render(archetypesScreen); root.scrollTop = 450;
    const thumb = root.querySelector<HTMLButtonElement>('.card-thumb')!;
    thumb.focus(); const before = JSON.stringify(getSave()), hash = location.hash, length = history.length;
    thumb.click();
    expect(modal()).not.toBeNull();
    expect(modal()!.textContent).toContain(thumb.getAttribute('aria-label'));
    expect(modal()!.textContent).toContain('主動技');
    expect(modal()!.textContent).toContain('隊長技');
    expect(modal()!.querySelector('button')?.textContent).toBe('關閉介紹');
    expect(history.length).toBe(length + 1);
    thumb.click(); thumb.click();
    expect(document.querySelectorAll('[data-card-quickview]')).toHaveLength(1);
    expect(location.hash).toBe(hash); expect(nav.go).not.toHaveBeenCalled();
    expect(JSON.stringify(getSave())).toBe(before);
    expect([...modal()!.querySelectorAll('button')].some(b => b.textContent?.includes('領取'))).toBe(false);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(modal()).toBeNull();
    expect(root.scrollTop).toBe(450); expect(document.activeElement).toBe(thumb);
    await vi.waitFor(() => expect(history.state?.starfallCardPreview).toBeUndefined());
  });
  it('瀏覽器Back與遊戲返回都先關快覽，不重畫來源畫面', async () => {
    let mounts = 0; let root!: HTMLElement;
    const router = new Router((_s, el) => { mounts++; root = el; document.body.replaceChildren(el); }).register(archetypesScreen, collectionCardScreen, collectionScreen);
    routers.push(router); router.start();
    root.scrollTop = 520;
    const thumb = root.querySelector<HTMLButtonElement>('.card-thumb')!;
    thumb.click(); expect(modal()).not.toBeNull();
    history.back();
    await vi.waitFor(() => expect(modal()).toBeNull());
    expect(mounts).toBe(1); expect(root.scrollTop).toBe(520);
    thumb.click(); expect(modal()).not.toBeNull();
    router.back(); expect(modal()).toBeNull();
    await vi.waitFor(() => expect(history.state?.starfallCardPreview).toBeUndefined());
    expect(mounts).toBe(1); expect(location.hash).toBe('#/archetypes');
  });
  it('快覽→完整圖鑑→取得來源→返回只走一層，恢復原位置；Forward不留下幽靈快覽', async () => {
    let root!: HTMLElement;
    const source: ScreenDef = { name: 'shop', title: 'shop', chrome: 'sub', render: () => document.createElement('div') };
    const router = new Router((screen, el) => { root = el; el.dataset.testScreen = screen.name; document.body.replaceChildren(el); el.scrollTop = 0; }).register(archetypesScreen, collectionCardScreen, collectionScreen, source);
    routers.push(router); router.start(); root.scrollTop = 670;
    root.querySelector<HTMLButtonElement>('.card-thumb')!.click();
    [...modal()!.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent === '完整圖鑑與取得方式')!.click();
    expect(modal()).toBeNull(); expect(location.hash).toContain('#/collection-card/');
    root.scrollTop = 340;
    router.go('shop'); await vi.waitFor(() => expect(root.dataset.testScreen).toBe('shop'));
    router.back(); await vi.waitFor(() => expect(root.dataset.testScreen).toBe('collection-card'));
    expect(root.scrollTop).toBe(340);
    router.back(); await vi.waitFor(() => expect(root.dataset.testScreen).toBe('archetypes'));
    expect(root.scrollTop).toBe(670);
    root.querySelector<HTMLButtonElement>('.card-thumb')!.click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await vi.waitFor(() => expect(history.state?.starfallCardPreview).toBeUndefined());
    history.forward(); await new Promise(r => setTimeout(r, 20));
    expect(modal()).toBeNull(); expect(history.state?.starfallCardPreview).toBeUndefined();
    expect(location.hash).toBe('#/archetypes');
  });

  it('關閉後立即導覽會等Back消耗完，不被延遲Back撤銷；焦點限制在快覽內', async () => {
    let root!: HTMLElement;
    const shop: ScreenDef = { name: 'shop', title: 'shop', chrome: 'sub', render: () => document.createElement('div') };
    const router = new Router((screen, el) => { root = el; root.dataset.testScreen = screen.name; document.body.replaceChildren(el); }).register(archetypesScreen, shop);
    routers.push(router); router.start();
    root.querySelector<HTMLButtonElement>('.card-thumb')!.click();
    const buttons = [...modal()!.querySelectorAll<HTMLButtonElement>('button')];
    buttons.at(-1)!.focus(); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', cancelable: true }));
    expect(document.activeElement).toBe(buttons[0]);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, cancelable: true }));
    expect(document.activeElement).toBe(buttons.at(-1));
    const realBack = history.back.bind(history);
    const delayed = vi.spyOn(history, 'back').mockImplementation(() => {});
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    router.go('shop'); expect(location.hash).toBe('#/archetypes');
    delayed.mockRestore(); realBack();
    await vi.waitFor(() => expect(root.dataset.testScreen).toBe('shop'));
    expect(location.hash).toBe('#/shop'); expect(modal()).toBeNull();
  });

  it('流派分析推薦卡可看介紹，原隊伍槽仍是換人選單', () => {
    const save = getSave();
    save.inventory.cards = gameData.cards.filter(c => c.race !== 'material').map((c, i) => ({ uid: `u${i + 1}`, cardId: c.id, level: 1, exp: 0, skillLevel: 1, limitBreak: 0, awakened: 0, locked: false, obtainedAt: 0 }));
    save.teams[0].members = [save.inventory.cards.find(c => c.cardId === 'c106')!.uid, null, null, null, null]; commit(save);
    const root = render(teamScreen);
    const label = [...root.querySelectorAll('p')].find(p => p.textContent === '背包裡適合換上的卡')!;
    const suggestions = label.parentElement!.querySelectorAll<HTMLButtonElement>('.card-thumb');
    expect(suggestions.length).toBeGreaterThan(0);
    const before = JSON.stringify(getSave());
    suggestions[0].click(); expect(modal()).not.toBeNull(); expect(JSON.stringify(getSave())).toBe(before);
    closeRouteScoped();
    root.querySelector<HTMLButtonElement>('.team-slot .card-thumb')!.click();
    expect(modal()).toBeNull();
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain('隊長');
    expect(JSON.stringify(getSave())).toBe(before);
  });

  it('一般關卡可換助戰仍開助戰選單，不改成卡片快覽', () => {
    const stage = gameData.stages.find(s => s.kind === 'main' && !s.teamRule?.noHelper)!;
    const root = render(prepareScreen, [stage.id]);
    const helper = root.querySelectorAll<HTMLButtonElement>('.grid-5 .card-thumb')[5];
    expect(helper.disabled).toBe(false); helper.click();
    expect(modal()).toBeNull();
    expect(nav.go).toHaveBeenLastCalledWith('helper', [stage.id], { from: 'prepare' });
  });

  it('推薦名字和全部流派卡片入口均可開，關閉/切頁會清理', async () => {
    const root = render(archetypesScreen);
    const links = root.querySelectorAll<HTMLButtonElement>('[data-recommended-card]');
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) { link.click(); expect(modal()!.textContent).toContain(link.textContent); }
    expect(document.querySelectorAll('[data-card-quickview]')).toHaveLength(1);
    closeRouteScoped(); expect(modal()).toBeNull();
    for (const thumb of root.querySelectorAll<HTMLButtonElement>('.card-thumb')) { thumb.click(); expect(modal()!.textContent).toContain(thumb.getAttribute('aria-label')); }
    closeRouteScoped(); expect(modal()).toBeNull();
    await vi.waitFor(() => expect(history.state?.starfallCardPreview).toBeUndefined());
  });
  it('保留卡片/流派/敵人三頁切換以及對應流派入口', () => {
    for (const screen of [collectionScreen, archetypesScreen, bestiaryScreen]) {
      const root = render(screen);
      const tabs = [...root.querySelectorAll('[data-codex-tab]')];
      expect(tabs.map(t => t.textContent)).toEqual(['卡片', '流派', '敵人']);
    }
    const c = gameData.cards.find(c => c.archetypes.length)!;
    const root = render(collectionCardScreen, [c.id]);
    const link = root.querySelector<HTMLButtonElement>('[data-archetype-link]');
    expect(link).not.toBeNull(); link!.click();
    expect(nav.go).toHaveBeenLastCalledWith('archetypes', [c.archetypes[0].id]);
  });
  it('借用隊伍與固定助戰開介紹，不觸發換人', () => {
    const stage = gameData.stages.find(s => s.kind === 'trial' && s.fixedTeam)!;
    const root = render(prepareScreen, [stage.id]);
    const thumbs = root.querySelectorAll<HTMLButtonElement>('.grid-5 .card-thumb');
    expect(thumbs.length).toBeGreaterThan(0);
    for (const t of thumbs) { t.click(); expect(modal()).not.toBeNull(); expect(modal()!.textContent).toContain(t.getAttribute('aria-label')); }
    expect(nav.go).not.toHaveBeenCalled();
  });
});
