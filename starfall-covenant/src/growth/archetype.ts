// 流派相關的查詢：流派圖鑑、取得途徑、隊伍編成的流派提示與推薦搭配。
// 流派是本作核心，這些函式讓介面能告訴玩家「你在玩哪個流派、還缺什麼、去哪裡拿」。
import type {
  ArchetypeId, ArchetypeRole, Attribute, CardDef, OwnedCard, Race, SaveData, UnitFilter,
} from '../core/types';
import type { GrowthContext } from './context';
import { findCard } from './save-ops';

export const ATTRIBUTE_LABEL: Record<Attribute, string> = { fire: '焰', water: '潮', wood: '森', light: '輝', dark: '蝕' };
export const RACE_LABEL: Record<Race, string> = {
  beast: '獸裔', dragon: '龍嗣', machina: '機構', sylph: '靈仙', nether: '冥裔', human: '人傑', material: '素材',
};
export const ROLE_LABEL: Record<ArchetypeRole, string> = { leader: '隊長', core: '核心', support: '輔助' };

// ---------- 取得途徑 ----------

export interface CardSources {
  /** 會掉落或首通送這張卡的關卡 */
  stages: string[];
  /** 可以兌換這張卡的商店品項 */
  shop: string[];
  /** 獎勵這張卡的任務／成就 */
  quests: string[];
  /** 出現在哪些卡池 */
  gacha: string[];
  /** 由哪張卡進化而來 */
  evolvesFrom?: string;
}

export function cardSources(ctx: GrowthContext, cardId: string): CardSources {
  const { stages, shop, quests, gachaPools } = ctx.data;
  const hasCard = (r?: { cards?: { card: string }[] }) => Boolean(r?.cards?.some((c) => c.card === cardId));
  const sources: CardSources = {
    stages: stages.filter((s) => s.drops.some((d) => d.card === cardId) || hasCard(s.rewards.firstClear)).map((s) => s.id),
    shop: shop.filter((i) => 'cards' in i.reward && hasCard(i.reward)).map((i) => i.id),
    quests: quests.filter((q) => hasCard(q.reward)).map((q) => q.id),
    gacha: gachaPools.filter((p) => Object.values(p.cards).some((list) => list?.includes(cardId))).map((p) => p.id),
  };
  const from = ctx.evolvesFrom(cardId);
  if (from) sources.evolvesFrom = from;
  return sources;
}

/** 不靠抽卡就拿得到：關卡、商店、任務可得，或由這樣的卡進化而來 */
export function isFreeToObtain(ctx: GrowthContext, cardId: string, depth = 0): boolean {
  const s = cardSources(ctx, cardId);
  if (s.stages.length || s.shop.length || s.quests.length) return true;
  return depth < 8 && s.evolvesFrom !== undefined && isFreeToObtain(ctx, s.evolvesFrom, depth + 1);
}

// ---------- 流派圖鑑 ----------

export interface CodexCard {
  cardId: string;
  role: ArchetypeRole;
  /** 背包裡有這張卡 */
  owned: boolean;
  /** 背包裡有同一條進化鏈的其他型態（進化或退回就能用） */
  ownedFamily: boolean;
  free: boolean;
  sources: CardSources;
}

export interface CodexEntry {
  id: ArchetypeId;
  name: string;
  cards: CodexCard[];
  owned: number;
  total: number;
  /** 有免抽隊長 */
  hasFreeLeader: boolean;
  /** 玩家已經能組起這個流派：擁有（或同鏈擁有）至少 1 張隊長與 1 張核心 */
  playable: boolean;
}

export function archetypeCodex(save: SaveData, ctx: GrowthContext): CodexEntry[] {
  const ownedIds = new Set(save.inventory.cards.map((c) => c.cardId));
  const ownedFamilies = new Set(save.inventory.cards.map((c) => ctx.family(c.cardId)));
  return ctx.data.archetypes.map((a) => {
    const cards: CodexCard[] = [];
    for (const def of ctx.data.cards) {
      // 同一流派掛了多個角色（例如隊長兼核心）時只列一次，取第一個標籤
      const tag = def.archetypes.find((t) => t.id === a.id);
      if (tag) {
        cards.push({
          cardId: def.id,
          role: tag.role,
          owned: ownedIds.has(def.id),
          ownedFamily: ownedFamilies.has(ctx.family(def.id)),
          free: isFreeToObtain(ctx, def.id),
          sources: cardSources(ctx, def.id),
        });
      }
    }
    const has = (role: ArchetypeRole) => cards.some((c) => c.role === role && c.ownedFamily);
    return {
      id: a.id,
      name: a.name,
      cards,
      owned: cards.filter((c) => c.owned).length,
      total: cards.length,
      hasFreeLeader: cards.some((c) => c.role === 'leader' && c.free),
      playable: has('leader') && has('core'),
    };
  });
}

