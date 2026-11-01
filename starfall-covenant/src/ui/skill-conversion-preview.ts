// Conservative, read-only counts: never simulate damage, RNG or skill side effects.
import type { ActiveSkillDef, OrbType } from '../core/types';
import type { BattleState } from '../battle/battle-state';
import { convertOrbs, countOrbs } from '../battle/board';
import { isMemberSealed, isSkillSealed } from '../battle/skills/status';
import { h } from './dom';

export interface ConversionPreview { before: Record<OrbType, number>; after: Record<OrbType, number>; changed: boolean }
const ORBS: OrbType[] = ['fire', 'water', 'wood', 'light', 'dark', 'heart'];
const NAMES: Record<OrbType, string> = { fire: '火', water: '水', wood: '木', light: '光', dark: '暗', heart: '心' };
export function conversionPreview(state: BattleState, member: number, skill: ActiveSkillDef): ConversionPreview | null {
  if (state.phase !== 'player' || state.team[member]?.skillCooldown !== 0 || isSkillSealed(state) || isMemberSealed(state, member)
    || state.buffs.some(b => b.kind === 'chainOnSkill') || state.board.cells.some(o => o.hidden)
    || !skill.effects.length || !skill.effects.every(e => e.type === 'convertOrbs')) return null;
  const before = countOrbs(state.board);
  let board = { ...state.board, cells: state.board.cells.map(o => ({ ...o })) };
  for (const effect of skill.effects) {
    if (effect.type === 'convertOrbs') board = convertOrbs(board, effect.from, effect.to);
  }
  const after = countOrbs(board);
  return { before, after, changed: ORBS.some(type => before[type] !== after[type]) };
}
export function conversionPreviewView(state: BattleState, member: number, skill: ActiveSkillDef): HTMLElement | null {
  const p = conversionPreview(state, member, skill);
  if (!p) return null;
  return h('section', { 'data-conversion-preview': '', 'aria-label': '本次轉珠效果' },
    h('h3', null, '本次轉珠效果'),
    h('p', { class: 'small-text dim' }, '僅顯示符石種類數量，不預測傷害或消除結果。'),
    h('ul', { class: 'small-text' }, ORBS.map(type => {
      const delta = p.after[type] - p.before[type];
      return h('li', null, `${NAMES[type]}：${p.before[type]} → ${p.after[type]}（${delta > 0 ? '+' : ''}${delta}）`);
    })),
    !p.changed && h('p', { class: 'small-text dim' }, '轉換後符石種類數量不變。'),
    p.before.heart > 0 && p.after.heart === 0 && h('p', { class: 'small-text' }, '注意：心珠將變為 0，這次轉珠後沒有心珠可用。'),
  );
}
