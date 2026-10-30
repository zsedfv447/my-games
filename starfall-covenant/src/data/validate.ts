// 資料檔驗證：檢查欄位與交叉引用，錯誤的資料在測試（CI）階段就擋下
import {
  ARCHETYPE_IDS, ATTRIBUTES, ORB_TYPES, RACES,
  type ActiveSkillDef, type ArchetypeDef, type CardDef, type ChapterDef, type EnemyDef, type GachaPoolDef,
  type GameConfig, type LeaderSkillDef, type QuestDef, type ShopItemDef, type StageDef, type StoryData,
  type Reward,
} from '../core/types';
import { checkLeaderEvolution, checkLeaderTier, lintLeaderSkill } from '../battle/leader';
import { isKnownCounter } from '../progression/quests';
import type { EventDef } from '../progression/events';
import type { LoreData } from '../progression/lore';
import { BOND_TIERS, type HelperBondDef } from '../progression/helper-bond';
import { CARD_BOND_TIERS, type CardBondDef } from '../progression/card-bond';

export interface GameData {
  config: GameConfig;
  archetypes: ArchetypeDef[];
  cards: CardDef[];
  skills: ActiveSkillDef[];
  leaderSkills: LeaderSkillDef[];
  enemies: EnemyDef[];
  stages: StageDef[];
  chapters: ChapterDef[];
  gachaPools: GachaPoolDef[];
  shop: ShopItemDef[];
  quests: QuestDef[];
  story: StoryData;
  events: EventDef[];
  /** 星骸殘頁（data/lore.json）；測試用的精簡資料可以省略 */
  lore?: LoreData;
}

/** 卡片勝利台詞（lines.victory）的字數上限 */
export const VICTORY_LINE_MAX = 30;