// ---------- 隊伍流派提示 ----------

const asList = <T>(v: T | T[] | undefined): T[] | undefined => (v === undefined ? undefined : Array.isArray(v) ? v : [v]);

export function matchesFilter(def: CardDef, filter: UnitFilter | undefined): boolean {
  if (!filter) return true;
  const attrs = asList(filter.attribute);
  const races = asList(filter.race);
  return (!attrs || attrs.includes(def.attribute)) && (!races || races.includes(def.race));
}

/**
 * 從隊長技推出隊伍成員該符合的條件：
 * 先看「全隊皆為…」條件，沒有的話合併加成效果的目標篩選。
 */
export function leaderTeamFilter(ctx: GrowthContext, leader: CardDef): UnitFilter | undefined {
  const skill = leader.leaderSkill ? ctx.leaderSkill(leader.leaderSkill) : undefined;
  if (!skill) return undefined;
  const required: UnitFilter[] = [];
  const targets: UnitFilter[] = [];
  for (const rule of skill.rules) {
    for (const c of rule.conditions) if (c.type === 'teamAll') required.push(c.filter);
    for (const e of rule.effects) {
      if ((e.type === 'atkMultiplier' || e.type === 'hpMultiplier' || e.type === 'rcvMultiplier') && e.target) targets.push(e.target);
    }
  }
  const source = required.length ? required : targets;
  if (!source.length) return undefined;
  const attrs = new Set<Attribute>();
  const races = new Set<Race>();
  let anyAttr = false;
  let anyRace = false;
  for (const f of source) {
    const a = asList(f.attribute);
    const r = asList(f.race);
    if (a) a.forEach((x) => attrs.add(x)); else anyAttr = true;
    if (r) r.forEach((x) => races.add(x)); else anyRace = true;
  }
  const filter: UnitFilter = {};
  if (!anyAttr && attrs.size) filter.attribute = [...attrs];
  if (!anyRace && races.size) filter.race = [...races];
  return filter.attribute || filter.race ? filter : undefined;
}

export interface TeamMemberFit {
  uid: string | null;
  cardId: string;
  isLeader: boolean;
  isHelper: boolean;
  fits: boolean;
  /** 這位成員在主流派裡的角色；通用輔助標為 support */
  role: ArchetypeRole | null;
  /** 不搭的原因（繁中） */
  reasons: string[];
}

export interface TeamArchetypeReport {
  /** 依隊長卡判定的主流派；隊長沒有流派隊長標籤時取隊上最多的流派 */
  primary: ArchetypeId | null;
  /** 隊上其他成員撐起的副流派（混搭提示） */
  secondary: ArchetypeId | null;
  filter?: UnitFilter;
  members: TeamMemberFit[];
  /** 0–1，符合主流派的成員比例（含助戰） */
  completion: number;
  /** 主流派還缺的角色，例如沒有核心卡 */
  missingRoles: ArchetypeRole[];
  /** 背包裡可以換上來的卡（符合主流派、不在本隊），由強到弱 */
  suggestions: string[];
}

const describeFilter = (f: UnitFilter): string => {
  const parts: string[] = [];
  const a = asList(f.attribute);
  const r = asList(f.race);
  if (a) parts.push(`${a.map((x) => ATTRIBUTE_LABEL[x]).join('／')}屬性`);
  if (r) parts.push(r.map((x) => RACE_LABEL[x]).join('／'));
  return parts.join('、');
};

/**
 * 分析一支隊伍的流派：主流派、每位成員搭不搭、完成度、缺的角色與推薦換上的卡。
 * memberUids 第 1 位是隊長；helperCardId 是助戰卡號（NPC 助戰沒有 uid）。
 */
