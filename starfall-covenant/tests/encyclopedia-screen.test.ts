// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { collectionCardScreen, collectionScreen } from '../src/ui/screens/collection';
import { archetypesScreen } from '../src/ui/screens/archetypes';
import { gameData } from '../src/data/load';
import { commit, getSave, growth } from '../src/ui/state';
import { createNewSave } from '../src/save/save';
import { claimCollectionReward, collectionReward, markOwned, markSeen } from '../src/growth';
import { passiveText } from '../src/ui/screens/growth-view';
import type { ScreenDef } from '../src/ui/router';
import codexCss from '../src/ui/collection-helper.css?raw';

const nav = { go: vi.fn(), replace: vi.fn(), back: vi.fn(), backTo: vi.fn() };
function render(screen: ScreenDef, id?: string) {
  const el = screen.render({ route: { name: screen.name, args: id ? [id] : [], query: {} }, nav, onLeave() {} });
  document.body.replaceChildren(el);
  return el;
}
beforeEach(() => {
  vi.clearAllMocks();
  commit(createNewSave({ ...gameData.config, newPlayer: { ...gameData.config.newPlayer, starterCards: [] } }, Date.now()));
});

describe('圖鑑全開只開放資訊，不授予卡片', () => {
  it('所有未取得卡都有完整名稱、數值、技能、流派、覺醒和進化資料', () => {
    const before = structuredClone(getSave());
    const storageBefore = JSON.stringify(localStorage);
    for (const card of gameData.cards) {
      const detail = render(collectionCardScreen, card.id);
      const text = detail.textContent!;
      expect(detail.querySelector('h2')?.textContent, card.id).toBe(card.name);
      expect(detail.querySelector('.codex-unseen-art, .codex-seen-art'), card.id).toBeNull();
      expect(text, card.id).not.toContain('？？？');
      expect(text, card.id).toContain(`Cost ${card.cost}`);
      if (card.race !== 'material') for (const stat of Object.values(card.stats).flat()) expect(text, card.id).toContain(stat.toLocaleString());
      if (card.activeSkill) {
        const skill = growth.skill(card.activeSkill)!;
        expect(text, card.id).toContain(skill.description);
        expect(text, card.id).toContain(`冷卻 ${skill.cooldown.max} 回合（最短 ${skill.cooldown.min}）`);
      }
      if (card.leaderSkill) expect(text, card.id).toContain(growth.leaderSkill(card.leaderSkill)!.description);
      for (const a of card.archetypes) expect(text, card.id).toContain(gameData.archetypes.find(x => x.id === a.id)!.name);
      for (const p of card.awakenings ?? []) expect(text, card.id).toContain(passiveText(p));
      for (const id of [growth.evolvesFrom(card.id), card.evolution?.to].filter((id): id is string => !!id)) expect(text, card.id).toContain(growth.card(id)!.name);
      if (collectionReward(growth, card.id) > 0) {
        const reward = [...detail.querySelectorAll('button')].find(b => b.textContent?.includes('尚未取得'));
        expect(reward?.disabled, card.id).toBe(true);
        reward!.click();
      }
      expect(claimCollectionReward(getSave(), growth, card.id)).toMatchObject({ ok: false, error: { code: 'notOwned' } });
    }
    expect(getSave()).toEqual(before);
    expect(JSON.stringify(localStorage)).toBe(storageBefore);
  });

  it('格子公開真實名字及卡面，每張均可導覽；流派選單不漏任何定義', () => {
    const grid = render(collectionScreen);
    const thumbs = [...grid.querySelectorAll<HTMLButtonElement>('.codex-grid .card-thumb')];
    expect(thumbs).toHaveLength(gameData.cards.length);
    for (const card of gameData.cards) {
      const thumb = thumbs.find(t => t.getAttribute('aria-label')?.includes(card.name));
      expect(thumb, card.id).toBeDefined();
      expect(thumb!.title, card.id).toContain(card.name);
      thumb!.click();
      expect(nav.go).toHaveBeenLastCalledWith('collection-card', [card.id]);
    }
    // Apply real stylesheet as well as checking screen markup, so old silhouette CSS cannot regress.
    const style = document.createElement('style'); style.textContent = codexCss; document.head.append(style);
    for (const thumb of thumbs) expect(getComputedStyle(thumb.querySelector('img,svg')!).visibility).not.toBe('hidden');
    style.remove();
    const filter = grid.querySelector<HTMLSelectElement>('[aria-label="流派"]')!;
    expect([...filter.options].slice(1).map(o => o.value).sort()).toEqual(gameData.archetypes.map(a => a.id).sort());
    for (const a of gameData.archetypes) {
      filter.value = a.id; filter.dispatchEvent(new Event('change'));
      const expected = gameData.cards.filter(c => c.archetypes.some(t => t.id === a.id));
      expect(grid.querySelectorAll('.codex-grid .card-thumb'), a.id).toHaveLength(expected.length);
      for (const c of expected) expect([...grid.querySelectorAll('.codex-grid .card-thumb')].some(el => el.getAttribute('aria-label')?.includes(c.name)), c.id).toBe(true);
    }
    filter.value = ''; filter.dispatchEvent(new Event('change'));
    expect(grid.querySelectorAll('.codex-grid .card-thumb')).toHaveLength(gameData.cards.length);
  });

  it('流派頁列出每個流派與全部所屬卡，卡片入口可查看未取得資料', () => {
    const root = render(archetypesScreen);
    for (const a of gameData.archetypes) {
      expect([...root.querySelectorAll('h3')].some(h => h.textContent?.includes(a.name)), a.id).toBe(true);
    }
    for (const thumb of root.querySelectorAll<HTMLButtonElement>('.card-thumb')) {
      thumb.click();
      expect(nav.go.mock.lastCall?.[0]).toBe('collection-card');
      const card = growth.card(String(nav.go.mock.lastCall?.[1]?.[0]));
      expect(card).toBeDefined();
    }
  });


  it('已見過、已取得和已領獎狀態仍分開，公開資料不改成全收集', () => {
    const card = gameData.cards.find(c => c.race !== 'material')!;
    commit(markSeen(getSave(), [card.id]));
    let detail = render(collectionCardScreen, card.id);
    expect(detail.querySelector('h2')?.textContent).toBe(card.name);
    expect([...detail.querySelectorAll('button')].find(b => b.textContent?.includes('尚未取得'))?.disabled).toBe(true);
    expect(render(collectionScreen).querySelectorAll('.codex-owned-mark')).toHaveLength(0);
    commit(markOwned(getSave(), [card.id]));
    detail = render(collectionCardScreen, card.id);
    expect([...detail.querySelectorAll('button')].find(b => b.textContent?.startsWith('領取'))?.disabled).toBe(false);
    expect(render(collectionScreen).querySelectorAll('.codex-owned-mark')).toHaveLength(1);
    const reward = claimCollectionReward(getSave(), growth, card.id);
    if (!reward.ok) throw new Error('Expected eligible reward');
    commit(reward.save);
    detail = render(collectionCardScreen, card.id);
    expect([...detail.querySelectorAll('button')].find(b => b.textContent?.includes('已領取'))?.disabled).toBe(true);
    expect(getSave().collection.owned).toEqual([card.id]);
    expect(getSave().collection.claimed).toEqual([card.id]);
    expect(getSave().inventory.cards).toEqual([]);
  });

  it('流派篩選後查看卡片再回圖鑑仍保留篩選', () => {
    const a = gameData.archetypes.at(-1)!;
    const root = render(collectionScreen);
    const select = root.querySelector<HTMLSelectElement>('[aria-label="流派"]')!;
    select.value = a.id; select.dispatchEvent(new Event('change'));
    const expected = gameData.cards.filter(c => c.archetypes.some(t => t.id === a.id));
    root.querySelector<HTMLButtonElement>('.codex-grid .card-thumb')!.click();
    render(collectionCardScreen, String(nav.go.mock.lastCall?.[1]?.[0]));
    const returned = render(collectionScreen);
    const retained = returned.querySelector<HTMLSelectElement>('[aria-label="流派"]')!;
    expect(retained.value).toBe(a.id);
    expect(returned.querySelectorAll('.codex-grid .card-thumb')).toHaveLength(expected.length);
    retained.value = ''; retained.dispatchEvent(new Event('change'));
  });

  it('進化連結使用真名並保留返回圖鑑語意；錯誤卡號安全處理', () => {
    const card = gameData.cards.find(c => c.evolution)!;
    const detail = render(collectionCardScreen, card.id);
    const target = growth.card(card.evolution!.to)!;
    const evo = [...detail.querySelectorAll('button')].find(b => b.textContent === `→ ${target.name}`);
    expect(evo).toBeDefined(); evo!.click();
    expect(nav.replace).toHaveBeenLastCalledWith('collection-card', [target.id]);
    expect(collectionCardScreen.parent).toBe('collection');
    expect(render(collectionCardScreen, 'missing-card').textContent).toContain('找不到這張卡片');
  });
});
