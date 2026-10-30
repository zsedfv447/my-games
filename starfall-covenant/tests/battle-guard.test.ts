import { describe, expect, it } from 'vitest';
import { canAct, reenableAfterCancel } from '../src/ui/battle-guard';

describe('結算動畫中的操作限制', () => {
  it('輪到玩家且沒有動畫在播才能撤退或施放主動技', () => {
    expect(canAct({ phase: 'player', resolving: false })).toBe(true);
    expect(canAct({ phase: 'player', resolving: true })).toBe(false);
    expect(canAct({ phase: 'won', resolving: false })).toBe(false);
    expect(canAct({ phase: 'lost', resolving: true })).toBe(false);
  });

  it('取消撤退：原本盤面就開放、而且仍可操作時才重新開放', () => {
    expect(reenableAfterCancel(true, { phase: 'player', resolving: false })).toBe(true);
    expect(reenableAfterCancel(false, { phase: 'player', resolving: false })).toBe(false);
    expect(reenableAfterCancel(true, { phase: 'player', resolving: true })).toBe(false);
    expect(reenableAfterCancel(true, { phase: 'won', resolving: false })).toBe(false);
  });
});