export function analyzeTeam(
  save: SaveData, ctx: GrowthContext, memberUids: (string | null)[], helperCardId?: string,
): TeamArchetypeReport {
  const members: { uid: string | null; def: CardDef; owned?: OwnedCard; isHelper: boolean }[] = [];
  for (const uid of memberUids) {
    if (!uid) continue;
    const owned = findCard(save, uid);
    const def = owned && ctx.card(owned.cardId);
    if (owned && def) members.push({ uid, def, owned, isHelper: false });
  }
  const helperDef = helperCardId ? ctx.card(helperCardId) : undefined;
  if (helperDef) members.push({ uid: null, def: helperDef, isHelper: true });

  const empty: TeamArchetypeReport = {
    primary: null, secondary: null, members: [], completion: 0, missingRoles: [], suggestions: [],
  };
  if (!members.length) return empty;

  const leader = members[0];
  const tally = new Map<ArchetypeId, number>();
  for (const m of members) for (const t of m.def.archetypes) tally.set(t.id, (tally.get(t.id) ?? 0) + 1);
  const mostCommon = (exclude: ArchetypeId | null) =>
    [...tally.entries()].filter(([id]) => id !== exclude).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const primary = leader.def.archetypes.find((t) => t.role === 'leader')?.id ?? mostCommon(null);
  if (!primary) return { ...empty, members: members.map((m, i) => fitOf(m, i, false, null, [])) };

  let filter = leaderTeamFilter(ctx, leader.def);
  if (!filter && primary === 'mono') filter = { attribute: leader.def.attribute };
  if (!filter && primary === 'race') filter = { race: leader.def.race };
  const byFilterOnly = primary === 'mono' || primary === 'race';
  const primaryName = ctx.data.archetypes.find((a) => a.id === primary)?.name ?? primary;

  const judge = (def: CardDef): { fits: boolean; role: ArchetypeRole | null; reasons: string[] } => {
    const reasons: string[] = [];
    const tag = def.archetypes.find((t) => t.id === primary);
    const support = def.archetypes.some((t) => t.role === 'support');
    const role = tag?.role ?? (support ? 'support' : null);
    if (filter && !matchesFilter(def, filter)) reasons.push(`隊長技只加成${describeFilter(filter)}`);
    if (!byFilterOnly && !role) reasons.push(`不屬於「${primaryName}」流派`);
    return { fits: reasons.length === 0, role: byFilterOnly && !role && reasons.length === 0 ? 'core' : role, reasons };
  };

  const fits = members.map((m, i) => {
    const j = judge(m.def);
    return fitOf(m, i, j.fits, j.role, j.reasons);
  });

  const nonLeader = fits.filter((f) => !f.isLeader && f.fits);
  const missingRoles: ArchetypeRole[] = [];
  if (!nonLeader.some((f) => f.role === 'core')) missingRoles.push('core');
  if (!nonLeader.some((f) => f.role === 'support')) missingRoles.push('support');

  const inTeam = new Set(memberUids.filter((u): u is string => Boolean(u)));
  const suggestions = save.inventory.cards
    .filter((c) => !inTeam.has(c.uid))
    .map((c) => ({ c, def: ctx.card(c.cardId) }))
    .filter((x): x is { c: OwnedCard; def: CardDef } => Boolean(x.def) && x.def!.race !== 'material')
    .filter((x) => judge(x.def).fits)
    .sort((a, b) => {
      const rank = (d: CardDef) => (d.archetypes.some((t) => t.id === primary && t.role === 'core') ? 1 : 0);
      return rank(b.def) - rank(a.def) || b.def.rarity - a.def.rarity || b.c.level - a.c.level;
    })
    .slice(0, 5)
    .map((x) => x.c.uid);

  const result: TeamArchetypeReport = {
    primary,
    secondary: mostCommon(primary),
    members: fits,
    completion: fits.filter((f) => f.fits).length / fits.length,
    missingRoles,
    suggestions,
  };
  if (filter) result.filter = filter;
  return result;
}

function fitOf(
  m: { uid: string | null; def: CardDef; isHelper: boolean }, index: number,
  fits: boolean, role: ArchetypeRole | null, reasons: string[],
): TeamMemberFit {
  return { uid: m.uid, cardId: m.def.id, isLeader: index === 0, isHelper: m.isHelper, fits, role, reasons };
}
