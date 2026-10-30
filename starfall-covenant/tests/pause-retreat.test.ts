import { describe, expect, it } from 'vitest';
import { retreatControl } from '../src/ui/battle-fx/pause';
import { canAct } from '../src/ui/battle-guard';

describe('暫停選單的撤退按鈕', () => {
  it('可以操作時正常；結算動畫中停用並顯示原因', () => {
    expect(retreatControl(canAct({ phase: 'player', resolving: false }))).toEqual({ disabled: false, note: null });
    expect(retreatControl(canAct({ phase: 'player', resolving: true }))).toEqual({ disabled: true, note: '結算中無法撤退' });
  });

  it('沒給 canRetreat 時維持原本行為（可以撤退）', () => {
    expect(retreatControl()).toEqual({ disabled: false, note: null });
  });
});
