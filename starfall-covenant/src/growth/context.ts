import type { ActiveSkillDef, CardDef, GameConfig, LeaderSkillDef } from '../core/types';
import type { GameData } from '../data/validate';
import { GROWTH_RULES, type GrowthRules } from './rules';

export type GrowthData = Pick<GameData, 'config' | 'cards' | 'skills' | 'leaderSkills' | 'archetypes' | 'stages' | 'shop' | 'gachaPools' | 'quests'>;

/** 養成函式共用的查表資料。建立一次即可重複使用。 */
export interface GrowthContext {
  config: GameConfig;
  rules: GrowthRules;
  data: GrowthData;
  card(id: string): CardDef | undefined;
  skill(id: string): ActiveSkillDef | undefined;
  leaderSkill(id: string): LeaderSkillDef | undefined;
  /** 進化鏈的起點卡號；同一條鏈上的卡視為「同名卡」 */
  family(cardId: string): string;
  /** 進化前的卡號（沒有則為 undefined） */
  evolvesFrom(cardId: string): string | undefined;
}

export function createGrowthContext(data: GrowthData, rules: Partial<GrowthRules> = {}): GrowthContext {
  const cards = new Map(data.cards.map((c) => [c.id, c]));
  const skills = new Map(data.skills.map((s) => [s.id, s]));
  const leaderSkills = new Map(data.leaderSkills.map((s) => [s.id, s]));
  const parent = new Map<string, string>();
  for (const c of data.cards) if (c.evolution) parent.set(c.evolution.to, c.id);

  const familyCache = new Map<string, string>();
  const family = (cardId: string): string => {
    const cached = familyCache.get(cardId);
    if (cached) return cached;
    let root = cardId;
    const seen = new Set<string>();
    while (parent.has(root) && !seen.has(root)) {
      seen.add(root);
      root = parent.get(root)!;
    }
    familyCache.set(cardId, root);
    return root;
  };

  return {
    config: data.config,
    rules: { ...GROWTH_RULES, ...rules },
    data,
    card: (id) => cards.get(id),
    skill: (id) => skills.get(id),
    leaderSkill: (id) => leaderSkills.get(id),
    family,
    evolvesFrom: (id) => parent.get(id),
  };
}