export function validateGameData(d: GameData): string[] {
  const errors: string[] = [];
  const err = (where: string, msg: string) => errors.push(`${where}: ${msg}`);

  const uniqueIds = (name: string, list: { id: string }[]) => {
    const seen = new Set<string>();
    for (const item of list) {
      if (seen.has(item.id)) err(name, `重複的 id ${item.id}`);
      seen.add(item.id);
    }
    return seen;
  };

  const cardIds = uniqueIds('cards', d.cards);
  const skillIds = uniqueIds('skills', d.skills);
  const leaderIds = uniqueIds('leader-skills', d.leaderSkills);
  const enemyIds = uniqueIds('enemies', d.enemies);
  const stageIds = uniqueIds('stages', d.stages);
  uniqueIds('gacha-pools', d.gachaPools);
  uniqueIds('shop', d.shop);
  uniqueIds('quests', d.quests);

  const archetypeIds = new Set(d.archetypes.map((a) => a.id));
  for (const id of ARCHETYPE_IDS) if (!archetypeIds.has(id)) err('archetypes', `缺少流派 ${id}`);

  const { cols, rows } = d.config.board;
  if (cols < 5 || rows < 4) err('config', `盤面太小 ${cols}×${rows}`);

  for (const c of d.cards) {
    const w = `cards/${c.id}`;
    if (!ATTRIBUTES.includes(c.attribute)) err(w, `未知屬性 ${c.attribute}`);
    if (!RACES.includes(c.race)) err(w, `未知種族 ${c.race}`);
    if (c.rarity < 1 || c.rarity > 6) err(w, `稀有度 ${c.rarity} 超出範圍`);
    if (c.activeSkill && !skillIds.has(c.activeSkill)) err(w, `找不到主動技 ${c.activeSkill}`);
    if (c.leaderSkill && !leaderIds.has(c.leaderSkill)) err(w, `找不到隊長技 ${c.leaderSkill}`);
    if (c.race !== 'material' && !c.leaderSkill) err(w, '戰鬥卡要有隊長技');
    if (c.evolution) {
      if (!cardIds.has(c.evolution.to)) err(w, `進化目標 ${c.evolution.to} 不存在`);
      for (const m of c.evolution.materials) if (!cardIds.has(m)) err(w, `進化素材 ${m} 不存在`);
    }
    for (const a of c.archetypes) if (!archetypeIds.has(a.id)) err(w, `未知流派 ${a.id}`);
    if (c.race !== 'material' && c.archetypes.length === 0) err(w, '戰鬥卡至少要屬於一個流派');
    const victory = c.lines?.victory;
    if (victory !== undefined && (!victory.trim() || [...victory].length > VICTORY_LINE_MAX)) err(w, `勝利台詞要 1–${VICTORY_LINE_MAX} 字（目前 ${[...victory].length} 字）`);
  }

  // 隊長技：寫了不會生效的組合、超出星數分級、進化後不是同主題加強版
  const leaderById = new Map(d.leaderSkills.map((l) => [l.id, l]));
  for (const l of d.leaderSkills) for (const issue of lintLeaderSkill(l)) err(`leader-skills/${l.id}`, issue);
  const cardById = new Map(d.cards.map((c) => [c.id, c]));
  for (const c of d.cards) {
    const leader = c.leaderSkill ? leaderById.get(c.leaderSkill) : undefined;
    if (!leader) continue;
    for (const issue of checkLeaderTier(leader, c.rarity)) err(`cards/${c.id}`, `隊長技 ${leader.id}：${issue}`);
    const evolved = c.evolution ? cardById.get(c.evolution.to) : undefined;
    const next = evolved?.leaderSkill ? leaderById.get(evolved.leaderSkill) : undefined;
    if (next) for (const issue of checkLeaderEvolution(leader, next)) err(`cards/${c.id}`, `進化到 ${evolved!.id}：${issue}`);
  }

  for (const s of d.skills) {
    if (s.cooldown.min > s.cooldown.max) err(`skills/${s.id}`, '最短冷卻大於最長冷卻');
    for (const e of s.effects) {
      if (e.type === 'convertOrbs' && !ORB_TYPES.includes(e.to)) err(`skills/${s.id}`, `未知珠子 ${e.to}`);
      if (e.type === 'rowToOrb' && !ORB_TYPES.includes(e.to)) err(`skills/${s.id}`, `未知珠子 ${e.to}`);
      if (e.type === 'twoColorBoard' && (e.colors.length !== 2 || e.colors[0] === e.colors[1] || e.colors.some((c) => !ORB_TYPES.includes(c)))) err(`skills/${s.id}`, `雙色盤要指定兩種不同的珠 ${e.colors}`);
    }
  }

  for (const e of d.enemies) if (!ATTRIBUTES.includes(e.attribute)) err(`enemies/${e.id}`, `未知屬性 ${e.attribute}`);

  for (const s of d.stages) {
    const w = `stages/${s.id}`;
    if (s.unlockAfter && !stageIds.has(s.unlockAfter)) err(w, `解鎖條件關卡 ${s.unlockAfter} 不存在`);
    if (s.waves.length === 0) err(w, '至少要有一波敵人');
    for (const wave of s.waves) for (const en of wave.enemies) if (!enemyIds.has(en)) err(w, `找不到敵人 ${en}`);
    for (const m of [...(s.fixedTeam?.members ?? []), ...(s.fixedTeam?.helper ? [s.fixedTeam.helper] : [])]) {
      if (!cardIds.has(m.card)) err(w, `借用隊伍的卡 ${m.card} 不存在`);
    }
    for (const id of s.teamRule?.requiredCards ?? []) if (!cardIds.has(id)) err(w, `隊伍限制的卡 ${id} 不存在`);
    for (const [slot, id] of Object.entries(s.story ?? {})) {
      if (id && !(id in d.story)) err(w, `劇情 ${slot} 引用的 ${id} 不存在`);
    }
    if (s.kind === 'trial' && (!s.archetype || !s.fixedTeam)) err(w, '流派試煉要指定 archetype 與 fixedTeam');
    for (const drop of s.drops) {
      if (!cardIds.has(drop.card)) err(w, `掉落卡 ${drop.card} 不存在`);
      if (drop.rate <= 0 || drop.rate > 1) err(w, `掉落率 ${drop.rate} 需介於 0–1`);
    }
  }

  const chapterNums = new Set(d.chapters.map((c) => c.chapter));
  d.chapters.forEach((c, i) => {
    const w = `chapters/${c.chapter}`;
    if (c.chapter !== i + 1) err(w, `章節編號要從 1 連續排列，第 ${i + 1} 筆是 ${c.chapter}`);
    if (!RACES.includes(c.race)) err(w, `未知種族 ${c.race}`);
    for (const r of c.starReward.cards ?? []) if (!cardIds.has(r.card)) err(w, `星章獎勵卡 ${r.card} 不存在`);
    if (!d.stages.some((s) => s.kind === 'main' && s.chapter === c.chapter)) err(w, '這一章沒有任何主線關卡');
  });
  for (const s of d.stages) {
    if (s.kind === 'main' && s.chapter !== undefined && !chapterNums.has(s.chapter)) err(`stages/${s.id}`, `章節 ${s.chapter} 不在 chapters.json`);
    for (const r of s.rewards.firstClear?.cards ?? []) if (!cardIds.has(r.card)) err(`stages/${s.id}`, `首通獎勵卡 ${r.card} 不存在`);
    for (const day of s.weekdays ?? []) if (day < 0 || day > 6) err(`stages/${s.id}`, `星期 ${day} 需介於 0–6`);
  }

  for (const [id, lines] of Object.entries(d.story)) {
    if (lines.length === 0) err(`story/${id}`, '劇情至少要有一句');
    for (const [i, line] of lines.entries()) if (!line.text) err(`story/${id}`, `第 ${i + 1} 句沒有內容`);
  }

  for (const p of d.gachaPools) {
    const w = `gacha-pools/${p.id}`;
    const total = Object.values(p.rates).reduce((a, b) => a + (b ?? 0), 0);
    if (Math.abs(total - 1) > 1e-6) err(w, `機率總和為 ${total}，應為 1`);
    for (const [rarity, list] of Object.entries(p.cards)) {
      if (!(Number(rarity) in p.rates)) err(w, `${rarity}★ 有卡片但沒有機率`);
      for (const id of list ?? []) if (!cardIds.has(id)) err(w, `卡池卡片 ${id} 不存在`);
    }
  }

  const checkReward = (w: string, r: Reward) => {
    for (const c of r.cards ?? []) if (!cardIds.has(c.card)) err(w, `獎勵卡 ${c.card} 不存在`);
    if (!r.coin && !r.gems && !r.stamina && !r.cards?.length && !Object.keys(r.tokens ?? {}).length) err(w, '獎勵是空的');
  };

  const eventIds = uniqueIds('events', d.events);
  for (const e of d.events) {
    if (e.period && !(Date.parse(e.period.end) > Date.parse(e.period.start))) err(`events/${e.id}`, '結束時間要晚於開始時間');
    if (e.period?.repeatDays !== undefined && e.period.repeatDays * 86_400_000 < Date.parse(e.period.end) - Date.parse(e.period.start)) {
      err(`events/${e.id}`, 'repeatDays 比一檔活動還短');
    }
  }
  // 活動限購要靠代幣找到所屬活動，才能依檔期重置
  for (const item of d.shop) {
    const tokens = Object.keys(item.price.tokens ?? {});
    if (item.limit?.per === 'event' && !d.events.some((e) => e.token && tokens.includes(e.token))) {
      err(`shop/${item.id}`, '活動限購的商品要用某個活動的代幣標價');
    }
  }

  // 每種用到的代幣都要有活動資料提供名稱
  const tokenNames = new Map(d.events.flatMap((e) => (e.token ? [[e.token, e.tokenName] as const] : [])));
  const usedTokens = new Map<string, string>();
  const useTokens = (where: string, tokens: Record<string, number> | undefined) => {
    for (const t of Object.keys(tokens ?? {})) if (!usedTokens.has(t)) usedTokens.set(t, where);
  };
  for (const item of d.shop) {
    useTokens(`shop/${item.id}`, item.price.tokens);
    if (!('type' in item.reward)) useTokens(`shop/${item.id}`, item.reward.tokens);
  }
  for (const q of d.quests) useTokens(`quests/${q.id}`, q.reward.tokens);
  for (const s of d.stages) useTokens(`stages/${s.id}`, s.rewards.firstClear?.tokens);
  for (const c of d.chapters) useTokens(`chapters/${c.chapter}`, c.starReward.tokens);
  for (const [t, where] of usedTokens) if (!tokenNames.get(t)) err(where, `代幣 ${t} 沒有名稱（請在 events.json 填 token 與 tokenName）`);

  for (const s of d.stages) if (s.kind === 'event' && (!s.event || !eventIds.has(s.event))) err(`stages/${s.id}`, `活動 ${s.event} 不在 events.json`);

  if (d.lore) {
    const stageIds = new Set(d.stages.map((s) => s.id));
    const pageIds = new Set<string>();
    const pageStages = new Set<string>();
    uniqueIds('lore', d.lore.volumes);
    for (const v of d.lore.volumes) {
      const w = `lore/${v.id}`;
      if (!v.pages.length) err(w, '每卷至少要有一頁');
      if (!v.secret.lines.length) err(w, '隱藏對話至少要有一句');
      for (const p of v.pages) {
        if (pageIds.has(p.id)) err(w, `殘頁 ${p.id} 重複`);
        pageIds.add(p.id);
        if (!stageIds.has(p.stage)) err(w, `殘頁 ${p.id} 的關卡 ${p.stage} 不存在`);
        if (pageStages.has(p.stage)) err(w, `關卡 ${p.stage} 有兩頁殘頁`);
        pageStages.add(p.stage);
        if (!p.text.length || p.text.some((t) => !t)) err(w, `殘頁 ${p.id} 沒有內容`);
      }
    }
  }

  for (const item of d.shop) {
    const w = `shop/${item.id}`;
    const { gems = 0, coin = 0, tokens = {} } = item.price;
    const amounts = [gems, coin, ...Object.values(tokens)];
    if (amounts.some((n) => n < 0) || !amounts.some((n) => n > 0)) err(w, '價格要大於 0');
    if (item.limit && item.limit.count < 1) err(w, '限購次數至少 1');
    if (!('type' in item.reward)) checkReward(w, item.reward);
  }

  for (const q of d.quests) {
    const w = `quests/${q.id}`;
    if (!isKnownCounter(q.counter, q.kind)) err(w, `未知的計數器 ${q.counter}`);
    if (!(q.target >= 1)) err(w, `目標 ${q.target} 至少要 1`);
    checkReward(w, q.reward);
  }

  return errors;
}

