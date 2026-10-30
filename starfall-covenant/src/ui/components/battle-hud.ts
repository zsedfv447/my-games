// 戰鬥頂部的回合數與星章進度：條件確定失敗就變灰，Combo 條件達成時點亮並發出音效
import type { StageDef } from '../../core/types';
import type { BattleState } from '../../battle/battle-state';
import { liveStarStatus, type BattleSummary, type LiveStarStatus } from '../../progression/stages';
import { h } from '../dom';
import { audio } from '../audio';
import { toast } from './overlay';
import { starText } from '../screens/prepare';

const STATUS_TEXT: Record<LiveStarStatus, string> = { done: '已達成', failed: '已失敗', pending: '進行中' };

/** 戰鬥中的星章判定用摘要 */
export function liveSummary(state: BattleState): BattleSummary {
  return {
    turns: state.turns, usedActiveSkill: state.usedActiveSkill, maxCombo: state.maxCombo, continues: state.continues,
    team: state.team.map((m) => ({ attribute: m.card.attribute, race: m.card.race })),
  };
}

export class BattleHud {
  readonly element = h('div', { class: 'battle-hud' });
  private shown: LiveStarStatus[] = [];

  constructor(private stage: StageDef) {}

  /** 每次戰鬥狀態改變（回合結束、施放主動技、續戰）後呼叫 */
  update(state: BattleState): void {
    const won = state.phase === 'won';
    const conds = this.stage.stars ?? [];
    const now = conds.map((c) => liveStarStatus(c, liveSummary(state), won));
    const lit = now.some((st, i) => st === 'done' && this.shown[i] === 'pending');
    this.element.replaceChildren(h('span', { class: 'turn-count' }, `回合 ${won ? state.turns : state.turns + 1}`));
    if (conds.length) {
      this.element.appendChild(h('span', { class: 'hud-stars' }, conds.map((c, i) => h('button', {
        type: 'button',
        class: ['hud-star', now[i], this.shown[i] && this.shown[i] !== now[i] && 'pop'],
        'aria-label': `${starText(c)}：${STATUS_TEXT[now[i]]}`,
        onClick: () => toast(`${starText(c)}（${STATUS_TEXT[now[i]]}）`),
      }, '★'))));
    }
    if (lit) audio.play('confirm');
    this.shown = now;
  }
}
