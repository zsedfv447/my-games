import { describe, expect, it } from 'vitest';
import { enhance, evolve, expForLevel, pickEvolutionMaterials, previewEnhance } from '../src/growth';
import {
  autoPickCount, autoPickEnhance, evolutionCompare, evolutionNeeds, levelProgress, materialLimit, materialOptions,
  parseMode, passiveText, statLines,
} from '../src/ui/screens/growth-view';
import { SCREENS } from '../src/ui/screens';
import { placeholderScreens } from '../src/ui/screens/placeholders';
import { ctx, makeSave, owned } from './growth/fixtures';

const ids = (xs: { owned: { uid: string } }[]) => xs.map((x) => x.owned.uid);

describe('養成畫面', () => {
  it('強化與進化是正式畫面，不再是建置中', () => {
    expect(placeholderScreens.some((s) => s.name === 'enhance' || s.name === 'evolve')).toBe(false);
    expect(SCREENS.filter((s) => s.name === 'enhance')).toHaveLength(1);
    expect(SCREENS.filter((s) => s.name === 'evolve')).toHaveLength(1);
  });

  it('網址上的頁籤參數不認得時回到強化', () => {
    expect(parseMode('awaken')).toBe('awaken');
    expect(parseMode('xyz')).toBe('enhance');
    expect(parseMode(undefined)).toBe('enhance');
  });

  it('強化素材：排除自己、上鎖、隊伍中與星核；素材卡排在前面並標出同屬', () => {
    const save = makeSave([
      owned('t', 'c102'), owned('fighter', 'c108'), owned('m-water', 'c906'), owned('m-fire', 'c905'),
      owned('locked', 'c905', { locked: true }), owned('team', 'c905'), owned('core', 'c916'),
    ]);
    save.teams[0].members[0] = 'team';
    const opts = materialOptions(save, ctx, 't', 'enhance');
    expect(ids(opts)).toEqual(['m-fire', 'm-water', 'fighter']);
    expect(opts[0].sameAttribute).toBe(true);
    expect(opts[0].exp).toBe(1500);
    expect(opts[1].exp).toBe(1000);
  });

  it('自動選強化素材：只用素材卡、同屬優先、夠升滿級就停', () => {
    const def = ctx.card('c108')!;
    const save = makeSave([
      owned('t', 'c108', { level: 49, exp: expForLevel(def, 50, ctx.rules) - 1000 }), owned('fighter', 'c107'),
      owned('w', 'c906'), owned('f1', 'c905'), owned('f2', 'c905'),
    ]);
    const picks = autoPickEnhance(save, ctx, 't');
    expect(picks).toEqual(['f1']);
    const p = previewEnhance(save, ctx, 't', picks);
    expect(p.ok && p.levelAfter).toBe(50);
    expect(autoPickEnhance(makeSave([owned('t', 'c108', { level: 50 })]), ctx, 't')).toEqual([]);
  });

  it('經驗條進度與能力值對比', () => {
    const def = ctx.card('c108')!;
    expect(levelProgress(def, { level: 1, exp: 0 }, ctx)).toBe(0);
    expect(levelProgress(def, { level: 50, exp: 0 }, ctx)).toBe(1);
    const lines = statLines({ hp: 1, atk: 2, rcv: 3 }, { hp: 5, atk: 2, rcv: 4 });
    expect(lines.map((l) => [l.label, l.after - l.before])).toEqual([['生命', 4], ['攻擊', 0], ['回復', 1]]);
  });

  it('技能、突破只列同名卡，最多選到升滿為止', () => {
    const save = makeSave([
      owned('t', 'c102', { skillLevel: 4, limitBreak: 3 }), owned('same', 'c102'), owned('evolved', 'c103'), owned('other', 'c107'),
    ]);
    const t = save.inventory.cards[0];
    expect(ids(materialOptions(save, ctx, 't', 'skill')).sort()).toEqual(['evolved', 'same']);
    expect(ids(materialOptions(save, ctx, 't', 'limit')).sort()).toEqual(['evolved', 'same']);
    expect(materialLimit(t, ctx.card('c102')!, ctx, 'skill')).toBe(1); // 冷卻 10→6 共 5 級
    expect(materialLimit(t, ctx.card('c102')!, ctx, 'limit')).toBe(2);
    expect(autoPickCount(materialOptions(save, ctx, 't', 'limit'), 2)).toHaveLength(2);
  });

  it('覺醒只列對應屬性的星核，張數依第幾個覺醒', () => {
    const save = makeSave([owned('t', 'c102', { awakened: 1, limitBreak: 3 }), owned('k1', 'c916'), owned('k2', 'c916'), owned('x', 'c905')]);
    const opts = materialOptions(save, ctx, 't', 'awaken');
    expect(ids(opts)).toEqual(['k1', 'k2']);
    expect(materialLimit(save.inventory.cards[0], ctx.card('c102')!, ctx, 'awaken')).toBe(2);
  });

  it('被動說明文字', () => {
    expect(passiveText({ type: 'orbDamageUp', orb: 'fire', percent: 5 })).toBe('焰珠傷害 +5%');
    expect(passiveText({ type: 'moveTimeUp', seconds: 0.5 })).toBe('轉珠時間 +0.5 秒');
    expect(passiveText({ type: 'statUp', stat: 'atk', value: 100 })).toBe('攻擊 +100');
    expect(passiveText({ type: 'resistStatus', status: 'poison', percent: 50 })).toBe('中毒抵抗 50%');
  });

  it('進化需求依卡號合併並數出可用張數；畫面流程可以完成進化', () => {
    const save = makeSave([
      owned('t', 'c102', { level: 90 }), owned('a', 'c905'), owned('b', 'c905', { locked: true }), owned('c', 'c915'),
    ]);
    expect(evolutionNeeds(save, ctx, 't')).toEqual([{ id: 'c905', need: 2, have: 1 }, { id: 'c915', need: 1, have: 1 }]);
    const ready = makeSave([...save.inventory.cards, owned('d', 'c905')]);
    expect(evolutionNeeds(ready, ctx, 't').every((n) => n.have >= n.need)).toBe(true);
    const pick = pickEvolutionMaterials(ready, ctx, 't');
    const r = evolve(ready, ctx, 't', pick.uids);
    expect(r.ok && r.card.cardId).toBe('c103');
  });

  it('進化前後對比：進化後回到 Lv1、滿級數值較高', () => {
    const o = owned('t', 'c102', { level: 90 });
    const cmp = evolutionCompare(o, ctx.card('c102')!, ctx.card('c103')!, ctx);
    expect(cmp.lv1.atk).toBeLessThan(cmp.now.atk);
    expect(cmp.max.atk).toBeGreaterThanOrEqual(cmp.now.atk);
  });

  it('強化確認後存檔反映新等級與金幣', () => {
    const save = makeSave([owned('t', 'c108'), owned('f1', 'c905')], { coin: 1000 });
    const r = enhance(save, ctx, 't', ['f1']);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.save.player.coin).toBe(900);
    expect(r.save.inventory.cards.map((c) => c.uid)).toEqual(['t']);
    expect(r.card.level).toBeGreaterThan(1);
  });
});