/** 流浪契印師情誼資料（data/helper-bonds.json）：每位 NPC 剛好一筆，各門檻一段 3～6 句劇情與一句感謝台詞 */
export function validateHelperBonds(bonds: HelperBondDef[], npcs: { id: string }[]): string[] {
  const errors: string[] = [];
  const err = (where: string, msg: string) => errors.push(`${where}: ${msg}`);
  const ids = new Set(npcs.map((n) => n.id));
  const seen = new Set<string>();
  for (const b of bonds) {
    const w = `helper-bonds/${b.npc}`;
    if (!ids.has(b.npc)) err(w, '找不到這位 NPC');
    if (seen.has(b.npc)) err(w, '重複的 NPC');
    seen.add(b.npc);
    if (b.stories.length !== BOND_TIERS.length) err(w, `劇情要有 ${BOND_TIERS.length} 段`);
    if (b.thanks.length !== BOND_TIERS.length) err(w, `感謝台詞要有 ${BOND_TIERS.length} 句`);
    for (const [i, s] of b.stories.entries()) {
      if (!s.title) err(w, `第 ${i + 1} 段劇情沒有標題`);
      if (s.lines.length < 3 || s.lines.length > 6) err(w, `第 ${i + 1} 段劇情要 3～6 句`);
      if (s.lines.some((l) => !l.text)) err(w, `第 ${i + 1} 段劇情有空白的句子`);
    }
    for (const [i, t] of b.thanks.entries()) {
      if (!t) err(w, `第 ${i + 1} 句感謝台詞是空的`);
      else if ([...t].length > VICTORY_LINE_MAX) err(w, `第 ${i + 1} 句感謝台詞超過 ${VICTORY_LINE_MAX} 字`);
    }
  }
  for (const id of ids) if (!seen.has(id)) err('helper-bonds', `${id} 沒有情誼資料`);
  return errors;
}

