// 七曜環的顯示（提案 96）：敵人名牌上方一排小圓點，一格一色；已點掉的變空心加斜線，全部點掉顯示「環碎」。
// 純靜態圖形（低特效也一樣清楚）；破格時的小動畫在低特效模式由 CSS 關掉。
import type { EnemyState } from '../../battle/battle-state';
import { ringOf } from '../../battle/skills/ring';
import type { OrbType } from '../../core/types';
import { ORB_COLORS, ORB_NAMES } from '../art/palette';
import { h } from '../dom';

/** 敵人身上的環；沒有環回傳 null */
export function ringBadge(e: Pick<EnemyState, 'statuses'>, justBroken: readonly OrbType[] = []): HTMLElement | null {
  const ring = ringOf(e);
  if (!ring) return null;
  if (ring.shattered) return h('div', { class: 'enemy-ring shattered', title: `七曜環已碎裂：受到的屬性攻擊 ×${ring.vulnerable}` }, `環碎・易傷×${ring.vulnerable}`);
  const left = ring.slots.filter((o) => !ring.broken.includes(o)).map((o) => ORB_NAMES[o]).join('、');
  return h('div', { class: 'enemy-ring', 'aria-label': `七曜環還剩：${left}`, title: `七曜環：用${left}的攻擊（心格要消除心珠）點掉格子，全部點掉後環碎裂` },
    ring.slots.map((o) => h('span', {
      class: ['ring-slot', ring.broken.includes(o) && 'broken', justBroken.includes(o) && 'just-broken'],
      style: { '--slot': ORB_COLORS[o].base },
      'aria-hidden': 'true',
    })));
}

/** 情報對話框用：「還剩：焰、潮、心」 */
export function ringSummary(e: Pick<EnemyState, 'statuses'>): string | null {
  const ring = ringOf(e);
  if (!ring) return null;
  if (ring.shattered) return `已碎裂，受到的屬性攻擊 ×${ring.vulnerable}`;
  const left = ring.slots.filter((o) => !ring.broken.includes(o)).map((o) => ORB_NAMES[o]).join('、');
  return `還剩 ${left}（減傷 ${ring.reduction}%；屬性格用該屬性的攻擊點掉、心格要消除心珠；固定與百分比傷害不能破環）`;
}
