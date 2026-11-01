// 列出能力來源與已知編成條件，不判斷當下生效。
// 只給提醒、不限制混搭、不自動換人。純邏輯。
import type { ActiveSkillDef, CardDef, LeaderCondition, LeaderEffect, LeaderSkillDef, SkillEffect, UnitFilter } from '../core/types';

import { ATTRIBUTE_NAMES, ORB_NAMES, RACE_NAMES } from './art/palette';

export type Capability = 'heal' | 'board' | 'burst' | 'control' | 'defense';

export const CAPABILITIES: Capability[] = ['heal', 'board', 'burst', 'control', 'defense'];

export const CAPABILITY_LABEL: Record<Capability, string> = {
  heal: '回復', board: '轉珠', burst: '爆發', control: '控場', defense: '防護',
};

/** 舊文案僅保留相容；本UI不得據此判斷當下有效性或斷言絕無此類能力。 */
export const CAPABILITY_HINT: Record<Capability, string> = {
  heal: '沒有回血手段：生命只靠心珠回復，長期戰容易被磨掉，可以帶有回復技能或回復倍率隊長技的卡。',
  board: '沒有轉珠技能：盤面不順時沒辦法救，可以帶能轉珠、洗版或補珠的卡。',
  burst: '沒有爆發技能：遇到高血量 Boss 會拖很久，可以帶提升攻擊或直接造成傷害的卡。',
  control: '沒有控場：敵人連續攻擊或上狀態時無法拖延，可以帶延遲、定身或解除異常的卡。',
  defense: '沒有減傷：Boss 大招可能一次打穿，可以帶減傷技能或減傷隊長技的卡。',
};

const SKILL_CAP: Partial<Record<SkillEffect['type'], Capability>> = {
  heal: 'heal',
  convertOrbs: 'board', refreshBoard: 'board', balanceBoard: 'board', enhanceOrbs: 'board', fillMissingOrbs: 'board',
  twoColorBoard: 'board', rowToOrb: 'board', setSkyfallRate: 'board',
  buffAttack: 'burst', damage: 'burst', damageOverTime: 'burst', rcvToAtk: 'burst', chainOnSkill: 'burst',
  delayEnemy: 'control', lockEnemy: 'control', cleanse: 'control',
  reduceDamage: 'defense', surviveOnce: 'defense',
};

const LEADER_CAP: Partial<Record<LeaderEffect['type'], Capability>> = {
  rcvMultiplier: 'heal',
  enemyCooldownPlus: 'control',
  damageReduction: 'defense',
};

export interface CapabilityDetail {
  cardId: string;
  cardName: string;
  source: 'active' | 'leader' | 'helper';
  status: 'available-method' | 'unconditional' | 'blocked-lineup' | 'conditional';
  skillDescription: string;
  explanation: string;
}
export interface CapabilityReport {
  /** 相容的潛在效果索引，不代表條件已滿足或目前能施放。 */
  sources: Record<Capability, string[]>;
  /** 相容的潛在效果缺項，不是絕對沒有生存／盤面選項。 */
  missing: Capability[];
  details: Record<Capability, CapabilityDetail[]>;
  incomplete: boolean;
}

type RuleStatus = Exclude<CapabilityDetail['status'], 'available-method'>;
const matches = (card: CardDef, filter: UnitFilter): boolean => {
  const attrs = filter.attribute === undefined ? undefined : Array.isArray(filter.attribute) ? filter.attribute : [filter.attribute];
  const races = filter.race === undefined ? undefined : Array.isArray(filter.race) ? filter.race : [filter.race];
  return (!attrs || attrs.includes(card.attribute)) && (!races || races.includes(card.race));
};
function conditionSummary(condition: LeaderCondition): string {
  switch (condition.type) {
    case 'always': return '常駐';
    case 'teamAll': {
      const attrs = condition.filter.attribute === undefined ? [] : [condition.filter.attribute].flat();
      const races = condition.filter.race === undefined ? [] : [condition.filter.race].flat();
      return `全隊（含助戰）${[attrs.length ? `屬性屬於${attrs.map(a => ATTRIBUTE_NAMES[a]).join('／')}` : '', races.length ? `種族屬於${races.map(r => RACE_NAMES[r]).join('／')}` : ''].filter(Boolean).join('且') || '符合指定範圍'}`;
    }
    case 'hpBelow': return `生命低於 ${condition.percent}%`;
    case 'hpAbove': return `生命至少 ${condition.percent}%`;
    case 'comboAtLeast': return `Combo 至少 ${condition.combo}`;
    case 'heartsMatched': return `消除心珠至少 ${condition.count} 組`;
    case 'orbsInOneMatch': return `一組${condition.orb ? ORB_NAMES[condition.orb] : '任一色'}珠至少 ${condition.count} 顆`;
    case 'attributesMatched': return `消除指定範圍內至少 ${condition.count} 種珠色`;
    case 'enhancedOrbsMatched': return `消除強化珠至少 ${condition.count} 顆`;
    case 'skillUsedThisTurn': return '本回合已使用主動技';
    default: return '其他尚未判讀的條件';
  }
}
function ruleStatus(conditions: readonly LeaderCondition[], lineup: readonly (CardDef | null | undefined)[]): RuleStatus {
  let conditional = false;
  for (const condition of conditions) {
    if (condition.type === 'always') continue;
    if (condition.type === 'teamAll') {
      if (lineup.some(card => card && !matches(card, condition.filter))) return 'blocked-lineup';
      if (lineup.some(card => card === undefined) || !lineup.some(card => !!card)) conditional = true;
    } else conditional = true;
  }
  return conditional ? 'conditional' : 'unconditional';
}

