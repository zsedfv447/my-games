// --progress 模式：依關卡在主線中的位置，估算玩家當時的等級、卡片等級、進化、覺醒與隊伍空間，組出放得下的流派隊。
// 全部是純函式；所有假設集中在 PROGRESS_ASSUMPTIONS，報表開頭會印出來。
import type { ArchetypeId, Attribute, CardDef, StageDef } from '../../src/core/types';
import type { TeamMemberInput } from '../../src/battle/battle-state';
import { createNewSave } from '../../src/save/save';
import { addPlayerExp, teamCostLimit } from '../../src/progression/player';
import { HELPER_NPCS, helperRoster } from '../../src/progression/helpers';
import { expForLevel, levelForExp, nextAwakening, type GrowthContext } from '../../src/growth';
import type { SimTeam } from './simulate';

export interface ProgressAssumptions {
  /** 每一關主線平均打幾次（首通＋重打拿星章、刷掉落） */
  mainClearsPerStage: number;
  /** 每通過一關主線，平均打幾次每日關卡（每日關卡開放後才算） */
  dailyRunsPerMainStage: number;
  /** 每日關卡中，打星核關（其餘打隊長屬性的經驗素材關）的比例 */
  coreDailyShare: number;
  /** 掉落的經驗素材全部平均餵給 5 位隊員（不算同屬加成） */
  feedMaterials: boolean;
  /** 持有的流派 5★（召喚取得）：第 chapter 章起累計擁有幾張 */
  fiveStarsByChapter: { chapter: number; count: number }[];
  /** 星輝結晶（通用突破素材）：通過這一關後開始累積 */
  crystalsFrom: string;
  /** 之後每通過一關主線平均得到幾顆（約 1 天推進 1 關 → 每月 7～8 顆） */
  crystalsPerMainStage: number;
  /** 結晶中從商店買的比例（每顆扣 crystalCoin 金幣） */
  crystalShopShare: number;
  crystalCoin: number;
}

export const PROGRESS_ASSUMPTIONS: ProgressAssumptions = {
  mainClearsPerStage: 2,
  dailyRunsPerMainStage: 1,
  coreDailyShare: 0.5,
  feedMaterials: true,
  // 開場教學召喚保底 1 張 5★；第 3 章前後星晶夠再抽到 1 張
  fiveStarsByChapter: [{ chapter: 1, count: 1 }, { chapter: 3, count: 2 }],
  // 克星週在 st-3-1 後開放（每週高級關首通 1 顆），商店每月限購 4 顆；合計每月約 8 顆，約一半用金幣買
  crystalsFrom: 'st-3-1',
  crystalsPerMainStage: 0.25,
  crystalShopShare: 0.5,
  crystalCoin: 10000,
};

export function describeAssumptions(a: ProgressAssumptions = PROGRESS_ASSUMPTIONS): string[] {
  return [
    `主線依解鎖順序推進，目標關之前的每一關平均打 ${a.mainClearsPerStage} 次（首通＋重打）。`,
    `每日關卡開放後，每通過一關主線平均打 ${a.dailyRunsPerMainStage} 次每日關卡：${Math.round(a.coreDailyShare * 100)}% 打星核關，其餘打隊長屬性的經驗素材關；關卡難度取當時已開放的最高階。`,
    '玩家經驗、卡片經驗、金幣、掉落都取期望值；掉落的經驗素材' + (a.feedMaterials ? '全部平均餵給 5 位隊員（不算同屬加成）。' : '不拿來強化。'),
    '強化的金幣花費不計；進化與覺醒要扣金幣與星核，金幣或星核不夠就不做。',
    '隊員滿級且有對應星核時進化，進化後多的經驗繼續算；之後有星紋覺醒的隊員依序解鎖覺醒，條件是突破階數、同屬星核與金幣都夠。',
    `星輝結晶：通過 ${a.crystalsFrom} 後每通過一關主線得 ${a.crystalsPerMainStage} 顆（約 1 天 1 關，每月 7～8 顆），其中 ${Math.round(a.crystalShopShare * 100)}% 用金幣買（每顆 ${a.crystalCoin.toLocaleString()}）。結晶優先給有星紋覺醒的隊員（稀有度高的先），每人最多突破到 +5；同名卡不估。`,
    `技能等級 1。持有的流派 5★：${a.fiveStarsByChapter.map((x) => `第 ${x.chapter} 章起 ${x.count} 張`).join('、')}，從常駐池中這個流派的 5★ 依序取，換掉稀有度最低的隊員；放不進隊伍空間就不換。`,
    '隊伍空間用 progression/player 的 teamCostLimit；進化後超過上限時，從 Cost 最高的隊員開始退回進化前。',
    '助戰：和出擊準備畫面一樣，取助戰名單中第一位沒有限制問題的 NPC（日期固定）。',
  ];
}

