import { describe, expect, it } from 'vitest';
import { teamCostLimit } from '../src/progression/player';
import { overCostText, suggestSwapOut } from '../src/ui/team-cost-hint';

const m = (uid: string, cost: number, fits = true) => ({ uid, cost, fits });

describe('隊伍空間不足的提示', () => {
  it('建議換下 Cost 最高的隊員；同 Cost 時先換不合流派的；不換隊長與正在換的位置', () => {
    const members = [m('lead', 12), m('a', 6), m('b', 9, true), m('c', 9, false), m('new', 9)];
    expect(suggestSwapOut(members, 4, 40, 33)).toEqual({ uid: 'c', slot: 3 });
    expect(suggestSwapOut([m('lead', 12), m('a', 6), m('b', 9), null, m('new', 9)], 4, 36, 33)).toEqual({ uid: 'b', slot: 2 });
  });

  it('只建議換下後放得下的隊員，都不行就不建議', () => {
    const members = [m('lead', 6), m('a', 6), m('b', 6), m('c', 6), m('new', 12)];
    expect(suggestSwapOut(members, 4, 36, 33)).toEqual({ uid: 'a', slot: 1 });
    expect(suggestSwapOut(members, 4, 50, 33)).toBeNull();
  });

  it('提示文字包含幾級可以放入與建議換下的隊員', () => {
    const total = teamCostLimit(3);
    expect(overCostText(total, teamCostLimit(1), { name: '小炭', cost: 4 })).toBe(`隊伍空間不足（${total} / 33），玩家 Lv.3 可以放入，或先換下「小炭」（Cost 4）`);
    expect(overCostText(10_000, 33)).toBe('隊伍空間不足（10000 / 33）');
  });
});