/** 保留原始位置：null是空位，undefined是卡片資料缺失。省略helper代表未確認，null代表明確不帶。 */
export function teamCapabilities(
  members: readonly (CardDef | null | undefined)[],
  skillOf: (id: string) => ActiveSkillDef | undefined,
  leaderOf: (id: string) => LeaderSkillDef | undefined,
  helper?: CardDef | null,
): CapabilityReport {
  const sources = Object.fromEntries(CAPABILITIES.map(cap => [cap, [] as string[]])) as Record<Capability, string[]>;
  const details = Object.fromEntries(CAPABILITIES.map(cap => [cap, [] as CapabilityDetail[]])) as Record<Capability, CapabilityDetail[]>;
  let incomplete = members.some(card => card === undefined);
  const add = (cap: Capability | undefined, card: CardDef, detail: Omit<CapabilityDetail, 'cardId' | 'cardName'>) => {
    if (!cap) return;
    if (!sources[cap].includes(card.name)) sources[cap].push(card.name);
    // 不跨規則合併，避免不同條件被同名來源掩蓋。
    details[cap].push({ cardId: card.id, cardName: card.name, ...detail });
  };
  const lineup = [...members, helper];
  for (const card of lineup) {
    if (!card?.activeSkill) continue;
    const skill = skillOf(card.activeSkill);
    if (!skill) { incomplete = true; continue; }
    for (const effect of skill.effects) {
      const explanation = effect.type === 'surviveOnce'
        ? '主動技保命手段（須能施放），不是減傷效果；仍依原技能的次數與條件。'
        : '主動技手段（須能施放）；冷卻、封印與戰鬥狀態需在實際戰鬥確認。';
      add(SKILL_CAP[effect.type], card, { source: 'active', status: 'available-method', skillDescription: skill.description, explanation });
    }
  }
  for (const [card, source] of [[members[0], 'leader'], [helper, 'helper']] as const) {
    if (!card?.leaderSkill) continue;
    const leader = leaderOf(card.leaderSkill);
    if (!leader) { incomplete = true; continue; }
    for (const rule of leader.rules) {
      const status = ruleStatus(rule.conditions, lineup);
      const teamAll = rule.conditions.some(condition => condition.type === 'teamAll');
      const dynamic = rule.conditions.some(condition => condition.type !== 'teamAll' && condition.type !== 'always');
      const composition = !teamAll ? '' : status === 'blocked-lineup'
        ? '目前已知隊員或助戰不符合全隊指定種族／屬性條件。'
        : lineup.some(card => card === undefined)
          ? '全隊條件包含助戰；尚有未知卡片或未確認助戰，不能確認編成。'
          : '目前已知編成符合條件（包含已確認助戰或明確不帶助戰）。';
      const conditionText = dynamic ? '仍需確認生命、消珠或其他戰鬥條件；此處不模擬當前戰鬥。'
        : teamAll ? '這是編成條件判定，不保證所有戰鬥時刻都生效。' : '常駐規則描述，不等於對每個目標或每個戰鬥時刻的效果保證。';
      for (const effect of rule.effects) {
        if (effect.type === 'rcvMultiplier' && effect.value <= 1) continue;
        const effectText = effect.type === 'rcvMultiplier'
          ? effect.target ? '提高符合目標的成員回復倍率，不是直接回復生命，也不保證全員受益。' : '提高回復倍率，不是直接回復生命。'
          : '';
        add(LEADER_CAP[effect.type], card, { source, status, skillDescription: leader.description, explanation: `規則條件：${rule.conditions.map(conditionSummary).join('，且') || '無額外條件'}。` + composition + conditionText + effectText });
      }
    }
  }
  return { sources, missing: members.length ? CAPABILITIES.filter(cap => !sources[cap].length) : [], details, incomplete };
}
