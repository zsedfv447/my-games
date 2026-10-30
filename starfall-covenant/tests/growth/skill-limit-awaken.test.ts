import { describe, expect, it } from 'vitest';
import { awaken, limitBreak, maxSkillLevel, nextAwakening, skillCooldown, skillUp } from '../../src/growth';
import { ctx, makeSave, owned } from './fixtures';

describe('技能升級', () => {
  const c102 = ctx.card('c102')!;

  it('CD 由 max 每級 −1 降到 min', () => {
    expect(maxSkillLevel(c102, ctx)).toBe(5);
    expect(skillCooldown(c102, 1, ctx)).toBe(10);
    expect(skillCooldown(c102, 5, ctx)).toBe(6);
    expect(skillCooldown(ctx.card('c106')!, 1, ctx)).toBeNull();
  });

  it('同名卡（含進化型態）可升技能，每張 +1', () => {
    const save = makeSave([owned('u1', 'c102'), owned('u2', 'c102'), owned('u3', 'c103')]);
    const r = skillUp(save, ctx, 'u1', ['u2', 'u3']);
    expect(r.ok && [r.skillLevel, r.cooldown]).toEqual([3, 8]);
  });

  it('不同名、超量、已滿、無主動技都會被擋', () => {
    const save = makeSave([
      owned('u1', 'c102', { skillLevel: 4 }), owned('u2', 'c102'), owned('u3', 'c102'), owned('u4', 'c107'),
      owned('u5', 'c102', { skillLevel: 5 }), owned('u6', 'c106'),
    ]);
    const code = (r: ReturnType<typeof skillUp>) => (r.ok ? 'ok' : r.error.code);
    expect(code(skillUp(save, ctx, 'u1', ['u4']))).toBe('wrongMaterial');
    expect(code(skillUp(save, ctx, 'u1', ['u2', 'u3']))).toBe('tooManyMaterials');
    expect(code(skillUp(save, ctx, 'u5', ['u2']))).toBe('maxSkillLevel');
    expect(code(skillUp(save, ctx, 'u6', ['u2']))).toBe('noActiveSkill');
  });

  it('可設定指定技能素材', () => {
    const custom = { ...ctx, rules: { ...ctx.rules, skillMaterialIds: ['c915'] } };
    const save = makeSave([owned('u1', 'c102'), owned('u2', 'c915')]);
    expect(skillUp(save, custom, 'u1', ['u2']).ok).toBe(true);
  });
});

describe('突破', () => {
  it('吞同名卡 +1 階，最多 +5', () => {
    const save = makeSave([owned('u1', 'c103', { limitBreak: 3 }), owned('u2', 'c102'), owned('u3', 'c103'), owned('u4', 'c103')]);
    const r = limitBreak(save, ctx, 'u1', ['u2', 'u3']);
    expect(r.ok && r.limitBreak).toBe(5);
    const code = (x: ReturnType<typeof limitBreak>) => (x.ok ? 'ok' : x.error.code);
    expect(code(limitBreak(save, ctx, 'u1', ['u2', 'u3', 'u4']))).toBe('tooManyMaterials');
    if (r.ok) expect(code(limitBreak(r.save, ctx, 'u1', ['u4']))).toBe('maxLimitBreak');
  });

  it('不同名的卡不能突破', () => {
    const save = makeSave([owned('u1', 'c102'), owned('u2', 'c107')]);
    const r = limitBreak(save, ctx, 'u1', ['u2']);
    expect(!r.ok && r.error.code).toBe('wrongMaterial');
  });
});

describe('星紋覺醒', () => {
  it('依序解鎖，需要突破階數、金幣與同屬素材', () => {
    const c102 = ctx.card('c102')!;
    expect(nextAwakening(c102, { awakened: 0 }, ctx)).toMatchObject({ slot: 0, limitBreak: 1, coin: 20000, materials: 1 });

    let save = makeSave([owned('u1', 'c102', { limitBreak: 1 }), owned('u2', 'c905'), owned('u3', 'c906'), owned('u4', 'c915'), owned('u5', 'c905')]);
    const first = awaken(save, ctx, 'u1', ['u2']);
    expect(first.ok && first.unlocked).toEqual({ type: 'orbDamageUp', orb: 'fire', percent: 5 });
    if (!first.ok) return;
    save = first.save;
    expect(save.player.coin).toBe(1_000_000 - 20000);

    const code = (r: ReturnType<typeof awaken>) => (r.ok ? 'ok' : r.error.code);
    // 第 2 個需要突破 +3
    expect(code(awaken(save, ctx, 'u1', ['u4', 'u5']))).toBe('limitBreakRequired');
    const lb3 = { ...save, inventory: { ...save.inventory, cards: save.inventory.cards.map((c) => (c.uid === 'u1' ? { ...c, limitBreak: 3 } : c)) } };
    expect(code(awaken(lb3, ctx, 'u1', ['u4']))).toBe('noMaterials');
    expect(code(awaken(lb3, ctx, 'u1', ['u3', 'u4']))).toBe('wrongMaterial');
    expect(awaken(lb3, ctx, 'u1', ['u4', 'u5']).ok).toBe(true);
  });

  it('沒有覺醒或已全部解鎖', () => {
    const save = makeSave([owned('u1', 'c106'), owned('u2', 'c103', { awakened: 2, limitBreak: 5 }), owned('u3', 'c905')]);
    expect(awaken(save, ctx, 'u1', ['u3'])).toMatchObject({ ok: false, error: { code: 'noAwakening' } });
    expect(awaken(save, ctx, 'u2', ['u3'])).toMatchObject({ ok: false, error: { code: 'maxAwakening' } });
  });
});