/** 主線依 unlockAfter 串成的順序 */
export function mainOrder(stages: StageDef[]): StageDef[] {
  const main = stages.filter((s) => s.kind === 'main');
  const next = new Map(main.map((s) => [s.unlockAfter, s]));
  const out: StageDef[] = [];
  for (let s = next.get(null); s && !out.includes(s); s = next.get(s.id)) out.push(s);
  return out;
}

export interface ProgressEstimate {
  stageId: string;
  /** 目標關之前已通過的主線關數 */
  mainCleared: number;
  chapter: number;
  playerLevel: number;
  teamCostLimit: number;
  coin: number;
  dailyRuns: number;
  /** 每位隊員可得的卡片經驗（戰鬥＋餵素材） */
  cardExpPerMember: number;
  /** 各屬性星核期望值 */
  cores: Record<Attribute, number>;
  /** 星輝結晶期望值 */
  crystals: number;
}

const ATTRS: Attribute[] = ['fire', 'water', 'wood', 'light', 'dark'];
/** 期望值是小數相加，比較時留一點誤差（0.2 × 5 會變成 0.9999…） */
const EPS = 1e-9;

/** 到 stage 之前，玩家的等級、金幣、卡片經驗與星核期望值 */
export function estimateProgress(
  stage: StageDef, stages: StageDef[], ctx: GrowthContext, leaderAttr: Attribute, a: ProgressAssumptions = PROGRESS_ASSUMPTIONS,
): ProgressEstimate {
  const order = mainOrder(stages);
  const idx = Math.max(0, order.findIndex((s) => s.id === stage.id));
  const before = order.slice(0, idx);
  const cleared = new Set(before.map((s) => s.id));
  const daily = stages.filter((s) => s.kind === 'daily');

  let playerExp = 0;
  let coin = 0;
  let battleExp = 0;
  let feedExp = 0;
  const cores = Object.fromEntries(ATTRS.map((x) => [x, 0])) as Record<Attribute, number>;
  const addDrops = (s: StageDef, runs: number) => {
    for (const d of s.drops ?? []) {
      const def = ctx.card(d.card);
      if (!def || def.race !== 'material') continue;
      const coreAttr = ATTRS.find((x) => ctx.rules.awakenMaterialByAttribute[x] === def.id);
      if (coreAttr) cores[coreAttr] += d.rate * runs;
      else if (a.feedMaterials) feedExp += d.rate * runs * def.expValue;
    }
  };
  const addRuns = (s: StageDef, runs: number) => {
    playerExp += s.rewards.playerExp * runs;
    coin += s.rewards.coin * runs;
    battleExp += (s.rewards.cardExp ?? 0) * runs;
    addDrops(s, runs);
  };

  let dailyRuns = 0;
  let crystals = 0;
  let crystalOpen = false;
  before.forEach((s, i) => {
    addRuns(s, a.mainClearsPerStage);
    if (crystalOpen) crystals += a.crystalsPerMainStage;
    if (s.id === a.crystalsFrom) crystalOpen = true;
    // 這一關打完時已開放的每日關卡（同類取最高階）
    const open = new Set(before.slice(0, i + 1).map((x) => x.id));
    const avail = daily.filter((d) => !d.unlockAfter || open.has(d.unlockAfter));
    const best = (pred: (d: StageDef) => boolean) => avail.filter(pred).sort((x, y) => y.stamina - x.stamina)[0];
    const coreStage = best((d) => d.id.includes('core'));
    const expStage = best((d) => d.id.includes(leaderAttr));
    const runs = avail.length ? a.dailyRunsPerMainStage : 0;
    dailyRuns += runs;
    if (coreStage) addRuns(coreStage, runs * a.coreDailyShare);
    if (expStage) addRuns(expStage, runs * (coreStage ? 1 - a.coreDailyShare : 1));
  });

  const save = createNewSave(ctx.config, 0);
  const level = addPlayerExp(save, playerExp, ctx.config, 0).save.player.level;
  return {
    stageId: stage.id,
    mainCleared: cleared.size,
    chapter: stage.chapter ?? 1,
    playerLevel: level,
    teamCostLimit: teamCostLimit(level),
    coin: Math.floor(coin + ctx.config.newPlayer.coin - crystals * a.crystalShopShare * a.crystalCoin),
    dailyRuns,
    cardExpPerMember: Math.floor(battleExp + feedExp / 5),
    cores,
    crystals,
  };
}

