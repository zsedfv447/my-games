// 隊伍能力檢查：依隊員的主動技與隊長技效果積木，看隊伍有沒有回血、轉珠、爆發、控場、減傷五類能力。
// 只給提醒、不限制混搭、不自動換人。純邏輯。
import type { ActiveSkillDef, CardDef, LeaderEffect, LeaderSkillDef, SkillEffect } from '../core/types';

export type Capability = 'heal' | 'board' | 'burst' | 'control' | 'defense';

export const CAPABILITIES: Capability[] = ['heal', 'board', 'burst', 'control', 'defense'];

export const CAPABILITY_LABEL: Record<Capability, string> = {
  heal: '回血', board: '轉珠', burst: '爆發', control: '控場', defense: '減傷',
};

/** 缺少時的一行提醒 */
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

export interface CapabilityReport {
  /** 每一類由哪些隊員提供（卡片名稱，不重複） */
  sources: Record<Capability, string[]>;
  missing: Capability[];
}

/**
 * members：隊員（第一位是隊長；隊長技只看隊長和助戰）。helper 為助戰卡（選填）。
 * 主動技每位隊員都算；隊長技只算隊長與助戰。
 */
export function teamCapabilities(
  members: CardDef[],
  skillOf: (id: string) => ActiveSkillDef | undefined,
  leaderOf: (id: string) => LeaderSkillDef | undefined,
  helper?: CardDef,
): CapabilityReport {
  const sources = Object.fromEntries(CAPABILITIES.map((c) => [c, [] as string[]])) as Record<Capability, string[]>;
  const add = (cap: Capability | undefined, name: string) => {
    if (cap && !sources[cap].includes(name)) sources[cap].push(name);
  };
  const all = helper ? [...members, helper] : members;
  for (const card of all) {
    const skill = card.activeSkill ? skillOf(card.activeSkill) : undefined;
    for (const e of skill?.effects ?? []) add(SKILL_CAP[e.type], card.name);
  }
  for (const card of [members[0], helper]) {
    const leader = card?.leaderSkill ? leaderOf(card.leaderSkill) : undefined;
    for (const rule of leader?.rules ?? []) for (const e of rule.effects) {
      // 回復倍率要真的大於 1 才算
      if (e.type === 'rcvMultiplier' && e.value <= 1) continue;
      add(LEADER_CAP[e.type], card!.name);
    }
  }
  return { sources, missing: members.length ? CAPABILITIES.filter((c) => sources[c].length === 0) : [] };
}