/** 角色羈絆小劇場（data/card-bonds.json）：family 必須是進化鏈最初型態的角色卡，各門檻一段 3～5 句的小劇場 */
export function validateCardBonds(bonds: CardBondDef[], cards: CardDef[]): string[] {
  const errors: string[] = [];
  const err = (where: string, msg: string) => errors.push(`${where}: ${msg}`);
  const evolvedInto = new Set(cards.flatMap((c) => (c.evolution ? [c.evolution.to] : [])));
  const seen = new Set<string>();
  for (const b of bonds) {
    const w = `card-bonds/${b.family}`;
    const card = cards.find((c) => c.id === b.family);
    if (!card) err(w, '找不到這張卡');
    else if (card.race === 'material') err(w, '素材卡不能有羈絆劇場');
    if (evolvedInto.has(b.family)) err(w, '要用進化鏈最初型態的卡號');
    if (seen.has(b.family)) err(w, '重複的角色');
    seen.add(b.family);
    if (b.scenes.length !== CARD_BOND_TIERS.length) err(w, `小劇場要有 ${CARD_BOND_TIERS.length} 段`);
    for (const [i, s] of b.scenes.entries()) {
      if (!s.title) err(w, `第 ${i + 1} 段小劇場沒有標題`);
      if (s.lines.length < 3 || s.lines.length > 5) err(w, `第 ${i + 1} 段小劇場要 3～5 句`);
      if (s.lines.some((l) => !l.text)) err(w, `第 ${i + 1} 段小劇場有空白的句子`);
    }
  }
  return errors;
}