export interface ProgressMember {
  cardId: string;
  baseId: string;
  level: number;
  evolved: boolean;
  limitBreak: number;
  awakened: number;
}

export interface ProgressTeam {
  team: SimTeam;
  members: ProgressMember[];
  cost: number;
  limit: number;
  fiveStars: number;
}

/** 常駐池中這個流派的 5★（隊長優先） */
export function archetypeFiveStars(archetype: ArchetypeId, poolIds: string[], ctx: GrowthContext): CardDef[] {
  const roleOrder = { leader: 0, core: 1, support: 2 } as Record<string, number>;
  return poolIds.map((id) => ctx.card(id)).filter((c): c is CardDef => !!c && c.rarity === 5 && c.race !== 'material')
    .flatMap((c) => c.archetypes.filter((x) => x.id === archetype).map((x) => ({ c, r: roleOrder[x.role] ?? 3 })))
    .sort((x, y) => x.r - y.r || x.c.id.localeCompare(y.c.id))
    .map((x) => x.c);
}

export function fiveStarCount(chapter: number, a: ProgressAssumptions = PROGRESS_ASSUMPTIONS): number {
  return a.fiveStarsByChapter.filter((x) => chapter >= x.chapter).reduce((n, x) => Math.max(n, x.count), 0);
}

