// 戰鬥中的狀態標籤：敵人異常狀態、我方異常狀態、主動技增益，翻成短標籤與說明
import type { StatusId } from '../core/types';
import type { BattleState, Buff, EnemyState, StatusInstance } from '../battle/battle-state';
import { ATTRIBUTE_NAMES, ORB_NAMES } from './art/palette';

export type ChipTone = 'buff' | 'debuff' | 'enemy';

export interface StatusChip {
  text: string;
  tone: ChipTone;
  /** 點標籤時顯示的說明 */
  detail: string;
}

export const STATUS_NAMES: Record<StatusId, string> = {
  poison: '中毒',
  skillSeal: '技能封印',
  orbLock: '珠鎖',
  moveTimeDown: '轉珠縮短',
  shield: '護盾',
  attributeShield: '屬性減傷',
  comboShield: 'Combo 盾',
  heartSeal: '心珠封印',
  darkOrbs: '隱藏珠',
  poisonOrbs: '毒珠',
  lockedOrbs: '封鎖珠',
  damageAbsorb: '傷害吸收',
  enrage: '狂怒',
  delayImmune: '不受延遲',
  multiHit: '連擊',
};

const STATUS_DETAILS: Record<StatusId, string> = {
  poison: '每回合損失生命',
  skillSeal: '無法施放主動技',
  orbLock: '部分珠子無法移動',
  moveTimeDown: '轉珠時間縮短',
  shield: '受到的傷害大幅減少',
  attributeShield: '指定屬性的攻擊傷害減少',
  comboShield: 'Combo 數未達門檻時傷害無效',
  heartSeal: '消除心珠無法回復',
  darkOrbs: '部分珠子看不見顏色',
  poisonOrbs: '盤面出現毒珠，消除時扣血',
  lockedOrbs: '盤面出現封鎖珠',
  damageAbsorb: '單次傷害超過上限時改為回復敵人',
  enrage: '攻擊力提升',
  delayImmune: '不受延遲與鎖定影響',
  multiHit: '一次攻擊多下',
};

const turnsText = (t: number | null | undefined) => (t === null || t === undefined ? '' : ` ${t}`);

export function statusChip(s: StatusInstance, tone: ChipTone): StatusChip {
  let name = STATUS_NAMES[s.id] ?? s.id;
  const attr = s.params?.attribute;
  if (s.id === 'comboShield' && s.value) name = `Combo≥${s.value}`;
  if (s.id === 'attributeShield' && typeof attr === 'string' && attr in ATTRIBUTE_NAMES) name = `${ATTRIBUTE_NAMES[attr as keyof typeof ATTRIBUTE_NAMES]}減傷`;
  const turns = s.turns === null ? '（持續）' : `（剩 ${s.turns} 回合）`;
  return { text: `${name}${turnsText(s.turns)}`, tone, detail: `${STATUS_NAMES[s.id] ?? s.id}：${STATUS_DETAILS[s.id] ?? ''}${turns}` };
}

export function enemyChips(e: EnemyState): StatusChip[] {
  const chips = e.statuses.map((s) => statusChip(s, 'enemy'));
  if (e.lockedTurns > 0) chips.push({ text: `定身 ${e.lockedTurns}`, tone: 'debuff', detail: `被鎖定行動，還有 ${e.lockedTurns} 回合不會攻擊` });
  for (const d of e.dots) chips.push({ text: `持續傷害 ${d.turns}`, tone: 'debuff', detail: `每回合受到 ${Math.round(d.amount).toLocaleString()} 點${ATTRIBUTE_NAMES[d.attribute]}屬性傷害（剩 ${d.turns} 回合）` });
  return chips;
}

export function buffChip(b: Buff): StatusChip {
  const left = `（剩 ${b.turns} 回合）`;
  switch (b.kind) {
    case 'attack': return { text: `攻擊×${b.multiplier} ${b.turns}`, tone: 'buff', detail: `攻擊力 ${b.multiplier} 倍${left}` };
    case 'rcvToAtk': return { text: `回復轉攻 ${b.turns}`, tone: 'buff', detail: `回復力的 ${b.ratio} 倍加到攻擊力${left}` };
    case 'reduceDamage': return { text: `減傷${b.percent}% ${b.turns}`, tone: 'buff', detail: `受到的傷害減少 ${b.percent}%${left}` };
    case 'moveTime': return { text: `轉珠+${b.seconds}秒 ${b.turns}`, tone: 'buff', detail: `轉珠時間增加 ${b.seconds} 秒${left}` };
    case 'noSkyfallCombo': return { text: `天降不消 ${b.turns}`, tone: 'buff', detail: `新落下的珠不會自行消除${left}` };
    case 'skyfallRate': return { text: `${ORB_NAMES[b.orb]}珠天降 ${b.turns}`, tone: 'buff', detail: `${ORB_NAMES[b.orb]}紋珠更容易落下${left}` };
    case 'enhancedSkyfall': return { text: `強化天降 ${b.turns}`, tone: 'buff', detail: `落下的珠有機率是強化珠${left}` };
    case 'surviveOnce': return { text: `保命 ${b.turns}`, tone: 'buff', detail: `受到致命傷害時保留 1 點生命一次${left}` };
    case 'chainOnSkill': return { text: `技能追打 ${b.turns}`, tone: 'buff', detail: `施放主動技時追加攻擊${left}` };
  }
}

export function teamChips(state: Pick<BattleState, 'buffs' | 'teamStatuses'>): StatusChip[] {
  return [...state.buffs.map(buffChip), ...state.teamStatuses.map((s) => statusChip(s, 'debuff'))];
}