/** 依估算的進度，把入門隊成長成當時的樣子，並放進隊伍空間 */
export function buildProgressTeam(
  archetype: ArchetypeId, starterIds: string[], fiveStarPool: CardDef[], p: ProgressEstimate, ctx: GrowthContext,
  a: ProgressAssumptions = PROGRESS_ASSUMPTIONS,
): ProgressTeam {
  const cost = (ids: string[]) => ids.reduce((n, id) => n + (ctx.card(id)?.cost ?? 0), 0);
  // 1. 換進持有的 5★（換掉稀有度最低、Cost 最低的非隊長隊員），放不下就不換
  let ids = [...starterIds];
  let five = 0;
  for (const c of fiveStarPool.slice(0, fiveStarCount(p.chapter, a))) {
    if (ids.includes(c.id)) continue;
    const slot = ids.map((id, i) => ({ i, d: ctx.card(id)! })).filter((x) => x.i > 0)
      .sort((x, y) => x.d.rarity - y.d.rarity || x.d.cost - y.d.cost || y.i - x.i)[0]?.i;
    if (slot === undefined) break;
    const next = ids.map((id, i) => (i === slot ? c.id : id));
    if (cost(next) > p.teamCostLimit) continue;
    ids = next;
    five++;
  }

  // 2. 經驗、進化、覺醒
  const cores = { ...p.cores };
  let coin = p.coin;
  const members: ProgressMember[] = ids.map((baseId) => {
    let def = ctx.card(baseId)!;
    let exp = p.cardExpPerMember;
    let evolved = false;
    const cap = expForLevel(def, def.maxLevel, ctx.rules);
    const evo = def.evolution;
    const toDef = evo && ctx.card(evo.to);
    if (evo && toDef && exp >= cap && coin >= evo.coin) {
      const need = new Map<string, number>();
      for (const m of evo.materials) need.set(m, (need.get(m) ?? 0) + 1);
      const coreOf = (id: string) => ATTRS.find((x) => ctx.rules.awakenMaterialByAttribute[x] === id);
      const ok = [...need].every(([id, n]) => { const at = coreOf(id); return at ? cores[at] + EPS >= n : false; });
      if (ok) {
        for (const [id, n] of need) cores[coreOf(id)!] -= n;
        coin -= evo.coin;
        exp -= cap;
        def = toDef;
        evolved = true;
      }
    }
    const capNow = expForLevel(def, def.maxLevel, ctx.rules);
    return { cardId: def.id, baseId, level: levelForExp(def, Math.min(exp, capNow), ctx.rules), evolved, limitBreak: 0, awakened: 0 };
  });

  // 3. 超過隊伍空間：從 Cost 最高的進化隊員開始退回進化前
  const limit = p.teamCostLimit;
  const total = () => cost(members.map((m) => m.cardId));
  for (const m of [...members].filter((x) => x.evolved).sort((x, y) => (ctx.card(y.cardId)!.cost - ctx.card(x.cardId)!.cost))) {
    if (total() <= limit) break;
    const base = ctx.card(m.baseId)!;
    m.cardId = base.id;
    m.level = base.maxLevel;
    m.evolved = false;
  }

  // 4. 星輝結晶突破、星紋覺醒：有覺醒的隊員優先（稀有度高的先）
  let crystalsLeft = p.crystals;
  const byPriority = members.map((m, i) => ({ m, i, d: ctx.card(m.cardId)! }))
    .sort((x, y) => (y.d.awakenings?.length ?? 0) - (x.d.awakenings?.length ?? 0) || y.d.rarity - x.d.rarity || x.i - y.i);
  for (const { m } of byPriority) {
    const lb = Math.min(ctx.rules.maxLimitBreak, Math.floor(crystalsLeft + EPS));
    m.limitBreak = lb;
    crystalsLeft -= lb;
  }
  for (const { m, d } of byPriority) {
    for (let req = nextAwakening(d, m, ctx); req; req = nextAwakening(d, m, ctx)) {
      const at = d.attribute;
      if (m.limitBreak < req.limitBreak || cores[at] + EPS < req.materials || coin < req.coin) break;
      cores[at] -= req.materials;
      coin -= req.coin;
      m.awakened++;
    }
  }

  const toInput = (m: ProgressMember): TeamMemberInput => ({ cardId: m.cardId, level: m.level, skillLevel: 1, limitBreak: m.limitBreak, awakened: m.awakened });
  return { team: { archetype, members: members.map(toInput), helper: null }, members, cost: total(), limit, fiveStars: five };
}

/** 和出擊準備畫面一樣：第一位沒有限制問題的助戰 */
export function progressHelper(stage: StageDef, stages: StageDef[], ctx: GrowthContext, now: number): TeamMemberInput | null {
  const save = createNewSave(ctx.config, now);
  save.progress.clearedStages = mainOrder(stages).slice(0, Math.max(0, mainOrder(stages).findIndex((s) => s.id === stage.id))).map((s) => s.id);
  const offer = helperRoster(save, stage, HELPER_NPCS, stages, (id) => ctx.card(id), now).find((o) => !o.problem);
  return offer ? { cardId: offer.card.id, level: offer.level, skillLevel: offer.skillLevel } : null;
}
